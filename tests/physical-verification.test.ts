import { describe, expect, it } from "vitest";

import { assessMeshConvergence, axialStressReferenceInput, createPhysicalEngineeringVerification, evaluatePhysicalEngineeringVerification, listPhysicalEngineeringVerifications } from "../server/physicalVerification";
import { openPersistentProject } from "../server/persistentMemory";

describe("physical engineering verification framework", () => {
  it("verifies the explicit analytical axial-stress reference while preserving higher physical claims as not achieved", () => {
    const record = evaluatePhysicalEngineeringVerification({ projectId: "PROJECT-ANALYTICAL", input: axialStressReferenceInput(), createdAt: "2026-01-01T00:00:00.000Z" });

    expect(record.classification).toBe("VALIDATED_REFERENCE_CASE");
    expect(record.levels).toEqual({
      computation: "ACHIEVED",
      numericalVerification: "ACHIEVED",
      modelValidation: "NOT_ACHIEVED",
      experimentalCorrelation: "NOT_ACHIEVED",
      engineeringAcceptance: "NOT_ACHIEVED",
      regulatoryCertification: "NOT_ACHIEVED",
    });
    expect(record.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: "UNIT_CONSISTENCY", status: "PASS" }),
      expect.objectContaining({ check: "MESH_CONVERGENCE", status: "PASS" }),
      expect.objectContaining({ check: "SOLVER_CONVERGENCE", status: "PASS" }),
      expect.objectContaining({ check: "RESULT_SANITY", status: "PASS" }),
    ]));
    expect(record.limitations.join(" ")).toContain("does not establish model validation");
  });

  it("fails closed when a result unit is incompatible with the declared reference dimension", () => {
    const input = axialStressReferenceInput();
    input.observedResult.unit = "mm";
    const record = evaluatePhysicalEngineeringVerification({ projectId: "PROJECT-UNIT", input });

    expect(record.levels.numericalVerification).toBe("NOT_ACHIEVED");
    expect(record.classification).toBe("NUMERICALLY_UNCERTAIN");
    expect(record.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: "UNIT_CONSISTENCY", status: "FAIL" }),
      expect.objectContaining({ check: "DIMENSIONAL_CONSISTENCY", status: "FAIL" }),
      expect.objectContaining({ check: "RESULT_SANITY", status: "FAIL" }),
    ]));
  });

  it("requires explicit solver convergence rather than inferring it from a numerical value", () => {
    const input = axialStressReferenceInput();
    input.observedResult.solverConvergence = "UNKNOWN";
    const record = evaluatePhysicalEngineeringVerification({ projectId: "PROJECT-CONVERGENCE", input });

    expect(record.levels.numericalVerification).toBe("REQUIRED_INPUT");
    expect(record.classification).toBe("NOT_VALIDATED");
    expect(record.checks).toEqual(expect.arrayContaining([expect.objectContaining({ check: "SOLVER_CONVERGENCE", status: "REQUIRED_INPUT" })]));
  });

  it("requires a case-specific convergence study with at least three content-addressed refinement samples", () => {
    const source = axialStressReferenceInput().meshConvergence!;
    const result = assessMeshConvergence({ criterion: source.criterion, samples: source.samples.slice(0, 2) });

    expect(result.status).toBe("REQUIRED_INPUT");
  });

  it("rejects a non-monotonic mesh-refinement sequence as not converged", () => {
    const source = axialStressReferenceInput().meshConvergence!;
    const samples = structuredClone(source.samples);
    samples[2].elementCount = 8;
    const result = assessMeshConvergence({ criterion: source.criterion, samples });

    expect(result.status).toBe("NOT_CONVERGED");
  });

  it("changes the immutable verification hash whenever a provenance-bound source field changes", () => {
    const input = axialStressReferenceInput();
    const original = evaluatePhysicalEngineeringVerification({ projectId: "PROJECT-HASH", input, createdAt: "2026-01-01T00:00:00.000Z" });
    input.mesh.meshHash = "e".repeat(64);
    const changed = evaluatePhysicalEngineeringVerification({ projectId: "PROJECT-HASH", input, createdAt: "2026-01-01T00:00:00.000Z" });

    expect(changed.verificationHash).not.toBe(original.verificationHash);
    expect(changed.mesh.meshHash).toBe("e".repeat(64));
  });

  it("persists an analytical verification record without creating a mutable or engineering-job claim", async () => {
    const project = await openPersistentProject({ name: "Physical verification record" });
    const record = await createPhysicalEngineeringVerification({ projectId: project.id, accessKey: project.accessKey, input: axialStressReferenceInput() });
    const records = await listPhysicalEngineeringVerifications({ projectId: project.id, accessKey: project.accessKey });

    expect(record.immutable).toBe(true);
    expect(record.jobId).toBeUndefined();
    expect(records.map((item) => item.verificationId)).toContain(record.verificationId);
    expect(records[0].levels.engineeringAcceptance).toBe("NOT_ACHIEVED");
  });

  it("rejects an engineering-job scope that does not name a reconciled engineering job", async () => {
    const project = await openPersistentProject({ name: "Physical verification rejection" });
    const input = axialStressReferenceInput();
    input.scope = "ENGINEERING_JOB";

    await expect(createPhysicalEngineeringVerification({ projectId: project.id, accessKey: project.accessKey, input }))
      .rejects.toThrow("PHYSICAL_VERIFICATION_JOB_ID_REQUIRED");
  });
});
