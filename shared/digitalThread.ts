import type { EngineeringTruthStatus } from "./engineeringTruth";

export const DIGITAL_THREAD_ARTIFACT_KINDS = [
  "REQUIREMENT_SET",
  "CONCEPT",
  "CAD_MODEL",
  "CAD_FEATURE",
  "CAE_PLAN",
  "CAE_JOB",
  "CAE_EVIDENCE",
  "OPTIMIZATION_STUDY",
  "OPTIMIZATION_CANDIDATE",
  "DRAWING_PACKAGE",
  "BOM_ITEM",
  "PLM_REVISION",
  "MANUFACTURING_PLAN",
  "VERIFICATION_TEST",
  "REVIEW_GATE",
  "RELEASE_GATE",
] as const;

export type DigitalThreadArtifactKind = (typeof DIGITAL_THREAD_ARTIFACT_KINDS)[number];
export type DigitalThreadArtifactState = "DECLARED" | "EVIDENCE_LINKED" | "REVIEW_REQUIRED" | "REJECTED" | "STALE" | "UNKNOWN";
export type DigitalThreadRelationKind = "DERIVES_FROM" | "REALIZES" | "IMPLEMENTS" | "VALIDATES" | "OPTIMIZES" | "DOCUMENTS" | "CONTAINS" | "MANUFACTURES" | "REQUIRES_REVIEW" | "SUPERSEDES";
export type DigitalThreadAssessmentState = "RESOLVED" | "PARTIAL" | "BLOCKED" | "UNKNOWN";

export interface DigitalThreadArtifact {
  artifactId: string;
  projectId: string;
  kind: DigitalThreadArtifactKind;
  title: string;
  revision: string;
  state: DigitalThreadArtifactState;
  truthStatus: EngineeringTruthStatus;
  sourceArtifactIds: string[];
  externalSourceRecordIds: string[];
  provenance: string[];
  limitations: string[];
  declaredBy: string;
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface DigitalThreadRelation {
  relationId: string;
  projectId: string;
  fromArtifactId: string;
  toArtifactId: string;
  kind: DigitalThreadRelationKind;
  evidenceRecordIds: string[];
  state: "DECLARED" | "EVIDENCE_LINKED" | "UNKNOWN";
  rationale: string;
  createdBy: string;
  createdAt: string;
  retention: { historicalRecordPreserved: true; deletionPolicy: "NO_SILENT_DELETION" };
  executionEligible: false;
  executable: false;
}

export interface DigitalThreadAssessment {
  assessmentId: string;
  projectId: string;
  state: DigitalThreadAssessmentState;
  artifacts: DigitalThreadArtifact[];
  relations: DigitalThreadRelation[];
  unresolvedRequirements: Array<{ artifactId: string; missing: string[] }>;
  limitations: string[];
  releaseStatus: "BLOCKED";
  executionEligible: false;
  executable: false;
  createdAt: string;
}
