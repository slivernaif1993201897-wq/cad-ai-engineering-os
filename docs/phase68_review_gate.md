# Phase 6.8 Review Gate — Architecture Audit

**Review mode:** Read-only architecture review. No solver, mesher, runtime, sandbox execution, process execution, shell execution, plugin execution, arbitrary filesystem/network access, or numerical CAE result capability was added, enabled, or modified.

## Scope and evidence

This review examined the deployed project implementation at checkpoint `87810d46`, including requirements-to-CAE data contracts, the OpenCascade-backed CAD boundary, CAE plans, canonical job contracts, non-executable mesh artifacts, mesh-quality evidence, independent verification, Solver Input Packages, the Phase 6.8 configuration registry, reviewer governance, audit persistence, traceability/staleness services, and the Phase 6.8 mobile inspector. It used source inspection and read-only SQL aggregation against persisted engineering-memory records; it did not treat documentation alone as proof.

The available durable Phase 6.8 evidence was **test-fixture project data**, not an independently authorized production project. The representative persisted project contained 126 records across 18 kinds. The review could not reopen a user project because project access requires the capability key held by the client; therefore, no private project content or access key was retrieved.

| Evidence area | Observed implementation evidence | Review conclusion |
|---|---|---|
| Requirements and CAD | Requirements validation and real OpenCascade-backed CAD exist, but the inspected Phase 6.8 records contained **0 CAD records**. CAE snapshots accept caller-supplied CAD revisions and SHA-256-shaped geometry hashes. | The CAE chain is structurally declared, not independently bound to a durable CAD artifact in the reviewed fixture. |
| CAE plan to job | 7 CAE plans, 7 plan snapshots, and 7 plan-to-job conversions were present; all 7 conversions joined to both a snapshot and a canonical job. | This internal segment is complete for the inspected fixture. |
| Job to mesh | All 7 persisted mesh-schema records joined to an existing canonical job. | This internal segment is complete, but the mesh remains schema-only and non-executable. |
| Mesh to verification | All 7 independent mesh-quality verifications joined to quality evidence. | The evidence join exists and preserves a submitter/verifier split. |
| Job to package | All 7 Solver Input Packages joined to a canonical job. | The package manifest is immutable and non-executable. |
| Package to configuration | 3 registry records, 2 staleness assessments, and 2 durable configuration-trace links were present. | Only pairs explicitly assessed become durable trace links; package creation itself does not bind a registry record. |
| Lifecycle and reassignment | 5 lifecycle events and 1 reassignment record were present. | Event history is append-only, but validity-time policy is incomplete. |
| Audit | 38 security-audit records were present. | Application-level append-only behavior exists; database-level immutability was not established. |

## Traceability audit

The requested traceability sequence is only partially proven. The table differentiates a durable, internally joined relationship from a caller-declared reference.

| Requested relationship | Result | Evidence | Gap or risk |
|---|---|---|---|
| CAD → CAE | **Incomplete** | `CAEPlanInput` and `captureValidatedCAEPlanSnapshot()` carry CAD revision/hash fields. | The snapshot service accepts a revision string and supplied hash; it does not resolve and verify an actual durable CAD artifact/revision in the project. The inspected Phase 6.8 fixture has no CAD records. |
| CAE → Job | **Complete within fixture** | 7/7 snapshot-to-job conversions joined to plans and jobs. | Initial plan records do not set `sourceRecordId`, so this relationship is recoverable from JSON content rather than a normalized durable foreign key. |
| Job → Mesh | **Complete within fixture** | 7/7 mesh schemas joined to jobs. | Mesh is only a registered non-executable schema; no solver-grade mesh or independently validated volume topology exists. |
| Mesh → Verification | **Complete within fixture** | 7/7 verification records joined to mesh-quality evidence. | A verification record alone does not establish a validity interval or an independently governed expiry clock. |
| Job → Solver Package | **Complete within fixture** | 7/7 packages joined to canonical jobs. | Package status is not execution authority and remains non-executable. |
| Package → Solver Configuration | **Incomplete** | Two stored trace links exist after explicit staleness assessments. | Package creation accepts a free-form configuration reference plus a SHA-256-shaped hash; it does not require a registry `configurationId`, matching registry version, or registry status. |

