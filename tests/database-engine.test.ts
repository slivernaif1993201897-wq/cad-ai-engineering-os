import { describe, expect, it } from "vitest";
import { exportDatabase, importDatabase, verifyDatabaseBackup, type DatabaseSnapshot } from "../server/databaseEngine";

const snapshot: DatabaseSnapshot = {
  schemaVersion: "drizzle-0005-next-nemesis",
  migrationIds: ["0000_elite_eternals", "0001_supreme_rogue", "0002_powerful_captain_midlands", "0003_eager_zzzax", "0004_funny_forgotten_one", "0005_next_nemesis"],
  tables: {
    engineering_projects: [{ id: "P-1", name: "Fixture project", createdAt: "2026-08-29T00:00:00.000Z" }],
    engineering_memory_records: [{ id: "M-1", projectId: "P-1", kind: "CAE_EVIDENCE", content: "validated" }],
    engineering_lineage_nodes: [{ id: "L-1", projectId: "P-1", sourceRecordId: "A-1", status: "VALIDATED" }],
    engineering_cad_files: [{ id: "CAD-1", projectId: "P-1", revision: "rev-7", hash: "sha256:cad" }],
    users: [{ id: "U-1", openId: "owner" }],
  },
};

describe("authoritative database backup engine", () => {
  it("exports deterministic versioned schema-aware backup with SHA-256", () => {
    const first = exportDatabase(snapshot);
    const second = exportDatabase({ ...snapshot, tables: { ...snapshot.tables, users: [...snapshot.tables.users].reverse() } });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ format: "CAD-AI-DATABASE-BACKUP", version: 1, schemaVersion: snapshot.schemaVersion, payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(verifyDatabaseBackup(first, snapshot)).toMatchObject({ valid: true, reason: "DATABASE_BACKUP_VERIFIED" });
  });
  it("rejects corruption before restore", () => {
    const backup = exportDatabase(snapshot);
    const corrupt = { ...backup, tables: { ...backup.tables, users: [{ id: "U-1", openId: "tampered" }] } };
    expect(verifyDatabaseBackup(corrupt).valid).toBe(false);
    expect(() => importDatabase(corrupt, "staging")).toThrow("DATABASE_RESTORE_REJECTED:DATABASE_BACKUP_SHA256_MISMATCH");
  });
  it("rejects schema and migration drift", () => {
    const backup = exportDatabase(snapshot);
    expect(verifyDatabaseBackup(backup, { schemaVersion: "other" })).toMatchObject({ valid: false, reason: "DATABASE_BACKUP_SCHEMA_MISMATCH" });
    expect(verifyDatabaseBackup(backup, { migrationIds: ["0000_elite_eternals"] })).toMatchObject({ valid: false, reason: "DATABASE_BACKUP_MIGRATION_MISMATCH" });
  });
  it("restores only to staging and preserves lineage and CAD references", () => {
    const restored = importDatabase(exportDatabase(snapshot), "staging");
    expect(restored).toMatchObject({ target: "staging", productionWriteAttempted: false, payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(restored.tables.engineering_lineage_nodes).toEqual(snapshot.tables.engineering_lineage_nodes);
    expect(restored.tables.engineering_cad_files).toEqual(snapshot.tables.engineering_cad_files);
    expect(() => importDatabase(exportDatabase(snapshot), "production" as "staging")).toThrow("DATABASE_RESTORE_PRODUCTION_FORBIDDEN");
  });
});
