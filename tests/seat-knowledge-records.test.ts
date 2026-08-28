import { describe, expect, it } from "vitest";

import { attachSeatKnowledgeEvidence, approveSeatKnowledgeEntity, createSeatKnowledgeEntity, getSeatKnowledgeAudit, getSeatKnowledgeEntity, listSeatKnowledgeEntities, relateSeatKnowledgeEntities, releaseSeatKnowledgeEntity, reviseSeatKnowledgeEntity, searchSeatKnowledgeRecords } from "../server/seatKnowledgeRecords";
import { openPersistentProject } from "../server/persistentMemory";

const sha = (value: string) => value.repeat(64).slice(0, 64);

describe("normalized persistent SEKB records", () => {
  it("persists typed dimension and constraint records with provenance, immutable release, audit, relation, attachment, scoped search, and ownership isolation", async () => {
    const project = await openPersistentProject({ name: "SEKB normalized record regression" });
    const access = { projectId: project.id, accessKey: project.accessKey };
    const dimension = await createSeatKnowledgeEntity({
      ...access,
      input: {
        entityType: "DIMENSION", externalKey: "CUSHION_WIDTH", name: "Cushion width", description: "User-provided nominal width", valueText: "420", unit: "mm", toleranceText: "User approval required", coordinateReference: "Seat local coordinate system", sourceType: "USER_PROVIDED", sourceReference: "Customer engineering input", evidenceReference: "evidence://dimension-source", createdBy: "EngineeringAuthor",
      },
    });
    expect(dimension.status).toBe("DRAFT");
    const attachment = await attachSeatKnowledgeEvidence({ ...access, entityId: dimension.id, fileName: "dimension-source.pdf", mediaType: "application/pdf", storageReference: "manus-storage/secb-dimension-source", sha256: sha("a"), sourceReference: "Customer engineering input", actor: "EngineeringAuthor" });
    expect(attachment.sha256).toHaveLength(64);
    const approved = await approveSeatKnowledgeEntity({ ...access, entityId: dimension.id, actor: "Reviewer", reason: "Source and attachment reviewed" });
    expect(approved.approvalStatus).toBe("APPROVED");
    const released = await releaseSeatKnowledgeEntity({ ...access, entityId: dimension.id, actor: "ReleaseAuthority", reason: "Released engineering dimension" });
    expect(released.status).toBe("RELEASED");
    await expect(reviseSeatKnowledgeEntity({ ...access, entityId: dimension.id, input: { entityType: "DIMENSION", name: "Cushion width", description: "Changed", sourceType: "USER_PROVIDED", sourceReference: "Customer engineering input", evidenceReference: "evidence://dimension-source", createdBy: "EngineeringAuthor", reason: "Attempt to change released record" } })).rejects.toThrow("SEKB_RELEASED_RECORD_IMMUTABLE");
    const constraint = await createSeatKnowledgeEntity({ ...access, input: { entityType: "CONSTRAINT", externalKey: "CUSHION_CLEARANCE", name: "Cushion clearance", description: "Explicit clearance requirement", valueText: "5", unit: "mm", sourceType: "USER_PROVIDED", sourceReference: "Customer engineering input", evidenceReference: "evidence://constraint-source", createdBy: "EngineeringAuthor" } });
    const relation = await relateSeatKnowledgeEntities({ ...access, sourceEntityId: dimension.id, targetEntityId: constraint.id, relationship: "CONSTRAINS", reason: "Width establishes clearance boundary", evidenceReference: "evidence://constraint-source", actor: "EngineeringAuthor" });
    expect(relation.relationship).toBe("CONSTRAINS");
    const audit = await getSeatKnowledgeAudit({ ...access, entityId: dimension.id });
    expect(audit.auditEvents.map((event) => event.action)).toEqual(expect.arrayContaining(["CREATED", "ATTACHED", "APPROVED", "RELEASED", "RELATED"]));
    const search = await searchSeatKnowledgeRecords({ ...access, query: "Cushion" });
    expect(search.map((record) => record.id)).toEqual(expect.arrayContaining([dimension.id, constraint.id]));
    const bounded = await listSeatKnowledgeEntities({ ...access, entityType: "DIMENSION", limit: 1 });
    expect(bounded.some((record) => record.id === dimension.id)).toBe(true);
    const other = await openPersistentProject({ name: "SEKB foreign project" });
    await expect(getSeatKnowledgeEntity({ projectId: other.id, accessKey: other.accessKey, entityId: dimension.id })).rejects.toThrow("SEKB_ENTITY_NOT_FOUND");
    await expect(searchSeatKnowledgeRecords({ projectId: other.id, accessKey: other.accessKey, query: "Cushion" })).resolves.toEqual([]);
  }, 20_000);
});
