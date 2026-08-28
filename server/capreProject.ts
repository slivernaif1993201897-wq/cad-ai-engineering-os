import type { CapreCheckpointManifest, CapreStagingRestore } from "../shared/capre";
import { capreForProject } from "./capre";
import { appendPersistentMemory, openPersistentProject } from "./persistentMemory";

type ProjectAccess = { projectId: string; accessKey: string };
type StagingReceipt = Pick<CapreStagingRestore, "checkpointId" | "stagingId" | "stagingPath"> & { projectId: string };
const stagingReceipts = new Map<string, StagingReceipt>();

async function authorize(input: ProjectAccess) {
  await openPersistentProject({ name: "", projectId: input.projectId, accessKey: input.accessKey });
  return capreForProject(input.projectId);
}

async function record(input: ProjectAccess, title: string, content: Record<string, unknown>) {
  return appendPersistentMemory({
    ...input,
    record: {
      kind: "CAPRE_SNAPSHOT",
      title,
      content: JSON.stringify(content),
      truthStatus: "FACT",
      validationStage: "CONCEPTUAL",
      authorSource: "SYSTEM",
    },
  });
}

export async function discoverCapre(input: ProjectAccess) { return (await authorize(input)).discover(); }
export async function listCapreCheckpoints(input: ProjectAccess) { return (await authorize(input)).list(); }
export async function inspectCapreCheckpoint(input: ProjectAccess & { checkpointId: string }): Promise<CapreCheckpointManifest> { return (await authorize(input)).inspectManifest(input.checkpointId); }
export async function verifyCapreCheckpoint(input: ProjectAccess & { checkpointId: string }) {
  const engine = await authorize(input);
  const result = await engine.verify(input.checkpointId);
  await record(input, `CAPRE integrity check ${input.checkpointId}`, { checkpointId: input.checkpointId, operation: "VERIFY", status: result.status, failures: result.failures, manifestSha256: result.manifestSha256 });
  return result;
}

export async function captureCapreCheckpoint(input: ProjectAccess) {
  const engine = await authorize(input);
  const checkpoint = await engine.capture({ checkpointClass: "UNPROTECTED_LOCAL_SNAPSHOT", requireCleanWorktree: true });
  await record(input, `CAPRE unprotected local snapshot ${checkpoint.checkpointId}`, { checkpoint, durability: "LOCAL_EPHEMERAL", durableBackupAvailable: false, protectionStatus: "UNPROTECTED", secretValues: "NEVER_EXPORTED" });
  return checkpoint;
}

export async function restoreCapreToStaging(input: ProjectAccess & { checkpointId: string }) {
  const engine = await authorize(input);
  const restored = await engine.restoreToStaging(input.checkpointId);
  stagingReceipts.set(restored.stagingId, { projectId: input.projectId, checkpointId: restored.checkpointId, stagingId: restored.stagingId, stagingPath: restored.stagingPath });
  await record(input, `CAPRE staging restore ${restored.checkpointId}`, { checkpointId: restored.checkpointId, stagingId: restored.stagingId, operation: "RESTORE_TO_STAGING", status: restored.status, promotion: "BLOCKED" });
  const { stagingPath: _stagingPath, ...safe } = restored;
  return safe;
}

export async function verifyCapreStagingRestore(input: ProjectAccess & { stagingId: string }) {
  const engine = await authorize(input);
  const receipt = stagingReceipts.get(input.stagingId);
  if (!receipt || receipt.projectId !== input.projectId) throw new Error("CAPRE_STAGING_RECEIPT_NOT_FOUND");
  const result = await engine.verifyRestore(receipt);
  await record(input, `CAPRE staging verification ${receipt.checkpointId}`, { checkpointId: receipt.checkpointId, stagingId: receipt.stagingId, operation: "VERIFY_RESTORE", status: result.status, failures: result.failures });
  return result;
}

export async function runCapreRecoveryDrill(input: ProjectAccess) {
  const engine = await authorize(input);
  const drill = await engine.recoveryDrill();
  await record(input, `CAPRE recovery drill ${drill.checkpointId}`, { checkpointId: drill.checkpointId, operation: "RECOVERY_DRILL", status: drill.status, reason: drill.reason });
  return drill;
}
