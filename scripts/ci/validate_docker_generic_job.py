"""Host-side validator for static Docker generic-job artifacts; no solver is called here."""
from __future__ import annotations
import copy
import hashlib
import json
import sys
from pathlib import Path

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def require(condition: bool, code: str) -> None:
    if not condition:
        raise RuntimeError(code)

def result_paths(root: Path) -> dict[str, Path]:
    return {
        "receipt": root / "execution-receipt.json",
        "binding": root / "result-binding.json",
        "mesh": root / "mesh-verification.json",
        "input": root / "solver-input.json",
        "numerical": root / "numerical-validation.json",
        "log": root / "execution.log",
        "frd": root / "calculix-results.frd",
    }

def verify_result(manifest: dict, root: Path) -> None:
    paths = result_paths(root)
    require(all(path.exists() for path in paths.values()), "GENERIC_ARTIFACT_MISSING")
    receipt = json.loads(paths["receipt"].read_text())
    binding = json.loads(paths["binding"].read_text())
    mesh = json.loads(paths["mesh"].read_text())
    solver_input = json.loads(paths["input"].read_text())
    numerical = json.loads(paths["numerical"].read_text())
    require(receipt["state"] == "INTERNAL_TEST_COMPLETED" and receipt["executionStarted"] is True and receipt["genericSolverExecutionStarted"] is True and receipt["exitCode"] == 0, "GENERIC_EXECUTION_RECEIPT_INVALID")
    require(binding.get("bindingStatus") == "PASS", "RESULT_BINDING_STATUS_INVALID")
    require(binding.get("jobId") == manifest["jobId"] and binding.get("manifestHash") == manifest["manifestHash"], "RESULT_JOB_BINDING_INVALID")
    require(binding.get("cadRevisionHash") == manifest["cadRevisionHash"] and binding.get("cadArtifactHash") == manifest["cadArtifactHash"], "RESULT_CAD_BINDING_INVALID")
    require(binding.get("caeConfigurationHash") == manifest["caePlanHash"], "RESULT_CAE_CONFIGURATION_BINDING_INVALID")
    require(binding.get("meshHash") == mesh["meshSha256"], "RESULT_MESH_BINDING_INVALID")
    require(binding.get("inputHash") == solver_input["calculixInputSha256"] and binding.get("solverInputHash") == sha(paths["input"]), "RESULT_INPUT_BINDING_INVALID")
    require(binding.get("outputHash") == sha(paths["frd"]), "RESULT_OUTPUT_BINDING_INVALID")
    require(binding.get("executionLogHash") == sha(paths["log"]), "RESULT_LOG_BINDING_INVALID")
    require(binding.get("meshVerificationHash") == sha(paths["mesh"]), "RESULT_MESH_VERIFICATION_HASH_INVALID")
    require(binding.get("numericalValidationHash") == sha(paths["numerical"]), "RESULT_NUMERICAL_VALIDATION_HASH_INVALID")
    require(binding.get("gmshHash") and len(binding["gmshHash"]) == 64 and binding.get("calculixHash") and len(binding["calculixHash"]) == 64, "RESULT_SOLVER_BINDING_INVALID")
    config_hash = hashlib.sha256(canonical({"mesh": manifest["meshConfiguration"], "solver": manifest["solverConfiguration"], "analysis": manifest["analysisPlan"]}).encode()).hexdigest()
    require(binding.get("configHash") == config_hash, "RESULT_CONFIGURATION_BINDING_INVALID")
    result_hash = hashlib.sha256(canonical({"jobId": binding["jobId"], "manifestHash": binding["manifestHash"], "outputHash": binding["outputHash"], "numericalValidationHash": binding["numericalValidationHash"], "meshHash": binding["meshHash"]}).encode()).hexdigest()
    require(binding.get("resultHash") == result_hash and receipt.get("resultHash") == result_hash, "RESULT_HASH_INVALID")

