import { createHash } from "node:crypto";

export const DATABASE_BACKUP_FORMAT = "CAD-AI-DATABASE-BACKUP";
export const DATABASE_BACKUP_VERSION = 1;
const REQUIRED_LINEAGE_TABLES = ["engineering_projects", "engineering_memory_records", "engineering_lineage_nodes", "engineering_cad_files"] as const;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DatabaseTables = Record<string, readonly Record<string, JsonValue>[]>;
export type DatabaseSnapshot = {
  schemaVersion: string;
  migrationIds: readonly string[];
  tables: DatabaseTables;
};
export type DatabaseBackup = {
  format: typeof DATABASE_BACKUP_FORMAT;
  version: typeof DATABASE_BACKUP_VERSION;
  schemaVersion: string;
  migrationIds: string[];
  tableNames: string[];
  rowCounts: Record<string, number>;
  tables: Record<string, Record<string, JsonValue>[]>;
  provenanceTables: string[];
  payloadSha256: string;
};
export type StagingRestore = {
  target: "staging";
  schemaVersion: string;
  migrationIds: string[];
  tables: DatabaseTables;
  payloadSha256: string;
  productionWriteAttempted: false;
};
export type BackupVerification = {
  valid: boolean;
  reason: string;
  payloadSha256?: string;
  schemaVersion?: string;
  migrationIds?: string[];
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function normalizeTables(tables: DatabaseTables) {
  return Object.fromEntries(Object.keys(tables).sort().map((tableName) => [tableName, [...tables[tableName]].map((row) => JSON.parse(canonical(row)) as Record<string, JsonValue>).sort((a, b) => canonical(a).localeCompare(canonical(b)))]));
}
function payloadFor(backup: Omit<DatabaseBackup, "payloadSha256">) { return canonical(backup); }

export function exportDatabase(snapshot: DatabaseSnapshot): DatabaseBackup {
  if (!snapshot.schemaVersion.trim() || snapshot.migrationIds.length === 0) throw new Error("DATABASE_EXPORT_SCHEMA_REQUIRED");
  const tables = normalizeTables(snapshot.tables);
  const tableNames = Object.keys(tables);
  const provenanceTables = REQUIRED_LINEAGE_TABLES.filter((table) => tableNames.includes(table));
  if (provenanceTables.length !== REQUIRED_LINEAGE_TABLES.length) throw new Error("DATABASE_EXPORT_PROVENANCE_TABLES_MISSING");
  const unsigned: Omit<DatabaseBackup, "payloadSha256"> = { format: DATABASE_BACKUP_FORMAT, version: DATABASE_BACKUP_VERSION, schemaVersion: snapshot.schemaVersion, migrationIds: [...snapshot.migrationIds].sort(), tableNames, rowCounts: Object.fromEntries(tableNames.map((table) => [table, tables[table].length])), tables, provenanceTables: [...provenanceTables].sort() };
  return { ...unsigned, payloadSha256: sha256(payloadFor(unsigned)) };
}

export function verifyDatabaseBackup(backup: DatabaseBackup, expected?: { schemaVersion?: string; migrationIds?: readonly string[] }): BackupVerification {
  try {
    if (backup.format !== DATABASE_BACKUP_FORMAT || backup.version !== DATABASE_BACKUP_VERSION) return { valid: false, reason: "DATABASE_BACKUP_FORMAT_UNSUPPORTED" };
    if (!backup.schemaVersion || !Array.isArray(backup.migrationIds) || !Array.isArray(backup.tableNames) || !backup.tables || !backup.payloadSha256) return { valid: false, reason: "DATABASE_BACKUP_MANIFEST_INCOMPLETE" };
    const normalized = normalizeTables(backup.tables);
    const unsigned = { format: backup.format, version: backup.version, schemaVersion: backup.schemaVersion, migrationIds: [...backup.migrationIds].sort(), tableNames: [...Object.keys(normalized)].sort(), rowCounts: Object.fromEntries(Object.keys(normalized).sort().map((table) => [table, normalized[table].length])), tables: normalized, provenanceTables: [...backup.provenanceTables].sort() };
    const actual = sha256(payloadFor(unsigned));
    if (actual !== backup.payloadSha256) return { valid: false, reason: "DATABASE_BACKUP_SHA256_MISMATCH", payloadSha256: actual };
    if (expected?.schemaVersion && expected.schemaVersion !== backup.schemaVersion) return { valid: false, reason: "DATABASE_BACKUP_SCHEMA_MISMATCH", schemaVersion: backup.schemaVersion };
    if (expected?.migrationIds && canonical([...expected.migrationIds].sort()) !== canonical([...backup.migrationIds].sort())) return { valid: false, reason: "DATABASE_BACKUP_MIGRATION_MISMATCH", migrationIds: backup.migrationIds };
    if (REQUIRED_LINEAGE_TABLES.some((table) => !backup.provenanceTables.includes(table))) return { valid: false, reason: "DATABASE_BACKUP_PROVENANCE_INCOMPLETE", schemaVersion: backup.schemaVersion };
    if (backup.tableNames.slice().sort().join("\u0000") !== Object.keys(normalized).sort().join("\u0000")) return { valid: false, reason: "DATABASE_BACKUP_TABLE_MANIFEST_MISMATCH" };
    return { valid: true, reason: "DATABASE_BACKUP_VERIFIED", payloadSha256: actual, schemaVersion: backup.schemaVersion, migrationIds: backup.migrationIds };
  } catch { return { valid: false, reason: "DATABASE_BACKUP_MALFORMED" }; }
}

export function importDatabase(backup: DatabaseBackup, target: "staging"): StagingRestore {
  if (target !== "staging") throw new Error("DATABASE_RESTORE_PRODUCTION_FORBIDDEN");
  const verification = verifyDatabaseBackup(backup);
  if (!verification.valid) throw new Error(`DATABASE_RESTORE_REJECTED:${verification.reason}`);
  return { target, schemaVersion: backup.schemaVersion, migrationIds: [...backup.migrationIds], tables: normalizeTables(backup.tables), payloadSha256: backup.payloadSha256, productionWriteAttempted: false };
}