> **Traceability verdict:** The chain from CAE plan through package is structurally sound for the inspected test fixture. The endpoints that matter most for trustworthy engineering—**actual CAD revision binding** and **package-to-approved configuration binding**—remain declared relationships, not independently verified durable joins.

## Architectural gaps

### Critical blockers

| Blocker | Actual implementation basis | Why it blocks execution readiness |
|---|---|---|
| CAD provenance is not bound to a durable CAD artifact | `captureValidatedCAEPlanSnapshot()` accepts caller-supplied `sourceCadGeometryHash`; it does not verify a stored CAD artifact or kernel-derived revision object. | A valid-looking SHA-256 string can be declared without proving it is the geometry actually reviewed, meshed, or solved. |
| Solver package does not require a registry configuration | `createSolverInputPackageManifest()` accepts `solverConfigurationReference` and `solverConfigurationHash`, rather than a registry record ID. | A package can describe an arbitrary or deprecated configuration reference without passing registry validation or approval status checks. |
| Verification validity has no explicit time contract | Lifecycle events have no `validFrom`, `validUntil`, clock source, maximum validity duration, or automatic expiry mechanism. | A `VERIFIED` record has no bounded period of validity unless a later actor manually creates an expiry event. |
| Lifecycle absence is inconsistently treated as active | The mobile panel states that no lifecycle event is not a claim of current validity, while package creation accepts an absent lifecycle event and configuration staleness defaults it to `ACTIVE`. | The same absence has contradictory semantics. This is a fail-closed violation at the interpretation layer. |
| Reviewer verification authority is not independently enforced | `verifyReviewerIdentity()` accepts a non-empty `actor` string; it does not require that actor to be a verified authority or bind the action to an authenticated organization role. | Any holder of the project capability can potentially promote a reviewer to `VERIFIED` at the application layer. |

### High-risk issues

| Issue | Actual implementation basis | Consequence |
|---|---|---|
| DRAFT and UNKNOWN configuration schemas can validate as `VALID` | Validation rejects only `DEPRECATED` and `REVOKED` registry statuses. | A not-reviewed schema can appear valid despite not having reached a governance-approved state. |
| Registry security filtering is incomplete | Prohibited-content checks cover parameter names/defaults/allowed values/constraints, but not top-level provenance strings or all registry metadata. | A registry record can retain execution-oriented or secret-like language outside the screened fields. |
| Provenance/evidence hashes are syntactic, not referential | Registry evidence accepts SHA-256-shaped values but does not require the hashes to resolve to stored evidence; job material/CAD references similarly remain declared. | Hash-shaped strings can be present without proving a reachable, retained artifact. |
| Audit retention is application convention, not storage enforcement | Security audits are appended through service code; no database WORM control, append-only trigger, signed ledger, or retention lock was found. | A privileged database actor could alter or delete the evidence the application intends to preserve. |
| Reassignment lacks a replacement-verification link | The reassignment records a `REPLACED` state but does not contain a required `replacementVerificationId`. | Reviewers cannot directly prove which new independent verification superseded the replacement event. |
| Reviewer reassignment authority is not independent by policy | The actor must be verified and authorized, but is not required to be distinct from the original reviewer, proposed reviewer, submitter, or their managerial chain. | The current self-review check is narrower than true independence governance. |

### Medium and low issues

| Severity | Issue | Impact |
|---|---|---|
| Medium | Hashing uses `JSON.stringify()` rather than a documented canonical serialization profile. | Cross-language or reordered-object hashing can produce different identities for semantically equivalent content. |
| Medium | Deterministic package diffs reuse a deterministic logical ID but are persisted again on each inspection. | Storage can accumulate duplicate audit-like evidence with the same logical outcome, obscuring review chronology. |
| Medium | Initial CAE plan, first job, reviewer identity, and audit records often omit `sourceRecordId`. | Graph reconstruction relies on parsing JSON payloads rather than normalized reference integrity. |
| Low | The Phase 6.4 readiness document still describes a missing job compiler/manifest, while Phase 6.5–6.8 now provide non-executable contract foundations. | Readiness narrative should be reconciled so it distinguishes a schema compiler from a runtime executable input compiler. |

## Execution readiness audit

### Architecture readiness decision: **NOT_READY**

The architecture is **not ready for runtime implementation**. It is more mature than an unconstrained design concept because it has immutable contracts, evidence records, trust gates, failure models, and review paths. That is not enough to move the readiness category above `NOT_READY`.

