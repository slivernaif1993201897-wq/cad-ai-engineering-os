import { and, asc, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { seatComponents, seatDesigns, seatMaterials, seatRequirements, seatRevisions, seatTraceLinks } from "../drizzle/schema";
import { getEngineeringJob } from "./engineeringJob";
import { getDb } from "./db";
import { openPersistentProject } from "./persistentMemory";

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

type Access = { projectId: string; accessKey: string };
type SeatStatus = "CONCEPT" | "REVIEW" | "VERIFIED" | "RELEASED" | "ARCHIVED";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  return db;
}

async function authorize(access: Access) {
  await openPersistentProject({ name: "", ...access });
}

function date(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

export type SeatDesignInput = {
  name: string;
  description: string;
  requirements: Array<{ requirementId: string; description: string; constraint: Record<string, unknown>; verificationMethod: string }>;
  materials: Array<{ name: string; specification: string; properties: Record<string, unknown>; validationStatus: "UNKNOWN" | "VALID" | "INVALID" }>;
  components: Array<{ name: string; componentType: string; materialName?: string; quantity: number }>;
};

export async function createSeatDesign(args: Access & { input: SeatDesignInput }) {
  await authorize(args);
  const db = await database();
  const name = args.input.name.trim();
  const description = args.input.description.trim();
  if (!name || !description || name.length > 255) throw new Error("INVALID_SEAT_DESIGN_INPUT");
  if (!args.input.requirements.length) throw new Error("SEAT_REQUIREMENTS_REQUIRED");
  if (args.input.components.some((component) => !component.name.trim() || component.quantity < 1 || !Number.isInteger(component.quantity))) throw new Error("INVALID_SEAT_COMPONENT");

  const designId = id("SEAT");
  const revisionId = id("SEAT_REVISION");
  const snapshot = { name, description, requirements: args.input.requirements, materials: args.input.materials, components: args.input.components };
  const designSnapshotHash = hash(snapshot);
  const createdAt = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(seatDesigns).values({ id: designId, projectId: args.projectId, name, status: "CONCEPT", createdAt, updatedAt: createdAt });
    await tx.insert(seatRevisions).values({ id: revisionId, projectId: args.projectId, seatDesignId: designId, revisionNumber: 1, status: "DRAFT", description, designSnapshotHash, createdAt });

    const materialIds = new Map<string, string>();
    for (const material of args.input.materials) {
      const materialId = id("SEAT_MATERIAL");
      materialIds.set(material.name.trim().toLowerCase(), materialId);
      await tx.insert(seatMaterials).values({ id: materialId, projectId: args.projectId, name: material.name.trim(), specification: material.specification.trim(), propertiesJson: JSON.stringify(material.properties), validationStatus: material.validationStatus, createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "SEAT_REVISION", sourceId: revisionId, targetType: "MATERIAL", targetId: materialId, relationship: "SPECIFIES_MATERIAL", reason: "Seat revision material selection", evidenceJson: JSON.stringify({ designSnapshotHash }), createdAt });
    }

    for (const requirement of args.input.requirements) {
      const seatRequirementId = id("SEAT_REQUIREMENT");
      await tx.insert(seatRequirements).values({ id: seatRequirementId, projectId: args.projectId, seatDesignId: designId, requirementId: requirement.requirementId.trim(), description: requirement.description.trim(), constraintJson: JSON.stringify(requirement.constraint), verificationMethod: requirement.verificationMethod.trim(), status: "OPEN", createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "REQUIREMENT", sourceId: seatRequirementId, targetType: "SEAT_REVISION", targetId: revisionId, relationship: "DRIVES_DESIGN", reason: "Declared seat requirement drives this revision", evidenceJson: JSON.stringify({ requirementId: requirement.requirementId }), createdAt });
    }

    for (const component of args.input.components) {
      const componentId = id("SEAT_COMPONENT");
      const materialId = component.materialName ? materialIds.get(component.materialName.trim().toLowerCase()) : undefined;
      await tx.insert(seatComponents).values({ id: componentId, projectId: args.projectId, seatRevisionId: revisionId, name: component.name.trim(), componentType: component.componentType.trim(), materialId: materialId ?? null, quantity: component.quantity, createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "SEAT_REVISION", sourceId: revisionId, targetType: "COMPONENT", targetId: componentId, relationship: "CONTAINS_COMPONENT", reason: "Component declared in seat revision", evidenceJson: JSON.stringify({ quantity: component.quantity }), createdAt });
    }
  });
  return getSeatDesign({ ...args, seatDesignId: designId });
}

