import { createHash, randomUUID } from "crypto";
import { and, asc, desc, eq, like } from "drizzle-orm";

import {
  seatKnowledgeAttachments,
  seatKnowledgeAuditEvents,
  seatKnowledgeEntities,
  seatKnowledgeRelations,
} from "../drizzle/schema";
import { getDb } from "./db";
import { openPersistentProject } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
export type KnowledgeEntityType = typeof seatKnowledgeEntities.entityType.enumValues[number];
export type KnowledgeEntityStatus = typeof seatKnowledgeEntities.status.enumValues[number];

export type KnowledgeEntityInput = {
  seatDesignId?: string;
  seatRevisionId?: string;
  parentEntityId?: string;
  entityType: KnowledgeEntityType;
  externalKey: string;
  name: string;
  description: string;
  valueText?: string;
  unit?: string;
  toleranceText?: string;
  coordinateReference?: string;
  sourceType: typeof seatKnowledgeEntities.sourceType.enumValues[number];
  sourceReference: string;
  evidenceReference?: string;
  artifactHash?: string;
  status?: KnowledgeEntityStatus;
  approvalStatus?: typeof seatKnowledgeEntities.approvalStatus.enumValues[number];
  createdBy: string;
};

const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const now = () => new Date();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function database() {
  const db = await getDb();
  if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  return db;
}

async function authorize(args: Access) {
  await openPersistentProject({ name: "", projectId: args.projectId, accessKey: args.accessKey });
}

function required(value: string | undefined, error: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(error);
  return normalized;
}

function materialize(row: typeof seatKnowledgeEntities.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    releasedAt: row.releasedAt?.toISOString(),
  };
}

async function audit(args: { projectId: string; entityId: string; action: typeof seatKnowledgeAuditEvents.action.enumValues[number]; actor: string; reason: string; priorHash?: string; nextHash?: string }) {
  const db = await database();
  await db.insert(seatKnowledgeAuditEvents).values({ id: id("SEKB_AUDIT"), ...args, createdAt: now() });
}

export async function createSeatKnowledgeEntity(args: Access & { input: KnowledgeEntityInput; revisionOverride?: number }) {
  await authorize(args);
  const input = args.input;
  const externalKey = required(input.externalKey, "SEKB_EXTERNAL_KEY_REQUIRED");
  const name = required(input.name, "SEKB_NAME_REQUIRED");
  const description = required(input.description, "SEKB_DESCRIPTION_REQUIRED");
  const sourceReference = required(input.sourceReference, "SEKB_SOURCE_REQUIRED");
  const createdBy = required(input.createdBy, "SEKB_CREATED_BY_REQUIRED");
  if (input.artifactHash && !/^[a-f0-9]{64}$/i.test(input.artifactHash)) throw new Error("SEKB_ARTIFACT_HASH_INVALID");
  const status = input.status ?? "DRAFT";
  const approvalStatus = input.approvalStatus ?? "UNREVIEWED";
  if (status === "RELEASED" || approvalStatus === "APPROVED") throw new Error("SEKB_REVIEW_ACTION_REQUIRED");
  const revision = args.revisionOverride ?? 1;
  const payload = { ...input, externalKey, name, description, sourceReference, createdBy, status, approvalStatus, revision };
  const entity = {
    id: id("SEKB_ENTITY"), projectId: args.projectId, seatDesignId: input.seatDesignId, seatRevisionId: input.seatRevisionId,
    parentEntityId: input.parentEntityId, entityType: input.entityType, externalKey, name, description,
    valueText: input.valueText, unit: input.unit, toleranceText: input.toleranceText, coordinateReference: input.coordinateReference,
    sourceType: input.sourceType, sourceReference, evidenceReference: input.evidenceReference, artifactHash: input.artifactHash,
    status, approvalStatus, revision, supersedesEntityId: undefined, recordHash: hash(payload), createdBy,
    createdAt: now(), updatedAt: now(), releasedAt: undefined,
  } as typeof seatKnowledgeEntities.$inferInsert;
  const db = await database();
  await db.insert(seatKnowledgeEntities).values(entity);
  await audit({ projectId: args.projectId, entityId: entity.id, action: "CREATED", actor: createdBy, reason: "Persistent engineering knowledge record created", nextHash: entity.recordHash });
  return materialize(entity as typeof seatKnowledgeEntities.$inferSelect);
}

export async function listSeatKnowledgeEntities(args: Access & { entityType?: KnowledgeEntityType; status?: KnowledgeEntityStatus; seatDesignId?: string; seatRevisionId?: string; limit?: number; offset?: number }) {
  await authorize(args);
  const db = await database();
  const conditions = [eq(seatKnowledgeEntities.projectId, args.projectId)];
  if (args.entityType) conditions.push(eq(seatKnowledgeEntities.entityType, args.entityType));
  if (args.status) conditions.push(eq(seatKnowledgeEntities.status, args.status));
  if (args.seatDesignId) conditions.push(eq(seatKnowledgeEntities.seatDesignId, args.seatDesignId));
  if (args.seatRevisionId) conditions.push(eq(seatKnowledgeEntities.seatRevisionId, args.seatRevisionId));
  const rows = await db.select().from(seatKnowledgeEntities).where(and(...conditions)).orderBy(desc(seatKnowledgeEntities.updatedAt)).limit(Math.min(Math.max(args.limit ?? 50, 1), 100)).offset(Math.max(args.offset ?? 0, 0));
  return rows.map(materialize);
}

