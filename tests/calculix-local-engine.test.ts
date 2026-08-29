import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CalculiXAdapter } from "../server/calculixAdapter";
import { exportValidatedStep, getOpenCascadeKernel } from "../server/cadKernel";
import { caeExecutionAdmissionSnapshot, inspectCaeEngine } from "../server/caeEngineAdmission";
import type { CaeExecutionContext, MeshRequest, SolverInput } from "../server/caeEngineContracts";
import { GmshAdapter } from "../server/gmshAdapter";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
let directory = "";
let stepPath = "";
let stepHash = "";
let meshBytes: Buffer;
let meshHash = "";

function context(timeoutMs = 30_000): CaeExecutionContext {
  return { projectId: "CALCULIX-LOCAL-TEST", authorizedProjectId: "CALCULIX-LOCAL-TEST", operationAuthorized: true, cadArtifactHash: stepHash, cadRevisionHash: "c".repeat(64), workingDirectory: directory, resourceLimits: { timeoutMs, maxMemoryMb: 512, maxCpuSeconds: 30, maxDiskMb: 32, networkDisabled: true } };
}

function solverInput(overrides: Partial<SolverInput> = {}): SolverInput {
  return { analysisType: "STATIC_STRUCTURAL", meshHash, meshBytes, materialId: "TEST_FIXTURE_STEEL", unitSystem: "TEST_FIXTURE_MM_N", boundaryConditionIds: ["BOTTOM_FACE_FIXED"], loadIds: ["TOP_FACE_Z_FORCE"], material: { elasticModulusPa: 210_000, poissonRatio: 0.3, densityKgM3: 7.8e-9, source: "TEST_FIXTURE" }, boundaryCondition: { nodeSet: "BOTTOM_FACE", constrainedDofs: [1, 2, 3] }, load: { nodeSet: "TOP_FACE", direction: 3, magnitudeN: -100 }, ...overrides };
}

describe.sequential("local CalculiX engine", () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "cad-ai-calculix-test-input-"));
    const oc = await getOpenCascadeKernel(); const progress = new oc.Message_ProgressRange_1(); const box = new oc.BRepPrimAPI_MakeBox_2(20, 20, 20);
    try { const step = exportValidatedStep(oc, box.Shape(), progress, "calculix-real-box"); stepHash = sha256(step); stepPath = join(directory, "source.step"); await writeFile(stepPath, step, { flag: "wx" }); }
    finally { box.delete?.(); progress.delete?.(); }
    const request: MeshRequest = { stepPath, stepHash, dimension: 3, elementOrder: 1, globalSize: 10, physicalGroups: ["TEST_SOLID"], options: {} };
    const meshed = await new GmshAdapter().mesh(context(), request);
    if (meshed.status !== "READY" || !meshed.meshBytes || !meshed.meshHash) throw new Error(`GMSH_TEST_PREREQUISITE_FAILED:${meshed.status}`);
    meshBytes = meshed.meshBytes; meshHash = meshed.meshHash;
  }, 60_000);

  afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

  it("discovers the allowlisted real CalculiX binary through its bounded version probe", async () => {
    const availability = await inspectCaeEngine("CALCULIX");
    expect(availability).toMatchObject({ status: "READY", identity: { kind: "CALCULIX", executablePath: "/usr/bin/ccx", version: expect.stringMatching(/Version 2\.21/) } });
  });

  it("executes an explicit test fixture on a real OpenCascade → Gmsh mesh and returns a non-empty hashed FRD result", async () => {
    const result = await new CalculiXAdapter().solve(context(), solverInput());
    expect(result).toMatchObject({ status: "READY", solverInputHash: expect.stringMatching(/^[a-f0-9]{64}$/), solverOutputHash: expect.stringMatching(/^[a-f0-9]{64}$/), resultPaths: ["model.frd"], evidence: expect.objectContaining({ engine: "CALCULIX", version: expect.stringMatching(/Version 2\.21/), executionStatus: "READY", meshHash, cleanupStatus: "PASS" }) });
    expect(result.resultBytes?.byteLength).toBeGreaterThan(0);
    expect(result.resultBytes?.toString("latin1")).toMatch(/1PSTEP|DISP|STRESS/);
    expect(caeExecutionAdmissionSnapshot()).toEqual({ maxConcurrent: 1, activeConcurrency: 0 });
  }, 60_000);

  it("fails before process execution when mesh identity is tampered and does not leak a permit", async () => {
    const result = await new CalculiXAdapter().solve(context(), solverInput({ meshHash: "d".repeat(64) }));
    expect(result).toMatchObject({ status: "INVALID_INPUT", evidence: { cleanupStatus: "NOT_STARTED" } });
    expect(caeExecutionAdmissionSnapshot().activeConcurrency).toBe(0);
  });

  it("rejects non-zero and missing-result executions, then releases capacity for a subsequent run", async () => {
    const failed = await new CalculiXAdapter(async () => ({ exitCode: 1, timedOut: false, stdout: "", stderr: "fixture failure" })).solve(context(), solverInput());
    expect(failed).toMatchObject({ status: "EXECUTION_FAILED", evidence: { cleanupStatus: "PASS" } });
    const missing = await new CalculiXAdapter(async () => ({ exitCode: 0, timedOut: false, stdout: "", stderr: "" })).solve(context(), solverInput());
    expect(missing).toMatchObject({ status: "OUTPUT_INVALID", evidence: { cleanupStatus: "PASS" } });
    expect(caeExecutionAdmissionSnapshot().activeConcurrency).toBe(0);
    const recovered = await new CalculiXAdapter().solve(context(), solverInput());
    expect(recovered.status).toBe("READY");
  }, 60_000);

  it("rejects a competing solver execution at the single shared CAE capacity and releases the winner", async () => {
    let release: (() => void) | undefined;
    const delayed = new CalculiXAdapter(async () => await new Promise<{ exitCode: number; timedOut: false; stdout: string; stderr: string }>((resolve) => { release = () => resolve({ exitCode: 1, timedOut: false, stdout: "", stderr: "controlled delayed failure" }); }));
    const first = delayed.solve(context(), solverInput());
    await new Promise((resolve) => setTimeout(resolve, 25));
    const competing = await new CalculiXAdapter().solve(context(), solverInput());
    expect(competing).toMatchObject({ status: "RESOURCE_LIMIT", diagnostics: ["CAE_CAPACITY_EXHAUSTED"] });
    release?.();
    expect((await first).status).toBe("EXECUTION_FAILED");
    expect(caeExecutionAdmissionSnapshot()).toEqual({ maxConcurrent: 1, activeConcurrency: 0 });
  });

  it("kills an over-budget real solver execution, cleans its directory, and permits a subsequent real execution", async () => {
    const timedOut = await new CalculiXAdapter().solve(context(1), solverInput());
    expect(timedOut).toMatchObject({ status: "EXECUTION_TIMEOUT", evidence: { executionStatus: "EXECUTION_TIMEOUT", cleanupStatus: "PASS" } });
    expect(caeExecutionAdmissionSnapshot().activeConcurrency).toBe(0);
    const recovered = await new CalculiXAdapter().solve(context(), solverInput());
    expect(recovered).toMatchObject({ status: "READY", evidence: { cleanupStatus: "PASS" } });
    expect(caeExecutionAdmissionSnapshot().activeConcurrency).toBe(0);
  }, 60_000);
});
