import { randomUUID } from "crypto";
import type { ArtifactDependencyEvidence, ArtifactSBOMReviewRecord, EvidenceRetentionMetadata, HostileTestEvidenceRecord, IndependentSandboxAttestationRubric, SandboxAttestationControlId, SandboxAttestationControlRequirement, SandboxSecurityAttestationEvidence, SecurityEvidenceConflict, SecurityEvidenceLifecycleEvent, SecurityEvidenceTraceabilityAssessment } from "../shared/cae";
import { SANDBOX_ATTESTATION_CONTROL_IDS } from "../shared/cae";
import { appendTrustSecurityAudit, listReviewerIdentities } from "./caeTrust";
import { requireCurrentReviewerAuthorization } from "./evidenceIntegrity";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
type ControlInput = { controlId: SandboxAttestationControlId; state: SandboxAttestationControlRequirement["state"]; evidenceIds: string[]; rationale: string };
type LinkStatus = SecurityEvidenceTraceabilityAssessment["links"][number]["status"];

const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const now = () => new Date().toISOString();
const sha256 = (value: string) => /^[a-f0-9]{64}$/i.test(value);
const ref = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(value);
const parse = <T,>(content: string): T | undefined => { try { return JSON.parse(content) as T; } catch { return undefined; } };
const retention = (): EvidenceRetentionMetadata => ({ policyVersion: "1.0.0", retentionStatus: "ACTIVE", deletionPolicy: "NO_SILENT_DELETION", historicalRecordPreserved: true });
const controlCatalog: Record<SandboxAttestationControlId, Pick<SandboxAttestationControlRequirement, "objective" | "requiredEvidence">> = {
  PROCESS_ISOLATION: { objective: "Prevent workload control of host or unrelated processes.", requiredEvidence: ["process namespace evidence", "non-root policy", "denial evidence"] },
  FILESYSTEM_ISOLATION: { objective: "Restrict workloads to declared immutable input and bounded output locations.", requiredEvidence: ["mount policy", "path-denial evidence", "host-mount review"] },
  NETWORK_ISOLATION: { objective: "Prevent undeclared ingress and egress.", requiredEvidence: ["default-deny policy", "egress-denial evidence"] },
  RESOURCE_LIMITS: { objective: "Constrain workload resource consumption at the enforcement substrate.", requiredEvidence: ["enforced resource policy", "limit evidence"] },
  CPU_LIMITS: { objective: "Constrain CPU consumption.", requiredEvidence: ["CPU enforcement evidence"] },
  MEMORY_LIMITS: { objective: "Constrain memory consumption.", requiredEvidence: ["memory enforcement evidence"] },
  EXECUTION_TIMEOUT: { objective: "Bound future workload duration.", requiredEvidence: ["timeout enforcement evidence"] },
  STORAGE_LIMITS: { objective: "Bound temporary and output storage.", requiredEvidence: ["storage enforcement evidence"] },
  PRIVILEGE_BOUNDARIES: { objective: "Prevent privilege escalation and ambient authority.", requiredEvidence: ["capability policy", "no-new-privileges evidence"] },
  SECRET_ISOLATION: { objective: "Prevent credentials and secrets entering a workload.", requiredEvidence: ["credential isolation policy", "environment review"] },
  DEPENDENCY_ISOLATION: { objective: "Restrict dependencies to reviewed immutable artifact identities.", requiredEvidence: ["SBOM", "dependency integrity evidence"] },
  EGRESS_CONTROL: { objective: "Prevent data exfiltration through unauthorized output or network channels.", requiredEvidence: ["egress policy", "audit evidence"] },
  FAILURE_CONTAINMENT: { objective: "Contain crashes, timeouts, and violations without host impact.", requiredEvidence: ["termination policy", "failure receipt format"] },
  AUDITABILITY: { objective: "Preserve bounded immutable security-relevant evidence.", requiredEvidence: ["audit schema", "retention policy"] },
  REPRODUCIBILITY: { objective: "Retain the identities needed for independent reproduction review.", requiredEvidence: ["artifact identity", "configuration identity", "environment identity"] },
};

