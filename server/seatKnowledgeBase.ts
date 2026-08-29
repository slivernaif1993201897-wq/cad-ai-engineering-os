import { and, asc, eq } from "drizzle-orm";

import { seatComponents, seatMaterials, seatRequirements, seatTraceLinks } from "../drizzle/schema";
import { getDb } from "./db";
import { getEngineeringJob, listEngineeringJobs } from "./engineeringJob";
import { projectMemorySnapshot } from "./persistentMemory";
import { getSeatDesign, getSeatDesignVerification, listSeatDesigns } from "./seatEngineering";
import { listSeatInputPackages } from "./seatInputPackage";

type Access = { projectId: string; accessKey: string };
type TraceStatus = "READY" | "REQUIRED_INPUT" | "STALE" | "BLOCKED" | "RUNNING" | "COMPLETED" | "VALIDATED" | "NOT_VALIDATED";

export type SeatTraceabilityNode = {
  id: string;
  type: string;
  title: string;
  status: TraceStatus;
  provenance: { projectId: string; revisionId?: string; artifactHash?: string; source?: string };
};

export type SeatTraceabilityEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  reason: string;
  evidence?: Record<string, unknown>;
};

function parseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function state(value: string | undefined): TraceStatus {
  if (value === "REQUIRED_INPUT") return "REQUIRED_INPUT";
  if (value === "READY_FOR_EXECUTION" || value === "APPROVED" || value === "RELEASED") return "READY";
  if (value === "RUNNING") return "RUNNING";
  if (value === "COMPLETED" || value === "VERIFIED_RESULT_AVAILABLE") return "COMPLETED";
  if (value === "VALIDATED" || value === "VALID") return "VALIDATED";
  if (value === "SECURITY_BLOCKED" || value === "BLOCKED" || value === "REJECTED") return "BLOCKED";
  return "NOT_VALIDATED";
}

function node(input: Omit<SeatTraceabilityNode, "provenance"> & { provenance?: SeatTraceabilityNode["provenance"] }): SeatTraceabilityNode {
  return { ...input, provenance: input.provenance ?? { projectId: "" } };
}

function includesQuery(values: Array<string | undefined>, query: string) {
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  return db;
}

/**
 * Returns the explicit product trace for one seat revision. It never manufactures a
 * solver run, evidence record, or validation result: nodes are emitted only when
 * their existing persisted source exists.
 */