The actual Phase 6.4 review remains `RUNTIME_IMPLEMENTATION_BLOCKED` and lists failing essential security gates for a signed allowlisted artifact, enforced sandbox, measured/enforced limits, immutable runtime job manifest, mesh/result verifier, and independent runtime-security evidence. Phase 6.5–6.8 close important *contract and governance* gaps, but they do not supply an implemented sandbox, an allowlisted executable image, a solver-grade mesher, a result collector, a bounded result parser, or independently attested infrastructure.

| Candidate status | Decision | Reason |
|---|---|---|
| `NOT_READY` | **Selected** | Critical provenance, lifecycle, authorization, and configuration-binding gaps remain alongside all runtime/security implementation blockers. |
| `READY_FOR_RUNTIME_DESIGN` | Not selected | A runtime architecture has already been designed and reviewed; the evidence does not support reclassifying it as ready to proceed to implementation. |
| `READY_FOR_RUNTIME_IMPLEMENTATION` | Not selected | The necessary technical controls, independent evidence, and fail-closed runtime enforcement do not exist. |

## Security review — prerequisites only

The following are required before any future authorization discussion. They are review findings, **not implementation instructions and not approval to enable anything**.

| Capability considered | Minimum prerequisite evidence before it could be discussed | Current position |
|---|---|---|
| Process execution | A separately attested execution substrate; pinned/allowlisted artifact identity; authenticated runtime operator; least-privilege policy; measured/enforced resource controls; tamper-evident receipt retention. | Absent. |
| Solver execution | All process controls plus a canonical runtime input manifest bound to durable CAD, material, load, boundary, mesh, configuration, adapter, and environment identities. | Absent. |
| Mesher execution | A dedicated bounded mesher adapter; solver-grade volume-mesh artifact; topology/quality report; independent quality acceptance; corruption/refusal tests. | Absent. |
| Sandbox execution | Enforced default-deny isolation, read-only inputs, bounded outputs, no ambient credentials, no Docker socket/host privilege, no network by default, and independent hostile-test evidence. | Absent. |
| Filesystem access | Explicit allowlist of immutable input mounts and bounded output paths; storage mediation; retention and deletion policy; escape tests. | Absent. |
| Controlled network access | A specific business purpose, destination allowlist, authenticated transport, egress logs, data-residency approval, credential vaulting, and revocation controls. | Absent and intentionally prohibited. |

## Governance review — required policy clarifications

The implementation has useful mechanics but lacks the policy text required to make them governable. The following language should be adopted before any future capability expansion.

| Policy area | Exact clarification needed |
|---|---|
| Reviewer independence | “A reviewer is independent only if they are not the submitter, original verifier, proposed replacement, direct manager, direct report, project owner, or financially interested party; the system must record the conflict check and its evidence.” |
| Verification expiry | “Every verification shall include `issuedAt`, `validUntil`, authoritative clock source, maximum validity period, and expiry reason. An absent lifecycle event is `UNKNOWN`, never `ACTIVE`. No grace period exists unless a named policy version explicitly defines one.” |
| Reassignment | “The assignment authority must be independent of submitter, original reviewer, and replacement reviewer. A reassignment is incomplete until a new verification record is created and linked as `replacementVerificationId`; the prior record remains `REPLACED` permanently.” |
| Revocation | “Only named roles may revoke; each revocation shall have an effective timestamp, reason code, scope, propagation target list, appeal path, and required re-review condition. Revocation affects future use immediately and never deletes historical evidence.” |
| Evidence retention | “Audit and verification artifacts shall be retained in tamper-evident storage for a policy-versioned minimum period, subject to legal hold. Application append-only behavior is insufficient without storage-level enforcement.” |
| Organization boundaries | “Projects, reviewers, approvers, evidence issuers, and runtime operators shall carry organization/tenant IDs. Cross-organization evidence or approval is rejected unless an explicit delegated trust agreement exists.” |
| Approval authority | “Reviewer verification, configuration review, and runtime-change approval require authenticated role binding, authority scope, separation-of-duties checks, and where risk requires it, a quorum. Free-text actor identity is insufficient.” |

## Mobile inspector review

The Phase 6.8 panel is appropriately explicit about being non-executable and avoids execution affordances. Its main problem is that it represents backend governance with too little context to safely support a human decision.

