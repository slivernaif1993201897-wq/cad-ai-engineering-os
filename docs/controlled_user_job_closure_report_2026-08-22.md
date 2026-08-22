# Controlled User-Job Closure Report

## Current Commit and Execution Scope

| Field | Value |
|---|---|
| **LAST_VALIDATED_EXECUTION_COMMIT** | `ee95327a3133bd7a7b721de08547e4d94c036879` |
| **Fixed benchmark run** | [`32537299715`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32537299715), successful fixed repository benchmark. |
| **Controlled admission run** | [`32538823235`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32538823235), successful immutable-manifest validation only. |
| **Admission result** | `BLOCKED`; `executionStarted: false`; `genericSolverExecutionStarted: false`. |
| **Internal generic Docker run** | [`32542564434`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32542564434), successful repository-controlled Docker fixture. |
| **Generic execution result** | `INTERNAL_TEST_COMPLETED`; `executionStarted: true`; `genericSolverExecutionStarted: true`; solver exit code `0`. |
| **Authoritative CAD Agent Docker run** | [`32545661036`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32545661036), successful real CAD-Agent-generated OpenCascade revision through the same Docker path. |
| **CAD Agent execution result** | `INTERNAL_TEST_COMPLETED`; `executionStarted: true`; `genericSolverExecutionStarted: true`; all required source, solver, environment, input, output, log, and result hashes bound. |
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
| **GMSH** | **PASS — INTERNAL CAD AGENT SCOPE ONLY** | Run `32545661036` generated a validated CAD Agent STEP artifact and executed real Gmsh 4.12.1; its static malformed-GEO exercise retained `GMSH_FAILED_1`. |
| **CALCULIX** | **PASS — INTERNAL CAD AGENT SCOPE ONLY** | Run `32545661036` executed real CalculiX 2.21; its missing-input exercise retained `CALCULIX_FAILED_201`. |
| **MESH_VERIFICATION** | **PASS — INTERNAL CAD AGENT SCOPE ONLY** | Independent meshio connectivity, orientation, degeneracy, and bounds validation passed against the real 100 × 50 × 20 mm CAD Agent artifact; corrupted mesh input was rejected as `INVALID_MESH_REJECTED`. |
| **NUMERICAL_VALIDATION** | **PASS — INTERNAL CAD AGENT SCOPE ONLY** | The x-axis F·L/(E·A) comparison passed the declared 0.30 internal tolerance for the CAD Agent artifact. |
| **RESULT_INTEGRITY** | **PASS — INTERNAL CAD AGENT SCOPE ONLY** | Run `32545661036` bound job, manifest, CAD revision/artifact, CAE configuration, Gmsh, mesh, CalculiX, environment, input, output, log, and result hashes; stale job/CAD, mesh, solver, configuration, input, and output mutations were rejected. |
| **FAILURE_RECOVERY** | **PARTIAL — INTERNAL DOCKER ONLY** | The same run retained controlled Gmsh, CalculiX, timeout, CPU-limit, memory-limit, storage-limit, invalid-input, invalid-mesh, corrupted-artifact, and partial-output failure outcomes. No approved-environment recovery exercise exists. |
| **REPRODUCIBILITY** | **PARTIAL** | The CAD Agent source, immutable manifest builder, static image, controlled exercises, and preserved run `32542564434` baseline are versioned; no independently approved-environment repeatability exercise exists. |
| **HOSTILE_SECURITY_TESTING** | **PARTIAL — STATIC INTERNAL CONTROLS ONLY** | Admission and artifact tamper rejection, fixed solver/command surfaces, and controlled resource exercises passed. Escape-resistance and independent adversarial assessment remain blocked. |
| **INDEPENDENT_SECURITY_REVIEW** | **PENDING** | No independent security assessor evidence is attached. |
| **INTERNAL_EVIDENCE_REVIEW** | **PENDING** | Manus supplies implementation, execution, and retained evidence; the user and assistant review the evidence internally. This is not labeled as an external review. |
| **PRODUCTION_RUNTIME** | **BLOCKED** | Mandatory approved-environment, sandbox, security, result, recovery, and internal evidence-review evidence is incomplete. |

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

