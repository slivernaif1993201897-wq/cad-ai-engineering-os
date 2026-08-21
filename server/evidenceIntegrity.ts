import { createHash, randomUUID } from "crypto";
import type { CADRevisionBinding, CAEPlanCADBinding, EvidenceIntegrityTraceabilityAssessment, EvidenceRetentionMetadata, MeshQualityVerification, ReviewerAuthorizationEvidence, SolverConfigurationSchemaRegistryRecord, SolverInputPackageManifest, VerifiedReviewerIdentity } from "../shared/cae";
import { appendTrustSecurityAudit, listReviewerIdentities } from "./caeTrust";
import { getCAEJobContract } from "./caeJobContract";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const now = () => new Date().toISOString();
const sha256 = (value: string) => /^[a-f0-9]{64}$/i.test(value);
const ref = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(value);
const retention = (): EvidenceRetentionMetadata => ({ policyVersion: "1.0.0", retentionStatus: "ACTIVE", deletionPolicy: "NO_SILENT_DELETION", historicalRecordPreserved: true });
const parse = <T,>(content: string): T | undefined => { try { return JSON.parse(content) as T; } catch { return undefined; } };
async function authorize(args: Access) { await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" }); }
async function records<T>(args: Access, kinds: string[]) { await authorize(args); return (await projectMemorySnapshot(args)).records.filter((item) => kinds.includes(item.kind)).flatMap((item) => { const value = parse<T>(item.content); return value ? [value] : []; }); }

export async function listCADRevisionBindings(args: Access & { cadBindingId?: string }) {
  return (await records<CADRevisionBinding>(args, ["CAE_CAD_REVISION_BINDING"])).filter((item) => !args.cadBindingId || item.cadBindingId === args.cadBindingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function registerCADRevisionBinding(args: Access & { cadProjectId: string; cadRevision: string; cadGeometryHash: string; source: string; creator: string; revision: number; provenance: string[] }) {
  await authorize(args);
  if (![args.cadProjectId, args.cadRevision].every(ref) || !sha256(args.cadGeometryHash) || !args.source.trim() || !args.creator.trim() || args.revision < 1 || !args.provenance.length) throw new Error("CAD binding requires bounded project/revision identifiers, a SHA-256 geometry identity, creator, revision, source, and provenance.");
  const sameRevision = (await listCADRevisionBindings(args)).find((item) => item.cadProjectId === args.cadProjectId && item.cadRevision === args.cadRevision);
  if (sameRevision && sameRevision.cadGeometryHash !== args.cadGeometryHash) throw new Error("An immutable CAD revision cannot be rebound to a different geometry hash. Create a new CAD revision instead.");
  if (sameRevision) return sameRevision;
  const binding: CADRevisionBinding = { cadBindingId: id("CAD-BINDING"), projectId: args.projectId, cadProjectId: args.cadProjectId, cadRevision: args.cadRevision, cadGeometryHash: args.cadGeometryHash, source: args.source.trim(), creator: args.creator.trim(), revision: args.revision, provenance: args.provenance, state: "CURRENT", createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_CAD_REVISION_BINDING", title: `CAD revision binding · ${binding.cadProjectId} · ${binding.cadRevision}`, content: JSON.stringify(binding), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "USER", sourceRecordId: binding.cadBindingId } });
  await appendTrustSecurityAudit(args, { actor: binding.creator, action: "RUNTIME_ARCHITECTURE_REVIEW", objectType: "RUNTIME_ARCHITECTURE", objectId: binding.cadBindingId, newState: "CURRENT_NON_EXECUTABLE", reason: "Immutable CAD revision/geometry identity binding recorded; no CAD operation, meshing, or solver action was invoked." });
  return binding;
}

export async function getCADRevisionBinding(args: Access & { cadBindingId: string }) { return (await listCADRevisionBindings(args)).find((item) => item.cadBindingId === args.cadBindingId); }

export async function recordCAEPlanCADBinding(args: Access & { simulationId: string; cadBindingId: string; planHash: string }) {
  await authorize(args); const cad = await getCADRevisionBinding(args); if (!cad || !sha256(args.planHash) || !ref(args.simulationId)) throw new Error("CAE plan binding requires an authorized immutable CAD binding, bounded simulation identity, and SHA-256 plan identity.");
  const existing = (await records<CAEPlanCADBinding>(args, ["CAE_PLAN_CAD_BINDING"])).find((item) => item.simulationId === args.simulationId && item.cadBindingId === cad.cadBindingId && item.planHash === args.planHash); if (existing) return existing;
  const binding: CAEPlanCADBinding = { planCadBindingId: id("CAE-PLAN-CAD-BINDING"), projectId: args.projectId, simulationId: args.simulationId, cadBindingId: cad.cadBindingId, cadProjectId: cad.cadProjectId, cadRevision: cad.cadRevision, cadGeometryHash: cad.cadGeometryHash, planHash: args.planHash, createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_PLAN_CAD_BINDING", title: `CAE plan CAD binding · ${binding.simulationId} · ${binding.cadRevision}`, content: JSON.stringify(binding), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: binding.cadBindingId } });
  return binding;
}

export async function listReviewerAuthorizations(args: Access & { reviewerId?: string }) {
  return (await records<ReviewerAuthorizationEvidence>(args, ["CAE_REVIEWER_AUTHORIZATION"])).filter((item) => !args.reviewerId || item.reviewerId === args.reviewerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function authorizeReviewerForEvidence(args: Access & { reviewerId: string; organization: string; role: string; authorizationScope: ReviewerAuthorizationEvidence["authorizationScope"]; authorizationSource: string; authorizationHash: string; issuedBy: string; validFrom: string; validUntil: string; independenceStatement: string }) {
  await authorize(args); const reviewer = (await listReviewerIdentities(args)).find((item) => item.reviewerId === args.reviewerId);
  const start = Date.parse(args.validFrom); const end = Date.parse(args.validUntil); const current = Date.now();
  if (!reviewer || reviewer.status !== "VERIFIED" || reviewer.identityStatus !== "VERIFIED" || !reviewer.projectScope.includes(args.projectId) || !args.organization.trim() || !args.role.trim() || !args.authorizationScope.length || !args.authorizationScope.every((permission) => reviewer.permissions.includes(permission)) || !sha256(args.authorizationHash) || !args.authorizationSource.trim() || !args.issuedBy.trim() || args.issuedBy.trim() === reviewer.reviewerId || args.issuedBy.trim() === reviewer.displayName || !args.independenceStatement.trim() || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("Reviewer authorization requires a verified identity, project scope, granted permissions, independent issuer, SHA-256 authorization evidence, independence statement, and ordered validity interval.");
  const status = end < current ? "EXPIRED" as const : start > current ? "UNKNOWN" as const : "AUTHORIZED" as const;
  const authorization: ReviewerAuthorizationEvidence = { reviewerAuthorizationId: id("REVIEWER-AUTHORIZATION"), projectId: args.projectId, reviewerId: reviewer.reviewerId, organization: args.organization.trim(), role: args.role.trim(), authorizationScope: args.authorizationScope, authorizationSource: args.authorizationSource.trim(), authorizationHash: args.authorizationHash, issuedBy: args.issuedBy.trim(), validFrom: args.validFrom, validUntil: args.validUntil, independenceStatement: args.independenceStatement.trim(), status, createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_REVIEWER_AUTHORIZATION", title: `Reviewer authorization · ${reviewer.displayName} · ${status}`, content: JSON.stringify(authorization), truthStatus: status === "AUTHORIZED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "USER", sourceRecordId: reviewer.reviewerId } });
  await appendTrustSecurityAudit(args, { actor: authorization.issuedBy, action: "APPROVAL", objectType: "REVIEWER", objectId: authorization.reviewerAuthorizationId, newState: status, reason: "Independent reviewer authorization evidence recorded. Identity verification alone remains insufficient." });
  return authorization;
}

export async function requireCurrentReviewerAuthorization(args: Access & { reviewerId: string; reviewerAuthorizationId: string; permission: ReviewerAuthorizationEvidence["authorizationScope"][number] }) {
  const authorization = (await listReviewerAuthorizations(args)).find((item) => item.reviewerAuthorizationId === args.reviewerAuthorizationId && item.reviewerId === args.reviewerId);
  if (!authorization || authorization.status !== "AUTHORIZED" || Date.parse(authorization.validFrom) > Date.now() || Date.parse(authorization.validUntil) < Date.now() || !authorization.authorizationScope.includes(args.permission)) throw new Error("Reviewer identity may be verified, but current independent authorization for this review scope is unavailable, expired, revoked, or insufficient.");
  return authorization;
}

export async function assessEvidenceIntegrityTraceability(args: Access & { jobId: string; packageId: string; configurationId: string; reviewerAuthorizationId?: string }) {
  await authorize(args); const snapshot = await projectMemorySnapshot(args); const typed = <T,>(kind: string) => snapshot.records.filter((item) => item.kind === kind).flatMap((item) => { const value = parse<T>(item.content); return value ? [value] : []; });
  const job = await getCAEJobContract({ ...args, jobId: args.jobId }); const pkg = typed<SolverInputPackageManifest>("CAE_SOLVER_INPUT_PACKAGE").find((item) => item.packageId === args.packageId); const config = typed<SolverConfigurationSchemaRegistryRecord>("CAE_SOLVER_CONFIGURATION_REGISTRY").find((item) => item.configurationId === args.configurationId); const cad = job?.cadBindingId ? typed<CADRevisionBinding>("CAE_CAD_REVISION_BINDING").find((item) => item.cadBindingId === job.cadBindingId) : undefined; const planBinding = typed<CAEPlanCADBinding>("CAE_PLAN_CAD_BINDING").find((item) => item.simulationId === job?.provenance.sourcePlanId && item.cadBindingId === job?.cadBindingId); const mesh = pkg ? typed<{ meshId: string; jobId: string }>("CAE_EVIDENCE").find((item) => item.meshId === pkg.meshArtifactId && item.jobId === job?.jobId) : undefined; const verification = pkg?.meshQualityVerificationId ? typed<MeshQualityVerification>("CAE_MESH_QUALITY_VERIFICATION").find((item) => item.verificationId === pkg.meshQualityVerificationId) : undefined; const reviewerAuthorization = args.reviewerAuthorizationId ? typed<ReviewerAuthorizationEvidence>("CAE_REVIEWER_AUTHORIZATION").find((item) => item.reviewerAuthorizationId === args.reviewerAuthorizationId) : verification?.reviewerAuthorizationId ? typed<ReviewerAuthorizationEvidence>("CAE_REVIEWER_AUTHORIZATION").find((item) => item.reviewerAuthorizationId === verification.reviewerAuthorizationId) : undefined;
  const state = (ok: boolean, reason: string) => ({ status: ok ? "RESOLVED" as const : "ORPHANED" as const, reason });
  const links: EvidenceIntegrityTraceabilityAssessment["links"] = [
    { from: "CAD_REVISION", fromId: job?.cadBindingId ?? "MISSING", to: "CAE_PLAN", toId: job?.provenance.sourcePlanId ?? "MISSING", ...state(Boolean(cad && planBinding && job && cad.cadRevision === job.cadRevision && cad.cadGeometryHash === job.cadGeometryHash), "CAD revision binding must resolve and match the immutable plan/job identity.") },
    { from: "CAE_PLAN", fromId: job?.provenance.sourcePlanId ?? "MISSING", to: "CAE_JOB", toId: job?.jobId ?? args.jobId, ...state(Boolean(job && planBinding), "CAE plan binding must resolve to the canonical job.") },
    { from: "CAE_JOB", fromId: job?.jobId ?? args.jobId, to: "MESH", toId: pkg?.meshArtifactId ?? "MISSING", ...state(Boolean(job && mesh), "Package mesh must resolve to the same canonical job.") },
    { from: "MESH", fromId: pkg?.meshArtifactId ?? "MISSING", to: "MESH_VERIFICATION", toId: verification?.verificationId ?? "MISSING", ...state(Boolean(mesh && verification), "Mesh verification must resolve to the package mesh evidence.") },
    { from: "MESH_VERIFICATION", fromId: verification?.verificationId ?? "MISSING", to: "SOLVER_INPUT_PACKAGE", toId: pkg?.packageId ?? args.packageId, ...state(Boolean(verification && pkg), "Verification must resolve to the immutable Solver Input Package.") },
    { from: "SOLVER_INPUT_PACKAGE", fromId: pkg?.packageId ?? args.packageId, to: "SOLVER_CONFIGURATION", toId: config?.configurationId ?? args.configurationId, ...state(Boolean(pkg && config && pkg.solverConfiguration.configurationId === config.configurationId && pkg.solverConfiguration.configurationHash === config.configurationHash), "Package configuration identity/hash must resolve to the immutable registry record.") },
    { from: "SOLVER_CONFIGURATION", fromId: config?.configurationId ?? args.configurationId, to: "REVIEWER_AUTHORIZATION", toId: reviewerAuthorization?.reviewerAuthorizationId ?? "MISSING", ...state(Boolean(verification && reviewerAuthorization && verification.reviewerAuthorizationId === reviewerAuthorization.reviewerAuthorizationId), "Verification must resolve to independently authorized reviewer evidence.") },
  ];
  const assessment: EvidenceIntegrityTraceabilityAssessment = { assessmentId: id("EVIDENCE-INTEGRITY-TRACE"), projectId: args.projectId, jobId: args.jobId, packageId: args.packageId, configurationId: args.configurationId, reviewerAuthorizationId: reviewerAuthorization?.reviewerAuthorizationId, links, status: links.some((item) => item.status === "ORPHANED") ? "ORPHANED" : "RESOLVED", executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_EVIDENCE_INTEGRITY_TRACEABILITY", title: `Evidence integrity traceability · ${assessment.status}`, content: JSON.stringify(assessment), truthStatus: assessment.status === "RESOLVED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: args.packageId } });
  return assessment;
}
