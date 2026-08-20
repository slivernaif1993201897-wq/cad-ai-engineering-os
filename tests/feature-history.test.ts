import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 4.6 generic parametric feature history", () => {
  it("creates a real rectangular sketch and extrusion through OpenCascade with explicit dependencies and normalized units", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Feature history kernel" });
    const revision = await caller.featureHistory.create({ projectId: project.id, accessKey: project.accessKey, input: { title: "Bracket profile", width: 4, height: 20, extrudeDistance: 3, unit: "cm" } });
    expect(revision).toMatchObject({ status: "KERNEL_VALIDATED", truth: "KERNEL_VALIDATED", geometry: { validation: "VALID", kernel: "OpenCascade.js" } });
    expect(revision.geometry.viewerMesh?.triangles.length).toBeGreaterThan(0); expect(revision.geometry.boundingBox?.size).toEqual([40, 200, 30]);
    expect(revision.features.map((feature) => feature.featureType)).toEqual(["RECTANGLE_SKETCH", "EXTRUDE"]);
    expect(revision.features[0].parameters.map((parameter) => parameter.normalizedValueMm)).toEqual([40, 200]);
    expect(revision.features[1].inputGeometryReferences).toMatchObject([{ id: "REF-SKETCH-001-PROFILE", resolution: "DECLARED" }]);
    const list = await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey }); expect(list.some((item) => item.revisionId === revision.revisionId)).toBe(true);
  }, 35_000);

  it("edits an upstream sketch parameter, regenerates the actual dependent extrusion chain, validates it, creates an immutable second branch, and compares honest metadata", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Feature history regeneration" });
    const base = await caller.featureHistory.create({ projectId: project.id, accessKey: project.accessKey, input: { title: "Base profile", width: 40, height: 20, extrudeDistance: 30, unit: "mm" } });
    const before = await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey });
    const preview = await caller.featureHistory.preview({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "SKETCH-001", parameter: { name: "width", value: 50, unit: "mm" }, targetReferenceId: "REF-SKETCH-001-PROFILE", direction: "NORMAL" } });
    expect(preview).toMatchObject({ status: "PREVIEW", geometry: { validation: "VALID" } }); expect(preview.geometry.boundingBox?.size).toEqual([50, 20, 30]);
    expect((await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey }))).toHaveLength(before.length);
    const executed = await caller.featureHistory.execute({ projectId: project.id, accessKey: project.accessKey, previewRevisionId: preview.revisionId });
    expect(executed).toMatchObject({ status: "KERNEL_VALIDATED", parentRevisionId: base.revisionId }); expect(executed.geometry.boundingBox?.size).toEqual([50, 20, 30]);
    const comparison = await caller.featureHistory.compare({ projectId: project.id, accessKey: project.accessKey, baseRevisionId: base.revisionId, comparedRevisionId: executed.revisionId });
    expect(comparison.sameFeatureDefinitions).toBe(true); expect(comparison.parameterChanges).toContainEqual({ featureId: "SKETCH-001", name: "width", baseValue: 40, comparedValue: 50, unit: "mm" }); expect(comparison.geometryMetadata.deviationAnalysis).toBe("NOT_IMPLEMENTED");
    const list = await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey }); expect(list.map((item) => item.revisionId)).toEqual(expect.arrayContaining([base.revisionId, executed.revisionId])); expect(base.geometry.boundingBox?.size).toEqual([40, 20, 30]);
  }, 45_000);

  it("rejects invalid parameters, unsupported feature types, and invalid topology references without corrupting the prior valid revision and records failures", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Feature history safety" });
    const base = await caller.featureHistory.create({ projectId: project.id, accessKey: project.accessKey, input: { title: "Safe profile", width: 40, height: 20, extrudeDistance: 30, unit: "mm" } });
    const invalidParameter = await caller.featureHistory.preview({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "EXTRUDE-001", parameter: { name: "extrudeDistance", value: 0, unit: "mm" } } });
    expect(invalidParameter).toMatchObject({ status: "FAILED", failure: { stage: "VALIDATION", parameter: "extrudeDistance" } });
    const invalidReference = await caller.featureHistory.preview({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "EXTRUDE-001", targetReferenceId: "REF-STALE-FACE-999", parameter: { name: "extrudeDistance", value: 50, unit: "mm" } } });
    expect(invalidReference).toMatchObject({ status: "FAILED", failure: { stage: "REFERENCE" } });
    const unsupported = await caller.featureHistory.preview({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "EXTRUDE-001", featureType: "REVOLVE", parameter: { name: "extrudeDistance", value: 50, unit: "mm" } } });
    expect(unsupported).toMatchObject({ status: "FAILED", failure: { stage: "VALIDATION" } });
    const diagnosis = await caller.featureHistory.diagnoseFailure({ projectId: project.id, accessKey: project.accessKey });
    const history = await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey }); const snapshot = await caller.persistentMemory.snapshot({ projectId: project.id, accessKey: project.accessKey });
    expect(history).toHaveLength(1); expect(history[0].revisionId).toBe(base.revisionId); expect(history[0].geometry.boundingBox?.size).toEqual([40, 20, 30]); expect(snapshot.records.filter((record) => record.kind === "FEATURE_HISTORY").length).toBeGreaterThanOrEqual(2);
    expect(diagnosis).toMatchObject({ noRecordedFailure: false }); expect(diagnosis.alternatives.length).toBeGreaterThan(0);
  }, 40_000);
});
