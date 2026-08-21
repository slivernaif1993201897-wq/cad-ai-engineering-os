import type { GeometrySelectionContext } from "./cadWorkbench";
import type { EngineeringTruthStatus } from "./engineeringTruth";

export const CAE_ANALYSIS_TYPES = ["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"] as const;
export type CAEAnalysisType = (typeof CAE_ANALYSIS_TYPES)[number];
export const CAE_PLAN_STATUSES = ["NOT_READY", "READY_FOR_REVIEW", "READY_FOR_SOLVER", "EXECUTING", "COMPLETED", "FAILED", "VALIDATION_REQUIRED"] as const;
export type CAEPlanStatus = (typeof CAE_PLAN_STATUSES)[number];
export const CAE_TRUTH_STATUSES = ["INPUT_VERIFIED", "INPUT_ASSUMED", "CALCULATED", "SOLVER_RESULT", "POST_PROCESSED", "UNVERIFIED", "UNKNOWN"] as const;
export type CAETruthStatus = (typeof CAE_TRUTH_STATUSES)[number];
export const MATERIAL_PROPERTY_SOURCES = ["SOURCE_VERIFIED", "USER_PROVIDED", "DATABASE_VERIFIED", "CALCULATED", "ASSUMED", "UNKNOWN"] as const;
export type MaterialPropertySource = (typeof MATERIAL_PROPERTY_SOURCES)[number];
export const CAE_RESULT_STATUSES = ["NOT_EXECUTED", "SOLVER_UNAVAILABLE", "INVALID"] as const;
export type CAEResultStatus = (typeof CAE_RESULT_STATUSES)[number];

export interface CAEGeometryScope {
  sourceCadRevision: string;
  sourceCadBranch: string;
  sourceCadProjectId: string;
  geometryProvenance: "OPENCASCADE_KERNEL" | "PARSED_STEP" | "PARSED_STL" | "UNKNOWN";
  geometryValidation: "VALID" | "UNAVAILABLE" | "UNKNOWN";
  featureHistory: string[];
  selectedGeometry?: GeometrySelectionContext;
  declaredRegionReference?: string;
  selectionStatus: "PROVEN" | "AMBIGUOUS" | "UNKNOWN";
}

export interface CAEMaterialProperty {
  name: "ELASTIC_MODULUS" | "POISSON_RATIO" | "DENSITY" | "YIELD_STRENGTH" | "THERMAL_CONDUCTIVITY" | "THERMAL_EXPANSION" | "SPECIFIC_HEAT" | "CUSTOM";
  value?: number;
  unit?: string;
  source: MaterialPropertySource;
  provenance?: string;
  requiredFor: CAEAnalysisType[];
}

export interface CAEMaterialDefinition {
  materialId?: string;
  name?: string;
  properties: CAEMaterialProperty[];
  status: "COMPLETE" | "MATERIAL_KNOWLEDGE_GAP" | "UNKNOWN";
}

export interface MaterialKnowledgeGap {
  id: string;
  kind: "MATERIAL_KNOWLEDGE_GAP";
  missingProperty: CAEMaterialProperty["name"];
  whyRequired: string;
  acceptableUnits: string[];
  possibleSource: string;
  requiredExperiment?: string;
  blocking: boolean;
}

export interface CAEBoundaryCondition {
  id: string;
  geometryReference?: string;
  type: "FIXED" | "DISPLACEMENT" | "SYMMETRY" | "ROLLER" | "THERMAL" | "CUSTOM";
  direction?: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z" | "NORMAL" | "TANGENTIAL" | "ALL";
  magnitude?: number;
  unit?: string;
  source: "USER_PROVIDED" | "REQUIREMENT" | "ASSUMED" | "UNKNOWN";
  confidence: number;
  assumptionStatus: "NOT_ASSUMED" | "ASSUMED" | "UNKNOWN";
  geometryStatus: "PROVEN" | "AMBIGUOUS" | "UNKNOWN";
}