export async function getSeatEngineeringTraceability(args: Access & { seatDesignId: string; revisionId?: string; jobId?: string }) {
  const seat = await getSeatDesign(args);
  const revision = args.revisionId
    ? seat.revisions.find((candidate) => candidate.id === args.revisionId)
    : seat.revisions[0];
  if (!revision) throw new Error("SEAT_REVISION_NOT_FOUND");

  const currentRevision = seat.revisions[0];
  const revisionIsStale = currentRevision?.id !== revision.id;
  const db = await database();
  const [components, materials, requirements, links] = await Promise.all([
    db.select().from(seatComponents).where(and(eq(seatComponents.projectId, args.projectId), eq(seatComponents.seatRevisionId, revision.id))).orderBy(asc(seatComponents.name)),
    db.select().from(seatMaterials).where(eq(seatMaterials.projectId, args.projectId)).orderBy(asc(seatMaterials.name)),
    db.select().from(seatRequirements).where(and(eq(seatRequirements.projectId, args.projectId), eq(seatRequirements.seatDesignId, seat.id))).orderBy(asc(seatRequirements.requirementId)),
    db.select().from(seatTraceLinks).where(eq(seatTraceLinks.projectId, args.projectId)).orderBy(asc(seatTraceLinks.createdAt)),
  ]);
  const materialIds = new Set(components.flatMap((component) => component.materialId ? [component.materialId] : []));
  const nodeIds = new Set([seat.id, revision.id, ...components.map((component) => component.id), ...requirements.map((requirement) => requirement.id), ...materialIds]);
  const selectedLinks = links.filter((link) => nodeIds.has(link.sourceId) || nodeIds.has(link.targetId));
  const verification = await getSeatDesignVerification({ ...args, revisionId: revision.id });
  const packages = await listSeatInputPackages({ ...args, seatDesignId: seat.id, seatRevisionId: revision.id });
  const selectedPackage = packages[0];
  const nodes: SeatTraceabilityNode[] = [
    node({ id: `PROJECT:${args.projectId}`, type: "PROJECT", title: "Engineering project", status: "READY", provenance: { projectId: args.projectId } }),
    node({ id: seat.id, type: "SEAT_DESIGN", title: seat.name, status: state(seat.status), provenance: { projectId: args.projectId } }),
    node({ id: revision.id, type: "SEAT_REVISION", title: `Revision ${revision.revisionNumber}`, status: revisionIsStale ? "STALE" : state(revision.status), provenance: { projectId: args.projectId, revisionId: revision.id, source: revision.designSnapshotHash } }),
    ...requirements.map((requirement) => node({ id: requirement.id, type: "REQUIREMENT", title: requirement.requirementId, status: state(requirement.status), provenance: { projectId: args.projectId, revisionId: revision.id, source: requirement.verificationMethod } })),
    ...components.map((component) => node({ id: component.id, type: "COMPONENT", title: component.name, status: revisionIsStale ? "STALE" : "READY", provenance: { projectId: args.projectId, revisionId: revision.id } })),
    ...materials.filter((material) => materialIds.has(material.id)).map((material) => node({ id: material.id, type: "MATERIAL", title: material.name, status: state(material.validationStatus), provenance: { projectId: args.projectId, revisionId: revision.id, source: material.specification } })),
  ];
  const edges: SeatTraceabilityEdge[] = [
    { id: `PROJECT:${args.projectId}->${seat.id}`, sourceId: `PROJECT:${args.projectId}`, targetId: seat.id, relationship: "CONTAINS", reason: "Project-owned seat design" },
    { id: `${seat.id}->${revision.id}`, sourceId: seat.id, targetId: revision.id, relationship: "HAS_REVISION", reason: "Immutable seat design revision" },
    ...selectedLinks.map((link) => ({ id: link.id, sourceId: link.sourceId, targetId: link.targetId, relationship: link.relationship, reason: link.reason, evidence: parseJson(link.evidenceJson) })),
  ];
  if (verification) {
    const cadId = `CAD_ARTIFACT:${verification.cadArtifact.artifactHash}`;
    nodes.push(node({ id: cadId, type: "CAD_ARTIFACT", title: "Seat CAD artifact", status: revisionIsStale ? "STALE" : state(verification.cadArtifact.validationStatus), provenance: { projectId: args.projectId, revisionId: revision.id, artifactHash: verification.cadArtifact.artifactHash, source: verification.cadArtifact.cadRevisionHash } }));
    nodes.push(node({ id: verification.verificationId, type: "CAE_READINESS", title: "Seat verification admission", status: revisionIsStale ? "STALE" : state(verification.state), provenance: { projectId: args.projectId, revisionId: revision.id, artifactHash: verification.cadArtifact.artifactHash } }));
    edges.push({ id: `${revision.id}->${cadId}`, sourceId: revision.id, targetId: cadId, relationship: "GENERATES", reason: "Verified OpenCascade artifact binding" });
    edges.push({ id: `${cadId}->${verification.verificationId}`, sourceId: cadId, targetId: verification.verificationId, relationship: "GOVERNS_ADMISSION", reason: "CAD-bound CAE validation admission" });
  }
  if (selectedPackage) {
    const packageStatus = revisionIsStale ? "STALE" : state(selectedPackage.status);
    nodes.push(node({ id: selectedPackage.packageId, type: "CAE_CONFIGURATION", title: "Engineering input package", status: packageStatus, provenance: { projectId: args.projectId, revisionId: revision.id, artifactHash: selectedPackage.cadArtifactHash, source: selectedPackage.packageHash } }));
    edges.push({ id: `${revision.id}->${selectedPackage.packageId}`, sourceId: revision.id, targetId: selectedPackage.packageId, relationship: "CONFIGURES", reason: "Revision-bound CAE input package" });
    for (const requiredInput of selectedPackage.requiredInputs) {
      nodes.push(node({ id: `${selectedPackage.packageId}:${requiredInput}`, type: "REQUIRED_INPUT", title: requiredInput, status: "REQUIRED_INPUT", provenance: { projectId: args.projectId, revisionId: revision.id } }));
      edges.push({ id: `${selectedPackage.packageId}->${selectedPackage.packageId}:${requiredInput}`, sourceId: selectedPackage.packageId, targetId: `${selectedPackage.packageId}:${requiredInput}`, relationship: "REQUIRES", reason: "Package validation requirement" });
    }
  }
  if (args.jobId) {
    const job = await getEngineeringJob({ ...args, jobId: args.jobId });
    if (!job) throw new Error("ENGINEERING_JOB_NOT_FOUND");
    const jobNodeId = `JOB:${job.jobId}`;
    nodes.push(node({ id: jobNodeId, type: "SOLVER_RUN", title: job.jobId, status: state(job.state), provenance: { projectId: args.projectId, revisionId: revision.id, source: job.manifest?.manifestHash } }));
    edges.push({ id: `${revision.id}->${jobNodeId}`, sourceId: revision.id, targetId: jobNodeId, relationship: "EVALUATES", reason: "Explicitly requested project job" });
    if (job.runtimeEvidence) {
      const evidenceId = `EVIDENCE:${job.runtimeEvidence.evidenceHash}`;
      nodes.push(node({ id: evidenceId, type: "EVIDENCE", title: "Verified runtime evidence", status: "VALIDATED", provenance: { projectId: args.projectId, revisionId: revision.id, artifactHash: job.runtimeEvidence.evidenceHash } }));
      edges.push({ id: `${jobNodeId}->${evidenceId}`, sourceId: jobNodeId, targetId: evidenceId, relationship: "PRODUCES", reason: "Canonical signed runtime evidence" });
    }
  }
  return { projectId: args.projectId, seatDesignId: seat.id, revisionId: revision.id, stale: revisionIsStale, nodes, edges };
}

