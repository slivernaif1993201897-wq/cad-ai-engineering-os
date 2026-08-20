import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 4.7 circle sketch and topology stability", () => {
  it("makes the CAD Agent ask targeted questions for incomplete circular bosses and return a bounded executable circle-to-extrude plan only for explicit dimensions", async () => {
    const caller = appRouter.createCaller(ctx);
    const incomplete = await caller.featureHistory.planCircularBoss({ message: "Create a circular boss" }); expect(incomplete).toMatchObject({ status: "OPEN_QUESTION", executable: false }); expect(incomplete.questions ?? []).not.toHaveLength(0);
    const complete = await caller.featureHistory.planCircularBoss({ message: "Create a circular boss with radius 10 mm, extrude 25 mm, center X 0 mm, center Y 0 mm" }); expect(complete).toMatchObject({ status: "READY_FOR_PREVIEW", executable: true, operation: "CIRCLE_SKETCH → EXTRUDE", input: { radius: 10, extrudeDistance: 25, centerX: 0, centerY: 0, unit: "mm" } });
  });

  it("constructs a real OpenCascade CIRCLE_SKETCH → EXTRUDE chain with normalized units, valid geometry, revision-scoped topology evidence, and a STEP geometry export", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Circle kernel history" });
    const circle = await caller.featureHistory.createCircle({ projectId: project.id, accessKey: project.accessKey, input: { title: "Circular boss", centerX: 1, centerY: 2, radius: 1.5, extrudeDistance: 3, unit: "cm" } });
    expect(circle).toMatchObject({ status: "KERNEL_VALIDATED", geometry: { validation: "VALID", kernel: "OpenCascade.js", export: { format: "STEP_GEOMETRY", featureHistory: "NOT_PRESERVED" } } });
    expect(circle.features.map((feature) => feature.featureType)).toEqual(["CIRCLE_SKETCH", "EXTRUDE"]); expect(circle.features[0].parameters.map((parameter) => parameter.normalizedValueMm)).toEqual([10, 20, 15]); expect(circle.geometry.boundingBox?.size[0]).toBeCloseTo(30, 5); expect(circle.geometry.boundingBox?.size[1]).toBeGreaterThan(29); expect(circle.geometry.boundingBox?.size[1]).toBeLessThanOrEqual(30); expect(circle.geometry.boundingBox?.size[2]).toBe(30);
    expect(circle.geometry.export?.status).toBe("AVAILABLE"); expect(circle.geometry.export?.url).toMatch(/^\/manus-storage\//);
    const topology = await caller.featureHistory.topology({ projectId: project.id, accessKey: project.accessKey, revisionId: circle.revisionId });
    expect(topology.counts.bodies).toBeGreaterThan(0); expect(topology.counts.faces).toBeGreaterThan(0); expect(topology.counts.edges).toBeGreaterThan(0); expect(topology.counts.vertices).toBeGreaterThan(0); expect(topology.references.every((reference) => reference.stability === "REVISION_SCOPED")).toBe(true);
    const repeatability = await caller.featureHistory.repeatability({ projectId: project.id, accessKey: project.accessKey, revisionId: circle.revisionId }); expect(repeatability).toMatchObject({ performed: true, sameCounts: true, sameBoundingBox: true, stableIdentityAcrossRegeneration: false });
    const exportInfo = await caller.featureHistory.geometryExport({ projectId: project.id, accessKey: project.accessKey, revisionId: circle.revisionId }); expect(exportInfo).toMatchObject({ status: "AVAILABLE", featureHistory: "NOT_PRESERVED" });
  }, 45_000);

  it("regenerates radius and center through a non-persistent preview into an immutable child revision while preserving the original circle branch", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Circle regeneration" });
    const base = await caller.featureHistory.createCircle({ projectId: project.id, accessKey: project.accessKey, input: { title: "Base circle", centerX: 0, centerY: 0, radius: 10, extrudeDistance: 20, unit: "mm" } });
    const preview = await caller.featureHistory.previewCircle({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "CIRCLE-SKETCH-001", parameter: { name: "radius", value: 15, unit: "mm" } } });
    expect(preview).toMatchObject({ status: "PREVIEW", geometry: { validation: "VALID" } }); expect(preview.geometry.boundingBox?.size[0]).toBeCloseTo(30, 5); expect(preview.geometry.boundingBox?.size[1]).toBeGreaterThan(29); expect(preview.geometry.boundingBox?.size[2]).toBe(20);
    const child = await caller.featureHistory.executeCircle({ projectId: project.id, accessKey: project.accessKey, previewRevisionId: preview.revisionId });
    expect(child).toMatchObject({ status: "KERNEL_VALIDATED", parentRevisionId: base.revisionId }); expect(child.geometry.boundingBox?.size[0]).toBeCloseTo(30, 5); expect(child.geometry.boundingBox?.size[1]).toBeGreaterThan(29); expect(child.geometry.boundingBox?.size[2]).toBe(20); expect(base.geometry.boundingBox?.size[0]).toBeCloseTo(20, 5); expect(base.geometry.boundingBox?.size[1]).toBeGreaterThan(19); expect(base.geometry.boundingBox?.size[2]).toBe(20);
    const compared = await caller.featureHistory.compare({ projectId: project.id, accessKey: project.accessKey, baseRevisionId: base.revisionId, comparedRevisionId: child.revisionId }); expect(compared.parameterChanges).toContainEqual({ featureId: "CIRCLE-SKETCH-001", name: "radius", baseValue: 10, comparedValue: 15, unit: "mm" });
  }, 45_000);

  it("reports topology invalidation and invalid radius without remapping geometry or mutating the prior valid revision, and keeps FILLET_READY false", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Circle topology safety" });
    const base = await caller.featureHistory.createCircle({ projectId: project.id, accessKey: project.accessKey, input: { title: "Topology safe circle", centerX: 0, centerY: 0, radius: 10, extrudeDistance: 20, unit: "mm" } });
    const invalidReference = await caller.featureHistory.previewCircle({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "EXTRUDE-CIRCLE-001", targetReferenceId: "TOPO-STALE-EDGE-001", parameter: { name: "extrudeDistance", value: 25, unit: "mm" } } });
    expect(invalidReference).toMatchObject({ status: "FAILED", failure: { stage: "TOPOLOGY_REFERENCE_INVALIDATED" } });
    const invalidRadius = await caller.featureHistory.previewCircle({ projectId: project.id, accessKey: project.accessKey, sourceRevisionId: base.revisionId, edit: { featureId: "CIRCLE-SKETCH-001", parameter: { name: "radius", value: 0, unit: "mm" } } }); expect(invalidRadius).toMatchObject({ status: "FAILED", failure: { stage: "VALIDATION", parameter: "radius" } });
    const list = await caller.featureHistory.list({ projectId: project.id, accessKey: project.accessKey }); expect(list.filter((revision) => revision.revisionId === base.revisionId)).toHaveLength(1); expect(base.geometry.boundingBox?.size[0]).toBeCloseTo(20, 5); expect(base.geometry.boundingBox?.size[1]).toBeGreaterThan(19); expect(base.geometry.boundingBox?.size[2]).toBe(20);
    const gate = await caller.featureHistory.filletReadiness({ projectId: project.id, accessKey: project.accessKey, revisionId: base.revisionId }); expect(gate.ready).toBe(false); expect(gate.missing).toEqual(expect.arrayContaining(["STABLE_TOPOLOGY_REFERENCES", "DETERMINISTIC_EDGE_IDENTIFICATION"])); expect(gate.missing).not.toContain("REPEATABILITY");
  }, 40_000);
});
