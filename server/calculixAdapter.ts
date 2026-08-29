import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

import { admitCaeEngine, runWithCaeExecutionAdmission } from "./caeEngineAdmission";
import type { CaeEngineStatus, CaeExecutionContext, CalculiXExecutionEvidence, EngineAvailability, ICAEASolver, SolverInput, SolverResult } from "./caeEngineContracts";

const MAX_LOG_BYTES = 16 * 1024;
const MSH2_MAX_BYTES = 32 * 1024 * 1024;

const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

function boundedLog() {
  let bytes = 0;
  let value = "";
  let truncated = false;
  return {
    append(chunk: Buffer) {
      if (bytes >= MAX_LOG_BYTES) { truncated = true; return; }
      const slice = chunk.subarray(0, Math.min(chunk.length, MAX_LOG_BYTES - bytes));
      bytes += slice.length;
      value += slice.toString("utf8");
      if (slice.length < chunk.length) truncated = true;
    },
    summary: () => `${value.trim().slice(0, MAX_LOG_BYTES)}${truncated ? " [truncated]" : ""}`,
  };
}

async function runSolver(executable: string, inputName: string, workingDirectory: string, timeoutMs: number) {
  return new Promise<{ exitCode: number | undefined; timedOut: boolean; stdout: string; stderr: string }>((resolveRun) => {
    const stdout = boundedLog();
    const stderr = boundedLog();
    let resolved = false;
    let timedOut = false;
    const finish = (result: { exitCode: number | undefined; timedOut: boolean; stdout: string; stderr: string }) => {
      if (resolved) return;
      resolved = true;
      resolveRun(result);
    };
    const child = spawn(executable, ["-i", inputName], { cwd: workingDirectory, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", stdout.append);
    child.stderr.on("data", stderr.append);
    child.once("error", (error) => { clearTimeout(timer); finish({ exitCode: undefined, timedOut, stdout: stdout.summary(), stderr: `${stderr.summary()} ${error.message}`.trim() }); });
    child.once("close", (code) => { clearTimeout(timer); finish({ exitCode: code ?? undefined, timedOut, stdout: stdout.summary(), stderr: stderr.summary() }); });
  });
}

type SolverRunner = (executable: string, inputName: string, workingDirectory: string, timeoutMs: number) => Promise<{ exitCode: number | undefined; timedOut: boolean; stdout: string; stderr: string }>;

type MshNode = { id: number; x: number; y: number; z: number };
type MshElement = { id: number; nodes: number[] };
function parseMsh2(mesh: Uint8Array): { nodes: MshNode[]; elements: MshElement[] } | undefined {
  if (!mesh.length || mesh.length > MSH2_MAX_BYTES) return undefined;
  const text = Buffer.from(mesh).toString("utf8");
  const nodeSection = text.match(/\$Nodes\s*\r?\n(\d+)\r?\n([\s\S]*?)\$EndNodes/);
  const elementSection = text.match(/\$Elements\s*\r?\n(\d+)\r?\n([\s\S]*?)\$EndElements/);
  if (!nodeSection || !elementSection) return undefined;
  const nodes = nodeSection[2].trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/)).flatMap((parts) => parts.length === 4 && parts.every((part) => Number.isFinite(Number(part))) ? [{ id: Number(parts[0]), x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]) }] : []);
  const elements = elementSection[2].trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/)).flatMap((parts) => {
    const type = Number(parts[1]); const tagCount = Number(parts[2]);
    if (type !== 4 || !Number.isInteger(tagCount) || parts.length !== 3 + tagCount + 4) return [];
    const nodes = parts.slice(3 + tagCount).map(Number);
    return nodes.every(Number.isInteger) ? [{ id: Number(parts[0]), nodes }] : [];
  });
  return Number(nodeSection[1]) === nodes.length && Number(elementSection[1]) >= elements.length && nodes.length >= 4 && elements.length > 0 ? { nodes, elements } : undefined;
}

