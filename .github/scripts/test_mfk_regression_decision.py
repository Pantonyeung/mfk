import importlib.util
import json
import subprocess
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("mfk_regression_decision.py")
SPEC = importlib.util.spec_from_file_location("mfk_regression_decision", MODULE_PATH)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def manifest(*allowed_paths):
    return {
        "capability": "TEST",
        "allowed_paths": list(allowed_paths),
        "authority_impact": "NONE",
        "persistence_impact": "NONE",
        "provider_impact": "NONE",
        "transaction_impact": "NONE",
        "severity": "WARNING",
    }


class RegressionDecisionTests(unittest.TestCase):
    def init_repo(self, folder):
        repo = Path(folder)
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.com"], check=True)
        return repo

    def commit(self, repo, message):
        subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
        subprocess.run(["git", "-C", str(repo), "commit", "-qm", message], check=True)
        return subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()

    def write_manifest(self, repo, base_sha, capability="TEST", allowed=None):
        path = repo / ".github" / "mfk-change-manifest.json"
        path.parent.mkdir(exist_ok=True)
        data = manifest(*(allowed or [".github/mfk-change-manifest.json", "docs/**"])) | {
            "capability": capability,
            "base_sha": base_sha,
            "expected_behavior_change": [],
            "non_goals": [],
            "rollback_sha": base_sha,
        }
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def run_report(self, repo, manifest_path, base_sha):
        args = Namespace(
            repo=str(repo), manifest=str(manifest_path), head="HEAD", base_fallback=base_sha,
            results=None, json_out=str(repo / "report.json"), markdown_out=str(repo / "report.md"),
        )
        self.assertEqual(gate.report_command(args), 0)
        return json.loads((repo / "report.json").read_text(encoding="utf-8"))

    def test_docs_only_skips_product_regression(self):
        report = gate.build_report(manifest("docs/**"), [], ["docs/control/example.md"], None)
        self.assertEqual(report["AFFECTED_PORTS"], ["GOVERNANCE"])
        self.assertEqual(report["RELEVANT_TESTS"], [])

    def test_smm_only_selects_smm_and_smt_integration(self):
        report = gate.build_report(manifest("v2smm/**"), [], ["v2smm/src/App.tsx"], None)
        self.assertEqual(report["AFFECTED_PORTS"], ["SMM", "SMT_SMM"])
        self.assertEqual({row["id"] for row in report["RELEVANT_TESTS"]}, {"smm.build", "smm.test", "smt.smm-cross"})

    def test_shared_contract_expands_all_ports(self):
        report = gate.build_report(manifest("contracts/**"), [], ["contracts/smm-lan-v1.ts"], None)
        self.assertTrue({"ADMIN", "SMT", "SMM", "CUSTOMER", "OWNER", "KEETA", "CROSS_PORT"}.issubset(report["AFFECTED_PORTS"]))
        self.assertGreater(len(report["RELEVANT_TESTS"]), 10)

    def test_undeclared_path_is_hard_risk(self):
        report = gate.build_report(manifest("v2smm/**"), [], ["v2smm/src/App.tsx", "v2admin/worker.ts"], None)
        self.assertEqual(report["UNDECLARED_PATHS"], ["v2admin/worker.ts"])
        self.assertIn("UNDECLARED_BLAST_RADIUS", report["HARD_RISKS"])

    def test_base_red_candidate_red_is_known_red(self):
        results = {"suites": {"smm.test": {"base": {"status": "FAIL"}, "candidate": {"status": "FAIL"}}}}
        hard, soft, warnings, known = gate.compare_results(["smm.test"], results)
        self.assertEqual((hard, soft, warnings), ([], [], []))
        self.assertEqual(known, ["KNOWN_RED:smm.test"])

    def test_candidate_only_red_is_new_regression(self):
        results = {"suites": {"smm.build": {"base": {"status": "PASS"}, "candidate": {"status": "FAIL"}}}}
        hard, soft, warnings, known = gate.compare_results(["smm.build"], results)
        self.assertEqual(hard, ["NEW_REGRESSION:smm.build"])
        self.assertEqual((soft, warnings, known), ([], [], []))

    def test_shadow_report_returns_zero_even_for_hard_risk(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.init_repo(folder)
            (repo / "docs").mkdir()
            (repo / "docs" / "base.md").write_text("base\n", encoding="utf-8")
            base = self.commit(repo, "base")
            (repo / "v2local").mkdir()
            (repo / "v2local" / "unexpected.ts").write_text("export {};\n", encoding="utf-8")
            manifest_path = self.write_manifest(repo, base, allowed=[".github/mfk-change-manifest.json"])
            self.commit(repo, "candidate")
            self.assertEqual(self.run_report(repo, manifest_path, base)["DECISION"], "HARD_BLOCK")

    def test_inherited_manifest_is_not_candidate_owned(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.init_repo(folder)
            manifest_path = self.write_manifest(repo, "0" * 40, capability="OLD_CANDIDATE")
            (repo / "docs").mkdir()
            (repo / "docs" / "base.md").write_text("base\n", encoding="utf-8")
            base = self.commit(repo, "base with historical manifest")
            (repo / "docs" / "candidate.md").write_text("candidate\n", encoding="utf-8")
            self.commit(repo, "candidate docs")

            report = self.run_report(repo, manifest_path, base)
            self.assertEqual(report["MANIFEST_OWNERSHIP"], "INHERITED_OR_MISSING")
            self.assertIn("MANIFEST_NOT_CANDIDATE_OWNED", report["WARNINGS"])
            self.assertIn("GOVERNANCE_EVIDENCE_MISSING", report["WARNINGS"])
            self.assertEqual(report["UNDECLARED_PATHS"], [])
            self.assertEqual(report["RELEVANT_TESTS"], [])

    def test_candidate_manifest_delta_is_loaded(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.init_repo(folder)
            manifest_path = self.write_manifest(repo, "0" * 40, capability="OLD_CANDIDATE")
            base = self.commit(repo, "base with historical manifest")
            self.write_manifest(repo, base, capability="FRESH_CANDIDATE")
            (repo / "docs").mkdir()
            (repo / "docs" / "candidate.md").write_text("candidate\n", encoding="utf-8")
            self.commit(repo, "candidate owns manifest")

            report = self.run_report(repo, manifest_path, base)
            self.assertEqual(report["MANIFEST_OWNERSHIP"], "CANDIDATE_OWNED")
            self.assertEqual(report["CAPABILITY"], "FRESH_CANDIDATE")
            self.assertNotIn("MANIFEST_NOT_CANDIDATE_OWNED", report["WARNINGS"])

    def test_stale_manifest_base_does_not_widen_candidate_diff(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = self.init_repo(folder)
            (repo / "docs").mkdir()
            (repo / "docs" / "first.md").write_text("first\n", encoding="utf-8")
            stale_base = self.commit(repo, "first base")
            (repo / "v2smm").mkdir()
            (repo / "v2smm" / "accepted.ts").write_text("export {};\n", encoding="utf-8")
            live_base = self.commit(repo, "accepted product change")
            manifest_path = self.write_manifest(repo, stale_base, capability="STALE_BASE_CANDIDATE")
            (repo / "docs" / "candidate.md").write_text("candidate\n", encoding="utf-8")
            self.commit(repo, "governance candidate")

            report = self.run_report(repo, manifest_path, live_base)
            self.assertEqual(report["EFFECTIVE_BASE_SHA"], live_base)
            self.assertIn("STALE_MANIFEST_BASE_IGNORED", report["WARNINGS"])
            self.assertNotIn("v2smm/accepted.ts", report["CHANGED_FILES"])
            self.assertEqual(report["RELEVANT_TESTS"], [])

    def test_workflow_tooling_failures_are_non_blocking(self):
        workflow = (Path(__file__).parents[1] / "workflows" / "mfk-regression-shadow.yml").read_text(encoding="utf-8")
        self.assertIn("continue-on-error: true", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn("ref: ${{ github.event.pull_request.head.sha || github.sha }}", workflow)
        self.assertIn("GOVERNANCE_TOOLING_FAILURE", workflow)
        self.assertIn("Shadow mode completion", workflow)

    def test_ruleset_and_legacy_protection_evidence_are_separate(self):
        proposal = (Path(__file__).parents[2] / "docs" / "control" / "MFK_MAIN_RULESET_PROPOSAL.md").read_text(encoding="utf-8")
        self.assertIn("repository Rulesets = 0", proposal)
        self.assertIn("Legacy branch protection state has not been verified", proposal)
        self.assertNotIn("`main` has no branch protection", proposal)

    def test_commander_drift_requires_stop_and_report(self):
        agents = (Path(__file__).parents[2] / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("verify the declared parent SHA and live repository evidence", agents)
        self.assertIn("supersession is explicitly Owner-directed and recorded", agents)
        self.assertIn("Do not silently infer supersession", agents)
        self.assertIn("**STOP**", agents)
        self.assertIn("GOVERNANCE_DRIFT", agents)


if __name__ == "__main__":
    unittest.main()