export async function createSeatRevision(args: Access & { seatDesignId: string; input: Omit<SeatDesignInput, "name"> }) {
  await authorize(args);
  const db = await database();
  const design = (await db.select().from(seatDesigns).where(and(eq(seatDesigns.projectId, args.projectId), eq(seatDesigns.id, args.seatDesignId))).limit(1))[0];
  if (!design) throw new Error("SEAT_DESIGN_NOT_FOUND");
  if (design.status === "RELEASED" || design.status === "ARCHIVED") throw new Error("SEAT_DESIGN_IMMUTABLE");
  if (!args.input.description.trim() || !args.input.requirements.length || args.input.components.some((component) => !component.name.trim() || component.quantity < 1 || !Number.isInteger(component.quantity))) throw new Error("INVALID_SEAT_REVISION_INPUT");
  const prior = await db.select().from(seatRevisions).where(and(eq(seatRevisions.projectId, args.projectId), eq(seatRevisions.seatDesignId, args.seatDesignId))).orderBy(desc(seatRevisions.revisionNumber));
  const revisionId = id("SEAT_REVISION");
  const createdAt = new Date();
  const designSnapshotHash = hash({ seatDesignId: design.id, description: args.input.description, requirements: args.input.requirements, materials: args.input.materials, components: args.input.components });
  await db.transaction(async (tx) => {
    await tx.insert(seatRevisions).values({ id: revisionId, projectId: args.projectId, seatDesignId: design.id, revisionNumber: (prior[0]?.revisionNumber ?? 0) + 1, status: "DRAFT", description: args.input.description.trim(), designSnapshotHash, createdAt });
    const materialIds = new Map<string, string>();
    for (const material of args.input.materials) {
      const materialId = id("SEAT_MATERIAL");
      materialIds.set(material.name.trim().toLowerCase(), materialId);
      await tx.insert(seatMaterials).values({ id: materialId, projectId: args.projectId, name: material.name.trim(), specification: material.specification.trim(), propertiesJson: JSON.stringify(material.properties), validationStatus: material.validationStatus, createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "SEAT_REVISION", sourceId: revisionId, targetType: "MATERIAL", targetId: materialId, relationship: "SPECIFIES_MATERIAL", reason: "Successor revision material selection", evidenceJson: JSON.stringify({ designSnapshotHash }), createdAt });
    }
    for (const requirement of args.input.requirements) {
      const requirementId = id("SEAT_REQUIREMENT");
      await tx.insert(seatRequirements).values({ id: requirementId, projectId: args.projectId, seatDesignId: design.id, requirementId: requirement.requirementId.trim(), description: requirement.description.trim(), constraintJson: JSON.stringify(requirement.constraint), verificationMethod: requirement.verificationMethod.trim(), status: "OPEN", createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "REQUIREMENT", sourceId: requirementId, targetType: "SEAT_REVISION", targetId: revisionId, relationship: "DRIVES_DESIGN", reason: "Declared requirement drives successor revision", evidenceJson: JSON.stringify({ requirementId: requirement.requirementId }), createdAt });
    }
    for (const component of args.input.components) {
      const componentId = id("SEAT_COMPONENT");
      const materialId = component.materialName ? materialIds.get(component.materialName.trim().toLowerCase()) : undefined;
      await tx.insert(seatComponents).values({ id: componentId, projectId: args.projectId, seatRevisionId: revisionId, name: component.name.trim(), componentType: component.componentType.trim(), materialId: materialId ?? null, quantity: component.quantity, createdAt });
      await tx.insert(seatTraceLinks).values({ id: id("SEAT_TRACE"), projectId: args.projectId, sourceType: "SEAT_REVISION", sourceId: revisionId, targetType: "COMPONENT", targetId: componentId, relationship: "CONTAINS_COMPONENT", reason: "Component declared in successor revision", evidenceJson: JSON.stringify({ quantity: component.quantity }), createdAt });
    }
  });
  await db.update(seatDesigns).set({ status: design.status === "CONCEPT" ? "REVIEW" : design.status, updatedAt: createdAt }).where(and(eq(seatDesigns.projectId, args.projectId), eq(seatDesigns.id, design.id)));
  return getSeatDesign(args);
}

export async function releaseSeatRevision(args: Access & { seatDesignId: string; revisionId: string }) {
  await authorize(args);
  const db = await database();
  const revision = (await db.select().from(seatRevisions).where(and(eq(seatRevisions.projectId, args.projectId), eq(seatRevisions.seatDesignId, args.seatDesignId), eq(seatRevisions.id, args.revisionId))).limit(1))[0];
  if (!revision) throw new Error("SEAT_REVISION_NOT_FOUND");
  if (revision.status === "RELEASED") return getSeatDesign(args);
  const components = await db.select().from(seatComponents).where(and(eq(seatComponents.projectId, args.projectId), eq(seatComponents.seatRevisionId, revision.id)));
  const materials = await db.select().from(seatMaterials).where(eq(seatMaterials.projectId, args.projectId));
  const statusByMaterial = new Map(materials.map((material) => [material.id, material.validationStatus]));
  const requirements = await db.select().from(seatRequirements).where(and(eq(seatRequirements.projectId, args.projectId), eq(seatRequirements.seatDesignId, args.seatDesignId)));
  if (!components.length || components.some((component) => !component.materialId || statusByMaterial.get(component.materialId) !== "VALID")) throw new Error("SEAT_RELEASE_REQUIRES_APPROVED_MATERIALS");
  if (!requirements.length || requirements.some((requirement) => requirement.status !== "VERIFIED")) throw new Error("SEAT_RELEASE_REQUIRES_VERIFIED_REQUIREMENTS");
  await db.transaction(async (tx) => {
    await tx.update(seatRevisions).set({ status: "RELEASED" }).where(and(eq(seatRevisions.projectId, args.projectId), eq(seatRevisions.id, revision.id)));
    await tx.update(seatDesigns).set({ status: "RELEASED", updatedAt: new Date() }).where(and(eq(seatDesigns.projectId, args.projectId), eq(seatDesigns.id, args.seatDesignId)));
  });
  return getSeatDesign(args);
}

