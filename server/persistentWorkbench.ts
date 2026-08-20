import type { WorkbenchAttachment, WorkbenchConversationResult, WorkbenchInput } from "../shared/cadWorkbench";
import { attachWorkbenchFile, runWorkbenchMessage } from "./cadWorkbench";
import {
  appendLineageNode,
  appendPersistentMemory,
  appendPersistentMessages,
  restorePersistentConversation,
} from "./persistentMemory";

type PersistentWorkbenchInput = Omit<WorkbenchInput, "projectId"> & { projectId: string; accessKey: string; conversationId: string };

function persistentContext(context: WorkbenchConversationResult["context"]) {
  return {
    configurationId: context.configurationId,
    modelName: context.modelName,
    selectedGeometry: context.selectedGeometry,
    requirementSummary: context.requirementSummary,
    featureSummary: context.featureSummary,
    parameterSummary: context.parameterSummary,
    conceptSummary: context.conceptSummary,
    memorySummary: context.memorySummary,
    validationStage: context.validationStage,
  };
}

export async function runPersistentWorkbenchMessage(input: PersistentWorkbenchInput) {
  const result = runWorkbenchMessage({ ...input, projectId: input.projectId });
  const context = persistentContext(result.context);
  const messages = await appendPersistentMessages({
    projectId: input.projectId,
    accessKey: input.accessKey,
    conversationId: input.conversationId,
    messages: [
      { role: result.userMessage.role, text: result.userMessage.text, mode: input.mode, actionKind: result.userMessage.actionKind, truthStatus: result.userMessage.truthStatus, context },
      { role: result.agentMessage.role, text: result.agentMessage.text, mode: input.mode, actionKind: result.agentMessage.actionKind, truthStatus: result.agentMessage.truthStatus, context },
    ],
  });
  const persistedRecords = [] as string[];
  const lineageByConcept: Record<string, string> = {};
  const userRecord = await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: "MESSAGE", title: "User CAD Agent request", content: result.userMessage.text, truthStatus: result.userMessage.truthStatus, validationStage: result.context.validationStage, sourceRecordId: messages[0]?.id, relatedConfigurationId: result.context.configurationId, relatedGeometry: result.context.selectedGeometry, authorSource: "USER" } });
  persistedRecords.push(userRecord.id);
  const agentRecord = await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: "MESSAGE", title: "CAD Agent response", content: result.agentMessage.text, truthStatus: result.agentMessage.truthStatus, validationStage: result.context.validationStage, sourceRecordId: messages[1]?.id, relatedConfigurationId: result.context.configurationId, relatedGeometry: result.context.selectedGeometry, authorSource: "CAD_AGENT" } });
  persistedRecords.push(agentRecord.id);
  if (result.proposal) {
    const proposalRecord = await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: "PROPOSAL", title: result.proposal.title, content: `Before: ${result.proposal.before}\nAfter: ${result.proposal.after}\nExpected effect: ${result.proposal.expectedEffect}\nRisks: ${result.proposal.risks.join(" ")}`, truthStatus: result.proposal.truthStatus, validationStage: result.proposal.validationStage, sourceRecordId: agentRecord.id, relatedConfigurationId: result.context.configurationId, relatedGeometry: result.context.selectedGeometry, authorSource: "CAD_AGENT" } });
    persistedRecords.push(proposalRecord.id);
  }
  for (const concept of result.concepts) {
    const record = await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: "CONCEPT", title: concept.name, content: `${concept.architecture}. Mechanism: ${concept.primaryMechanism}. Risks: ${concept.risks.join(" ")} Unknowns: ${concept.unknowns.join(" ")}`, truthStatus: concept.truthStatus, validationStage: concept.validationStage, sourceRecordId: agentRecord.id, relatedConceptId: concept.id, relatedConfigurationId: result.context.configurationId, authorSource: "CAD_AGENT" } });
    persistedRecords.push(record.id);
    const lineage = await appendLineageNode({ projectId: input.projectId, accessKey: input.accessKey, node: { kind: "CONCEPT", sourceRecordId: record.id, title: concept.name, reasonForChange: "Generated as a distinct conceptual architecture by Phase 3.5 intelligence.", changeSummary: `${concept.architecture}: ${concept.primaryMechanism}`, status: "CONCEPTUAL", authorSource: "CAD_AGENT" } });
    persistedRecords.push(lineage.id);
    lineageByConcept[concept.id] = lineage.id;
  }
  for (const evidence of result.evidence) {
    const record = await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: evidence.category === "UNKNOWN" ? "UNKNOWN" : evidence.category === "ASSUMPTION" ? "ASSUMPTION" : "EVIDENCE", title: evidence.label, content: evidence.detail, truthStatus: evidence.truthStatus, validationStage: result.context.validationStage, sourceRecordId: agentRecord.id, relatedConfigurationId: result.context.configurationId, relatedGeometry: result.context.selectedGeometry, authorSource: "SYSTEM" } });
    persistedRecords.push(record.id);
  }
  return { ...result, persistentMessageIds: messages.map((message) => message.id), persistentRecordIds: persistedRecords, lineageByConcept };
}

