import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { angle3D, distance3D, hitTestViewerFace, presetCamera, projectViewerPoint } from "../lib/engineering-viewer-math";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 4 viewer interaction state", () => {
  it("projects and hit-tests a real parser-derived STL triangle into a stable face reference", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 4 interaction scene" });
    const bytes = await readFile(join(process.cwd(), "tests", "fixtures", "minimal-tetrahedron.stl"));
    const uploaded = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "interaction.stl", base64: bytes.toString("base64") });
    const scene = await caller.engineeringViewer.scene({ projectId: project.id, accessKey: project.accessKey, fileId: uploaded.file.fileId });
    expect(scene.mesh).toBeDefined();
    const camera = presetCamera("ISO"); const viewport = { width: 640, height: 480 }; const triangle = scene.mesh!.triangles[0];
    const points = triangle.map((index) => projectViewerPoint(scene.mesh!.vertices[index], scene, camera, viewport));
    const hit = hitTestViewerFace(scene, camera, viewport, { x: (points[0].x + points[1].x + points[2].x) / 3, y: (points[0].y + points[1].y + points[2].y) / 3 });
    expect(hit?.faceId).toBe(scene.mesh!.faceRanges[0].faceId);
    expect(scene.entities.find((entity) => entity.faceId === hit?.faceId)?.id).toContain(uploaded.file.fileId);
    const sourceVertices = triangle.map((index) => scene.mesh!.vertices[index]) as [[number, number, number], [number, number, number], [number, number, number]];
    expect(distance3D(sourceVertices[0], sourceVertices[1])).toBeGreaterThan(0);
    expect(angle3D(...sourceVertices)).toBeGreaterThan(0);
  });

  it("computes a kernel proposal preview without registering it as a saved configuration", async () => {
    const caller = appRouter.createCaller(ctx);
    const name = `Preview ${Date.now()}`;
    const created = await caller.cadAgent.createConfiguration({ name, sourceText: "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm holes near the corners using a 10 mm edge offset and a 3 mm fillet.", input: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true } });
    const before = await caller.cadAgent.listConfigurations();
    const preview = await caller.cadAgent.previewConfiguration({ configurationId: created.configuration.id, inputPatch: { width: 80 }, updateText: "Preview only: change width to 80 mm." });
    const after = await caller.cadAgent.listConfigurations();
    expect(preview.configuration.id).toMatch(/^PREVIEW-/);
    expect(preview.configuration.input.width).toBe(80);
    expect(preview.viewerMesh?.vertices.length).toBeGreaterThan(0);
    expect(after).toHaveLength(before.length);
    expect(after.some((configuration) => configuration.id === preview.configuration.id)).toBe(false);
  }, 30_000);

  it("passes a real selected viewer face and its authorized file identity into persisted CAD Agent context", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 4 CAD Agent selection" });
    const conversation = await caller.persistentMemory.createConversation({ projectId: project.id, accessKey: project.accessKey, title: "Selection context", reason: "Viewer selection acceptance test" });
    const bytes = await readFile(join(process.cwd(), "tests", "fixtures", "minimal-tetrahedron.stl"));
    const uploaded = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, fileName: "selected.stl", base64: bytes.toString("base64") });
    const scene = await caller.engineeringViewer.scene({ projectId: project.id, accessKey: project.accessKey, fileId: uploaded.file.fileId });
    const face = scene.entities.find((entity) => entity.kind === "FACE");
    if (!face?.faceId) throw new Error("Fixture scene did not return a selectable face.");
    const result = await caller.persistentMemory.message({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, message: "Make this region stronger.", mode: "NORMAL", projectName: project.name, selectedGeometry: { kind: "FACE", id: face.id, label: `FACE · ${face.faceId}`, viewerFaceId: face.faceId, source: "VIEWER" }, requirementSummary: "No validated requirement set", featureSummary: "Imported STL face", parameterSummary: "UNKNOWN", conceptSummary: "No concept", memorySummary: "No prior memory", validationStage: "GEOMETRICALLY_VALIDATED", attachedFileIds: [uploaded.file.fileId] });
    const restored = await caller.persistentMemory.restoreConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id });
    expect(result.userMessage.context.selectedGeometry).toMatchObject({ kind: "FACE", id: face.id, viewerFaceId: face.faceId });
    expect(restored.messages.at(-1)?.context.selectedGeometry).toMatchObject({ id: face.id, source: "VIEWER" });
  });
});