def assert_rejected(manifest: dict, root: Path, mutation: str, expected_code: str) -> None:
    paths = result_paths(root)
    sandbox = root.parent / f"validation-{mutation}"
    if sandbox.exists():
        for child in sandbox.iterdir():
            child.unlink()
    else:
        sandbox.mkdir(parents=True)
    for name, path in paths.items():
        target = sandbox / path.name
        target.write_bytes(path.read_bytes())
    if mutation == "stale-job":
        target = sandbox / "result-binding.json"; value = json.loads(target.read_text()); value["jobId"] = "STALE-JOB"; target.write_text(json.dumps(value))
    elif mutation == "stale-cad":
        target = sandbox / "result-binding.json"; value = json.loads(target.read_text()); value["cadRevisionHash"] = "0" * 64; target.write_text(json.dumps(value))
    elif mutation == "mesh-mismatch":
        target = sandbox / "mesh-verification.json"; value = json.loads(target.read_text()); value["meshSha256"] = "0" * 64; target.write_text(json.dumps(value))
    elif mutation == "solver-mismatch":
        target = sandbox / "result-binding.json"; value = json.loads(target.read_text()); value["calculixHash"] = "0" * 63; target.write_text(json.dumps(value))
    elif mutation == "configuration-mismatch":
        target = sandbox / "result-binding.json"; value = json.loads(target.read_text()); value["configHash"] = "0" * 64; target.write_text(json.dumps(value))
    elif mutation == "input-tamper":
        target = sandbox / "solver-input.json"; target.write_text(target.read_text() + "\n")
    elif mutation == "output-tamper":
        target = sandbox / "calculix-results.frd"; target.write_bytes(target.read_bytes() + b"\nTAMPER\n")
    else:
        raise RuntimeError("UNSUPPORTED_REJECTION_TEST")
    try:
        verify_result(manifest, sandbox)
    except RuntimeError as error:
        require(expected_code in str(error), f"UNEXPECTED_REJECTION_CODE:{error}")
        return
    raise RuntimeError(f"REJECTION_NOT_ENFORCED:{mutation}")

def main() -> None:
    mode = sys.argv[1]
    if mode == "preflight":
        report = json.loads(Path(sys.argv[2]).read_text())
        failed = [probe["testId"] for probe in report["probes"] if probe["status"] != "PASS"]
        if failed: raise RuntimeError(f"SANDBOX_PREFLIGHT_FAILED:{','.join(failed)}")
        return
    if mode == "result":
        manifest = json.loads(Path(sys.argv[2]).read_text())
        root = Path(sys.argv[3])
        verify_result(manifest, root)
        return
    if mode in {"stale-job", "stale-cad", "mesh-mismatch", "solver-mismatch", "configuration-mismatch", "input-tamper", "output-tamper"}:
        manifest = json.loads(Path(sys.argv[2]).read_text())
        root = Path(sys.argv[3])
        codes = {
            "stale-job": "RESULT_JOB_BINDING_INVALID",
            "stale-cad": "RESULT_CAD_BINDING_INVALID",
            "mesh-mismatch": "RESULT_MESH_BINDING_INVALID",
            "solver-mismatch": "RESULT_SOLVER_BINDING_INVALID",
            "configuration-mismatch": "RESULT_CONFIGURATION_BINDING_INVALID",
            "input-tamper": "RESULT_INPUT_BINDING_INVALID",
            "output-tamper": "RESULT_OUTPUT_BINDING_INVALID",
        }
        assert_rejected(manifest, root, mode, codes[mode])
        return
    if mode == "controlled-failure":
        root = Path(sys.argv[2])
        expected = sys.argv[3]
        state = json.loads((root / "docker-inspect-after.json").read_text())
        require(state[0]["State"]["ExitCode"] != 0, "CONTROLLED_FAILURE_EXIT_NOT_ENFORCED")
        failure_path = root / "runtime-output" / "execution-failure.json"
        if expected == "MEMORY_LIMIT_OOM":
            require(state[0]["State"].get("OOMKilled") is True, "MEMORY_LIMIT_OOM_NOT_OBSERVED")
            return
        if expected == "CPU_LIMIT_SIGNAL":
            require(not failure_path.exists(), "RESOURCE_LIMIT_FAILURE_ARTIFACT_UNEXPECTED")
            return
        if expected == "STORAGE_LIMIT_SIGNAL":
            require(failure_path.exists(), "STORAGE_LIMIT_FAILURE_RECEIPT_MISSING")
            failure = json.loads(failure_path.read_text())
            require(failure.get("state") == "FAILED" and failure.get("error") == "STORAGE_LIMIT_ENFORCED", "STORAGE_LIMIT_FAILURE_REASON_INVALID")
            return
        require(failure_path.exists(), "CONTROLLED_FAILURE_RECEIPT_MISSING")
        failure = json.loads(failure_path.read_text())
        require(failure.get("state") == "FAILED" and expected in failure.get("error", ""), "CONTROLLED_FAILURE_REASON_INVALID")
        return
    raise RuntimeError("UNSUPPORTED_VALIDATION_MODE")

if __name__ == "__main__":
    main()
