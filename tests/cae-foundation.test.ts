import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const circleInput = { title: "CAE foundation offset structural region", centerX: 30, centerY: 0, radius: 5, extrudeDistance: 10, unit: "mm" as const };

describe("Phase 5.0 CAE Agent foundation", () => {
  it("builds an auditable crash-investigation planning artifact from a real kernel-validated CAD revision and refuses fabricated numerical results", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 5.0 difficult mechanical acceptance" });
    const source = await caller.featureHistory.createCircle({ projectId: project.id, accessKey: project.accessKey, input: circleInput });
    expect(source.status).toBe("KERNEL_VALIDATED");
    const plan = await caller.cae.createPlan({ projectId: project.id, accessKey: project.accessKey, input: { projectId: project.id, sourceCadRevision: source.revisionId, sourceCadBranch: "ROOT", engineeringQuestion: "Determine whether this concept should be investigated for crash loading.", selectedGeometry: { kind: "FEATURE", id: "EXTRUDE-CIRCLE-001", label: "Offset circular structural region", featureId: "EXTRUDE-CIRCLE-001", source: "FEATURE_TREE" }, featureHistory: ["CIRCLE-SKETCH-001", "EXTRUDE-CIRCLE-001"], geometryProvenance: "OPENCASCADE_KERNEL", geometryValidation: "VALID", requirementIds: ["REQ-CRASH-INVESTIGATION"] } });
    expect(plan).toMatchObject({ analysisType: "DYNAMIC", status: "NOT_READY", sourceCadRevision: source.revisionId, geometryScope: { geometryProvenance: "OPENCASCADE_KERNEL", geometryValidation: "VALID", selectionStatus: "PROVEN" }, solver: { adapterId: "NO_EXECUTABLE_SOLVER", status: "UNAVAILABLE" }, result: { status: "SOLVER_UNAVAILABLE", numericalResults: [] } });
    expect(plan.unknowns.some((item) => item.kind === "MATERIAL_KNOWLEDGE_GAP")).toBe(true);
    expect(plan.unknowns.some((item) => item.kind === "KNOWLEDGE_GAP" && item.missingInformation.includes("No load"))).toBe(true);
    expect(plan.traceability).toEqual(expect.arrayContaining([expect.objectContaining({ fromType: "GEOMETRY", fromId: source.revisionId, toType: "SIMULATION" }), expect.objectContaining({ fromType: "CAD_FEATURE", fromId: "EXTRUDE-CIRCLE-001" }), expect.objectContaining({ fromType: "REQUIREMENT", fromId: "REQ-CRASH-INVESTIGATION" })]));
    const reviewed = await caller.cae.reviewPlan({ projectId: project.id, accessKey: project.accessKey, simulationId: plan.simulationId });
    expect(reviewed.adversarialReview.map((item) => item.reviewer)).toEqual(["PHYSICS", "BOUNDARY", "MATERIAL", "MESH", "SOLVER", "VALIDATION"]);
    expect(reviewed.adversarialReview.find((item) => item.reviewer === "SOLVER")).toMatchObject({ status: "FAIL", blocking: true });
    expect(reviewed.selfCritique.resultInterpretationRisks.join(" ")).toContain("No numerical output exists");
    const execution = await caller.cae.requestExecution({ projectId: project.id, accessKey: project.accessKey, simulationId: plan.simulationId });
    expect(execution).toMatchObject({ executed: false, result: { status: "SOLVER_UNAVAILABLE", numericalResults: [] } });
  }, 90_000);

  it("validates materials, loads, boundaries, contacts, mesh strategy, physics conflicts, project isolation, and remains solver-blocked even when planning inputs are supplied", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "Phase 5.0 input validation" });
    const source = await caller.featureHistory.createCircle({ projectId: project.id, accessKey: project.accessKey, input: { ...circleInput, title: "CAE validation source" } });
    const completePlan = await caller.cae.createPlan({ projectId: project.id, accessKey: project.accessKey, input: { projectId: project.id, sourceCadRevision: source.revisionId, engineeringQuestion: "Create a static structural simulation plan for the selected mounting interface.", selectedGeometry: { kind: "FEATURE", id: "EXTRUDE-CIRCLE-001", label: "Offset boss", featureId: "EXTRUDE-CIRCLE-001", source: "FEATURE_TREE" }, geometryProvenance: "OPENCASCADE_KERNEL", geometryValidation: "VALID", material: { name: "User-declared material", status: "COMPLETE", properties: [{ name: "ELASTIC_MODULUS", value: 200, unit: "GPa", source: "USER_PROVIDED", requiredFor: ["STATIC_STRUCTURAL"] }, { name: "POISSON_RATIO", value: 0.3, unit: "dimensionless", source: "USER_PROVIDED", requiredFor: ["STATIC_STRUCTURAL"] }] }, boundaryConditions: [{ id: "BC-1", geometryReference: "FEATURE:EXTRUDE-CIRCLE-001", type: "FIXED", direction: "ALL", source: "USER_PROVIDED", confidence: 1, assumptionStatus: "NOT_ASSUMED", geometryStatus: "PROVEN" }], loads: [{ id: "LOAD-1", type: "FORCE", geometryReference: "FEATURE:EXTRUDE-CIRCLE-001", magnitude: 1000, unit: "N", direction: "GLOBAL_Z", source: "USER_PROVIDED", assumptionStatus: "NOT_ASSUMED", geometryStatus: "PROVEN" }], contacts: [{ id: "CONTACT-1", type: "BONDED", primaryGeometryReference: "FEATURE:EXTRUDE-CIRCLE-001", secondaryGeometryReference: "FEATURE:EXTRUDE-CIRCLE-001", source: "USER_PROVIDED", status: "PLANNED" }], meshStrategy: { elementType: "TETRAHEDRAL", targetSize: 2, unit: "mm", refinementRegions: [{ geometryReference: "FEATURE:EXTRUDE-CIRCLE-001", rationale: "Declared load interface", status: "PLANNED" }], qualityRequirements: ["Jacobian quality must be checked after meshing."], convergenceRequirement: "Demonstrate mesh convergence with an executed solver study.", status: "PLANNED" } } });
    expect(completePlan.unknowns.some((item) => item.kind === "MATERIAL_KNOWLEDGE_GAP")).toBe(false);
    expect(completePlan.unknowns.some((item) => item.kind === "KNOWLEDGE_GAP" && item.missingInformation.includes("No load"))).toBe(false);
    expect(completePlan.status).toBe("NOT_READY");
    expect(completePlan.result.status).toBe("SOLVER_UNAVAILABLE");
    const invalid = await caller.cae.createPlan({ projectId: project.id, accessKey: project.accessKey, input: { projectId: project.id, sourceCadRevision: source.revisionId, engineeringQuestion: "Check a static concept", geometryProvenance: "OPENCASCADE_KERNEL", geometryValidation: "VALID", material: { status: "COMPLETE", properties: [{ name: "ELASTIC_MODULUS", value: 0, unit: "GPa", source: "USER_PROVIDED", requiredFor: ["STATIC_STRUCTURAL"] }] }, boundaryConditions: [{ id: "BC-AMBIGUOUS", type: "FIXED", source: "UNKNOWN", confidence: 0, assumptionStatus: "UNKNOWN", geometryStatus: "AMBIGUOUS" }], loads: [{ id: "LOAD-UNKNOWN", type: "FORCE", source: "UNKNOWN", assumptionStatus: "UNKNOWN", geometryStatus: "UNKNOWN" }] } });
    expect(invalid.unknowns.some((item) => item.kind === "MATERIAL_KNOWLEDGE_GAP" && item.missingProperty === "ELASTIC_MODULUS")).toBe(true);
    expect(invalid.unknowns.some((item) => item.kind === "KNOWLEDGE_GAP" && item.missingInformation.includes("ambiguous"))).toBe(true);
    const conflict = await caller.cae.createPlan({ projectId: project.id, accessKey: project.accessKey, input: { projectId: project.id, sourceCadRevision: source.revisionId, engineeringQuestion: "Investigate an infinite energy perpetual crash mechanism", geometryProvenance: "OPENCASCADE_KERNEL", geometryValidation: "VALID" } });
    expect(conflict.unknowns).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "PHYSICS_CONFLICT", truthStatus: "PHYSICS_CONFLICT" })]));
    const other = await caller.persistentMemory.openProject({ name: "Phase 5.0 isolation" });
    const otherPlans = await caller.cae.listPlans({ projectId: other.id, accessKey: other.accessKey });
    expect(otherPlans).toHaveLength(0);
    await expect(caller.cae.listPlans({ projectId: project.id, accessKey: other.accessKey })).rejects.toThrow();
  }, 90_000);
});
