import { describe, expect, it } from "vitest";

import { generateSeatCadArtifact, type SeatParametricModel } from "../server/seatCadEngine";

const model: SeatParametricModel = {
  seatRevisionId: "SEAT-REVISION-ACCEPTANCE-001",
  identity: { designName: "Parametric front seat", revisionNumber: 1 },
  dimensionsMm: { cushionWidth: 480, cushionDepth: 460, cushionThickness: 80, backHeight: 520, backThickness: 60, supportWidth: 35, supportThickness: 35, frameDepth: 330, frameHeight: 45, mountRadius: 12, mountHeight: 35 },
  materials: { cushion: "PU foam", back: "Trim shell", frame: "HSLA steel", supports: "HSLA steel" },
  constraints: { minimumBackHeight: 400, minimumMountClearance: 25 },
};

describe("real OpenCascade Seat CAD Engine", () => {
  it("generates a validated compound STEP with cushion, back, supports, frame, and four mounting points bound to the immutable seat revision", async () => {
    const result = await generateSeatCadArtifact(model);
    expect(result.validationStatus).toBe("VALID");
    expect(result.kernel).toBe("OpenCascade.js");
    expect(result.seatRevisionId).toBe(model.seatRevisionId);
    expect(result.stepByteLength).toBeGreaterThan(500);
    expect(Buffer.from(result.stepBase64, "base64").toString("utf8")).toContain("ISO-10303-21");
    expect(result.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.cadRevisionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.featureTree.map((feature) => feature.id)).toEqual(["CUSHION", "BACK", "LEFT_SUPPORT", "RIGHT_SUPPORT", "FRAME", "MOUNT_FL", "MOUNT_FR", "MOUNT_RL", "MOUNT_RR"]);
    expect(result.viewerMesh.triangles.length).toBeGreaterThan(50);
  }, 60_000);

  it("rejects geometric contradictions and incomplete material assignments before kernel execution", async () => {
    await expect(generateSeatCadArtifact({ ...model, dimensionsMm: { ...model.dimensionsMm, backHeight: 200 } })).rejects.toThrow("SEAT_GEOMETRIC_CONSTRAINT_UNSATISFIED");
    await expect(generateSeatCadArtifact({ ...model, materials: { ...model.materials, frame: "" } })).rejects.toThrow("SEAT_MATERIAL_ASSIGNMENTS_REQUIRED");
  });
});