export interface CAELoad {
  id: string;
  type: "FORCE" | "PRESSURE" | "MOMENT" | "GRAVITY" | "ACCELERATION" | "THERMAL" | "TIME_DEPENDENT";
  geometryReference?: string;
  magnitude?: number;
  unit?: string;
  direction?: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z" | "NORMAL" | "CUSTOM";
  timeDependence?: string;
  source: "USER_PROVIDED" | "REQUIREMENT" | "CALCULATED" | "ASSUMED" | "UNKNOWN";
  assumptionStatus: "NOT_ASSUMED" | "ASSUMED" | "UNKNOWN";
  geometryStatus: "PROVEN" | "AMBIGUOUS" | "UNKNOWN";
}

export interface CAEContact {
  id: string;
  type: "BONDED" | "FRICTIONLESS" | "FRICTIONAL" | "NO_SEPARATION";
  primaryGeometryReference?: string;
  secondaryGeometryReference?: string;
  source: "USER_PROVIDED" | "ASSUMED" | "UNKNOWN";
  status: "PLANNED" | "KNOWLEDGE_GAP";
}

export interface CAEMeshStrategy {
  elementType?: "TETRAHEDRAL" | "HEXA_HYBRID" | "SHELL" | "BEAM" | "UNKNOWN";
  targetSize?: number;
  unit?: string;
  refinementRegions: Array<{ geometryReference?: string; rationale: string; status: "PLANNED" | "UNKNOWN" }>;
  qualityRequirements: string[];
  convergenceRequirement?: string;
  status: "PLANNED" | "MESH_KNOWLEDGE_GAP" | "NOT_EXECUTED";
}

export interface CAESolverDefinition {
  adapterId: "NO_EXECUTABLE_SOLVER";
  name: "No executable solver configured";
  capabilities: CAEAnalysisType[];
  status: "UNAVAILABLE";
  reason: string;
}

export interface ICAESolverAdapter {
  readonly id: string;
  prepare(plan: CAESimulationPlan): Promise<{ status: "UNAVAILABLE" | "PREPARED"; evidence: string[] }>;
  validate(plan: CAESimulationPlan): Promise<{ status: "INVALID" | "VALID"; findings: string[] }>;
  execute(plan: CAESimulationPlan): Promise<CAEResultEnvelope>;
  cancel(plan: CAESimulationPlan): Promise<{ status: "CANCELLED" | "UNAVAILABLE"; evidence: string[] }>;
  collectResults(plan: CAESimulationPlan): Promise<CAEResultEnvelope>;
  verifyResults(plan: CAESimulationPlan, result: CAEResultEnvelope): Promise<{ status: "INVALID" | "VERIFIED"; findings: string[] }>;
}

export interface CAEKnowledgeGap {
  id: string;
  kind: "KNOWLEDGE_GAP" | "PHYSICS_CONFLICT";
  missingInformation: string;
  whyItMatters: string;
  possibleSource: string;
  possibleExperiment?: string;
  possibleSimulation?: string;
  possibleMeasurement?: string;
  blocking: boolean;
  truthStatus: "UNKNOWN" | "PHYSICS_CONFLICT";
}

export interface CAETraceabilityLink {
  id: string;
  fromType: "REQUIREMENT" | "CAD_FEATURE" | "GEOMETRY" | "CAE_LOAD" | "CAE_BOUNDARY" | "SIMULATION" | "VALIDATION";
  fromId: string;
  toType: "REQUIREMENT" | "CAD_FEATURE" | "GEOMETRY" | "CAE_LOAD" | "CAE_BOUNDARY" | "SIMULATION" | "VALIDATION";
  toId: string;
  rationale: string;
  status: "DECLARED" | "PROVEN" | "UNKNOWN";
}

export interface CAEAssumption {
  id: string;
  category: "MATERIAL" | "BOUNDARY" | "LOAD" | "CONTACT" | "MESH" | "SOLVER" | "PHYSICS";
  statement: string;
  truthStatus: "INPUT_ASSUMED" | "UNVERIFIED" | "UNKNOWN";
  source: string;
  dangerous: boolean;
}

export interface CAEAdversarialFinding {
  id: string;
  reviewer: "PHYSICS" | "BOUNDARY" | "MATERIAL" | "MESH" | "SOLVER" | "EXPERIMENTAL" | "VALIDATION";
  question: string;
  finding: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  blocking: boolean;
  requiredEvidence: string[];
}

export interface CAESelfCritique {
  id: string;
  incorrectAssumptions: string[];
  missingLoads: string[];
  incorrectConstraints: string[];
  analysisTypeRisks: string[];
  materialUncertainty: string[];
  meshUncertainty: string[];
  solverLimitations: string[];
  experimentalMismatch?: string[];
  uncertaintyWarnings?: string[];
  resultInterpretationRisks: string[];
  correctedSummary: string;
}

