import { appendLineageNode, appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";

export type EekOperation = "CREATE_PROJECT" | "CAD_AGENT_MESSAGE";
export type EekLifecycle = "RECEIVED" | "AUTHORIZED" | "VALIDATED" | "EXECUTING" | "COMPLETED" | "FAILED" | "REPLAYED";

export type EekCommand = {
  commandId: string;
  operation: EekOperation;
  actor: "USER" | "CAD_AGENT" | "SYSTEM";
  projectId?: string;
  accessKey?: string;
};

export type EekResult<T> = {
  command: EekCommand;
  lifecycle: EekLifecycle;
  result: T;
  eventId: string;
  dependencyUpdate: "NONE" | "PROJECT_CREATED" | "PROJECT_CONTEXT_REFRESH_REQUIRED";
};

type ExecutorResult<T> = {
  result: T;
  projectId?: string;
  accessKey?: string;
  lineage?: { title: string; changeSummary: string };
};

const completedCommands = new Map<string, EekResult<unknown>>();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function validateCommand(command: EekCommand) {
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(command.commandId)) throw new Error("EEK_COMMAND_ID_INVALID");
  if (!command.operation || !command.actor) throw new Error("EEK_COMMAND_INVALID");
  if (command.operation !== "CREATE_PROJECT" && (!command.projectId || !command.accessKey)) throw new Error("EEK_AUTHORIZATION_REQUIRED");
}

async function findDurableReplay(command: EekCommand) {
  if (!command.projectId || !command.accessKey) return undefined;
  const snapshot = await projectMemorySnapshot({ projectId: command.projectId, accessKey: command.accessKey });
  const record = snapshot.records.find((item) => item.kind === "ENGINEERING_JOB_EVENT" && item.content.includes(`\"commandId\":\"${command.commandId}\"`));
  if (!record) return undefined;
  try {
    return JSON.parse(record.content) as EekResult<unknown>;
  } catch {
    throw new Error("EEK_EVENT_CORRUPT");
  }
}

export async function executeEngineeringCommand<T>(command: EekCommand, executor: () => Promise<ExecutorResult<T>>): Promise<EekResult<T>> {
  validateCommand(command);
  const inProcess = completedCommands.get(command.commandId);
  if (inProcess) return { ...inProcess, lifecycle: "REPLAYED" } as EekResult<T>;
  const durable = await findDurableReplay(command);
  if (durable) return { ...durable, lifecycle: "REPLAYED" } as EekResult<T>;

  const eventId = id("EEK-EVENT");
  let lifecycle: EekLifecycle = "AUTHORIZED";
  try {
    lifecycle = "VALIDATED";
    lifecycle = "EXECUTING";
    const execution = await executor();
    const projectId = execution.projectId ?? command.projectId;
    const accessKey = execution.accessKey ?? command.accessKey;
    if (!projectId || !accessKey) throw new Error("EEK_PROJECT_CONTEXT_MISSING");
    const dependencyUpdate = command.operation === "CREATE_PROJECT" ? "PROJECT_CREATED" : "PROJECT_CONTEXT_REFRESH_REQUIRED";
    const event: EekResult<T> = { command, lifecycle: "COMPLETED", result: execution.result, eventId, dependencyUpdate };
    await appendPersistentMemory({ projectId, accessKey, record: { kind: "ENGINEERING_JOB_EVENT", title: `EEK ${command.operation} · ${command.commandId}`, content: JSON.stringify(event), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: command.actor === "CAD_AGENT" ? "CAD_AGENT" : "SYSTEM" } });
    if (execution.lineage) {
      await appendLineageNode({ projectId, accessKey, node: { kind: command.operation === "CREATE_PROJECT" ? "CONCEPT" : "REVISION", title: execution.lineage.title, reasonForChange: `EEK command ${command.commandId}`, changeSummary: execution.lineage.changeSummary, status: "CONCEPTUAL", authorSource: command.actor === "CAD_AGENT" ? "CAD_AGENT" : "SYSTEM" } });
    }
    completedCommands.set(command.commandId, event as EekResult<unknown>);
    return event;
  } catch (error) {
    lifecycle = "FAILED";
    throw new Error(`EEK_${lifecycle}:${command.operation}:${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
}
