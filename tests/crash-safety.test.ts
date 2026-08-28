import { describe, expect, it } from "vitest";

import { analyzeOccupantMotion, comparePersistedCrashSafetyEvidence, createCrashSafetyEvidence, evaluateCrashSafetyEvidence, listCrashSafetyEvidence, validateCrashPulse, validateSafetyNarrative } from "../server/crashSafety";
import { openPersistentProject } from "../server/persistentMemory";
import type { CrashSafetyEvidenceInput } from "../shared/crashSafety";

const sha = (letter: string) => letter.repeat(64);

function fixture(designId = "CRASH-DESIGN-A", revisionHash = sha("a")): CrashSafetyEvidenceInput {
  const samples = (offset: number) => [
    { timeS: 0, positionM: [offset, 0, 0] as [number, number, number], velocityMps: [4, 0, 0] as [number, number, number], angularVelocityRadps: [0, 0, 0] as [number, number, number] },
    { timeS: 0.02, positionM: [offset + 0.05, 0, 0] as [number, number, number], velocityMps: [1, 0, 0] as [number, number, number], angularVelocityRadps: [0, 0, 0] as [number, number, number] },
  ];
  return {
    designId,
    seatRevisionHash: revisionHash,
    requirement: { requirementId: "TEST-CRASH-REQUIREMENT", scenario: "Synthetic test scenario", occupantCondition: "Synthetic test occupant condition", vehicleSeatConfiguration: "Synthetic test seat configuration", crashPulseDefinitionId: "SYNTHETIC-PULSE-1", initialCondition: "Declared synthetic initial condition", occupantMassAndInertiaSource: "TEST_FIXTURE_ONLY", restraintAssumptions: ["Test restraint interface only"], responseMetric: "Synthetic response metric", acceptanceCriterion: { criterionId: "TEST-METRIC", definition: "Fixture-only metric definition", source: "TEST_FIXTURE_ONLY" }, source: "TEST_FIXTURE_ONLY", provenanceReferences: ["TEST-PROVENANCE-1"], verificationMethod: "Deterministic contract test", validationMethod: "No physical validation", certificationStatus: "NOT_CERTIFIED" },
    crashPulse: { pulseId: "SYNTHETIC-PULSE-1", sourceKind: "SYNTHETIC", source: "TEST_FIXTURE_ONLY", provenanceReferences: ["TEST-PULSE-PROVENANCE"], samplingRateHz: 50, accelerationUnit: "m/s2", coordinateDirection: "X", filtering: { method: "NONE", parameters: "none", source: "TEST_FIXTURE_ONLY" }, samples: [{ timeS: 0, acceleration: 0 }, { timeS: 0.02, acceleration: -12 }] },
    occupantMotion: { modelId: "SYNTHETIC-OCCUPANT-1", source: "TEST_FIXTURE_ONLY", coordinateFrameId: "TEST-VEHICLE-FRAME", seatInterfaceId: "TEST-SEAT-INTERFACE", restraintInterfaceIds: ["TEST-RESTRAINT"], contactInterfaceIds: ["TEST-CONTACT"], segments: [{ segment: "PELVIS", massKg: 12, inertiaKgM2: [1, 1, 1], samples: samples(0) }, { segment: "TORSO", massKg: 35, inertiaKgM2: [2, 2, 2], samples: samples(0.1) }, { segment: "HEAD", massKg: 5, inertiaKgM2: [0.2, 0.2, 0.2], samples: samples(0.2) }], assumptions: ["TEST_FIXTURE_ONLY"], provenanceReferences: ["TEST-MOTION-PROVENANCE"], biofidelityStatus: "NOT_VALIDATED" },
    safetyMetrics: [{ metricId: "TEST-HEAD-METRIC", category: "HEAD_RESPONSE", segment: "HEAD", value: 1.25, unit: "1", definition: "Synthetic fixture metric", source: "TEST_FIXTURE_ONLY", provenanceReferences: ["TEST-METRIC-PROVENANCE"] }],
    validationArchitecture: { simulation: "RECORDED", referenceModel: "NOT_AVAILABLE", benchTest: "NOT_AVAILABLE", physicalTest: "NOT_AVAILABLE", correlation: "NOT_AVAILABLE" },
  };
}

