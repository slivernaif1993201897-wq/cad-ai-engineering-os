# Controlled User-Job Closure Report

## Current Commit and Execution Scope

| Field | Value |
|---|---|
| **LAST_VALIDATED_EXECUTION_COMMIT** | `31e3429c8a9a859c26903ddfb4e70999a192ff92` |
| **Fixed benchmark run** | [`32537299715`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32537299715), successful fixed repository benchmark. |
| **Controlled admission run** | [`32538823235`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32538823235), successful immutable-manifest validation only. |
| **Admission result** | `BLOCKED`; `executionStarted: false`; `genericSolverExecutionStarted: false`. |
| **Internal generic Docker run** | [`32542564434`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32542564434), successful repository-controlled Docker fixture. |
| **Generic execution result** | `INTERNAL_TEST_COMPLETED`; `executionStarted: true`; `genericSolverExecutionStarted: true`; solver exit code `0`. |
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
| **GENERIC_USER_JOB_STATUS** | **PASS — INTERNAL FIXTURE ONLY** | Run `32542564434` passed sandbox preflight, ran the static OpenCascade STEP → Gmsh → CalculiX chain, independently verified the mesh, passed the declared numerical comparator, and wrote a hash-bound result. This does not admit production execution. |

## Successful Generic Docker Evidence

Run `32542564434` executed only the checked-in, immutable `GENERIC-CANTILEVER-USER-JOB-001` fixture. The workflow accepted neither generic user input nor arbitrary command text, as recorded in its execution summary. Its environment was identified as `GITHUB-DOCKER-INTERNAL-TEST-32542564434-1`.

| Evidence item | Observed result | Scope and limit |
|---|---|---|
| Sandbox preflight | **PASS** for read-only root and input, writable `/work`, `/tmp`, and confined `/output`, non-root UID/GID 65534, zero effective capabilities, no default route, no common CI secret variables, absent common credential paths, PID/mount/network namespaces, cgroup limits, timeout, and output-storage enforcement. | Controls were observed inside this one GitHub-hosted Docker execution. They are not independent platform attestation. |
| Resource observations | `cpu.max = 100000 100000`; `memory.max = 536870912`; `pids.max = 256`; timeout probe exited `124`; 80 MiB output write was rejected under the configured 64 MiB file-size policy. | Demonstrates configured container controls, not host-kernel or multi-tenant isolation assurance. |
| Generic solver receipt | `INTERNAL_TEST_COMPLETED`, `executionStarted: true`, `genericSolverExecutionStarted: true`, exit code `0`; elapsed time `0.16099` seconds and max RSS `45444` KiB. | Internal fixture only. |
| Mesh verification | **PASS**; 470 nodes, 1,417 tetrahedra, zero negative-orientation elements, zero degenerate elements, and expected 20 × 10 × 80 mm bounds. | Fixture geometry only. |
| Numerical validation | **PASS**; mean loaded-face z displacement `0.0015339667857142858` mm against `0.0015238095238095239` mm reference; relative error `0.006665703125000055` within declared `0.30` internal-fixture tolerance. | The tolerance is explicitly limited to `INTERNAL_GENERIC_CANTILEVER_BENCHMARK_ONLY`. |
| Result integrity | **PASS** result binding `4a919aff779843de623ca0c5dc2cbbdcfcfaf8203dcecb32683cda3228a74a6c` binds manifest, CAD, CAE, material, load, boundary conditions, mesh, solver binaries, configuration, preflight environment, solver input, FRD result, log, mesh validation, and numerical validation. | Binding validates this retained fixture artifact set, not a production result service. |

## Runtime-Gate Matrix

