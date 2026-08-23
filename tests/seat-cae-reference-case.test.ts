import { describe, expect, it } from "vitest";

import { admitSeatReferenceCase, correlateSeatPhysicalTest, type ApprovedReferencePackage, verifyReferencePackage } from "../server/seatCaeReferenceCase";

const hash = "a".repeat(64);
const sourceRequirements = [{ sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 4, §2", requirementId: "FMVSS207-FORCE-FWD-001", value: "20 times weight", unit: "multiplier", applicability: "seat" }];
const content = { id: "SEAT-REF-001", version: "1", geometryHash: hash, materialCertificateIds: ["MAT-01"], fixtureIds: ["FIX-01"], loadIds: ["LOAD-01"], boundaryIds: ["BC-01"], referenceResult: { metric: "mount_displacement", value: 1, unit: "mm" }, referenceSource: { document: "test.pdf", sectionOrPage: "p. 1", requirementId: "TEST-01" }, tolerance: 0.1 };
const crypto = require("node:crypto") as typeof import("node:crypto");
const packageWithHash: ApprovedReferencePackage = { ...content, declaredContentHash: crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex") };

describe("seat CAE reference case", () => {
  it("rejects every missing authoritative test-rig and validation input", () => {
    const admission = admitSeatReferenceCase({ id: "CASE", version: "1", sourceRequirements, analysisType: "LINEAR_STATIC", applicability: "seat" });
    expect(admission.status).toBe("REQUIRED_INPUT");
    expect(admission.requiredInputs).toEqual(expect.arrayContaining(["COORDINATE_SYSTEM_MAPPING", "SEAT_WEIGHT_N", "MOUNT_FIXTURES", "APPROVED_REFERENCE_PACKAGE"]));
  });

  it("rejects altered reference packages and ambiguous coordinate mappings", () => {
    expect(verifyReferencePackage({ ...packageWithHash, tolerance: 0.2 }).requiredInputs).toContain("REFERENCE_PACKAGE_INTEGRITY");
    const admission = admitSeatReferenceCase({ id: "CASE", version: "1", sourceRequirements, analysisType: "LINEAR_STATIC", coordinateMapping: { id: "CSYS", vehicleLongitudinalAxis: "SEAT_X", vehicleLateralAxis: "SEAT_X", vehicleVerticalAxis: "SEAT_Z", source: "approved" }, applicability: "seat" }, packageWithHash);
    expect(admission.requiredInputs).toContain("COORDINATE_SYSTEM_MAPPING");
  });

  it("admits only a complete static reference case and supports physical correlation without inventing values", () => {
    const admission = admitSeatReferenceCase({ id: "CASE", version: "1", sourceRequirements, analysisType: "LINEAR_STATIC", coordinateMapping: { id: "CSYS", vehicleLongitudinalAxis: "SEAT_X", vehicleLateralAxis: "SEAT_Y", vehicleVerticalAxis: "SEAT_Z", source: "approved" }, seatWeightN: 1000, forwardLoadRegionId: "CUSHION", rearwardLoadRegionId: "CUSHION", mountFixtureIds: ["MOUNT_FL", "MOUNT_FR"], materialCertificateIds: ["MAT-01"], boundaryConditionIds: ["BC-01"], meshConfigurationId: "MESH-01", solverConfigurationId: "CALCULIX-STATIC", validationCriterionId: "REF-01", applicability: "seat" }, packageWithHash);
    expect(admission.status).toBe("ADMITTED");
    expect(correlateSeatPhysicalTest({ id: "CORR", seatRevisionHash: hash, caeConfigurationHash: hash }).correlationStatus).toBe("REQUIRED_INPUT");
    expect(correlateSeatPhysicalTest({ id: "CORR", seatRevisionHash: hash, caeConfigurationHash: hash, experimentalResult: 1, simulationResult: 1.05, referenceResult: 1, tolerance: 0.1 }).correlationStatus).toBe("PASS");
  });
});
