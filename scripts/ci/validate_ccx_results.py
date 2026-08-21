#!/usr/bin/env python3
"""Validate an observed CalculiX displacement field against a calculated axial-bar reference.

The script derives all reference values from the committed benchmark metadata. It never
substitutes precomputed displacement data and emits PASS only from a parsed real .frd file.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path


ROOT = Path("artifacts")
FRD_PATH = ROOT / "solver" / "axial-bar.frd"
INPUT_META_PATH = ROOT / "solver" / "axial-bar.input.json"
REPORT_PATH = ROOT / "solver" / "numerical-validation.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def latest_displacements(path: Path) -> dict[int, tuple[float, float, float]]:
    latest: dict[int, tuple[float, float, float]] = {}
    active: dict[int, tuple[float, float, float]] | None = None
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if raw_line.startswith(" -4") and "DISP" in raw_line:
            active = {}
            continue
        if active is not None and raw_line.startswith(" -1"):
            fields = raw_line.split()
            if len(fields) >= 5:
                try:
                    active[int(fields[1])] = (float(fields[2]), float(fields[3]), float(fields[4]))
                except ValueError:
                    pass
            continue
        if active is not None and raw_line.startswith(" -3"):
            if active:
                latest = active
            active = None
    return latest


def main() -> None:
    if not FRD_PATH.exists() or not INPUT_META_PATH.exists():
        raise RuntimeError("A real CalculiX .frd output and fixed input metadata are both required.")
    metadata = json.loads(INPUT_META_PATH.read_text(encoding="utf-8"))
    displacements = latest_displacements(FRD_PATH)
    if not displacements:
        raise RuntimeError("No displacement field was parsed from the real CalculiX .frd output.")
    loaded_nodes: list[int] = []
    inp = (ROOT / "solver" / "axial-bar.inp").read_text(encoding="utf-8")
    in_loaded_set = False
    for line in inp.splitlines():
        if line.upper().startswith("*NSET,NSET=LOADED"):
            in_loaded_set = True
            continue
        if in_loaded_set and line.startswith("*"):
            break
        if in_loaded_set and line.strip():
            loaded_nodes.extend(int(value.strip()) for value in line.split(",") if value.strip())
    observed = [displacements[node][2] for node in loaded_nodes if node in displacements]
    if not observed:
        raise RuntimeError("No loaded-end nodes were present in the observed CalculiX displacement field.")
    e_mpa = float(metadata["material"]["elasticModulusMpa"])
    total_load = float(metadata["load"]["totalAxialForceN"])
    length = float(metadata["referenceGeometry"]["lengthMm"])
    area = float(metadata["referenceGeometry"]["crossSectionAreaMm2"])
    reference_displacement = total_load * length / (e_mpa * area)
    solver_displacement = sum(observed) / len(observed)
    error = abs(solver_displacement - reference_displacement)
    relative_error = error / abs(reference_displacement) if reference_displacement else math.inf
    tolerance = 0.30
    passed = relative_error <= tolerance
    report = {
        "validationStatus": "PASS" if passed else "FAIL",
        "validationMethod": "Mean loaded-face z displacement from real CalculiX FRD versus calculated δ=F·L/(E·A) axial-bar reference",
        "reference": {"value": reference_displacement, "unit": "mm", "source": "Closed-form linear-elastic axial-bar relation derived from fixed benchmark metadata."},
        "solverResult": {"value": solver_displacement, "unit": "mm", "observedLoadedNodeCount": len(observed)},
        "absoluteErrorMm": error,
        "relativeError": relative_error,
        "tolerance": tolerance,
        "toleranceJustification": "30% relative tolerance is declared for a first-order unstructured tetrahedral benchmark with discretized end-face force distribution; it is not a production acceptance tolerance.",
        "frdSha256": sha256_file(FRD_PATH),
        "inputSha256": metadata["calculixInputSha256"],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if not passed:
        raise RuntimeError("Observed CalculiX result did not meet the declared benchmark tolerance.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"NUMERICAL_VALIDATION_FAILURE: {error}", file=sys.stderr)
        sys.exit(1)
