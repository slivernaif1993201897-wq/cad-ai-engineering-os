import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("persistentMemory tRPC API", () => {
  it("persists and restores selection-aware CAD Agent context through the mobile-facing API", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: `Router memory ${Date.now()}` });
    const conversation = await caller.persistentMemory.createConversation({ projectId: project.id, accessKey: project.accessKey, title: "Router conversation" });
    const result = await caller.persistentMemory.message({
      projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, message: "Challenge this selected edge.", mode: "CHALLENGE", modelName: "Mounting Block",
      selectedGeometry: { kind: "EDGE", id: "EDGE-04", label: "Outer support edge", source: "VIEWER" }, requirementSummary: "Width 100 mm", featureSummary: "Fillet feature", parameterSummary: "Radius 3 mm", conceptSummary: "Concept A", memorySummary: "No prior record", validationStage: "GEOMETRICALLY_VALIDATED",
    });
    const restored = await caller.persistentMemory.restoreConversation({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id });
    const search = await caller.persistentMemory.retrieve({ projectId: project.id, accessKey: project.accessKey, query: "support edge" });

    expect(result.persistentMessageIds).toHaveLength(2);
    expect(restored.messages).toHaveLength(2);
    expect(restored.restoredContext?.selectedGeometry.label).toBe("Outer support edge");
    expect(search.noRecordedEvidence).toBe(false);
  });

  it("does not expose project records when a different project capability key is supplied", async () => {
    const caller = appRouter.createCaller(ctx);
    const first = await caller.persistentMemory.openProject({ name: `Router isolation A ${Date.now()}` });
    const second = await caller.persistentMemory.openProject({ name: `Router isolation B ${Date.now()}` });
    await expect(caller.persistentMemory.snapshot({ projectId: first.id, accessKey: second.accessKey })).rejects.toThrow("access was denied");
  });
});