function buildDeck(input: SolverInput): Buffer | undefined {
  const parsed = parseMsh2(input.meshBytes);
  if (!parsed || !/^[a-f0-9]{64}$/i.test(input.meshHash) || sha256(input.meshBytes) !== input.meshHash) return undefined;
  if (!Number.isFinite(input.material.elasticModulusPa) || input.material.elasticModulusPa <= 0 || !Number.isFinite(input.material.poissonRatio) || input.material.poissonRatio <= 0 || input.material.poissonRatio >= 0.5 || !Number.isFinite(input.material.densityKgM3) || input.material.densityKgM3 <= 0 || !Number.isFinite(input.load.magnitudeN) || !input.boundaryCondition.constrainedDofs.length) return undefined;
  const minimumZ = Math.min(...parsed.nodes.map((node) => node.z));
  const maximumZ = Math.max(...parsed.nodes.map((node) => node.z));
  const fixed = input.boundaryCondition.nodeSet === "ALL" ? parsed.nodes : parsed.nodes.filter((node) => Math.abs(node.z - minimumZ) < 1e-9);
  const loaded = input.load.nodeSet === "ALL" ? parsed.nodes : parsed.nodes.filter((node) => Math.abs(node.z - maximumZ) < 1e-9);
  if (!fixed.length || !loaded.length) return undefined;
  const nodeLines = parsed.nodes.map((node) => `${node.id}, ${node.x}, ${node.y}, ${node.z}`);
  const elementLines = parsed.elements.map((element) => `${element.id}, ${element.nodes.join(", ")}`);
  const boundaryLines = fixed.flatMap((node) => input.boundaryCondition.constrainedDofs.map((dof) => `${node.id}, ${dof}, ${dof}`));
  const force = input.load.magnitudeN / loaded.length;
  const loadLines = loaded.map((node) => `${node.id}, ${input.load.direction}, ${force}`);
  return Buffer.from(["*HEADING", "CAD-AI deterministic CalculiX smoke fixture; no engineering validation claim.", "*NODE", ...nodeLines, "*ELEMENT, TYPE=C3D4, ELSET=SOLID", ...elementLines, "*MATERIAL, NAME=TEST_MATERIAL", "*ELASTIC", `${input.material.elasticModulusPa}, ${input.material.poissonRatio}`, "*DENSITY", `${input.material.densityKgM3}`, "*SOLID SECTION, ELSET=SOLID, MATERIAL=TEST_MATERIAL", "*STEP", "*STATIC", "*BOUNDARY", ...boundaryLines, "*CLOAD", ...loadLines, "*NODE FILE", "U", "*EL FILE", "S", "*END STEP", ""].join("\n"), "utf8");
}

function evidence(status: CaeEngineStatus, startedAt: number, details: Partial<CalculiXExecutionEvidence> = {}): CalculiXExecutionEvidence {
  return { engine: "CALCULIX", executionStatus: status, durationMs: Date.now() - startedAt, stdoutSummary: "", stderrSummary: "", cleanupStatus: "NOT_STARTED", ...details };
}

