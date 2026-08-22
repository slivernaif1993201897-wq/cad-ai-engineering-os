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
STEP = INPUT / "cad-artifact.step"
FAILURE_EXERCISE = os.environ.get("CAD_AI_FAILURE_EXERCISE", "").strip()
ALLOWED_FAILURE_EXERCISES = {"", "GMSH_FAILURE", "CALCULIX_FAILURE", "TIMEOUT", "CPU_LIMIT", "MEMORY_LIMIT", "STORAGE_LIMIT", "INVALID_MESH", "PARTIAL_OUTPUT"}


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
    record("OUTPUT_STORAGE_ENFORCEMENT", "64 MiB configured output file-size policy rejects 80 MiB write", storage_failed, storage_failed)
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
    if manifest.get("cadHash") != manifest.get("cadArtifactHash"):
        raise RuntimeError("CAD_ARTIFACT_HASH_MISMATCH")
    analysis = manifest.get("analysisPlan", {})
    if analysis.get("profileId") not in {"GENERIC_CANTILEVER_AXIAL_Z_V1", "CAD_AGENT_MOUNTING_BLOCK_AXIAL_X_V1"}:
        raise RuntimeError("UNKNOWN_ANALYSIS_PROFILE")
    expected_axis = "Z" if analysis.get("profileId") == "GENERIC_CANTILEVER_AXIAL_Z_V1" else "X"
    if analysis.get("axis") != expected_axis:
        raise RuntimeError("ANALYSIS_AXIS_MISMATCH")
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
            try:
                # CalculiX FRD node records are fixed-width. A negative x or y
                # displacement may be immediately adjacent to the prior field,
                # so whitespace tokenization is not evidence-preserving.
                active[int(line[3:13])] = (
                    float(line[13:25]),
                    float(line[25:37]),
                    float(line[37:49]),
                )
            except ValueError:
                pass
        elif active is not None and record.startswith("-3"):
            if active: latest = active
            active = None
    return latest


