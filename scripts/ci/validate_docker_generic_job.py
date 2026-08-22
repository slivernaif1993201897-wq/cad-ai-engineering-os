"""Host-side validator for static Docker generic-job artifacts; no solver is called here."""
from __future__ import annotations
import copy
import hashlib
import json
import sys
from pathlib import Path

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

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
        receipt = json.loads((root / "execution-receipt.json").read_text())
        binding = json.loads((root / "result-binding.json").read_text())
        if receipt["state"] != "INTERNAL_TEST_COMPLETED" or not receipt["executionStarted"] or not receipt["genericSolverExecutionStarted"]:
            raise RuntimeError("GENERIC_EXECUTION_RECEIPT_INVALID")
        if binding["bindingStatus"] != "PASS" or binding["manifestHash"] != manifest["manifestHash"] or binding["jobId"] != manifest["jobId"]:
            raise RuntimeError("RESULT_JOB_BINDING_INVALID")
        required = ["mesh-verification.json", "solver-input.json", "numerical-validation.json", "execution.log"]
        if any(not (root / item).exists() for item in required): raise RuntimeError("GENERIC_ARTIFACT_MISSING")
        return
    if mode == "tamper":
        binding = json.loads(Path(sys.argv[2]).read_text())
        tampered = copy.deepcopy(binding)
        tampered["meshHash"] = "0" * 64
        if tampered == binding: raise RuntimeError("TAMPER_TEST_DID_NOT_MUTATE")
        if tampered["meshHash"] == binding["meshHash"]: raise RuntimeError("TAMPER_TEST_FAILED")
        return
    raise RuntimeError("UNSUPPORTED_VALIDATION_MODE")

if __name__ == "__main__":
    main()
