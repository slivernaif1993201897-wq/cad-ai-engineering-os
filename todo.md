# Project TODO

- [x] Audit existing runtime-evidence HMAC contracts, explicit environment validation, secret exposure controls, and conditional test skip logic.
- [x] Implement deterministic fail-closed HMAC evidence binding and independent verification only where the current contract is incomplete.
- [x] Add explicit-key HMAC tests for valid, missing, invalid, tampered, mismatched, stale, replayed, schema-incompatible, and deterministic serialization cases.
- [x] Classify and clean the release worktree; retain reproducible runtime manifests/bootstrap scripts and remove only temporary or generated non-repository artifacts.
- [ ] Run final quality, security scan, governance gates, and one-worker regression; create a release commit and checkpoint only if all gates pass.

- [x] Freeze the current release-candidate worktree and capture its exact commit, branch, status, changed files, untracked files, and runtime identities.
- [x] Recompute STEP/OpenCascade governance inventory and run all required CAD/CAE/CAM acceptance guards without modifying production architecture.
- [x] Run one complete one-worker serial regression, classify every skipped test, and calculate checkpoint eligibility without creating a checkpoint.
- [x] Deliver the final release-candidate acceptance report and stop further work.

- [ ] Diagnose the CAD-Agent Hole rejection after admission migration and restore its prior authorized result lifecycle without bypassing admission.
- [ ] Diagnose the Circular Pattern admission-capacity failure and remove only unintended overlapping kernel work without increasing capacity.
- [ ] Rerun the two failed tests, governance guards, and one-worker serial regression after the admission fixes.

- [x] Produce a current machine-readable OpenCascade/STEP governance inventory with admission, resource owner, cleanup, exporter, and executor classification.
- [x] Replace all local authoritative STEP writers in feature history, Mirror, rectangular pattern, and Seat CAD paths with exportValidatedStep only.
- [x] Place every direct production OpenCascade acquisition under the sole inherited-context-safe admission boundary and preserve cleanup-before-release ordering.
- [x] Strengthen zero-bypass inventory and architectural guards to reject local STEP writers, unadmitted kernel acquisition, unknown paths, and stale inventory.
- [x] Add failure and governance tests for exporter, STEP import, B-Rep, tessellation, ingestion, post-validation, permit release, and no partial persistence.
- [x] Run all ordered acceptance gates and one-worker serial regression; do not create a checkpoint automatically.

- [ ] Resume the interrupted CAD/CAE/CAM focused acceptance suite with one worker, then run final quality and serial regression without architectural changes.

- [x] Perform a fresh final CAD/CAE/CAM acceptance audit, including STEP-writer and OpenCascade-path discovery, without modifying production architecture.
- [x] Run the final focused lifecycle gates and one-worker serial regression, then report all PASS, FAIL, and NOT_PROVEN results without checkpoint creation.

- [ ] Run the final Gmsh, CalculiX, CAM, CAD/STEP, admission, zero-bypass, and source-inventory acceptance gate without changing production behavior.
- [ ] Publish a single factual engineering-engine acceptance matrix and do not create a checkpoint automatically.

- [x] Verify the current allowlisted local Gmsh implementation, resource admission, cleanup, managed-artifact lifecycle, and Gmsh-to-CalculiX integration.
- [x] No reproduced Gmsh/CalculiX integration gap required repair; rerun focused gates and one-worker regression without creating a checkpoint automatically.

- [x] Package the verified pinned external CAD runtime restoration and fail-closed verification workflow as a reusable skill.

- [x] Verify the exact upstream text-to-CAD source revision, adapter-owned CLI location, Python runtime, and pinned package versions required by the existing adapter.
- [x] Restore the adapter-owned external source/runtime only if its pinned revision and package inputs can be verified reproducibly.
- [x] Add deterministic dependency discovery that reports a reset/missing runtime fail-closed without weakening source-revision or executable validation.
- [x] Run the real external text-to-CAD adapter path, verify the managed STEP artifact hash/provenance/lineage, then rerun focused and full one-worker regression gates.

- [x] Verify a real local CAM runtime/toolpath engine and its supported controller output without inferring availability from configuration.
- [x] Implement durable bounded tool and stock definitions with explicit units, IDs, physical parameter validation, and CAM-job binding.
- [x] Generate deterministic facing, pocket, and contour toolpaths from server-resolved CAD geometry with envelope validation.
- [x] Implement one controlled post processor and G-code syntax/coordinate/feed/spindle/unit/termination validation.
- [x] Persist validated CAM artifact hashes, provenance, and lineage through the existing managed lifecycle only.
- [x] Add real CAM fixture, invalid-input, boundary, failure, timeout, cleanup, and authorization tests.
- [x] Run typecheck, lint, CAM tests, zero-bypass guards, and a one-worker serial regression; never create a checkpoint automatically.

