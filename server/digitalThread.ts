import crypto from "node:crypto";

import type { DigitalThreadArtifact, DigitalThreadArtifactKind, DigitalThreadArtifactState, DigitalThreadAssessment, DigitalThreadRelation, DigitalThreadRelationKind } from "../shared/digitalThread";
import type { EngineeringTruthStatus } from "../shared/engineeringTruth";
import { appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";

type ProjectAccess = { projectId: string; accessKey: string };
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const retention = { historicalRecordPreserved: true as const, deletionPolicy: "NO_SILENT_DELETION" as const };

function parse<T>(content: string): T | undefined { try { return JSON.parse(content) as T; } catch { return undefined; } }

async function artifacts(args: ProjectAccess) {
  const snapshot = await projectMemorySnapshot(args);
  return snapshot.records.filter((record) => record.kind === "DIGITAL_THREAD_ARTIFACT").map((record) => parse<DigitalThreadArtifact>(record.content)).filter((item): item is DigitalThreadArtifact => Boolean(item));
}

async function relations(args: ProjectAccess) {
  const snapshot = await projectMemorySnapshot(args);
  return snapshot.records.filter((record) => record.kind === "DIGITAL_THREAD_RELATION").map((record) => parse<DigitalThreadRelation>(record.content)).filter((item): item is DigitalThreadRelation => Boolean(item));
}

const downstream: DigitalThreadArtifactKind[] = ["CAD_MODEL", "CAD_FEATURE", "CAE_PLAN", "CAE_JOB", "CAE_EVIDENCE", "OPTIMIZATION_STUDY", "OPTIMIZATION_CANDIDATE", "DRAWING_PACKAGE", "BOM_ITEM", "PLM_REVISION", "MANUFACTURING_PLAN", "VERIFICATION_TEST", "REVIEW_GATE", "RELEASE_GATE"];
const expectedSources: Partial<Record<DigitalThreadArtifactKind, DigitalThreadArtifactKind[]>> = {
  CONCEPT: ["REQUIREMENT_SET"],
  CAD_MODEL: ["CONCEPT"],
  CAD_FEATURE: ["CAD_MODEL"],
  CAE_PLAN: ["CAD_MODEL", "CAD_FEATURE"],
  CAE_JOB: ["CAE_PLAN"],
  CAE_EVIDENCE: ["CAE_JOB"],
  OPTIMIZATION_STUDY: ["CAD_MODEL"],
  OPTIMIZATION_CANDIDATE: ["OPTIMIZATION_STUDY"],
  DRAWING_PACKAGE: ["CAD_MODEL", "CAD_FEATURE"],
  BOM_ITEM: ["CAD_MODEL", "CAD_FEATURE"],
  PLM_REVISION: ["CAD_MODEL", "BOM_ITEM", "DRAWING_PACKAGE"],
  MANUFACTURING_PLAN: ["CAD_MODEL", "BOM_ITEM"],
  VERIFICATION_TEST: ["CAE_PLAN", "CAE_EVIDENCE", "CAD_MODEL"],
  REVIEW_GATE: ["VERIFICATION_TEST", "CAE_EVIDENCE"],
  RELEASE_GATE: ["REVIEW_GATE", "PLM_REVISION", "DRAWING_PACKAGE", "BOM_ITEM", "MANUFACTURING_PLAN"],
};

export async function createDigitalThreadArtifact(args: ProjectAccess & { kind: DigitalThreadArtifactKind; title: string; revision: string; state: DigitalThreadArtifactState; truthStatus: EngineeringTruthStatus; sourceArtifactIds: string[]; externalSourceRecordIds: string[]; provenance: string[]; limitations: string[]; declaredBy: string }): Promise<DigitalThreadArtifact> {
  const existing = await artifacts(args);
  const sourceSet = new Set(args.sourceArtifactIds);
  if (sourceSet.size !== args.sourceArtifactIds.length) throw new Error("Digital-thread source artifact IDs must be unique.");
  if (downstream.includes(args.kind) && sourceSet.size === 0) throw new Error(`${args.kind} requires at least one immutable upstream digital-thread artifact.`);
  const missing = args.sourceArtifactIds.filter((sourceArtifactId) => !existing.some((item) => item.artifactId === sourceArtifactId));
  if (missing.length) throw new Error(`Digital-thread sources are unavailable in this authorized project: ${missing.join(", ")}.`);
  const artifact: DigitalThreadArtifact = { artifactId: id("THREAD"), projectId: args.projectId, kind: args.kind, title: args.title, revision: args.revision, state: args.state, truthStatus: args.truthStatus, sourceArtifactIds: args.sourceArtifactIds, externalSourceRecordIds: args.externalSourceRecordIds, provenance: args.provenance, limitations: args.limitations, declaredBy: args.declaredBy, createdAt: now(), retention, executionEligible: false, executable: false };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "DIGITAL_THREAD_ARTIFACT", title: `${artifact.kind} · ${artifact.title} · ${artifact.revision}`, content: JSON.stringify(artifact), truthStatus: artifact.truthStatus, validationStage: "CONCEPTUAL", sourceRecordId: artifact.externalSourceRecordIds[0], relatedConfigurationId: artifact.artifactId, authorSource: "SYSTEM" } });
  return artifact;
}

