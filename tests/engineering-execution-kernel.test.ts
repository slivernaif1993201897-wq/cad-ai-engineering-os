import { beforeEach, describe, expect, it, vi } from "vitest";

const { snapshot, appendMemory, appendLineage } = vi.hoisted(() => ({
  snapshot: vi.fn(async () => ({ records: [] })),
  appendMemory: vi.fn(async ({ record }: { record: unknown }) => record),
  appendLineage: vi.fn(async ({ node }: { node: unknown }) => node),
}));

vi.mock("../server/persistentMemory", () => ({
  projectMemorySnapshot: snapshot,
  appendPersistentMemory: appendMemory,
  appendLineageNode: appendLineage,
}));

import { executeEngineeringCommand } from "../server/engineeringExecutionKernel";

describe("Engineering Execution Kernel", () => {
  beforeEach(() => {
    snapshot.mockClear();
    appendMemory.mockClear();
    appendLineage.mockClear();
  });

  it("rejects malformed commands and missing authorization before execution", async () => {
    await expect(executeEngineeringCommand({ commandId: "bad", operation: "CAD_AGENT_MESSAGE", actor: "CAD_AGENT" }, async () => ({ result: true }))).rejects.toThrow("EEK_COMMAND_ID_INVALID");
    await expect(executeEngineeringCommand({ commandId: "CAD-AGENT-0001", operation: "CAD_AGENT_MESSAGE", actor: "CAD_AGENT" }, async () => ({ result: true }))).rejects.toThrow("EEK_AUTHORIZATION_REQUIRED");
  });

  it("persists a completed command event and lineage through existing boundaries", async () => {
    const result = await executeEngineeringCommand({ commandId: "CREATE-PROJECT-0001", operation: "CREATE_PROJECT", actor: "USER" }, async () => ({ result: { id: "PROJECT-1" }, projectId: "PROJECT-1", accessKey: "a".repeat(32), lineage: { title: "Project root", changeSummary: "Created by EEK" } }));
    expect(result.lifecycle).toBe("COMPLETED");
    expect(result.dependencyUpdate).toBe("PROJECT_CREATED");
    expect(appendMemory).toHaveBeenCalledOnce();
    expect(appendLineage).toHaveBeenCalledOnce();
  });

  it("replays the same command idempotently without executing twice", async () => {
    const executor = vi.fn(async () => ({ result: { ok: true }, projectId: "PROJECT-2", accessKey: "b".repeat(32) }));
    const command = { commandId: "CAD-MESSAGE-0001", operation: "CAD_AGENT_MESSAGE" as const, actor: "CAD_AGENT" as const, projectId: "PROJECT-2", accessKey: "b".repeat(32) };
    const first = await executeEngineeringCommand(command, executor);
    const replay = await executeEngineeringCommand(command, executor);
    expect(first.lifecycle).toBe("COMPLETED");
    expect(replay.lifecycle).toBe("REPLAYED");
    expect(executor).toHaveBeenCalledOnce();
  });

  it("fails closed and never records completion when execution throws", async () => {
    await expect(executeEngineeringCommand({ commandId: "CAD-FAILURE-001", operation: "CAD_AGENT_MESSAGE", actor: "CAD_AGENT", projectId: "PROJECT-3", accessKey: "c".repeat(32) }, async () => { throw new Error("VALIDATION_BLOCKED"); })).rejects.toThrow("EEK_FAILED:CAD_AGENT_MESSAGE:VALIDATION_BLOCKED");
    expect(appendMemory).not.toHaveBeenCalled();
  });
});
