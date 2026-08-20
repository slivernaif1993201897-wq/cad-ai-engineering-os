import type { EngineeringTruthStatus, RuthlessEngineeringReview } from "./engineeringTruth";

export const ENGINEERING_MODES = ["NORMAL", "DEEP_ENGINEERING", "EXPLORATION", "SPECULATIVE", "CHALLENGE"] as const;
export type EngineeringMode = (typeof ENGINEERING_MODES)[number];
export type SpecialistRole = "PHYSICS_REVIEWER" | "CAD_REVIEWER" | "MANUFACTURING_REVIEWER" | "SAFETY_REVIEWER" | "OPTIMIZATION_REVIEWER" | "SYSTEMS_REVIEWER";
export type CandidateState = "RETAINED" | "NEEDS_REVISION" | "REJECTED" | "SPECULATIVE";
export type MemoryRecordType = "REQUIREMENT" | "ASSUMPTION" | "CONCEPT" | "FAILED_CONCEPT" | "REJECTED_CONCEPT" | "DESIGN_DECISION" | "VALIDATION_EVIDENCE" | "DESIGN_REVISION";

export interface EngineeringSubsystem {
  id: string;
  name: string;
  objective: string;
  constraints: string[];
  unknowns: string[];
  truthStatus: EngineeringTruthStatus;
}

export interface EngineeringDecomposition {
  problemStatement: string;
  objective: string;
  requirements: string[];
  constraints: string[];
  unknowns: string[];
  contradictions: string[];
  solutionSpace: string[];
  subsystems: EngineeringSubsystem[];
}

export interface ConceptCandidate {
  id: string;
  title: string;
  architectureFamily: "DIRECT_LOAD_PATH" | "MODULAR_FUNCTIONAL" | "PROGRESSIVE_RESPONSE" | "KINEMATIC_CONTROL" | "DISTRIBUTED_ENERGY" | "MATERIAL_LED" | "SPECULATIVE_ARCHITECTURE";
  mechanism: string;
  differentiation: string;
  truthStatus: EngineeringTruthStatus;
  state: CandidateState;
  assumptions: string[];
  risks: string[];
  requiredEvidence: string[];
  traceabilityIds: string[];
}

export interface SpecialistFinding {
  id: string;
  role: SpecialistRole;
  candidateId: string;
  challenge: string;
  category: "PHYSICS" | "GEOMETRY" | "LOADS" | "MATERIAL" | "MANUFACTURING" | "ASSEMBLY" | "INTEGRATION" | "FAILURE_MODE" | "ASSUMPTION" | "UNKNOWN";
  truthStatus: EngineeringTruthStatus;
  outcome: "CHALLENGE" | "RETAIN" | "REJECT";
  evidenceNeeded: string[];
}

export interface SelfCorrectionRecord {
  candidateId: string;
  failure: string;
  cause: string;
  modification: string;
  reevaluation: string;
  truthStatus: EngineeringTruthStatus;
}

export interface CandidateRanking {
  candidateId: string;
  rank: number;
  rationale: string;
  state: CandidateState;
  truthStatus: EngineeringTruthStatus;
}

export interface EngineeringMemoryRecord {
  id: string;
  type: MemoryRecordType;
  referenceId: string;
  summary: string;
  truthStatus: EngineeringTruthStatus;
  timestamp: string;
}

export interface MaximumEffortReport {
  attempts: string[];
  failedApproaches: string[];
  remainingUnknowns: string[];
  toolsMissing: string[];
  informationRequired: string[];
  experimentOrAnalysisPlan: string[];
  remainingAlternatives: string[];
  conclusion: string;
  truthStatus: EngineeringTruthStatus;
}

export interface CADHandoffPlan {
  eligibility: "CAD_READY" | "CONCEPTUAL_ONLY" | "BLOCKED";
  reason: string;
  selectedCandidateId?: string;
  requirementsNeeded: string[];
  cadPlanOutline: string[];
  validationPlan: string[];
  truthStatus: EngineeringTruthStatus;
}

export interface EngineeringBenchmark {
  problemDecomposition: boolean;
  constraintSatisfaction: boolean;
  conceptDiversity: boolean;
  physicsConsistency: boolean;
  failureDetection: boolean;
  alternativeGeneration: boolean;
  selfCorrection: boolean;
  requirementTraceability: boolean;
  manufacturingReasoning: boolean;
  cadHandoffIntegrity: boolean;
  passed: boolean;
  limitations: string[];
}

export interface EngineeringIntelligenceInput {
  sourceText: string;
  mode?: EngineeringMode;
  projectId?: string;
  requestMajorInnovation?: boolean;
  geometryStatus?: "NOT_GENERATED" | "GEOMETRICALLY_GENERATED" | "GEOMETRICALLY_VALIDATED";
}

export interface EngineeringIntelligenceResult {
  runId: string;
  projectId: string;
  mode: EngineeringMode;
  decomposition: EngineeringDecomposition;
  truthReview: RuthlessEngineeringReview;
  candidates: ConceptCandidate[];
  specialistFindings: SpecialistFinding[];
  selfCorrections: SelfCorrectionRecord[];
  ranking: CandidateRanking[];
  memory: EngineeringMemoryRecord[];
  maximumEffort: MaximumEffortReport;
  cadHandoff: CADHandoffPlan;
  benchmark: EngineeringBenchmark;
}
