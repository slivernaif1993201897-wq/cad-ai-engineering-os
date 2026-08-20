# Project TODO

- [x] Implement the first cloud-hosted CAD vertical slice: structured requirements, deterministic plan, real OCCT geometry, validation, viewer artifact, save payload, STEP export, and parametric width modification.
- [x] Add an `ICADKernel` interface and OpenCascade.js adapter that keeps LLM/planner outputs separate from CAD operations.
- [ ] Add Requirements and CAD Planner schemas with explicit `OPEN_QUESTION` generation and unit validation.
- [x] Build the CAD Workspace portrait interface and clear conceptual/validation state.
- [x] Add real-kernel acceptance tests for the mounting-block flow and width regeneration.
- [ ] Add future-agent interfaces (CAE, optimization, drawing, BOM/PLM, CAM) as non-executing architecture only; never fabricate outputs.
- [x] Generate and apply the CAD-AI application icon before the first checkpoint.

- [x] Phase 2: Build a structured Requirements Agent with deterministic unit normalization, validation states, conflict detection, open questions, and revision-aware traceability.
- [x] Phase 2: Integrate requirement validation with CAD generation so invalid, conflicting, or incomplete requirements cannot create trusted CAD.
- [x] Phase 2: Add the Requirements panel for open questions, conflicts, validated requirements, source, confidence, and status.
- [x] Phase 2: Add unit, conflict, missing-information, conversational-update, traceability, and regression acceptance tests.
- [x] Phase 2: Save a verified checkpoint and report the final test status.

- [x] Phase 3: Define the requirements-gated CAD Agent, deterministic Feature Planner, expanded CADPlan contracts, and CAD model truth states.
- [x] Phase 3: Integrate feature planning, parametric regeneration, configuration preservation, and validated STEP export without changing the verified OpenCascade kernel path.
- [x] Phase 3: Build a kernel-derived tessellated mobile CAD viewer with camera controls, feature selection, and bounding-box measurements.
- [x] Phase 3: Extend the mobile workspace with CAD viewer, parameters, feature tree, measurements, configurations, and export controls.
- [x] Phase 3: Add CAD Agent, Feature Planner, viewer payload, configuration, export, truth-layer, and full-workflow acceptance tests.
- [x] Phase 3: Save a verified checkpoint and report final commands, test results, and performance observations.

- [x] Phase 3.6: Define explicit engineering truth statuses, evidence-chain contracts, ruthless review, contradiction, alternatives, and self-critique schemas.
- [x] Phase 3.6: Implement deterministic evidence, review, problem-solving, contradiction, and self-critique engines without fabricating scientific, simulation, material, or manufacturing claims.
- [x] Phase 3.6: Integrate review truth states with CAD gating and expose the workflow through tRPC.
- [x] Phase 3.6: Build the engineering review workspace with truth labels, evidence, risks, alternatives, limitations, and explicit exploration gating.
- [x] Phase 3.6: Add truth-status, evidence-chain, honesty, contradiction, alternative, self-critique, CAD-gating, and regression acceptance tests.
- [x] Phase 3.6: Save a verified checkpoint and report the final test status without starting Phase 4.

- [x] Phase 3.5: Define engineering intelligence modes, problem decomposition, concept candidates, specialist reviews, self-correction, ranking, memory, and benchmark contracts.
- [x] Phase 3.5: Implement deterministic multi-concept generation, adversarial specialist review, self-correction, alternative search, ranking, and maximum-effort unresolved reporting without fabricating evidence.
- [x] Phase 3.5: Integrate the intelligence core with the Requirements Agent, Phase 3.6 truth review, CAD planning eligibility, and tRPC API.
- [x] Phase 3.5: Build a mobile engineering intelligence workspace with mode controls, decomposition, candidate comparison, specialist findings, memory, and CAD-handoff status.
- [x] Phase 3.5: Add benchmarks and acceptance tests for decomposition, diversity, physics consistency, failure detection, alternatives, self-correction, traceability, manufacturing reasoning, and CAD handoff.
- [x] Phase 3.5: Save a verified checkpoint and report final outcomes without starting Phase 4.

