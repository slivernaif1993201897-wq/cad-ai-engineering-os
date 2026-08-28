import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exportValidatedStep, getOpenCascadeKernel } from "../server/cadKernel";
import { inspectCaeEngine } from "../server/caeEngineAdmission";
import { GmshAdapter } from "../server/gmshAdapter";
import type { CaeExecutionContext, MeshRequest } from "../server/caeEngineContracts";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
let directory = "";
let stepPath = "";
let stepHash = "";

function context(timeoutMs = 30_000): CaeExecutionContext {
  return {
    projectId: "GMSH-LOCAL-TEST",
    authorizedProjectId: "GMSH-LOCAL-TEST",
    operationAuthorized: true,
    cadArtifactHash: stepHash,
    cadRevisionHash: "a".repeat(64),
    workingDirectory: directory,
    resourceLimits: {
      timeoutMs,
      maxMemoryMb: 512,
      maxCpuSeconds: 30,
      maxDiskMb: 32,
      networkDisabled: true,
    },
  };
}

function request(overrides: Partial<MeshRequest> = {}): MeshRequest {
  return {
    stepPath,
    stepHash,
    dimension: 3,
    elementOrder: 1,
    globalSize: 8,
    physicalGroups: ["MOUNTING_BLOCK"],
    options: {},
    ...overrides,
  };
}

describe.sequential("local Gmsh engine", () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "cad-ai-gmsh-test-input-"));
    const oc = await getOpenCascadeKernel();
    const progress = new oc.Message_ProgressRange_1();
    const box = new oc.BRepPrimAPI_MakeBox_2(40, 30, 20);
    let bytes: Buffer;
    try {
      bytes = exportValidatedStep(oc, box.Shape(), progress, "gmsh-real-box");
    } finally {
      box.delete?.();
      progress.delete?.();
    }
    stepHash = sha256(bytes);
    stepPath = join(directory, "mounted-block.step");
    await writeFile(stepPath, bytes, { flag: "wx" });
  }, 45_000);

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("discovers the allowlisted executable through a real version command", async () => {
    const availability = await inspectCaeEngine("GMSH");
    expect(availability.status).toBe("READY");
    expect(availability.identity).toMatchObject({ kind: "GMSH", executablePath: "/usr/bin/gmsh", version: expect.stringMatching(/^4\.12\.1/) });
  });

  it("runs real Gmsh, validates non-empty MSH2 output, bounds evidence, and cleans its directory", async () => {
    const result = await new GmshAdapter().mesh(context(), request());
    expect(result).toMatchObject({
      status: "READY",
      meshHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      nodeCount: expect.any(Number),
      elementCount: expect.any(Number),
      evidence: expect.objectContaining({ engine: "GMSH", version: expect.stringMatching(/^4\.12\.1/), binaryPath: "/usr/bin/gmsh", executionStatus: "READY", inputHash: stepHash, outputHash: expect.stringMatching(/^[a-f0-9]{64}$/), cleanupStatus: "PASS" }),
    });
    expect(result.nodeCount).toBeGreaterThan(0);
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.meshBytes?.byteLength).toBeGreaterThan(0);
    expect(result.evidence?.stdoutSummary.length).toBeLessThanOrEqual(16_000);
    expect(result.evidence?.stderrSummary.length).toBeLessThanOrEqual(16_000);
  }, 45_000);

  it("fails closed for a malformed managed input contract before starting a process", async () => {
    const result = await new GmshAdapter().mesh(context(), request({ stepHash: "b".repeat(64) }));
    expect(result).toMatchObject({ status: "INVALID_INPUT", evidence: expect.objectContaining({ executionStatus: "INVALID_INPUT", cleanupStatus: "NOT_STARTED" }) });
  });

  it("kills an over-budget execution and cleans its temporary directory", async () => {
    const result = await new GmshAdapter().mesh(context(1), request());
    expect(result).toMatchObject({ status: "EXECUTION_TIMEOUT", evidence: expect.objectContaining({ executionStatus: "EXECUTION_TIMEOUT", cleanupStatus: "PASS" }) });
  }, 45_000);
});
