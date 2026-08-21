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

- [x] Phase 4.6: Define immutable feature, dependency graph, parameter, topology-reference, regeneration, operation-editing, revision, comparison, and truth contracts without arbitrary BRep manipulation.
- [x] Phase 4.6: Implement real OpenCascade-backed rectangular sketch and extrusion history with normalized units, dependency validation, geometry validation, and stable declared references.
- [x] Phase 4.6: Implement controlled operation-plan editing, preview regeneration, invalid-reference handling, failed regeneration events, immutable feature revisions, safe rollback references, and branch comparison.
- [x] Phase 4.6: Expose capability-safe feature-history APIs and integrate CAD Agent context, evidence, operation history, file limits, and persistent lineage.
- [x] Phase 4.6: Build a mobile Feature Tree, Feature Inspector, operation-plan editor, regeneration controls, and immutable Branch Comparison workspace.
- [x] Phase 4.6: Add real-kernel sketch, extrude, dependency, parameter, unit, regeneration, invalid-reference, failure, revision, branch-comparison, and full-regression acceptance tests.
- [x] Phase 4.6: Save a verified checkpoint and report feature-history architecture, supported types, kernel execution, parameters, units, dependency graph, regeneration, references, branch comparison, UI, tests, unsupported types, and limits without starting Phase 5.

- [x] Phase 4.7: Define real circle feature, topology-reference stability, explicit invalidation, fillet-readiness, repeatability, and geometry-export contracts with no unsupported topology remapping.
- [x] Phase 4.7: Implement real OpenCascade CIRCLE_SKETCH → EXTRUDE history with center/radius/distance units, validation, controlled regeneration, immutable branches, and feature-history-aware STEP geometry export.
- [x] Phase 4.7: Implement topology inspection for body/face/edge/vertex references, invalidation detection, repeatability checks, failure preservation, and formal FILLET_READY evaluation without executing fillets.
- [x] Phase 4.7: Expose capability-safe circle-history, topology, readiness, export, and CAD Agent APIs with durable evidence and project isolation.
- [x] Phase 4.7: Extend the mobile Feature Tree and Inspector with circle controls, topology status, fillet gate, and geometry-export reporting.
- [x] Phase 4.7: Add real-kernel circle, extrusion, unit, parameter, regeneration, reference, invalidation, failure, branch, repeatability, export, readiness, CAD Agent, and full-regression tests.
- [x] Phase 4.7: Save a verified checkpoint and report circle implementation, topology results, export, CAD Agent support, UI, tests, FILLET_READY, limits, and next milestone without starting Phase 5.

- [x] Phase 4.8: Define deterministic topology manifests, matching evidence, ambiguity and invalidation statuses, fillet readiness, guarded circular pattern, export provenance, and truth contracts.
- [x] Phase 4.8: Implement revision-safe topology naming and matching with real-kernel proof tests for survival, change, deletion, addition, ambiguity, repeatability, branch isolation, and revision isolation.
- [x] Phase 4.8: Implement guarded real OpenCascade CIRCULAR_PATTERN for valid offset circle extrusions, controlled count/angle/axis regeneration, immutable graph lineage, validation, and failure preservation.
- [x] Phase 4.8: Implement validated STEP geometry-export provenance, download/share metadata, capability-safe topology/pattern/export APIs, and explicit CAD Agent circular-pattern planning.
- [x] Phase 4.8: Build mobile topology-matching, circular-pattern inspection/editing, export/share metadata, and strict fillet-gate controls.
- [x] Phase 4.8: Add real-kernel topology, matching, ambiguity, invalidation, repeatability, isolation, pattern, regeneration, failure, export provenance, CAD Agent, and full-regression acceptance tests.
- [x] Phase 4.8: Save a verified checkpoint and report topology architecture, proof-test results, pattern implementation, feature history, STEP export/provenance, CAD Agent, UI, FILLET_READY, regression, limitations, and next milestone without starting Phase 5.

- [x] Phase 4.9: Audit Phase 4.8 circular-pattern, topology, feature-history, CAD Agent, API, UI, and test boundaries against the controlled capability-expansion specification.
- [x] Phase 4.9: Define validated GLOBAL_X/GLOBAL_Y/GLOBAL_Z axis, RECTANGULAR_PATTERN, regeneration, status, topology-stress, STEP-provenance, and strengthened fillet-readiness contracts.
- [x] Phase 4.9: Implement real OpenCascade-backed global-axis circular patterns and guarded rectangular patterns with immutable history nodes, controlled preview/apply regeneration, and branch preservation.
- [x] Phase 4.9: Strengthen topology evidence and refusal behavior through deterministic stress scenarios; preserve FILLET_READY = FALSE unless proven requirements are met.
- [x] Phase 4.9: Extend capability-safe topology/pattern/export APIs and CAD Agent planners with targeted questions and no invented geometry references.
- [x] Phase 4.9: Build progressive-disclosure mobile Feature Inspector controls for circle and rectangular patterns, lifecycle state, topology evidence, fillet readiness, and STEP geometry export metadata.
- [x] Phase 4.9: Add real-kernel GLOBAL_X/GLOBAL_Y/GLOBAL_Z, invalid axis, rectangular-pattern, edit, regeneration, branch, topology, provenance, CAD Agent, UI, and full-regression tests.
- [x] Phase 4.9: Save a verified checkpoint and report supported patterns, topology stress, fillet gate, exports, CAD Agent, UI, regressions, limitations, and explicit Phase 5 exclusion.

