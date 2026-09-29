#!/usr/bin/env python3
"""MFK scoped regression classifier. Shadow mode always reports and exits zero."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import shutil
import subprocess
from collections import defaultdict
from pathlib import Path


REQUIRED_MANIFEST_FIELDS = (
    "capability",
    "base_sha",
    "allowed_paths",
    "authority_impact",
    "persistence_impact",
    "provider_impact",
    "transaction_impact",
    "expected_behavior_change",
    "non_goals",
    "rollback_sha",
    "severity",
)
SHA40 = re.compile(r"^[0-9a-f]{40}$")

SUITES = {
    "admin.test": {
        "port": "ADMIN", "cwd": "v2admin", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "admin.build": {
        "port": "ADMIN", "cwd": "v2admin", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "smt.test": {
        "port": "SMT", "cwd": "v2local", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/v2local-smoke.yml",
    },
    "smt.build": {
        "port": "SMT", "cwd": "v2local", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/v2local-smoke.yml",
    },
    "smm.test": {
        "port": "SMM", "cwd": "v2smm", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/smm-stage2-main-landing-r1.yml",
    },
    "smm.build": {
        "port": "SMM", "cwd": "v2smm", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/smm-stage2-main-landing-r1.yml",
    },
    "smt.smm-cross": {
        "port": "SMT_SMM", "cwd": "v2local",
        "command": ["npx", "vitest", "run", "src/runtime/smm-lan-ingress.test.ts", "src/runtime/smm-combo-revalidation.test.ts", "src/runtime/smm-web-acceptance-intake.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/smm-stage2-main-landing-r1.yml",
    },
    "customer.test": {
        "port": "CUSTOMER", "cwd": "v2customer", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/customer-ui5-submit-wait-r1.yml",
    },
    "customer.build": {
        "port": "CUSTOMER", "cwd": "v2customer", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/customer-ui5-submit-wait-r1.yml",
    },
    "smt.customer-cross": {
        "port": "CUSTOMER_SMT", "cwd": "v2local",
        "command": ["npx", "vitest", "run", "src/runtime/customer-cloud-intake.test.ts", "src/runtime/customer-combo-ordering-r1.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/customer-ui5-submit-wait-r1.yml",
    },
    "owner.test": {
        "port": "OWNER", "cwd": "v2owner", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/owner-runtime-connection-r2.yml",
    },
    "owner.build": {
        "port": "OWNER", "cwd": "v2owner", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/owner-runtime-connection-r2.yml",
    },
    "admin.owner-boundary": {
        "port": "OWNER_ADMIN", "cwd": "v2admin",
        "command": ["npx", "vitest", "run", "src/owner-runtime-connection.test.ts", "src/owner-sellability-r1.test.ts", "src/owner-channel-planning-r1.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/owner-runtime-connection-r2.yml",
    },
    "keeta.test": {
        "port": "KEETA", "cwd": "integrations/keeta", "command": ["npm", "test"],
        "severity": "SOFT_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "keeta.build": {
        "port": "KEETA", "cwd": "integrations/keeta", "command": ["npm", "run", "build"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "admin.keeta-cross": {
        "port": "KEETA_ADMIN", "cwd": "v2admin",
        "command": ["npx", "vitest", "run", "src/keeta-admin-proxy.test.ts", "src/keeta-live-runtime.test.ts", "src/keeta-menu-projection.test.ts", "src/keeta-store-projection.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "smt.keeta-cross": {
        "port": "KEETA_SMT", "cwd": "v2local",
        "command": ["npx", "vitest", "run", "src/runtime/keeta-order-intake.test.ts", "src/runtime/keeta-order-lifecycle.test.ts", "src/runtime/keeta-after-sale.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
    },
    "smt.carrier-boundary": {
        "port": "OTA", "cwd": "v2local",
        "command": ["npx", "vitest", "run", "src/runtime/runtime-carrier-boundary.test.ts", "src/runtime/web-acceptance-build-identity.test.ts"],
        "severity": "HARD_BLOCK", "source": ".github/workflows/v2local-smoke.yml",
    },
}

PORT_SUITES = {
    "ADMIN": {"admin.test", "admin.build", "smt.admin-cross"},
    "SMT": {"smt.test", "smt.build"},
    "SMM": {"smm.test", "smm.build", "smt.smm-cross"},
    "CUSTOMER": {"customer.test", "customer.build", "smt.customer-cross"},
    "OWNER": {"owner.test", "owner.build", "admin.owner-boundary"},
    "KEETA": {"keeta.test", "keeta.build", "admin.keeta-cross", "smt.keeta-cross"},
    "CARRIER": {"smt.carrier-boundary"},
}

# Admin-to-SMT checks already present in current workflows; this is only a scoped invocation.
SUITES["smt.admin-cross"] = {
    "port": "ADMIN_SMT", "cwd": "v2local",
    "command": ["npx", "vitest", "run", "src/runtime/admin-config-sync.test.ts", "src/runtime/admin-menu-link.test.ts", "src/runtime/admin-menu-transfer.test.ts"],
    "severity": "HARD_BLOCK", "source": ".github/workflows/admin-crossport-integration-gate.yml",
}

GOVERNANCE_PATTERNS = (
    "docs/**", "AGENTS.md", "README.md", "REPORT.md", "COMMANDER_CURRENT.md", "HANDOFF_CURRENT.md",
    ".github/mfk-change-manifest.json", ".github/mfk-change-manifest.example.json",
    ".github/pull_request_template.md", ".github/scripts/**", ".github/workflows/mfk-regression-shadow.yml",
)


def matches(path: str, patterns: list[str] | tuple[str, ...]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def load_manifest(path: Path, fallback_base: str = "") -> tuple[dict, list[str]]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"capability": "UNKNOWN", "base_sha": fallback_base, "allowed_paths": []}, [f"MANIFEST_INVALID:{exc}"]
    for field in REQUIRED_MANIFEST_FIELDS:
        if field not in data:
            errors.append(f"MANIFEST_FIELD_MISSING:{field}")
    base_sha = str(data.get("base_sha", fallback_base))
    rollback_sha = str(data.get("rollback_sha", ""))
    if not SHA40.fullmatch(base_sha):
        errors.append("BASE_SHA_INVALID")
        data["base_sha"] = fallback_base
    if not SHA40.fullmatch(rollback_sha):
        errors.append("ROLLBACK_SHA_INVALID")
    allowed = data.get("allowed_paths", [])
    if not isinstance(allowed, list) or not allowed or not all(isinstance(item, str) for item in allowed):
        errors.append("ALLOWED_PATHS_INVALID")
        data["allowed_paths"] = []
    elif any(Path(item).is_absolute() or ".." in Path(item).parts for item in allowed):
        errors.append("ALLOWED_PATHS_UNSAFE")
    if data.get("severity") not in {"HARD_BLOCK", "SOFT_BLOCK", "WARNING"}:
        errors.append("SEVERITY_INVALID")
    return data, errors


def git_output(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def changed_files(repo: Path, base_sha: str, head: str) -> list[str]:
    output = git_output(repo, "diff", "--name-only", "--diff-filter=ACDMRTUXB", f"{base_sha}...{head}")
    return sorted(line.replace("\\", "/") for line in output.splitlines() if line)


def classify_paths(paths: list[str]) -> tuple[list[str], list[str], list[str], list[str]]:
    ports: set[str] = set()
    suite_ids: set[str] = set()
    hard: list[str] = []
    warnings: list[str] = []
    for path in paths:
        if matches(path, GOVERNANCE_PATTERNS):
            ports.add("GOVERNANCE")
            continue
        if path.startswith(".github/workflows/"):
            ports.add("GOVERNANCE")
            hard.append(f"DELIVERY_WORKFLOW_CHANGE_REQUIRES_OWNER_REVIEW:{path}")
        elif path.startswith("v2admin/"):
            ports.add("ADMIN"); suite_ids.update(PORT_SUITES["ADMIN"])
        elif path.startswith("v2local/"):
            ports.add("SMT"); suite_ids.update(PORT_SUITES["SMT"])
        elif path.startswith("v2smm/"):
            ports.update(("SMM", "SMT_SMM")); suite_ids.update(PORT_SUITES["SMM"])
        elif path.startswith("v2customer/"):
            ports.update(("CUSTOMER", "CUSTOMER_SMT")); suite_ids.update(PORT_SUITES["CUSTOMER"])
        elif path.startswith("v2owner/"):
            ports.update(("OWNER", "OWNER_ADMIN")); suite_ids.update(PORT_SUITES["OWNER"])
        elif path.startswith("integrations/keeta/"):
            ports.update(("KEETA", "ADMIN", "SMT")); suite_ids.update(PORT_SUITES["KEETA"])
        elif path.startswith("contracts/"):
            ports.update(("ADMIN", "SMT", "SMM", "CUSTOMER", "OWNER", "KEETA", "CROSS_PORT"))
            for selected in PORT_SUITES.values():
                suite_ids.update(selected)
            hard.append(f"SHARED_AUTHORITY_SURFACE_CHANGED:{path}")
        elif path.startswith("carrier/"):
            ports.update(("CARRIER", "SMT", "PRINT", "OTA")); suite_ids.update(PORT_SUITES["CARRIER"])
            warnings.append("CARRIER_REQUIRES_EXISTING_BUILDER_AND_PHYSICAL_EVIDENCE")
        elif path.startswith("requests/"):
            ports.add("OTA")
            warnings.append("OTA_REQUEST_REQUIRES_EXISTING_RELEASE_PROTOCOL")
        else:
            ports.add("UNMAPPED")
            hard.append(f"UNMAPPED_SCOPE:{path}")
    return sorted(ports), sorted(suite_ids), hard, sorted(set(warnings))


def compare_results(suite_ids: list[str], results: dict) -> tuple[list[str], list[str], list[str], list[str]]:
    hard: list[str] = []
    soft: list[str] = []
    warnings: list[str] = []
    known_reds: list[str] = []
    suite_results = results.get("suites", {}) if isinstance(results, dict) else {}
    for suite_id in suite_ids:
        row = suite_results.get(suite_id)
        if not row:
            warnings.append(f"TEST_EVIDENCE_MISSING:{suite_id}")
            continue
        base = row.get("base", {}).get("status")
        candidate = row.get("candidate", {}).get("status")
        if base == "FAIL" and candidate == "FAIL":
            known_reds.append(f"KNOWN_RED:{suite_id}")
        elif base == "FAIL" and candidate == "PASS":
            warnings.append(f"IMPROVEMENT:{suite_id}")
        elif base == "PASS" and candidate == "FAIL":
            risk = f"NEW_REGRESSION:{suite_id}"
            (hard if SUITES[suite_id]["severity"] == "HARD_BLOCK" else soft).append(risk)
        elif base != "PASS" or candidate != "PASS":
            warnings.append(f"TEST_EVIDENCE_INVALID:{suite_id}")
    return hard, soft, warnings, known_reds


def build_report(manifest: dict, manifest_errors: list[str], paths: list[str], results: dict | None) -> dict:
    ports, suite_ids, path_hard, path_warnings = classify_paths(paths)
    allowed = manifest.get("allowed_paths", [])
    undeclared = sorted(path for path in paths if not matches(path, allowed))
    hard = list(manifest_errors) + path_hard
    soft: list[str] = []
    warnings = path_warnings
    known_reds: list[str] = []
    improvements: list[str] = []
    if undeclared:
        hard.append("UNDECLARED_BLAST_RADIUS")
    if manifest.get("authority_impact") not in {"NONE", "GOVERNANCE_ONLY"}:
        hard.append(f"AUTHORITY_IMPACT_REVIEW:{manifest.get('authority_impact')}")
    if manifest.get("persistence_impact") not in {"NONE", "NON_DESTRUCTIVE"}:
        hard.append(f"PERSISTENCE_IMPACT_REVIEW:{manifest.get('persistence_impact')}")
    if manifest.get("transaction_impact") not in {"NONE", "READ_ONLY"}:
        hard.append(f"TRANSACTION_IMPACT_REVIEW:{manifest.get('transaction_impact')}")
    if manifest.get("provider_impact") not in {"NONE", "READ_ONLY"}:
        soft.append(f"PROVIDER_IMPACT_REVIEW:{manifest.get('provider_impact')}")
    if results is None and suite_ids:
        warnings.append("REGRESSION_EVIDENCE_PENDING")
    elif results is not None:
        test_hard, test_soft, test_warnings, known_reds = compare_results(suite_ids, results)
        hard.extend(test_hard); soft.extend(test_soft); warnings.extend(test_warnings)
        improvements = sorted(item for item in warnings if item.startswith("IMPROVEMENT:"))
    hard = sorted(set(hard)); soft = sorted(set(soft)); warnings = sorted(set(warnings)); known_reds = sorted(set(known_reds))
    decision = "HARD_BLOCK" if hard else "SOFT_REVIEW" if soft else "PASS_WITH_WARNINGS" if warnings or known_reds else "PASS"
    tests = [{"id": suite_id, **SUITES[suite_id]} for suite_id in suite_ids]
    return {
        "CAPABILITY": manifest.get("capability", "UNKNOWN"),
        "CHANGED_FILES": paths,
        "AFFECTED_PORTS": ports,
        "HARD_RISKS": hard,
        "SOFT_RISKS": soft,
        "WARNINGS": warnings,
        "KNOWN_REDS": known_reds,
        "IMPROVEMENTS": improvements,
        "RELEVANT_TESTS": tests,
        "UNDECLARED_PATHS": undeclared,
        "DECISION": decision,
        "GATE": {
            "SEVERITY": manifest.get("severity", "WARNING"),
            "SCOPE": ports,
            "KNOWN_RED_POLICY": "BASE_RED_CANDIDATE_RED_IS_WARNING",
            "BYPASS_POLICY": "OWNER_RECORDED_ONLY; NON_BYPASSABLE_CRITICALS_APPLY",
            "BLOCKING_BEHAVIOR": "SHADOW_REPORT_ONLY",
        },
    }


def markdown(report: dict) -> str:
    def section(name: str) -> str:
        value = report[name]
        if name == "RELEVANT_TESTS":
            value = [item["id"] for item in value]
        items = value if isinstance(value, list) else [value]
        return f"## {name}\n" + ("\n".join(f"- `{item}`" for item in items) if items else "- None")
    names = ("CAPABILITY", "CHANGED_FILES", "AFFECTED_PORTS", "HARD_RISKS", "SOFT_RISKS", "WARNINGS", "KNOWN_REDS", "RELEVANT_TESTS", "UNDECLARED_PATHS", "DECISION")
    return "# MFK Regression Decision (Shadow Mode)\n\n" + "\n\n".join(section(name) for name in names) + "\n"


def write_github_output(base_sha: str, has_tests: bool) -> None:
    target = os.environ.get("GITHUB_OUTPUT")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(f"base_sha={base_sha}\nhas_tests={'true' if has_tests else 'false'}\n")


def report_command(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    manifest, errors = load_manifest(Path(args.manifest), args.base_fallback)
    base_sha = manifest.get("base_sha") or args.base_fallback
    paths: list[str] = []
    if SHA40.fullmatch(str(base_sha)):
        try:
            if subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", str(base_sha), args.head], check=False).returncode:
                errors.append("BASE_SHA_NOT_ANCESTOR")
            paths = changed_files(repo, str(base_sha), args.head)
        except RuntimeError as exc:
            errors.append(f"DIFF_UNAVAILABLE:{exc}")
    else:
        errors.append("DIFF_UNAVAILABLE:BASE_SHA_INVALID")
    results = None
    if args.results and Path(args.results).exists():
        try:
            results = json.loads(Path(args.results).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"RESULTS_INVALID:{exc}")
    result = build_report(manifest, errors, paths, results)
    Path(args.json_out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    Path(args.markdown_out).write_text(markdown(result), encoding="utf-8")
    write_github_output(str(base_sha), bool(result["RELEVANT_TESTS"]))
    print(markdown(result))
    return 0


def run_process(command: list[str], cwd: Path) -> int:
    print(f"::group::{cwd.as_posix()} :: {' '.join(command)}", flush=True)
    try:
        return subprocess.run(command, cwd=cwd, check=False).returncode
    except OSError as exc:
        print(f"TOOLING_ERROR: {exc}", flush=True)
        return 127
    finally:
        print("::endgroup::", flush=True)


def run_tree(tree: Path, tests: list[dict]) -> dict[str, dict]:
    by_cwd: dict[str, list[dict]] = defaultdict(list)
    for test in tests:
        by_cwd[test["cwd"]].append(test)
    output: dict[str, dict] = {}
    npm = "npm.cmd" if os.name == "nt" else "npm"
    npx = "npx.cmd" if os.name == "nt" else "npx"
    for cwd_name, grouped in sorted(by_cwd.items()):
        cwd = tree / cwd_name
        install = [npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps", "--package-lock=false"]
        install_code = run_process(install, cwd) if (cwd / "package.json").exists() else 127
        for test in grouped:
            if install_code:
                output[test["id"]] = {"status": "TOOLING_ERROR", "exit_code": install_code, "phase": "install"}
                continue
            command = list(test["command"])
            command[0] = npm if command[0] == "npm" else npx if command[0] == "npx" else command[0]
            code = run_process(command, cwd)
            output[test["id"]] = {"status": "PASS" if code == 0 else "FAIL", "exit_code": code, "phase": "test"}
    return output


def run_tests_command(args: argparse.Namespace) -> int:
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    tests = plan.get("RELEVANT_TESTS", [])
    base_results = run_tree(Path(args.base_repo).resolve(), tests)
    candidate_results = run_tree(Path(args.candidate_repo).resolve(), tests)
    combined = {"schema_version": 1, "suites": {}}
    for test in tests:
        suite_id = test["id"]
        combined["suites"][suite_id] = {
            "base": base_results.get(suite_id, {"status": "UNKNOWN"}),
            "candidate": candidate_results.get(suite_id, {"status": "UNKNOWN"}),
        }
    Path(args.results_out).write_text(json.dumps(combined, indent=2) + "\n", encoding="utf-8")
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    commands = root.add_subparsers(dest="command", required=True)
    report = commands.add_parser("report")
    report.add_argument("--repo", required=True)
    report.add_argument("--manifest", required=True)
    report.add_argument("--head", default="HEAD")
    report.add_argument("--base-fallback", default="")
    report.add_argument("--results")
    report.add_argument("--json-out", required=True)
    report.add_argument("--markdown-out", required=True)
    run = commands.add_parser("run-tests")
    run.add_argument("--plan", required=True)
    run.add_argument("--base-repo", required=True)
    run.add_argument("--candidate-repo", required=True)
    run.add_argument("--results-out", required=True)
    return root


def main() -> int:
    args = parser().parse_args()
    return report_command(args) if args.command == "report" else run_tests_command(args)


if __name__ == "__main__":
    raise SystemExit(main())
