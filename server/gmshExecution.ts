import { createHash } from "node:crypto";

import { GmshAdapter } from "./gmshAdapter";
import { appendLineageNode, appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";
import { storagePut } from "./storage";
import type { CaeExecutionContext, MeshRequest, MeshResult } from "./caeEngineContracts";

type Access = { projectId: string; accessKey: string };

export interface ManagedGmshMeshArtifact {
  artifactId: string;
  projectId: string;
  sourceCadHash: string;
  meshHash: string;
  nodeCount: number;
  elementCount: number;
  storageKey: string;
  storageUrl: string;
  engineEvidence: NonNullable<MeshResult["evidence"]>;
  createdAt: string;
}

function id() { return `GMSH-MESH-${crypto.randomUUID()}`; }
function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }

/**
 * The only local-Gmsh promotion boundary. It accepts server-resolved STEP bytes
 * through an admitted context, retains no temporary mesh path, uploads exact
 * validated mesh bytes to managed storage, then records durable project-scoped
 * provenance with source and output hashes.
 */
export async function executeAndPersistLocalGmshMesh(args: Access & { context: CaeExecutionContext; request: MeshRequest; mesher?: GmshAdapter }): Promise<MeshResult & { artifact?: ManagedGmshMeshArtifact }> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  if (args.context.projectId !== args.projectId || args.context.authorizedProjectId !== args.projectId || args.request.stepHash !== args.context.cadArtifactHash) {
    return { status: "ADMISSION_DENIED", diagnostics: ["project authorization and managed CAD hash must match before Gmsh execution"], evidence: { engine: "GMSH", executionStatus: "ADMISSION_DENIED", durationMs: 0, stdoutSummary: "", stderrSummary: "", cleanupStatus: "NOT_STARTED" } };
  }
  const result = await (args.mesher ?? new GmshAdapter()).mesh(args.context, args.request);
  if (result.status !== "READY" || !result.meshBytes || !result.meshHash || !result.nodeCount || !result.elementCount || !result.evidence) return result;

  const artifactId = id();
  const storage = await storagePut(`engineering-projects/${args.projectId}/cae-meshes/${artifactId}-${result.meshHash}.msh`, result.meshBytes, "application/vnd.gmsh");
  const artifact: ManagedGmshMeshArtifact = {
    artifactId,
    projectId: args.projectId,
    sourceCadHash: args.context.cadArtifactHash,
    meshHash: result.meshHash,
    nodeCount: result.nodeCount,
    elementCount: result.elementCount,
    storageKey: storage.key,
    storageUrl: storage.url,
    engineEvidence: result.evidence,
    createdAt: new Date().toISOString(),
  };
  if (sha256(result.meshBytes) !== artifact.meshHash) throw new Error("GMSH_OUTPUT_HASH_MISMATCH");
  await appendPersistentMemory({
    projectId: args.projectId,
    accessKey: args.accessKey,
    record: {
      kind: "CAE_EVIDENCE",
      title: `Local Gmsh mesh · ${artifact.artifactId} · READY`,
      content: JSON.stringify(artifact),
      truthStatus: "DERIVED",
      validationStage: "GEOMETRICALLY_VALIDATED",
      authorSource: "SYSTEM",
      sourceRecordId: args.context.cadRevisionHash,
    },
  });
  await appendLineageNode({
    projectId: args.projectId,
    accessKey: args.accessKey,
    node: {
      kind: "CONFIGURATION",
      sourceRecordId: artifact.artifactId,
      title: `Gmsh mesh · ${artifact.artifactId}`,
      reasonForChange: "A real local Gmsh execution produced a validated mesh from the exact admitted CAD artifact hash.",
      changeSummary: `source=${artifact.sourceCadHash}; mesh=${artifact.meshHash}; engine=${artifact.engineEvidence.version ?? "unknown"}`,
      status: "VALIDATED",
      authorSource: "SYSTEM",
    },
  });
  return { ...result, meshBytes: undefined, artifact };
}

export async function listManagedGmshMeshArtifacts(args: Access): Promise<ManagedGmshMeshArtifact[]> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === "CAE_EVIDENCE")
    .flatMap((record) => { try { return [JSON.parse(record.content) as ManagedGmshMeshArtifact]; } catch { return []; } })
    .filter((item) => Boolean(item.artifactId?.startsWith("GMSH-MESH-") && item.meshHash && item.engineEvidence?.engine === "GMSH"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
