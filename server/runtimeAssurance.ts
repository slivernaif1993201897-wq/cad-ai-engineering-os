import { randomUUID } from "crypto";

import type { RuntimeAssuranceAssessment, RuntimeAssuranceEnvironment, RuntimeAssuranceFailure, RuntimeAssuranceGateAssessment, RuntimeAssuranceGateId, RuntimeAssuranceGateState, RuntimeAssuranceObservedTest, RuntimeAssuranceRepairAttempt, RuntimeAssuranceReviewPackage } from "../shared/runtimeAssurance";
import { appendTrustSecurityAudit, listReviewerIdentities } from "./caeTrust";
import { requireCurrentReviewerAuthorization } from "./evidenceIntegrity";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const now = () => new Date().toISOString();
const sha256 = (value: string) => /^[a-f0-9]{64}$/i.test(value);
const parse = <T,>(value: string): T | undefined => { try { return JSON.parse(value) as T; } catch { return undefined; } };
const gateDefinitions: Array<{ gateId: RuntimeAssuranceGateId; dependencies: RuntimeAssuranceGateId[]; missing: string[] }> = [
  { gateId: "G0_APPROVED_TEST_ENVIRONMENT", dependencies: [], missing: ["Independently approved segregated environment identity, limits, policy, current validity, and observed evidence."] },
  { gateId: "G1_REAL_SANDBOX", dependencies: ["G0_APPROVED_TEST_ENVIRONMENT"], missing: ["Observed filesystem, process, privilege, network, environment, working-directory, temporary-storage, timeout, and resource enforcement evidence."] },
  { gateId: "G2_ESCAPE_RESISTANCE", dependencies: ["G1_REAL_SANDBOX"], missing: ["Approved non-destructive defensive escape-campaign evidence and independent review."] },
  { gateId: "G3_RESOURCE_ISOLATION", dependencies: ["G2_ESCAPE_RESISTANCE"], missing: ["Observed CPU, memory, storage, timeout, process, and artifact-size enforcement evidence."] },
  { gateId: "G4_REAL_GMSH", dependencies: ["G3_RESOURCE_ISOLATION"], missing: ["Pinned Gmsh artifact/SBOM/provenance, bounded observed mesh execution receipt, log, resource use, and mesh artifact."] },
  { gateId: "G5_MESH_VERIFICATION", dependencies: ["G4_REAL_GMSH"], missing: ["Independent mesh validity, connectivity, bounds, units, quality, and CAD correspondence evidence."] },
  { gateId: "G6_REAL_CALCULIX", dependencies: ["G5_MESH_VERIFICATION"], missing: ["Pinned CalculiX artifact/SBOM/provenance, bounded benchmark receipt, output, log, and resource evidence."] },
  { gateId: "G7_NUMERICAL_VALIDATION", dependencies: ["G6_REAL_CALCULIX"], missing: ["Independent reference, units, justified tolerance, error, and applicable equilibrium/convergence/sensitivity evidence."] },
  { gateId: "G8_RESULT_INTEGRITY", dependencies: ["G7_NUMERICAL_VALIDATION"], missing: ["Hash-bound CAD, plan, materials, loads, boundaries, contacts, mesh, solver, configuration, environment, and corrupt/partial-output refusal evidence."] },
  { gateId: "G9_HOSTILE_SECURITY_TESTING", dependencies: ["G8_RESULT_INTEGRITY"], missing: ["Full approved hostile-campaign evidence across all declared categories."] },
  { gateId: "G10_FAILURE_RECOVERY", dependencies: ["G9_HOSTILE_SECURITY_TESTING"], missing: ["Observed crash, limit, malformed input, corruption, missing dependency, partial output, and safe recovery evidence."] },
  { gateId: "G11_REPRODUCIBILITY", dependencies: ["G10_FAILURE_RECOVERY"], missing: ["Repeated approved job identity comparison and nondeterminism assessment."] },
  { gateId: "G12_INDEPENDENT_REVIEW", dependencies: ["G11_REPRODUCIBILITY"], missing: ["Complete immutable evidence package and an authorized independent reviewer decision."] },
  { gateId: "G13_PRODUCTION_READINESS", dependencies: ["G12_INDEPENDENT_REVIEW"], missing: ["All prior gate PASS evidence, no critical unknown/fail, and explicit production authorization."] },
];