async function authorize(args: Access) { await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" }); }
async function records<T>(args: Access, kinds: string[]) {
  await authorize(args);
  return (await projectMemorySnapshot(args)).records
    .filter((record) => kinds.includes(record.kind))
    .flatMap((record) => { const value = parse<T>(record.content); return value ? [value] : []; });
}
function dateState(validFrom: string, validUntil: string): "CURRENT" | "EXPIRED" | "UNKNOWN" {
  const start = Date.parse(validFrom); const end = Date.parse(validUntil);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start > Date.now()) return "UNKNOWN";
  return end < Date.now() ? "EXPIRED" : "CURRENT";
}
function link(status: LinkStatus, reason: string) { return { status, reason }; }
function normalizeControls(input: ControlInput[]) {
  const received = new Map(input.map((item) => [item.controlId, item]));
  if (received.size !== SANDBOX_ATTESTATION_CONTROL_IDS.length || SANDBOX_ATTESTATION_CONTROL_IDS.some((controlId) => !received.has(controlId))) throw new Error("Sandbox attestation must address every mandatory control exactly once.");
  return SANDBOX_ATTESTATION_CONTROL_IDS.map((controlId) => {
    const item = received.get(controlId)!;
    if (!item.rationale.trim() || item.evidenceIds.some((evidenceId) => !ref(evidenceId))) throw new Error("Sandbox-control rationale and evidence references must be bounded.");
    if (item.state === "PASS" && item.evidenceIds.length === 0) throw new Error(`Sandbox control ${controlId} cannot be PASS without evidence.`);
    return { controlId, objective: controlCatalog[controlId].objective, requiredEvidence: controlCatalog[controlId].requiredEvidence, state: item.state, evidenceIds: item.evidenceIds, rationale: item.rationale.trim(), mandatory: true as const };
  });
}

