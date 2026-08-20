import type { CADFileContext } from "./cadFile";
import type { ViewerFaceRange } from "./cadAgent";
import type { GeometrySelectionContext } from "./cadWorkbench";

export const VIEWER_ENTITY_KINDS = ["MODEL", "BODY", "SOLID", "FACE", "EDGE", "VERTEX"] as const;
export type ViewerEntityKind = (typeof VIEWER_ENTITY_KINDS)[number];
export type ViewerSceneStatus = "IMPORTED" | "PARSED" | "GEOMETRICALLY_VALID" | "CONCEPTUAL" | "MODIFIED" | "VALIDATION_REQUIRED" | "UNAVAILABLE";
export type ViewerRepresentation = "KERNEL_BREP_TESSELLATION" | "PARSED_STL_TRIANGLES" | "UNAVAILABLE";
export type ViewerProvenance = "PARSED" | "CALCULATED" | "DERIVED" | "ESTIMATED" | "UNKNOWN";

export interface ViewerBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  diagonal: number;
  provenance: "CALCULATED" | "DERIVED";
}

/** Stable only for the stored file revision and the tessellation input identified in `sceneId`. */
export interface ViewerGeometryReference {
  id: string;
  fileId: string;
  sourceFileName: string;
  sourceFileVersion: number;
  kind: ViewerEntityKind;
  displayLabel: string;
  faceId?: string;
  triangleStart?: number;
  triangleCount?: number;
  featureId?: string;
  provenance: ViewerProvenance;
}

export interface ViewerSceneMesh {
  vertices: [number, number, number][];
  triangles: [number, number, number][];
  faceRanges: ViewerFaceRange[];
  representation: ViewerRepresentation;
  tessellation: string;
  sourceHash: string;
  triangleLimit: number;
  complete: boolean;
  performanceNote: string;
}

export interface ViewerModelTreeNode {
  id: string;
  parentId?: string;
  kind: ViewerEntityKind;
  label: string;
  geometryReferenceId?: string;
  childCount?: number;
  provenance: ViewerProvenance;
}

export interface ViewerTraceability {
  requirementIds: string[];
  conceptIds: string[];
  decisionRecordIds: string[];
  cadOperationIds: string[];
  validationStatus: ViewerSceneStatus;
  evidenceState: "RECORDED" | "NO_RECORDED_RELATIONSHIP";
}

export interface EngineeringViewerScene {
  sceneId: string;
  projectId: string;
  file: Pick<CADFileContext, "fileId" | "fileName" | "version" | "format" | "sha256" | "parseStatus" | "validationStatus" | "parser" | "parserVersion" | "createdAt">;
  status: ViewerSceneStatus;
  statusReason: string;
  mesh?: ViewerSceneMesh;
  boundingBox?: ViewerBoundingBox;
  entities: ViewerGeometryReference[];
  modelTree: ViewerModelTreeNode[];
  traceability: ViewerTraceability;
  limitations: string[];
}

export interface ViewerCameraState {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
  preset: "ISO" | "FRONT" | "REAR" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
}

export interface ViewerSelection extends GeometrySelectionContext {
  stableReference: ViewerGeometryReference;
  sourceFileId: string;
  sourceFileVersion: number;
  boundingBox?: ViewerBoundingBox;
  traceability: ViewerTraceability;
}

export interface ViewerMeasurement {
  id: string;
  kind: "BOUNDING_BOX" | "EDGE_DISTANCE" | "VERTEX_DISTANCE" | "TRIANGLE_ANGLE";
  value?: number | [number, number, number];
  unit?: "mm" | "deg";
  provenance: "CALCULATED" | "UNKNOWN";
  sourceReferences: string[];
  explanation: string;
}

export interface ViewerProposalPreview {
  proposalId: string;
  sourceConfigurationId?: string;
  sourceFileId?: string;
  status: "READY" | "UNAVAILABLE" | "REJECTED" | "APPLIED";
  currentSceneId?: string;
  proposedSceneId?: string;
  reason: string;
  reversible: true;
}

export interface ViewerModelBranch {
  lineageNodeId: string;
  projectId: string;
  parentLineageNodeId?: string;
  name: string;
  sourceFileId?: string;
  sourceConfigurationId?: string;
  status: "PREVIEW" | "ACTIVE" | "REJECTED";
  reason: string;
  createdAt: string;
}

export const VIEWER_SCENE_MAX_TRIANGLES = 60_000;