export interface CADChangeRequest {
  id: string;
  status: "PROPOSED" | "NOT_CREATED";
  requestedChange: string;
  rationale: string;
  sourceSimulationId: string;
  sourceCadRevision: string;
  truthStatus: EngineeringTruthStatus;
}

export interface CAEEvidenceRequirement {
  id: string;
  category: "MATERIAL" | "LOAD" | "BOUNDARY" | "CONTACT" | "MESH" | "SOLVER" | "VALIDATION";
  statement: string;
  blocking: boolean;
  status: CAETruthStatus;
}

export interface CAEResultEnvelope {
  status: CAEResultStatus;
  truthStatus: "UNVERIFIED" | "UNKNOWN";
  solverId: "NO_EXECUTABLE_SOLVER";
  reason: string;
  numericalResults: never[];
}

export interface CAESimulationPlan {
  simulationId: string;
  projectId: string;
  createdAt: string;
  sourceCadRevision: string;
  engineeringQuestion: string;
  analysisType: CAEAnalysisType;
  physicsModel: string[];
  geometryScope: CAEGeometryScope;
  materialDefinition: CAEMaterialDefinition;
  boundaryConditions: CAEBoundaryCondition[];
  loads: CAELoad[];
  contacts: CAEContact[];
  meshStrategy: CAEMeshStrategy;
  solver: CAESolverDefinition;
  assumptions: CAEAssumption[];
  unknowns: Array<CAEKnowledgeGap | MaterialKnowledgeGap>;
  validationRequirements: string[];
  evidenceRequirements: CAEEvidenceRequirement[];
  traceability: CAETraceabilityLink[];
  adversarialReview: CAEAdversarialFinding[];
  selfCritique: CAESelfCritique;
  cadChangeRequests: CADChangeRequest[];
  result: CAEResultEnvelope;
  status: CAEPlanStatus;
  truthStatus: CAETruthStatus;
  limitations: string[];
}

export interface CAEPlanInput {
  projectId: string;
  sourceCadRevision: string;
  sourceCadBranch?: string;
  engineeringQuestion: string;
  analysisType?: CAEAnalysisType;
  selectedGeometry?: GeometrySelectionContext;
  featureHistory?: string[];
  geometryProvenance?: CAEGeometryScope["geometryProvenance"];
  geometryValidation?: CAEGeometryScope["geometryValidation"];
  material?: CAEMaterialDefinition;
  boundaryConditions?: CAEBoundaryCondition[];
  loads?: CAELoad[];
  contacts?: CAEContact[];
  meshStrategy?: CAEMeshStrategy;
  requirementIds?: string[];
}

export interface CAEPlanSummary {
  simulationId: string;
  sourceCadRevision: string;
  engineeringQuestion: string;
  analysisType: CAEAnalysisType;
  status: CAEPlanStatus;
  truthStatus: CAETruthStatus;
  unknownCount: number;
  blockingGapCount: number;
  createdAt: string;
}

export const SOLVER_ADAPTER_CONTRACT_VERSION = "1.0.0" as const;
export const SOLVER_ADAPTER_STATUSES = ["UNAVAILABLE", "AVAILABLE", "READY", "EXECUTING", "COMPLETED", "FAILED", "CANCELLED", "VALIDATION_REQUIRED"] as const;
export type SolverAdapterStatus = (typeof SOLVER_ADAPTER_STATUSES)[number];
export const MATERIAL_EVIDENCE_TYPES = ["MATERIAL_DATASHEET", "MANUFACTURER_SPECIFICATION", "TEST_REPORT", "PUBLISHED_RESEARCH", "STANDARDS_DOCUMENTATION", "USER_MEASUREMENT"] as const;
export type MaterialEvidenceType = (typeof MATERIAL_EVIDENCE_TYPES)[number];
export const MATERIAL_PROPERTY_STATES = ["VERIFIED_SOURCE", "USER_PROVIDED", "EXPERIMENTALLY_MEASURED", "CALCULATED", "ASSUMED", "UNKNOWN"] as const;
export type MaterialPropertyState = (typeof MATERIAL_PROPERTY_STATES)[number];
export const CAE_READINESS_STATES = ["NOT_READY", "MISSING_REQUIREMENTS", "MISSING_MATERIAL", "MISSING_LOADS", "MISSING_BOUNDARIES", "MISSING_MESH", "READY_FOR_REVIEW", "READY_FOR_SOLVER", "READY_FOR_EXPERIMENT", "VALIDATED"] as const;
export type CAEReadinessState = (typeof CAE_READINESS_STATES)[number];

