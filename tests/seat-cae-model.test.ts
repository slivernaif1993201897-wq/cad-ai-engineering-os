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
      loadCase: { id: "SEAT-LOAD-001", forceN: 1200, direction: "GLOBAL_Z", application: "Declared cushion contact load reference" },
      boundaryCondition: { id: "SEAT-BC-001", fixtureDescription: "Declared mounting-point fixture reference", fixedDofs: [1, 2, 3] },
      mesh: { sizeMm: 12, elementType: "C3D4", source: "USER_APPROVED_MESH_CONFIG" },
      solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" },
      validation: { criterionId: "SEAT-VALIDATION-001", method: "MODEL_SPECIFIC_REQUIRED", tolerance: 0.1, source: "USER_APPROVED_VALIDATION_PLAN" },
    });
    expect(configuration.cadArtifactHash).toBe(artifact.artifactHash);
    expect(configuration.caeConfigurationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(configuration.status).toBe("NOT_ADMITTED");
  }, 60_000);

  it("rejects missing explicit engineering input", async () => {
    const artifact = await generateSeatCadArtifact(model);
    expect(() => createSeatCaeConfiguration(artifact, {
      material: { elasticModulusMpa: 0, poissonRatio: 0.3, source: "" },
      loadCase: { id: "", forceN: 0, direction: "GLOBAL_Z", application: "" },
      boundaryCondition: { id: "", fixtureDescription: "", fixedDofs: [] },
      mesh: { sizeMm: 0, elementType: "C3D4", source: "" },
      solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" },
      validation: { criterionId: "", method: "", tolerance: 0, source: "" },
    })).toThrow("SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
  });
});
