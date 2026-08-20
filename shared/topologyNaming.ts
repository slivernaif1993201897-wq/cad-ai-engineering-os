export type TopologyEntityType = "BODY" | "SOLID" | "FACE" | "EDGE" | "VERTEX";
export type TopologyReferenceValidity = "VALID" | "TOPOLOGY_MATCH_AMBIGUOUS" | "TOPOLOGY_REFERENCE_INVALIDATED" | "REVISION_SCOPED";
export type TopologyMatchStatus = "TOPOLOGY_MATCHED" | "TOPOLOGY_MATCH_AMBIGUOUS" | "TOPOLOGY_REFERENCE_INVALIDATED" | "NEW_ENTITY";

export interface TopologyProvenance {
  sourceFeatureId: string;
  sourceRevisionId: string;
  entityType: TopologyEntityType;
  role: string;
  generator: "CIRCLE_SKETCH_EXTRUDE" | "CIRCULAR_PATTERN" | "RECTANGULAR_PATTERN";
}
export interface TopologySignature {
  geometryKind: "PLANAR" | "CYLINDRICAL" | "CIRCULAR" | "VERTEX" | "SOLID";
  role: string;
  measurements: Record<string, number>;
  adjacencyRoleCount: number;
  sourceInstanceIndex?: number;
  sourceInstanceKey?: string;
}
export interface NamedTopologyReference {
  referenceId: string;
  provenance: TopologyProvenance;
  signature: TopologySignature;
  validity: TopologyReferenceValidity;
  evidence: string[];
}
export interface TopologyManifest {
  revisionId: string;
  references: NamedTopologyReference[];
  invariant: "FEATURE_ROLE_AND_SIGNATURE";
  limitations: string[];
}
export interface TopologyMatchEvidence {
  previousReferenceId: string;
  candidateReferenceIds: string[];
  status: TopologyMatchStatus;
  reasons: string[];
}
export interface TopologyMatchReport {
  sourceRevisionId: string;
  targetRevisionId: string;
  matches: TopologyMatchEvidence[];
  summary: { matched: number; ambiguous: number; invalidated: number; newEntities: number };
}
export interface StepGeometryExportProvenance {
  projectId: string;
  model: string;
  sourceRevisionId: string;
  branch: string;
  exportedAt: string;
  geometryValidation: "VALID";
  format: "STEP_GEOMETRY";
  sha256: string;
  storageKey: string;
  url: string;
  featureHistory: "NOT_PRESERVED";
}
