import { createHash } from "node:crypto";

import type { CrashPulseInput, CrashSafetyEvidenceInput, CrashSafetyEvidenceRecord, CrashSafetyRequirement, DesignComparison, OccupantMotionAnalysis, OccupantMotionInput, SafetyDesignEvidence, SafetyMetricRecord, TraceQuantity, ValidationArchitecture, Vector3, VerifiedCrashPulse } from "../shared/crashSafety";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
const version = "crash-occupant-safety-evidence/v1" as const;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const isHash = (value: string | undefined) => Boolean(value && /^[a-f0-9]{64}$/i.test(value));
const finite = (value: number) => Number.isFinite(value);
const vector = (value: unknown): value is Vector3 => Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number" && finite(entry));
const reject: (condition: unknown, code: string) => asserts condition = (condition, code) => { if (!condition) throw new Error(code); };
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
const delta = (left: Vector3, right: Vector3): Vector3 => [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
const scale = (value: Vector3, scalar: number): Vector3 => [value[0] * scalar, value[1] * scalar, value[2] * scalar];
const magnitude = (value: Vector3) => Math.hypot(...value);
const trace = (quantity: TraceQuantity["quantity"], unit: string, value: TraceQuantity["value"], assumptions: string[], provenanceReferences: string[], formulaIdentity: string): TraceQuantity => ({ quantity, unit, value, formulaIdentity, assumptions: unique(assumptions), provenanceReferences: unique(provenanceReferences) });

function validateRequirement(requirement: CrashSafetyRequirement) {
  reject(Boolean(requirement.requirementId?.trim()) && Boolean(requirement.scenario?.trim()) && Boolean(requirement.occupantCondition?.trim()) && Boolean(requirement.vehicleSeatConfiguration?.trim()) && Boolean(requirement.crashPulseDefinitionId?.trim()) && Boolean(requirement.initialCondition?.trim()) && Boolean(requirement.occupantMassAndInertiaSource?.trim()) && Boolean(requirement.responseMetric?.trim()), "CRASH_REQUIREMENT_IDENTITY_REQUIRED");
  reject(requirement.certificationStatus === "NOT_CERTIFIED", "CRASH_REQUIREMENT_CERTIFICATION_CLAIM_FORBIDDEN");
  reject(requirement.restraintAssumptions.length > 0 && requirement.provenanceReferences.length > 0 && Boolean(requirement.acceptanceCriterion?.criterionId?.trim()) && Boolean(requirement.acceptanceCriterion?.definition?.trim()) && Boolean(requirement.acceptanceCriterion?.source?.trim()) && Boolean(requirement.source?.trim()) && Boolean(requirement.verificationMethod?.trim()) && Boolean(requirement.validationMethod?.trim()), "CRASH_REQUIREMENT_PROVENANCE_REQUIRED");
}

export function validateCrashPulse(input: CrashPulseInput): VerifiedCrashPulse {
  reject(Boolean(input.pulseId?.trim()) && Boolean(input.source?.trim()) && input.provenanceReferences.length > 0 && finite(input.samplingRateHz) && input.samplingRateHz > 0 && input.accelerationUnit === "m/s2" && Boolean(input.filtering?.method?.trim()) && Boolean(input.filtering?.parameters?.trim()) && Boolean(input.filtering?.source?.trim()), "CRASH_PULSE_IDENTITY_OR_PROVENANCE_REQUIRED");
  reject(input.samples.length >= 2 && input.samples.every((sample) => finite(sample.timeS) && finite(sample.acceleration)) && input.samples[0].timeS === 0 && input.samples.slice(1).every((sample, index) => sample.timeS > input.samples[index].timeS), "CRASH_PULSE_TIME_SERIES_INVALID");
  const durationS = input.samples.at(-1)!.timeS;
  reject(durationS > 0, "CRASH_PULSE_DURATION_INVALID");
  const unsigned = { pulseId: input.pulseId, sourceKind: input.sourceKind, sampleCount: input.samples.length, samplingRateHz: input.samplingRateHz, durationS, accelerationUnit: input.accelerationUnit, coordinateDirection: input.coordinateDirection, filtering: input.filtering, provenanceReferences: unique([input.source, ...input.provenanceReferences]), limitation: input.sourceKind === "SYNTHETIC" ? "Synthetic pulse is input data only and cannot establish physical crash validation." : "Measured-pulse provenance is recorded; no safety or certification conclusion is inferred." };
  return { ...unsigned, integrityHash: hash({ input, unsigned }) };
}

export function analyzeOccupantMotion(input: OccupantMotionInput): OccupantMotionAnalysis {
  reject(Boolean(input.modelId?.trim()) && Boolean(input.source?.trim()) && Boolean(input.coordinateFrameId?.trim()) && Boolean(input.seatInterfaceId?.trim()), "OCCUPANT_MOTION_IDENTITY_REQUIRED");
  reject(input.biofidelityStatus === "NOT_VALIDATED", "OCCUPANT_BIOFIDELITY_CANNOT_BE_CLAIMED");
  reject(input.provenanceReferences.length > 0 && input.restraintInterfaceIds.length > 0 && input.contactInterfaceIds.length > 0 && input.segments.length > 0, "OCCUPANT_MOTION_PROVENANCE_OR_INTERFACE_REQUIRED");
  const required = ["PELVIS", "TORSO", "HEAD"] as const;
  reject(required.every((segment) => input.segments.some((entry) => entry.segment === segment)), "OCCUPANT_SEGMENT_REQUIRED");
  const pelvisFinalPosition = input.segments.find((entry) => entry.segment === "PELVIS")!.samples.at(-1)?.positionM;
  reject(pelvisFinalPosition && vector(pelvisFinalPosition), "OCCUPANT_PELVIS_REFERENCE_REQUIRED");
  const segments = input.segments.map((entry) => {
    reject(finite(entry.massKg) && entry.massKg > 0 && vector(entry.inertiaKgM2) && entry.samples.length >= 2 && entry.samples.every((sample) => finite(sample.timeS) && vector(sample.positionM) && vector(sample.velocityMps) && vector(sample.angularVelocityRadps)), "OCCUPANT_MASS_INERTIA_OR_SAMPLES_INVALID");
    const first = entry.samples[0]; const last = entry.samples.at(-1)!; const durationS = last.timeS - first.timeS;
    reject(first.timeS === 0 && durationS > 0 && entry.samples.slice(1).every((sample, index) => sample.timeS > entry.samples[index].timeS), "OCCUPANT_MOTION_TIME_AXIS_INVALID");
    const assumptions = [...input.assumptions, "Quantities derive only from declared kinematic samples and segment mass; no biofidelity, injury, safety, or certification finding is made."];
    const provenance = [input.source, ...input.provenanceReferences];
    const momentumInitial = scale(first.velocityMps, entry.massKg); const momentumFinal = scale(last.velocityMps, entry.massKg);
    const quantities = [trace("LINEAR_MOMENTUM", "kg*m/s", momentumFinal, assumptions, provenance, "p=m*v"), trace("IMPULSE", "N*s", delta(momentumFinal, momentumInitial), assumptions, provenance, "J=m*(v_final-v_initial)"), trace("ACCELERATION", "m/s2", scale(delta(last.velocityMps, first.velocityMps), 1 / durationS), assumptions, provenance, "a=(v_final-v_initial)/delta_t"), trace("DISPLACEMENT", "m", delta(last.positionM, first.positionM), assumptions, provenance, "delta_x=x_final-x_initial"), trace("STOPPING_TIME", "s", magnitude(last.velocityMps) <= 1e-9 ? durationS : "NOT_REACHED", assumptions, provenance, "explicit_terminal_velocity_check"), trace("LINEAR_KINETIC_ENERGY", "J", 0.5 * entry.massKg * magnitude(last.velocityMps) ** 2, assumptions, provenance, "E=0.5*m*|v|^2"), trace("RELATIVE_MOTION", "m", delta(last.positionM, pelvisFinalPosition), assumptions, provenance, "delta_x_segment_final_minus_pelvis_final")];
    return { segment: entry.segment, durationS, quantities, inputHash: hash(entry) };
  });
  const unsigned = { modelId: input.modelId, coordinateFrameId: input.coordinateFrameId, seatInterfaceId: input.seatInterfaceId, restraintInterfaceIds: unique(input.restraintInterfaceIds), contactInterfaceIds: unique(input.contactInterfaceIds), segments, biofidelityStatus: "NOT_VALIDATED" as const, limitations: ["No anthropomorphic biofidelity claim is made.", "No real-world occupant safety, injury, crashworthiness, or certification conclusion is inferred from this analysis."] };
  return { ...unsigned, analysisHash: hash(unsigned) };
}

export function compareSafetyDesignEvidence(baseline: SafetyDesignEvidence, proposed: SafetyDesignEvidence): DesignComparison {
  reject(Boolean(baseline.designId?.trim()) && Boolean(proposed.designId?.trim()) && baseline.designId !== proposed.designId, "SAFETY_COMPARISON_DESIGN_ID_INVALID");
  reject(isHash(baseline.seatRevisionHash) && isHash(proposed.seatRevisionHash) && baseline.inputProvenance.length > 0 && proposed.inputProvenance.length > 0, "SAFETY_COMPARISON_BINDING_OR_PROVENANCE_INVALID");
  const proposedById = new Map(proposed.metrics.map((metric) => [metric.metricId, metric]));
  const metrics = baseline.metrics.map((metric) => { const candidate = proposedById.get(metric.metricId); reject(candidate && candidate.unit === metric.unit && candidate.category === metric.category, "SAFETY_COMPARISON_METRIC_MISMATCH"); return { metricId: metric.metricId, category: metric.category, unit: metric.unit, baseline: metric.value, proposed: candidate.value, delta: candidate.value - metric.value }; });
  reject(metrics.length > 0 && metrics.length === proposed.metrics.length, "SAFETY_COMPARISON_METRIC_SET_MISMATCH");
  const unsigned = { baselineDesignId: baseline.designId, proposedDesignId: proposed.designId, metrics, conclusionBoundary: "ENGINEERING_EVIDENCE_ONLY" as const };
  return { ...unsigned, evidenceHash: hash({ ...unsigned, baseline, proposed }) };
}

export function validateSafetyNarrative(text: string): void { reject(!/\b(crash(?:worthiness)?\s+certified|occupant(?:\s+is)?\s+safe|regulation(?:s)?\s+compliant)\b/i.test(text), "UNAUTHORIZED_SAFETY_CLAIM"); }

function architecture(input: CrashSafetyEvidenceInput["validationArchitecture"]): ValidationArchitecture { return { ...input, physicalValidation: input.correlation === "EXTERNALLY_EVIDENCED" ? "EXTERNAL_CORRELATION_EVIDENCE_RECORDED" : "NOT_VALIDATED", limitation: input.correlation === "EXTERNALLY_EVIDENCED" ? "External correlation evidence is recorded; no safety or certification conclusion is inferred." : "Simulation cannot be presented as physically validated without externally evidenced correlation." }; }

export function evaluateCrashSafetyEvidence(args: { projectId: string; input: CrashSafetyEvidenceInput; createdAt?: string }): CrashSafetyEvidenceRecord {
  reject(Boolean(args.input.designId?.trim()), "CRASH_SAFETY_DESIGN_ID_REQUIRED"); reject(isHash(args.input.seatRevisionHash), "CRASH_SAFETY_SEAT_REVISION_HASH_INVALID"); validateRequirement(args.input.requirement);
  const crashPulse = validateCrashPulse(args.input.crashPulse); const occupantMotion = analyzeOccupantMotion(args.input.occupantMotion);
  reject(args.input.safetyMetrics.length > 0 && args.input.safetyMetrics.every((metric) => Boolean(metric.metricId?.trim()) && finite(metric.value) && Boolean(metric.unit?.trim()) && Boolean(metric.definition?.trim()) && Boolean(metric.source?.trim()) && metric.provenanceReferences.length > 0), "SAFETY_METRICS_INVALID");
  if (args.input.externalCertificationEvidence) { const evidence = args.input.externalCertificationEvidence; reject(Boolean(evidence.evidenceId.trim()) && Boolean(evidence.issuer.trim()) && Boolean(evidence.source.trim()) && Boolean(evidence.scope.trim()), "EXTERNAL_CERTIFICATION_EVIDENCE_INCOMPLETE"); reject(isHash(evidence.integrityHash), "EXTERNAL_CERTIFICATION_EVIDENCE_HASH_INVALID"); }
  const unsigned = { recordId: id("CRASH-SAFETY"), projectId: args.projectId, designId: args.input.designId, seatRevisionHash: args.input.seatRevisionHash, contractVersion: version, requirement: args.input.requirement, crashPulse, occupantMotion, safetyMetrics: args.input.safetyMetrics, validationArchitecture: architecture(args.input.validationArchitecture), certificationStatus: args.input.externalCertificationEvidence ? "EXTERNAL_CERTIFICATION_EVIDENCE_RECORDED" as const : "NOT_CERTIFIED" as const, ...(args.input.externalCertificationEvidence ? { externalCertificationEvidence: args.input.externalCertificationEvidence } : {}), claimBoundary: "NO_CRASHWORTHINESS_OR_OCCUPANT_SAFETY_CLAIM" as const, immutable: true as const, createdAt: args.createdAt ?? new Date().toISOString() };
  return { ...unsigned, evidenceHash: hash(unsigned) };
}

export async function createCrashSafetyEvidence(args: Access & { input: CrashSafetyEvidenceInput }): Promise<CrashSafetyEvidenceRecord> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  reject(args.input && typeof args.input === "object", "CRASH_SAFETY_INPUT_REQUIRED");
  const record = evaluateCrashSafetyEvidence({ projectId: args.projectId, input: args.input });
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CRASH_SAFETY_EVIDENCE", title: `Crash safety evidence · ${record.requirement.requirementId}`, content: JSON.stringify(record), truthStatus: "UNVERIFIED", validationStage: "GEOMETRICALLY_VALIDATED", sourceRecordId: record.recordId, relatedConfigurationId: record.seatRevisionHash, authorSource: "SYSTEM" } });
  return record;
}