- [x] Phase 4.10: Audit topology manifests, viewer selection mapping, feature history, CAD Agent, UI, and regression boundaries against the final CAD foundation closure specification.
- [x] Phase 4.10: Define edge-topology proof, fillet evidence status, bounded global-plane Mirror, pattern-instance identity, and CAD capability benchmark contracts.
- [x] Phase 4.10: Implement deterministic real-kernel EDGE creation, persistence, regeneration, deletion, replacement, ambiguity, invalidation, branch isolation, and repeated-regeneration evidence without transient object-identity claims.
- [x] Phase 4.10: Implement bounded OpenCascade Mirror over GLOBAL_X/GLOBAL_Y/GLOBAL_Z with immutable history, preview, apply, reject, regeneration, failure preservation, STEP provenance, and APIs.
- [x] Phase 4.10: Implement proof-aware pattern-instance viewport selection/highlighting and a progressive-disclosure mobile Pattern Instance Inspector with explicit unknown identity.
- [x] Phase 4.10: Extend CAD Agent Mirror planning and no-override FILLET_READY diagnostics with explicit PASS/FAIL/UNKNOWN statuses.
- [x] Phase 4.10: Build and run deterministic real-kernel edge, Mirror, highlighting, topology refusal, fillet diagnostic, CAD benchmark, TypeScript, and full-regression tests.
- [x] Phase 4.10: Save a verified checkpoint and report edge proof, Mirror, pattern highlighting, CAD benchmark, fillet diagnostic, regressions, constraints, and Phase 5 recommendation without starting Phase 5.

- [x] Phase 5.0: Audit requirements, CAD provenance, feature history, viewer selection, persistent memory, truth contracts, APIs, and UI integration points for a solver-independent CAE planning foundation.
- [x] Phase 5.0: Define shared CAE simulation-plan, analysis, material-truth, geometry scope, boundary, load, contact, mesh, solver, evidence, knowledge-gap, readiness, traceability, review, critique, and no-results contracts.
- [x] Phase 5.0: Implement deterministic CAE problem decomposition, input validation, readiness gating, solver-unavailable refusal, knowledge gaps, CAD change requests, project-isolated plans, and append-only evidence without CAD modification.
- [x] Phase 5.0: Implement physics, boundary, material, mesh, solver, and validation adversarial reviews plus self-critique with explicit assumptions and no fabricated numerical outputs.
- [x] Phase 5.0: Expose capability-safe project-isolated CAE APIs linked to validated CAD revision, geometry provenance, feature history, requirements, selected geometry, and branch context.
- [x] Phase 5.0: Build a mobile CAE workspace showing plans, reused viewer context, inspector, assumptions, materials, loads, constraints, contacts, evidence, knowledge gaps, review, critique, readiness, and no-solver status.
- [x] Phase 5.0: Add deterministic CAE plan, analysis, material, load, boundary, contact, mesh, gap, readiness, truth, traceability, failure, critique, adversarial-review, difficult-mechanical acceptance, TypeScript, and full-regression tests.
- [x] Phase 5.0: Save a verified checkpoint and report CAE architecture, contracts, reasoning, truth gates, CAD linkage, UI, tests, solver limitations, and Phase 5.0 completion without implementing a solver.

- [x] Phase 5.1: Audit existing CAE plans, CAD provenance, persistent memory, file handling, truth states, APIs, tests, and mobile workspace seams for evidence and adapter extensions.
- [x] Phase 5.1: Define versioned SolverAdapterContract, solver state, immutable material evidence, experimental validation, uncertainty, readiness, CAD invalidation, and evidence graph contracts.
- [x] Phase 5.1: Implement project-isolated hash-tracked immutable material evidence, material property provenance/conflict detection, adapter capability negotiation, and stale CAD-context detection.
- [x] Phase 5.1: Implement experimental validation plans, explicit uncertainty assessment, evidence graphs, strengthened readiness gates, experimental review, and self-critique without numerical-result claims.
- [x] Phase 5.1: Expose capability-safe project-isolated evidence, experimental-plan, readiness, invalidation, graph, review, critique, and solver-adapter APIs without adding a solver.
- [x] Phase 5.1: Extend the mobile CAE workspace with Material Evidence, Solver, Experimental Validation, Evidence Graph, uncertainty, readiness, stale-context, and truth-status controls.
- [x] Phase 5.1: Add deterministic adapter versioning/capability, evidence/provenance/conflict, experiment, uncertainty, readiness, CAD invalidation, graph, review, critique, no-solver, TypeScript, and full-regression tests.
- [x] Phase 5.1: Save a verified checkpoint and report solver adapters, material evidence, experiments, evidence graph, uncertainty, readiness, invalidation, UI, tests, and limits without starting Phase 6.

