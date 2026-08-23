import { describe, expect, it } from "vitest";

import { FMVSS207_OFFICIAL_REQUIREMENTS, mapOfficialSeatCaeInputs } from "../server/seatOfficialReference";

describe("official seat CAE references", () => {
  it("retains source, page, requirement ID, value, unit, and applicability for every extracted input", () => {
    expect(FMVSS207_OFFICIAL_REQUIREMENTS.length).toBeGreaterThan(0);
    for (const requirement of FMVSS207_OFFICIAL_REQUIREMENTS) {
      expect(requirement.sourceDocument).toBeTruthy();
      expect(requirement.sectionOrPage).toBeTruthy();
      expect(requirement.requirementId).toBeTruthy();
      expect(requirement.value).toBeTruthy();
      expect(requirement.unit).toBeTruthy();
      expect(requirement.applicability).toBeTruthy();
    }
  });

  it("fails closed when source documents do not supply model-specific material, fixture, load, or validation inputs", () => {
    const mapping = mapOfficialSeatCaeInputs({});
    expect(mapping.status).toBe("REQUIRED_INPUT");
    expect(mapping.requiredInputs).toEqual(expect.arrayContaining(["SEAT_WEIGHT_N", "FIXTURE_COORDINATE_FRAME_ID", "SEAT_MATERIAL_CERTIFICATE_IDS", "MODEL_SPECIFIC_REFERENCE_CRITERION_ID", "REFERENCE_SOLUTION_ID"]));
  });

  it("maps literal documented load directions and moment only after authoritative inputs are supplied", () => {
    const mapping = mapOfficialSeatCaeInputs({ seatWeightN: 1000, vehicleLongitudinalAxisMapping: "VEHICLE_X_TO_SEAT_X", fixtureCoordinateFrameId: "FIXTURE-CSYS-01", mountFixtureRepresentationId: "RIG-01", forwardLoadRegionId: "CUSHION-CG", rearwardLoadRegionId: "CUSHION-CG", seatingReferencePointId: "S-POINT", designatedSeatingPositionCount: 1, upperCrossmemberLoadRegionId: "BACK-UPPER", seatFacingDirection: "FORWARD", materialCertificateIds: ["MAT-CERT-01"], modelSpecificReferenceCriterionId: "VALIDATION-01", referenceSolutionId: "REFERENCE-01" });
    expect(mapping.status).toBe("MAPPED");
    expect(mapping.documentedLoadCases.map((loadCase) => loadCase.multiplier)).toEqual([20, 20]);
    expect(mapping.documentedMomentCase?.momentInLb).toBe(3300);
  });
});
