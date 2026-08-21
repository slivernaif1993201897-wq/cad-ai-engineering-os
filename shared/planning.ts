import type { EngineeringTruthStatus } from "./engineeringTruth";

export type DrawingViewKind = "ORTHOGRAPHIC" | "SECTION" | "DETAIL" | "ISOMETRIC" | "AUXILIARY";
export type DrawingPackageState = "DECLARED" | "REVIEW_REQUIRED" | "CAD_REFERENCE_UNRESOLVED" | "REJECTED" | "UNKNOWN";
export type BOMRevisionState = "DECLARED" | "REVIEW_REQUIRED" | "REJECTED" | "UNKNOWN";
export type PLMLifecycleState = "DESIGN" | "REVIEW" | "RELEASE_CANDIDATE" | "SUPERSEDED" | "BLOCKED";
export type ManufacturingProcessKind = "MILLING" | "TURNING" | "DRILLING" | "SHEET_METAL" | "ADDITIVE" | "ASSEMBLY" | "MIXED" | "UNKNOWN";
export type ManufacturingPlanState = "DECLARED" | "REVIEW_REQUIRED" | "REJECTED" | "UNKNOWN";

export interface DrawingPackage {
  drawingPackageId: string;
  projectId: string;
  digitalThreadArtifactId: string;
  title: string;
  revision: string;
  sourceCadArtifactIds: string[];
  sourceCadRevision: string;
  sourceCadHash?: string;
  views: Array<{ viewId: string; kind: DrawingViewKind; label: string; sourceGeometryReference?: string; declaredOnly: true }>;
  dimensions: Array<{ dimensionId: string; label: string; value?: number; unit?: string; sourceReference?: string; truthStatus: EngineeringTruthStatus }>;
  annotations: Array<{ annotationId: string; text: string; category: "GENERAL" | "TOLERANCE" | "GD_T_REPRESENTATION" | "DATUM_REPRESENTATION" | "NOTE"; truthStatus: EngineeringTruthStatus }>;
  titleBlock: { partNumber?: string; drawingNumber?: string; preparedBy: string; status: "DRAFT" | "REVIEW_REQUIRED" };
  state: DrawingPackageState;
  validation: { cadReferenceResolved: boolean; dimensionsSourceBound: boolean; rendererAvailable: false; standardsComplianceClaimed: false; status: "PASS" | "FAIL" | "UNKNOWN" };
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface BOMRevision {
  bomRevisionId: string;
  projectId: string;
  digitalThreadArtifactId: string;
  title: string;
  revision: string;
  sourceArtifactIds: string[];
  items: Array<{ lineId: string; partNumber: string; title: string; quantity: number; sourceArtifactId: string; materialReference?: string; supplier?: string; supplierSource?: "USER_PROVIDED" | "UNKNOWN"; truthStatus: EngineeringTruthStatus }>;
  state: BOMRevisionState;
  validation: { sourceArtifactsResolved: boolean; quantitiesDeclared: boolean; autoStructureInference: false; status: "PASS" | "FAIL" | "UNKNOWN" };
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface PLMRevision {
  plmRevisionId: string;
  projectId: string;
  digitalThreadArtifactId: string;
  partNumber: string;
  revision: string;
  parentPLMRevisionId?: string;
  sourceArtifactIds: string[];
  lifecycleState: PLMLifecycleState;
  engineeringChangeReason: string;
  comparisonSummary: string;
  approvalState: "NOT_APPROVED" | "REVIEW_REQUIRED";
  releaseState: "NOT_RELEASED";
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface ManufacturingPlan {
  manufacturingPlanId: string;
  projectId: string;
  digitalThreadArtifactId: string;
  title: string;
  revision: string;
  sourceArtifactIds: string[];
  processIntent: ManufacturingProcessKind[];
  materialProcessCompatibility: Array<{ materialReference: string; process: ManufacturingProcessKind; status: "DECLARED" | "UNKNOWN" | "CONFLICT"; rationale: string }>;
  dfmFindings: Array<{ findingId: string; category: "DFM" | "DFA" | "SETUP" | "TOOLING" | "INSPECTION" | "MATERIAL"; finding: string; truthStatus: EngineeringTruthStatus; requiredEvidence: string[] }>;
  setupPlanning: Array<{ setupId: string; description: string; status: "DECLARED" | "UNKNOWN" }>;
  toolSelectionMetadata: Array<{ toolId: string; description: string; source: "USER_PROVIDED" | "DECLARED" | "UNKNOWN"; capabilityVerified: false }>;
  inspectionPlanning: Array<{ inspectionId: string; characteristic: string; method?: string; status: "DECLARED" | "UNKNOWN" }>;
  state: ManufacturingPlanState;
  validation: { sourceArtifactsResolved: boolean; toolpathPlanningAvailable: false; postProcessorAvailable: false; machineOutputGenerated: false; certificationClaimed: false; status: "PASS" | "FAIL" | "UNKNOWN" };
  provenance: string[];
  limitations: string[];
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}
