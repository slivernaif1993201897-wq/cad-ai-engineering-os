#!/usr/bin/env python3
"""Independent mesh checks and fixed CalculiX input construction for the GitHub benchmark.

The script does not call Gmsh or trust a Gmsh quality report. It parses the emitted mesh,
checks tetrahedral connectivity, signed volumes, degeneracy and CAD bounds, then writes a
fixed C3D4 CalculiX model with no user-provided solver text or runtime parameters.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import meshio
import numpy as np


ROOT = Path("artifacts")
CAD_PROVENANCE = ROOT / "cad" / "axial-bar.provenance.json"
MESH_PATH = ROOT / "mesh" / "axial-bar.msh"
VERIFY_PATH = ROOT / "mesh" / "mesh-verification.json"
INPUT_PATH = ROOT / "solver" / "axial-bar.inp"
INPUT_META_PATH = ROOT / "solver" / "axial-bar.input.json"

E_MPA = 210000.0
POISSON = 0.3
TOTAL_LOAD_N = 1000.0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def card_nodes(name: str, nodes: list[int]) -> list[str]:
    lines = [f"*NSET,NSET={name}"]
    for index in range(0, len(nodes), 12):
        lines.append(", ".join(str(node) for node in nodes[index:index + 12]))
    return lines


def main() -> None:
    if not CAD_PROVENANCE.exists() or not MESH_PATH.exists():
        raise RuntimeError("The fixed CAD provenance and real Gmsh mesh are both required.")
    INPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    provenance = json.loads(CAD_PROVENANCE.read_text(encoding="utf-8"))
    mesh = meshio.read(MESH_PATH)
    tetra_blocks = [block.data for block in mesh.cells if block.type == "tetra"]
    if not tetra_blocks:
        raise RuntimeError("The real Gmsh output did not contain first-order tetrahedral elements.")
    elements = np.vstack(tetra_blocks).astype(int)
    points = np.asarray(mesh.points, dtype=float)
    if points.ndim != 2 or points.shape[1] < 3 or len(points) == 0:
        raise RuntimeError("The mesh has no usable three-dimensional node coordinates.")
    if np.any(elements < 0) or np.any(elements >= len(points)):
        raise RuntimeError("Mesh connectivity references a node outside the emitted mesh.")

    tetra = points[elements[:, :4], :3]
    signed_volumes = np.einsum(
        "ij,ij->i",
        tetra[:, 1] - tetra[:, 0],
        np.cross(tetra[:, 2] - tetra[:, 0], tetra[:, 3] - tetra[:, 0]),
    ) / 6.0
    absolute_volumes = np.abs(signed_volumes)
    degeneracy_epsilon = 1e-12
    degenerate = int(np.count_nonzero(absolute_volumes <= degeneracy_epsilon))
    negative_orientation = int(np.count_nonzero(signed_volumes < -degeneracy_epsilon))
    bounds_min = points[:, :3].min(axis=0)
    bounds_max = points[:, :3].max(axis=0)
    expected_min = np.array([0.0, 0.0, 0.0])
    expected_max = np.array([10.0, 10.0, 100.0])
    bounds_tolerance_mm = 1e-6
    bounds_match = bool(
        np.allclose(bounds_min, expected_min, atol=bounds_tolerance_mm)
        and np.allclose(bounds_max, expected_max, atol=bounds_tolerance_mm)
    )
    mesh_pass = degenerate == 0 and negative_orientation == 0 and bounds_match

    z = points[:, 2]
    surface_tolerance_mm = 1e-6
    fixed_nodes = (np.where(z <= bounds_min[2] + surface_tolerance_mm)[0] + 1).tolist()
    loaded_nodes = (np.where(z >= bounds_max[2] - surface_tolerance_mm)[0] + 1).tolist()
    if not fixed_nodes or not loaded_nodes:
        raise RuntimeError("The mesh lacks identifiable fixed or loaded end-face nodes.")

    verification = {
        "verificationMethod": "Independent meshio connectivity, signed-simplex-volume, degeneracy, orientation, and bounds checks",
        "verifier": "scripts/ci/verify_mesh_and_build_ccx.py",
        "sourceMesh": str(MESH_PATH),
        "meshSha256": sha256_file(MESH_PATH),
        "cadStepSha256": provenance["stepSha256"],
        "cadToMeshTraceability": "CAD STEP SHA-256 is bound into this verifier output and solver-input metadata.",
        "unit": "mm",
        "nodeCount": int(len(points)),
        "tetraElementCount": int(len(elements)),
        "connectivityValid": True,
        "negativeOrientationCount": negative_orientation,
        "degenerateElementCount": degenerate,
        "minimumAbsoluteVolumeMm3": float(absolute_volumes.min()),
        "boundsMm": {"min": bounds_min.tolist(), "max": bounds_max.tolist()},
        "expectedBoundsMm": {"min": expected_min.tolist(), "max": expected_max.tolist()},
        "boundsMatch": bounds_match,
        "verificationStatus": "PASS" if mesh_pass else "FAIL",
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
    VERIFY_PATH.write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8")
    if not mesh_pass:
        raise RuntimeError("Independent mesh verification failed; no CalculiX input will be written.")

    lines = [
        "*HEADING",
        "CAD-AI fixed GitHub benchmark: OpenCascade STEP -> Gmsh tetra mesh -> CalculiX linear static solve",
        "*NODE",
    ]
    for node_id, (x, y, z_value) in enumerate(points[:, :3], start=1):
        lines.append(f"{node_id}, {x:.12g}, {y:.12g}, {z_value:.12g}")
    lines.extend(["*ELEMENT,TYPE=C3D4,ELSET=EALL"])
    for element_id, nodes in enumerate(elements[:, :4] + 1, start=1):
        lines.append(f"{element_id}, {', '.join(str(int(node)) for node in nodes)}")
    lines.extend(card_nodes("FIXED", fixed_nodes))
    lines.extend(card_nodes("LOADED", loaded_nodes))
    lines.extend([
        "*MATERIAL,NAME=STEEL",
        "*ELASTIC",
        f"{E_MPA}, {POISSON}",
        "*SOLID SECTION,ELSET=EALL,MATERIAL=STEEL",
        ",",
        "*STEP,NLGEOM=NO",
        "*STATIC",
        "1., 1.",
        "*BOUNDARY",
        "FIXED, 1, 3, 0.",
        "*CLOAD",
    ])
    per_node_load = TOTAL_LOAD_N / len(loaded_nodes)
    lines.extend(f"{node}, 3, {per_node_load:.12g}" for node in loaded_nodes)
    lines.extend([
        "*NODE FILE",
        "U",
        "*EL FILE",
        "S",
        "*NODE PRINT,NSET=LOADED",
        "U",
        "*END STEP",
    ])
    INPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    input_metadata = {
        "inputKind": "FIXED_REPOSITORY_BENCHMARK",
        "canonicalUserCAEJob": "NOT_PROVIDED",
        "admissionState": "NOT_A_USER_SUBMITTED_RUNTIME_REQUEST",
        "cadStepSha256": provenance["stepSha256"],
        "meshSha256": verification["meshSha256"],
        "calculixInputSha256": sha256_file(INPUT_PATH),
        "material": {"elasticModulusMpa": E_MPA, "poissonRatio": POISSON},
        "boundaryCondition": "All translational degrees of freedom fixed on the z-min end face.",
        "load": {"totalAxialForceN": TOTAL_LOAD_N, "distribution": "Equal fixed force over all z-max end-face nodes."},
        "referenceGeometry": {"crossSectionAreaMm2": 100.0, "lengthMm": 100.0},
        "createdBy": "scripts/ci/verify_mesh_and_build_ccx.py",
    }
    INPUT_META_PATH.write_text(json.dumps(input_metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"MESH_OR_INPUT_FAILURE: {error}", file=sys.stderr)
        sys.exit(1)
