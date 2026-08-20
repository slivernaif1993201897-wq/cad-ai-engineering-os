import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const fixture = (name: string) => readFile(join(process.cwd(), "tests", "fixtures", name));

describe("Phase 4 engineering viewer scene service", () => {
  it("derives a stable real STEP BRep display scene only from authorized stored source bytes", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 4 STEP scene" });
    const upload = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "model.step", base64: (await fixture("minimal-box.step")).toString("base64") });
    const scene = await caller.engineeringViewer.scene({ projectId: project.id, accessKey: project.accessKey, fileId: upload.file.fileId });

    expect(scene.status).toBe("GEOMETRICALLY_VALID");
    expect(scene.mesh?.representation).toBe("KERNEL_BREP_TESSELLATION");
    expect(scene.mesh?.sourceHash).toBe(upload.file.sha256);
    expect(scene.mesh?.triangles.length).toBeGreaterThan(0);
    expect(scene.entities.find((entity) => entity.kind === "FACE")).toMatchObject({ fileId: upload.file.fileId, sourceFileVersion: 1, provenance: "DERIVED" });
    expect(scene.modelTree.some((node) => node.kind === "SOLID")).toBe(true);
  }, 30_000);

  it("derives an STL scene from parsed triangle records and keeps its units honestly unknown", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 4 STL scene" });
    const upload = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "mesh.stl", base64: (await fixture("minimal-tetrahedron.stl")).toString("base64") });
    const scene = await caller.engineeringViewer.scene({ projectId: project.id, accessKey: project.accessKey, fileId: upload.file.fileId });

    expect(scene.status).toBe("GEOMETRICALLY_VALID");
    expect(scene.mesh).toMatchObject({ representation: "PARSED_STL_TRIANGLES", complete: true });
    expect(scene.mesh?.triangles).toHaveLength(4);
    expect(scene.file.format).toBe("STL");
    expect(scene.limitations.join(" ")).toMatch(/STL|unit/i);
  });

  it("does not create a visual mesh for an invalid source, cannot cross project isolation, and records a non-destructive branch", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 4 viewer security" });
    const invalid = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "bad.stl", base64: (await fixture("invalid.stl")).toString("base64") });
    const unavailable = await caller.engineeringViewer.scene({ projectId: project.id, accessKey: project.accessKey, fileId: invalid.file.fileId });
    expect(unavailable.status).toBe("UNAVAILABLE");
    expect(unavailable.mesh).toBeUndefined();

    const valid = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "branchable.stl", base64: (await fixture("minimal-tetrahedron.stl")).toString("base64") });
    const branch = await caller.engineeringViewer.createBranch({ projectId: project.id, accessKey: project.accessKey, fileId: valid.file.fileId, name: "Concept A", reason: "Preserve a user-requested exploratory branch." });
    const preview = await caller.engineeringViewer.proposalPreview({ projectId: project.id, accessKey: project.accessKey, fileId: valid.file.fileId, proposalId: "PROPOSAL-UNSUPPORTED" });
    const snapshot = await caller.persistentMemory.snapshot({ projectId: project.id, accessKey: project.accessKey });
    expect(branch).toMatchObject({ sourceFileId: valid.file.fileId, status: "PREVIEW" });
    expect(snapshot.lineage.some((node) => node.id === branch.lineageNodeId && node.status === "CONCEPTUAL")).toBe(true);
    expect(preview.status).toBe("UNAVAILABLE");
    expect(preview.reason).toMatch(/cannot regenerate/i);

    const other = await caller.persistentMemory.openProject({ name: "Other project" });
    await expect(caller.engineeringViewer.scene({ projectId: other.id, accessKey: other.accessKey, fileId: valid.file.fileId })).rejects.toThrow(/authorized project/i);
  });
});
