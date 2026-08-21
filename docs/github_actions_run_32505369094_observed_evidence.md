# Observed GitHub Actions Benchmark Evidence

## Identity and scope

| Field | Observed value |
|---|---|
| Repository | `slivernaif1993201897-wq/cad-ai-engineering-os` (private) |
| Workflow | `Bounded CAD-AI CAE Benchmark` |
| Run URL | https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32505369094 |
| Run ID | `32505369094` |
| Commit SHA | `3e731d892795bb67fcbb9f41a65c4ac0cfaf5d19` |
| Artifact | `bounded-cae-evidence-32505369094`, ID `9455084567`, 29,534 bytes, unexpired at inspection |
| Scope | A fixed repository benchmark, **not** a user-submitted canonical CAE job and **not** a production runtime admission. |

## Observed execution facts

The GitHub-hosted run completed successfully. Its workflow generated a real STEP solid through the project’s OpenCascade.js generator, then passed that STEP artifact to a real Gmsh invocation. The runner log recorded **Gmsh 4.12.1**, Open CASCADE STEP import, 87 nodes and 428 elements in the emitted mesh, and a completed mesh write. A separate Python verifier then completed successfully before the CalculiX step.

The runner log recorded **CalculiX 2.21** executing on the verifier-generated fixed `C3D4` input. The numerical-validation step completed successfully after that solver run. All workflow steps, including evidence upload and the final success gate, reported `success` in the GitHub Actions run record.

## Solver provenance observations

| Component | Observed source and version |
|---|---|
| Gmsh | Ubuntu Noble package `gmsh` / `libgmsh4.12t64`, version `4.12.1+ds1-1.1build2` |
| CalculiX | Ubuntu Noble package `calculix-ccx`, version `2.21-1`; runtime banner `CalculiX Version 2.21` |
| Mesh verifier | Repository script `scripts/ci/verify_mesh_and_build_ccx.py`, separate from Gmsh output reporting |
| Numerical validator | Repository script `scripts/ci/validate_ccx_results.py`, comparing parsed real `.frd` displacement output against the declared axial-bar relation |

## Evidence retrieval limitation

Two independent Actions artifact-download routes were attempted from the cloud workspace: `gh run download` and the GitHub Actions artifact ZIP API. Both resolved artifact metadata successfully but failed during the Azure Blob Storage redirect with a **TLS handshake timeout**. GitHub job logs remained available and were retrieved successfully through the Actions log endpoint.

> The TLS timeout prevents this workspace from independently reading the uploaded evidence archive at this time. It does **not** negate the GitHub-run success state, but it does prevent a full local archive hash/reconciliation pass and therefore remains an evidence-access limitation.

## Truth-status boundaries

| Capability | Current status |
|---|---|
| Real fixed OpenCascade → Gmsh → independently checked mesh → CalculiX → numerical-validation benchmark execution | **OBSERVED** on the named GitHub Actions run |
| Canonical user CAE job dispatch through the deployed mobile app’s runtime admission boundary | **NOT_IMPLEMENTED** |
| Independent full artifact archive reconciliation in this cloud workspace | **BLOCKED** by artifact-download TLS timeout |
| GitHub-hosted runner hostile escape-resistance evidence | **BLOCKED**; hosted-runner success does not establish required sandbox suitability |
| Production runtime readiness | **BLOCKED** |
