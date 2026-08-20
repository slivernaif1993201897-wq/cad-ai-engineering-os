import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  format: mysqlEnum("format", ["STEP", "STL", "UNSUPPORTED"]).notNull(),
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
