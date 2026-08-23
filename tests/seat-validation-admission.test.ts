import { describe, expect, it } from "vitest";

import { admitSeatValidation, validateSeatSolverMetric } from "../server/seatValidationAdmission";

const h = "a".repeat(64);
const reference = { method: "SEAT_MODEL_SPECIFIC_REFERENCE" as const, criterionId: "SEAT-STATIC-REFERENCE-001", referenceSolutionId: "AUTH-REFERENCE-001", referenceSolutionHash: "b".repeat(64), metric: "declared_mount_displacement_mm", referenceValue: 2, tolerance: 0.05, source: "USER_APPROVED_AUTHORITATIVE_REFERENCE" };

describe("seat validation admission", () => {
  it("blocks seat solver validation when authoritative fixtures, loads, materials, boundaries, or reference criterion are missing", () => {
    const result = admitSeatValidation({ seatRevisionHash: h, cadArtifactHash: h, caeConfigurationHash: h });
    expect(result.status).toBe("REQUIRED_INPUT");
    expect(result.requiredInputs).toEqual(expect.arrayContaining(["FIXTURE_COORDINATE_FRAME_ID", "LOAD_REFERENCE_ID", "MATERIAL_CERTIFICATE_ID", "BOUNDARY_VERIFICATION_ID", "MODEL_SPECIFIC_REFERENCE_CRITERION"]));
  });

  it("binds a complete model-specific reference criterion and accepts only a metric within its supplied tolerance", () => {
    const admission = admitSeatValidation({ seatRevisionHash: h, cadArtifactHash: h, caeConfigurationHash: h, fixtureCoordinateFrameId: "SEAT-MOUNT-CSYS-V1", loadReferenceId: "SEAT-LOAD-REGION-V1", materialCertificateId: "MAT-CERT-V1", boundaryVerificationId: "BC-VERIFY-V1", reference });
    expect(admission.status).toBe("ADMITTED");
    expect(validateSeatSolverMetric(admission, reference, 2.05).validationStatus).toBe("PASS");
    expect(validateSeatSolverMetric(admission, reference, 2.2).validationStatus).toBe("FAIL");
  });

  it("rejects stale or foreign artifact hashes before validation admission", () => {
    const result = admitSeatValidation({ seatRevisionHash: "not-a-hash", cadArtifactHash: h, caeConfigurationHash: h, fixtureCoordinateFrameId: "SEAT-MOUNT-CSYS-V1", loadReferenceId: "SEAT-LOAD-REGION-V1", materialCertificateId: "MAT-CERT-V1", boundaryVerificationId: "BC-VERIFY-V1", reference });
    expect(result.status).toBe("REQUIRED_INPUT");
    expect(result.requiredInputs).toContain("SEAT_REVISION_HASH");
  });
});