export async function listDigitalThreadArtifacts(args: ProjectAccess) { return (await artifacts(args)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function createDigitalThreadRelation(args: ProjectAccess & { fromArtifactId: string; toArtifactId: string; kind: DigitalThreadRelationKind; evidenceRecordIds: string[]; state: "DECLARED" | "EVIDENCE_LINKED" | "UNKNOWN"; rationale: string; createdBy: string }): Promise<DigitalThreadRelation> {
  if (args.fromArtifactId === args.toArtifactId) throw new Error("A digital-thread relation cannot link an artifact to itself.");
  const existingArtifacts = await artifacts(args);
  const source = existingArtifacts.find((item) => item.artifactId === args.fromArtifactId);
  const target = existingArtifacts.find((item) => item.artifactId === args.toArtifactId);
  if (!source || !target) throw new Error("Both digital-thread relation endpoints must exist in the authorized project.");
  const existingRelations = await relations(args);
  if (existingRelations.some((item) => item.fromArtifactId === args.fromArtifactId && item.toArtifactId === args.toArtifactId && item.kind === args.kind)) throw new Error("An identical immutable digital-thread relation already exists.");
  const relation: DigitalThreadRelation = { relationId: id("THREAD_RELATION"), projectId: args.projectId, fromArtifactId: args.fromArtifactId, toArtifactId: args.toArtifactId, kind: args.kind, evidenceRecordIds: args.evidenceRecordIds, state: args.state, rationale: args.rationale, createdBy: args.createdBy, createdAt: now(), retention, executionEligible: false, executable: false };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "DIGITAL_THREAD_RELATION", title: `${source.kind} ${relation.kind} ${target.kind}`, content: JSON.stringify(relation), truthStatus: relation.state === "EVIDENCE_LINKED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: source.artifactId, relatedConfigurationId: target.artifactId, authorSource: "SYSTEM" } });
  return relation;
}

export async function listDigitalThreadRelations(args: ProjectAccess) { return (await relations(args)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function assessDigitalThread(args: ProjectAccess): Promise<DigitalThreadAssessment> {
  const [allArtifacts, allRelations] = await Promise.all([artifacts(args), relations(args)]);
  const unresolvedRequirements = allArtifacts.flatMap((artifact) => {
    const requiredKinds = expectedSources[artifact.kind] ?? [];
    if (!requiredKinds.length) return [];
    const sources = allArtifacts.filter((candidate) => artifact.sourceArtifactIds.includes(candidate.artifactId));
    const missing = requiredKinds.filter((kind) => !sources.some((source) => source.kind === kind));
    return missing.length ? [{ artifactId: artifact.artifactId, missing }] : [];
  });
  const limitations = [
    allArtifacts.length ? "All artifacts are declared, evidence-linked, review-required, rejected, stale, or unknown records; none is an engineering release." : "No digital-thread artifacts are recorded.",
    "The release gate is permanently blocked in this foundation because no independent cross-domain release evidence or execution approval exists.",
    ...unresolvedRequirements.map((item) => `${item.artifactId} lacks required upstream artifact kinds: ${item.missing.join(", ")}.`),
  ];
  const state = allArtifacts.length === 0 ? "UNKNOWN" : unresolvedRequirements.length ? "PARTIAL" : "RESOLVED";
  const assessment: DigitalThreadAssessment = { assessmentId: id("THREAD_ASSESSMENT"), projectId: args.projectId, state, artifacts: allArtifacts, relations: allRelations, unresolvedRequirements, limitations, releaseStatus: "BLOCKED", executionEligible: false, executable: false, createdAt: now() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "DIGITAL_THREAD_ASSESSMENT", title: `Digital thread assessment · ${state} · release BLOCKED`, content: JSON.stringify(assessment), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM" } });
  return assessment;
}