The remaining production dependencies are not satisfied by the successful internal CAD Agent run. The project still requires an authorized and separately controlled execution environment; independently attested kernel-backed resource, process, filesystem, privilege, network, environment, and workspace isolation; approved Gmsh and CalculiX provenance in that environment; a canonical user-job admission dispatcher outside the application process; production numerical validation with justified tolerances; recovery and repeatability exercises; authorization for defensive sandbox testing; independent security assessment; and documented internal evidence review by the user and assistant.

> **FINAL_READINESS = BLOCKED.** Run `32545661036` proves that a genuine CAD-Agent-generated, validated OpenCascade artifact can pass the immutable manifest, internal Docker sandbox, real Gmsh, independent mesh verification, real CalculiX, numerical validation, and hash-bound evidence chain. It does not constitute production admission; unobserved or unapproved gates remain blocked rather than inferred.

## Authoritative CAD Agent Runtime Evidence

Run `32545661036` generated the `CONFIG-AUTHORITATIVE-CAD-AGENT-RUNTIME-MOUNTING-BLOCK-R1` revision via the existing CAD Agent and OpenCascade.js kernel, not the preserved cantilever fixture. The job `CAD-AGENT-RUNTIME-82DE3674AB244562` bound manifest `0536d161e069efb9aba3b6cfa0041b2d1f22fb25f2591909fecc082be39febe1`, CAD revision `af1eb8bec3bd0b513a6bc255485402f982f920b54ed4f7723eeda45fee287d7c`, CAD artifact `82de3674ab244562427b2aca2ffeb2850520f575501279a54ff7bd63005a5c95`, CAE configuration `b110b8d34603e80ffdf4a1c57d7828fe0afff76e8ac2bd4655e69ad75c9dc749`, mesh `b89f77f6cd0261675858eaef498992e2a968fc79c58df0d1a27125d14d515755`, CalculiX output `f83d20b2e2c654878031b08061debb2050e6aabeb61cefd4c40ae6ff603c6b3c`, and result `ca1e280df8edb0e99c497ecdc4df7bd4c2a13605bf18e40ddfc0ae06be2c6b89`.

| Control family | Observed authoritative outcome |
|---|---|
| **CAD Agent provenance** | Validated OpenCascade configuration and real STEP artifact were generated before manifest construction. |
| **Success path** | Real Gmsh → independent mesh verification → CalculiX → numerical validation completed with both execution flags true. |
| **Binding rejection** | Stale job, stale CAD, mesh mismatch, solver mismatch, configuration mismatch, input tamper, and output tamper were all rejected by the retained host-side validator. |
| **Controlled failures** | Gmsh parser failure, CalculiX input failure, timeout, CPU signal limit, memory cgroup OOM, output-storage limit, invalid input, invalid mesh, corrupted CAD artifact, and partial output were all observed and required to fail. |
| **Baseline preservation** | Run `32542564434` and its fixed internal generic fixture remain unchanged as the permanent source-level regression baseline; the CAD Agent workflow uses the same Docker image and orchestration rather than a duplicate runtime. |

## Final Internal Evidence Refresh

| Field | Final observed evidence |
|---|---|
| **Validated implementation commit** | `c140b765f4860865cbf4cc59c19ae9bc8c13da1d` |
| **Primary retained final run** | [`32548950838`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32548950838), successful unchanged authoritative CAD Agent execution. |
| **Repeatability comparison run** | [`32548873775`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32548873775), successful execution at the same commit. |
| **Execution receipt** | `INTERNAL_TEST_COMPLETED`; `executionStarted: true`; `genericSolverExecutionStarted: true`; exit code `0`. |
| **Sandbox campaign** | 34 bounded in-container observations; 0 failures. The evidence covers static filesystem traversal, absolute-path, symlink, temporary-directory, unauthorized read/write, process-namespace, privilege, no-new-privileges, DNS, outbound, loopback, private-address, interface, runner-metadata, and fixed-executable checks. |
| **Dependency inventory** | 241 packages recorded by `dpkg-query` from the executing Docker image; SBOM hash is retained in the uploaded workflow evidence. |
| **Canonical result** | Result hash `5b1960c0834e1fbe3448e87a40b66cee97380a6d7c6d952b331b7c5e61326769` in run `32548950838`. |

