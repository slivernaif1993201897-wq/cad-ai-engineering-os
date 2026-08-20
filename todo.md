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
- [ ] Phase 3: Save a verified checkpoint and report final commands, test results, and performance observations.