- [x] Phase 5.2: Audit existing CAE evidence, material conflict, experiments, uncertainty, graph, storage, APIs, persistent memory, tests, and mobile workspace seams for evidence reconciliation and calibration extensions.
- [x] Phase 5.2: Define material reconciliation/review, measured dataset/metadata, calibration, data quality, processing lineage, comparison, calibration candidate, graph, and signed adapter onboarding contracts.
- [x] Phase 5.2: Implement project-isolated immutable material reconciliation with unit normalization, condition/conflict detection, explicit human review decisions, measured dataset ingestion, data quality, calibration, and processing provenance.
- [x] Phase 5.2: Implement experiment-to-measurement links, no-value-fabrication comparison contracts, calibration candidates, extended evidence graph links, and signed external-solver registration gates.
- [x] Phase 5.2: Expose capability-safe project-isolated APIs for reconciliation, decisions, datasets, calibration, comparisons, graph inspection, and non-executable adapter registration.
- [x] Phase 5.2: Extend the mobile CAE workspace with prominent Material Evidence Review, measured-data, calibration, comparison, decision, graph, and adapter-onboarding controls.
- [x] Phase 5.2: Add deterministic reconciliation, normalization, condition, human-review, dataset immutability/quality, calibration, provenance, comparison, graph, adapter-gate, TypeScript, and full-regression tests.
- [x] Phase 5.2: Save a verified checkpoint and report material reconciliation, measurement, calibration, comparison, evidence graph, signing/onboarding security, UI, tests, and limits without starting Phase 6.

- [x] Phase 5.3: Audit current adapter registration, engineering decision, calibration evidence, persistent memory, graph, APIs, tests, and mobile workspace seams for trust and revocation extensions.
- [x] Phase 5.3: Define reviewer identity, authorization, certificate verification, adapter trust-gate, manifest/capability, permission, sandbox, revocation, eligibility, and immutable audit-event contracts.
- [x] Phase 5.3: Implement project-isolated reviewer identity and authorization, certificate attachment/validation, adapter verification, capability and permission checks, sandbox declarations, immutable audit, revocation, and non-executable eligibility.
- [x] Phase 5.3: Extend the evidence graph with reviewer, decision, evidence, adapter, verification, and eligibility links while preserving historical records through revocation.
- [x] Phase 5.3: Expose capability-safe project-isolated trust, identity, certificate, verification, approval, eligibility, revocation, audit, and graph APIs without any solver or executable adapter endpoint.
- [x] Phase 5.3: Build a mobile Solver Trust panel with explicit verification/revocation states, reviewer controls, certificate controls, permissions, sandbox, audit, and non-executable eligibility controls.
- [x] Phase 5.3: Add deterministic identity, authorization, certificate, expiry, manifest tamper, signature, capability, permission, revocation, audit, eligibility, TypeScript, and full-regression tests.
- [x] Phase 5.3: Save a verified checkpoint and report identity, approvals, certificates, adapter trust, capabilities, permissions, sandboxing, revocation, audit, UI, tests, and no-solver limits without starting Phase 6.

- [x] Phase 5.4: Audit Phase 5.3 reviewer, certificate, adapter trust, revocation, audit, graph, API, test, and mobile implementation seams for final fail-closed execution-trust requirements.
- [x] Phase 5.4: Define versioned external identity, revocation-source, sandbox attestation, gate evidence, multi-gate trust readiness, fail-closed eligibility, and security benchmark contracts.
- [x] Phase 5.4: Implement project-isolated immutable external identity evidence, independently verified revocation sources, certificate revocation status, sandbox attestation evidence/verification, audit events, and revocation lifecycle.
- [x] Phase 5.4: Implement explicit evidence-backed multi-gate trust evaluation, fail-closed rules, execution trust graph links, security invariants, and permanently non-executable results.
- [x] Phase 5.4: Expose capability-safe project-isolated identity, revocation-source, attestation, verification, readiness, benchmark, audit, and graph APIs without adding any execution endpoint.
- [x] Phase 5.4: Build a mobile Trust Readiness view showing PASS/FAIL/UNKNOWN states for identity, signature, capabilities, permissions, certificate, reviewer, sandbox, revocation, and eligibility.
- [x] Phase 5.4: Add deterministic trust acceptance and security-benchmark tests for all required positive/negative states, fail-closed invariants, restoration evidence, audit integrity, TypeScript, and full regression.
- [x] Phase 5.4: Save a verified checkpoint and report identity verification, revocation evidence, sandbox attestation, trust model, fail-closed behavior, security invariants, benchmark, UI, regression, and no-execution limits before stopping.

