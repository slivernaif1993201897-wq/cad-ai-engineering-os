import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Project capability keys isolate public-workbench memory without claiming cross-user learning. */
export const engineeringProjects = mysqlTable("engineering_projects", {
  id: varchar("id", { length: 96 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  accessKey: varchar("accessKey", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const engineeringConversations = mysqlTable("engineering_conversations", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "ARCHIVED", "DELETED"]).default("ACTIVE").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
  deletedAt: timestamp("deletedAt"),
}, (table) => [index("engineering_conversations_project_status_idx").on(table.projectId, table.status)]);

export const engineeringConversationEvents = mysqlTable("engineering_conversation_events", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  conversationId: varchar("conversationId", { length: 96 }).notNull(),
  kind: mysqlEnum("kind", ["CREATED", "RENAMED", "ARCHIVED", "RESTORED", "DELETED"]).notNull(),
  priorTitle: varchar("priorTitle", { length: 255 }),
  nextTitle: varchar("nextTitle", { length: 255 }),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("engineering_conversation_events_project_conversation_idx").on(table.projectId, table.conversationId)]);

export const engineeringMessages = mysqlTable("engineering_messages", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  conversationId: varchar("conversationId", { length: 96 }).notNull(),
  role: mysqlEnum("role", ["USER", "CAD_AGENT", "SYSTEM"]).notNull(),
  body: text("body").notNull(),
  mode: varchar("mode", { length: 48 }).notNull(),
  actionKind: varchar("actionKind", { length: 64 }),
  truthStatus: varchar("truthStatus", { length: 64 }).notNull(),
  contextJson: text("contextJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("engineering_messages_project_conversation_idx").on(table.projectId, table.conversationId)]);

export const engineeringMemoryRecords = mysqlTable("engineering_memory_records", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  conversationId: varchar("conversationId", { length: 96 }),
  kind: varchar("kind", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  truthStatus: varchar("truthStatus", { length: 64 }).notNull(),
  validationStage: varchar("validationStage", { length: 64 }).notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 96 }),
  relatedConceptId: varchar("relatedConceptId", { length: 96 }),
  relatedRequirementId: varchar("relatedRequirementId", { length: 96 }),
  relatedConfigurationId: varchar("relatedConfigurationId", { length: 96 }),
  relatedGeometryJson: text("relatedGeometryJson"),
  authorSource: varchar("authorSource", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("engineering_memory_project_kind_idx").on(table.projectId, table.kind), index("engineering_memory_project_conversation_idx").on(table.projectId, table.conversationId)]);

export const engineeringLineageNodes = mysqlTable("engineering_lineage_nodes", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  parentId: varchar("parentId", { length: 96 }),
  sourceRecordId: varchar("sourceRecordId", { length: 96 }),
  title: varchar("title", { length: 255 }).notNull(),
  reasonForChange: text("reasonForChange").notNull(),
  changeSummary: text("changeSummary").notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  authorSource: varchar("authorSource", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("engineering_lineage_project_parent_idx").on(table.projectId, table.parentId)]);

export type EngineeringProject = typeof engineeringProjects.$inferSelect;
export type EngineeringConversation = typeof engineeringConversations.$inferSelect;
export type EngineeringConversationEvent = typeof engineeringConversationEvents.$inferSelect;
export type EngineeringMessage = typeof engineeringMessages.$inferSelect;
export type EngineeringMemoryRecord = typeof engineeringMemoryRecords.$inferSelect;
export type EngineeringLineageNode = typeof engineeringLineageNodes.$inferSelect;

/** Storage references and parser output for untrusted uploaded engineering files. Binary bytes remain in managed object storage. */
export const engineeringCadFiles = mysqlTable("engineering_cad_files", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  conversationId: varchar("conversationId", { length: 96 }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 255 }).notNull(),
  format: mysqlEnum("format", ["STEP", "STL", "DXF", "UNSUPPORTED"]).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: int("sizeBytes").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  version: int("version").notNull(),
  parentFileId: varchar("parentFileId", { length: 96 }),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 768 }).notNull(),
  parser: varchar("parser", { length: 64 }).notNull(),
  parserVersion: varchar("parserVersion", { length: 96 }).notNull(),
  parseStatus: mysqlEnum("parseStatus", ["UPLOADED", "VALIDATING", "PARSED", "PARTIALLY_PARSED", "PARSE_FAILED", "UNSUPPORTED", "CORRUPTED", "REMOVED"]).notNull(),
  validationStatus: mysqlEnum("validationStatus", ["VALID", "INVALID", "UNKNOWN"]).notNull(),
  contextJson: text("contextJson").notNull(),
  parserErrorJson: text("parserErrorJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  removedAt: timestamp("removedAt"),
}, (table) => [
  index("engineering_cad_files_project_hash_idx").on(table.projectId, table.sha256),
  index("engineering_cad_files_project_name_version_idx").on(table.projectId, table.normalizedName, table.version),
  index("engineering_cad_files_project_conversation_idx").on(table.projectId, table.conversationId),
]);

