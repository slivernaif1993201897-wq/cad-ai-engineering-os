import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exportValidatedStep, getOpenCascadeKernel } from "../server/cadKernel";
import { executeAndPersistLocalGmshMesh, listManagedGmshMeshArtifacts } from "../server/gmshExecution";
import { openPersistentProject, projectMemorySnapshot } from "../server/persistentMemory";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
let directory = "";

describe.sequential("managed local Gmsh mesh lifecycle", () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "cad-ai-gmsh-persistence-"));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("persists only a real validated Gmsh mesh with exact source/output hash evidence", async () => {
    const project = await openPersistentProject({ name: "Gmsh real mesh persistence" });
    const oc = await getOpenCascadeKernel();
    const progress = new oc.Message_ProgressRange_1();
    const box = new oc.BRepPrimAPI_MakeBox_2(35, 25, 15);
    let stepBytes: Buffer;
    try {
      stepBytes = exportValidatedStep(oc, box.Shape(), progress, "gmsh-persistence-box");
    } finally {
      box.delete?.();
      progress.delete?.();
    }
    const stepHash = sha256(stepBytes);
    const stepPath = join(directory, "source.step");
    await writeFile(stepPath, stepBytes, { flag: "wx" });
    const result = await executeAndPersistLocalGmshMesh({
      projectId: project.id,
      accessKey: project.accessKey,
      context: {
        projectId: project.id,
        authorizedProjectId: project.id,
        operationAuthorized: true,
        cadArtifactHash: stepHash,
        cadRevisionHash: "c".repeat(64),
        workingDirectory: directory,
        resourceLimits: { timeoutMs: 30_000, maxMemoryMb: 512, maxCpuSeconds: 30, maxDiskMb: 32, networkDisabled: true },
      },
      request: { stepPath, stepHash, dimension: 3, elementOrder: 1, globalSize: 7, physicalGroups: ["VALIDATED_BOX"], options: {} },
    });
    expect(result).toMatchObject({
      status: "READY",
      meshBytes: undefined,
      artifact: expect.objectContaining({
        projectId: project.id,
        sourceCadHash: stepHash,
        meshHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        storageKey: expect.stringMatching(/\.msh$/),
        storageUrl: expect.stringMatching(/^\/manus-storage\//),
        engineEvidence: expect.objectContaining({ engine: "GMSH", executionStatus: "READY", cleanupStatus: "PASS" }),
      }),
    });
    const stored = await listManagedGmshMeshArtifacts({ projectId: project.id, accessKey: project.accessKey });
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ artifactId: result.artifact?.artifactId, meshHash: result.meshHash, sourceCadHash: stepHash })]));
    const snapshot = await projectMemorySnapshot({ projectId: project.id, accessKey: project.accessKey });
    expect(snapshot.lineage).toEqual(expect.arrayContaining([expect.objectContaining({ sourceRecordId: result.artifact?.artifactId, kind: "CONFIGURATION", status: "VALIDATED" })]));
  }, 45_000);
});
