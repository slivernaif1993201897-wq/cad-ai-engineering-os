import type { KernelViewerMesh } from "./cadAgent";
import type { EdgeTopologyProof, FilletEvidenceCheck, StepGeometryExportProvenance, TopologyManifest } from "./topologyNaming";

export const SUPPORTED_FEATURE_TYPES = ["RECTANGLE_SKETCH", "CIRCLE_SKETCH", "EXTRUDE", "CIRCULAR_PATTERN", "RECTANGULAR_PATTERN", "MIRROR"] as const;
export type SupportedFeatureType = (typeof SUPPORTED_FEATURE_TYPES)[number];
export type CADFeatureHistoryType = SupportedFeatureType | "REVOLVE" | "SWEEP" | "LOFT" | "BOOLEAN_UNION" | "BOOLEAN_CUT" | "BOOLEAN_INTERSECTION" | "FILLET" | "CHAMFER" | "SHELL" | "DRAFT" | "PATTERN" | "MIRROR";
export type FeatureImplementationStatus = "KERNEL_BACKED" | "UNSUPPORTED";
export type FeatureHistoryStatus = "PLANNED" | "PREVIEW_READY" | "KERNEL_VALIDATED" | "PARAMETRICALLY_VALID" | "FAILED" | "STALE" | "REFERENCE_INVALIDATED" | "SUPPRESSED";
export type FeatureTruth = "FACT" | "CALCULATED" | "KERNEL_VALIDATED" | "ENGINEERINGALLY_UNVERIFIED" | "PHYSICALLY_UNVERIFIED" | "MANUFACTURING_UNVERIFIED" | "UNKNOWN";
export type FeatureParameterName = "width" | "height" | "radius" | "centerX" | "centerY" | "extrudeDistance" | "instanceCount" | "angleDegrees" | "countX" | "countY" | "spacingX" | "spacingY";

