import type { CADArtifact, CADFeature, CADParameter, MountingBlockInput } from "./cad";
import type { RequirementSet, TraceabilityLink } from "./requirements";

export const CAD_FEATURE_TYPES = [
  "BOX",
  "CYLINDER",
  "SPHERE",
  "CONE",
  "EXTRUDE",
  "REVOLVE",
  "CUT",
  "FUSE",
  "INTERSECTION",
  "FILLET",
  "CHAMFER",
  "HOLE",
  "PATTERN",
  "MIRROR",
  "TRANSFORM",
] as const;

export type CADFeatureType = (typeof CAD_FEATURE_TYPES)[number];
export type CADModelStatus = "CONCEPTUAL" | "GENERATED" | "VALIDATED" | "INVALID" | "STALE";
export type CADExecutionStatus = "PLANNED" | "EXECUTED" | "UNSUPPORTED" | "FAILED";

export interface CADCoordinateSystem {
  id: "CSYS-WORLD";
  origin: [number, number, number];
  axes: { x: "+X"; y: "+Y"; z: "+Z" };
  unit: "mm";
}

export interface CADSketch {
  id: string;
  plane: "XY" | "YZ" | "XZ";
  constraints: string[];
  status: "NOT_REQUIRED" | "PLANNED" | "EXECUTED";
}

export interface PlannedFeature extends CADFeature {
  featureType: CADFeatureType;
  parentFeatures: string[];
  geometryReference: string;
  executionStatus: CADExecutionStatus;
  traceabilityRequirementIds: string[];
}

export interface CADPlanV2 {
  plan_id: string;
  units: "mm";
  coordinate_system: CADCoordinateSystem;
  parameters: CADParameter[];
  sketches: CADSketch[];
  features: PlannedFeature[];
  feature_order: string[];
  constraints: string[];
  references: TraceabilityLink[];
  validation_rules: string[];
  execution_notes: string[];
  expected_outputs: ("SOLID" | "STEP" | "TESSELLATED_VIEWER_MESH" | "BOUNDING_BOX")[];
  model_status: CADModelStatus;
  requirement_set_id: string;
  revision: number;
}

export interface ViewerFaceRange {
  faceId: string;
  featureId: string;
  triangleStart: number;
  triangleCount: number;
}

export interface KernelViewerMesh {
  source: "OpenCascade.js";
  tessellation: "BRepMesh_IncrementalMesh";
  vertices: [number, number, number][];
  triangles: [number, number, number][];
  faceRanges: ViewerFaceRange[];
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    diagonal: number;
  };
  measurements: {
    width: number;
    depth: number;
    height: number;
    boundingBoxDiagonal: number;
  };
}

export interface CADConfiguration {
  id: string;
  name: string;
  revision: number;
  createdAt: string;
  input: MountingBlockInput;
  requirementSet: RequirementSet;
  plan: CADPlanV2;
  artifact?: CADArtifact;
  viewerMesh?: KernelViewerMesh;
  modelStatus: CADModelStatus;
}

export interface CADAgentResult {
  configuration: CADConfiguration;
  plan: CADPlanV2;
  artifact?: CADArtifact;
  viewerMesh?: KernelViewerMesh;
  error?: string;
}

export interface CADExport {
  configurationId: string;
  revision: number;
  format: "STEP";
  fileName: string;
  mimeType: "application/step";
  stepBase64: string;
  byteLength: number;
  validationStatus: "VALID";
}