- [x] Phase 3.7: Define CAD Agent conversational context, messages, transparent proposals, concept-card, evidence, history, command-palette, and attachment contracts.
- [x] Phase 3.7: Implement deterministic context-aware CAD Agent commands, proposed changes, reversible history actions, concept actions, and truthful evidence reporting.
- [x] Phase 3.7: Add safe attachment type validation, metadata extraction, project/conversation association, and honest unsupported parsing outcomes.
- [x] Phase 3.7: Integrate the workbench with selected viewer geometry, active configuration, requirements, intelligence, CAD actions, and server APIs.
- [x] Phase 3.7: Build responsive mobile-first conversational workbench panels, command palette, context bar, accessibility labels, and keyboard shortcuts where supported.
- [x] Phase 3.7: Add conversation, selection context, proposal transparency, reversibility, concept, evidence, attachment, command, and regression acceptance tests.
- [x] Phase 3.7: Save a verified checkpoint and report final results without starting Phase 4.

- [x] Phase 3.8: Define persistent project, conversation, memory, decision, lineage, retrieval, archive, restore, and deletion contracts with project isolation.
- [x] Phase 3.8: Implement append-only persistent conversations, memory records, design decisions, rejected concepts, immutable lineage, and selective memory retrieval.
- [x] Phase 3.8: Integrate persistent memory with CAD Agent workbench messages, proposals, concept actions, requirements, validation states, and typed server APIs.
- [x] Phase 3.8: Build mobile workbench panels for conversation history, engineering memory, decisions, concept/revision lineage, rejected concepts, and source evidence inspection.
- [x] Phase 3.8: Add persistence, lineage, retrieval, project-isolation, archive, restore, delete, missing-history, and context-restoration acceptance tests.
- [x] Phase 3.8: Save a verified checkpoint and report final results without starting Phase 4.

- [x] Phase 3.9: Define secure project-isolated CAD file, version, parser context, geometry metadata, provenance, storage-reference, and lifecycle contracts.
- [x] Phase 3.9: Implement real STEP and STL validation, bounded parsing, file hashing, duplicate/version detection, OpenCascade geometry context, parser transparency, and managed storage references.
- [x] Phase 3.9: Integrate parsed CAD file context and provenance with CAD Agent conversations, engineering analysis, concepts, traceability, and typed server APIs.
- [x] Phase 3.9: Build versioned STEP/STL file cards with status, units, geometry summary, provenance, inspection, chat reference, compare, and remove actions.
- [x] Phase 3.9: Add real STEP/STL fixture parsing, invalid file, integrity, duplicate, versioning, isolation, failure, unsupported format, file-context, and CAD Agent acceptance tests.
- [x] Phase 3.9: Save a verified checkpoint and report formats, parser/kernel, limitations, storage, schema, UI, integration, security, tests, and next milestone without starting Phase 4.

- [x] Phase 4: Define project-isolated viewer scene, selection, measurement, traceability, proposal-preview, and immutable branch contracts without claiming unsupported engineering evidence.
- [x] Phase 4: Implement real parser/kernel-derived STEP/STP/STL tessellation, stable entity references, bounded scene generation, and authorized viewer APIs.
- [x] Phase 4: Build the native 3D viewer workspace with touch/mouse camera controls, model tree, selection highlighting, inspection, visibility, section, measurement, and responsive panels.
- [x] Phase 4: Integrate selected geometry with CAD Agent context, evidence, requirements, persistent memory, non-destructive proposal preview, lineage, and file-version association.
- [x] Phase 4: Add deterministic viewer, tessellation, selection, camera, measurement, tree, traceability, proposal, branch, isolation, and full-regression acceptance tests.
- [x] Phase 4: Save a verified checkpoint and report architecture, engine, kernel integration, UX, security, performance, tests, limitations, and recommended next phase without starting Phase 5.

- [x] Phase 4.5: Define controlled CAD operation, validation, execution, preview, history, failure-recovery, and truth contracts with no arbitrary code path.
- [x] Phase 4.5: Implement deterministic CAD Agent proposal-to-operation planning and pre-execution validation for the reliably supported mounting-block parameter operations only.
- [x] Phase 4.5: Implement non-persistent kernel preview, atomic user-approved execution, immutable parametric revision lineage, safe rollback reference, and bounded alternative recovery.
- [x] Phase 4.5: Expose capability-safe operation APIs and integrate CAD Agent proposals, selection context, evidence, file-version limits, and operation history.
- [x] Phase 4.5: Build a mobile Operation Inspector with plan review, validation, preview, apply, reject, execution states, history, and recovery guidance.
- [x] Phase 4.5: Add real-kernel operation, invalid-parameter, invalid-reference, preview, apply, reject, branch, rollback, history, recovery, security, and full-regression acceptance tests.
- [x] Phase 4.5: Save a verified checkpoint and report supported operations, kernel execution, validation, preview, branching, recovery, UI, security, tests, limitations, and next milestone without starting Phase 5.
