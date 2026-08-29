import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { executeAndPersistLocalCalculiXResult, listManagedCalculiXResultArtifacts } from "../server/calculixExecution";
import { exportValidatedStep, getOpenCascadeKernel } from "../server/cadKernel";
import type { CaeExecutionContext, MeshRequest, SolverInput } from "../server/caeEngineContracts";
import { GmshAdapter } from "../server/gmshAdapter";
import { executeAndPersistLocalGmshMesh } from "../server/gmshExecution";
import { openPersistentProject, projectMemorySnapshot } from "../server/persistentMemory";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
let directory = "";

describe.sequential("managed local CalculiX result lifecycle", () => {
  beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), "cad-ai-calculix-persistence-")); });
  afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

  it("persists only a real CalculiX result bound to a real Gmsh mesh and managed source CAD hash", async () => {
    const project = await openPersistentProject({ name: "CalculiX real result persistence" });
    const oc = await getOpenCascadeKernel(); const progress = new oc.Message_ProgressRange_1(); const box = new oc.BRepPrimAPI_MakeBox_2(24, 24, 24);
    let stepBytes: Buffer;
    try { stepBytes = exportValidatedStep(oc, box.Shape(), progress, "calculix-persistence-box"); } finally { box.delete?.(); progress.delete?.(); }
    const stepHash = sha256(stepBytes); const stepPath = join(directory, "source.step"); await writeFile(stepPath, stepBytes, { flag: "wx" });
    const context: CaeExecutionContext = { projectId: project.id, authorizedProjectId: project.id, operationAuthorized: true, cadArtifactHash: stepHash, cadRevisionHash: "e".repeat(64), workingDirectory: directory, resourceLimits: { timeoutMs: 30_000, maxMemoryMb: 512, maxCpuSeconds: 30, maxDiskMb: 32, networkDisabled: true } };
    const request: MeshRequest = { stepPath, stepHash, dimension: 3, elementOrder: 1, globalSize: 10, physicalGroups: ["CALCULIX_TEST_SOLID"], options: {} };
    const rawMesh = await new GmshAdapter().mesh(context, request);
    if (rawMesh.status !== "READY" || !rawMesh.meshBytes || !rawMesh.meshHash) throw new Error(`GMSH_PREREQUISITE_FAILED:${rawMesh.status}`);
    const persistedMesh = await executeAndPersistLocalGmshMesh({ projectId: project.id, accessKey: project.accessKey, context, request });
    if (persistedMesh.status !== "READY" || !persistedMesh.artifact) throw new Error(`GMSH_PERSISTENCE_FAILED:${persistedMesh.status}`);
    const input: SolverInput = { analysisType: "STATIC_STRUCTURAL", meshHash: rawMesh.meshHash, meshBytes: rawMesh.meshBytes, materialId: "TEST_FIXTURE_STEEL", unitSystem: "TEST_FIXTURE_MM_N", boundaryConditionIds: ["BOTTOM_FACE_FIXED"], loadIds: ["TOP_FACE_Z_FORCE"], material: { elasticModulusPa: 210_000, poissonRatio: 0.3, densityKgM3: 7.8e-9, source: "TEST_FIXTURE" }, boundaryCondition: { nodeSet: "BOTTOM_FACE", constrainedDofs: [1, 2, 3] }, load: { nodeSet: "TOP_FACE", direction: 3, magnitudeN: -100 } };
    const result = await executeAndPersistLocalCalculiXResult({ projectId: project.id, accessKey: project.accessKey, context, meshArtifact: persistedMesh.artifact, input });
    expect(result).toMatchObject({ status: "READY", resultBytes: undefined, artifact: expect.objectContaining({ projectId: project.id, sourceCadHash: stepHash, meshArtifactId: persistedMesh.artifact.artifactId, meshHash: rawMesh.meshHash, solverInputHash: expect.stringMatching(/^[a-f0-9]{64}$/), solverOutputHash: expect.stringMatching(/^[a-f0-9]{64}$/), storageUrl: expect.stringMatching(/^\/manus-storage\//), engineEvidence: expect.objectContaining({ engine: "CALCULIX", executionStatus: "READY", cleanupStatus: "PASS" }) }) });
    const stored = await listManagedCalculiXResultArtifacts({ projectId: project.id, accessKey: project.accessKey });
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ artifactId: result.artifact?.artifactId, meshHash: rawMesh.meshHash, sourceCadHash: stepHash })]));
    const snapshot = await projectMemorySnapshot({ projectId: project.id, accessKey: project.accessKey });
    expect(snapshot.lineage).toEqual(expect.arrayContaining([expect.objectContaining({ sourceRecordId: result.artifact?.artifactId, kind: "CONFIGURATION", status: "VALIDATED" })]));
  }, 90_000);
});