async function authorize(access: Access) { await openPersistentProject({ projectId: access.projectId, accessKey: access.accessKey, name: "" }); }
async function records<T>(access: Access, kind: string) { await authorize(access); return (await projectMemorySnapshot(access)).records.filter((record) => record.kind === kind).flatMap((record) => { const item = parse<T>(record.content); return item ? [item] : []; }); }
const current = (from: string, until: string) => { const start = Date.parse(from); const end = Date.parse(until); return Number.isFinite(start) && Number.isFinite(end) && start <= Date.now() && end >= Date.now(); };

export async function recordRuntimeAssuranceEnvironment(args: Access & Omit<RuntimeAssuranceEnvironment, "environmentRecordId" | "projectId" | "recordOnly" | "executionEligible" | "executable" | "createdAt">) {
  await authorize(args);
  if (!sha256(args.environmentHash) || !sha256(args.observedEvidenceHash) || !args.provenance.length || ![args.environmentId, args.imageBaseline, args.operatingSystem, args.kernel, args.cpuLimit, args.memoryLimit, args.storageLimit, args.networkPolicy, args.timeoutPolicy].every((value) => value.trim())) throw new Error("Environment evidence requires bounded identity, baseline, OS/kernel, enforced-limit declarations, network/timeout policy, hashes, and provenance.");
  if (args.approvalState === "APPROVED") {
    if (args.approvalScope !== "INDEPENDENTLY_VERIFIED" || !args.approvedByReviewerId || !args.reviewerAuthorizationId || !current(args.validFrom, args.validUntil)) throw new Error("An approved environment requires current independently verified reviewer authorization and valid evidence.");
    const reviewer = (await listReviewerIdentities(args)).find((item) => item.reviewerId === args.approvedByReviewerId);
    if (!reviewer || reviewer.status !== "VERIFIED" || reviewer.identityStatus !== "VERIFIED") throw new Error("Approved environment evidence requires a verified reviewer identity.");
    await requireCurrentReviewerAuthorization({ ...args, reviewerId: reviewer.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, permission: "APPROVE_VALIDATION" });
  }
  const { projectId, accessKey: _accessKey, ...environmentInput } = args;
  const environment: RuntimeAssuranceEnvironment = { environmentRecordId: id("ASSURANCE-ENVIRONMENT"), projectId, ...environmentInput, recordOnly: true, executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_ENVIRONMENT", title: `Runtime assurance environment · ${environment.environmentId} · ${environment.approvalState}`, content: JSON.stringify(environment), truthStatus: environment.approvalState === "APPROVED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: environment.environmentRecordId, authorSource: "USER" } });
  await appendTrustSecurityAudit(args, { actor: environment.approvedByReviewerId ?? "SYSTEM", action: "SECURITY_EVIDENCE_RECORD", objectType: "SECURITY_EVIDENCE", objectId: environment.environmentRecordId, newState: environment.approvalState, reason: "Environment evidence was recorded only; no environment, sandbox, process, or runtime was provisioned or executed." });
  return environment;
}
export async function listRuntimeAssuranceEnvironments(args: Access) { return (await records<RuntimeAssuranceEnvironment>(args, "RUNTIME_ASSURANCE_ENVIRONMENT")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function recordRuntimeAssuranceObservedTest(args: Access & Omit<RuntimeAssuranceObservedTest, "assuranceTestId" | "projectId" | "recordOnly" | "executionEligible" | "executable" | "createdAt">) {
  await authorize(args);
  if (!sha256(args.inputHash) || !sha256(args.rawEvidenceHash) || ![args.testId, args.environmentId, args.performerIdentity, args.expectedBehavior, args.observedBehavior].every((value) => value.trim())) throw new Error("Assurance-test evidence requires bounded identities, expected/observed behavior, and input/raw-evidence SHA-256 values.");
  if (args.result === "PASS" && (args.evidenceOrigin !== "EXTERNAL_OBSERVED" || args.evidenceScope !== "INDEPENDENTLY_VERIFIED" || !args.reviewerId || !args.reviewerAuthorizationId || args.reviewerId === args.performerIdentity)) throw new Error("A gate PASS requires externally observed, independently verified evidence reviewed by a distinct authorized reviewer.");
  if (args.result === "PASS") {
    const environment = (await listRuntimeAssuranceEnvironments(args)).find((item) => item.environmentId === args.environmentId);
    if (!environment || environment.approvalState !== "APPROVED" || environment.approvalScope !== "INDEPENDENTLY_VERIFIED" || !current(environment.validFrom, environment.validUntil)) throw new Error("A gate PASS must reference a current independently approved environment record in the same project.");
  }
  if (args.reviewerId && args.reviewerAuthorizationId) await requireCurrentReviewerAuthorization({ ...args, reviewerId: args.reviewerId, reviewerAuthorizationId: args.reviewerAuthorizationId, permission: "APPROVE_VALIDATION" });
  const { projectId, accessKey: _accessKey, ...testInput } = args;
  const record: RuntimeAssuranceObservedTest = { assuranceTestId: id("ASSURANCE-TEST"), projectId, ...testInput, recordOnly: true, executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_OBSERVED_TEST", title: `Runtime assurance test evidence · ${record.gateId} · ${record.result}`, content: JSON.stringify(record), truthStatus: record.result === "PASS" && record.evidenceScope === "INDEPENDENTLY_VERIFIED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: record.assuranceTestId, authorSource: "USER" } });
  return record;
}
export async function listRuntimeAssuranceObservedTests(args: Access) { return (await records<RuntimeAssuranceObservedTest>(args, "RUNTIME_ASSURANCE_OBSERVED_TEST")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function recordRuntimeAssuranceFailure(args: Access & Omit<RuntimeAssuranceFailure, "failureId" | "projectId" | "immutable" | "createdAt" | "state">) {
  await authorize(args);
  if (!args.rootCauseId.trim() || !args.rootCauseSummary.trim() || !args.remainingRisk.trim()) throw new Error("Assurance failure requires bounded root-cause and remaining-risk information.");
  const { projectId, accessKey: _accessKey, ...failureInput } = args;
  const record: RuntimeAssuranceFailure = { failureId: id("ASSURANCE-FAILURE"), projectId, ...failureInput, state: "OPEN", immutable: true, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_FAILURE", title: `Runtime assurance failure · ${record.gateId} · ${record.classification}`, content: JSON.stringify(record), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: record.failureId, authorSource: "SYSTEM" } });
  return record;
}
export async function listRuntimeAssuranceFailures(args: Access) { return (await records<RuntimeAssuranceFailure>(args, "RUNTIME_ASSURANCE_FAILURE")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function recordRuntimeAssuranceRepairAttempt(args: Access & Omit<RuntimeAssuranceRepairAttempt, "repairAttemptId" | "projectId" | "attemptCount" | "escalationRequired" | "immutable" | "createdAt">) {
  await authorize(args); const failure = (await listRuntimeAssuranceFailures(args)).find((item) => item.failureId === args.failureId); if (!failure) throw new Error("Repair attempts require an existing project-scoped failure.");
  const prior = (await records<RuntimeAssuranceRepairAttempt>(args, "RUNTIME_ASSURANCE_REPAIR_ATTEMPT")).filter((item) => item.failureId === args.failureId && item.rootCauseId === args.rootCauseId);
  if (prior.some((item) => item.repairStrategy === args.repairStrategy)) throw new Error("The same repair strategy cannot be repeated for the same root cause; select a materially different strategy or escalate.");
  const attemptCount = prior.length + 1; const escalationRequired = attemptCount >= 3 && args.result !== "REPAIRED";
  const { projectId, accessKey: _accessKey, ...repairInput } = args;
  const record: RuntimeAssuranceRepairAttempt = { repairAttemptId: id("ASSURANCE-REPAIR"), projectId, ...repairInput, attemptCount, escalationRequired, immutable: true, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_REPAIR_ATTEMPT", title: `Runtime assurance repair attempt ${attemptCount} · ${record.result}`, content: JSON.stringify(record), truthStatus: record.result === "REPAIRED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: record.failureId, authorSource: "SYSTEM" } });
  return record;
}
export async function listRuntimeAssuranceRepairAttempts(args: Access & { failureId?: string }) { return (await records<RuntimeAssuranceRepairAttempt>(args, "RUNTIME_ASSURANCE_REPAIR_ATTEMPT")).filter((item) => !args.failureId || item.failureId === args.failureId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function assessRuntimeAssurance(args: Access): Promise<RuntimeAssuranceAssessment> {
  const environments = await listRuntimeAssuranceEnvironments(args); const tests = await listRuntimeAssuranceObservedTests(args); const env = environments.find((item) => item.approvalState === "APPROVED" && item.approvalScope === "INDEPENDENTLY_VERIFIED" && current(item.validFrom, item.validUntil)); const gates: RuntimeAssuranceGateAssessment[] = [];
  for (const definition of gateDefinitions) {
    const dependencyStates = definition.dependencies.map((dependency) => gates.find((gate) => gate.gateId === dependency)?.state ?? "UNKNOWN"); const linked = tests.filter((test) => test.gateId === definition.gateId); const independentPass = linked.filter((test) => test.result === "PASS" && test.evidenceOrigin === "EXTERNAL_OBSERVED" && test.evidenceScope === "INDEPENDENTLY_VERIFIED" && test.environmentId === env?.environmentId); const internal = linked.filter((test) => test.evidenceScope === "INTERNAL_VERIFIED"); let state: RuntimeAssuranceGateState = "UNKNOWN"; let determination: RuntimeAssuranceGateAssessment["determination"] = "EVIDENCE_MISSING";
    if (definition.gateId === "G0_APPROVED_TEST_ENVIRONMENT") { state = env ? "PASS" : "BLOCKED"; determination = env ? "OBSERVED_INDEPENDENT_EVIDENCE" : "EXTERNAL_INFRASTRUCTURE_BLOCKED"; }
    else if (dependencyStates.some((item) => item !== "PASS")) { state = "BLOCKED"; determination = "DEPENDENCY_BLOCKED"; }
    else if (linked.some((test) => test.result === "FAIL" || test.result === "INCONCLUSIVE")) { state = linked.some((test) => test.result === "FAIL") ? "FAIL" : "INCONCLUSIVE"; determination = "CONFLICT_OR_INVALIDITY"; }
    else if (independentPass.length) { state = "PASS"; determination = "OBSERVED_INDEPENDENT_EVIDENCE"; }
    gates.push({ gateId: definition.gateId, dependencies: definition.dependencies, state, determination, evidenceIds: independentPass.map((item) => item.assuranceTestId), missingEvidence: state === "PASS" ? [] : definition.missing, internalEvidenceIds: internal.map((item) => item.assuranceTestId), externalReviewRequired: definition.gateId === "G12_INDEPENDENT_REVIEW" || definition.gateId === "G13_PRODUCTION_READINESS" });
  }
  const g13 = gates.at(-1)!; const readiness = g13.state === "PASS" ? "PRODUCTION_READY" : gates.some((gate) => gate.state === "BLOCKED") ? "BLOCKED" : "NOT_READY"; const assessment: RuntimeAssuranceAssessment = { assessmentId: id("ASSURANCE-ASSESSMENT"), projectId: args.projectId, gates, readiness, criticalBlockers: gates.filter((gate) => gate.state !== "PASS").map((gate) => `${gate.gateId}: ${gate.missingEvidence.join(" ")}`), internalVerificationDoesNotAuthorizeProduction: true, externalReviewRequired: true, executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_ASSESSMENT", title: `Runtime assurance assessment · ${assessment.readiness}`, content: JSON.stringify(assessment), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: assessment.assessmentId, authorSource: "SYSTEM" } });
  return assessment;
}
export async function listRuntimeAssuranceAssessments(args: Access) { return (await records<RuntimeAssuranceAssessment>(args, "RUNTIME_ASSURANCE_ASSESSMENT")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function buildRuntimeAssuranceReviewPackage(args: Access & { assessmentId?: string }): Promise<RuntimeAssuranceReviewPackage> {
  const assessment = args.assessmentId ? (await listRuntimeAssuranceAssessments(args)).find((item) => item.assessmentId === args.assessmentId) : (await assessRuntimeAssurance(args)); if (!assessment) throw new Error("A runtime assurance assessment is required.");
  const sections: RuntimeAssuranceReviewPackage["requiredSections"] = ["SANDBOX", "ESCAPE", "RESOURCE", "GMSH", "MESH", "CALCULIX", "NUMERICAL", "RESULT_INTEGRITY", "HOSTILE", "FAILURE_RECOVERY", "REPRODUCIBILITY", "SBOM", "AUDIT", "ENVIRONMENT"]; const presentEvidenceIds = assessment.gates.flatMap((gate) => gate.evidenceIds); const reviewPackage: RuntimeAssuranceReviewPackage = { packageId: id("ASSURANCE-REVIEW-PACKAGE"), projectId: args.projectId, assessment, requiredSections: sections, presentEvidenceIds, missingSections: assessment.gates.filter((gate) => gate.state !== "PASS").map((gate) => gate.gateId), independentReviewerRequired: true, selfApprovalProhibited: true, productionAuthorization: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "RUNTIME_ASSURANCE_REVIEW_PACKAGE", title: `Runtime assurance review package · ${assessment.readiness}`, content: JSON.stringify(reviewPackage), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: assessment.assessmentId, authorSource: "SYSTEM" } });
  return reviewPackage;
}
