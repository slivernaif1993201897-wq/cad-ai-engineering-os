export type Vector3 = [number, number, number];
export type EvidenceState = "RECORDED" | "NOT_AVAILABLE" | "EXTERNALLY_EVIDENCED";
export type SafetyCertificationStatus = "NOT_CERTIFIED" | "EXTERNAL_CERTIFICATION_EVIDENCE_RECORDED";

export interface CrashSafetyRequirement {
  requirementId: string;
  scenario: string;
  occupantCondition: string;
  vehicleSeatConfiguration: string;
  crashPulseDefinitionId: string;
  initialCondition: string;
  occupantMassAndInertiaSource: string;
  restraintAssumptions: string[];
  responseMetric: string;
  acceptanceCriterion: { criterionId: string; definition: string; source: string };
  source: string;
  provenanceReferences: string[];
  verificationMethod: string;
  validationMethod: string;
  certificationStatus: "NOT_CERTIFIED";
}

export interface CrashPulseInput {
  pulseId: string;
  sourceKind: "MEASURED" | "SYNTHETIC";
  source: string;
  provenanceReferences: string[];
  samplingRateHz: number;
  accelerationUnit: "m/s2";
  coordinateDirection: "X" | "Y" | "Z";
  filtering: { method: string; parameters: string; source: string };
  samples: Array<{ timeS: number; acceleration: number }>;
}

export interface VerifiedCrashPulse {
  pulseId: string;
  sourceKind: CrashPulseInput["sourceKind"];
  sampleCount: number;
  samplingRateHz: number;
  durationS: number;
  accelerationUnit: "m/s2";
  coordinateDirection: CrashPulseInput["coordinateDirection"];
  filtering: CrashPulseInput["filtering"];
  provenanceReferences: string[];
  integrityHash: string;
  limitation: string;
}

export interface OccupantSegmentInput {
  segment: "PELVIS" | "TORSO" | "HEAD";
  massKg: number;
  inertiaKgM2: Vector3;
  samples: Array<{ timeS: number; positionM: Vector3; velocityMps: Vector3; angularVelocityRadps: Vector3 }>;
}

export interface OccupantMotionInput {
  modelId: string;
  source: string;
  coordinateFrameId: string;
  seatInterfaceId: string;
  restraintInterfaceIds: string[];
  contactInterfaceIds: string[];
  segments: OccupantSegmentInput[];
  assumptions: string[];
  provenanceReferences: string[];
  biofidelityStatus: "NOT_VALIDATED";
}

export interface TraceQuantity {
  quantity: "LINEAR_MOMENTUM" | "IMPULSE" | "ACCELERATION" | "DISPLACEMENT" | "STOPPING_TIME" | "LINEAR_KINETIC_ENERGY" | "RELATIVE_MOTION";
  unit: string;
  value: number | Vector3 | "NOT_REACHED";
  formulaIdentity: string;
  assumptions: string[];
  provenanceReferences: string[];
}

export interface OccupantMotionAnalysis {
  modelId: string;
  coordinateFrameId: string;
  seatInterfaceId: string;
  restraintInterfaceIds: string[];
  contactInterfaceIds: string[];
  segments: Array<{ segment: OccupantSegmentInput["segment"]; durationS: number; quantities: TraceQuantity[]; inputHash: string }>;
  biofidelityStatus: "NOT_VALIDATED";
  limitations: string[];
  analysisHash: string;
}

export interface SafetyMetricRecord {
  metricId: string;
  category: "HEAD_RESPONSE" | "PELVIS_RESPONSE" | "CONTACT_FORCE" | "RESTRAINT_LOAD" | "ENERGY" | "ACCELERATION" | "DISPLACEMENT" | "OTHER";
  segment?: OccupantSegmentInput["segment"];
  value: number;
  unit: string;
  definition: string;
  source: string;
  provenanceReferences: string[];
}

export interface ValidationArchitecture {
  simulation: EvidenceState;
  referenceModel: EvidenceState;
  benchTest: EvidenceState;
  physicalTest: EvidenceState;
  correlation: EvidenceState;
  physicalValidation: "NOT_VALIDATED" | "EXTERNAL_CORRELATION_EVIDENCE_RECORDED";
  limitation: string;
}

export interface CrashSafetyEvidenceInput {
  designId: string;
  seatRevisionHash: string;
  requirement: CrashSafetyRequirement;
  crashPulse: CrashPulseInput;
  occupantMotion: OccupantMotionInput;
  safetyMetrics: SafetyMetricRecord[];
  validationArchitecture: Omit<ValidationArchitecture, "physicalValidation" | "limitation">;
  externalCertificationEvidence?: { evidenceId: string; issuer: string; source: string; scope: string; integrityHash: string };
}

export interface CrashSafetyEvidenceRecord {
  recordId: string;
  projectId: string;
  designId: string;
  seatRevisionHash: string;
  contractVersion: "crash-occupant-safety-evidence/v1";
  requirement: CrashSafetyRequirement;
  crashPulse: VerifiedCrashPulse;
  occupantMotion: OccupantMotionAnalysis;
  safetyMetrics: SafetyMetricRecord[];
  validationArchitecture: ValidationArchitecture;
  certificationStatus: SafetyCertificationStatus;
  externalCertificationEvidence?: CrashSafetyEvidenceInput["externalCertificationEvidence"];
  claimBoundary: "NO_CRASHWORTHINESS_OR_OCCUPANT_SAFETY_CLAIM";
  evidenceHash: string;
  immutable: true;
  createdAt: string;
}

export interface SafetyDesignEvidence {
  designId: string;
  seatRevisionHash: string;
  metrics: SafetyMetricRecord[];
  inputProvenance: string[];
}

export interface DesignComparison {
  baselineDesignId: string;
  proposedDesignId: string;
  metrics: Array<{ metricId: string; category: SafetyMetricRecord["category"]; unit: string; baseline: number; proposed: number; delta: number }>;
  conclusionBoundary: "ENGINEERING_EVIDENCE_ONLY";
  evidenceHash: string;
}