export interface FeatureParameter {
  name: FeatureParameterName;
  value: number;
  unit: "mm" | "count" | "deg";
  normalizedValueMm: number;
  editable: boolean;
  provenance: "USER" | "CAD_AGENT" | "DERIVED";
}
export interface FeatureTopologyReference {
  id: string;
  kind: "SKETCH_PROFILE" | "FACE" | "EDGE" | "VERTEX" | "BODY" | "FEATURE";
  ownerFeatureId: string;
  sourceRevisionId: string;
  resolution: "DECLARED" | "RESOLVED" | "REVISION_SCOPED" | "TOPOLOGY_REFERENCE_INVALIDATED" | "INVALIDATED";
  note: string;
}
export interface FeatureConstraint {
  id: string;
  kind: "HORIZONTAL" | "VERTICAL" | "COINCIDENT" | "DIMENSION" | "RADIUS" | "CENTER";
  status: "DECLARED" | "SATISFIED" | "UNSUPPORTED";
  description: string;
}
export interface CADFeatureHistoryNode {
  featureId: string;
  featureType: CADFeatureHistoryType;
  implementation: FeatureImplementationStatus;
  parentFeatures: string[];
  inputGeometryReferences: FeatureTopologyReference[];
  parameters: FeatureParameter[];
  units: "mm";
  constraints: FeatureConstraint[];
  dependencies: string[];
  operationData?: Record<string, string | number | boolean>;
  generatedInstances?: Array<{ instanceId: string; instanceKey: string; index: number; sourceFeatureId: string; angleDegrees?: number; xOffset?: number; yOffset?: number; geometryReference?: string; topologyStatus?: "PROVEN" | "INSTANCE_IDENTITY_UNKNOWN"; status: "KERNEL_VALIDATED" }>;
  sourceRevision: string;
  resultRevision?: string;
  status: FeatureHistoryStatus;
  provenance: FeatureTruth;
  description: string;
}
export interface FeatureHistoryGeometry {
  validation: "VALID" | "INVALID" | "UNAVAILABLE";
  viewerMesh?: KernelViewerMesh;
  stepBase64?: string;
  boundingBox?: KernelViewerMesh["boundingBox"];
  kernel: "OpenCascade.js";
  topology?: TopologyInspection;
  topologyManifest?: TopologyManifest;
  edgeProofs?: EdgeTopologyProof[];
  export?: { status: "AVAILABLE" | "UNAVAILABLE"; format: "STEP_GEOMETRY"; featureHistory: "NOT_PRESERVED"; storageKey?: string; url?: string; note: string; provenance?: StepGeometryExportProvenance };
}
export interface TopologyInspection {
  revisionId: string;
  sourceFeatureId: string;
  references: Array<{ id: string; kind: "BODY" | "FACE" | "EDGE" | "VERTEX"; ordinal: number; stability: "REVISION_SCOPED" | "UNSTABLE_ACROSS_REGENERATION" | "TOPOLOGY_REFERENCE_INVALIDATED"; note: string }>;
  counts: { bodies: number; faces: number; edges: number; vertices: number };
  repeatability: { performed: boolean; sameCounts: boolean; sameBoundingBox: boolean; stableIdentityAcrossRegeneration: false; note: string };
}
export interface FilletReadinessGate {
  ready: boolean;
  checks: Array<{ id: "STABLE_TOPOLOGY_REFERENCES" | "DETERMINISTIC_EDGE_IDENTIFICATION" | "SUCCESSFUL_REGENERATION" | "FAILURE_PRESERVATION" | "BRANCH_PRESERVATION" | "KERNEL_VALIDITY" | "REPEATABILITY"; passed: boolean; detail: string }>;
  evidence?: FilletEvidenceCheck[];
  missing: string[];
  conclusion: string;
}
export interface FeatureHistoryRevision {
  revisionId: string;
  projectId: string;
  parentRevisionId?: string;
  title: string;
  status: "KERNEL_VALIDATED" | "FAILED" | "PREVIEW";
  truth: FeatureTruth;
  features: CADFeatureHistoryNode[];
  geometry: FeatureHistoryGeometry;
  requirementsSummary: string;
  decisionSummary: string;
  createdAt: string;
  failure?: FeatureHistoryFailure;
}
export interface FeatureHistoryFailure {
  featureId?: string;
  parameter?: string;
  stage: "VALIDATION" | "REFERENCE" | "TOPOLOGY_REFERENCE_INVALIDATED" | "KERNEL_REGENERATION";
  reason: string;
  affectedDependencies: string[];
  corrections: string[];
}
export interface FeaturePlanEdit {
  featureId: string;
  parameter?: { name: FeatureParameterName; value: number; unit: "mm" | "cm" | "m" };
  targetReferenceId?: string;
  direction?: "NORMAL";
  featureType?: CADFeatureHistoryType;
  operationOrder?: number;
}
export interface CircleFeatureInput {
  title: string;
  centerX: number;
  centerY: number;
  radius: number;
  extrudeDistance: number;
  unit: "mm" | "cm" | "m";
}
export interface CircularPatternInput {
  title: string;
  sourceRevisionId: string;
  sourceFeatureId: "EXTRUDE-CIRCLE-001";
  axis: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z";
  instanceCount: number;
  angleDegrees: number;
  direction: "COUNTERCLOCKWISE" | "CLOCKWISE";
}
export interface CircularPatternEdit {
  instanceCount?: number;
  angleDegrees?: number;
  axis?: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z";
  direction?: "COUNTERCLOCKWISE" | "CLOCKWISE";
}
export interface RectangularPatternInput {
  title: string;
  sourceRevisionId: string;
  sourceFeatureId: "EXTRUDE-CIRCLE-001";
  directionX: "GLOBAL_X_POSITIVE" | "GLOBAL_X_NEGATIVE";
  directionY: "GLOBAL_Y_POSITIVE" | "GLOBAL_Y_NEGATIVE";
  countX: number;
  countY: number;
  spacingX: number;
  spacingY: number;
  unit: "mm" | "cm" | "m";
}
export interface RectangularPatternEdit {
  directionX?: "GLOBAL_X_POSITIVE" | "GLOBAL_X_NEGATIVE";
  directionY?: "GLOBAL_Y_POSITIVE" | "GLOBAL_Y_NEGATIVE";
  countX?: number;
  countY?: number;
  spacingX?: number;
  spacingY?: number;
  unit?: "mm" | "cm" | "m";
}
export type MirrorPlane = "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z";
export interface MirrorInput {
  title: string;
  sourceRevisionId: string;
  sourceFeatureId: "EXTRUDE-CIRCLE-001";
  mirrorPlane: MirrorPlane;
}
export interface MirrorEdit { mirrorPlane?: MirrorPlane; }
export interface FeatureHistoryComparison {
  baseRevision: string;
  comparedRevision: string;
  sameFeatureDefinitions: boolean;
  parameterChanges: Array<{ featureId: string; name: string; baseValue?: number; comparedValue?: number; unit: "mm" }>;
  geometryMetadata: { base?: KernelViewerMesh["boundingBox"]; compared?: KernelViewerMesh["boundingBox"]; deviationAnalysis: "NOT_IMPLEMENTED" };
  requirements: { base: string; compared: string };
  decisions: { base: string; compared: string };
  validation: { base: FeatureHistoryRevision["status"]; compared: FeatureHistoryRevision["status"] };
}
export const FEATURE_CATALOG: Array<{ type: CADFeatureHistoryType; supported: boolean; description: string }> = [
  { type: "RECTANGLE_SKETCH", supported: true, description: "Kernel-backed closed rectangular wire on the XY plane with declared horizontal, vertical, coincident, and dimensional constraints." },
  { type: "CIRCLE_SKETCH", supported: true, description: "Kernel-backed closed circular edge on the XY plane with explicit center, radius, and dimensional constraints." },
  { type: "EXTRUDE", supported: true, description: "Kernel-backed prism generated only from a valid rectangular sketch profile and positive normal distance." },
  { type: "CIRCULAR_PATTERN", supported: true, description: "Guarded kernel-backed compound of rotated instances from a valid offset CIRCLE_SKETCH → EXTRUDE source, with explicit validated Global X, Y, or Z axis, count, angle, direction, and instance provenance." },
  { type: "RECTANGULAR_PATTERN", supported: true, description: "Guarded kernel-backed compound of translated instances from a validated CIRCLE_SKETCH → EXTRUDE source, using explicit signed Global X and Global Y directions, count, spacing, and instance provenance." },
  { type: "REVOLVE", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "SWEEP", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "LOFT", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "BOOLEAN_UNION", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "BOOLEAN_CUT", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "BOOLEAN_INTERSECTION", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "FILLET", supported: false, description: "Not implemented as a feature-history operation; existing mounting-block filleting is not exposed here." }, { type: "CHAMFER", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "SHELL", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "DRAFT", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "PATTERN", supported: false, description: "Not implemented or tested through the current feature-history kernel route." }, { type: "MIRROR", supported: true, description: "Bounded real OpenCascade plane reflection of a validated CIRCLE_SKETCH → EXTRUDE source across explicit GLOBAL_X, GLOBAL_Y, or GLOBAL_Z only; arbitrary geometry-derived planes are unsupported." },
];