export async function getSeatDesign(args: Access & { seatDesignId: string }) {
  await authorize(args);
  const db = await database();
  const design = (await db.select().from(seatDesigns).where(and(eq(seatDesigns.projectId, args.projectId), eq(seatDesigns.id, args.seatDesignId))).limit(1))[0];
  if (!design) throw new Error("SEAT_DESIGN_NOT_FOUND");
  const revisions = await db.select().from(seatRevisions).where(and(eq(seatRevisions.projectId, args.projectId), eq(seatRevisions.seatDesignId, design.id))).orderBy(desc(seatRevisions.revisionNumber));
  const requirements = await db.select().from(seatRequirements).where(and(eq(seatRequirements.projectId, args.projectId), eq(seatRequirements.seatDesignId, design.id))).orderBy(asc(seatRequirements.createdAt));
  const components = revisions.length ? await db.select().from(seatComponents).where(and(eq(seatComponents.projectId, args.projectId), eq(seatComponents.seatRevisionId, revisions[0].id))).orderBy(asc(seatComponents.name)) : [];
  const materials = await db.select().from(seatMaterials).where(eq(seatMaterials.projectId, args.projectId)).orderBy(asc(seatMaterials.name));
  const traceLinks = await db.select().from(seatTraceLinks).where(eq(seatTraceLinks.projectId, args.projectId)).orderBy(desc(seatTraceLinks.createdAt));
  return {
    id: design.id, name: design.name, status: design.status as SeatStatus, createdAt: date(design.createdAt), updatedAt: date(design.updatedAt),
    revisions: revisions.map((revision) => ({ id: revision.id, revisionNumber: revision.revisionNumber, status: revision.status, description: revision.description, designSnapshotHash: revision.designSnapshotHash, createdAt: date(revision.createdAt) })),
    requirements: requirements.map((requirement) => ({ id: requirement.id, requirementId: requirement.requirementId, description: requirement.description, constraint: JSON.parse(requirement.constraintJson), verificationMethod: requirement.verificationMethod, status: requirement.status })),
    components: components.map((component) => ({ id: component.id, name: component.name, componentType: component.componentType, materialId: component.materialId ?? undefined, quantity: component.quantity })),
    materials: materials.map((material) => ({ id: material.id, name: material.name, specification: material.specification, properties: JSON.parse(material.propertiesJson), validationStatus: material.validationStatus })),
    traceLinks: traceLinks.map((link) => ({ id: link.id, sourceType: link.sourceType, sourceId: link.sourceId, targetType: link.targetType, targetId: link.targetId, relationship: link.relationship, reason: link.reason, evidence: JSON.parse(link.evidenceJson) })),
  };
}

export async function listSeatDesigns(args: Access) {
  await authorize(args);
  const db = await database();
  const designs = await db.select().from(seatDesigns).where(eq(seatDesigns.projectId, args.projectId)).orderBy(desc(seatDesigns.updatedAt));
  return designs.map((design) => ({ id: design.id, name: design.name, status: design.status as SeatStatus, createdAt: date(design.createdAt), updatedAt: date(design.updatedAt) }));
}

export async function createSeatEngineeringReport(args: Access & { seatDesignId: string; jobId?: string }) {
  const seat = await getSeatDesign(args);
  const job = args.jobId ? await getEngineeringJob({ ...args, jobId: args.jobId }) : undefined;
  if (args.jobId && !job) throw new Error("ENGINEERING_JOB_NOT_FOUND");
  return {
    reportId: id("SEAT_REPORT"),
    generatedAt: new Date().toISOString(),
    seat,
    engineeringJob: job ? {
      jobId: job.jobId,
      state: job.state,
      requirements: job.requirementSet,
      cad: job.cad,
      cae: job.caeConfiguration,
      manifest: job.manifest,
      runtimeEvidence: job.runtimeEvidence ?? null,
      resultAvailability: job.runtimeEvidence ? "VERIFIED_RESULT_AVAILABLE" : "VERIFIED_RESULT_UNAVAILABLE",
    } : null,
    disclaimer: job?.runtimeEvidence ? "Runtime evidence is verified by the persisted canonical evidence source." : "No solver or result statement is made until a matching verified runtime-evidence record is reconciled.",
  };
}
