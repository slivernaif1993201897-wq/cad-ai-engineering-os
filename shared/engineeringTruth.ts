/**
 * Truth status is categorical provenance, not probability. Confidence is always
 * carried separately and must never promote an unverified claim into a fact.
 */
export const ENGINEERING_TRUTH_STATUSES = [
  "FACT",
  "CALCULATED",
  "DERIVED",
  "ESTIMATED",
  "ASSUMED",
  "HYPOTHETICAL",
  "UNVERIFIED",
  "SPECULATIVE",
  "PHYSICS_CONFLICT",
  "UNKNOWN",
] as const;

export type EngineeringTruthStatus = (typeof ENGINEERING_TRUTH_STATUSES)[number];
export type EvidenceSource = "USER_INPUT" | "DETERMINISTIC_RULE" | "OPENCASCADE_KERNEL" | "REQUIREMENTS_AGENT" | "NOT_PROVIDED";
export type EngineeringDiscipline = "SYSTEM" | "PHYSICS" | "GEOMETRY" | "MANUFACTURING" | "SAFETY" | "INTEGRATION" | "MATERIAL" | "VERIFICATION";
export type ReviewVerdict = "THE_CONCEPT_IS_WEAK" | "THIS_APPROACH_FAILS_BECAUSE" | "THE_CONCEPT_IS_PROMISING_BUT_RISKS_REMAIN" | "ENGINEERING_EVIDENCE_SUPPORTS";
export type ReviewGate = "BLOCKED" | "CONCEPTUAL_ONLY" | "CAD_ELIGIBLE";
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface EngineeringStatement {
  id: string;
  text: string;
  truthStatus: EngineeringTruthStatus;
  confidence: number;
  source: EvidenceSource;
  discipline: EngineeringDiscipline;
  provenance: string;
  traceabilityIds: string[];
}

export interface EngineeringEvidenceChain {
  id: string;
  conclusionId: string;
  inputs: EngineeringStatement[];
  assumptions: EngineeringStatement[];
  method: string;
  results: EngineeringStatement[];
  limitations: EngineeringStatement[];
}

export interface EngineeringUnknown {
  id: string;
  question: string;
  whyItMatters: string;
  blocking: boolean;
  discipline: EngineeringDiscipline;
  truthStatus: "UNKNOWN";
}

export interface EngineeringContradiction {
  id: string;
  objectiveA: string;
  objectiveB: string;
  conflict: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  truthStatus: EngineeringTruthStatus;
  resolutionPrinciples: string[];
  requiredEvidence: string[];
}

export interface DesignAlternative {
  id: string;
  title: string;
  architecture: string;
  mechanism: string;
  tradeoffs: string[];
  truthStatus: EngineeringTruthStatus;
  confidence: number;
  requiredEvidence: string[];
  rank: number;
  rankingRationale: string;
}

export interface RedTeamFinding {
  id: string;
  category: "STRUCTURAL" | "KINEMATIC" | "THERMAL" | "FATIGUE" | "BUCKLING" | "CONTACT" | "ASSEMBLY" | "MANUFACTURING" | "SERVICEABILITY" | "INTEGRATION" | "COST" | "SAFETY";
  finding: string;
  applicability: "APPLICABLE" | "UNKNOWN" | "NOT_EVALUATED";
  truthStatus: EngineeringTruthStatus;
  evidenceNeeded: string[];
}

export interface SelfCritique {
  couldBeWrong: string[];
  weakestAssumptions: string[];
  missingData: string[];
  nonValidatedClaims: string[];
  overlookedAlternatives: string[];
  correctedStatement: string;
}

export interface RealitySeparation {
  geometry: "NOT_GENERATED" | "GEOMETRICALLY_GENERATED" | "GEOMETRICALLY_VALIDATED";
  physics: "NOT_ANALYZED" | "UNKNOWN" | "PHYSICS_CONFLICT" | "ANALYSIS_PENDING";
  manufacturing: "NOT_ASSESSED" | "UNKNOWN" | "CONSTRAINTS_IDENTIFIED";
  productionReadiness: "NOT_ASSESSED" | "NOT_READY";
}

export interface RuthlessEngineeringReview {
  reviewId: string;
  sourceText: string;
  exploratoryMode: boolean;
  understanding: EngineeringStatement;
  known: EngineeringStatement[];
  unknown: EngineeringUnknown[];
  assumptions: EngineeringStatement[];
  constraints: EngineeringStatement[];
  physics: EngineeringStatement[];
  contradictions: EngineeringContradiction[];
  alternatives: DesignAlternative[];
  redTeam: RedTeamFinding[];
  evidenceChains: EngineeringEvidenceChain[];
  verdict: ReviewVerdict;
  verdictReason: string;
  gate: ReviewGate;
  difficultyLevel: DifficultyLevel;
  reality: RealitySeparation;
  selfCritique: SelfCritique;
  nextTest: EngineeringStatement;
  limitations: EngineeringStatement[];
}

export interface EngineeringReviewInput {
  sourceText: string;
  exploratoryMode?: boolean;
  geometryStatus?: RealitySeparation["geometry"];
  requirementSetId?: string;
  configurationId?: string;
}
