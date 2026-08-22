# Independent Security Assessment Package

## Purpose and Scope

This package prepares the **internal CAD Agent Docker runtime** for independent assessment. It is not an assessment report, does not assert external approval, and does not alter production admission. The assessment target is the repository revision `c140b765f4860865cbf4cc59c19ae9bc8c13da1d` and the existing authoritative workflow `.github/workflows/cad-agent-authoritative-runtime.yml`.

The target path is:

> CAD Agent → validated OpenCascade revision → immutable manifest → admission → Docker sandbox → Gmsh → independent mesh verification → CalculiX → numerical validation → hash-bound result → retained evidence.

## Retained Evidence References

| Evidence family | Reference | Review objective |
|---|---|---|
| Final authoritative execution | GitHub Actions run `32548950838` | Confirm successful real CAD Agent execution and both execution-start flags. |
| Repeated unchanged execution | GitHub Actions run `32548873775` | Confirm reproducibility of canonical source, solver, mesh, output, and result hashes. |
| Permanent generic regression baseline | GitHub Actions run `32542564434`; tag `docker-generic-baseline-32542564434` | Confirm the fixed generic fixture remains a regression baseline and was not substituted for the CAD Agent path. |
| Runtime implementation | `docker/generic-user-job/Dockerfile`, `docker/generic-user-job/entrypoint.py`, `scripts/ci/run-docker-generic-user-job.sh` | Review the static command surface, Docker controls, and artifact boundary. |
| Provenance and admission | `shared/controlledUserJob.ts`, `shared/authoritativeCadAgentRuntime.ts` | Review immutable-manifest schema, semantic revision hash, stale/tamper rejection, and fail-closed admission. |
| Host artifact validation | `scripts/ci/validate_docker_generic_job.py` | Review binding and mutation rejection rules. |
| Signed canonical evidence | `server/signedRuntimeEvidence.ts`, `server/runtimeEvidenceStore.ts`, `server/runtimeEvidenceApi.ts` | Review opaque HMAC verification, complete binding requirements, replay rejection, atomic store behavior, and read-only server access. |
| Closure record | `docs/controlled_user_job_closure_report_2026-08-22.md` | Review observed evidence, unresolved gates, and scope limits. |

## Observed Internal Evidence Inventory

The final workflow retained the execution receipt, manifest, CAD provenance, Docker inspect records, sandbox probes, 241-package `dpkg-query` inventory, mesh verification, solver input, canonical CalculiX FRD, raw CalculiX FRD, raw-solver evidence record, numerical validation, result binding, logs, artifact hash manifest, and controlled failure evidence. The sandbox campaign recorded 34 static, bounded in-container observations with zero failures.

The internal campaign also exercised stale job, stale CAD, mesh mismatch, solver mismatch, configuration mismatch, input tampering, output tampering, Gmsh failure, CalculiX failure, timeout, CPU limit, memory limit, storage limit, invalid admission input, invalid mesh, corrupted artifact, and partial output. These are internal execution observations, not external penetration-test findings.

The canonical evidence store requires a verified signed envelope and the complete binding set of `JOB_ID`, CAD revision and artifact hashes, CAE configuration hash, manifest hash, environment hash, Gmsh hash, mesh hash, CalculiX hash, input hash, output hash, result hash, and execution-log hash. It stores content-addressed records and rejects an already stored evidence hash as a replay. Its deterministic regression covers complete binding, incomplete binding, tampered storage, stale evidence, foreign evidence, replay, and missing source behavior. The repository-secret workflow execution remains fail closed until the user-managed HMAC secret passes its no-value format gate.

## Requested Independent Review Questions

1. Does the Docker boundary demonstrate the stated isolation properties in the reviewer’s approved environment, including host/kernel and multi-tenant assumptions?
2. Are the immutable manifest, canonical serialization, admission checks, and result binding sufficient to prevent source, configuration, solver, input, output, and evidence substitution within the stated threat model?
3. Does the raw-versus-canonical solver-output handling preserve auditability while avoiding inappropriate timestamp-driven reproducibility drift?
4. Are the resource, timeout, storage, and failure receipts adequate for the reviewer’s recovery and operational assurance criteria?
5. Are the numerical validation method and tolerance appropriate for the intended production engineering scope?

## Explicit Non-Claims

This package does **not** claim an approved production environment, independent security assessment, external engineering approval, production numerical acceptance, host-level isolation, or production readiness. Those items remain `BLOCKED_EXTERNAL_EVIDENCE` until separately evidenced and accepted.