| Area | Actionable issue | Evidence in current panel |
|---|---|---|
| Current verification state | Events are listed, but no effective current state, validity interval, expiry date, or “absence means unknown” status is computed per verification. | A historical `VERIFIED` label can coexist with an expired lifecycle event. |
| Staleness | The text promises staleness inspection, but the panel never calls `assessSolverConfigurationStaleness()`. | Users cannot inspect solver/schema/job/mesh/material/verification freshness checks. |
| Configuration selection | The graph always uses the first registry configuration; there is no package-to-configuration selector or proof of a valid registry binding. | The displayed graph can imply a relationship that the manifest does not enforce. |
| Package comparison | Users must type opaque package IDs to choose a diff. | This is error-prone on mobile and obscures package provenance/status before comparison. |
| Diff audit noise | Clicking the diff action writes another persistent diff record. | A read-only inspection action creates durable duplicate evidence and is not visually explained as a persistence event. |
| Provenance | Registry evidence is shown as raw hash text and parameters are truncated to five entries. | Evidence cannot be inspected meaningfully; security boundary, full parameter schema, provenance source, and validation history lack navigation. |
| State hierarchy | `UNKNOWN`, `STALE`, `CONFLICT`, `REPLACED`, and `EXPIRED` use compact badges without a clear decision consequence. | The user is not told whether the state blocks reuse, needs reassignment, needs fresh evidence, or indicates an unresolved contradiction. |
| Navigation | All Phase 6.8 content is embedded after the package inspector in one long CAE workspace. | On a portrait mobile screen, governance records have weak discoverability and no deep link from a package, verification, or configuration. |

## Final architecture verdict

### Architecture status: **NOT_READY**

The completed Phase 6.8 system is a credible **non-executable evidence and governance foundation**, not an execution-ready CAE platform. Its strongest qualities are fail-closed execution flags, immutable-ish application records, package/diff determinism, distinct reviewer identities, lifecycle/reassignment refusal paths, and broad acceptance coverage. Its main weakness is that several critical relationships are still caller-declared strings and hashes rather than storage-resolved, policy-enforced identities.

| Category | Review conclusion |
|---|---|
| Critical blockers | Durable CAD binding; registry-bound package configuration; authoritative verification expiry semantics; independently authorized reviewer verification. |
| High-risk issues | DRAFT/UNKNOWN configuration validation, incomplete top-level security filtering, non-referential hash provenance, application-only audit immutability, reassignment linkage/independence. |
| Medium issues | Non-canonical hashing, duplicate deterministic diff persistence, missing normalized source links, outdated readiness narrative. |
| Security gaps | No execution substrate, signed runtime artifact, sandbox enforcement, capacity enforcement, result verifier, storage-level tamper protection, or controlled network policy/evidence. |
| Governance gaps | No defined validity interval, authority model, independence standard, organization boundary, retention lock, revocation propagation policy, or quorum rule. |
| UI/UX gaps | No effective current state, no staleness action, implicit first-configuration graph selection, opaque package-ID entry, raw provenance hashes, and weak mobile navigation. |
| Traceability gaps | CAD→CAE is declared rather than artifact-proven; package→configuration is conditional on a later assessment rather than mandatory at package creation. |

## Validation results

| Command | Exact result |
|---|---|
| `pnpm check` | Passed: TypeScript emitted no errors. |
| `pnpm vitest run tests/solver-configuration-governance.test.ts --pool=forks --poolOptions.forks.singleFork=true --testTimeout=15000` | Passed: 1 file, 16 tests. |
| `pnpm vitest run --pool=forks --poolOptions.forks.singleFork=true --testTimeout=15000` | Passed: 34 files, 106 tests; 1 pre-existing authentication test skipped. Duration: 275.66 seconds. |

## Recommended next phase

**Recommended next phase: Phase 6.9 — Evidence Integrity and Governance Closure (review-approved scope only).**

The next scope should close the identified contract and policy defects *without* adding a solver, mesher, runtime, sandbox execution, process execution, shell capability, plugin execution, arbitrary filesystem/network access, or numerical results. It should first require an explicit approval gate and a separate design review. No Phase 6.9 implementation was started in this review.

> **Stop condition:** This review ends here. Execution remains disabled; `executionEligible` and `executable` remain false.
