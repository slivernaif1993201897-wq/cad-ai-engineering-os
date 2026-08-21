import type { CADAgentContext, ChatRole, GeometrySelectionContext, WorkbenchValidationStage } from "./cadWorkbench";
import type { EngineeringMode } from "./engineeringIntelligence";
import type { EngineeringTruthStatus } from "./engineeringTruth";

export type ConversationStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type ConversationEventKind = "CREATED" | "RENAMED" | "ARCHIVED" | "RESTORED" | "DELETED";
export type MemoryRecordKind = "REQUIREMENT" | "ASSUMPTION" | "CONSTRAINT" | "UNKNOWN" | "CONCEPT" | "CONCEPT_REJECTED" | "CONCEPT_SUCCESS" | "DECISION" | "CANDIDATE_RANKING" | "SPECIALIST_CRITIQUE" | "SELF_CORRECTION" | "VALIDATION" | "CAD_HANDOFF" | "EVIDENCE" | "MESSAGE" | "PROPOSAL" | "FILE" | "CAD_OPERATION" | "FEATURE_HISTORY" | "FEATURE_REVISION" | "CAE_PLAN" | "CAE_EVIDENCE" | "CAE_REVIEW" | "CAE_KNOWLEDGE_GAP" | "CAE_CHANGE_REQUEST" | "CAE_SOLVER_ADAPTER" | "CAE_EXPERIMENT" | "CAE_READINESS" | "CAE_INVALIDATION" | "CAE_UNCERTAINTY" | "CAE_EVIDENCE_GRAPH" | "CAE_MATERIAL_RECONCILIATION" | "CAE_REVIEW_DECISION" | "CAE_MEASUREMENT_DATASET" | "CAE_CALIBRATION" | "CAE_DATASET_PROCESSING" | "CAE_COMPARISON" | "CAE_CALIBRATION_CANDIDATE" | "CAE_ADAPTER_REGISTRATION" | "CAE_REVIEWER_IDENTITY" | "CAE_CERTIFICATE" | "CAE_CERTIFICATE_VERIFICATION" | "CAE_ADAPTER_TRUST_VERIFICATION" | "CAE_AUTHORIZED_APPROVAL" | "CAE_EXTERNAL_IDENTITY" | "CAE_REVOCATION_SOURCE" | "CAE_SANDBOX_ATTESTATION" | "CAE_SANDBOX_ATTESTATION_VERIFICATION" | "CAE_EXECUTION_TRUST_READINESS" | "CAE_EXECUTION_TRUST_BENCHMARK" | "CAE_RUNTIME_ARCHITECTURE_REVIEW" | "CAE_RUNTIME_READINESS_REVIEW" | "CAE_RUNTIME_CAPACITY_POLICY" | "CAE_RUNTIME_INDEPENDENT_ATTESTATION" | "CAE_RUNTIME_CAPACITY_VALIDATION" | "CAE_EXTERNAL_INFRASTRUCTURE_EVIDENCE" | "CAE_EXTERNAL_SANDBOX_REVIEW" | "CAE_EXTERNAL_HOSTILE_TEST_ENVIRONMENT" | "CAE_EXTERNAL_HOSTILE_TEST_EVIDENCE" | "CAE_EXTERNAL_EVIDENCE_LIFECYCLE" | "CAE_EXTERNAL_EVIDENCE_VERIFICATION" | "CAE_EXTERNAL_VERIFICATION_READINESS" | "CAE_REVIEWER_SEPARATION_POLICY" | "CAE_EVIDENCE_RETENTION_POLICY" | "CAE_REVIEWER_REVOCATION_POLICY" | "CAE_VERIFICATION_REVIEW" | "CAE_TEST_ENVIRONMENT_EVIDENCE_IMPORT" | "CAE_VERIFICATION_GOVERNANCE_LIFECYCLE" | "CAE_VERIFICATION_CONFLICT" | "CAE_VERIFICATION_GOVERNANCE_READINESS" | "CAE_REVOCATION" | "CAE_SECURITY_AUDIT";
export type LineageNodeKind = "CONCEPT" | "REVISION" | "CONFIGURATION" | "PROPOSAL";
export type LineageNodeStatus = "ACTIVE" | "REJECTED" | "SUPERSEDED" | "ARCHIVED" | "CONCEPTUAL" | "VALIDATED";

export interface PersistentProject {
  id: string;
  name: string;
  accessKey: string;
  createdAt: string;
  archivedAt?: string;
}

export interface PersistentConversation {
  id: string;
  projectId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
}

export interface PersistentConversationEvent {
  id: string;
  projectId: string;
  conversationId: string;
  kind: ConversationEventKind;
  priorTitle?: string;
  nextTitle?: string;
  reason: string;
  createdAt: string;
}

export interface PersistentMessage {
  id: string;
  projectId: string;
  conversationId: string;
  role: ChatRole;
  text: string;
  mode: EngineeringMode;
  actionKind?: string;
  truthStatus: EngineeringTruthStatus;
  context: Pick<CADAgentContext, "configurationId" | "modelName" | "selectedGeometry" | "requirementSummary" | "featureSummary" | "parameterSummary" | "conceptSummary" | "memorySummary" | "validationStage">;
  createdAt: string;
}

export interface PersistentMemoryRecord {
  id: string;
  projectId: string;
  conversationId?: string;
  kind: MemoryRecordKind;
  title: string;
  content: string;
  truthStatus: EngineeringTruthStatus;
  validationStage: WorkbenchValidationStage;
  sourceRecordId?: string;
  relatedConceptId?: string;
  relatedRequirementId?: string;
  relatedConfigurationId?: string;
  relatedGeometry?: GeometrySelectionContext;
  createdAt: string;
  authorSource: "CAD_AGENT" | "USER" | "SYSTEM";
}

export interface DesignLineageNode {
  id: string;
  projectId: string;
  kind: LineageNodeKind;
  parentId?: string;
  sourceRecordId?: string;
  title: string;
  reasonForChange: string;
  changeSummary: string;
  status: LineageNodeStatus;
  authorSource: "CAD_AGENT" | "USER" | "SYSTEM";
  createdAt: string;
}

export interface MemoryRetrievalResult {
  query: string;
  projectId: string;
  records: PersistentMemoryRecord[];
  sourceConversationIds: string[];
  noRecordedEvidence: boolean;
  response: string;
}

export interface RestoredConversationContext {
  conversation: PersistentConversation;
  messages: PersistentMessage[];
  relevantMemory: PersistentMemoryRecord[];
  restoredContext?: PersistentMessage["context"];
}