def execute_job() -> int:
    started = datetime.now(timezone.utc)
    if FAILURE_EXERCISE not in ALLOWED_FAILURE_EXERCISES:
        raise RuntimeError("UNAUTHORIZED_FAILURE_EXERCISE")
    if FAILURE_EXERCISE == "CPU_LIMIT":
        resource.setrlimit(resource.RLIMIT_CPU, (1, 1))
        while True:
            pass
    if FAILURE_EXERCISE == "MEMORY_LIMIT":
        # The configured Docker cgroup, not a simulated result, must reject this allocation.
        _ = bytearray(1024 * 1024 * 1024)
        raise RuntimeError("MEMORY_LIMIT_NOT_ENFORCED")
    manifest = parse_manifest()
    if sha256_file(STEP) != manifest["cadHash"]:
        raise RuntimeError("CAD_HASH_MISMATCH")
    WORK.mkdir(parents=True, exist_ok=True)
    append_log("GENERIC_USER_JOB_STARTED")
    if FAILURE_EXERCISE == "TIMEOUT":
        if subprocess.run(["timeout", "1", "sleep", "2"], check=False).returncode != 124:
            raise RuntimeError("TIMEOUT_LIMIT_NOT_ENFORCED")
        raise RuntimeError("TIMEOUT_ENFORCED")
    if FAILURE_EXERCISE == "STORAGE_LIMIT":
        try:
            with (OUTPUT / "storage-limit-exercise").open("wb") as handle:
                chunk = b"0" * (1024 * 1024)
                for _ in range(80):
                    handle.write(chunk)
                    handle.flush()
        except OSError:
            raise RuntimeError("STORAGE_LIMIT_ENFORCED")
        raise RuntimeError("STORAGE_LIMIT_NOT_ENFORCED")
    mesh_path = WORK / "generic-cantilever.msh"
    analysis = manifest["analysisPlan"]
    mesh_size = str(analysis["meshSizeMm"])
    gmsh_step = STEP
    if FAILURE_EXERCISE == "GMSH_FAILURE":
        gmsh_step = WORK / "invalid-gmsh-input.step"
        gmsh_step.write_text("NOT_A_STEP_FILE\n", encoding="utf-8")
    gmsh = subprocess.run(["gmsh", "-3", str(gmsh_step), "-format", "msh41", "-clmin", mesh_size, "-clmax", mesh_size, "-o", str(mesh_path)], cwd=WORK, capture_output=True, text=True, timeout=90)
    append_log(f"GMSH_EXIT={gmsh.returncode}\n{gmsh.stdout}\n{gmsh.stderr}")
    if gmsh.returncode != 0: raise RuntimeError(f"GMSH_FAILED_{gmsh.returncode}")
    if FAILURE_EXERCISE == "INVALID_MESH": mesh_path.write_text("INVALID_MESH\n", encoding="utf-8")
    try:
        mesh = meshio.read(mesh_path)
    except Exception as error:
        raise RuntimeError("INVALID_MESH_REJECTED") from error
    tetra_blocks = [block.data for block in mesh.cells if block.type == "tetra"]
    if not tetra_blocks: raise RuntimeError("MESH_HAS_NO_TETRA")
    elements = np.vstack(tetra_blocks).astype(int)
    points = np.asarray(mesh.points, dtype=float)
    tetra = points[elements[:, :4], :3]
    signed = np.einsum("ij,ij->i", tetra[:, 1] - tetra[:, 0], np.cross(tetra[:, 2] - tetra[:, 0], tetra[:, 3] - tetra[:, 0])) / 6.0
    absolute = np.abs(signed)
    bounds_min, bounds_max = points[:, :3].min(axis=0), points[:, :3].max(axis=0)
    expected_min, expected_max = np.array(analysis["expectedBoundsMm"]["min"], dtype=float), np.array(analysis["expectedBoundsMm"]["max"], dtype=float)
    mesh_ok = bool(np.allclose(bounds_min, expected_min, atol=1e-6) and np.allclose(bounds_max, expected_max, atol=1e-6) and np.count_nonzero(absolute <= 1e-12) == 0 and np.count_nonzero(signed < -1e-12) == 0)
    verification = {"verificationStatus": "PASS" if mesh_ok else "FAIL", "method": "Independent meshio connectivity, signed-volume, degeneracy, orientation, and bounds checks", "meshSha256": sha256_file(mesh_path), "cadHash": manifest["cadHash"], "nodeCount": int(len(points)), "tetraElementCount": int(len(elements)), "negativeOrientationCount": int(np.count_nonzero(signed < -1e-12)), "degenerateElementCount": int(np.count_nonzero(absolute <= 1e-12)), "boundsMm": {"min": bounds_min.tolist(), "max": bounds_max.tolist()}}
    verify_path = write_json("mesh-verification.json", verification)
    if not mesh_ok: raise RuntimeError("MESH_VERIFICATION_FAILED")
    if FAILURE_EXERCISE == "PARTIAL_OUTPUT": raise RuntimeError("PARTIAL_OUTPUT_REJECTED")
    axis_index = {"X": 0, "Y": 1, "Z": 2}[analysis["axis"]]
    axial = points[:, axis_index]
    fixed = (np.where(axial <= bounds_min[axis_index] + 1e-6)[0] + 1).tolist()
    loaded = (np.where(axial >= bounds_max[axis_index] - 1e-6)[0] + 1).tolist()
    if not fixed or not loaded: raise RuntimeError("BOUNDARY_NODE_DISCOVERY_FAILED")
    e_mpa, poisson, total_load = float(analysis["elasticModulusMpa"]), float(analysis["poissonRatio"]), float(analysis["totalAxialForceN"])
    inp = WORK / "generic-cantilever.inp"
    lines = ["*HEADING", "CAD-AI internal generic user-job: OpenCascade STEP -> Docker-isolated Gmsh -> CalculiX", "*NODE"]
    lines.extend(f"{node}, {x:.12g}, {y:.12g}, {zv:.12g}" for node, (x, y, zv) in enumerate(points[:, :3], start=1))
    lines.append("*ELEMENT,TYPE=C3D4,ELSET=EALL")
    lines.extend(f"{identifier}, {', '.join(str(int(node)) for node in nodes)}" for identifier, nodes in enumerate(elements[:, :4] + 1, start=1))
    dof = axis_index + 1
    lines.extend(card_nodes("FIXED", fixed) + card_nodes("LOADED", loaded) + ["*MATERIAL,NAME=STEEL", "*ELASTIC", f"{e_mpa}, {poisson}", "*SOLID SECTION,ELSET=EALL,MATERIAL=STEEL", ",", "*STEP,NLGEOM=NO", "*STATIC", "1., 1.", "*BOUNDARY", "FIXED, 1, 3, 0.", "*CLOAD"])
    lines.extend(f"{node}, {dof}, {total_load / len(loaded):.12g}" for node in loaded)
    lines.extend(["*NODE FILE", "U", "*EL FILE", "S", "*NODE PRINT,NSET=LOADED", "U", "*END STEP"])
    inp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    if FAILURE_EXERCISE == "CALCULIX_FAILURE":
        with inp.open("a", encoding="utf-8") as handle:
            handle.write("*UNSUPPORTED_CALCULIX_KEYWORD\n")
    input_metadata = {"inputKind": "AUTHORIZED_INTERNAL_GENERIC_USER_JOB", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "cadRevisionHash": manifest["cadRevisionHash"], "cadArtifactHash": manifest["cadArtifactHash"], "caePlanHash": manifest["caePlanHash"], "meshHash": verification["meshSha256"], "calculixInputSha256": sha256_file(inp), "material": {"elasticModulusMpa": e_mpa, "poissonRatio": poisson}, "load": {"totalAxialForceN": total_load, "axis": analysis["axis"]}, "referenceGeometry": {"crossSectionAreaMm2": analysis["referenceCrossSectionAreaMm2"], "lengthMm": float(bounds_max[axis_index] - bounds_min[axis_index])}}
    input_meta_path = write_json("solver-input.json", input_metadata)
    ccx = subprocess.run(["ccx", "generic-cantilever"], cwd=WORK, capture_output=True, text=True, timeout=90)
    append_log(f"CALCULIX_EXIT={ccx.returncode}\n{ccx.stdout}\n{ccx.stderr}")
    if ccx.returncode != 0: raise RuntimeError(f"CALCULIX_FAILED_{ccx.returncode}")
    frd = WORK / "generic-cantilever.frd"
    solver_result = OUTPUT / "calculix-results.frd"
    solver_result.write_bytes(frd.read_bytes())
    displacements = latest_displacements(frd)
    observed = [displacements[node][axis_index] for node in loaded if node in displacements]
    if not observed: raise RuntimeError("NO_LOADED_DISPLACEMENTS")
    reference = total_load * input_metadata["referenceGeometry"]["lengthMm"] / (e_mpa * float(analysis["referenceCrossSectionAreaMm2"]))
    solver_value = sum(observed) / len(observed)
    relative_error = abs(solver_value - reference) / abs(reference)
    numerical = {"validationStatus": "PASS" if relative_error <= float(analysis["numericalTolerance"]) else "FAIL", "method": f"Mean loaded-face {analysis['axis']} displacement versus F*L/(E*A)", "referenceDisplacementMm": reference, "solverDisplacementMm": solver_value, "relativeError": relative_error, "tolerance": analysis["numericalTolerance"], "toleranceScope": "INTERNAL_AUTHORIZED_JOB_NUMERICAL_CHECK_ONLY", "frdSha256": sha256_file(frd), "inputSha256": input_metadata["calculixInputSha256"]}
    numerical_path = write_json("numerical-validation.json", numerical)
    if numerical["validationStatus"] != "PASS": raise RuntimeError("NUMERICAL_VALIDATION_FAILED")
    environment = INPUT / "runtime-preflight.json"
    binding = {"bindingStatus": "PASS", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "cadRevisionHash": manifest["cadRevisionHash"], "cadArtifactHash": manifest["cadArtifactHash"], "cadHash": manifest["cadHash"], "caeConfigurationHash": manifest["caePlanHash"], "caeHash": manifest["caePlanHash"], "materialHash": manifest["materialHash"], "loadHash": manifest["loadHash"], "boundaryConditionHash": manifest["boundaryConditionHash"], "meshHash": verification["meshSha256"], "gmshHash": sha256_file(Path("/usr/bin/gmsh")), "calculixHash": sha256_file(Path("/usr/bin/ccx")), "configHash": hashlib.sha256(canonical({"mesh": manifest["meshConfiguration"], "solver": manifest["solverConfiguration"], "analysis": manifest["analysisPlan"]}).encode()).hexdigest(), "environmentHash": sha256_file(environment), "inputHash": input_metadata["calculixInputSha256"], "outputHash": sha256_file(frd), "executionLogHash": sha256_file(OUTPUT / "execution.log"), "meshVerificationHash": sha256_file(verify_path), "numericalValidationHash": sha256_file(numerical_path), "solverInputHash": sha256_file(input_meta_path)}
    binding["resultHash"] = hashlib.sha256(canonical({"jobId": binding["jobId"], "manifestHash": binding["manifestHash"], "outputHash": binding["outputHash"], "numericalValidationHash": binding["numericalValidationHash"], "meshHash": binding["meshHash"]}).encode()).hexdigest()
    binding_path = write_json("result-binding.json", binding)
    receipt = {"receiptVersion": "1.0.0", "jobId": manifest["jobId"], "manifestHash": manifest["manifestHash"], "state": "INTERNAL_TEST_COMPLETED", "executionStarted": True, "genericSolverExecutionStarted": True, "exitCode": 0, "resourceUsage": {"maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "elapsedSeconds": (datetime.now(timezone.utc) - started).total_seconds()}, "resultBindingHash": sha256_file(binding_path), "resultHash": binding["resultHash"], "createdAt": datetime.now(timezone.utc).isoformat()}
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
