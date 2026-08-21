import crypto from "node:crypto";

import type { OptimizationAssessment, OptimizationCandidate, OptimizationStudy, OptimizationStudyState } from "../shared/optimization";
import { createDigitalThreadArtifact, listDigitalThreadArtifacts } from "./digitalThread";
import { appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";

type ProjectAccess = { projectId: string; accessKey: string };
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const retention = { historicalRecordPreserved: true as const, deletionPolicy: "NO_SILENT_DELETION" as const };
function parse<T>(content: string): T | undefined { try { return JSON.parse(content) as T; } catch { return undefined; } }
async function studies(args: ProjectAccess) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "ENGINEERING_OPTIMIZATION_STUDY").map((record) => parse<OptimizationStudy>(record.content)).filter((item): item is OptimizationStudy => Boolean(item)); }
async function candidates(args: ProjectAccess) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "ENGINEERING_OPTIMIZATION_CANDIDATE").map((record) => parse<OptimizationCandidate>(record.content)).filter((item): item is OptimizationCandidate => Boolean(item)); }

export async function createOptimizationStudy(args: ProjectAccess & Omit<OptimizationStudy, "optimizationStudyId" | "projectId" | "digitalThreadArtifactId" | "evaluationAvailability" | "numericalResultsAvailable" | "createdAt" | "retention" | "executionEligible" | "executable"> & { declaredBy: string }): Promise<OptimizationStudy> {
  if (!args.variables.length || !args.objectives.length) throw new Error("An optimization study requires at least one declared design variable and objective.");
  const artifacts = await listDigitalThreadArtifacts(args);
  const sourceArtifacts = artifacts.filter((item) => args.sourceArtifactIds.includes(item.artifactId));
  if (!sourceArtifacts.some((item) => item.kind === "CAD_MODEL")) throw new Error("A conceptual optimization study requires a project-scoped CAD model artifact.");
  if (args.variables.some((variable) => !artifacts.some((artifact) => artifact.artifactId === variable.sourceArtifactId))) throw new Error("Every optimization variable must reference an immutable project-scoped artifact.");
  if (args.objectives.some((objective) => objective.evaluationAvailability === "NUMERICAL_CAE_UNAVAILABLE" && objective.truthStatus === "CALCULATED")) throw new Error("A numerical-unavailable objective cannot be represented as CALCULATED.");
  const artifact = await createDigitalThreadArtifact({ ...args, kind: "OPTIMIZATION_STUDY", title: args.title, revision: args.revision, sourceArtifactIds: args.sourceArtifactIds, externalSourceRecordIds: [], state: args.state === "REJECTED" ? "REJECTED" : "REVIEW_REQUIRED", truthStatus: "UNVERIFIED", provenance: args.provenance, limitations: [...args.limitations, "Numerical CAE evaluation is unavailable; no objective metric or candidate ranking is generated."], declaredBy: args.declaredBy });
  const study: OptimizationStudy = { optimizationStudyId: id("OPTIMIZATION_STUDY"), projectId: args.projectId, digitalThreadArtifactId: artifact.artifactId, title: args.title, revision: args.revision, sourceArtifactIds: args.sourceArtifactIds, method: args.method, variables: args.variables, objectives: args.objectives, constraints: args.constraints, state: args.state, evaluationAvailability: "NUMERICAL_CAE_UNAVAILABLE", numericalResultsAvailable: false, provenance: args.provenance, limitations: [...args.limitations, "Candidate generation is conceptual only and does not create numerical objective or constraint values."], createdAt: now(), retention, executionEligible: false, executable: false };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_OPTIMIZATION_STUDY", title: `Optimization study · ${study.title} · ${study.revision}`, content: JSON.stringify(study), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: study.digitalThreadArtifactId, authorSource: "SYSTEM" } });
  return study;
}
export async function listOptimizationStudies(args: ProjectAccess) { return (await studies(args)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function createOptimizationCandidate(args: ProjectAccess & { optimizationStudyId: string; candidateLabel: string; parameterValues: OptimizationCandidate["parameterValues"]; sourceArtifactIds: string[]; provenance: string[]; limitations: string[]; declaredBy: string }): Promise<OptimizationCandidate> {
  const study = (await studies(args)).find((item) => item.optimizationStudyId === args.optimizationStudyId);
  if (!study) throw new Error("The optimization study is unavailable in this authorized project.");
  const variableIds = new Set(study.variables.map((item) => item.variableId));
  if (!args.parameterValues.length || args.parameterValues.some((item) => !variableIds.has(item.variableId))) throw new Error("Every conceptual candidate requires one or more values for declared study variables only.");
  if (new Set(args.parameterValues.map((item) => item.variableId)).size !== args.parameterValues.length) throw new Error("A conceptual candidate cannot duplicate a design variable value.");
  const artifact = await createDigitalThreadArtifact({ ...args, kind: "OPTIMIZATION_CANDIDATE", title: args.candidateLabel, revision: study.revision, sourceArtifactIds: [study.digitalThreadArtifactId, ...args.sourceArtifactIds], externalSourceRecordIds: [], state: "REVIEW_REQUIRED", truthStatus: "UNVERIFIED", provenance: args.provenance, limitations: [...args.limitations, "No numerical evaluation, ranking, Pareto selection, or CAD regeneration was performed."], declaredBy: args.declaredBy });
  const candidate: OptimizationCandidate = { candidateId: id("OPTIMIZATION_CANDIDATE"), projectId: args.projectId, optimizationStudyId: study.optimizationStudyId, digitalThreadArtifactId: artifact.artifactId, candidateLabel: args.candidateLabel, parameterValues: args.parameterValues, sourceArtifactIds: args.sourceArtifactIds, evaluationStatus: "NOT_EVALUATED", objectiveValues: [], constraintValues: [], rankingState: "BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE", rankAssigned: false, validity: "CONCEPTUAL_ONLY", provenance: args.provenance, limitations: [...args.limitations, "Parameter values are declared candidates, not evaluated design outcomes."], createdAt: now(), retention, executionEligible: false, executable: false };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_OPTIMIZATION_CANDIDATE", title: `Optimization candidate · ${candidate.candidateLabel}`, content: JSON.stringify(candidate), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: candidate.digitalThreadArtifactId, authorSource: "SYSTEM" } });
  return candidate;
}
export async function listOptimizationCandidates(args: ProjectAccess & { optimizationStudyId?: string }) { const values = await candidates(args); return values.filter((candidate) => !args.optimizationStudyId || candidate.optimizationStudyId === args.optimizationStudyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function assessOptimizationStudy(args: ProjectAccess & { optimizationStudyId: string }): Promise<OptimizationAssessment> {
  const study = (await studies(args)).find((item) => item.optimizationStudyId === args.optimizationStudyId);
  if (!study) throw new Error("The optimization study is unavailable in this authorized project.");
  const assessment: OptimizationAssessment = { assessmentId: id("OPTIMIZATION_ASSESSMENT"), projectId: args.projectId, optimizationStudy: study, candidates: (await candidates(args)).filter((candidate) => candidate.optimizationStudyId === study.optimizationStudyId), rankingState: "BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE", limitations: ["No numerical CAE evidence is available.", "No objective, constraint, sensitivity, Pareto, or ranking result is generated.", "Candidate values remain conceptual declarations pending verified evaluation."], executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_OPTIMIZATION_ASSESSMENT", title: `Optimization assessment · ${study.title} · ranking blocked`, content: JSON.stringify(assessment), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", sourceRecordId: study.digitalThreadArtifactId, authorSource: "SYSTEM" } });
  return assessment;
}
