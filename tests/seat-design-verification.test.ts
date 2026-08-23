import { describe, expect, it } from "vitest";

import { buildSeatDesignVerificationCase } from "../server/seatDesignVerification";

const seatModel = {
  seatRevisionId: "SEAT-REVISION-VERIFY-001",
  identity: { designName: "Verification seat", revisionNumber: 1 },
  dimensionsMm: { cushionWidth: 480, cushionDepth: 460, cushionThickness: 80, backHeight: 520, backThickness: 60, supportWidth: 35, supportThickness: 35, frameDepth: 330, frameHeight: 45, mountRadius: 12, mountHeight: 35 },
  materials: { cushion: "Declared cushion material", back: "Declared back material", frame: "Declared frame material", supports: "Declared support material" },
  constraints: { minimumBackHeight: 400, minimumMountClearance: 25 },
} as const;

const reference = { method: "SEAT_MODEL_SPECIFIC_REFERENCE" as const, criterionId: "DECLARED-CRITERION", referenceSolutionId: "DECLARED-REFERENCE", referenceSolutionHash: "c".repeat(64), metric: "declared_metric", referenceValue: 1, tolerance: 0.01, source: "USER_APPROVED_REFERENCE" };

describe("own-seat design verification", () => {
  it("produces a genuine OpenCascade seat artifact while returning every absent engineering input as REQUIRED_INPUT", async () => {
    const verification = await buildSeatDesignVerificationCase({ seatModel });
    expect(verification.state).toBe("REQUIRED_INPUT");
    expect(verification.cadArtifact.kernel).toBe("OpenCascade.js");
    expect(verification.cadArtifact.validationStatus).toBe("VALID");
    expect(verification.requiredInputs).toEqual(expect.arrayContaining(["MATERIAL_PROPERTIES", "MOUNT_FIXTURES", "LOAD_REGIONS", "BOUNDARY_CONDITIONS", "MESH_CONFIGURATION", "SOLVER_CONFIGURATION", "FIXTURE_COORDINATE_FRAME_ID", "MOUNT_FIXTURE_COORDINATES", "LOAD_REFERENCE_ID", "LOAD_REGION_COORDINATES", "MATERIAL_CERTIFICATE_ID", "BOUNDARY_VERIFICATION_ID"]));
    expect(verification.runtimeDispatch.status).toBe("NOT_DISPATCHED");
  }, 60_000);

  it("rejects stale revision and mutated-artifact bindings before CAE configuration", async () => {
    const stale = await buildSeatDesignVerificationCase({ seatModel, expectedCadRevisionHash: "a".repeat(64), expectedCadArtifactHash: "b".repeat(64) });
    expect(stale.state).toBe("SECURITY_BLOCKED");
    expect(stale.requiredInputs).toEqual(expect.arrayContaining(["STALE_CAD_REVISION", "CAD_ARTIFACT_HASH_MISMATCH"]));
    expect(stale.caeConfiguration).toBeUndefined();
    expect(stale.runtimeDispatch.status).toBe("NOT_DISPATCHED");
  }, 60_000);

  it("binds fully explicit caller inputs to the immutable CAD artifact but does not fabricate a Gmsh or CalculiX result", async () => {
    const verification = await buildSeatDesignVerificationCase({
      seatModel,
      caeInput: {
        material: { elasticModulusMpa: 210000, poissonRatio: 0.3, source: "USER_APPROVED_MATERIAL_CERTIFICATE" },
        mountFixtures: ["MOUNT_FL", "MOUNT_FR", "MOUNT_RL", "MOUNT_RR"].map((targetFeatureId, index) => ({ id: `M${index + 1}`, targetFeatureId: targetFeatureId as "MOUNT_FL", fixedDofs: [1, 2, 3] as Array<1 | 2 | 3>, source: "USER_APPROVED_FIXTURE" })),
        loadRegions: [{ id: "L1", targetFeatureId: "BACK", forceN: 1000, direction: "GLOBAL_X", distribution: "UNIFORM", source: "USER_APPROVED_LOAD" }],
        boundaryCondition: { id: "BC1", fixtureDescription: "User-declared mount restraint", source: "USER_APPROVED_BOUNDARY" },
        mesh: { sizeMm: 10, elementType: "C3D4", source: "USER_APPROVED_MESH" },
        solver: { id: "CALCULIX", version: "2.21", analysisType: "LINEAR_STATIC" },
        validation: { criterionId: reference.criterionId, method: "SEAT_MODEL_SPECIFIC_REFERENCE", tolerance: reference.tolerance, referenceSolutionId: reference.referenceSolutionId, referenceSolutionHash: reference.referenceSolutionHash, source: reference.source },
      },
      coordinateBindings: {
        fixtureCoordinateFrameId: "USER-CSYS-1",
        mountFixtureCoordinatesMm: { M1: [0, 0, 0], M2: [1, 0, 0], M3: [0, 1, 0], M4: [1, 1, 0] },
        loadReferenceId: "USER-LOAD-1",
        loadRegionCoordinatesMm: { L1: [0, 0, 1] },
        materialCertificateId: "USER-MATERIAL-1",
        boundaryVerificationId: "USER-BOUNDARY-1",
      },
      validationReference: reference,
    });
    expect(verification.state).toBe("READY_FOR_EXECUTION");
    expect(verification.requiredInputs).toEqual([]);
    expect(verification.caeConfiguration?.caeConfigurationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verification.validationAdmission?.status).toBe("ADMITTED");
    expect(verification.runtimeDispatch).toEqual(expect.objectContaining({ status: "NOT_DISPATCHED" }));
    expect(verification.reportStatus).toBe("NO_SOLVER_RESULT");
  }, 60_000);
});
