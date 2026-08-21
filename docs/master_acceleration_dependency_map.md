# CAD-AI Engineering OS — Master Acceleration Dependency Map

**Status:** Active implementation map.  
**Scope:** CAD-AI Engineering OS after Phase 6.11.  
**Execution posture:** **RUNTIME_DESIGN_NOT_READY**. All execution eligibility and executable flags remain `false`.

## Governing Invariants

The platform may extend contracts, provenance, validation, user experience, review workflows, and non-executable planning. It must not manufacture a numerical result, material property, experiment, manufacturing capability, safety claim, standards-compliance claim, solver convergence claim, or optimization result. Every new engineering object must retain a stable identity, immutable revision, project scope, provenance, evidence state, and traceability links.

| Invariant | Required behavior | Disallowed shortcut |
|---|---|---|
| Engineering truth | Preserve `FACT`, `CALCULATED`, `DERIVED`, `ESTIMATED`, `ASSUMED`, `HYPOTHETICAL`, `UNVERIFIED`, `SPECULATIVE`, `PHYSICS_CONFLICT`, and `UNKNOWN` states. | Promoting a proposal, schema, or successful function call to engineering validation. |
| Immutable lineage | Add new records and links; retain predecessors. | Updating or deleting historical design, review, verification, or security evidence. |
| Project isolation | Resolve every artifact, link, and review inside the authorized project only. | Cross-project lookup, reuse, or parent-link inference. |
| Runtime posture | Keep `executionEligible=false` and `executable=false` until independent gates have actual evidence. | Implementing a process, sandbox, solver, mesher, shell, filesystem, network, plugin, or numerical-result path because a contract exists. |
| Traceability | Preserve requirement through release-gate explainability. | Treating an unlinked or unresolved reference as valid. |

## Dependency-Ordered Workstreams

| Wave | Safe scope now | Dependencies | Explicit boundary |
|---|---|---|---|
| 1 — Digital thread | Generic immutable artifacts and relations for requirements, concept, CAD, CAE, optimization, drawing, BOM/PLM, manufacturing, review, and release gate. | Existing persistent memory, engineering truth, CAD/CAE provenance. | No calculation, release, execution, or capability claim. |
| 2 — Planning foundations | Non-executable optimization, drawing, BOM/PLM, and manufacturing planning models with declared inputs, unknowns, review gates, immutable variants, and provenance. | Wave 1 artifact identities and relations. | No optimization result, drawing dimension, BOM quantity, post processor, toolpath, machine instruction, or standards-compliance claim without evidence. |
| 3 — CAD-first interface | Responsive inspectors for digital thread, planning artifacts, lineage, evidence, and runtime state. | Waves 1–2 APIs and project-scoped records. | Read-only evidence visibility cannot be confused with engineering approval or execution. |
| 4 — Runtime readiness reassessment | Evaluate independent sandbox controls, reviewer authorization, artifact/SBOM, hostile-test evidence, capacity, revocation, and governance. | Existing Phase 6.0–6.11 evidence. | A design, attestation declaration, or test schema is not enforcement evidence. |
| 5 — Controlled runtime | Build only explicitly approved runtime enforcement components. | A documented approval decision based on all required independent evidence. | No artifact execution until the approval is durable, current, and unrevoked. |
| 6 — Mesher / solver / result verification | Add bounded allowlisted adapters and verify raw-result provenance before any trusted result. | Wave 5 runtime implementation and test gates. | Gmsh, CalculiX, raw output, and execution success alone do not create a trusted result. |
| 7 — Cross-domain orchestration | Coordinate agents through immutable tasks, gates, and evidence. | Verified domain artifacts and safety gate policy. | Autonomous release of a safety-critical design remains prohibited. |

## Critical Path and Safe Parallelism

The critical path is **digital thread → non-executable planning foundations → responsive inspection → independent runtime evidence → explicit runtime approval → bounded adapters → result verification**. Drawing, BOM/PLM, manufacturing planning, and optimization contracts can proceed with the digital-thread foundation because they produce declared planning artifacts rather than execution or validated engineering outcomes. Secure runtime enforcement and solver/mesher integration cannot safely proceed in parallel with these foundations because independent evidence and approval remain absent.

## Runtime Approval Gate

Runtime implementation may be reconsidered only when each required control is backed by current, independently authorized, non-revoked evidence: sandbox isolation enforcement; bounded CPU, memory, storage, timeout, process, filesystem, and network policy; artifact/SBOM and signature verification; hostile-test evidence; reviewer independence; capacity evidence; audit/retention; revocation handling; result-verification design; and an explicit human approval. Until then, every implementation task remains evidence, planning, validation, or interface work.

## Acceptance Discipline

Each vertical slice must add deterministic focused tests, preserve current full-suite behavior, run `pnpm check`, and run the serialized full regression before checkpointing. A test that exercises a contract is not evidence that a future solver, sandbox, machine process, or result has operated. 