export async function getSeatKnowledgeEntity(args: Access & { entityId: string }) {
  await authorize(args);
  const db = await database();
  const row = (await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.id, args.entityId))).limit(1))[0];
  if (!row) throw new Error("SEKB_ENTITY_NOT_FOUND");
  return materialize(row);
}

export async function reviseSeatKnowledgeEntity(args: Access & { entityId: string; input: Omit<KnowledgeEntityInput, "externalKey" | "createdBy"> & { createdBy: string; reason: string } }) {
  const prior = await getSeatKnowledgeEntity(args);
  if (prior.status === "RELEASED") throw new Error("SEKB_RELEASED_RECORD_IMMUTABLE");
  const db = await database();
  const revision = prior.revision + 1;
  const next = await createSeatKnowledgeEntity({
    ...args,
    revisionOverride: revision,
    input: { ...args.input, externalKey: prior.externalKey, seatDesignId: args.input.seatDesignId ?? prior.seatDesignId ?? undefined, seatRevisionId: args.input.seatRevisionId ?? prior.seatRevisionId ?? undefined, parentEntityId: args.input.parentEntityId ?? prior.parentEntityId ?? undefined },
  });
  await db.update(seatKnowledgeEntities).set({ status: "SUPERSEDED", updatedAt: now() }).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.id, prior.id)));
  await db.update(seatKnowledgeEntities).set({ revision, supersedesEntityId: prior.id }).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.id, next.id)));
  const revised = await getSeatKnowledgeEntity({ ...args, entityId: next.id });
  await audit({ projectId: args.projectId, entityId: prior.id, action: "SUPERSEDED", actor: args.input.createdBy, reason: args.input.reason, priorHash: prior.recordHash, nextHash: revised.recordHash });
  return revised;
}

export async function approveSeatKnowledgeEntity(args: Access & { entityId: string; actor: string; reason: string }) {
  const entity = await getSeatKnowledgeEntity(args);
  if (entity.status === "RELEASED") throw new Error("SEKB_RELEASED_RECORD_IMMUTABLE");
  if (!entity.evidenceReference || !entity.sourceReference) throw new Error("SEKB_EVIDENCE_REQUIRED_FOR_APPROVAL");
  const db = await database();
  await db.update(seatKnowledgeEntities).set({ status: "APPROVED", approvalStatus: "APPROVED", updatedAt: now() }).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.id, args.entityId)));
  await audit({ projectId: args.projectId, entityId: args.entityId, action: "APPROVED", actor: required(args.actor, "SEKB_ACTOR_REQUIRED"), reason: required(args.reason, "SEKB_APPROVAL_REASON_REQUIRED"), priorHash: entity.recordHash, nextHash: entity.recordHash });
  return getSeatKnowledgeEntity(args);
}

export async function releaseSeatKnowledgeEntity(args: Access & { entityId: string; actor: string; reason: string }) {
  const entity = await getSeatKnowledgeEntity(args);
  if (entity.approvalStatus !== "APPROVED" || entity.status !== "APPROVED") throw new Error("SEKB_APPROVAL_REQUIRED_FOR_RELEASE");
  const db = await database();
  await db.update(seatKnowledgeEntities).set({ status: "RELEASED", releasedAt: now(), updatedAt: now() }).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.id, args.entityId)));
  await audit({ projectId: args.projectId, entityId: args.entityId, action: "RELEASED", actor: required(args.actor, "SEKB_ACTOR_REQUIRED"), reason: required(args.reason, "SEKB_RELEASE_REASON_REQUIRED"), priorHash: entity.recordHash, nextHash: entity.recordHash });
  return getSeatKnowledgeEntity(args);
}

export async function relateSeatKnowledgeEntities(args: Access & { sourceEntityId: string; targetEntityId: string; relationship: string; reason: string; evidenceReference?: string; actor: string }) {
  await authorize(args);
  const [source, target] = await Promise.all([getSeatKnowledgeEntity({ ...args, entityId: args.sourceEntityId }), getSeatKnowledgeEntity({ ...args, entityId: args.targetEntityId })]);
  const relation = { id: id("SEKB_RELATION"), projectId: args.projectId, sourceEntityId: source.id, targetEntityId: target.id, relationship: required(args.relationship, "SEKB_RELATIONSHIP_REQUIRED"), reason: required(args.reason, "SEKB_RELATION_REASON_REQUIRED"), evidenceReference: args.evidenceReference, status: "ACTIVE" as const, createdBy: required(args.actor, "SEKB_ACTOR_REQUIRED"), createdAt: now() };
  const db = await database();
  await db.insert(seatKnowledgeRelations).values(relation);
  await audit({ projectId: args.projectId, entityId: source.id, action: "RELATED", actor: relation.createdBy, reason: relation.reason });
  return { ...relation, createdAt: relation.createdAt.toISOString() };
}

