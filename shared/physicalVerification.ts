/**
 * Physical-engineering claim model. These levels are deliberately independent:
 * a higher claim can never be inferred from a lower level by this contract.
 */
export const PHYSICAL_VERIFICATION_LEVELS = [
  "COMPUTATION_EXECUTED",
  "NUMERICALLY_VERIFIED",
  "MODEL_VALIDATED",
  "EXPERIMENTALLY_CORRELATED",
  "ENGINEERING_ACCEPTED",
  "REGULATORY_CERTIFIED",
] as const;
export type PhysicalVerificationLevel = (typeof PHYSICAL_VERIFICATION_LEVELS)[number];

export const PHYSICAL_RESULT_CLASSIFICATIONS = [
  "VALIDATED_REFERENCE_CASE",
  "NUMERICALLY_CONVERGED",
  "NUMERICALLY_UNCERTAIN",
  "MODEL_ASSUMPTION_LIMITED",
  "EXPERIMENTALLY_CORRELATED",
  "NOT_VALIDATED",
  "EXECUTION_ONLY",
] as const;
export type PhysicalResultClassification = (typeof PHYSICAL_RESULT_CLASSIFICATIONS)[number];

export type VerificationLevelState = "ACHIEVED" | "NOT_ACHIEVED" | "REQUIRED_INPUT" | "NOT_APPLICABLE";
export type VerificationCheckStatus = "PASS" | "FAIL" | "REQUIRED_INPUT" | "NOT_APPLICABLE";
export type NumericalDimension = "STRESS" | "DISPLACEMENT" | "FORCE" | "MOMENT" | "ENERGY" | "FREQUENCY" | "DIMENSIONLESS";

export interface VerificationClaimLevels {
  computation: VerificationLevelState;
  numericalVerification: VerificationLevelState;
  modelValidation: VerificationLevelState;
  experimentalCorrelation: VerificationLevelState;
  engineeringAcceptance: VerificationLevelState;
  regulatoryCertification: VerificationLevelState;
}

export interface VerificationMaterialIdentity {
  materialId: string;
  definition: string;
  source: string;
  propertiesHash: string;
  unitSystem: string;
  constitutiveModel: string;
}

export interface VerificationMeshIdentity {
  meshId: string;
  meshHash: string;
  nodeCount: number;
  elementCount: number;
  qualityStatus: "PASS" | "FAIL" | "UNKNOWN";
  elementType: string;
}

export interface VerificationCriterion {
  criterionId: string;
  referenceSolutionId: string;
  referenceSolutionHash: string;
  quantity: string;
  dimension: NumericalDimension;
  expectedValue: number;
  unit: string;
  relativeTolerance: number;
  source: string;
}

export interface VerificationObservedResult {
  value: number;
  unit: string;
  resultHash: string;
  solverConvergence: "CONVERGED" | "DIVERGED" | "UNKNOWN";
  solverWarnings: string[];
}

export interface MeshConvergenceSample {
  meshId: string;
  meshHash: string;
  targetSize: number;
  elementCount: number;
  result: number;
  unit: string;
}

export interface MeshConvergenceCriterion {
  criterionId: string;
  targetQuantity: string;
  unit: string;
  maximumRelativeChange: number;
  source: string;
}

export interface MeshConvergenceAssessment {
  criterion: MeshConvergenceCriterion;
  samples: Array<MeshConvergenceSample & { relativeChange?: number }>;
  status: "CONVERGED" | "NOT_CONVERGED" | "REQUIRED_INPUT";
  reason: string;
}

export interface PhysicalVerificationCheck {
  check: "UNIT_CONSISTENCY" | "DIMENSIONAL_CONSISTENCY" | "MESH_QUALITY" | "MESH_CONVERGENCE" | "SOLVER_CONVERGENCE" | "REACTION_FORCE_EQUILIBRIUM" | "ENERGY_BALANCE" | "CONSTRAINT_CONSISTENCY" | "LOAD_PATH_SANITY" | "BOUNDARY_CONDITION_COMPLETENESS" | "RESULT_SANITY";
  status: VerificationCheckStatus;
  statement: string;
  evidenceIds: string[];
}

export interface PhysicalEngineeringVerificationInput {
  scope: "ENGINEERING_JOB" | "ANALYTICAL_REFERENCE_CASE";
  requirementId: string;
  engineeringQuestion: string;
  geometryRevision: string;
  geometryHash: string;
  coordinateSystem: string;
  material: VerificationMaterialIdentity;
  mesh: VerificationMeshIdentity;
  boundaryConditionIds: string[];
  loadIds: string[];
  contactIds: string[];
  solver: { identity: string; version: string; settingsHash: string; inputHash: string; outputHash: string; runtimeEvidenceHash?: string };
  observedResult: VerificationObservedResult;
  criterion: VerificationCriterion;
  meshConvergence?: { criterion: MeshConvergenceCriterion; samples: MeshConvergenceSample[] };
  reactionEquilibrium?: { appliedForce: number; reactionForce: number; unit: string; relativeTolerance: number; source: string };
  energyBalance?: { inputEnergy: number; outputEnergy: number; unit: string; relativeTolerance: number; source: string };
  provenanceReferences: string[];
  lineageReferences: string[];
  assumptions: string[];
  simplifications: string[];
  expectedPhysicalBehavior: string;
}

export interface PhysicalEngineeringVerificationRecord {
  verificationId: string;
  projectId: string;
  jobId?: string;
  scope: PhysicalEngineeringVerificationInput["scope"];
  contractVersion: "physical-engineering-verification/v1";
  requirementId: string;
  engineeringQuestion: string;
  geometryRevision: string;
  geometryHash: string;
  coordinateSystem: string;
  material: VerificationMaterialIdentity;
  mesh: VerificationMeshIdentity;
  boundaryConditionIds: string[];
  loadIds: string[];
  contactIds: string[];
  solver: PhysicalEngineeringVerificationInput["solver"];
  observedResult: VerificationObservedResult;
  criterion: VerificationCriterion;
  checks: PhysicalVerificationCheck[];
  meshConvergence?: MeshConvergenceAssessment;
  levels: VerificationClaimLevels;
  classification: PhysicalResultClassification;
  provenanceReferences: string[];
  lineageReferences: string[];
  assumptions: string[];
  simplifications: string[];
  expectedPhysicalBehavior: string;
  limitations: string[];
  verificationHash: string;
  immutable: true;
  createdAt: string;
}
