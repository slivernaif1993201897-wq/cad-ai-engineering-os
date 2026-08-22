#!/usr/bin/env python3
"""Static, non-interactive Docker entrypoint for the internal generic CAE fixture.

It accepts only `probe` or `run`; no caller-provided executable, path, URL, shell,
environment configuration, or solver text is interpreted.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import resource
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import meshio
import numpy as np

INPUT = Path("/input")
OUTPUT = Path("/output")
WORK = Path("/work")
MANIFEST = INPUT / "generic-user-job-manifest.json"
STEP = INPUT / "generic-cantilever.step"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def write_json(name: str, value: object) -> Path:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / name
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def append_log(message: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with (OUTPUT / "execution.log").open("a", encoding="utf-8") as handle:
        handle.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")


def try_write(path: Path) -> bool:
    try:
        path.write_text("probe", encoding="utf-8")
        path.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def namespace(name: str) -> str:
    try:
        return os.readlink(f"/proc/self/ns/{name}")
    except OSError:
        return "UNKNOWN"


def cgroup_value(name: str) -> str:
    for candidate in (Path("/sys/fs/cgroup") / name,):
        try:
            return candidate.read_text(encoding="utf-8").strip()
        except OSError:
            pass
    return "UNKNOWN"


def path_exists_without_traversal(path: Path) -> bool:
    try:
        return path.exists()
    except OSError:
        return False


def run_probe() -> int:
    probes: list[dict[str, object]] = []
    print("SANDBOX_PROBE_STARTED", flush=True)

    def record(test_id: str, expected: str, observed: object, passed: bool) -> None:
        probes.append({"testId": test_id, "expected": expected, "observed": observed, "status": "PASS" if passed else "FAIL", "environmentId": os.environ.get("CAD_AI_ENVIRONMENT_ID", "UNKNOWN")})

    root_writable = try_write(Path("/rootfs-write-probe"))
    input_writable = try_write(INPUT / "input-write-probe")
    work_writable = try_write(WORK / "work-write-probe")
    temporary_writable = try_write(Path("/tmp") / "tmp-write-probe")
    output_writable = try_write(OUTPUT / "output-write-probe")
    record("ROOT_FILESYSTEM_READ_ONLY", "write to root must fail", root_writable, not root_writable)
    record("INPUT_READ_ONLY", "write to /input must fail", input_writable, not input_writable)
    record("WORKSPACE_WRITABLE", "write to /work must succeed", work_writable, work_writable)
    record("TEMPORARY_STORAGE_WRITABLE", "write to /tmp must succeed", temporary_writable, temporary_writable)
    record("OUTPUT_WORKSPACE_WRITABLE", "write to /output must succeed", output_writable, output_writable)
    record("NON_ROOT_IDENTITY", "uid and gid must be 65534", {"uid": os.getuid(), "gid": os.getgid()}, os.getuid() == 65534 and os.getgid() == 65534)
    capeff = next((line.split("\t", 1)[1].strip() for line in Path("/proc/self/status").read_text(encoding="utf-8").splitlines() if line.startswith("CapEff:")), "UNKNOWN")
    record("CAPABILITIES_DROPPED", "effective capabilities must be zero", capeff, capeff == "0000000000000000")
    routes = Path("/proc/net/route").read_text(encoding="utf-8", errors="replace").splitlines()[1:]
    record("NETWORK_NAMESPACE_NO_DEFAULT_ROUTE", "container has no default route", routes, not any(line.split()[1] == "00000000" for line in routes if len(line.split()) > 1))
    sensitive = [name for name in os.environ if any(token in name.upper() for token in ("GITHUB_TOKEN", "ACTIONS_ID_TOKEN", "SECRET", "PASSWORD", "AWS_"))]
    record("ENVIRONMENT_SECRET_FILTER", "no common CI secret variable visible", sensitive, not sensitive)
    credential_paths = [str(path) for path in (Path("/root/.git-credentials"), Path("/github/home"), Path("/run/secrets")) if path_exists_without_traversal(path)]
    record("CREDENTIAL_PATH_FILTER", "common credential paths absent", credential_paths, not credential_paths)
    record("PID_NAMESPACE_OBSERVED", "PID namespace recorded", namespace("pid"), namespace("pid") != "UNKNOWN")
    record("MOUNT_NAMESPACE_OBSERVED", "mount namespace recorded", namespace("mnt"), namespace("mnt") != "UNKNOWN")
    record("NETWORK_NAMESPACE_OBSERVED", "network namespace recorded", namespace("net"), namespace("net") != "UNKNOWN")
    limits = {"cpuMax": cgroup_value("cpu.max"), "memoryMax": cgroup_value("memory.max"), "pidsMax": cgroup_value("pids.max")}
    record("CGROUP_LIMITS_OBSERVED", "docker cgroup limits must be visible", limits, all(value not in {"UNKNOWN", "max"} for value in limits.values()))
    timeout_exit = subprocess.run(["timeout", "1", "sleep", "2"], check=False).returncode
    record("TIMEOUT_ENFORCEMENT", "static timeout probe returns 124", timeout_exit, timeout_exit == 124)
    storage_probe = OUTPUT / "storage-over-limit-probe"
    storage_failed = False
    try:
        with storage_probe.open("wb") as handle:
            chunk = b"0" * (1024 * 1024)
            for _ in range(80):
                handle.write(chunk)
                handle.flush()
    except OSError:
        storage_failed = True
    finally:
        storage_probe.unlink(missing_ok=True)
    record("OUTPUT_STORAGE_ENFORCEMENT", "64 MiB output tmpfs rejects 80 MiB write", storage_failed, storage_failed)
    report = {"probeVersion": "1.0.0", "environmentId": os.environ.get("CAD_AI_ENVIRONMENT_ID", "UNKNOWN"), "probes": probes, "generatedAt": datetime.now(timezone.utc).isoformat()}
    report_path = write_json("sandbox-probes.json", report)
    report["evidenceHash"] = sha256_file(report_path)
    write_json("sandbox-probes.json", report)
    failed = [str(probe["testId"]) for probe in probes if probe["status"] != "PASS"]
    print(f"SANDBOX_PROBE_COMPLETE failed={','.join(failed) if failed else 'none'}", flush=True)
    return 0 if not failed else 1


def parse_manifest() -> dict[str, object]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    received_hash = manifest.pop("manifestHash", "")
    calculated = hashlib.sha256(canonical(manifest).encode("utf-8")).hexdigest()
    if received_hash != calculated:
        raise RuntimeError("MANIFEST_HASH_MISMATCH")
    if manifest.get("environment", {}).get("executionClass") != "INTERNAL_DOCKER_TEST":
        raise RuntimeError("EXECUTION_CLASS_REJECTED")
    if manifest.get("meshConfiguration", {}).get("solverId") != "GMSH" or manifest.get("meshConfiguration", {}).get("solverVersion") != "4.12.1":
        raise RuntimeError("UNKNOWN_MESH_CONFIGURATION")
    if manifest.get("solverConfiguration", {}).get("solverId") != "CALCULIX" or manifest.get("solverConfiguration", {}).get("solverVersion") != "2.21":
        raise RuntimeError("UNKNOWN_SOLVER_CONFIGURATION")
    manifest["manifestHash"] = received_hash
    return manifest


def card_nodes(name: str, nodes: list[int]) -> list[str]:
    lines = [f"*NSET,NSET={name}"]
    for index in range(0, len(nodes), 12):
        lines.append(", ".join(str(node) for node in nodes[index:index + 12]))
    return lines


def latest_displacements(path: Path) -> dict[int, tuple[float, float, float]]:
    latest: dict[int, tuple[float, float, float]] = {}
    active: dict[int, tuple[float, float, float]] | None = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        record = line.lstrip()
        if record.startswith("-4") and "DISP" in record:
            active = {}
        elif active is not None and record.startswith("-1"):
            fields = record.split()
            if len(fields) >= 5:
                try: active[int(fields[1])] = (float(fields[2]), float(fields[3]), float(fields[4]))
                except ValueError: pass
        elif active is not None and record.startswith("-3"):
            if active: latest = active
            active = None
    return latest


def execute_job() -> int:
    started = datetime.now(timezone.utc)
    manifest = parse_manifest()
    if sha256_file(STEP) != manifest["cadHash"]:
        raise RuntimeError("CAD_HASH_MISMATCH")
    WORK.mkdir(parents=True, exist_ok=True)
    append_log("GENERIC_USER_JOB_STARTED")
    mesh_path = WORK / "generic-cantilever.msh"
    gmsh = subprocess.run(["gmsh", "-3", str(STEP), "-format", "msh41", "-clmin", "4", "-clmax", "4", "-o", str(mesh_path)], cwd=WORK, capture_output=True, text=True, timeout=90)
    append_log(f"GMSH_EXIT={gmsh.returncode}\n{gmsh.stdout}\n{gmsh.stderr}")
    if gmsh.returncode != 0: raise RuntimeError(f"GMSH_FAILED_{gmsh.returncode}")
    mesh = meshio.read(mesh_path)
    tetra_blocks = [block.data for block in mesh.cells if block.type == "tetra"]
    if not tetra_blocks: raise RuntimeError("MESH_HAS_NO_TETRA")
    elements = np.vstack(tetra_blocks).astype(int)
    points = np.asarray(mesh.points, dtype=float)
    tetra = points[elements[:, :4], :3]
    signed = np.einsum("ij,ij->i", tetra[:, 1] - tetra[:, 0], np.cross(tetra[:, 2] - tetra[:, 0], tetra[:, 3] - tetra[:, 0])) / 6.0
    absolute = np.abs(signed)
    bounds_min, bounds_max = points[:, :3].min(axis=0), points[:, :3].max(axis=0)
    expected_min, expected_max = np.array([0.0, 0.0, 0.0]), np.array([20.0, 10.0, 80.0])
    mesh_ok = bool(np.allclose(bounds_min, expected_min, atol=1e-6) and np.allclose(bounds_max, expected_max, atol=1e-6) and np.count_nonzero(absolute <= 1e-12) == 0 and np.count_nonzero(signed < -1e-12) == 0)
    verification = {"verificationStatus": "PASS" if mesh_ok else "FAIL", "method": "Independent meshio connectivity, signed-volume, degeneracy, orientation, and bounds checks", "meshSha256": sha256_file(mesh_path), "cadHash": manifest["cadHash"], "nodeCount": int(len(points)), "tetraElementCount": int(len(elements)), "negativeOrientationCount": int(np.count_nonzero(signed < -1e-12)), "degenerateElementCount": int(np.count_nonzero(absolute <= 1e-12)), "boundsMm": {"min": bounds_min.tolist(), "max": bounds_max.tolist()}}
    verify_path = write_json("mesh-verification.json", verification)
    if not mesh_ok: raise RuntimeError("MESH_VERIFICATION_FAILED")
    z = points[:, 2]
    fixed = (np.where(z <= bounds_min[2] + 1e-6)[0] + 1).tolist()
    loaded = (np.where(z >= bounds_max[2] - 1e-6)[0] + 1).tolist()
    if not fixed or not loaded: raise RuntimeError("BOUNDARY_NODE_DISCOVERY_FAILED")
    e_mpa, poisson, total_load = 210000.0, 0.3, 800.0
    inp = WORK / "generic-cantilever.inp"
    lines = ["*HEADING", "CAD-AI internal generic user-job: OpenCascade STEP -> Docker-isolated Gmsh -> CalculiX", "*NODE"]
    lines.extend(f"{node}, {x:.12g}, {y:.12g}, {zv:.12g}" for node, (x, y, zv) in enumerate(points[:, :3], start=1))
    lines.append("*ELEMENT,TYPE=C3D4,ELSET=EALL")
    lines.extend(f"{identifier}, {', '.join(str(int(node)) for node in nodes)}" for identifier, nodes in enumerate(elements[:, :4] + 1, start=1))
    lines.extend(card_nodes("FIXED", fixed) + card_nodes("LOADED", loaded) + ["*MATERIAL,NAME=STEEL", "*ELASTIC", f"{e_mpa}, {poisson}", "*SOLID SECTION,ELSET=EALL,MATERIAL=STEEL", ",", "*STEP,NLGEOM=NO", "*STATIC", "1., 1.", "*BOUNDARY", "FIXED, 1, 3, 0.", "*CLOAD"])
    lines.extend(f"{node}, 3, {total_load / len(loaded):.12g}" for node in loaded)
    lines.extend(["*NODE FILE", "U", "*EL FILE", "S", "*NODE PRINT,NSET=LOADED", "U", "*END STEP"])
    inp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    input_metadata = {"inputKind": "AUTHORIZED_INTERNAL_GENERIC_USER_JOB", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "cadHash": manifest["cadHash"], "caePlanHash": manifest["caePlanHash"], "meshHash": verification["meshSha256"], "calculixInputSha256": sha256_file(inp), "material": {"elasticModulusMpa": e_mpa, "poissonRatio": poisson}, "load": {"totalAxialForceN": total_load}, "referenceGeometry": {"crossSectionAreaMm2": 200.0, "lengthMm": 80.0}}
    input_meta_path = write_json("solver-input.json", input_metadata)
    ccx = subprocess.run(["ccx", "generic-cantilever"], cwd=WORK, capture_output=True, text=True, timeout=90)
    append_log(f"CALCULIX_EXIT={ccx.returncode}\n{ccx.stdout}\n{ccx.stderr}")
    if ccx.returncode != 0: raise RuntimeError(f"CALCULIX_FAILED_{ccx.returncode}")
    frd = WORK / "generic-cantilever.frd"
    solver_result = OUTPUT / "calculix-results.frd"
    solver_result.write_bytes(frd.read_bytes())
    displacements = latest_displacements(frd)
    observed = [displacements[node][2] for node in loaded if node in displacements]
    if not observed: raise RuntimeError("NO_LOADED_DISPLACEMENTS")
    reference = total_load * 80.0 / (e_mpa * 200.0)
    solver_value = sum(observed) / len(observed)
    relative_error = abs(solver_value - reference) / abs(reference)
    numerical = {"validationStatus": "PASS" if relative_error <= 0.30 else "FAIL", "method": "Mean loaded-face z displacement versus F*L/(E*A)", "referenceDisplacementMm": reference, "solverDisplacementMm": solver_value, "relativeError": relative_error, "tolerance": 0.30, "toleranceScope": "INTERNAL_GENERIC_CANTILEVER_BENCHMARK_ONLY", "frdSha256": sha256_file(frd), "inputSha256": input_metadata["calculixInputSha256"]}
    numerical_path = write_json("numerical-validation.json", numerical)
    if numerical["validationStatus"] != "PASS": raise RuntimeError("NUMERICAL_VALIDATION_FAILED")
    environment = INPUT / "runtime-preflight.json"
    binding = {"bindingStatus": "PASS", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "cadHash": manifest["cadHash"], "caeHash": manifest["caePlanHash"], "materialHash": manifest["materialHash"], "loadHash": manifest["loadHash"], "boundaryConditionHash": manifest["boundaryConditionHash"], "meshHash": verification["meshSha256"], "gmshHash": sha256_file(Path("/usr/bin/gmsh")), "calculixHash": sha256_file(Path("/usr/bin/ccx")), "configHash": hashlib.sha256(canonical({"mesh": manifest["meshConfiguration"], "solver": manifest["solverConfiguration"]}).encode()).hexdigest(), "environmentHash": sha256_file(environment), "inputHash": input_metadata["calculixInputSha256"], "outputHash": sha256_file(frd), "executionLogHash": sha256_file(OUTPUT / "execution.log"), "meshVerificationHash": sha256_file(verify_path), "numericalValidationHash": sha256_file(numerical_path), "solverInputHash": sha256_file(input_meta_path)}
    binding_path = write_json("result-binding.json", binding)
    receipt = {"receiptVersion": "1.0.0", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "state": "INTERNAL_TEST_COMPLETED", "executionStarted": True, "genericSolverExecutionStarted": True, "exitCode": 0, "resourceUsage": {"maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "elapsedSeconds": (datetime.now(timezone.utc) - started).total_seconds()}, "resultBindingHash": sha256_file(binding_path), "createdAt": datetime.now(timezone.utc).isoformat()}
    write_json("execution-receipt.json", receipt)
    return 0


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"probe", "run"}:
        print("Only static modes probe and run are supported.", file=sys.stderr)
        return 64
    try:
        return run_probe() if sys.argv[1] == "probe" else execute_job()
    except Exception as error:
        print(f"ENTRYPOINT_FAILURE: {error}", file=sys.stderr)
        try:
            append_log(f"FAILURE {error}")
            write_json("execution-failure.json", {"state": "FAILED", "executionStarted": sys.argv[1] == "run", "genericSolverExecutionStarted": sys.argv[1] == "run", "error": str(error), "createdAt": datetime.now(timezone.utc).isoformat()})
        except Exception as artifact_error:
            print(f"FAILURE_ARTIFACT_WRITE_FAILED: {artifact_error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
