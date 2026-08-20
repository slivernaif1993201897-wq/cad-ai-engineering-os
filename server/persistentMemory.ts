import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import {
  engineeringConversationEvents,
  engineeringConversations,
  engineeringLineageNodes,
  engineeringMemoryRecords,
  engineeringMessages,
  engineeringProjects,
} from "../drizzle/schema";
import type {
  DesignLineageNode,
  LineageNodeKind,
  LineageNodeStatus,
  MemoryRecordKind,
  MemoryRetrievalResult,
  PersistentConversation,
  PersistentConversationEvent,
  PersistentMemoryRecord,
  PersistentMessage,
  PersistentProject,
  RestoredConversationContext,
} from "../shared/persistentMemory";
import type { CADAgentContext, GeometrySelectionContext, WorkbenchValidationStage } from "../shared/cadWorkbench";
import type { EngineeringMode } from "../shared/engineeringIntelligence";
import type { EngineeringTruthStatus } from "../shared/engineeringTruth";
import { getDb } from "./db";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const toIso = (value: Date | string | null | undefined) => value ? new Date(value).toISOString() : undefined;

function projectRow(row: typeof engineeringProjects.$inferSelect): PersistentProject {
  return { id: row.id, name: row.name, accessKey: row.accessKey, createdAt: toIso(row.createdAt)!, archivedAt: toIso(row.archivedAt) };
}
function conversationRow(row: typeof engineeringConversations.$inferSelect): PersistentConversation {
  return { id: row.id, projectId: row.projectId, title: row.title, status: row.status, createdAt: toIso(row.createdAt)!, updatedAt: toIso(row.updatedAt)!, archivedAt: toIso(row.archivedAt), deletedAt: toIso(row.deletedAt) };
}
function eventRow(row: typeof engineeringConversationEvents.$inferSelect): PersistentConversationEvent {
  return { id: row.id, projectId: row.projectId, conversationId: row.conversationId, kind: row.kind, priorTitle: row.priorTitle ?? undefined, nextTitle: row.nextTitle ?? undefined, reason: row.reason, createdAt: toIso(row.createdAt)! };
}
function safeJson<T>(value: string | null, fallback: T): T { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function messageRow(row: typeof engineeringMessages.$inferSelect): PersistentMessage {
  return { id: row.id, projectId: row.projectId, conversationId: row.conversationId, role: row.role, text: row.body, mode: row.mode as EngineeringMode, actionKind: row.actionKind ?? undefined, truthStatus: row.truthStatus as EngineeringTruthStatus, context: safeJson(row.contextJson, { selectedGeometry: { kind: "NONE", label: "No geometry selected", source: "NONE" }, requirementSummary: "No restored context", featureSummary: "No restored context", parameterSummary: "No restored context", conceptSummary: "No restored context", memorySummary: "No restored context", validationStage: "CONCEPTUAL" }), createdAt: toIso(row.createdAt)! };
}
function recordRow(row: typeof engineeringMemoryRecords.$inferSelect): PersistentMemoryRecord {
  return { id: row.id, projectId: row.projectId, conversationId: row.conversationId ?? undefined, kind: row.kind as MemoryRecordKind, title: row.title, content: row.content, truthStatus: row.truthStatus as EngineeringTruthStatus, validationStage: row.validationStage as WorkbenchValidationStage, sourceRecordId: row.sourceRecordId ?? undefined, relatedConceptId: row.relatedConceptId ?? undefined, relatedRequirementId: row.relatedRequirementId ?? undefined, relatedConfigurationId: row.relatedConfigurationId ?? undefined, relatedGeometry: safeJson<GeometrySelectionContext | undefined>(row.relatedGeometryJson, undefined), authorSource: row.authorSource as PersistentMemoryRecord["authorSource"], createdAt: toIso(row.createdAt)! };
}
function lineageRow(row: typeof engineeringLineageNodes.$inferSelect): DesignLineageNode {
  return { id: row.id, projectId: row.projectId, kind: row.kind as LineageNodeKind, parentId: row.parentId ?? undefined, sourceRecordId: row.sourceRecordId ?? undefined, title: row.title, reasonForChange: row.reasonForChange, changeSummary: row.changeSummary, status: row.status as LineageNodeStatus, authorSource: row.authorSource as DesignLineageNode["authorSource"], createdAt: toIso(row.createdAt)! };
}

async function database() { const db = await getDb(); if (!db) throw new Error("Persistent engineering memory database is unavailable. No session-only fallback is used for a request that requires durable memory."); return db; }

export async function openPersistentProject(args: { name: string; projectId?: string; accessKey?: string }): Promise<PersistentProject> {
  const db = await database();
  if (args.projectId || args.accessKey) {
    if (!args.projectId || !args.accessKey) throw new Error("Both project ID and project access key are required to reopen persistent memory.");
    const matches = await db.select().from(engineeringProjects).where(and(eq(engineeringProjects.id, args.projectId), eq(engineeringProjects.accessKey, args.accessKey))).limit(1);
    if (!matches[0]) throw new Error("Project memory access was denied. No records from another project were returned.");
    return projectRow(matches[0]);
  }
  const project: PersistentProject = { id: id("PROJECT"), name: args.name.trim() || "Untitled Engineering Project", accessKey: crypto.randomBytes(32).toString("base64url"), createdAt: now() };
  await db.insert(engineeringProjects).values({ id: project.id, name: project.name, accessKey: project.accessKey, createdAt: new Date(project.createdAt) });
  return project;
}

async function authorize(projectId: string, accessKey: string): Promise<PersistentProject> {
  return openPersistentProject({ name: "", projectId, accessKey });
}

async function appendConversationEvent(projectId: string, conversationId: string, kind: PersistentConversationEvent["kind"], reason: string, priorTitle?: string, nextTitle?: string) {
  const db = await database();
  const event: PersistentConversationEvent = { id: id("CONVERSATION_EVENT"), projectId, conversationId, kind, reason, priorTitle, nextTitle, createdAt: now() };
  await db.insert(engineeringConversationEvents).values({ ...event, createdAt: new Date(event.createdAt) });
  return event;
}

export async function createPersistentConversation(args: { projectId: string; accessKey: string; title: string; reason?: string }): Promise<PersistentConversation> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const conversation: PersistentConversation = { id: id("CONVERSATION"), projectId: args.projectId, title: args.title.trim() || "New CAD Agent conversation", status: "ACTIVE", createdAt: now(), updatedAt: now() };
  await db.insert(engineeringConversations).values({ id: conversation.id, projectId: conversation.projectId, title: conversation.title, status: conversation.status, createdAt: new Date(conversation.createdAt), updatedAt: new Date(conversation.updatedAt) });
  await appendConversationEvent(args.projectId, conversation.id, "CREATED", args.reason ?? "Conversation created", undefined, conversation.title);
  return conversation;
}

