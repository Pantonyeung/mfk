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
        "transaction_impact": "NONE",
        "severity": "WARNING",
    }


class RegressionDecisionTests(unittest.TestCase):
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
            repo = Path(folder)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.com"], check=True)
            (repo / "docs").mkdir()
            (repo / "docs" / "base.md").write_text("base\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
            base = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            (repo / "v2local").mkdir()
            (repo / "v2local" / "unexpected.ts").write_text("export {};\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "candidate"], check=True)
            manifest_path = repo / "manifest.json"
            data = manifest("docs/**") | {
                "base_sha": base, "provider_impact": "NONE", "expected_behavior_change": [],
                "non_goals": [], "rollback_sha": base,
            }
            manifest_path.write_text(json.dumps(data), encoding="utf-8")
            args = Namespace(repo=str(repo), manifest=str(manifest_path), head="HEAD", base_fallback="", results=None,
                             json_out=str(repo / "report.json"), markdown_out=str(repo / "report.md"))
            self.assertEqual(gate.report_command(args), 0)
            self.assertEqual(json.loads((repo / "report.json").read_text())["DECISION"], "HARD_BLOCK")

    def test_workflow_tooling_failures_are_non_blocking(self):
        workflow = (Path(__file__).parents[1] / "workflows" / "mfk-regression-shadow.yml").read_text(encoding="utf-8")
        self.assertIn("continue-on-error: true", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn("ref: ${{ github.event.pull_request.head.sha || github.sha }}", workflow)
        self.assertIn("Shadow mode completion", workflow)


if __name__ == "__main__":
    unittest.main()
