# GitHub-Hosted Runner Sandbox Decision

## Decision

`GITHUB_RUNNER_SANDBOX = INSUFFICIENT`

The observed GitHub-hosted runner supports a bounded fixed workflow and can produce audit artifacts. It has not established the project’s required independently approved production sandbox.

## Observed Facts

| Dimension | Observation | Production conclusion |
|---|---|---|
| Runner identity | GitHub-hosted Linux/X64; no self-hosted repository runner is registered. | A hosted CI executor is observed, not an approved project-controlled environment. |
| Workspace lifecycle | A new GitHub Actions job ran the benchmark and retained a 14-day artifact bundle. | Helpful auditability, but no independent approval evidence. |
| Workflow permissions | `contents: read` only. | Least privilege for the benchmark workflow, not a sandbox attestation. |
| Process/file/output limits | The workflow applies `timeout`, CPU time, process count, and file-size limits around Gmsh and CalculiX. | Bounded command invocation only; not observed enforcement of complete CPU, memory, filesystem, or network isolation. |
| Base runner limits | The runner observation reports several unlimited base limits, including virtual memory, CPU time, and max user processes. | Resource isolation is not established. |
| Network boundary | No independent network allowlist, egress-control observation, or test evidence exists. | Network control is not established. |
| Credential boundary | Secret metadata is inaccessible to the integration, but no approved credential-isolation test evidence exists. | Credential isolation is not established. |

## Consequences

The repository may safely use GitHub-hosted CI only for the bounded fixed benchmark and for fail-closed manifest validation. It must not classify the runner as `APPROVED_EXECUTION_ENVIRONMENT`, `REAL_SANDBOX`, `ESCAPE_RESISTANT`, `RESOURCE_ISOLATED`, or `PRODUCTION_READY`.

The required path to production remains a separately authorized, project-controlled execution environment with observed filesystem, process, privilege, network, environment, workspace, resource, and audit boundaries; only then may authorized defensive escape testing be performed.
