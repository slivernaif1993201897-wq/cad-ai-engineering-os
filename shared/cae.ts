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
  type: "REQUIREMENT" | "ASSUMPTION" | "CAD_REVISION" | "CAE_SIMULATION" | "SOLVER_ADAPTER" | "ADAPTER_REGISTRATION" | "PUBLISHER" | "EXTERNAL_IDENTITY" | "ADAPTER_SIGNATURE" | "ADAPTER_TRUST_VERIFICATION" | "EXECUTION_TRUST_GATE" | "EXECUTION_ELIGIBILITY" | "REVIEWER" | "MATERIAL_EVIDENCE" | "EXPERIMENT" | "MEASUREMENT" | "MEASURED_DATASET" | "DATASET_PROCESSING" | "CALIBRATION" | "CALIBRATION_CERTIFICATE" | "CERTIFICATE_VERIFICATION" | "REVOCATION_SOURCE" | "SANDBOX_ATTESTATION" | "RUNTIME_ARCHITECTURE" | "RUNTIME_BOUNDARY" | "RUNTIME_THREAT" | "RUNTIME_PERMISSION" | "RUNTIME_LIMIT" | "RUNTIME_RESULT_CONTRACT" | "RUNTIME_APPROVAL_GATE" | "RUNTIME_TEST_PLAN" | "RUNTIME_DECISION" | "CAPACITY_POLICY" | "CAPACITY_VALIDATION" | "SANDBOX_DESIGN" | "INDEPENDENT_ATTESTATION" | "ATTACK_SIMULATION" | "SECURITY_INVARIANT" | "RUNTIME_ASSURANCE" | "RUNTIME_READINESS" | "COMPARISON" | "ENGINEERING_DECISION" | "REVOCATION" | "SECURITY_AUDIT" | "VALIDATION" | "RESULT";
  label: string;
  truthStatus: CAETruthStatus | "DERIVED" | "VERIFIED" | "ASSUMED" | "UNKNOWN" | "UNVALIDATED";
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

export const REVIEWER_IDENTITY_STATES = ["UNVERIFIED", "VERIFIED", "SUSPENDED", "REVOKED"] as const;
export type ReviewerIdentityState = (typeof REVIEWER_IDENTITY_STATES)[number];
export const REVIEWER_PERMISSIONS = ["APPROVE_MATERIAL", "APPROVE_CALIBRATION", "APPROVE_SOLVER_ADAPTER", "APPROVE_VALIDATION"] as const;
export type ReviewerPermission = (typeof REVIEWER_PERMISSIONS)[number];
export interface VerifiedReviewerIdentity {
  reviewerId: string;
  projectId: string;
  displayName: string;
  identityStatus: ReviewerIdentityState;
  role: string;
  projectScope: string[];
  verificationMethod?: string;
  verificationTimestamp?: string;
  permissions: ReviewerPermission[];
  status: ReviewerIdentityState;
  createdAt: string;
}

export const CERTIFICATE_STATES = ["UNVERIFIED", "VALID", "EXPIRED", "REVOKED", "CONFLICT", "UNKNOWN"] as const;
export type CalibrationCertificateState = (typeof CERTIFICATE_STATES)[number];
export interface CalibrationCertificate {
  certificateId: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  storage: MaterialEvidenceStorage;
  issuer?: string;
  certificateNumber?: string;
  instrument: string;
  calibrationDate?: string;
  expirationDate?: string;
  scope?: string;
  uncertainty?: string;
  status: CalibrationCertificateState;
  createdAt: string;
}
export interface CalibrationEvidenceVerification {
  verificationId: string;
  projectId: string;
  certificateId: string;
  filePresent: "PASS" | "FAIL" | "UNKNOWN";
  metadataValid: "PASS" | "FAIL" | "UNKNOWN";
  sourceVerified: "PASS" | "FAIL" | "UNKNOWN";
  dateValid: "PASS" | "FAIL" | "UNKNOWN";
  scopeMatch: "PASS" | "FAIL" | "UNKNOWN";
  signatureVerified: "PASS" | "FAIL" | "UNKNOWN";
  status: CalibrationCertificateState;
  findings: string[];
  createdAt: string;
}

