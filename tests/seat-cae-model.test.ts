import { describe, expect, it } from "vitest";

import { generateSeatCadArtifact, type SeatParametricModel } from "../server/seatCadEngine";
import { createSeatCaeConfiguration } from "../server/seatCaeModel";

const model: SeatParametricModel = {
  seatRevisionId: "SEAT-REVISION-CAE-001",
  identity: { designName: "Seat CAE fixture", revisionNumber: 1 },
  dimensionsMm: { cushionWidth: 480, cushionDepth: 460, cushionThickness: 80, backHeight: 520, backThickness: 60, supportWidth: 35, supportThickness: 35, frameDepth: 330, frameHeight: 45, mountRadius: 12, mountHeight: 35 },
  materials: { cushion: "PU foam", back: "Trim shell", frame: "HSLA steel", supports: "HSLA steel" },
  constraints: { minimumBackHeight: 400, minimumMountClearance: 25 },
};

describe("seat CAE explicit configuration", () => {
  it("binds explicit CAE inputs to the real seat CAD artifact but refuses unsupported axial-cantilever dispatch", async () => {
    const artifact = await generateSeatCadArtifact(model);
    const configuration = createSeatCaeConfiguration(artifact, {
      material: { elasticModulusMpa: 210000, poissonRatio: 0.3, source: "USER_APPROVED_MATERIAL_RECORD" },
      mountFixtures: ["MOUNT_FL", "MOUNT_FR", "MOUNT_RL", "MOUNT_RR"].map((targetFeatureId, index) => ({ id: `SEAT-MOUNT-${index + 1}`, targetFeatureId: targetFeatureId as "MOUNT_FL", fixedDofs: [1, 2, 3] as Array<1 | 2 | 3>, source: "USER_APPROVED_MOUNT_FIXTURE" })),
      loadRegions: [{ id: "SEAT-LOAD-001", targetFeatureId: "CUSHION", forceN: 1200, direction: "GLOBAL_Z", distribution: "UNIFORM", source: "USER_DECLARED_LOAD_REGION" }],
      boundaryCondition: { id: "SEAT-BC-001", fixtureDescription: "Declared mounting-point fixture reference", source: "USER_APPROVED_BOUNDARY_CONDITION" },
      mesh: { sizeMm: 12, elementType: "C3D4", source: "USER_APPROVED_MESH_CONFIG" },
      solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" },
      validation: { criterionId: "SEAT-VALIDATION-001", method: "REQUIRED_INPUT", source: "USER_APPROVED_VALIDATION_PLAN" },
    });
    expect(configuration.cadArtifactHash).toBe(artifact.artifactHash);
    expect(configuration.caeConfigurationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(configuration.status).toBe("NOT_ADMITTED");
    expect(configuration.requiredInputs).toContain("SEAT_MODEL_SPECIFIC_VALIDATION_CRITERION");
  }, 60_000);

  it("rejects missing explicit engineering input", async () => {
    const artifact = await generateSeatCadArtifact(model);
    expect(() => createSeatCaeConfiguration(artifact, {
      material: { elasticModulusMpa: 0, poissonRatio: 0.3, source: "" },
      mountFixtures: [],
      loadRegions: [],
      boundaryCondition: { id: "", fixtureDescription: "", source: "" },
      mesh: { sizeMm: 0, elementType: "C3D4", source: "" },
      solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" },
      validation: { criterionId: "", method: "REQUIRED_INPUT", source: "" },
    })).toThrow("SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
  });

  it("rejects mounts or loads that do not target the generated seat CAD features", async () => {
    const artifact = await generateSeatCadArtifact(model);
    expect(() => createSeatCaeConfiguration(artifact, {
      material: { elasticModulusMpa: 210000, poissonRatio: 0.3, source: "USER" },
      mountFixtures: [{ id: "BAD-MOUNT", targetFeatureId: "MOUNT_FL", fixedDofs: [], source: "USER" }],
      loadRegions: [{ id: "BAD-LOAD", targetFeatureId: "CUSHION", forceN: 0, direction: "GLOBAL_Z", distribution: "UNIFORM", source: "USER" }],
      boundaryCondition: { id: "BC", fixtureDescription: "fixture", source: "USER" },
      mesh: { sizeMm: 12, elementType: "C3D4", source: "USER" }, solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" }, validation: { criterionId: "REQUIRED", method: "REQUIRED_INPUT", source: "USER" },
    })).toThrow("SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
  }, 60_000);
});
