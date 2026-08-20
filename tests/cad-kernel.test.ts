import { describe, expect, it } from "vitest";

import { generateMountingBlock } from "../server/cadKernel";

const prompt = "Create a mounting block with four through holes and an external edge fillet.";

const baseInput = {
  width: 100,
  depth: 50,
  height: 20,
  holeDiameter: 10,
  holeEdgeOffset: 10,
  filletRadius: 3,
  approveAssumption: true,
};

describe("real CAD mounting-block vertical slice", () => {
  it("creates a valid STEP-backed solid with the real kernel", async () => {
    const result = await generateMountingBlock(baseInput, prompt);

    expect(result.error).toBeUndefined();
    expect(result.artifact?.kernel).toBe("OpenCascade.js");
    expect(result.artifact?.validationStatus).toBe("VALID");
    expect(result.artifact?.shapeKind).toBe("SOLID");
    expect(result.artifact?.stepByteLength).toBeGreaterThan(0);
    expect(result.plan.deterministic).toBe(true);
  });

  it("keeps an unapproved geometric assumption as an open question", async () => {
    const result = await generateMountingBlock(
      { ...baseInput, approveAssumption: false },
      "Create a mounting block with holes near the corners.",
    );

    expect(result.plan.requirements[0].status).toBe("OPEN_QUESTION");
    expect(result.plan.requirements[0].openQuestions).toHaveLength(1);
    expect(result.artifact).toBeUndefined();
  });

  it("regenerates a different real artifact when width changes", async () => {
    const original = await generateMountingBlock(baseInput, prompt);
    const modified = await generateMountingBlock({ ...baseInput, width: 70 }, "Change width to 70 mm.");

    expect(original.artifact?.validationStatus).toBe("VALID");
    expect(modified.artifact?.validationStatus).toBe("VALID");
    expect(modified.artifact?.parameters.find((parameter) => parameter.name === "width")?.value).toBe(70);
    expect(modified.artifact?.stepBase64).not.toBe(original.artifact?.stepBase64);
  });
});
