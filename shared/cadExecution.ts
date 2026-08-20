import type { CADChangeProposal, GeometrySelectionContext } from "./cadWorkbench";

/** The only modifying operation currently backed by the verified parametric OpenCascade mounting-block route. */
export const CAD_EXECUTION_SUPPORTED_OPERATIONS = ["SET_MOUNTING_BLOCK_PARAMETER", "MEASURE_BOUNDING_BOX", "VALIDATE_GEOMETRY"] as const;
export type CADExecutionSupportedOperation = (typeof CAD_EXECUTION_SUPPORTED_OPERATIONS)[number];
export type CADOperationType = CADExecutionSupportedOperation | "UNSUPPORTED";
export type CADOperationState = "DRAFT" | "OPERATION_INVALID" | "QUEUED" | "PREVIEWING" | "PREVIEW_READY" | "EXECUTING" | "VALIDATING" | "OPERATION_EXECUTED" | "OPERATION_FAILED" | "REJECTED" | "REVERTED" | "REFERENCE_INVALIDATED";
export type CADOperationTruth = "FACT" | "CALCULATED" | "KERNEL_VALIDATED" | "INFERRED" | "ASSUMED" | "UNKNOWN";
export type CADParameterName = "width" | "depth" | "height" | "holeDiameter" | "holeEdgeOffset" | "filletRadius";

export const CAD_OPERATION_CATALOG = [
  { operationType: "SET_MOUNTING_BLOCK_PARAMETER", category: "MODIFICATION", supported: true, reason: "Regenerates the verified OpenCascade mounting-block feature sequence from a bounded named parameter." },
  { operationType: "MEASURE_BOUNDING_BOX", category: "INSPECTION", supported: true, reason: "Uses an existing kernel-derived viewer mesh bounding box; it does not create geometry." },
  { operationType: "VALIDATE_GEOMETRY", category: "INSPECTION", supported: true, reason: "Reports the existing OpenCascade artifact validation state; it does not create geometry." },
  { operationType: "CreateSketch / Extrude / Revolve / Sweep / Loft / Boolean / Fillet / Chamfer / Shell / Draft / Thickness / Move / Rotate / Scale / Pattern / Mirror", category: "UNAVAILABLE", supported: false, reason: "The current mounting-block architecture has no editable generic sketch, BRep-history, or topology-reference operation layer. These actions are not exposed as executable operations." },
] as const;

export interface CADOperationSourceModel {
  configurationId: string;
  configurationName: string;
  revision: number;
  modelStatus: "GENERATED" | "VALIDATED" | "CONCEPTUAL" | "INVALID" | "STALE";
  sourceFileId?: string;
  sourceFileVersion?: number;
}

export interface CADOperationParameter {
  name: CADParameterName;
  value: number;
  unit: "mm";
  priorValue?: number;
}

export interface CADOperationValidationRequirement {
  id: string;
  description: string;
  state: "PENDING" | "PASSED" | "FAILED" | "NOT_APPLICABLE";
}

export interface CADOperationIssue {
  code: "OPERATION_INVALID" | "REFERENCE_INVALIDATED" | "KERNEL_EXECUTION_FAILED" | "UNSUPPORTED_OPERATION" | "SOURCE_MODEL_INVALID";
  reason: string;
  invalidParameter?: string;
  affectedEntity?: string;
  recommendedCorrection: string;
}

export interface CADOperationPlan {
  operationId: string;
  operationType: CADOperationType;
  state: CADOperationState;
  sourceModel: CADOperationSourceModel;
  targetEntities: GeometrySelectionContext[];
  parameters: CADOperationParameter[];
  units: "mm";
  dependencies: string[];
  expectedResult: string;
  validationRequirements: CADOperationValidationRequirement[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  provenance: CADOperationTruth;
  proposalId?: string;
  createdAt: string;
  issue?: CADOperationIssue;
}

export interface CADOperationPreview {
  operationId: string;
  state: "PREVIEW_READY" | "OPERATION_INVALID" | "OPERATION_FAILED";
  currentConfigurationId: string;
  proposedConfigurationId?: string;
  expectedChange: string;
  affectedEntities: GeometrySelectionContext[];
  risks: string[];
  validationStatus: "PENDING" | "PASSED" | "FAILED";
  modelStatus?: "VALIDATED" | "CONCEPTUAL" | "INVALID" | "STALE";
  viewerMeshAvailable: boolean;
  issue?: CADOperationIssue;
}

export interface CADOperationRecovery {
  attempted: false;
  alternatives: Array<{ title: string; parameterPatch?: Partial<Record<CADParameterName, number>>; reason: string; provenance: "INFERRED" | "UNKNOWN" }>;
  limit: 3;
}

export interface CADOperationHistoryRecord {
  id: string;
  operationId: string;
  operationType: CADOperationType;
  parameters: CADOperationParameter[];
  sourceRevision: string;
  resultRevision?: string;
  executionStatus: CADOperationState;
  validationStatus: "PENDING" | "PASSED" | "FAILED";
  timestamp: string;
  origin: "CAD_AGENT" | "USER";
  truth: CADOperationTruth;
  issue?: CADOperationIssue;
  recovery?: CADOperationRecovery;
}

export interface CADOperationPlanInput {
  projectId: string;
  accessKey: string;
  configurationId: string;
  proposal?: Pick<CADChangeProposal, "id" | "parameters">;
  selectedGeometry?: GeometrySelectionContext;
  requestedParameter?: CADOperationParameter;
}
