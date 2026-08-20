import { describe, expect, it } from "vitest";

import { applyRequirementRevision, normalizeUnit, parseRequirements } from "../server/requirementsAgent";
import { generateMountingBlock } from "../server/cadKernel";

describe("Requirements Agent", () => {
  it("normalizes supported engineering units deterministically", () => {
    expect(normalizeUnit(5, "cm")).toMatchObject({ normalizedValue: 50, normalizedUnit: "mm", dimension: "LENGTH" });
    expect(normalizeUnit(2, "inches")).toMatchObject({ normalizedValue: 50.8, normalizedUnit: "mm", dimension: "LENGTH" });
    expect(normalizeUnit(2, "kN")).toMatchObject({ normalizedValue: 2000, normalizedUnit: "N", dimension: "FORCE" });
    expect(normalizeUnit(1, "MPa")).toMatchObject({ normalizedValue: 1_000_000, normalizedUnit: "Pa", dimension: "PRESSURE" });
  });

  it("extracts validated dimensions and traceability links", () => {
    const result = parseRequirements("Create a block 100 mm long, 50 mm wide and 20 mm high.");
    expect(result.requirementSet.validation_status).toBe("VALIDATED");
    expect(result.requirementSet.requirements.map((item) => item.value)).toEqual(expect.arrayContaining([100, 50, 20]));
    expect(result.requirementSet.traceability.some((link) => link.from_type === "USER_REQUEST" && link.to_type === "REQUIREMENT")).toBe(true);
    expect(result.normalizedText).toContain("100 mm");
  });

  it("returns a conflict instead of choosing between incompatible values", () => {
    const result = parseRequirements("Width must be 50 mm. Width must be 70 mm.");
    expect(result.requirementSet.validation_status).toBe("CONFLICT");
    expect(result.requirementSet.conflicts[0]?.conflicting_requirements.length).toBeGreaterThanOrEqual(2);
    expect(result.requirementSet.conflicts[0]?.recommended_resolution).toContain("Choose");
  });

  it("creates critical open questions for a load-bearing bracket without inventing values", () => {
    const result = parseRequirements("Design a load-bearing bracket.");
    expect(result.requirementSet.validation_status).toBe("OPEN_QUESTION");
    expect(result.requirementSet.open_questions.map((question) => question.id)).toEqual(expect.arrayContaining(["OPEN-LOAD-001", "OPEN-MATERIAL-001"]));
    expect(result.requirementSet.requirements.some((item) => item.value === undefined)).toBe(false);
  });

  it("preserves prior revisions when a conversational update changes width", () => {
    const first = parseRequirements("Create a block 100 mm long, 50 mm wide and 20 mm high.").requirementSet;
    const revised = applyRequirementRevision(first, "Make the width 5 cm.");
    expect(revised.revision).toBe(2);
    expect(revised.requirements.some((item) => item.status === "SUPERSEDED" && item.parameter === "width" && item.value === 50)).toBe(true);
    expect(revised.requirements.some((item) => item.status === "VALIDATED" && item.parameter === "width" && item.value === 50.0 && item.supersedes)).toBe(true);
    expect(revised.traceability.length).toBeGreaterThan(first.traceability.length);
  });

  it("blocks trusted CAD when the requirements are incomplete or conflicting", async () => {
    const open = await generateMountingBlock({ width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true }, "Design a load-bearing bracket.");
    expect(open.artifact).toBeUndefined();
    expect(open.requirementSet?.validation_status).toBe("OPEN_QUESTION");

    const conflict = await generateMountingBlock({ width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true }, "Width must be 50 mm. Width must be 70 mm.");
    expect(conflict.artifact).toBeUndefined();
    expect(conflict.requirementSet?.validation_status).toBe("CONFLICT");
  });
});
