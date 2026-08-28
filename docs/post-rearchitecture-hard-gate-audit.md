# Post-Rearchitecture Hard-Gate Audit

**Audit basis:** current source tree and the isolated full regression completed on 25 August 2026. The run passed **73 test files / 255 tests**; one signed-runtime-evidence file with two tests was intentionally skipped because its environment gate was not present. This document does not infer capability from UI state.

| Hard gate | Status | Executable evidence | Exact boundary |
|---|---|---|---|
| Artifact integrity, revision provenance, and reload | **VERIFIED** | `cadFileIntelligence.ts`, `cadArtifactOperations.ts`, `cad-artifact-operations-http.test.ts`, `cad-file-intelligence.test.ts` | STEP parsing does not establish imported assembly hierarchy, feature history, material, tolerance, or named-part semantics. |
| Controlled OpenCascade validation | **VERIFIED** | `createCadValidation`, project-owned byte/hash verification, validation-history tests | The report is geometric/kernel evidence only; it is not physical, manufacturing, safety, or solver validation. |
| Controlled Boolean Cut | **VERIFIED** | preview → explicit approval → new STEP ingestion → validation regression | It is an explicit source/cutter operation, not generic topology-aware editing. |
| Controlled cylindrical hole and parameter regeneration | **VERIFIED** | `previewCylindricalHole`, `approveCylindricalHole`, `cad-artifact-operations-http.test.ts` | Requires explicit millimetre diameter, depth, center, direction, verified STEP source, preview, and approval. Generic hole editing remains unsupported. |
| Feature lineage | **PARTIAL** | persisted `featureId`, `featureRevision`, parent artifact, dependencies, parameters, output artifact, validation, and provenance for cylindrical holes | A reusable generic feature graph for every operation is not yet implemented. |
| Sketch and feature history | **PARTIAL** | bounded rectangle/circle/extrude/pattern/mirror feature-history routes and tests | Generic constraint solving and stable topology identity across independent regenerations are unsupported. |
| Assembly | **PARTIAL** | persistent component transforms, artifact-bound references, revision history, and BOM | Mate solving, joint solving, generic interference/clearance, and imported assembly reconstruction are unsupported. |
| Drawing | **VERIFIED** | project-authorized orthographic SVG export bound to artifact hash, revision, and validation record | No standards-complete dimensions, annotations, tolerances, section views, or title-block release workflow are claimed. |
| CAE | **BLOCKED** | CAE readiness/input-package and runtime evidence tests | Seat execution remains fail-closed until exact approved material, fixture, load, boundary, mesh, solver, and validation inputs exist. |
| CAM | **BLOCKED** | capability registry and CAM planning controls | No validated toolpath generator, machine post-processor, or machine interface exists. |
| CAD-Agent command path | **PARTIAL** | `cadAgentSkills.ts`, explicit parameter interpreter, registry-bound operation plan, and natural-language cylindrical-hole regression | Only registered BOM and explicit cylindrical-hole operations mutate state. It is not a general autonomous CAD executor. |
| Capability registry | **VERIFIED** | immutable project snapshot, SHA-256 registry hash, authorization/restart tests | Status vocabulary is restricted to `VERIFIED`, `PARTIAL`, `BLOCKED`, and `UNSUPPORTED`. |
| Security and project isolation | **VERIFIED** | project access keys, managed storage verification, foreign-request regression, immutable persistent records | This is application-level evidence, not an independent certification. |

## Controlled Natural-Language CAD Vertical Slice

The following slice is now executable under an authenticated project context: **user command with explicit parameters → CAD-Agent interpretation → capability-registry resolution → OpenCascade hole preview → explicit confirmation → kernel subtraction → STEP ingestion → validation → SHA-256-bound artifact/feature provenance**. The command API accepts only an authorized source file ID and explicit structured hole parameters; it never derives coordinates, units, depth, topology targets, or physical requirements.

The source STEP remains immutable. A parameter revision retains the same `featureId`, increments `featureRevision`, preserves the parent artifact dependency, creates a distinct output STEP hash, and records a new validated result. The full regression includes this proof.

## Remaining Architecture Work

The common feature-operation framework is still **PARTIAL**: Boolean Cut, cylindrical hole, and validation share artifact integrity and approval principles but do not yet route through a single generic feature executor. The next safe refactor is to migrate each controlled operation to one common definition/preview/approval/ingestion/provenance contract, with no claim of generic CAD editing. Generic B-Rep operations, solver-executed CAE from chat, CAM output, mates, constraints, and interference remain outside the admitted platform boundary.