export async function persistWorkbenchAttachment(args: { projectId: string; accessKey: string; conversationId: string; name: string; sizeBytes?: number; mimeType?: string }): Promise<WorkbenchAttachment> {
  const attachment = attachWorkbenchFile({ projectId: args.projectId, conversationId: args.conversationId, name: args.name, sizeBytes: args.sizeBytes, mimeType: args.mimeType });
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { conversationId: args.conversationId, kind: "FILE", title: attachment.name, content: `${attachment.fileKind} · ${attachment.parseStatus}. ${attachment.failureReason ?? "No parsing result was recorded."}`, truthStatus: attachment.parseStatus === "UNSUPPORTED" || attachment.parseStatus === "PARSE_FAILED" ? "UNKNOWN" : "DERIVED", validationStage: "CONCEPTUAL", authorSource: "USER" } });
  return attachment;
}

export async function recordPersistentConceptDecision(args: { projectId: string; accessKey: string; conversationId: string; conceptId: string; conceptName: string; action: "REJECT" | "EVOLVE" | "ACCEPT"; reason: string; parentLineageId?: string }) {
  if (args.action === "EVOLVE" && !args.parentLineageId) throw new Error("An evolved concept requires its immutable parent lineage ID.");
  const kind = args.action === "REJECT" ? "CONCEPT_REJECTED" : args.action === "ACCEPT" ? "CONCEPT_SUCCESS" : "DECISION";
  const status = args.action === "REJECT" ? "REJECTED" : args.action === "ACCEPT" ? "ACTIVE" : "CONCEPTUAL";
  const record = await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { conversationId: args.conversationId, kind, title: `${args.conceptName} · ${args.action}`, content: args.reason, truthStatus: "DERIVED", validationStage: "CONCEPTUAL", relatedConceptId: args.conceptId, authorSource: "USER" } });
  return appendLineageNode({ projectId: args.projectId, accessKey: args.accessKey, node: { kind: args.action === "EVOLVE" ? "REVISION" : "CONCEPT", parentId: args.parentLineageId, sourceRecordId: record.id, title: args.action === "EVOLVE" ? `${args.conceptName} · Evolved` : args.conceptName, reasonForChange: args.reason, changeSummary: `${args.action} decision recorded without modifying the parent concept.`, status, authorSource: "USER" } });
}

export async function recordPersistentProposalDecision(args: { projectId: string; accessKey: string; conversationId: string; proposalId: string; title: string; action: "PREVIEWED" | "APPLIED" | "REJECTED" | "EDIT_REQUESTED" | "REVERTED"; detail: string }) {
  return appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { conversationId: args.conversationId, kind: "DECISION", title: `${args.title} · ${args.action}`, content: args.detail, truthStatus: args.action === "APPLIED" ? "DERIVED" : "HYPOTHETICAL", validationStage: "CONCEPTUAL", sourceRecordId: args.proposalId, authorSource: "USER" } });
}

export async function restoreWorkbenchConversation(args: { projectId: string; accessKey: string; conversationId: string }) {
  return restorePersistentConversation(args);
}