export const ADAPTER_TRUST_STATES = ["UNTRUSTED", "REGISTERED", "VERIFIED", "APPROVED", "EXECUTION_ELIGIBLE", "REVOKED", "INVALID"] as const;
export type AdapterTrustState = (typeof ADAPTER_TRUST_STATES)[number];
export const ADAPTER_PERMISSIONS = ["READ_CAD", "READ_REQUIREMENTS", "READ_MATERIAL_EVIDENCE", "READ_CAE_PLAN", "WRITE_RESULTS", "WRITE_LOGS", "NETWORK_ACCESS", "FILESYSTEM_ACCESS"] as const;
export type AdapterPermission = (typeof ADAPTER_PERMISSIONS)[number];
export interface SandboxContract {
  sandboxType: "DECLARATION_ONLY" | "CONTAINER" | "VM" | "UNKNOWN";
  resourceLimits: string[];
  filesystemScope: string[];
  networkPolicy: "NO_NETWORK" | "DECLARATION_ONLY";
  timeoutSeconds?: number;
  memoryLimitMiB?: number;
  cpuLimit?: number;
  allowedInputs: string[];
  allowedOutputs: string[];
  prohibitsShellExecution: true;
  prohibitsArbitraryFilesystem: true;
}
export interface AdapterCapabilityVerification {
  capability: string;
  declared: boolean;
  verified: boolean;
  status: "VERIFIED" | "CAPABILITY_CONFLICT" | "UNKNOWN";
}
export interface AdapterTrustVerification {
  verificationId: string;
  projectId: string;
  registrationId: string;
  reviewerId?: string;
  trustState: AdapterTrustState;
  identityCheck: "PASS" | "FAIL" | "UNKNOWN";
  manifestValidation: "PASS" | "FAIL" | "UNKNOWN";
  signatureCheck: "PASS" | "FAIL" | "UNKNOWN";
  capabilityCheck: "PASS" | "FAIL" | "UNKNOWN";
  securityReview: "PASS" | "FAIL" | "UNKNOWN";
  permissionCheck: "PASS" | "FAIL" | "UNKNOWN";
  capabilities: AdapterCapabilityVerification[];
  grantedPermissions: AdapterPermission[];
  sandbox: SandboxContract;
  executionEligible: boolean;
  executable: false;
  reason: string;
  createdAt: string;
}
export interface RevocationRecord {
  revocationId: string;
  projectId: string;
  objectType: "REVIEWER" | "ADAPTER" | "CERTIFICATE" | "EXTERNAL_IDENTITY" | "REVOCATION_SOURCE" | "SANDBOX_ATTESTATION";
  objectId: string;
  previousState: string;
  newState: "REVOKED";
  reason: string;
  actor: string;
  timestamp: string;
}
export interface SecurityAuditEvent {
  eventId: string;
  projectId: string;
  actor: string;
  action: "REGISTRATION" | "VERIFICATION" | "APPROVAL" | "REJECTION" | "REVOCATION" | "CERTIFICATE_VALIDATION" | "IDENTITY_CHANGE" | "PERMISSION_CHANGE" | "REVOCATION_SOURCE_INGESTION" | "SANDBOX_ATTESTATION" | "TRUST_READINESS" | "RUNTIME_ARCHITECTURE_REVIEW" | "RUNTIME_READINESS_REVIEW" | "CAPACITY_POLICY_VALIDATION" | "INDEPENDENT_ATTESTATION_EVIDENCE";
  objectType: "REVIEWER" | "ADAPTER" | "CERTIFICATE" | "DECISION" | "VERIFICATION" | "EXTERNAL_IDENTITY" | "REVOCATION_SOURCE" | "SANDBOX_ATTESTATION" | "TRUST_READINESS" | "RUNTIME_ARCHITECTURE" | "RUNTIME_READINESS" | "CAPACITY_POLICY" | "INDEPENDENT_ATTESTATION";
  objectId: string;
  timestamp: string;
  previousState?: string;
  newState: string;
  reason: string;
}
export interface AuthorizedEngineeringApproval {
  approvalId: string;
  projectId: string;
  reviewerId: string;
  targetType: "MATERIAL_RECONCILIATION" | "CALIBRATION" | "ADAPTER" | "VALIDATION";
  targetId: string;
  decision: "APPROVE" | "REJECT" | "REQUEST_EVIDENCE";
  evidenceIds: string[];
  revision: number;
  reason: string;
  timestamp: string;
}
export const EXTERNAL_IDENTITY_STATES = ["IDENTITY_CLAIMED", "IDENTITY_VERIFIED", "IDENTITY_REVOKED", "IDENTITY_UNKNOWN"] as const;
export type ExternalIdentityState = (typeof EXTERNAL_IDENTITY_STATES)[number];
export interface ExternalIdentityProviderClaim {
  claimId: string;
  projectId: string;
  provider: string;
  providerVersion: string;
  subject: string;
  verificationMethod: string;
  evidence: string[];
  timestamp: string;
  status: ExternalIdentityState;
  actor: string;
}
export const REVOCATION_SOURCE_STATES = ["NOT_CHECKED", "VALID", "REVOKED", "EXPIRED", "UNKNOWN"] as const;
export type RevocationSourceState = (typeof REVOCATION_SOURCE_STATES)[number];
export interface CertificateRevocationSourceEvidence {
  sourceEvidenceId: string;
  projectId: string;
  source: string;
  sourceIdentity: string;
  sourceHash: string;
  storage?: MaterialEvidenceStorage;
  retrievalTime: string;
  effectiveTime?: string;
  certificateIdentifier: string;
  revocationStatus: RevocationSourceState;
  independentSourceCount: number;
  evidence: string[];
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "INVALID" | "UNKNOWN";
  actor: string;
  createdAt: string;
}
export const SANDBOX_ATTESTATION_STATES = ["UNATTESTED", "ATTESTED", "INVALID", "EXPIRED", "REVOKED", "UNKNOWN"] as const;
export type SandboxAttestationState = (typeof SANDBOX_ATTESTATION_STATES)[number];
export interface SandboxAttestationContract {
  attestationId: string;
  projectId: string;
  registrationId: string;
  version: string;
  environmentIdentity: string;
  runtimeIdentity: string;
  runtimeVersion: string;
  operatingSystem: string;
  resourceLimits: string[];
  filesystemBoundary: string[];
  networkPolicy: "NO_NETWORK" | "DECLARATION_ONLY" | "UNKNOWN";
  processPolicy: string;
  isolationMechanism: string;
  attestationEvidence: string[];
  attestationTimestamp: string;
  expiresAt?: string;
  verificationStatus: SandboxAttestationState;
  actor: string;
  createdAt: string;
}
export interface SandboxAttestationVerification {
  verificationId: string;
  projectId: string;
  attestationId: string;
  reviewerId: string;
  identityCheck: "PASS" | "FAIL" | "UNKNOWN";
  integrityCheck: "PASS" | "FAIL" | "UNKNOWN";
  configurationCheck: "PASS" | "FAIL" | "UNKNOWN";
  permissionCheck: "PASS" | "FAIL" | "UNKNOWN";
  resourceBoundaryCheck: "PASS" | "FAIL" | "UNKNOWN";
  networkRestrictionCheck: "PASS" | "FAIL" | "UNKNOWN";
  filesystemRestrictionCheck: "PASS" | "FAIL" | "UNKNOWN";
  status: SandboxAttestationState;
  reason: string;
  createdAt: string;
}
export const EXECUTION_TRUST_GATES = ["IDENTITY", "ADAPTER_SIGNATURE", "CAPABILITY", "PERMISSIONS", "CERTIFICATE", "REVIEWER_APPROVAL", "SANDBOX_ATTESTATION", "REVOCATION_CHECK", "EXECUTION_ELIGIBILITY"] as const;
export type ExecutionTrustGate = (typeof EXECUTION_TRUST_GATES)[number];
export interface ExecutionTrustGateEvidence {
  gate: ExecutionTrustGate;
  status: "PASS" | "FAIL" | "UNKNOWN";
  statement: string;
  evidenceIds: string[];
  mandatory: true;
}
export interface ExecutionTrustReadiness {
  readinessId: string;
  projectId: string;
  registrationId: string;
  gates: ExecutionTrustGateEvidence[];
  gatesSatisfied: boolean;
  executionEligible: false;
  executable: false;
  reason: string;
  createdAt: string;
}
export interface ExecutionTrustBenchmarkResult {
  benchmarkId: string;
  projectId: string;
  scenario: string;
  expectedEligibility: false;
  observedEligibility: false;
  passed: boolean;
  reason: string;
  createdAt: string;
}
export const FUTURE_RUNTIME_CONTRACT_VERSION = "1.0.0" as const;
export const FUTURE_RUNTIME_COMPONENTS = ["CAD_AI", "CAE_AGENT", "SOLVER_ADAPTER", "EXECUTION_MANAGER", "SANDBOX", "SOLVER", "RESULT_COLLECTOR", "RESULT_VERIFICATION", "EVIDENCE_GRAPH"] as const;
export type FutureRuntimeComponent = (typeof FUTURE_RUNTIME_COMPONENTS)[number];
export interface FutureRuntimeBoundary {
  boundaryId: string;
  from: FutureRuntimeComponent;
  to: FutureRuntimeComponent;
  permittedData: string[];
  prohibitedOperations: string[];
  requiredEvidence: string[];
  trustRequirement: string;
}
export const FUTURE_RUNTIME_THREATS = ["MALICIOUS_ADAPTER", "TAMPERED_SOLVER", "MALICIOUS_INPUT", "MALICIOUS_OUTPUT", "RESOURCE_EXHAUSTION", "FILESYSTEM_ESCAPE", "NETWORK_ESCAPE", "PRIVILEGE_ESCALATION", "CREDENTIAL_EXPOSURE", "DATA_EXFILTRATION", "RESULT_MANIPULATION", "REPLAY", "VERSION_MISMATCH"] as const;
export type FutureRuntimeThreatKind = (typeof FUTURE_RUNTIME_THREATS)[number];
export interface FutureRuntimeThreat {
  threat: FutureRuntimeThreatKind;
  entryPoint: string;
  impact: string;
  requiredMitigations: string[];
  residualRisk: "UNKNOWN" | "REQUIRES_TEST" | "NOT_ACCEPTED";
}
export const FUTURE_RUNTIME_PERMISSIONS = ["READ_CAD_INPUT", "READ_CAE_INPUT", "READ_MATERIAL_EVIDENCE", "WRITE_TEMPORARY_FILES", "WRITE_RESULT_FILES", "WRITE_LOGS", "NETWORK", "CPU", "MEMORY", "STORAGE", "RUNTIME", "PROCESS"] as const;
export type FutureRuntimePermission = (typeof FUTURE_RUNTIME_PERMISSIONS)[number];
export interface FutureRuntimePermissionPolicy {
  permission: FutureRuntimePermission;
  defaultDecision: "DENY";
  futureGrantRequirement: string;
  scope: string;
  evidenceRequired: string[];
}
export interface FutureRuntimeResourceLimit {
  resource: "CPU" | "RAM" | "DISK" | "RUNTIME" | "PROCESS_COUNT" | "FILE_COUNT" | "INPUT_SIZE" | "OUTPUT_SIZE";
  enforcementPoint: "EXECUTION_MANAGER" | "SANDBOX" | "KERNEL" | "STORAGE_GATEWAY";
  proposedLimit?: number;
  unit: string;
  status: "REQUIRES_CAPACITY_APPROVAL" | "NOT_CONFIGURED";
  bypassPrevention: string;
}
export interface FutureSolverInputOutputContract {
  contractVersion: typeof FUTURE_RUNTIME_CONTRACT_VERSION;
  inputSchema: string[];
  configurationSchema: string[];
  outputSchema: string[];
  metadataSchema: string[];
  logSchema: string[];
  errorSchema: string[];
  provenanceSchema: string[];
  parserTrustRule: "PARSED_OUTPUT_IS_UNVERIFIED";
}
export interface FutureResultProvenance {
  solverIdentity: string;
  solverVersion: string;
  adapterIdentity: string;
  adapterVersion: string;
  inputHash: string;
  cadRevisionHash: string;
  caePlanRevision: string;
  materialEvidenceReferences: string[];
  runtimeIdentity: string;
  executionTimestamp: string;
  resultHash: string;
}
export interface FutureResultVerificationPolicy {
  requiredChecks: Array<"SCHEMA_VALIDITY" | "HASH_INTEGRITY" | "EXPECTED_QUANTITIES" | "UNITS" | "RANGES" | "MISSING_VALUES" | "SOLVER_STATUS" | "CONVERGENCE_EVIDENCE" | "WARNINGS" | "ERRORS">;
  resultStates: Array<"VERIFIED" | "UNVERIFIED" | "INVALID">;
  automaticVerificationProhibited: true;
}
export interface FutureRuntimeFailurePolicy {
  failure: "TIMEOUT" | "CRASH" | "MEMORY_EXHAUSTION" | "INVALID_RESULT" | "PARTIAL_RESULT" | "SOLVER_WARNING" | "SOLVER_DIVERGENCE" | "SANDBOX_VIOLATION" | "ADAPTER_FAILURE";
  response: string;
  historicalRecord: "IMMUTABLE";
  resultState: "INVALID" | "UNVERIFIED";
}
export interface FutureReproducibilityManifest {
  requiredReferences: Array<"CAD_REVISION" | "CAE_REVISION" | "MATERIAL_EVIDENCE" | "SOLVER_VERSION" | "ADAPTER_VERSION" | "CONFIGURATION" | "INPUT_HASH" | "RUNTIME_VERSION">;
  reproductionRequiresHumanReview: true;
  missingReferenceBehavior: "REFUSE_REPRODUCTION";
}
export interface FutureRuntimeHumanGate {
  operation: "SOLVER_REGISTRATION" | "ADAPTER_APPROVAL" | "EXECUTION_AUTHORIZATION" | "RESULT_ACCEPTANCE" | "VALIDATION_DECISION";
  actor: "VERIFIED_HUMAN";
  aiMayRecommend: true;
  aiMayApprove: false;
  requiredEvidence: string[];
}
export interface FutureRuntimeSecurityTest {
  test: "SANDBOX_ESCAPE" | "PERMISSION_ESCALATION" | "RESOURCE_EXHAUSTION" | "TAMPERED_INPUT" | "TAMPERED_OUTPUT" | "ADAPTER_REVOCATION" | "SOLVER_REVOCATION" | "RESULT_PROVENANCE" | "REPRODUCIBILITY" | "FAIL_CLOSED";
  requiredBeforeExecution: true;
  passCriteria: string;
}
export interface FutureRuntimeArchitectureReview {
  reviewId: string;
  projectId: string;
  contractVersion: typeof FUTURE_RUNTIME_CONTRACT_VERSION;
  architecture: FutureRuntimeComponent[];
  boundaries: FutureRuntimeBoundary[];
  threats: FutureRuntimeThreat[];
  permissions: FutureRuntimePermissionPolicy[];
  resourceLimits: FutureRuntimeResourceLimit[];
  sandboxRequirements: string[];
  ioContract: FutureSolverInputOutputContract;
  resultTrustRequirements: Array<keyof FutureResultProvenance>;
  verification: FutureResultVerificationPolicy;
  failures: FutureRuntimeFailurePolicy[];
  reproducibility: FutureReproducibilityManifest;
  humanGates: FutureRuntimeHumanGate[];
  securityTests: FutureRuntimeSecurityTest[];
  readinessDecision: "RUNTIME_NOT_APPROVED";
  decisionReason: string;
  executionEligible: false;
  executable: false;
  createdAt: string;
}
export const RUNTIME_READINESS_CONTRACT_VERSION = "1.0.0" as const;
export const CAPACITY_LIMIT_KINDS = ["CPU_LIMIT", "MEMORY_LIMIT", "DISK_LIMIT", "EXECUTION_TIMEOUT", "INPUT_SIZE_LIMIT", "OUTPUT_SIZE_LIMIT", "PROCESS_LIMIT", "CONCURRENT_JOB_LIMIT"] as const;
export type CapacityLimitKind = (typeof CAPACITY_LIMIT_KINDS)[number];
export interface CapacityPolicyValue {
  kind: CapacityLimitKind;
  value: number | "UNKNOWN";
  unit: string;
  rationale: string;
  environment: string;
  version: string;
  effectiveDate: string;
  evidenceIds: string[];
}
export interface CapacityPolicy {
  policyId: string;
  projectId: string;
  contractVersion: typeof RUNTIME_READINESS_CONTRACT_VERSION;
  limits: CapacityPolicyValue[];
  state: "UNKNOWN" | "DECLARED" | "VERIFIED";
  reason: string;
  createdAt: string;
}
export interface CapacityPolicyValidation {
  validationId: string;
  projectId: string;
  policyId: string;
  limit: CapacityLimitKind;
  observedValue: number | "UNKNOWN";
  observedUnit: string;
  outcome: "WITHIN_LIMIT" | "EXCEEDS_LIMIT" | "UNKNOWN_LIMIT";
  safe: false;
  reason: string;
  createdAt: string;
}
export type SandboxDesignStatus = "DESIGNED" | "IMPLEMENTED" | "VERIFIED" | "ATTESTED" | "UNKNOWN";
export interface SandboxDesignControl {
  control: "ISOLATION_MECHANISM" | "PROCESS_ISOLATION" | "FILESYSTEM_ISOLATION" | "NETWORK_ISOLATION" | "RESOURCE_ISOLATION" | "CREDENTIAL_ISOLATION" | "IPC_BOUNDARY" | "LOGGING_BOUNDARY" | "TERMINATION_MECHANISM";
  proposal: string;
  status: SandboxDesignStatus;
  requiredEvidence: string[];
}
export interface SandboxDesignProposal {
  designId: string;
  projectId: string;
  contractVersion: typeof RUNTIME_READINESS_CONTRACT_VERSION;
  environmentIdentity: string;
  controls: SandboxDesignControl[];
  statement: string;
  createdAt: string;
}
export const INDEPENDENT_ATTESTATION_STATES = ["NOT_ATTESTED", "ATTESTED", "EXPIRED", "REVOKED", "INVALID", "UNKNOWN"] as const;
export type IndependentAttestationState = (typeof INDEPENDENT_ATTESTATION_STATES)[number];
export interface IndependentSandboxAttestationEvidence {
  attestationEvidenceId: string;
  projectId: string;
  designId: string;
  attestorIdentity: string;
  attestorPublisherRelationship: "INDEPENDENT" | "SAME_PUBLISHER" | "UNKNOWN";
  attestationScope: string;
  environmentIdentity: string;
  evidenceHash: string;
  attestationTime: string;
  expiration?: string;
  verificationMethod: string;
  status: IndependentAttestationState;
  reason: string;
  createdAt: string;
}
export const HOSTILE_ATTACKS = ["FILESYSTEM_ESCAPE", "SANDBOX_ESCAPE", "NETWORK_ESCAPE", "PRIVILEGE_ESCALATION", "RESOURCE_EXHAUSTION", "FORK_PROCESS_EXPLOSION", "MALICIOUS_INPUT", "MALICIOUS_SOLVER_OUTPUT", "PATH_TRAVERSAL", "SYMLINK_ATTACK", "ENVIRONMENT_VARIABLE_LEAKAGE", "CREDENTIAL_LEAKAGE", "IPC_ABUSE", "ADAPTER_IMPERSONATION", "SIGNATURE_TAMPERING", "REPLAY_ATTACK", "RESULT_TAMPERING"] as const;
export type HostileAttack = (typeof HOSTILE_ATTACKS)[number];
export interface HostileAttackSimulation {
  simulationId: string;
  attack: HostileAttack;
  expectedBehavior: string;
  failureCondition: string;
  requiredEvidence: string[];
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  status: "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED" | "UNKNOWN";
}
export interface RuntimeSecurityInvariant {
  invariantId: string;
  statement: string;
  requiredEnforcement: string;
  status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_VERIFIED";
  evidenceIds: string[];
}
export interface RuntimeAssuranceDimension {
  dimension: "THREAT_COVERAGE" | "EVIDENCE_QUALITY" | "SANDBOX_ASSURANCE" | "RESOURCE_ASSURANCE" | "IDENTITY_ASSURANCE" | "AUDIT_ASSURANCE";
  status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_VERIFIED";
  statement: string;
  evidenceIds: string[];
}
export interface RuntimeReadinessReview {
  readinessId: string;
  projectId: string;
  contractVersion: typeof RUNTIME_READINESS_CONTRACT_VERSION;
  capacityPolicy: CapacityPolicy;
  sandboxDesign: SandboxDesignProposal;
  independentAttestations: IndependentSandboxAttestationEvidence[];
  hostileTests: HostileAttackSimulation[];
  securityInvariants: RuntimeSecurityInvariant[];
  assurance: RuntimeAssuranceDimension[];
  majorUnknowns: string[];
  readiness: "NOT_READY" | "PARTIALLY_READY" | "READY_FOR_EXTERNAL_REVIEW";
  executionApproval: "DISABLED";
  executionEligible: false;
  executable: false;
  reason: string;
  createdAt: string;
}