| Required field | Status | Exact evidence or dependency |
|---|---|---|
| **APPROVED_ENVIRONMENT** | **BLOCKED** | GitHub-hosted runner is observed, not independently approved as a project execution environment. |
| **REAL_SANDBOX** | **PARTIAL — OBSERVED INTERNAL DOCKER ONLY** | Run `32542564434` observed filesystem, privilege, namespace, network-route, secret-path, and timeout controls inside Docker. The GitHub-hosted platform and host kernel are not independently attested. |
| **ESCAPE_RESISTANCE** | **BLOCKED** | No authorized defensive escape-resistance exercise or independent sandbox assessment exists. |
| **RESOURCE_ISOLATION** | **PARTIAL — OBSERVED INTERNAL DOCKER ONLY** | The run observed 1 CPU, 512 MiB memory, 256 PIDs, timeout, and output-size enforcement. These controls do not establish independent host-level or multi-tenant isolation. |
| **GMSH** | **PASS — FIXED BENCHMARK AND INTERNAL GENERIC FIXTURE ONLY** | Real Gmsh execution with provenance exists in fixed run `32537299715` and generic internal run `32542147910`. |
| **CALCULIX** | **PASS — FIXED BENCHMARK AND INTERNAL GENERIC FIXTURE ONLY** | Real CalculiX execution with provenance exists in fixed run `32537299715` and generic internal run `32542147910`. |
| **MESH_VERIFICATION** | **PASS — FIXTURE SCOPE ONLY** | Independent mesh-verifier outputs are retained for both the fixed benchmark and generic internal fixture. |
| **NUMERICAL_VALIDATION** | **PASS — FIXTURE SCOPE ONLY** | Fixed axial-bar and generic cantilever comparators passed their explicitly non-production tolerances. |
| **RESULT_INTEGRITY** | **PASS — INTERNAL FIXTURE ONLY** | Generic run `32542564434` retained a cryptographic result binding and a tamper validation; production environment and service bindings remain absent. |
| **FAILURE_RECOVERY** | **BLOCKED** | No approved-environment failure recovery exercise exists. |
| **REPRODUCIBILITY** | **PARTIAL** | Fixed benchmark and manifest are deterministic in source; no independent approved-environment repeatability exercise exists. |
| **HOSTILE_SECURITY_TESTING** | **BLOCKED** | Defensive tests are prohibited until an approved sandbox scope is authorized. |
| **INDEPENDENT_SECURITY_REVIEW** | **PENDING** | No independent security assessor evidence is attached. |
| **INTERNAL_EVIDENCE_REVIEW** | **PENDING** | Manus supplies implementation, execution, and retained evidence; the user and assistant review the evidence internally. This is not labeled as an external review. |
| **PRODUCTION_RUNTIME** | **BLOCKED** | Mandatory approved-environment, sandbox, security, result, recovery, and external-review evidence is incomplete. |

## Tests Executed

| Field | Result |
|---|---|
| **TESTS_EXECUTED** | Successful generic Docker workflow `32542564434`, its preflight/result/tamper validators, full deterministic `pnpm test`, targeted `controlled-user-job-manifest.test.ts`, manifest validator, TypeScript check, and Expo lint. |
| **TESTS_PASSED** | Generic Docker preflight, actual Gmsh/CalculiX execution, mesh verification, numerical validation, result binding, and tamper validation all passed in `32542564434`. The post-run full per-file regression and TypeScript check completed successfully. |
| **TESTS_FAILED** | 0 in the successful generic Docker workflow and post-run deterministic regression. |
| **TESTS_UNKNOWN** | Aggregate assertion total for the full per-file runner is not emitted by the existing runner script; no unobserved aggregate count is claimed. |
| **LINT** | Completed with 0 errors and 5 pre-existing warnings in unrelated UI files. |

## Internal Repair Applied

The first admission workflow run, `32538702664`, failed before validation because the process cap was too small for the ambient GitHub-hosted runner baseline: `timeout` could not fork. The workflow and manifest policy were repaired from 32/64 to a bounded 256-process cap, the manifest hash was recalculated, local tests passed, and retry `32538823235` succeeded. This repair preserved the workflow’s validation-only boundary and did not start a solver.

## Evidence Created

The following evidence documents and artifacts were added or updated: fixed benchmark reference evidence, GitHub-hosted sandbox decision, controlled user-job manifest design, manifest fixture, blocked admission receipt, successful Docker preflight, solver receipt, raw CalculiX FRD output, mesh and numerical validators, result binding, receipt/log hash manifests, GitHub execution reports, and this closure report. The artifact hash checks passed for the blocked admission receipt in run `32538823235` and the internal generic Docker evidence in run `32542564434`.

## Exact Remaining Blockers and External Dependencies

The remaining production dependencies are not satisfied by the successful internal fixture. The project still requires an authorized and separately controlled execution environment; independently attested kernel-backed resource, process, filesystem, privilege, network, environment, and workspace isolation; approved Gmsh and CalculiX provenance in that environment; a canonical user-job admission dispatcher outside the application process; production numerical validation with justified tolerances; recovery and repeatability exercises; authorization for defensive sandbox testing; independent security assessment; and documented internal evidence review by the user and assistant.

> **FINAL_READINESS = BLOCKED.** The fixed benchmark and the repository-controlled generic Docker fixture are real, retained, and independently validated within their declared internal scopes. They do not constitute production admission; unobserved or unapproved gates remain blocked rather than inferred.