export async function attachSeatKnowledgeEvidence(args: Access & { entityId: string; fileName: string; mediaType: string; storageReference: string; sha256: string; sourceReference: string; actor: string }) {
  await getSeatKnowledgeEntity(args);
  if (!/^[a-f0-9]{64}$/i.test(args.sha256)) throw new Error("SEKB_ATTACHMENT_HASH_INVALID");
  const attachment = { id: id("SEKB_ATTACHMENT"), projectId: args.projectId, entityId: args.entityId, fileName: required(args.fileName, "SEKB_ATTACHMENT_FILENAME_REQUIRED"), mediaType: required(args.mediaType, "SEKB_ATTACHMENT_MEDIA_TYPE_REQUIRED"), storageReference: required(args.storageReference, "SEKB_ATTACHMENT_STORAGE_REQUIRED"), sha256: args.sha256.toLowerCase(), sourceReference: required(args.sourceReference, "SEKB_SOURCE_REQUIRED"), createdAt: now() };
  const db = await database();
  await db.insert(seatKnowledgeAttachments).values(attachment);
  await audit({ projectId: args.projectId, entityId: args.entityId, action: "ATTACHED", actor: required(args.actor, "SEKB_ACTOR_REQUIRED"), reason: "Evidence attachment registered", nextHash: attachment.sha256 });
  return { ...attachment, createdAt: attachment.createdAt.toISOString() };
}

export async function getSeatKnowledgeAudit(args: Access & { entityId: string }) {
  await getSeatKnowledgeEntity(args);
  const db = await database();
  const [auditEvents, attachments, relations] = await Promise.all([
    db.select().from(seatKnowledgeAuditEvents).where(and(eq(seatKnowledgeAuditEvents.projectId, args.projectId), eq(seatKnowledgeAuditEvents.entityId, args.entityId))).orderBy(asc(seatKnowledgeAuditEvents.createdAt)),
    db.select().from(seatKnowledgeAttachments).where(and(eq(seatKnowledgeAttachments.projectId, args.projectId), eq(seatKnowledgeAttachments.entityId, args.entityId))).orderBy(asc(seatKnowledgeAttachments.createdAt)),
    db.select().from(seatKnowledgeRelations).where(and(eq(seatKnowledgeRelations.projectId, args.projectId), eq(seatKnowledgeRelations.sourceEntityId, args.entityId))).orderBy(asc(seatKnowledgeRelations.createdAt)),
  ]);
  return { auditEvents: auditEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })), attachments: attachments.map((attachment) => ({ ...attachment, createdAt: attachment.createdAt.toISOString() })), relations: relations.map((relation) => ({ ...relation, createdAt: relation.createdAt.toISOString() })) };
}

export async function searchSeatKnowledgeRecords(args: Access & { query: string; entityType?: KnowledgeEntityType; status?: KnowledgeEntityStatus; limit?: number }) {
  await authorize(args);
  const query = required(args.query, "SEKB_SEARCH_QUERY_REQUIRED").slice(0, 160);
  const db = await database();
  const conditions = [eq(seatKnowledgeEntities.projectId, args.projectId), like(seatKnowledgeEntities.name, `%${query}%`)];
  if (args.entityType) conditions.push(eq(seatKnowledgeEntities.entityType, args.entityType));
  if (args.status) conditions.push(eq(seatKnowledgeEntities.status, args.status));
  const rows = await db.select().from(seatKnowledgeEntities).where(and(...conditions)).orderBy(desc(seatKnowledgeEntities.updatedAt)).limit(Math.min(Math.max(args.limit ?? 50, 1), 100));
  return rows.map(materialize);
}

export async function invalidateSeatKnowledgeRevision(args: Access & { supersededRevisionId: string; replacementRevisionId: string; actor: string; reason: string }) {
  await authorize(args);
  const db = await database();
  const affected = await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.seatRevisionId, args.supersededRevisionId)));
  await db.update(seatKnowledgeEntities).set({ status: "STALE", updatedAt: now() }).where(and(eq(seatKnowledgeEntities.projectId, args.projectId), eq(seatKnowledgeEntities.seatRevisionId, args.supersededRevisionId)));
  for (const item of affected) await audit({ projectId: args.projectId, entityId: item.id, action: "SUPERSEDED", actor: required(args.actor, "SEKB_ACTOR_REQUIRED"), reason: required(args.reason, "SEKB_INVALIDATION_REASON_REQUIRED"), priorHash: item.recordHash, nextHash: item.recordHash });
  return { staleEntityIds: affected.map((item) => item.id), replacementRevisionId: args.replacementRevisionId };
}