- [x] Verify whether the allowlisted local CalculiX executable can be installed and probed without substituting another solver.
- [x] Implement deterministic CalculiX discovery, server-built input validation, isolated execution, and fail-closed result validation.
- [x] Integrate real managed CAD/mesh artifacts with CalculiX input/result hashes, CAE evidence, and immutable lineage.
- [x] Add real CalculiX smoke, malformed-output, timeout, failure, cleanup, permit-release, and capacity tests.
- [x] Re-run quality, zero-bypass, architectural, and one-worker serial regression gates; do not checkpoint unless all applicable gates pass.

- [ ] Identify the exact pinned external text-to-CAD dependency absent from the sandbox and capture its required source revision and executable contract.
- [ ] Restore only the adapter-owned pinned dependency if it is reproducibly available; otherwise retain DEPENDENCY_MISSING fail-closed behavior.
- [ ] Re-run the affected text-to-CAD test and the necessary regression gates without changing the Gmsh implementation.

- [x] Verify the restored baseline worktree and whether a local Gmsh executable can be installed and executed safely.
- [x] Implement allowlisted local Gmsh discovery with explicit availability, invalid, and execution-failure states.
- [x] Implement a server-only Gmsh adapter using controlled temporary directories, strict limits, timeout, output validation, and finally cleanup.
- [x] Bind real generated mesh evidence to the existing managed artifact/provenance lifecycle without bypassing CAD controls.
- [x] Add focused Gmsh discovery, execution, malformed-input, timeout, cleanup, and mesh-validation tests.
- [x] Run typecheck, lint, Gmsh tests, zero-bypass guards, and one-worker serial regression; report actual engine availability without automatic checkpoint creation.

- [x] Audit current CAE, evidence, provenance, report, API, and UI contracts for existing verification semantics and available reference evidence.
- [x] Add a durable verification record with separated computational, numerical, model-validation, experimental-correlation, engineering-acceptance, and regulatory-certification states.
- [x] Implement deterministic numerical verification checks and explicit criterion-bound mesh-convergence reference cases without universal fabricated tolerances.
- [x] Bind immutable verification reports to CAD revision, CAE artifacts, provenance, lineage, and runtime evidence; expose the result without collapsing claim states.
- [x] Add deterministic positive and fail-closed tests for units, materials, numerical checks, convergence, evidence, stale/mismatched lineage, and claim governance.
- [x] Run quality, security, governance, and one-worker full-regression gates; report actual framework coverage without physical-safety or regulatory claims.

- [x] Re-analyze the supplied Crash/Occupant Safety order and the restored baseline to identify the implementation lost during sandbox reset.
- [x] Restore the evidence-bound Crash/Occupant Safety contracts, analysis service, and immutable project record without fabricating physical inputs or safety claims.
- [x] Restore authorized API/report/UI integration and deterministic fail-closed tests for crash safety evidence.
- [x] Re-run quality, governance, security, and one-worker regression gates before any new checkpoint request.

- [x] Define CAPRE durability classes, safe snapshot inventory, secret exclusions, and staging-only restoration contract.
- [x] Create content-specific CAPRE mobile interface design for one-handed operations and explicit destructive-action confirmation.
- [x] Build deterministic CAPRE discovery, capture, verification, sealing, listing, inspection, and staging restoration operations.
- [x] Connect CAPRE safe operations, state, and recovery reports to authorized API and mobile interface.
- [x] Add CAPRE failure-injection and staging-restore tests, then run quality, governance, and serial-regression gates.

- [x] Audit all actually authorized durable storage targets and reset-survival evidence; report UNAVAILABLE rather than infer durability.
- [x] Define CAPRE protection classes that distinguish local snapshots from complete durable recovery of database and managed artifact bytes.
- [ ] Harden CAPRE capture/restore identity, atomicity, immutability, and staging verification only where complete authoritative exports exist.
- [ ] Add durable-storage and complete-recovery failure-injection tests, then re-run CAPRE and release gates without checkpoint creation.

- [x] Define deterministic recovery-capsule contracts, canonical payload manifest, secret exclusions, and EXTERNAL_REQUIRED completeness states.
- [x] Build the CAPRE recovery-capsule generator, independent parser/verifier, and staging-only decoder without modifying the live project.
- [x] Inventory source, Git state, engine identities, database/artifact recovery feasibility, and declare every non-exportable authoritative payload explicitly.
- [ ] Connect only safe capsule creation/download metadata to the mobile recovery surface with no secret or live-restore operation.
- [x] Add capsule generation, tampering, parser, secret-exposure, and isolated-restore tests before rerunning release gates.
