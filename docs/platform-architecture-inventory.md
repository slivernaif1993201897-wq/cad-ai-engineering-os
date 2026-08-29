# CAD-AGENT Platform Architecture Inventory

**Inventory revision:** `2026.08.25.1`
**Purpose:** Source-backed architecture classification for the controlled platform restructure. This inventory does not change the authority of CAD artifacts, CAE evidence, runtime admission, or existing project authorization.

## Implemented Layer Mapping

| Requested platform layer | Actual code integration | Current status | Boundary retained |
|---|---|---|---|
| AI command layer | `server/cadAgentSkills.ts`, `server/capabilityRegistry.ts`, `app/(tabs)/agent.tsx` | **PARTIALLY_REAL** | Deterministic command classification, capability resolution, explicit parameters/confirmation, and persistent provenance; no arbitrary shell or general LLM execution. |
| CAD domain | `server/cadKernel.ts`, `server/featureHistory.ts`, `server/cadFileIntelligence.ts`, `server/engineeringViewer.ts` | **PARTIALLY_REAL** | OpenCascade STEP import/export, inspection, controlled sketch/extrude/pattern/mirror paths, artifact hashing, and viewer; no generic imported-STEP editing. |
| CAE domain | `server/seatInputPackage.ts`, `server/runtimeAdmission.ts`, `server/solverInputPackage.ts`, `server/signedRuntimeEvidence.ts` | **PARTIALLY_REAL** | Typed inputs, admission, governed configurations, evidence, and fail-closed state are retained; the chat surface cannot bypass solver admission. |
| CAM domain | `server/capabilityRegistry.ts` | **UNSUPPORTED** | No validated machine post processor, toolpath, or G-code is enabled. |
| Assembly domain | `server/artifactAssembly.ts`, `server/engineeringReferences.ts` | **PARTIALLY_REAL** | Multi-artifact component identities, transforms, immutable revisions, vertex references, and hash-bound BOM are real; mates, joints, and interference remain unsupported. |
| Engineering data / SEKB | `server/persistentMemory.ts`, `server/seatKnowledgeRecords.ts`, `drizzle/schema.ts` | **REAL** | Project-scoped records, lineage, immutable revision context, and evidence/provenance storage. |
| Interoperability | `server/cadFileIntelligence.ts`, `server/engineeringViewer.ts` | **PARTIALLY_REAL** | STEP/STP intake and STEP/STL inspection are available; no arbitrary multi-format conversion is claimed. |
| Validation/security | `server/runtimeAdmission.ts`, `server/caeEvidence.ts`, `server/signedRuntimeEvidence.ts`, `server/capabilityRegistry.ts` | **REAL** | Project authorization, hash verification, stale/foreign rejection, HMAC evidence verification, and registry-backed command claims remain fail-closed. |

## Capability Classification Summary

| Capability ID | Current status | Evidence path | Explicit limitation |
|---|---|---|---|
| `CAD.IMPORT.STEP` | REAL | `cadFileIntelligence.ts`, `cad-file-intelligence.test.ts` | Imported STEP has no inferred feature history, material, tolerance, or topology semantics. |
| `CAD.EXPORT.STEP` | REAL | `cadKernel.ts`, `seat-cad-engine.test.ts` | Only validated artifact paths are admitted. |
| `CAD.INSPECT.ARTIFACT` | REAL | `engineeringViewer.ts`, `engineering-reference-http.test.ts` | Viewer mesh references do not become source feature semantics. |
| `CAD.CREATE.SKETCH` | PARTIALLY_REAL | `featureHistory.ts`, `phase410-cad-foundation.test.ts` | Controlled circle/rectangle scope only; no general solver. |
| `CAD.CREATE.EXTRUDE` | PARTIALLY_REAL | `featureHistory.ts`, `phase410-cad-foundation.test.ts` | Controlled source and direction only. |
| `CAD.CREATE.PATTERN` / `CAD.CREATE.MIRROR` | PARTIALLY_REAL | `featureHistory.ts`, `phase49-patterns.test.ts` | Bounded patterns and supported global planes only. |
| `CAD.CREATE.HOLE` | PARTIALLY_REAL | `capabilityRegistry.ts`, `cad-agent-skills-http.test.ts` | Requires a future controlled operation; no generic source mutation. |
| `CAD.CREATE.FILLET` | BROKEN | `featureHistory.ts`, `phase410-cad-foundation.test.ts` | Preserved behind its fail-closed gate. |
| `CAD.CREATE.CONSTRAINT` | UNSUPPORTED | `capabilityRegistry.ts`, `cad-agent-skills-http.test.ts` | No constraint solver or degrees-of-freedom calculation. |
| `CAD.ASSEMBLY.TRANSFORM` | REAL | `artifactAssembly.ts`, `artifact-assembly-http.test.ts` | Not equivalent to mate/joint solving. |
| `CAD.ASSEMBLY.BOM.DERIVE` | REAL | `artifactAssembly.ts`, `cad-agent-skills-http.test.ts` | Does not infer material, mass, cost, manufacturing, or compliance. |
| `CAD.ASSEMBLY.MATE` / `CAD.ASSEMBLY.INTERFERENCE` | UNSUPPORTED | `capabilityRegistry.ts`, `cad-agent-skills-http.test.ts` | No generic semantic topology, mate solver, or collision policy. |
| `CAE.INPUT.READINESS` | REAL | `seatInputPackage.ts`, `seat-input-package.test.ts` | Readiness does not run a solver. |
| `CAE.RUN.CALCULIX` | PARTIALLY_REAL | `runtimeAdmission.ts`, `runtime-evidence.test.ts` | Chat dispatch remains blocked pending exact admitted execution conditions. |
| `CAM.CREATE_TOOLPATH` | UNSUPPORTED | `capabilityRegistry.ts`, `cad-agent-skills-http.test.ts` | No validated post processor or machine command generation. |
| `AI.COMMAND.ASSESS` | REAL | `cadAgentSkills.ts`, `cad-agent-skills-http.test.ts` | Deterministic classifier; not a general autonomous engineering authority. |
| `DATA.SEKB.TRACEABILITY` | REAL | `persistentMemory.ts`, `digital-thread.test.ts` | Not a substitute for a commercial PLM approval workflow. |

## Adapter Contract Rules

Every engine-facing capability is represented in the immutable registry with its engine names, input/output schema, required parameters, formats, validation requirements, security requirements, artifact types, capability status, version, test references, and known limitations. `server/cadAgentSkills.ts` must resolve a registry capability before recording a command plan. The command plan records the registry SHA-256 and persisted registry record ID alongside its project-scoped provenance record.

> **Protected-system rule:** Registry metadata cannot grant execution. A capability marked `REAL` still requires its existing revision, artifact, authorization, validation, and admission checks. A `PARTIALLY_REAL`, `BROKEN`, or `UNSUPPORTED` capability is returned to the user as such and never converted into a success claim.
