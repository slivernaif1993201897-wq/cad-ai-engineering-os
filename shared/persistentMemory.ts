import type { CADAgentContext, ChatRole, GeometrySelectionContext, WorkbenchValidationStage } from "./cadWorkbench";
import type { EngineeringMode } from "./engineeringIntelligence";
import type { EngineeringTruthStatus } from "./engineeringTruth";

export type ConversationStatus = "ACTIVE" | "ARCHIVED" | "DELETED";
export type ConversationEventKind = "CREATED" | "RENAMED" | "ARCHIVED" | "RESTORED" | "DELETED";
export type MemoryRecordKind = "REQUIREMENT" | "ASSUMPTION" | "CONSTRAINT" | "UNKNOWN" | "CONCEPT" | "CONCEPT_REJECTED" | "CONCEPT_SUCCESS" | "DECISION" | "CANDIDATE_RANKING" | "SPECIALIST_CRITIQUE" | "SELF_CORRECTION" | "VALIDATION" | "CAD_HANDOFF" | "EVIDENCE" | "MESSAGE" | "PROPOSAL" | "FILE" | "CAD_OPERATION" | "FEATURE_HISTORY" | "FEATURE_REVISION";
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