/** Search existing project-owned engineering records only. No generated or semantic result is returned. */
export async function searchSeatEngineeringKnowledge(args: Access & { query: string }) {
  const query = args.query.trim().toLocaleLowerCase();
  if (!query || query.length > 160) throw new Error("INVALID_ENGINEERING_SEARCH_QUERY");
  const db = await database();
  const [designs, requirements, components, materials, memory, jobs] = await Promise.all([
    listSeatDesigns(args),
    db.select().from(seatRequirements).where(eq(seatRequirements.projectId, args.projectId)),
    db.select().from(seatComponents).where(eq(seatComponents.projectId, args.projectId)),
    db.select().from(seatMaterials).where(eq(seatMaterials.projectId, args.projectId)),
    projectMemorySnapshot(args),
    listEngineeringJobs(args),
  ]);
  const matches = [
    ...designs.filter((item) => includesQuery([item.id, item.name, item.status], query)).map((item) => ({ entityType: "SEAT_DESIGN", id: item.id, title: item.name, status: state(item.status) })),
    ...requirements.filter((item) => includesQuery([item.id, item.requirementId, item.description, item.status], query)).map((item) => ({ entityType: "REQUIREMENT", id: item.id, title: item.requirementId, status: state(item.status) })),
    ...components.filter((item) => includesQuery([item.id, item.name, item.componentType], query)).map((item) => ({ entityType: "COMPONENT", id: item.id, title: item.name, status: "READY" as TraceStatus })),
    ...materials.filter((item) => includesQuery([item.id, item.name, item.specification, item.validationStatus], query)).map((item) => ({ entityType: "MATERIAL", id: item.id, title: item.name, status: state(item.validationStatus) })),
    ...memory.records.filter((item) => includesQuery([item.id, item.title, item.kind, item.truthStatus, item.validationStage], query)).map((item) => ({ entityType: item.kind, id: item.id, title: item.title, status: state(item.truthStatus) })),
    ...jobs.filter((item) => includesQuery([item.jobId, item.state, item.manifest?.manifestHash], query)).map((item) => ({ entityType: "SOLVER_RUN", id: item.jobId, title: item.jobId, status: state(item.state) })),
  ];
  return matches.slice(0, 100);
}