export async function createSandboxAttestationRubric(args: Access & { attestationSubject: string; attestationScope: string }) {
  await authorize(args);
  if (!args.attestationSubject.trim() || !args.attestationScope.trim()) throw new Error("Sandbox attestation rubric requires an attestation subject and scope.");
  const rubric: IndependentSandboxAttestationRubric = {
    rubricId: id("SANDBOX-RUBRIC"), projectId: args.projectId, contractVersion: "1.0.0", attestationSubject: args.attestationSubject.trim(), attestationScope: args.attestationScope.trim(),
    controls: SANDBOX_ATTESTATION_CONTROL_IDS.map((controlId) => ({ controlId, objective: controlCatalog[controlId].objective, requiredEvidence: controlCatalog[controlId].requiredEvidence, state: "UNKNOWN", evidenceIds: [], rationale: "No control evidence has been supplied.", mandatory: true })),
    requiredControlCount: 15, noEvidenceMayPass: true, selfAttestationPolicy: "GOVERNED_SEPARATELY", executionEligible: false, executable: false, createdAt: now(), immutable: true, retention: retention(),
  };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_EVIDENCE_RUBRIC", title: `Sandbox attestation rubric · ${rubric.attestationSubject}`, content: JSON.stringify(rubric), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: rubric.rubricId } });
  await appendTrustSecurityAudit(args, { actor: "SYSTEM", action: "SECURITY_EVIDENCE_RECORD", objectType: "SECURITY_EVIDENCE", objectId: rubric.rubricId, newState: "UNKNOWN", reason: "A complete evidence-only sandbox-attestation rubric was recorded. No sandbox or test was created." });
  return rubric;
}
export async function listSandboxAttestationRubrics(args: Access) { return (await records<IndependentSandboxAttestationRubric>(args, ["CAE_SECURITY_EVIDENCE_RUBRIC"])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function recordSandboxSecurityAttestation(args: Access & { rubricId: string; attestationSubject: string; attestationScope: string; attestorIdentity: string; attestorAuthorizationId: string; independence: SandboxSecurityAttestationEvidence["independence"]; evidenceSource: string; evidenceHash: string; issuedAt: string; validFrom: string; validUntil: string; controlAssessments: ControlInput[]; selfAttestationReviewRequired: boolean }) {
  await authorize(args);
  const rubric = (await listSandboxAttestationRubrics(args)).find((item) => item.rubricId === args.rubricId);
  const attestor = (await listReviewerIdentities(args)).find((item) => item.reviewerId === args.attestorIdentity);
  if (!rubric || !attestor || attestor.status !== "VERIFIED" || attestor.identityStatus !== "VERIFIED" || !attestor.projectScope.includes(args.projectId) || !args.attestationSubject.trim() || !args.attestationScope.trim() || !args.evidenceSource.trim() || !sha256(args.evidenceHash)) throw new Error("Sandbox attestation requires an existing rubric, a verified project-scoped attestor, subject/scope, source, and SHA-256 evidence identity.");
  await requireCurrentReviewerAuthorization({ ...args, reviewerId: attestor.reviewerId, reviewerAuthorizationId: args.attestorAuthorizationId, permission: "APPROVE_VALIDATION" });
  if (args.independence === "INDEPENDENT" && (args.attestorIdentity === args.attestationSubject || attestor.displayName === args.attestationSubject)) throw new Error("An independent sandbox attestor cannot attest their own subject.");
  if (args.independence === "SELF_ATTESTATION" && !args.selfAttestationReviewRequired) throw new Error("Self-attestation is permitted only as explicitly governed pending independent review.");
  const controls = normalizeControls(args.controlAssessments);
  const date = dateState(args.validFrom, args.validUntil);
  const allPass = controls.every((control) => control.state === "PASS");
  const status = date === "EXPIRED" ? "EXPIRED" as const : args.independence === "CONFLICT" ? "CONFLICT" as const : args.independence === "SELF_ATTESTATION" ? "UNKNOWN" as const : allPass ? "PASS" as const : controls.some((control) => control.state === "FAIL") ? "FAIL" as const : "UNKNOWN" as const;
  const attestation: SandboxSecurityAttestationEvidence = { attestationEvidenceId: id("SANDBOX-ATTESTATION"), projectId: args.projectId, rubricId: rubric.rubricId, attestationSubject: args.attestationSubject.trim(), attestationScope: args.attestationScope.trim(), attestorIdentity: attestor.reviewerId, attestorAuthorizationId: args.attestorAuthorizationId, independence: args.independence, evidenceSource: args.evidenceSource.trim(), evidenceHash: args.evidenceHash, issuedAt: args.issuedAt, validFrom: args.validFrom, validUntil: args.validUntil, revocationState: date, controlAssessments: controls, status, selfAttestationReviewRequired: args.selfAttestationReviewRequired, executionEligible: false, executable: false, createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_SANDBOX_ATTESTATION", title: `Sandbox attestation evidence · ${attestation.status}`, content: JSON.stringify(attestation), truthStatus: attestation.status === "PASS" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "USER", sourceRecordId: attestation.attestationEvidenceId } });
  await appendSecurityLifecycle({ ...args, subjectType: "SANDBOX_ATTESTATION", subjectId: attestation.attestationEvidenceId, previousState: "NOT_SET", newState: date === "CURRENT" ? "CURRENT" : date, reason: `Evidence-only sandbox attestation recorded with ${attestation.status} state.`, reviewerAuthorizationId: args.attestorAuthorizationId, actor: attestor.displayName });
  await appendTrustSecurityAudit(args, { actor: attestor.displayName, action: "SECURITY_EVIDENCE_RECORD", objectType: "SECURITY_EVIDENCE", objectId: attestation.attestationEvidenceId, newState: attestation.status, reason: "Sandbox-attestation evidence was recorded only; no sandbox, process, network, or hostile test was executed." });
  return attestation;
}
export async function listSandboxSecurityAttestations(args: Access) { return (await records<SandboxSecurityAttestationEvidence>(args, ["CAE_SECURITY_SANDBOX_ATTESTATION"])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

async function appendConflict(args: Access, conflict: Omit<SecurityEvidenceConflict, "conflictId" | "projectId" | "createdAt" | "immutable">) {
  const value: SecurityEvidenceConflict = { conflictId: id("SECURITY-EVIDENCE-CONFLICT"), projectId: args.projectId, ...conflict, createdAt: now(), immutable: true };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_EVIDENCE_CONFLICT", title: `Security evidence conflict · ${value.subjectType} · ${value.field}`, content: JSON.stringify(value), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: value.subjectIds[0] } });
  return value;
}

export async function recordArtifactSBOMReview(args: Access & { artifactIdentity: string; artifactVersion: string; artifactHash: string; signature?: string; signatureHash?: string; publisher: string; source: string; license: string; dependencies: ArtifactDependencyEvidence[]; sbomReference: string; sbomHash: string; knownVulnerabilities: string[]; buildProvenance: string[]; reproducibilityEvidence: string[]; reviewerId?: string; reviewerAuthorizationId?: string; reviewIssuedAt: string; reviewValidFrom: string; reviewValidUntil: string; reviewStatus: ArtifactSBOMReviewRecord["reviewStatus"]; revocationState?: ArtifactSBOMReviewRecord["revocationState"]; findings: string[] }) {
  await authorize(args);
  if (![args.artifactIdentity, args.artifactVersion, args.publisher, args.source, args.license, args.sbomReference].every((value) => value.trim()) || !sha256(args.artifactHash) || !sha256(args.sbomHash) || (args.signatureHash && !sha256(args.signatureHash)) || !args.dependencies.length || !args.dependencies.every((dependency) => dependency.name.trim() && dependency.version.trim() && dependency.source.trim()) || !args.buildProvenance.length || !args.reproducibilityEvidence.length) throw new Error("Artifact/SBOM review requires bounded identity/version, hashes, publisher/source/license, dependencies, SBOM, build provenance, and reproducibility evidence.");
  const validity = dateState(args.reviewValidFrom, args.reviewValidUntil);
  if (args.reviewStatus === "APPROVED") {
    if (!args.reviewerId || !args.reviewerAuthorizationId || !args.signature?.trim() || !args.signatureHash || !args.dependencies.every((dependency) => dependency.sha256 && dependency.knownVulnerabilityState !== "KNOWN" && dependency.knownVulnerabilityState !== "CONFLICT")) throw new Error("Approved artifact review requires reviewer authorization, signature identity, hashed dependencies, and no declared dependency conflict or known vulnerability.");
    const reviewer = (await listReviewerIdentities(args)).find((item) => item.reviewerId === args.reviewerId);
    if (!reviewer || reviewer.status !== "VERIFIED" || reviewer.identityStatus !== "VERIFIED" || reviewer.displayName === args.publisher || reviewer.reviewerId === args.publisher) throw new Error("Artifact approval requires a verified reviewer distinct from the artifact publisher.");
    await requireCurrentReviewerAuthorization({ ...args, reviewerId: reviewer.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, permission: "APPROVE_SOLVER_ADAPTER" });
  }
  const previous = (await listArtifactSBOMReviews(args)).filter((item) => item.artifactIdentity === args.artifactIdentity && item.artifactVersion === args.artifactVersion);
  const conflict = previous.find((item) => item.artifactHash !== args.artifactHash || item.sbomHash !== args.sbomHash) || args.dependencies.some((item, index, all) => all.some((other, otherIndex) => index !== otherIndex && item.name === other.name && item.version === other.version && item.sha256 && other.sha256 && item.sha256 !== other.sha256));
  const reviewStatus = validity === "EXPIRED" ? "EXPIRED" as const : args.revocationState === "REVOKED" ? "REVOKED" as const : conflict ? "REJECTED" as const : args.reviewStatus;
  const record: ArtifactSBOMReviewRecord = { artifactReviewId: id("ARTIFACT-SBOM-REVIEW"), projectId: args.projectId, artifactIdentity: args.artifactIdentity.trim(), artifactVersion: args.artifactVersion.trim(), artifactHash: args.artifactHash, signature: args.signature?.trim(), signatureHash: args.signatureHash, publisher: args.publisher.trim(), source: args.source.trim(), license: args.license.trim(), dependencies: args.dependencies, sbomReference: args.sbomReference.trim(), sbomHash: args.sbomHash, knownVulnerabilities: args.knownVulnerabilities, buildProvenance: args.buildProvenance, reproducibilityEvidence: args.reproducibilityEvidence, reviewerId: args.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, reviewIssuedAt: args.reviewIssuedAt, reviewValidFrom: args.reviewValidFrom, reviewValidUntil: args.reviewValidUntil, reviewStatus, revocationState: args.revocationState ?? validity, findings: args.findings, registrationDoesNotAuthorizeExecution: true, executionEligible: false, executable: false, createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_ARTIFACT_SBOM_REVIEW", title: `Artifact/SBOM review · ${record.artifactIdentity} · ${record.reviewStatus}`, content: JSON.stringify(record), truthStatus: record.reviewStatus === "APPROVED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "USER", sourceRecordId: record.artifactReviewId } });
  if (conflict) await appendConflict(args, { subjectType: "ARTIFACT_REVIEW", subjectIds: [...previous.map((item) => item.artifactReviewId), record.artifactReviewId], field: previous.some((item) => item.artifactHash !== args.artifactHash) ? "ARTIFACT_HASH" : "SBOM_OR_DEPENDENCY", expected: previous[0]?.artifactHash ?? previous[0]?.sbomHash, observed: args.artifactHash, status: "CONFLICT", reason: "Artifact identity, SBOM, or dependency evidence conflicts with immutable evidence." });
  await appendSecurityLifecycle({ ...args, subjectType: "ARTIFACT_REVIEW", subjectId: record.artifactReviewId, previousState: "NOT_SET", newState: record.revocationState === "CURRENT" ? "CURRENT" : record.revocationState, reason: "Artifact/SBOM evidence recorded without authorizing executable use.", reviewerAuthorizationId: record.reviewerAuthorizationId, actor: record.reviewerId ?? "SYSTEM" });
  await appendTrustSecurityAudit(args, { actor: record.reviewerId ?? "SYSTEM", action: "SECURITY_EVIDENCE_RECORD", objectType: "SECURITY_EVIDENCE", objectId: record.artifactReviewId, newState: record.reviewStatus, reason: "Future artifact and SBOM review recorded only; registration never authorizes execution." });
  return record;
}
export async function listArtifactSBOMReviews(args: Access) { return (await records<ArtifactSBOMReviewRecord>(args, ["CAE_SECURITY_ARTIFACT_SBOM_REVIEW"])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function recordHostileTestEvidence(args: Access & { testId: string; testCategory: HostileTestEvidenceRecord["testCategory"]; testObjective: string; environmentIdentity: string; testInputHash: string; expectedBehavior: string; observedBehavior: string; result: HostileTestEvidenceRecord["result"]; rawEvidenceHash: string; timestamp: string; reviewerId: string; reviewerAuthorizationId: string; limitations: string[]; reproducibilityInformation: string[] }) {
  await authorize(args);
  if (![args.testId, args.testObjective, args.environmentIdentity, args.expectedBehavior, args.observedBehavior].every((value) => value.trim()) || !sha256(args.testInputHash) || !sha256(args.rawEvidenceHash) || !args.reproducibilityInformation.length) throw new Error("Hostile-test evidence requires a bounded category/objective/environment, input and raw-evidence hashes, behavior statements, and reproducibility information.");
  const reviewer = (await listReviewerIdentities(args)).find((item) => item.reviewerId === args.reviewerId);
  if (!reviewer || reviewer.status !== "VERIFIED" || reviewer.identityStatus !== "VERIFIED" || !reviewer.projectScope.includes(args.projectId)) throw new Error("Hostile-test evidence requires a verified project-scoped reviewer.");
  await requireCurrentReviewerAuthorization({ ...args, reviewerId: reviewer.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, permission: "APPROVE_VALIDATION" });
  const record: HostileTestEvidenceRecord = { hostileTestEvidenceId: id("HOSTILE-TEST-EVIDENCE"), projectId: args.projectId, testId: args.testId.trim(), testCategory: args.testCategory, testObjective: args.testObjective.trim(), environmentIdentity: args.environmentIdentity.trim(), testInputHash: args.testInputHash, expectedBehavior: args.expectedBehavior.trim(), observedBehavior: args.observedBehavior.trim(), result: args.result, rawEvidenceHash: args.rawEvidenceHash, timestamp: args.timestamp, reviewerId: reviewer.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, limitations: args.limitations, reproducibilityInformation: args.reproducibilityInformation, actualTestExecutionClaimed: false, executionEligible: false, executable: false, createdAt: now(), immutable: true, retention: retention() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_HOSTILE_TEST_EVIDENCE", title: `Hostile-test evidence declaration · ${record.testCategory} · ${record.result}`, content: JSON.stringify(record), truthStatus: record.result === "PASS" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "USER", sourceRecordId: record.hostileTestEvidenceId } });
  await appendTrustSecurityAudit(args, { actor: reviewer.displayName, action: "SECURITY_EVIDENCE_RECORD", objectType: "SECURITY_EVIDENCE", objectId: record.hostileTestEvidenceId, newState: record.result, reason: "Bounded hostile-test evidence was recorded only. This system did not run a hostile test, sandbox, solver, or mesher." });
  return record;
}
export async function listHostileTestEvidenceRecords(args: Access) { return (await records<HostileTestEvidenceRecord>(args, ["CAE_SECURITY_HOSTILE_TEST_EVIDENCE"])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function appendSecurityLifecycle(args: Access & { subjectType: SecurityEvidenceLifecycleEvent["subjectType"]; subjectId: string; previousState: SecurityEvidenceLifecycleEvent["previousState"]; newState: SecurityEvidenceLifecycleEvent["newState"]; reason: string; reviewerAuthorizationId?: string; actor: string }) {
  await authorize(args);
  if (!ref(args.subjectId) || !args.reason.trim() || !args.actor.trim()) throw new Error("Security-evidence lifecycle requires bounded subject, actor, and reason.");
  const event: SecurityEvidenceLifecycleEvent = { lifecycleEventId: id("SECURITY-EVIDENCE-LIFECYCLE"), projectId: args.projectId, subjectType: args.subjectType, subjectId: args.subjectId, previousState: args.previousState, newState: args.newState, reason: args.reason.trim(), reviewerAuthorizationId: args.reviewerAuthorizationId, actor: args.actor.trim(), timestamp: now(), immutable: true };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_EVIDENCE_LIFECYCLE", title: `Security evidence lifecycle · ${event.subjectType} · ${event.newState}`, content: JSON.stringify(event), truthStatus: event.newState === "CURRENT" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: event.subjectId } });
  return event;
}
export async function listSecurityEvidenceLifecycle(args: Access & { subjectId?: string }) { return (await records<SecurityEvidenceLifecycleEvent>(args, ["CAE_SECURITY_EVIDENCE_LIFECYCLE"])).filter((item) => !args.subjectId || item.subjectId === args.subjectId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)); }
export async function listSecurityEvidenceConflicts(args: Access) { return (await records<SecurityEvidenceConflict>(args, ["CAE_SECURITY_EVIDENCE_CONFLICT"])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function assessSecurityEvidenceTraceability(args: Access & { runtimeArchitectureReviewId: string; rubricId?: string; attestationEvidenceId?: string; artifactReviewId?: string; hostileTestEvidenceId?: string }) {
  await authorize(args);
  const snapshot = await projectMemorySnapshot(args);
  const typed = <T,>(kind: string) => snapshot.records.filter((record) => record.kind === kind).flatMap((record) => { const value = parse<T>(record.content); return value ? [value] : []; });
  const runtime = typed<{ reviewId: string }>("CAE_RUNTIME_ARCHITECTURE_REVIEW").find((item) => item.reviewId === args.runtimeArchitectureReviewId);
  const rubric = args.rubricId ? typed<IndependentSandboxAttestationRubric>("CAE_SECURITY_EVIDENCE_RUBRIC").find((item) => item.rubricId === args.rubricId) : undefined;
  const attestation = args.attestationEvidenceId ? typed<SandboxSecurityAttestationEvidence>("CAE_SECURITY_SANDBOX_ATTESTATION").find((item) => item.attestationEvidenceId === args.attestationEvidenceId) : undefined;
  const artifact = args.artifactReviewId ? typed<ArtifactSBOMReviewRecord>("CAE_SECURITY_ARTIFACT_SBOM_REVIEW").find((item) => item.artifactReviewId === args.artifactReviewId) : undefined;
  const hostile = args.hostileTestEvidenceId ? typed<HostileTestEvidenceRecord>("CAE_SECURITY_HOSTILE_TEST_EVIDENCE").find((item) => item.hostileTestEvidenceId === args.hostileTestEvidenceId) : undefined;
  const authorizationIds = new Set(typed<{ reviewerAuthorizationId: string }>("CAE_REVIEWER_AUTHORIZATION").map((item) => item.reviewerAuthorizationId));
  const reviewerLinkId = hostile?.reviewerAuthorizationId ?? artifact?.reviewerAuthorizationId ?? attestation?.attestorAuthorizationId;
  const resolved = (ok: boolean, reason: string) => link(ok ? "RESOLVED" : "ORPHANED", reason);
  const links: SecurityEvidenceTraceabilityAssessment["links"] = [
    { from: "RUNTIME_ARCHITECTURE_REVIEW", fromId: args.runtimeArchitectureReviewId, to: "SANDBOX_CONTROL", toId: rubric?.rubricId ?? "MISSING", ...resolved(Boolean(runtime && rubric && rubric.controls.length === 15), "Runtime architecture review must resolve to a complete sandbox-control rubric.") },
    { from: "SANDBOX_CONTROL", fromId: rubric?.rubricId ?? "MISSING", to: "SANDBOX_ATTESTATION", toId: attestation?.attestationEvidenceId ?? "MISSING", ...resolved(Boolean(rubric && attestation && attestation.rubricId === rubric.rubricId && attestation.controlAssessments.length === 15), "All sandbox controls must resolve to attestation evidence.") },
    { from: "SANDBOX_ATTESTATION", fromId: attestation?.attestationEvidenceId ?? "MISSING", to: "ARTIFACT", toId: artifact?.artifactReviewId ?? "MISSING", ...resolved(Boolean(attestation && artifact), "Sandbox evidence and artifact evidence must both be present for a future runtime chain.") },
    { from: "ARTIFACT", fromId: artifact?.artifactReviewId ?? "MISSING", to: "SBOM", toId: artifact?.sbomReference ?? "MISSING", ...resolved(Boolean(artifact && artifact.sbomHash), "Artifact review must resolve to an immutable SBOM identity.") },
    { from: "SBOM", fromId: artifact?.sbomReference ?? "MISSING", to: "HOSTILE_TEST", toId: hostile?.hostileTestEvidenceId ?? "MISSING", ...resolved(Boolean(artifact && hostile), "Future artifact evidence must resolve to bounded hostile-test evidence before readiness review.") },
    { from: "HOSTILE_TEST", fromId: hostile?.hostileTestEvidenceId ?? "MISSING", to: "REVIEWER", toId: hostile?.reviewerId ?? "MISSING", ...resolved(Boolean(hostile && authorizationIds.has(hostile.reviewerAuthorizationId)), "Hostile-test evidence requires current reviewer authorization evidence.") },
    { from: "REVIEWER", fromId: reviewerLinkId ?? "MISSING", to: "READINESS_GATE", toId: "RUNTIME_DESIGN_NOT_READY", ...resolved(Boolean(reviewerLinkId && authorizationIds.has(reviewerLinkId)), "Reviewer authorization must resolve before evidence can inform a future readiness gate.") },
  ];
  const status = links.some((item) => item.status === "ORPHANED") ? "ORPHANED" as const : "RESOLVED" as const;
  const assessment: SecurityEvidenceTraceabilityAssessment = { assessmentId: id("SECURITY-EVIDENCE-TRACE"), projectId: args.projectId, runtimeArchitectureReviewId: args.runtimeArchitectureReviewId, rubricId: rubric?.rubricId, attestationEvidenceId: attestation?.attestationEvidenceId, artifactReviewId: artifact?.artifactReviewId, hostileTestEvidenceId: hostile?.hostileTestEvidenceId, links, status, executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_SECURITY_EVIDENCE_TRACEABILITY", title: `Security evidence traceability · ${assessment.status}`, content: JSON.stringify(assessment), truthStatus: status === "RESOLVED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM", sourceRecordId: args.runtimeArchitectureReviewId } });
  return assessment;
}
