import { describe, expect, it } from "vitest";
import { generateSeatCadArtifact } from "../server/seatCadEngine";

describe("engineering concept CAD gate", () => {
  it("rejects undefined user parameters before any OpenCascade artifact is created", async () => {
    await expect(generateSeatCadArtifact({
      seatRevisionId: "CONCEPT-REVISION-1",
      identity: { designName: "Concept only", revisionNumber: 1 },
      dimensionsMm: { cushionWidth: Number.NaN, cushionDepth: 1, cushionThickness: 1, backHeight: 1, backThickness: 1, supportWidth: 1, supportThickness: 1, frameDepth: 1, frameHeight: 1, mountRadius: 1, mountHeight: 1 },
      materials: { cushion: "USER_INPUT_REQUIRED", back: "USER_INPUT_REQUIRED", frame: "USER_INPUT_REQUIRED", supports: "USER_INPUT_REQUIRED" },
      constraints: { minimumBackHeight: 1, minimumMountClearance: 1 },
    })).rejects.toThrow("SEAT_DIMENSIONS_MUST_BE_POSITIVE_MM");
  });
});
