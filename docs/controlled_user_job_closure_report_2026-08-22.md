# Controlled User-Job Closure Report

## Current Commit and Execution Scope

| Field | Value |
|---|---|
| **CURRENT_EXECUTION_COMMIT** | `8be7abde86094169b4858acf2f1001bf39146961` |
| **Fixed benchmark run** | [`32537299715`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32537299715), successful fixed repository benchmark. |
| **Controlled admission run** | [`32538823235`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32538823235), successful immutable-manifest validation only. |
| **Admission result** | `BLOCKED`; `executionStarted: false`; `genericSolverExecutionStarted: false`. |
| **Secret metadata** | `UNKNOWN`; GitHub returned HTTP 403 for repository secret metadata. No secret value or name was accessed. |

## What Was Added

The repository now contains a strict immutable controlled user-job manifest and canonical serializer, a fail-closed admission evaluator, a checked-in manifest fixture, four regression cases, a validation-only GitHub workflow, and a retained admission receipt. The contract has no command, executable-path, filesystem-path, network-destination, environment-variable, image-override, or arbitrary artifact-path field. Any unknown field, malformed hash, stale authorization, non-allowlisted solver version, or manifest-hash mismatch is rejected.

The external workflow uses no workflow-dispatch inputs. It validates only the checked-in fixture, writes a receipt, asserts that no generic solver job started, and uploads the receipt, log, and hash manifest. It does not invoke Gmsh or CalculiX for the user-job fixture.

## Fixed Benchmark Status

| Category | Status | Evidence |
|---|---|---|
| **FIXED_BENCHMARK_GMSH** | **PASS** | Successful run `32537299715`, observed Gmsh 4.12.1, retained log and artifact hashes. |
| **FIXED_BENCHMARK_MESH_VERIFICATION** | **PASS** | Retained mesh-verification record: 87 nodes, 204 tetrahedra, valid connectivity, zero negative-orientation and degenerate elements. |
| **FIXED_BENCHMARK_CALCULIX** | **PASS** | Successful run `32537299715`, observed CalculiX 2.21, retained solver log and artifact hashes. |
| **FIXED_BENCHMARK_NUMERICAL_VALIDATION** | **PASS — BENCHMARK ONLY** | Axial-bar displacement comparison passed the explicitly non-production benchmark tolerance. |
| **GENERIC_USER_JOB_STATUS** | **BLOCKED** | Successful run `32538823235` produced a signed-by-hash admission receipt with `GITHUB_HOSTED_SANDBOX_INSUFFICIENT`, `APPROVED_EXECUTION_ENVIRONMENT_REQUIRED`, and `EXECUTION_ENGINE_NOT_IMPLEMENTED`. |

## Runtime-Gate Matrix

| Required field | Status | Exact evidence or dependency |
|---|---|---|
| **APPROVED_ENVIRONMENT** | **BLOCKED** | GitHub-hosted runner is observed, not independently approved as a project execution environment. |
| **REAL_SANDBOX** | **BLOCKED** | No observed filesystem, privilege, process, network, or environment isolation attestation exists. |
| **ESCAPE_RESISTANCE** | **BLOCKED** | No approved sandbox exists for authorized defensive escape testing. |
| **RESOURCE_ISOLATION** | **BLOCKED** | Workflow limits are bounded validation controls; runner base limits do not prove independent CPU, memory, storage, or process isolation. |
| **GMSH** | **PASS — FIXED BENCHMARK ONLY** | Actual Gmsh execution with provenance exists; no approved generic user-job environment exists. |
| **CALCULIX** | **PASS — FIXED BENCHMARK ONLY** | Actual CalculiX execution with provenance exists; no approved generic user-job environment exists. |
| **MESH_VERIFICATION** | **PASS — FIXED BENCHMARK ONLY** | Independent mesh verifier output is retained for the fixed benchmark. |
| **NUMERICAL_VALIDATION** | **PASS — FIXED BENCHMARK ONLY** | Closed-form axial-bar comparator passed a declared benchmark tolerance. |
| **RESULT_INTEGRITY** | **PARTIAL** | Fixed benchmark and blocked admission artifacts are hash-bound; canonical user-job result and approved-environment bindings are absent. |
| **FAILURE_RECOVERY** | **BLOCKED** | No approved-environment failure recovery exercise exists. |
| **REPRODUCIBILITY** | **PARTIAL** | Fixed benchmark and manifest are deterministic in source; no independent approved-environment repeatability exercise exists. |
| **HOSTILE_SECURITY_TESTING** | **BLOCKED** | Defensive tests are prohibited until an approved sandbox scope is authorized. |
| **INDEPENDENT_SECURITY_REVIEW** | **PENDING_EXTERNAL_REVIEW** | No independent security assessor evidence is attached. |
| **EXTERNAL_REVIEW** | **PENDING_EXTERNAL_REVIEW** | No independent engineering-review decision is attached. |
| **PRODUCTION_RUNTIME** | **BLOCKED** | Mandatory approved-environment, sandbox, security, result, recovery, and external-review evidence is incomplete. |

## Tests Executed

| Field | Result |
|---|---|
| **TESTS_EXECUTED** | Full deterministic `pnpm test`, targeted `controlled-user-job-manifest.test.ts`, manifest validator, TypeScript check, and Expo lint. |
| **TESTS_PASSED** | The full per-file regression completed successfully; the new targeted manifest suite passed 4 of 4 tests; manifest validator emitted the expected blocked receipt; TypeScript completed with zero errors. |
| **TESTS_FAILED** | 0 after the internal workflow process-cap repair. |
| **TESTS_UNKNOWN** | Aggregate assertion total for the full per-file runner is not emitted by the existing runner script; no unobserved aggregate count is claimed. |
| **LINT** | Completed with 0 errors and 5 pre-existing warnings in unrelated UI files. |

## Internal Repair Applied

The first admission workflow run, `32538702664`, failed before validation because the process cap was too small for the ambient GitHub-hosted runner baseline: `timeout` could not fork. The workflow and manifest policy were repaired from 32/64 to a bounded 256-process cap, the manifest hash was recalculated, local tests passed, and retry `32538823235` succeeded. This repair preserved the workflow’s validation-only boundary and did not start a solver.

## Evidence Created

The following evidence documents and artifacts were added or updated: fixed benchmark reference evidence, GitHub-hosted sandbox decision, controlled user-job manifest design, manifest fixture, blocked admission receipt, receipt/log hash manifest, GitHub execution report, and this closure report. The artifact hash check passed for both receipt and validation log from run `32538823235`.

## Exact Remaining Blockers and External Dependencies

The remaining work is external rather than internally repairable. The project requires an authorized and separately controlled execution environment; observed kernel-backed resource, process, filesystem, privilege, network, environment, and workspace isolation; approved Gmsh and CalculiX provenance in that environment; a canonical user-job admission dispatcher outside the application process; canonical job/result bindings; production numerical validation with justified tolerances; recovery and repeatability exercises; authorization for defensive sandbox testing; and independent security and engineering review.

> **FINAL_READINESS = BLOCKED.** The fixed benchmark is real and retained. The generic user-job contract is now real, immutable, tested, and intentionally blocked on the GitHub-hosted runner. Production readiness is not manufactured.