The two unchanged final runs matched their **job ID, manifest, CAD revision, CAD artifact, Gmsh, mesh, CalculiX, configuration, canonical output, and canonical result hashes**. Their environment hash, execution-log hash, raw CalculiX FRD hash, and raw-solver-evidence hash differ by design because they contain run-scoped identifiers, logs, and the solver’s wall-clock output time. The runtime now retains the raw FRD as separately bound audit evidence and derives the canonical numerical result from a timestamp-normalized copy. This is a provenance-preserving repair: raw execution bytes remain available for review and are not silently discarded.

The reproducibility investigation identified two volatile metadata sources. OpenCascade STEP `FILE_NAME` wall-clock metadata caused otherwise identical CAD artifacts to hash differently, and CalculiX FRD `1UTIME` metadata caused otherwise identical numerical outputs to hash differently. The implementation normalizes only those non-engineering header fields for canonical comparison, retains raw outputs separately, and excludes generated timestamps and identifiers from the semantic CAD revision hash. No geometry, mesh, solver input, solver binary, numerical value, validation threshold, or admission control was changed.

## Internal Readiness Classification

| Classification | Status | Basis |
|---|---|---|
| **INTERNAL_RUNTIME_VERIFIED** | **PASS** | A genuine CAD Agent revision completed the immutable manifest, Docker sandbox, real Gmsh, independent mesh verification, real CalculiX, numerical validation, canonical hash binding, artifact-tamper rejection, controlled-failure suite, escape campaign, and repeatability campaign. |
| **READY_FOR_INDEPENDENT_SECURITY_ASSESSMENT** | **PASS** | Architecture, fixed command surface, manifest schema, container controls, package inventory, observed probe results, failure receipts, and retained artifact hashes are available for review. This is readiness to assess, not an assessment result. |
| **READY_FOR_EXTERNAL_REVIEW** | **PASS** | The internal evidence record is complete enough to submit for external engineering/security review. No external reviewer outcome is attached. |
| **PRODUCTION_READY** | **BLOCKED_EXTERNAL_EVIDENCE** | Internal GitHub-hosted Docker evidence cannot independently approve the production environment or substitute for external security and engineering decisions. |

## Exact Remaining External-Only Blockers

1. **Approved production environment evidence** for the exact execution platform, current approval window, identity, and provenance.
2. **Independent sandbox and escape-resistance assessment** against the approved production environment, including host/kernel and multi-tenant isolation claims.
3. **Approved production solver and dependency provenance**, including policy approval for the final image and package inventory.
4. **Production numerical acceptance criteria** with justified tolerances, domain ownership, and applicable engineering approval.
5. **Approved-environment recovery, rollback, and repeatability evidence** rather than GitHub-hosted internal evidence alone.
6. **Independent security assessment outcome** and documented user-and-assistant internal evidence review decision.

> **FINAL_READINESS = BLOCKED_EXTERNAL_EVIDENCE.** All internally actionable runtime and reproducibility work recorded here is complete at the stated commit. The remaining gates require evidence from an approved environment or independent reviewers and therefore remain blocked rather than inferred.

## CAD-to-CAE Execution Bridge Activation Evidence

