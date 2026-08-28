import { describe, expect, it } from "vitest";

import { canAdmitExecution, gateRecords, mobileClientCanStartExecution } from "../lib/engineering-os";

describe("CAD-AI Engineering OS integrity controls", () => {
  it("keeps a disconnected runtime gate set fail-closed", () => {
    expect(canAdmitExecution(gateRecords)).toBe(false);
  });

  it("does not allow a mobile client to start an engineering process", () => {
    expect(mobileClientCanStartExecution()).toBe(false);
  });

  it("requires every supplied gate to pass before admission can be considered", () => {
    const allPass = gateRecords.map((gate) => ({ ...gate, status: "PASS" as const }));
    const oneUnknown = allPass.map((gate, index) =>
      index === 0 ? { ...gate, status: "UNKNOWN" as const } : gate,
    );

    expect(canAdmitExecution(allPass)).toBe(true);
    expect(canAdmitExecution(oneUnknown)).toBe(false);
  });
});