export async function listPersistentConversations(args: { projectId: string; accessKey: string; includeArchived?: boolean; includeDeleted?: boolean }): Promise<PersistentConversation[]> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const rows = await db.select().from(engineeringConversations).where(eq(engineeringConversations.projectId, args.projectId)).orderBy(desc(engineeringConversations.updatedAt));
  return rows.map(conversationRow).filter((item) => (args.includeDeleted || item.status !== "DELETED") && (args.includeArchived || item.status !== "ARCHIVED"));
}

export async function updatePersistentConversation(args: { projectId: string; accessKey: string; conversationId: string; action: "RENAME" | "ARCHIVE" | "RESTORE" | "DELETE"; title?: string; reason: string }): Promise<PersistentConversation> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const currentRows = await db.select().from(engineeringConversations).where(and(eq(engineeringConversations.projectId, args.projectId), eq(engineeringConversations.id, args.conversationId))).limit(1);
  const current = currentRows[0]; if (!current) throw new Error("Conversation not found in the authorized project.");
  const timestamp = new Date();
  const patch = args.action === "RENAME" ? { title: args.title?.trim() || current.title, updatedAt: timestamp } : args.action === "ARCHIVE" ? { status: "ARCHIVED" as const, archivedAt: timestamp, updatedAt: timestamp } : args.action === "RESTORE" ? { status: "ACTIVE" as const, archivedAt: null, updatedAt: timestamp } : { status: "DELETED" as const, deletedAt: timestamp, updatedAt: timestamp };
  await db.update(engineeringConversations).set(patch).where(and(eq(engineeringConversations.projectId, args.projectId), eq(engineeringConversations.id, args.conversationId)));
  const eventKind = args.action === "RENAME" ? "RENAMED" : args.action === "ARCHIVE" ? "ARCHIVED" : args.action === "RESTORE" ? "RESTORED" : "DELETED";
  await appendConversationEvent(args.projectId, args.conversationId, eventKind, args.reason, current.title, args.action === "RENAME" ? patch.title : current.title);
  const finalRows = await db.select().from(engineeringConversations).where(eq(engineeringConversations.id, args.conversationId)).limit(1);
  return conversationRow(finalRows[0]);
}

export async function appendPersistentMessages(args: { projectId: string; accessKey: string; conversationId: string; messages: Array<Omit<PersistentMessage, "id" | "projectId" | "conversationId" | "createdAt">> }): Promise<PersistentMessage[]> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const conversation = await db.select().from(engineeringConversations).where(and(eq(engineeringConversations.projectId, args.projectId), eq(engineeringConversations.id, args.conversationId), eq(engineeringConversations.status, "ACTIVE"))).limit(1);
  if (!conversation[0]) throw new Error("Messages can only be appended to an active conversation in the authorized project.");
  const records = args.messages.map((message) => ({ id: id("MEMORY_MESSAGE"), projectId: args.projectId, conversationId: args.conversationId, role: message.role, body: message.text, mode: message.mode, actionKind: message.actionKind ?? null, truthStatus: message.truthStatus, contextJson: JSON.stringify(message.context), createdAt: new Date() }));
  if (records.length) await db.insert(engineeringMessages).values(records);
  await db.update(engineeringConversations).set({ updatedAt: new Date() }).where(eq(engineeringConversations.id, args.conversationId));
  return records.map((record) => ({ id: record.id, projectId: args.projectId, conversationId: args.conversationId, role: record.role, text: record.body, mode: record.mode as EngineeringMode, actionKind: record.actionKind ?? undefined, truthStatus: record.truthStatus as EngineeringTruthStatus, context: safeJson(record.contextJson, {} as PersistentMessage["context"]), createdAt: record.createdAt.toISOString() }));
}

