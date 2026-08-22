# Docker-Isolated Generic User-Job Design

## Purpose

This design adds one **authorized generic CAE user-job fixture** that is distinct from the fixed axial-bar benchmark. The job is submitted through a generated immutable manifest, executed only inside a Docker container with a static allowlisted image and static entrypoint, and verified by independent mesh and numerical validators.

The design does **not** create an application endpoint that accepts arbitrary commands, images, paths, network destinations, environment variables, or executable payloads. The generic-job fixture is internal, repository-controlled, and used to collect observable sandbox and solver evidence.

## Execution Boundary

| Boundary | Enforced implementation |
|---|---|
| Job source | Checked-in authorized fixture with a distinct job ID and static CAD/CAE parameters. |
| Manifest | Generated after CAD artifact creation; binds job, CAD, CAE, material, load, boundary, solver, configuration, image, policy, and authorization hashes. |
| Container image | Built from a checked-in Dockerfile; no project input is present during image build. |
| Command surface | A static image entrypoint only; the workflow never interpolates user command text. |
| Input surface | Read-only bind mount of generated CAD and immutable manifest into `/input`. |
| Output surface | One explicit per-run output workspace is the sole writable bind mount at `/output`; it is used only for retained evidence and remains distinct from read-only input. |
| Filesystem | Root filesystem read-only; explicit tmpfs mounts at `/tmp` and `/work`; only the per-run evidence workspace is mounted at `/output`. |
| User and privilege | UID/GID `65534`, `--cap-drop ALL`, and `no-new-privileges`. |
| Network | `--network none`; job cannot receive a network destination field. |
| Resource policy | Docker memory, CPUs, pids, file-size, and time limits, plus capped input and output artifact sizes. The output file cap is enforced with the container file-size limit rather than by relying on a tmpfs export path. |
| Result binding | Receipt and result-binding record hash the immutable manifest, CAD, CAE, mesh, solver input, configuration, image, environment report, result, and logs. The retained output also includes the unmodified CalculiX FRD result used by numerical validation. |

## Internal Admission States

The existing generic manifest remains `BLOCKED` for production on a GitHub-hosted runner. A separate **internal test admission** may be used only after the Docker preflight report passes every required observed control. It has no production effect.

| State | Meaning |
|---|---|
| `REJECTED` | Manifest schema, integrity, allowlist, authorization, or input binding failed. |
| `BLOCKED` | Sandbox preflight or runner policy did not meet the internal fixture requirements. No solver starts. |
| `INTERNAL_TEST_ADMITTED` | The repository-controlled fixture may run in the observed Docker boundary only. This is not production approval. |
| `PRODUCTION_ADMITTED` | Deliberately unreachable from this workflow. |

## Required Observations

The workflow records one machine-readable row for every probe: test ID, expected result, observed result, pass/fail, evidence hash, run ID, and environment identity. The probes include read-only root and input mounts, writable confined work/tmp/output mounts, non-root UID, zero effective capabilities, absent GitHub-token-like environment variables, absent external route, distinct PID/mount/network namespaces, CPU/memory/storage/pids/timeout enforcement, input-size rejection, and output-size enforcement.

The probes are defensive tests performed only inside the temporary Docker container created by the authorized GitHub Actions workflow. No probe scans or attacks external systems.

## Remaining Non-Claims

Passing this fixture demonstrates observed Docker controls and a real generic fixture chain. It does not prove a separately approved production environment, independent sandbox review, host-kernel security, platform credential isolation, generic multi-tenant service readiness, or external approval.
