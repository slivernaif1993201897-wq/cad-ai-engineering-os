# GitHub Execution Bridge Report — CAD-AI Engineering OS

## Observed Connection and Authorization

The GitHub integration authenticated as repository owner `slivernaif1993201897-wq`. The canonical repository `slivernaif1993201897-wq/cad-ai-engineering-os` is accessible on branch `main` with `ADMIN` viewer permission. The workflow inventory exposes the active **Bounded CAD-AI CAE Benchmark** workflow (`339545837`). Repository secret metadata could not be listed: GitHub returned `HTTP 403: Resource not accessible by integration`; no secret name or value was read, displayed, or requested.

The repository has **zero self-hosted runners** registered. The observed workflow therefore uses a GitHub-hosted `ubuntu-24.04` runner rather than a user-controlled or separately approved execution environment.

## Workflow Boundary

| Property | Observed value |
|---|---|
| Workflow | `Bounded CAD-AI CAE Benchmark` (`339545837`) |
| Permissions | `contents: read` only |
| Runner | GitHub-hosted `ubuntu-24.04` |
| Job timeout | 15 minutes |
| Action provenance | Checkout and artifact-upload actions are pinned to full commit identifiers. |
| Per-solver limits | The workflow applies CPU-time, output-file-size, process-count, and `timeout` limits to its fixed Gmsh and CalculiX invocations. |
| Artifact retention | 14 days |
| Scope | `FIXED_REPOSITORY_BENCHMARK_ONLY`; not a user-submitted canonical CAE job. |

The workflow captures runner observations, tool provenance, generated CAD, mesh, solver input/output, logs, stage hashes, and a summary before upload. It is a least-privilege bounded benchmark workflow. It is **not** independently attested as a production sandbox.

## Actual Execution Evidence

The continuation checkpoint `edf79da86e06c9437725fad16bb81998d634b52e` was pushed to `main`, triggering run [`32537299715`](https://github.com/slivernaif1993201897-wq/cad-ai-engineering-os/actions/runs/32537299715). The run completed successfully in 57 seconds.

| Stage | Observed result |
|---|---|
| CAD generation | OpenCascade STEP benchmark geometry was generated. |
| Gmsh | Exit code `0`; observed package `gmsh 4.12.1+ds1-1.1build2`, binary `/usr/bin/gmsh`, and reported version `4.12.1`. |
| Mesh verification | Exit code `0`; 87 nodes and 204 tetrahedra; connectivity valid; zero negative-orientation and degenerate elements; expected bounds matched; verifier status `PASS`. |
| CalculiX | Exit code `0`; observed package `calculix-ccx 2.21-1`, binary `/usr/bin/ccx`, and reported version `2.21`. |
| Numerical benchmark check | Exit code `0`; observed displacement `0.00475625 mm` versus axial-bar reference `0.004761904761904762 mm`, relative error `0.0011875`, within the benchmark’s explicitly non-production 30% tolerance. |
| Evidence bundle | Artifact `bounded-cae-evidence-32537299715` was retained and downloaded for inspection; it contains STEP, mesh, solver input/output, logs, provenance, hashes, mesh verification, and numerical-validation records. |

## Integrity Scope

The artifact binds the fixed CAD STEP, mesh, and CalculiX input using SHA-256 hashes. The solver input itself states `inputKind: FIXED_REPOSITORY_BENCHMARK`, `canonicalUserCAEJob: NOT_PROVIDED`, and `admissionState: NOT_A_USER_SUBMITTED_RUNTIME_REQUEST`.

> The observed result is real evidence for the fixed repository benchmark. It is not evidence of deployed admission, arbitrary user-job execution, an approved sandbox, or production readiness.

## Runtime Gate Evaluation

| Gate | Status | Basis |
|---|---|---|
| GitHub connection | **PASS** | Owner-authenticated access with repository `ADMIN` permission. |
| Bounded benchmark workflow | **PASS** | Active least-privilege workflow and successful run `32537299715`. |
| Runner identity | **OBSERVED** | GitHub-hosted Linux/X64 runner; 2 CPUs and approximately 8 GiB memory were observed. |
| Approved execution environment | **BLOCKED** | No separate authorization or attestation identifies the hosted runner as an approved production environment. |
| Real sandbox | **BLOCKED** | Hosted-runner use and per-process limits do not establish filesystem, process, privilege, network, or environment isolation evidence. |
| Escape resistance | **BLOCKED** | No authorized sandbox exists for bounded defensive escape tests. |
| Resource isolation | **BLOCKED** | The runner observation contains several unlimited base `ulimit` values; workflow-level limits are not an independent resource-isolation attestation. |
| Gmsh fixed benchmark | **PASS** | Actual fixed benchmark execution, binary provenance, log, hash, and exit code are retained. |
| Mesh verification fixed benchmark | **PASS** | Independent meshio-based verifier output is retained. |
| CalculiX fixed benchmark | **PASS** | Actual fixed benchmark execution, binary provenance, log, hash, and exit code are retained. |
| Numerical benchmark validation | **PASS (BENCHMARK ONLY)** | Closed-form axial-bar comparison passed a deliberately non-production tolerance. |
| Result integrity | **PARTIAL** | Fixed benchmark hashes are bound; canonical user-job, approved-environment, and deployment bindings are absent. |
| Failure recovery / reproducibility | **PARTIAL** | The workflow is deterministic in configuration, but no approved-environment recovery exercise or independent repeatability evidence exists. |
| Independent review | **PENDING_EXTERNAL_REVIEW** | No independent reviewer or security assessor evidence is attached. |
| Production runtime | **BLOCKED** | Mandatory environment, sandbox, security, and review gates remain unmet. |

## Exact Remaining Dependencies

The project now has actual fixed-benchmark Gmsh, mesh-verification, CalculiX, and numerical-comparison evidence from GitHub-hosted CI. To promote any production gate, it still requires a separately approved and segregated environment; experimentally evidenced isolation and resource control; authorization for defensive sandbox tests; current Gmsh/CalculiX artifact/SBOM provenance in that environment; a canonical user-job admission path; numerical validation under justified production tolerances; result binding to the canonical job and environment; recovery/reproducibility exercises; and independent security and engineering review.