export interface SolverAdapterContract {
  contractVersion: typeof SOLVER_ADAPTER_CONTRACT_VERSION;
  solverId: string;
  solverVersion: string;
  displayName: string;
  status: SolverAdapterStatus;
  supportedAnalysisTypes: CAEAnalysisType[];
  supportedElementTypes: Array<NonNullable<CAEMeshStrategy["elementType"]>>;
  supportedMaterialModels: string[];
  supportedContacts: CAEContact["type"][];
  supportedLoads: CAELoad["type"][];
  supportedMeshTypes: string[];
  executionEnvironment: "CLOUD_UNCONFIGURED" | "LOCAL_ADAPTER" | "REMOTE_ADAPTER";
  capabilities: string[];
  reason: string;
  executable: boolean;
}

export interface SolverCapabilityNegotiation {
  planId: string;
  adapter: SolverAdapterContract;
  status: "COMPATIBLE" | "INCOMPATIBLE" | "UNAVAILABLE";
  supported: string[];
  unsupported: string[];
  blockingReasons: string[];
}

export interface MaterialEvidenceStorage {
  key: string;
  url: string;
}

export interface MaterialEvidence {
  evidenceId: string;
  projectId: string;
  version: number;
  parentEvidenceId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  type: MaterialEvidenceType;
  source: string;
  sourceDate?: string;
  material: string;
  materialGrade?: string;
  property: CAEMaterialProperty["name"];
  value?: number;
  unit?: string;
  condition?: string;
  measurementUncertainty?: string;
  temperature?: string;
  strainRate?: string;
  direction?: string;
  batch?: string;
  measurementDate?: string;
  provenance: MaterialPropertyState;
  verificationStatus: "VERIFIED" | "UNVALIDATED" | "CONFLICT" | "UNKNOWN";
  storage: MaterialEvidenceStorage;
  createdAt: string;
}

export interface MaterialPropertyConflict {
  conflictId: string;
  material: string;
  property: CAEMaterialProperty["name"];
  evidenceIds: string[];
  values: Array<{ evidenceId: string; value?: number; unit?: string; condition?: string; provenance: MaterialPropertyState }>;
  status: "CONFLICT" | "NOT_COMPARABLE";
  reason: string;
  requiresResolution: true;
}

export interface ExperimentalValidationPlan {
  experimentId: string;
  projectId: string;
  simulationId: string;
  sourceCadRevision: string;
  objective: string;
  hypothesis: string;
  testArticle: string;
  instrumentation: string[];
  loads: string[];
  boundaryConditions: string[];
  measurements: string[];
  samplingRate?: string;
  environment?: string;
  acceptanceCriteria: string[];
  uncertainties: string[];
  repeatability: string;
  safetyRequirements: string[];
  simulationComparison: string;
  status: "DRAFT" | "READY_FOR_REVIEW" | "NOT_READY" | "VALIDATED";
  createdAt: string;
}

export interface CAEUncertaintyItem {
  id: string;
  category: "MATERIAL" | "GEOMETRY" | "LOAD" | "BOUNDARY" | "MEASUREMENT" | "MESH" | "SOLVER" | "EXPERIMENTAL_DATA";
  statement: string;
  magnitude?: string;
  source: "EVIDENCE" | "ASSUMPTION" | "UNKNOWN" | "NOT_EXECUTED";
  blocking: boolean;
  evidenceIds: string[];
}

export interface CAEUncertaintyProfile {
  simulationId: string;
  items: CAEUncertaintyItem[];
  summary: string;
}

export interface CAEReadinessEvidence {
  id: string;
  category: "REQUIREMENTS" | "CAD" | "MATERIAL" | "LOADS" | "BOUNDARIES" | "MESH" | "SOLVER" | "EXPERIMENT" | "VALIDATION";
  status: "PASS" | "FAIL" | "UNKNOWN";
  statement: string;
  evidenceIds: string[];
  blocking: boolean;
}

