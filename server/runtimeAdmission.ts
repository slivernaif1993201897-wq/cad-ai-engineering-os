import { createHash, randomUUID } from "node:crypto";

import type { RuntimeAdmissionDecision, RuntimeAdmissionReasonCode } from "../shared/runtimeAdmission";
import { listCAEJobContracts } from "./caeJobContract";
import { assessRuntimeAssurance, listRuntimeAssuranceEnvironments } from "./runtimeAssurance";
import { listSolverConfigurationRegistry } from "./solverConfigurationGovernance";
import { listSolverInputPackages } from "./solverInputPackage";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
type AdmissionInput = { requestedAction: RuntimeAdmissionDecision["requestedAction"]; canonicalJobId: string; solverInputPackageId: string; configurationId: string; environmentId: string };
const now = () => new Date().toISOString();
const id = () => `RUNTIME-ADMISSION-${randomUUID()}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const parse = <T,>(value: string): T | undefined => { try { return JSON.parse(value) as T; } catch { return undefined; } };
const current = (from: string, until: string) => { const start = Date.parse(from); const end = Date.parse(until); return Number.isFinite(start) && Number.isFinite(end) && start <= Date.now() && end >= Date.now(); };

async function authorize(access: Access) { await openPersistentProject({ projectId: access.projectId, accessKey: access.accessKey, name: "" }); }

export async function evaluateRuntimeAdmission(args: Access & AdmissionInput): Promise<RuntimeAdmissionDecision> {
  await authorize(args);
  const [jobs, packages, configurations, environments] = await Promise.all([
    listCAEJobContracts(args),
    listSolverInputPackages(args),
    listSolverConfigurationRegistry(args),
    listRuntimeAssuranceEnvironments(args),
  ]);
  const reasonCodes: RuntimeAdmissionReasonCode[] = [];
  const reasons: string[] = [];
  const job = jobs.find((item) => item.jobId === args.canonicalJobId);
  const pkg = packages.find((item) => item.packageId === args.solverInputPackageId);
  const configuration = configurations.find((item) => item.configurationId === args.configurationId);
  const environment = environments.find((item) => item.environmentId === args.environmentId);
  const assessment = await assessRuntimeAssurance(args);
  if (!job) { reasonCodes.push("CANONICAL_JOB_MISSING"); reasons.push("The requested canonical CAE job is unavailable in this authorized project."); }
  if (!pkg) { reasonCodes.push("SOLVER_INPUT_PACKAGE_MISSING"); reasons.push("The requested immutable solver input package is unavailable in this authorized project."); }
  if (job && pkg && pkg.jobId !== job.jobId) { reasonCodes.push("PACKAGE_JOB_MISMATCH"); reasons.push("The solver input package does not bind to the requested canonical CAE job."); }
  if (!configuration) { reasonCodes.push("SOLVER_CONFIGURATION_MISSING"); reasons.push("The requested reviewed solver configuration is unavailable in this authorized project."); }
  if (pkg && configuration && (pkg.solverConfiguration.configurationId !== configuration.configurationId || pkg.solverConfiguration.configurationHash !== configuration.configurationHash)) { reasonCodes.push("PACKAGE_CONFIGURATION_MISMATCH"); reasons.push("The package configuration identity or hash does not match the requested immutable configuration."); }
  if (!environment) { reasonCodes.push("ENVIRONMENT_MISSING"); reasons.push("No runtime environment record matches the requested environment identity."); }
  if (environment && !current(environment.validFrom, environment.validUntil)) { reasonCodes.push("ENVIRONMENT_EVIDENCE_NOT_CURRENT"); reasons.push("The runtime environment evidence is expired, future-dated, malformed, or otherwise not current; admission fails closed."); }
  if (environment && (environment.approvalState !== "APPROVED" || environment.approvalScope !== "INDEPENDENTLY_VERIFIED")) { reasonCodes.push("ENVIRONMENT_NOT_INDEPENDENTLY_APPROVED"); reasons.push("The environment is not currently independently approved for an observed segregated test context."); }
  if (assessment.gates.some((gate) => gate.state !== "PASS")) { reasonCodes.push("RUNTIME_ASSURANCE_GATES_NOT_PASS"); reasons.push("Runtime assurance gates lack complete independently observed PASS evidence; admission fails closed."); }
  reasonCodes.push("EXECUTION_ENGINE_NOT_IMPLEMENTED");
  reasons.push("CAD-AI contains no execution engine, process launcher, solver adapter runtime, shell, filesystem, or network dispatch path; the request is recorded only.");
  const state: RuntimeAdmissionDecision["state"] = reasonCodes.some((code) => ["CANONICAL_JOB_MISSING", "SOLVER_INPUT_PACKAGE_MISSING", "SOLVER_CONFIGURATION_MISSING", "ENVIRONMENT_MISSING"].includes(code)) ? "REJECTED" : "BLOCKED";
  const createdAt = now();
  const decisionHash = hash({ requestedAction: args.requestedAction, canonicalJobId: args.canonicalJobId, solverInputPackageId: args.solverInputPackageId, configurationId: args.configurationId, environmentId: args.environmentId, state, reasonCodes, assessmentId: assessment?.assessmentId, createdAt });
  const decision: RuntimeAdmissionDecision = { admissionDecisionId: id(), projectId: args.projectId, requestedAction: args.requestedAction, canonicalJobId: args.canonicalJobId, solverInputPackageId: args.solverInputPackageId, configurationId: args.configurationId, environmentId: args.environmentId, state, reasonCodes, reasons, referencedAssessmentId: assessment?.assessmentId, decisionHash, recordOnly: true, executionStarted: false, executionEligible: false, executable: false, createdAt };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_RUNTIME_ADMISSION_DECISION", title: `Runtime admission · ${decision.requestedAction} · ${decision.state}`, content: JSON.stringify(decision), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: decision.admissionDecisionId, authorSource: "SYSTEM" } });
  return decision;
}

export async function listRuntimeAdmissionDecisions(args: Access): Promise<RuntimeAdmissionDecision[]> {
  await authorize(args);
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === "CAE_RUNTIME_ADMISSION_DECISION")
    .flatMap((record) => { const decision = parse<RuntimeAdmissionDecision>(record.content); return decision ? [decision] : []; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
