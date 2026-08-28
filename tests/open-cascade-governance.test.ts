import { describe, expect, it } from "vitest";

import { generateMountingBlock } from "../server/cadKernel";
import {
  openCascadeAdmissionSnapshot,
  runWithOpenCascadeAdmission,
} from "../server/runtimeAdmission";

const input = {
  width: 100,
  depth: 50,
  height: 20,
  holeDiameter: 10,
  holeEdgeOffset: 10,
  filletRadius: 3,
  approveAssumption: true,
};
const prompt = "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm holes near the corners using a 10 mm edge offset and a 3 mm fillet.";

describe("OpenCascade governance", () => {
  it("executes a real kernel build inside the sole admission context and releases the permit", async () => {
    expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 0, maxConcurrency: 1, inherited: false });
    const result = await runWithOpenCascadeAdmission({ projectId: "GOVERNANCE-CAD", resourceClass: "CAD_AUTHORING" }, async () => {
      expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 1, inherited: true });
      return generateMountingBlock(input, prompt);
    });
    expect(result.artifact?.validationStatus).toBe("VALID");
    expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 0, inherited: false });
  });

  it("releases the permit after a failure and permits the next real kernel build", async () => {
    await expect(runWithOpenCascadeAdmission({ projectId: "GOVERNANCE-FAIL", resourceClass: "CAD_OPERATION" }, async () => {
      await generateMountingBlock({ ...input, width: -1 }, prompt);
      throw new Error("CONTROLLED_OPEN_CASCADE_FAILURE");
    })).rejects.toThrow("CONTROLLED_OPEN_CASCADE_FAILURE");
    expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 0, inherited: false });
    const result = await runWithOpenCascadeAdmission({ projectId: "GOVERNANCE-RECOVERY", resourceClass: "CAD_AUTHORING" }, () => generateMountingBlock(input, prompt));
    expect(result.artifact?.validationStatus).toBe("VALID");
    expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 0, inherited: false });
  });

  it("rejects excess concurrent work at the fixed capacity of one", async () => {
    let release: (() => void) | undefined;
    const held = runWithOpenCascadeAdmission({ projectId: "GOVERNANCE-HOLD", resourceClass: "CAD_OPERATION" }, () => new Promise<void>((resolve) => { release = resolve; }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(runWithOpenCascadeAdmission({ projectId: "GOVERNANCE-EXCESS", resourceClass: "VIEWER" }, async () => undefined)).rejects.toThrow("OPEN_CASCADE_ADMISSION_CAPACITY_EXHAUSTED");
    release?.();
    await held;
    expect(openCascadeAdmissionSnapshot()).toMatchObject({ activeConcurrency: 0, maxConcurrency: 1, inherited: false });
  });
});