export class CalculiXAdapter implements ICAEASolver {
  readonly kind = "CALCULIX" as const;
  constructor(private readonly solverRunner: SolverRunner = runSolver) {}
  async availability(): Promise<EngineAvailability> { const context: CaeExecutionContext = { projectId: "availability-probe", authorizedProjectId: "availability-probe", operationAuthorized: true, cadArtifactHash: "0".repeat(64), cadRevisionHash: "0".repeat(64), workingDirectory: process.cwd(), resourceLimits: { timeoutMs: 3_000, maxMemoryMb: 64, maxCpuSeconds: 3, maxDiskMb: 32, networkDisabled: true } }; const admitted = await admitCaeEngine("CALCULIX", context); return { status: admitted.status, identity: admitted.identity, diagnostics: admitted.diagnostics }; }
  async solve(context: CaeExecutionContext, input: SolverInput): Promise<SolverResult> {
    const startedAt = Date.now();
    const deck = buildDeck(input);
    if (!deck) return { status: "INVALID_INPUT", resultPaths: [], diagnostics: ["server-resolved MSH2 mesh and bounded structured problem definition are required"], evidence: evidence("INVALID_INPUT", startedAt) };
    const admission = await admitCaeEngine("CALCULIX", context);
    if (!admission.admitted || !admission.identity) return { status: admission.status, resultPaths: [], diagnostics: admission.diagnostics, evidence: evidence(admission.status, startedAt) };
    const identity = admission.identity;
    try {
      return await runWithCaeExecutionAdmission(context, async () => {
        const directory = await mkdtemp(join(tmpdir(), "cad-ai-calculix-"));
        const inputHash = sha256(deck); let result: SolverResult | undefined;
        try {
          await writeFile(join(directory, "model.inp"), deck, { flag: "wx" });
          const run = await this.solverRunner(identity.executablePath, "model", directory, context.resourceLimits.timeoutMs);
          const details = { version: identity.version, meshHash: input.meshHash, solverInputHash: inputHash, exitCode: run.exitCode, stdoutSummary: run.stdout, stderrSummary: run.stderr };
          if (run.timedOut) return result = { status: "EXECUTION_TIMEOUT", resultPaths: [], diagnostics: ["CalculiX exceeded the server-controlled execution timeout"], evidence: evidence("EXECUTION_TIMEOUT", startedAt, details), solverInputHash: inputHash, exitCode: run.exitCode };
          if (run.exitCode === undefined || run.exitCode !== 0) return result = { status: "EXECUTION_FAILED", resultPaths: [], diagnostics: ["CalculiX returned a non-zero exit status", run.stderr].filter(Boolean), evidence: evidence("EXECUTION_FAILED", startedAt, details), solverInputHash: inputHash, exitCode: run.exitCode };
          const output = await readFile(join(directory, "model.frd"));
          if (!output.length || output.length > context.resourceLimits.maxDiskMb * 1024 * 1024 || !/1PSTEP|DISP|STRESS/.test(output.toString("latin1"))) return result = { status: "OUTPUT_INVALID", resultPaths: [], diagnostics: ["CalculiX result is missing, empty, oversized, or structurally invalid"], evidence: evidence("OUTPUT_INVALID", startedAt, details), solverInputHash: inputHash, exitCode: run.exitCode };
          const outputHash = sha256(output);
          return result = { status: "READY", resultBytes: output, resultPaths: ["model.frd"], solverInputHash: inputHash, solverOutputHash: outputHash, exitCode: run.exitCode, diagnostics: ["CalculiX generated a non-empty structural result for the declared deterministic smoke fixture; no engineering validation conclusion is implied"], evidence: evidence("READY", startedAt, { ...details, solverOutputHash: outputHash }) };
        } catch (error) { return result = { status: "OUTPUT_INVALID", resultPaths: [], diagnostics: [error instanceof Error ? error.message : "CalculiX result handling failed"], evidence: evidence("OUTPUT_INVALID", startedAt, { version: identity.version, meshHash: input.meshHash, solverInputHash: inputHash }) }; }
        finally { try { await rm(directory, { recursive: true, force: true }); if (result?.evidence) result.evidence.cleanupStatus = "PASS"; } catch { if (result?.evidence) result.evidence.cleanupStatus = "FAIL"; } }
      });
    } catch (error) { const message = error instanceof Error ? error.message : "CAE capacity admission failed"; return { status: message === "CAE_CAPACITY_EXHAUSTED" ? "RESOURCE_LIMIT" : "ADMISSION_DENIED", resultPaths: [], diagnostics: [message], evidence: evidence(message === "CAE_CAPACITY_EXHAUSTED" ? "RESOURCE_LIMIT" : "ADMISSION_DENIED", startedAt) }; }
  }
}
