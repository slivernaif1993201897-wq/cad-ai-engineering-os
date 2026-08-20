import { describe, expect, it } from "vitest";

import {
  appendLineageNode,
  appendPersistentMemory,
  createPersistentConversation,
  listPersistentConversations,
  openPersistentProject,
  projectMemorySnapshot,
  restorePersistentConversation,
  retrievePersistentMemory,
  updatePersistentConversation,
} from "../server/persistentMemory";
import { runPersistentWorkbenchMessage } from "../server/persistentWorkbench";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("Phase 3.8 persistent engineering memory", () => {
  it("persists a conversation, messages, context, evidence, and selective retrieval across service calls", async () => {
    const project = await openPersistentProject({ name: `Memory Persistence ${suffix}` });
    const conversation = await createPersistentConversation({ projectId: project.id, accessKey: project.accessKey, title: "Bracket review" });
    await runPersistentWorkbenchMessage({
      projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, projectName: project.name,
      message: "Challenge this bracket design and find weaknesses.", mode: "CHALLENGE", modelName: "Concept A",
      selectedGeometry: { kind: "FACE", id: "FACE-01", label: "Bracket support face", source: "VIEWER" },
      requirementSummary: "1 requirement validated", featureSummary: "Support rib feature", parameterSummary: "thickness 4 mm", conceptSummary: "Concept A", memorySummary: "No prior memory", validationStage: "CONCEPTUAL",
    });
    const restored = await restorePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id });
    const retrieval = await retrievePersistentMemory({ projectId: project.id, accessKey: project.accessKey, query: "bracket weaknesses" });

    expect(restored.messages).toHaveLength(2);
    expect(restored.restoredContext?.selectedGeometry.label).toBe("Bracket support face");
    expect(restored.relevantMemory.length).toBeGreaterThan(0);
    expect(retrieval.noRecordedEvidence).toBe(false);
    expect(retrieval.records.some((record) => record.content.toLowerCase().includes("bracket"))).toBe(true);
  });

  it("preserves append-only immutable lineage with parent links rather than overwriting the parent concept", async () => {
    const project = await openPersistentProject({ name: `Lineage ${suffix}` });
    const root = await appendLineageNode({ projectId: project.id, accessKey: project.accessKey, node: { kind: "CONCEPT", title: "Concept A", reasonForChange: "Initial architecture", changeSummary: "Initial concept", status: "CONCEPTUAL", authorSource: "USER" } });
    const child = await appendLineageNode({ projectId: project.id, accessKey: project.accessKey, node: { kind: "REVISION", parentId: root.id, title: "Concept A1", reasonForChange: "Added a rib", changeSummary: "Child revision created", status: "CONCEPTUAL", authorSource: "USER" } });
    const snapshot = await projectMemorySnapshot({ projectId: project.id, accessKey: project.accessKey });

    expect(child.parentId).toBe(root.id);
    expect(snapshot.lineage.filter((node) => node.title.startsWith("Concept A"))).toHaveLength(2);
    expect(snapshot.lineage.find((node) => node.id === root.id)?.title).toBe("Concept A");
  });

  it("isolates project memory by requiring the matching project capability key", async () => {
    const first = await openPersistentProject({ name: `Isolation A ${suffix}` });
    const second = await openPersistentProject({ name: `Isolation B ${suffix}` });
    await appendPersistentMemory({ projectId: first.id, accessKey: first.accessKey, record: { kind: "DECISION", title: "Private decision", content: "This record belongs only to project A.", truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "USER" } });

    await expect(retrievePersistentMemory({ projectId: first.id, accessKey: second.accessKey, query: "private" })).rejects.toThrow("access was denied");
    const otherProjectResult = await retrievePersistentMemory({ projectId: second.id, accessKey: second.accessKey, query: "private" });
    expect(otherProjectResult.noRecordedEvidence).toBe(true);
    expect(otherProjectResult.response).toBe("NO RECORDED EVIDENCE.");
  });

  it("records conversation lifecycle changes as history and handles archive, restore, delete, and missing history honestly", async () => {
    const project = await openPersistentProject({ name: `Lifecycle ${suffix}` });
    const conversation = await createPersistentConversation({ projectId: project.id, accessKey: project.accessKey, title: "Original title" });
    const renamed = await updatePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, action: "RENAME", title: "Reviewed title", reason: "Clarified scope" });
    const archived = await updatePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, action: "ARCHIVE", reason: "Paused review" });
    const hidden = await listPersistentConversations({ projectId: project.id, accessKey: project.accessKey });
    const restored = await updatePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, action: "RESTORE", reason: "Review resumed" });
    const deleted = await updatePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, action: "DELETE", reason: "User removed conversation" });
    const snapshot = await projectMemorySnapshot({ projectId: project.id, accessKey: project.accessKey });

    expect(renamed.title).toBe("Reviewed title");
    expect(archived.status).toBe("ARCHIVED");
    expect(hidden).toHaveLength(0);
    expect(restored.status).toBe("ACTIVE");
    expect(deleted.status).toBe("DELETED");
    expect(snapshot.conversationEvents.map((event) => event.kind)).toEqual(expect.arrayContaining(["CREATED", "RENAMED", "ARCHIVED", "RESTORED", "DELETED"]));
    await expect(restorePersistentConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id })).rejects.toThrow("No restorable conversation");
  });
});
