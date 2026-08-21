import type { EngineeringTruthStatus } from "./engineeringTruth";

export type OptimizationMethod = "CONCEPTUAL_DESIGN_SPACE" | "PARAMETER_SWEEP_DECLARATION" | "SENSITIVITY_PLAN" | "SINGLE_OBJECTIVE_PLAN" | "MULTI_OBJECTIVE_PLAN" | "PARETO_PLAN";
export type OptimizationStudyState = "DECLARED" | "REVIEW_REQUIRED" | "REJECTED" | "UNKNOWN";
export type OptimizationVariableKind = "CONTINUOUS" | "INTEGER" | "ENUM" | "BOOLEAN";
export type OptimizationEvaluationAvailability = "NUMERICAL_CAE_UNAVAILABLE" | "CONCEPTUAL_ONLY" | "UNKNOWN";

export interface OptimizationVariable {
  variableId: string;
  name: string;
  kind: OptimizationVariableKind;
  unit?: string;
  minimum?: number;
  maximum?: number;
  allowedValues?: Array<string | number | boolean>;
  sourceArtifactId: string;
  truthStatus: EngineeringTruthStatus;
}

export interface OptimizationObjective {
  objectiveId: string;
  title: string;
  direction: "MINIMIZE" | "MAXIMIZE" | "TARGET";
  metricReference: string;
  unit?: string;
  sourceArtifactIds: string[];
  evaluationAvailability: OptimizationEvaluationAvailability;
  truthStatus: EngineeringTruthStatus;
}

export interface OptimizationConstraint {
  constraintId: string;
  title: string;
  comparison: "LESS_THAN_OR_EQUAL" | "GREATER_THAN_OR_EQUAL" | "EQUAL" | "DECLARED";
  targetValue?: number;
  unit?: string;
  sourceArtifactIds: string[];
  evaluationAvailability: OptimizationEvaluationAvailability;
  truthStatus: EngineeringTruthStatus;
}

export interface OptimizationStudy {
  optimizationStudyId: string;
  projectId: string;
  digitalThreadArtifactId: string;
  title: string;
  revision: string;
  sourceArtifactIds: string[];
  method: OptimizationMethod;
  variables: OptimizationVariable[];
  objectives: OptimizationObjective[];
  constraints: OptimizationConstraint[];
  state: OptimizationStudyState;
  evaluationAvailability: OptimizationEvaluationAvailability;
  numericalResultsAvailable: false;
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface OptimizationCandidate {
  candidateId: string;
  projectId: string;
  optimizationStudyId: string;
  digitalThreadArtifactId: string;
  candidateLabel: string;
  parameterValues: Array<{ variableId: string; value: string | number | boolean; truthStatus: EngineeringTruthStatus }>;
  sourceArtifactIds: string[];
  evaluationStatus: "NOT_EVALUATED" | "INVALID" | "UNKNOWN";
  objectiveValues: [];
  constraintValues: [];
  rankingState: "BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE";
  rankAssigned: false;
  validity: "CONCEPTUAL_ONLY" | "INVALID" | "UNKNOWN";
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface OptimizationAssessment {
  assessmentId: string;
  projectId: string;
  optimizationStudy: OptimizationStudy;
  candidates: OptimizationCandidate[];
  rankingState: "BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE";
  limitations: string[];
  executionEligible: false;
  executable: false;
  createdAt: string;
}