export async function listCrashSafetyEvidence(args: Access): Promise<CrashSafetyEvidenceRecord[]> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  return (await projectMemorySnapshot(args)).records.filter((record) => record.kind === "CRASH_SAFETY_EVIDENCE").flatMap((record) => { try { return [JSON.parse(record.content) as CrashSafetyEvidenceRecord]; } catch { return []; } }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function comparePersistedCrashSafetyEvidence(args: Access & { baselineRecordId: string; proposedRecordId: string }): Promise<DesignComparison> {
  reject(Boolean(args.baselineRecordId?.trim()) && Boolean(args.proposedRecordId?.trim()) && args.baselineRecordId !== args.proposedRecordId, "SAFETY_COMPARISON_RECORD_ID_INVALID");
  const records = await listCrashSafetyEvidence(args); const baseline = records.find((record) => record.recordId === args.baselineRecordId); const proposed = records.find((record) => record.recordId === args.proposedRecordId);
  reject(baseline && proposed, "SAFETY_COMPARISON_RECORD_NOT_FOUND");
  return compareSafetyDesignEvidence({ designId: baseline.designId, seatRevisionHash: baseline.seatRevisionHash, metrics: baseline.safetyMetrics, inputProvenance: [baseline.evidenceHash, ...baseline.requirement.provenanceReferences] }, { designId: proposed.designId, seatRevisionHash: proposed.seatRevisionHash, metrics: proposed.safetyMetrics, inputProvenance: [proposed.evidenceHash, ...proposed.requirement.provenanceReferences] });
}
