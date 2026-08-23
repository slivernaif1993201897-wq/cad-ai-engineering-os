import { describe, expect, it, vi } from "vitest";

const records: Array<{ id: string; kind: string; content: string; sourceRecordId?: string }> = [];
vi.mock("../server/persistentMemory", () => ({
  openPersistentProject: async () => ({ id: "PROJECT-INPUT", accessKey: "test" }),
  projectMemorySnapshot: async () => ({ records }),
  appendPersistentMemory: async ({ record }: { record: { kind: string; content: string; sourceRecordId?: string } }) => { records.unshift({ id: `R-${records.length + 1}`, ...record }); },
}));

import { attachSeatInputEvidence, createSeatInputPackage, updateSeatInputPackage, validateSeatInputPackage } from "../server/seatInputPackage";

const access = { projectId: "PROJECT-INPUT", accessKey: "test" };

describe("typed seat engineering input packages", () => {
  it("rejects an invalid CAD binding without inventing missing engineering values", async () => {
    records.length = 0;
    const item = await createSeatInputPackage({ ...access, input: { seatDesignId: "SEAT-1", seatRevisionId: "REV-1", cadRevisionHash: "not-a-hash", cadArtifactHash: "also-not-a-hash" } });
    expect(item.status).toBe("SECURITY_BLOCKED");
    expect(item.requiredInputs).toEqual(["CAD_REVISION_HASH", "CAD_ARTIFACT_HASH"]);
  });

  it("persists evidence with a cryptographic hash and reports exact required fields while CAD binding is absent", async () => {
    records.length = 0;
    const item = await createSeatInputPackage({ ...access, input: { seatDesignId: "SEAT-1", seatRevisionId: "REV-1", cadRevisionHash: "a".repeat(64), cadArtifactHash: "b".repeat(64) } });
    const attachment = await attachSeatInputEvidence({ ...access, packageId: item.packageId, fileName: "material.pdf", mimeType: "application/pdf", base64: Buffer.from("certificate").toString("base64") });
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    const updated = await updateSeatInputPackage({ ...access, packageId: item.packageId, fields: [{ fieldType: "MATERIAL_CERTIFICATE", value: "CERT-1", unit: "document", source: "USER", applicability: "seat frame", evidenceFileIds: [attachment.attachmentId], approvalStatus: "UNREVIEWED" }] });
    expect(updated.status).toBe("DRAFT");
    const validated = await validateSeatInputPackage({ ...access, packageId: item.packageId });
    expect(validated.status).toBe("REQUIRED_INPUT");
    expect(validated.requiredInputs).toEqual(expect.arrayContaining(["MATERIAL_PROPERTIES:FIELD", "REFERENCE_CRITERION:FIELD", "CAD_ARTIFACT_BINDING"]));
  });
});
