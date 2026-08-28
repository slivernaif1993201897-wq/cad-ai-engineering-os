import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { loadVerifiedCadFileBytes } from "../server/cadFileIntelligence";
import { openPersistentProject, projectMemorySnapshot } from "../server/persistentMemory";
import { executeAuthorizedCncTestPlate } from "../server/sourceLessCadExecution";

describe("authorized source-less CNC execution lifecycle", () => {
  it("creates hash-bound managed bytes with immutable provenance and revision lineage", async () => {
    const project = await openPersistentProject({ name: "Source-less route lifecycle" });
    const execution = await executeAuthorizedCncTestPlate({ projectId: project.id, accessKey: project.accessKey, actor: "USER" });
    const loaded = await loadVerifiedCadFileBytes({ projectId: project.id, accessKey: project.accessKey, fileId: execution.completion.artifact.fileId });
    const snapshot = await projectMemorySnapshot({ projectId: project.id, accessKey: project.accessKey });

    expect(execution.completion.artifact.sha256).toBe(createHash("sha256").update(loaded.bytes).digest("hex"));
    expect(loaded.file).toMatchObject({ projectId: project.id, format: "DXF", validationStatus: "VALID", version: execution.completion.artifact.revision });
    expect(snapshot.records.find((record) => record.id === execution.provenanceRecordId)?.content).toContain(execution.completion.artifact.sha256);
    expect(snapshot.lineage.find((node) => node.id === execution.revisionId)).toMatchObject({ projectId: project.id, kind: "REVISION", status: "VALIDATED", sourceRecordId: execution.provenanceRecordId });
  }, 30_000);

  it("rejects a foreign project access key before any source-less artifact is created", async () => {
    const owner = await openPersistentProject({ name: "Source-less owner" });
    const foreign = await openPersistentProject({ name: "Source-less foreign" });
    await expect(executeAuthorizedCncTestPlate({ projectId: owner.id, accessKey: foreign.accessKey })).rejects.toThrow(/access|denied/i);
  }, 30_000);
});
