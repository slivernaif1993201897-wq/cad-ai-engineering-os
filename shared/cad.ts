import type { RequirementSet } from "./requirements";

export type RequirementStatus = "VALIDATED" | "OPEN_QUESTION" | "CONFLICT";
export type FeatureStatus = "APPLIED" | "UNSUPPORTED" | "FAILED";

export interface CADParameter {
  name: string;
  value: number;
  unit: "mm";
  editable: boolean;
  source: "USER" | "ASSUMPTION";
}

export interface CADFeature {
  id: string;
  type: string;
  status: FeatureStatus;
  dependsOn: string[];
  parameters: CADParameter[];
  note?: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  whyItMatters: string;
  assumption?: string;
  status: "OPEN" | "ACKNOWLEDGED";
}

export interface Requirement {
  id: string;
  description: string;
  status: RequirementStatus;
  source: "NATURAL_LANGUAGE";
  parameters: CADParameter[];
  openQuestions: OpenQuestion[];
}

export interface CADPlan {
  id: string;
  intent: string;
  requirements: Requirement[];
  features: CADFeature[];
  kernel: "OpenCascade.js";
  deterministic: true;
}

export interface CADArtifact {
  id: string;
  kernel: "OpenCascade.js";
  validationStatus: "VALID" | "INVALID" | "UNSUPPORTED";
  shapeKind: "SOLID";
  featureTree: CADFeature[];
  parameters: CADParameter[];
  openQuestions: OpenQuestion[];
  stepBase64?: string;
  stepByteLength?: number;
  viewerAvailable: boolean;
  viewerNote: string;
}

export interface CADGenerationResult {
  plan: CADPlan;
  artifact?: CADArtifact;
  requirementSet?: RequirementSet;
  viewerMesh?: import("./cadAgent").KernelViewerMesh;
  error?: string;
}

export interface MountingBlockInput {
  width: number;
  depth: number;
  height: number;
  holeDiameter: number;
  holeEdgeOffset: number;
  filletRadius: number;
  approveAssumption: boolean;
}
