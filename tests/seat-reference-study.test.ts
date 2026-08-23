import { describe, expect, it } from "vitest";

import { assessStudyReproducibility, BACKREST_STATIC_STRENGTH_STUDY, comparePublishedReference, INTEGRATED_BELT_STUDY } from "../server/seatReferenceStudy";

describe("seat reference studies", () => {
  it("retains page-level input traceability and explicitly records unavailable static-study reproduction inputs", () => {
    expect(BACKREST_STATIC_STRENGTH_STUDY.inputs.every((input) => input.sourceDocument && input.page && input.section && input.requirementId)).toBe(true);
    const assessment = assessStudyReproducibility(BACKREST_STATIC_STRENGTH_STUDY);
    expect(assessment.status).toBe("REFERENCE_NOT_REPRODUCIBLE");
    expect(assessment.requiredInputs).toEqual(expect.arrayContaining(["BACKREST-GEOMETRY-001", "BACKREST-MATERIAL-001", "BACKREST-FIXTURE-001"]));
  });

  it("does not admit a dynamic integrated-belt sled study to the static reference workflow", () => {
    const assessment = assessStudyReproducibility(INTEGRATED_BELT_STUDY);
    expect(assessment.status).toBe("REFERENCE_NOT_REPRODUCIBLE");
    expect(assessment.requiredInputs).toContain("STATIC_CALCULIX_ANALYSIS_NOT_APPLICABLE_TO_DYNAMIC_SLED_STUDY");
  });

  it("does not convert reported study error into an undocumented acceptance tolerance", () => {
    const comparison = comparePublishedReference({ metric: "maximum_stress", value: 254.9, unit: "MPa", sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 4, figureOrTable: "Table 1", documentedTolerance: 0.1494, toleranceKind: "OBSERVED_ERROR" }, 254.9);
    expect(comparison.status).toBe("COMPARISON_ONLY");
  });
});