export type EngineeringCadFile = typeof engineeringCadFiles.$inferSelect;

/** Product-domain seat records are project-scoped and never imply CAD/CAE execution without a separately bound engineering job. */
export const seatDesigns = mysqlTable("seat_designs", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["CONCEPT", "REVIEW", "VERIFIED", "RELEASED", "ARCHIVED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("seat_designs_project_status_idx").on(table.projectId, table.status)]);

export const seatRevisions = mysqlTable("seat_revisions", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  seatDesignId: varchar("seatDesignId", { length: 96 }).notNull(),
  revisionNumber: int("revisionNumber").notNull(),
  status: mysqlEnum("status", ["DRAFT", "REVIEW", "VERIFIED", "RELEASED", "SUPERSEDED"]).notNull(),
  description: text("description").notNull(),
  designSnapshotHash: varchar("designSnapshotHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("seat_revisions_design_revision_idx").on(table.seatDesignId, table.revisionNumber), index("seat_revisions_project_idx").on(table.projectId)]);

export const seatMaterials = mysqlTable("seat_materials", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  specification: varchar("specification", { length: 255 }).notNull(),
  propertiesJson: text("propertiesJson").notNull(),
  validationStatus: mysqlEnum("validationStatus", ["UNKNOWN", "VALID", "INVALID"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("seat_materials_project_name_idx").on(table.projectId, table.name)]);

export const seatComponents = mysqlTable("seat_components", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  seatRevisionId: varchar("seatRevisionId", { length: 96 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  componentType: varchar("componentType", { length: 96 }).notNull(),
  materialId: varchar("materialId", { length: 96 }),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("seat_components_revision_idx").on(table.seatRevisionId), index("seat_components_project_idx").on(table.projectId)]);

export const seatRequirements = mysqlTable("seat_requirements", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  seatDesignId: varchar("seatDesignId", { length: 96 }).notNull(),
  requirementId: varchar("requirementId", { length: 96 }).notNull(),
  description: text("description").notNull(),
  constraintJson: text("constraintJson").notNull(),
  verificationMethod: varchar("verificationMethod", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["OPEN", "VERIFIED", "BLOCKED", "REJECTED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("seat_requirements_design_idx").on(table.seatDesignId), index("seat_requirements_project_idx").on(table.projectId)]);

export const seatTraceLinks = mysqlTable("seat_trace_links", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 96 }).notNull(),
  targetType: varchar("targetType", { length: 64 }).notNull(),
  targetId: varchar("targetId", { length: 96 }).notNull(),
  relationship: varchar("relationship", { length: 96 }).notNull(),
  reason: text("reason").notNull(),
  evidenceJson: text("evidenceJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("seat_trace_source_idx").on(table.projectId, table.sourceType, table.sourceId), index("seat_trace_target_idx").on(table.projectId, table.targetType, table.targetId)]);

export type SeatDesign = typeof seatDesigns.$inferSelect;
export type SeatRevision = typeof seatRevisions.$inferSelect;
export type SeatMaterial = typeof seatMaterials.$inferSelect;
export type SeatComponent = typeof seatComponents.$inferSelect;
export type SeatRequirement = typeof seatRequirements.$inferSelect;
export type SeatTraceLink = typeof seatTraceLinks.$inferSelect;

/**
 * Normalized SEKB records complement the existing authoritative seat, CAD, job,
 * and evidence tables. They carry only user-supplied or tool-produced metadata;
 * the OpenCascade and CAE runtimes remain the authoritative artifact producers.
 */
export const seatKnowledgeEntities = mysqlTable("seat_knowledge_entities", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  seatDesignId: varchar("seatDesignId", { length: 96 }),
  seatRevisionId: varchar("seatRevisionId", { length: 96 }),
  parentEntityId: varchar("parentEntityId", { length: 96 }),
  entityType: mysqlEnum("entityType", [
    "ASSEMBLY", "GEOMETRY", "DIMENSION", "CONSTRAINT", "LOAD_CASE",
    "CAE_CONFIGURATION", "MESH", "SOLVER_RUN", "RESULT", "VALIDATION",
    "TEST", "REPORT", "EVIDENCE", "PROVENANCE",
  ]).notNull(),
  externalKey: varchar("externalKey", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  valueText: text("valueText"),
  unit: varchar("unit", { length: 64 }),
  toleranceText: text("toleranceText"),
  coordinateReference: varchar("coordinateReference", { length: 255 }),
  sourceType: mysqlEnum("sourceType", ["USER_PROVIDED", "TOOL_GENERATED", "REFERENCE", "CERTIFICATE", "TEST", "IMPORT"]).notNull(),
  sourceReference: text("sourceReference").notNull(),
  evidenceReference: varchar("evidenceReference", { length: 512 }),
  artifactHash: varchar("artifactHash", { length: 64 }),
  status: mysqlEnum("status", ["DRAFT", "REVIEW", "APPROVED", "RELEASED", "STALE", "SUPERSEDED", "REJECTED", "REQUIRED_INPUT", "COMPUTED", "VALIDATED"]).notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["UNREVIEWED", "PROPOSED", "APPROVED", "REJECTED"]).default("UNREVIEWED").notNull(),
  revision: int("revision").notNull(),
  supersedesEntityId: varchar("supersedesEntityId", { length: 96 }),
  recordHash: varchar("recordHash", { length: 64 }).notNull(),
  createdBy: varchar("createdBy", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  releasedAt: timestamp("releasedAt"),
}, (table) => [
  uniqueIndex("seat_knowledge_entity_identity_idx").on(table.projectId, table.entityType, table.externalKey, table.revision),
  index("seat_knowledge_project_type_status_idx").on(table.projectId, table.entityType, table.status),
  index("seat_knowledge_revision_idx").on(table.seatRevisionId),
  index("seat_knowledge_parent_idx").on(table.projectId, table.parentEntityId),
]);

export const seatKnowledgeRelations = mysqlTable("seat_knowledge_relations", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  sourceEntityId: varchar("sourceEntityId", { length: 96 }).notNull(),
  targetEntityId: varchar("targetEntityId", { length: 96 }).notNull(),
  relationship: varchar("relationship", { length: 96 }).notNull(),
  reason: text("reason").notNull(),
  evidenceReference: varchar("evidenceReference", { length: 512 }),
  status: mysqlEnum("status", ["ACTIVE", "STALE", "SUPERSEDED", "REJECTED"]).default("ACTIVE").notNull(),
  createdBy: varchar("createdBy", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("seat_knowledge_relation_identity_idx").on(table.projectId, table.sourceEntityId, table.targetEntityId, table.relationship),
  index("seat_knowledge_relation_source_idx").on(table.projectId, table.sourceEntityId),
  index("seat_knowledge_relation_target_idx").on(table.projectId, table.targetEntityId),
]);

export const seatKnowledgeAttachments = mysqlTable("seat_knowledge_attachments", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mediaType: varchar("mediaType", { length: 128 }).notNull(),
  storageReference: varchar("storageReference", { length: 768 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  sourceReference: text("sourceReference").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("seat_knowledge_attachment_hash_idx").on(table.projectId, table.entityId, table.sha256),
  index("seat_knowledge_attachment_entity_idx").on(table.projectId, table.entityId),
]);

export const seatKnowledgeAuditEvents = mysqlTable("seat_knowledge_audit_events", {
  id: varchar("id", { length: 96 }).primaryKey(),
  projectId: varchar("projectId", { length: 96 }).notNull(),
  entityId: varchar("entityId", { length: 96 }).notNull(),
  action: mysqlEnum("action", ["CREATED", "UPDATED", "RELATED", "APPROVED", "RELEASED", "SUPERSEDED", "ATTACHED"]).notNull(),
  actor: varchar("actor", { length: 128 }).notNull(),
  reason: text("reason").notNull(),
  priorHash: varchar("priorHash", { length: 64 }),
  nextHash: varchar("nextHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("seat_knowledge_audit_entity_idx").on(table.projectId, table.entityId, table.createdAt),
]);

export type SeatKnowledgeEntity = typeof seatKnowledgeEntities.$inferSelect;
export type SeatKnowledgeRelation = typeof seatKnowledgeRelations.$inferSelect;
export type SeatKnowledgeAttachment = typeof seatKnowledgeAttachments.$inferSelect;
export type SeatKnowledgeAuditEvent = typeof seatKnowledgeAuditEvents.$inferSelect;