- [x] Phase 6.0: Define a review-only future solver-execution runtime architecture with explicit CAD-AI, CAE Agent, Adapter, Execution Manager, Sandbox, Solver, Result Collector, Result Verification, and Evidence Graph boundaries.
- [x] Phase 6.0: Define a hostile threat model, deny-by-default permission model, enforceable resource boundaries, sandbox requirements, versioned input/output contracts, and result-trust requirements without enabling execution.
- [x] Phase 6.0: Define result verification, failure preservation, reproducibility, human approval gates, pre-execution security test plan, and fail-closed RUNTIME_NOT_APPROVED decision contracts.
- [x] Phase 6.0: Implement deterministic project-isolated review-only policy records, architecture APIs, immutable evidence/graph links, and no-execution security invariants.
- [x] Phase 6.0: Build a mobile Runtime Architecture Review workspace that renders all required security decisions and prominently displays RUNTIME_NOT_APPROVED.
- [x] Phase 6.0: Add review-only acceptance tests, run TypeScript and full regression, save a checkpoint, report the readiness decision, and stop without Phase 7 or execution implementation.

- [x] Phase 6.1: Define a versioned capacity-policy contract covering CPU, memory, disk, timeout, input/output size, process, and concurrent-job limits with unknown-safe infrastructure evidence.
- [x] Phase 6.1: Implement deterministic within-limit, exceeds-limit, and unknown-limit checks where unknown is never safe.
- [x] Phase 6.1: Define a concrete sandbox-design proposal, independent-attestation evidence, hostile attack-simulation contracts, security invariants, multidimensional assurance score, and constrained readiness decision without execution approval.
- [x] Phase 6.1: Implement project-isolated immutable readiness records, audit and graph links, capability-safe APIs, and fail-closed evaluation without solver, mesher, shell, plugin, network, process, credential, or arbitrary-filesystem execution.
- [x] Phase 6.1: Build a mobile Runtime Readiness dashboard that exposes capacity, sandbox, attestation, threat coverage, tests, unknowns, decision, and missing-evidence states.
- [x] Phase 6.1: Add deterministic acceptance tests, run TypeScript and full regression, save a verified checkpoint, report readiness, and stop without Phase 7 or runtime implementation.

- [x] Phase 6.2: Define versioned external infrastructure-evidence, independent sandbox-review, isolated hostile-test environment, test-evidence provenance, lifecycle, contradiction, gate, and readiness contracts without fabricating verification.
- [x] Phase 6.2: Implement immutable project-isolated external-evidence imports with original hashes, source provenance, verification states, expiration, revocation, supersession, and independent review records.
- [x] Phase 6.2: Implement fail-closed actual-evidence readiness evaluation, isolated hostile-test environment checks, individual external-evidence gates, audit and graph links, and capability-safe APIs without execution paths.
- [x] Phase 6.2: Build an External Verification mobile workspace showing infrastructure evidence, sandbox review, hostile-test evidence, provenance, expiration, open gaps, gate states, and readiness.
- [x] Phase 6.2: Add deterministic evidence, lifecycle, expiration, restore, contradiction, isolation, readiness, no-execution, TypeScript, and full-regression acceptance tests; save a verified checkpoint and stop without Phase 7.

- [x] Phase 6.3: Define versioned independent review, reviewer-separation policy, segregated test-environment evidence import, retention, reviewer-revocation, immutable lifecycle, conflict, audit, and readiness contracts without execution capability.
- [x] Phase 6.3: Implement immutable project-isolated review workflow records, explicit self-review prevention, no-anonymous verification, review revisioning, retention and revocation policies, lifecycle events, conflicts, and segregated test-environment evidence references.
- [x] Phase 6.3: Implement fail-closed readiness recalculation, reviewer-revocation behavior, authorized conflict-resolution workflow, immutable audit records, evidence graph links, and capability-safe APIs without solver, mesher, shell, plugin, process, network, filesystem, or credential execution.
- [x] Phase 6.3: Build a mobile Verification Governance workspace showing review queue, reviewer status, evidence lifecycle, retention, revocation, conflicts, readiness, and unknown-safe gate states.
- [x] Phase 6.3: Add deterministic separation, self-review, revocation, expiration, retention, conflict, isolation, audit, readiness, no-execution, TypeScript, and full-regression acceptance tests; save a verified checkpoint and stop without Phase 7.