export interface CAEReadinessAssessment {
  simulationId: string;
  state: CAEReadinessState;
  evidence: CAEReadinessEvidence[];
  reason: string;
}

export interface CAEContextInvalidation {
  invalidationId: string;
  simulationId: string;
  previousCadRevision: string;
  observedCadRevision: string;
  affectedAssumptions: string[];
  status: "CURRENT" | "STALE";
  reason: string;
  createdAt: string;
}

export interface CAEEvidenceGraphNode {
  id: string;
  type: "REQUIREMENT" | "ASSUMPTION" | "CAD_REVISION" | "CAE_SIMULATION" | "SOLVER_ADAPTER" | "ADAPTER_REGISTRATION" | "MATERIAL_EVIDENCE" | "EXPERIMENT" | "MEASUREMENT" | "MEASURED_DATASET" | "DATASET_PROCESSING" | "CALIBRATION" | "COMPARISON" | "ENGINEERING_DECISION" | "VALIDATION" | "RESULT";
  label: string;
  truthStatus: CAETruthStatus | "VERIFIED" | "ASSUMED" | "UNKNOWN" | "UNVALIDATED";
}

export interface CAEEvidenceGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relationship: string;
  status: "DECLARED" | "PROVEN" | "UNKNOWN";
}

export interface CAEEvidenceGraph {
  projectId: string;
  simulationId: string;
  nodes: CAEEvidenceGraphNode[];
  edges: CAEEvidenceGraphEdge[];
  limitations: string[];
}

export const MATERIAL_RECONCILIATION_STATES = ["UNREVIEWED", "CONSISTENT", "CONFLICT", "RESOLVED", "REJECTED", "UNKNOWN"] as const;
export type MaterialReconciliationState = (typeof MATERIAL_RECONCILIATION_STATES)[number];
export const MATERIAL_RECONCILIATION_CONFLICTS = ["UNIT_CONFLICT", "VALUE_CONFLICT", "CONDITION_CONFLICT", "MATERIAL_GRADE_CONFLICT", "SOURCE_CONFLICT", "MEASUREMENT_UNCERTAINTY_CONFLICT"] as const;
export type MaterialReconciliationConflictKind = (typeof MATERIAL_RECONCILIATION_CONFLICTS)[number];
export const EVIDENCE_TRUTH_CATEGORIES = ["MEASURED", "SIMULATED", "CALCULATED", "DERIVED", "ASSUMED", "UNKNOWN"] as const;
export type EvidenceTruthCategory = (typeof EVIDENCE_TRUTH_CATEGORIES)[number];

export interface MaterialReconciliationCandidate {
  evidenceId: string;
  property: MaterialEvidence["property"];
  value?: number;
  unit?: string;
  normalizedValue?: number;
  normalizedUnit?: string;
  condition?: string;
  source: string;
  sourceHash: string;
  provenance: MaterialPropertyState;
  verificationStatus: MaterialEvidence["verificationStatus"];
  measurementUncertainty?: string;
  temperature?: string;
  strainRate?: string;
  direction?: string;
  batch?: string;
  date?: string;
}

export interface MaterialPropertyReconciliation {
  reconciliationId: string;
  projectId: string;
  material: string;
  property: MaterialEvidence["property"];
  candidates: MaterialReconciliationCandidate[];
  conflicts: Array<{ kind: MaterialReconciliationConflictKind; statement: string; evidenceIds: string[] }>;
  state: MaterialReconciliationState;
  decisionId?: string;
  selectedValue?: number;
  selectedUnit?: string;
  revision: number;
  createdAt: string;
}

export interface EngineeringReviewDecision {
  decisionId: string;
  projectId: string;
  reconciliationId: string;
  reviewer: string;
  reviewerRole?: string;
  decision: "RESOLVE" | "REJECT" | "REQUEST_EVIDENCE";
  selectedValue?: number;
  selectedUnit?: string;
  reason: string;
  evidenceIds: string[];
  timestamp: string;
  revision: number;
  authorType: "HUMAN";
}