export async function appendPersistentMemory(args: { projectId: string; accessKey: string; record: Omit<PersistentMemoryRecord, "id" | "projectId" | "createdAt"> }): Promise<PersistentMemoryRecord> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const record: PersistentMemoryRecord = { ...args.record, id: id("MEMORY"), projectId: args.projectId, createdAt: now() };
  await db.insert(engineeringMemoryRecords).values({ ...record, relatedGeometryJson: record.relatedGeometry ? JSON.stringify(record.relatedGeometry) : null, createdAt: new Date(record.createdAt) });
  return record;
}

export async function appendLineageNode(args: { projectId: string; accessKey: string; node: Omit<DesignLineageNode, "id" | "projectId" | "createdAt"> }): Promise<DesignLineageNode> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  if (args.node.parentId) { const parent = await db.select().from(engineeringLineageNodes).where(and(eq(engineeringLineageNodes.projectId, args.projectId), eq(engineeringLineageNodes.id, args.node.parentId))).limit(1); if (!parent[0]) throw new Error("Lineage parent is not available in the authorized project."); }
  const node: DesignLineageNode = { ...args.node, id: id("LINEAGE"), projectId: args.projectId, createdAt: now() };
  await db.insert(engineeringLineageNodes).values({ ...node, createdAt: new Date(node.createdAt) });
  return node;
}

function queryTokens(query: string) { return query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2); }
function scoreRecord(record: PersistentMemoryRecord, tokens: string[]) { const haystack = `${record.title} ${record.content}`.toLowerCase(); return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0) + (record.kind === "CONCEPT_REJECTED" && tokens.some((token) => token.includes("reject")) ? 4 : 0); }

export async function retrievePersistentMemory(args: { projectId: string; accessKey: string; query: string; limit?: number }): Promise<MemoryRetrievalResult> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const rows = await db.select().from(engineeringMemoryRecords).where(eq(engineeringMemoryRecords.projectId, args.projectId)).orderBy(desc(engineeringMemoryRecords.createdAt));
  const tokens = queryTokens(args.query);
  const records = rows.map(recordRow).map((record) => ({ record, score: scoreRecord(record, tokens) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || b.record.createdAt.localeCompare(a.record.createdAt)).slice(0, args.limit ?? 8).map((entry) => entry.record);
  const noRecordedEvidence = records.length === 0;
  return { query: args.query, projectId: args.projectId, records, sourceConversationIds: [...new Set(records.flatMap((record) => record.conversationId ? [record.conversationId] : []))], noRecordedEvidence, response: noRecordedEvidence ? "NO RECORDED EVIDENCE." : records.map((record, index) => `${index + 1}. ${record.title}: ${record.content} Source: ${record.id}.`).join("\n") };
}

export async function restorePersistentConversation(args: { projectId: string; accessKey: string; conversationId: string }): Promise<RestoredConversationContext> {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const conversations = await db.select().from(engineeringConversations).where(and(eq(engineeringConversations.projectId, args.projectId), eq(engineeringConversations.id, args.conversationId))).limit(1);
  if (!conversations[0] || conversations[0].status === "DELETED") throw new Error("No restorable conversation exists in the authorized project.");
  const messages = (await db.select().from(engineeringMessages).where(and(eq(engineeringMessages.projectId, args.projectId), eq(engineeringMessages.conversationId, args.conversationId))).orderBy(desc(engineeringMessages.createdAt))).reverse().map(messageRow);
  const relevantMemory = (await db.select().from(engineeringMemoryRecords).where(and(eq(engineeringMemoryRecords.projectId, args.projectId), eq(engineeringMemoryRecords.conversationId, args.conversationId))).orderBy(desc(engineeringMemoryRecords.createdAt))).map(recordRow);
  return { conversation: conversationRow(conversations[0]), messages, relevantMemory, restoredContext: messages.at(-1)?.context };
}

export async function projectMemorySnapshot(args: { projectId: string; accessKey: string }) {
  await authorize(args.projectId, args.accessKey);
  const db = await database();
  const [records, nodes, events] = await Promise.all([
    db.select().from(engineeringMemoryRecords).where(eq(engineeringMemoryRecords.projectId, args.projectId)).orderBy(desc(engineeringMemoryRecords.createdAt)),
    db.select().from(engineeringLineageNodes).where(eq(engineeringLineageNodes.projectId, args.projectId)).orderBy(desc(engineeringLineageNodes.createdAt)),
    db.select().from(engineeringConversationEvents).where(eq(engineeringConversationEvents.projectId, args.projectId)).orderBy(desc(engineeringConversationEvents.createdAt)),
  ]);
  return { records: records.map(recordRow), lineage: nodes.map(lineageRow), conversationEvents: events.map(eventRow) };
}
