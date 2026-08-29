import { createHash } from "node:crypto";

import { CalculiXAdapter } from "./calculixAdapter";
import type { CaeExecutionContext, SolverInput, SolverResult } from "./caeEngineContracts";
import type { ManagedGmshMeshArtifact } from "./gmshExecution";
import { appendLineageNode, appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";
import { storagePut } from "./storage";

type Access = { projectId: string; accessKey: string };
const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

export interface ManagedCalculiXResultArtifact {
  artifactId: string;
  projectId: string;
  sourceCadHash: string;
  meshArtifactId: string;
  meshHash: string;
  solverInputHash: string;
  solverOutputHash: string;
  storageKey: string;
  storageUrl: string;
  engineEvidence: NonNullable<SolverResult["evidence"]>;
  createdAt: string;
}

/**
 * The only CalculiX-result promotion boundary. Exact mesh bytes are supplied by
 * the authorized server after managed artifact resolution; callers never supply
 * a path, executable, command, environment, or arbitrary solver deck.
 */
export async function executeAndPersistLocalCalculiXResult(args: Access & { context: CaeExecutionContext; meshArtifact: ManagedGmshMeshArtifact; input: SolverInput; solver?: CalculiXAdapter }): Promise<SolverResult & { artifact?: ManagedCalculiXResultArtifact }> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  if (args.context.projectId !== args.projectId || args.context.authorizedProjectId !== args.projectId || args.meshArtifact.projectId !== args.projectId || args.meshArtifact.sourceCadHash !== args.context.cadArtifactHash || args.meshArtifact.meshHash !== args.input.meshHash) {
    return { status: "ADMISSION_DENIED", resultPaths: [], diagnostics: ["authorized project, admitted CAD hash, and managed mesh artifact hash must match"], evidence: { engine: "CALCULIX", executionStatus: "ADMISSION_DENIED", durationMs: 0, stdoutSummary: "", stderrSummary: "", cleanupStatus: "NOT_STARTED" } };
  }
  const result = await (args.solver ?? new CalculiXAdapter()).solve(args.context, args.input);
  if (result.status !== "READY" || !result.resultBytes || !result.solverInputHash || !result.solverOutputHash || !result.evidence) return result;
  if (sha256(result.resultBytes) !== result.solverOutputHash) throw new Error("CALCULIX_OUTPUT_HASH_MISMATCH");
  const artifactId = `CALCULIX-RESULT-${crypto.randomUUID()}`;
  const stored = await storagePut(`engineering-projects/${args.projectId}/cae-results/${artifactId}-${result.solverOutputHash}.frd`, result.resultBytes, "application/octet-stream");
  const artifact: ManagedCalculiXResultArtifact = { artifactId, projectId: args.projectId, sourceCadHash: args.context.cadArtifactHash, meshArtifactId: args.meshArtifact.artifactId, meshHash: args.input.meshHash, solverInputHash: result.solverInputHash, solverOutputHash: result.solverOutputHash, storageKey: stored.key, storageUrl: stored.url, engineEvidence: result.evidence, createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_EVIDENCE", title: `Local CalculiX result · ${artifact.artifactId} · READY`, content: JSON.stringify(artifact), truthStatus: "DERIVED", validationStage: "GEOMETRICALLY_VALIDATED", sourceRecordId: args.meshArtifact.artifactId, authorSource: "SYSTEM" } });
  await appendLineageNode({ projectId: args.projectId, accessKey: args.accessKey, node: { kind: "CONFIGURATION", sourceRecordId: artifact.artifactId, title: `CalculiX result · ${artifact.artifactId}`, reasonForChange: "A real local CalculiX process produced a structurally validated result from the exact managed Gmsh mesh and deterministic server-built test fixture.", changeSummary: `cad=${artifact.sourceCadHash}; mesh=${artifact.meshHash}; input=${artifact.solverInputHash}; result=${artifact.solverOutputHash}; engine=${artifact.engineEvidence.version ?? "unknown"}`, status: "VALIDATED", authorSource: "SYSTEM" } });
  return { ...result, resultBytes: undefined, artifact };
}

export async function listManagedCalculiXResultArtifacts(args: Access): Promise<ManagedCalculiXResultArtifact[]> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  return (await projectMemorySnapshot(args)).records.filter((record) => record.kind === "CAE_EVIDENCE").flatMap((record) => { try { return [JSON.parse(record.content) as ManagedCalculiXResultArtifact]; } catch { return []; } }).filter((item) => Boolean(item.artifactId?.startsWith("CALCULIX-RESULT-") && item.engineEvidence?.engine === "CALCULIX" && item.meshHash && item.solverOutputHash)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