describe("Crash safety evidence", () => {
  it("records transparent synthetic evidence without a physical safety or certification claim", () => {
    const record = evaluateCrashSafetyEvidence({ projectId: "PROJECT-CRASH", input: fixture(), createdAt: "2026-01-01T00:00:00.000Z" });
    expect(record.crashPulse.sourceKind).toBe("SYNTHETIC");
    expect(record.occupantMotion.segments).toHaveLength(3);
    expect(record.occupantMotion.segments[2].quantities).toEqual(expect.arrayContaining([expect.objectContaining({ quantity: "RELATIVE_MOTION", formulaIdentity: "delta_x_segment_final_minus_pelvis_final" })]));
    expect(record.validationArchitecture.physicalValidation).toBe("NOT_VALIDATED");
    expect(record.certificationStatus).toBe("NOT_CERTIFIED");
    expect(record.claimBoundary).toBe("NO_CRASHWORTHINESS_OR_OCCUPANT_SAFETY_CLAIM");
  });

  it("rejects malformed pulse time data and missing declared contact interfaces before persistence", () => {
    const malformedPulse = fixture();
    malformedPulse.crashPulse.samples[1].timeS = 0;
    expect(() => validateCrashPulse(malformedPulse.crashPulse)).toThrow("CRASH_PULSE_TIME_SERIES_INVALID");
    const missingInterface = fixture();
    missingInterface.occupantMotion.contactInterfaceIds = [];
    expect(() => analyzeOccupantMotion(missingInterface.occupantMotion)).toThrow("OCCUPANT_MOTION_PROVENANCE_OR_INTERFACE_REQUIRED");
  });

  it("rejects unauthorised safety claims", () => {
    expect(() => validateSafetyNarrative("This occupant is safe.")).toThrow("UNAUTHORIZED_SAFETY_CLAIM");
    expect(() => validateSafetyNarrative("The vehicle is crash certified.")).toThrow("UNAUTHORIZED_SAFETY_CLAIM");
    expect(() => validateSafetyNarrative("Evidence is bounded by its recorded inputs.")).not.toThrow();
  });

  it("requires a valid external-certificate integrity hash without promoting the claim boundary", () => {
    const invalid = fixture();
    invalid.externalCertificationEvidence = { evidenceId: "EXT-1", issuer: "TEST_ISSUER", source: "TEST_FIXTURE_ONLY", scope: "Test scope", integrityHash: "not-a-hash" };
    expect(() => evaluateCrashSafetyEvidence({ projectId: "PROJECT-CRASH", input: invalid })).toThrow("EXTERNAL_CERTIFICATION_EVIDENCE_HASH_INVALID");
    const valid = fixture();
    valid.externalCertificationEvidence = { evidenceId: "EXT-1", issuer: "TEST_ISSUER", source: "TEST_FIXTURE_ONLY", scope: "Test scope", integrityHash: sha("b") };
    const record = evaluateCrashSafetyEvidence({ projectId: "PROJECT-CRASH", input: valid });
    expect(record.certificationStatus).toBe("EXTERNAL_CERTIFICATION_EVIDENCE_RECORDED");
    expect(record.claimBoundary).toBe("NO_CRASHWORTHINESS_OR_OCCUPANT_SAFETY_CLAIM");
  });

  it("persists project-scoped evidence and compares only two persisted records", async () => {
    const project = await openPersistentProject({ name: "Crash safety fixture" });
    const baseline = await createCrashSafetyEvidence({ projectId: project.id, accessKey: project.accessKey, input: fixture("CRASH-DESIGN-A", sha("c")) });
    const proposedInput = fixture("CRASH-DESIGN-B", sha("d"));
    proposedInput.safetyMetrics[0].value = 0.75;
    const proposed = await createCrashSafetyEvidence({ projectId: project.id, accessKey: project.accessKey, input: proposedInput });
    const records = await listCrashSafetyEvidence({ projectId: project.id, accessKey: project.accessKey });
    const comparison = await comparePersistedCrashSafetyEvidence({ projectId: project.id, accessKey: project.accessKey, baselineRecordId: baseline.recordId, proposedRecordId: proposed.recordId });
    expect(records.map((record) => record.recordId)).toEqual(expect.arrayContaining([baseline.recordId, proposed.recordId]));
    expect(baseline.immutable).toBe(true);
    expect(comparison.metrics[0]).toMatchObject({ metricId: "TEST-HEAD-METRIC", baseline: 1.25, proposed: 0.75, delta: -0.5 });
    expect(comparison.conclusionBoundary).toBe("ENGINEERING_EVIDENCE_ONLY");
    await expect(comparePersistedCrashSafetyEvidence({ projectId: project.id, accessKey: project.accessKey, baselineRecordId: baseline.recordId, proposedRecordId: "MISSING" })).rejects.toThrow("SAFETY_COMPARISON_RECORD_NOT_FOUND");
  });
});