| Field | Final observed evidence |
|---|---|
| **Bridge implementation commit** | `e9915cb7b5b8928aa8211bc31bc8728739a8e634` adds `buildAuthorizedRuntimeCAEConfiguration` in the existing CAE Agent source and requires its CAD revision, CAD revision hash, and STEP artifact hash before immutable manifest construction. |
| **Security completion commit** | `e919c476e3c25dec3d39c842f39f9c13a951e535` adds explicit `cae-configuration-mismatch` rejection to the existing retained-artifact validator; no second runtime or solver path was created. |
| **Authoritative real bridge run** | [`32549971601`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32549971601), successful at `e919c476e3c25dec3d39c842f39f9c13a951e535`. |
| **CAD-to-CAE binding** | CAD revision `6d8933523230cfa85e56ac39a4075fbe51b8e2d3b4211fc5feb0139e01a7eb53`, real STEP artifact `3447fa11d7c33810352e6430d9adeeceb541e72c3fc4e8f7fe7c04a99e55eea4`, CAE configuration `514fe287b1c9ceba0951d81ceae0bef5ac2abd368b14730c74d54f3f8136b0b5`, and manifest `6bcdf7e3c1a72ab346db6203681126385fc035e4b0269ef7be9ba03289cffe80` were retained together. |
| **Execution result** | `INTERNAL_TEST_COMPLETED`; `executionStarted: true`; `genericSolverExecutionStarted: true`; exit code `0`; result `24c6e283acedb1639fa9da713cf0ee41c3308cdae9990af6f232ac13228092bb`. |
| **Bridge-specific rejection** | A stale CAE Agent configuration whose CAD artifact hash was changed was rejected before immutable manifest construction as `CAE_AGENT_CAD_BINDING_INVALID`. The workflow also retained `validation-cae-configuration-mismatch`, which rejects a bound result whose CAE configuration hash is altered. |
| **Full regression** | `pnpm test`, `pnpm check`, and `pnpm lint` completed after the successful real bridge workflow. Lint completed with 0 errors and the same 5 unrelated pre-existing warnings. |

The real execution continues to use the existing admitted Docker path. The CAE Agent configuration builder produces bounded mesh, solver, material, load, boundary, and numerical-validation declarations, cryptographically tied to the validated CAD artifact; it has no direct process-launch capability. Real Gmsh, independent mesh verification, real CalculiX, numerical validation, result binding, the existing controlled-failure suite, and the expanded CAE-configuration tamper rejection all execute only after immutable admission.

## User-Managed HMAC Secret Boundary

| Field | Status | Exact evidence or dependency |
|---|---|---|
| **SECRET_MANAGEMENT_BY_MANUS** | **UNAVAILABLE — USER-MANAGED BOUNDARY** | The available repository automation identity can read repository content but GitHub rejects Actions-secret metadata administration with `HTTP 403 Resource not accessible by integration`. Manus does not retrieve, modify, or expose the secret. |
| **RUNTIME_EVIDENCE_HMAC_KEY injection** | **PRESENT, FORMAT INVALID** | Authoritative workflow [`32596381992`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32596381992) reported only: `SECRET_PRESENT=true`, `SECRET_LENGTH=64`, `HEX_FORMAT_VALID=false`, `CANONICAL_FORMAT_VALID=false`, `SECRET_SOURCE=GITHUB_ACTIONS_ENV`, and validator version `hmac-sha256/v1`. No key value, fingerprint, or derived secret value was emitted. |
| **HMAC evidence acceptance** | **BLOCKED — FAIL CLOSED** | The verifier requires a raw repository-secret value containing at least 64 hexadecimal characters and rejects the observed malformed injected value before signing or accepting runtime evidence. |
| **CAD-to-CAE internal capability** | **PASS — SEPARATE FROM SECRET MANAGEMENT** | The latest signed-evidence failure occurred after the actual Docker CAD Agent → CAE Agent → Gmsh → mesh verification → CalculiX → numerical validation runtime step had completed. Existing successful retained evidence remains authoritative for internal capability; it does not turn HMAC validation into a pass. |

The limitation is narrowly scoped: **USER_MANAGED_SECRET = EXTERNAL_TO_MANUS**. It does not invalidate or block the completed internal CAD-to-CAE engineering evidence. The next authorized action after the repository owner corrects the opaque CI credential is to rerun the existing workflow and require `SECRET_PRESENT=true`, `HEX_FORMAT_VALID=true`, `CANONICAL_FORMAT_VALID=true`, and verified HMAC evidence before treating the evidence API as verified.