export const MEASUREMENT_DATA_QUALITY_STATUSES = ["COMPLETE", "INCOMPLETE", "INCONSISTENT", "UNVERIFIED", "INVALID"] as const;
export type MeasurementDataQualityStatus = (typeof MEASUREMENT_DATA_QUALITY_STATUSES)[number];
export const DATASET_PROCESSING_STAGES = ["RAW", "NORMALIZED", "FILTERED", "DERIVED"] as const;
export type DatasetProcessingStage = (typeof DATASET_PROCESSING_STAGES)[number];

export interface MeasurementDatasetMetadata {
  source: string;
  instrument?: string;
  instrumentId?: string;
  operator?: string;
  testDate?: string;
  units?: string;
  samplingRate?: string;
  environment?: string;
  temperature?: string;
  humidity?: string;
  testArticle?: string;
  testRevision?: string;
  calibrationStatus: "CALIBRATED" | "UNCALIBRATED" | "UNKNOWN";
  uncertainty?: string;
  provenance: EvidenceTruthCategory;
}

export interface MeasurementDataQualityAssessment {
  status: MeasurementDataQualityStatus;
  rowCount?: number;
  columnNames: string[];
  missingValues: number;
  duplicateSamples: number;
  timestampsPresent: boolean;
  samplingConsistency: "CONSISTENT" | "INCONSISTENT" | "UNKNOWN";
  unitsPresent: boolean;
  rangeAnomalies: string[];
  findings: string[];
}

export interface MeasurementDataset {
  datasetId: string;
  projectId: string;
  experimentId?: string;
  simulationId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  storage: MaterialEvidenceStorage;
  metadata: MeasurementDatasetMetadata;
  quality: MeasurementDataQualityAssessment;
  stage: "RAW";
  truthCategory: "MEASURED" | "UNKNOWN";
  createdAt: string;
}

export interface DatasetProcessingRecord {
  recordId: string;
  projectId: string;
  datasetId: string;
  parentRecordId?: string;
  stage: DatasetProcessingStage;
  transformation: string;
  sourceHash: string;
  outputHash?: string;
  evidenceIds: string[];
  truthCategory: "DERIVED" | "UNKNOWN";
  createdAt: string;
}

export interface CalibrationRecord {
  calibrationId: string;
  projectId: string;
  datasetId?: string;
  instrument: string;
  calibrationDate?: string;
  calibrationSource?: string;
  certificateReference?: string;
  validFrom?: string;
  validUntil?: string;
  uncertainty?: string;
  status: "CALIBRATED" | "EXPIRED" | "UNCALIBRATED" | "UNKNOWN";
  evidenceIds: string[];
  truthCategory: "MEASURED" | "DERIVED" | "UNKNOWN";
  createdAt: string;
}

export interface SimulationMeasurementComparison {
  comparisonId: string;
  projectId: string;
  simulationId: string;
  simulationRevision: string;
  datasetId: string;
  quantity: string;
  location?: string;
  timeWindow?: string;
  simulationValue?: number;
  measurementValue?: number;
  difference?: number;
  relativeDifference?: number;
  uncertainty?: string;
  comparisonMethod: string;
  status: "NO_SIMULATION_RESULT" | "MISSING_MEASUREMENT_VALUE" | "READY_FOR_REVIEW" | "CALIBRATION_CANDIDATE" | "INVALID";
  truthCategory: "DERIVED" | "UNKNOWN";
  createdAt: string;
}

export interface CalibrationCandidate {
  candidateId: string;
  projectId: string;
  comparisonId: string;
  status: "CALIBRATION_CANDIDATE";
  statement: string;
  requiresHumanReview: true;
  prohibitsAutomaticParameterChange: true;
  createdAt: string;
}

export interface ExternalSolverAdapterRegistration {
  registrationId: string;
  projectId: string;
  solverId: string;
  solverName: string;
  version: string;
  provider: string;
  adapterVersion: string;
  supportedAnalysisTypes: CAEAnalysisType[];
  capabilities: string[];
  executionMode: "LOCAL_ADAPTER" | "REMOTE_ADAPTER" | "CLOUD_UNCONFIGURED";
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  securityRequirements: string[];
  adapterManifest: string;
  adapterHash: string;
  publisherIdentity: string;
  signature?: string;
  capabilityManifest: string[];
  verificationStatus: "UNVERIFIED" | "REJECTED" | "VERIFIED_NON_EXECUTABLE";
  executable: false;
  revocable: true;
  createdAt: string;
}
