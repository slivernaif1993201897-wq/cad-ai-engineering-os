import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { admitCaeEngine } from "./caeEngineAdmission";
import type { CaeExecutionContext, CaeEngineStatus, EngineAvailability, GmshExecutionEvidence, IMesher, MeshRequest, MeshResult } from "./caeEngineContracts";

const MAX_LOG_BYTES = 16 * 1024;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseMsh2Counts(contents: string): { nodeCount: number; elementCount: number } | undefined {
  const nodes = contents.match(/\$Nodes\s*\r?\n(\d+)/);
  const elements = contents.match(/\$Elements\s*\r?\n(\d+)/);
  if (!nodes || !elements) return undefined;
  const nodeCount = Number(nodes[1]);
  const elementCount = Number(elements[1]);
  return Number.isInteger(nodeCount) && nodeCount > 0 && Number.isInteger(elementCount) && elementCount > 0
    ? { nodeCount, elementCount }
    : undefined;
}

function boundedLog(): { append: (chunk: Buffer) => void; summary: () => string } {
  let text = "";
  let kept = 0;
  let truncated = false;
  return {
    append(chunk) {
      if (kept >= MAX_LOG_BYTES) { truncated = true; return; }
      const allowed = Math.min(chunk.length, MAX_LOG_BYTES - kept);
      kept += allowed;
      text += chunk.subarray(0, allowed).toString("utf8");
      if (allowed < chunk.length) truncated = true;
    },
    summary: () => `${text.trim().slice(0, MAX_LOG_BYTES)}${truncated ? " [truncated]" : ""}`,
  };
}

async function runFile(executable: string, args: readonly string[], timeoutMs: number): Promise<{ exitCode: number | undefined; timedOut: boolean; stdout: string; stderr: string }> {
  return new Promise((resolveRun) => {
    const stdout = boundedLog();
    const stderr = boundedLog();
    let timedOut = false;
    const child = spawn(executable, [...args], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", stdout.append);
    child.stderr.on("data", stderr.append);
    child.once("error", (error) => { clearTimeout(timer); resolveRun({ exitCode: undefined, timedOut, stdout: stdout.summary(), stderr: `${stderr.summary()} ${error.message}`.trim() }); });
    child.once("close", (exitCode) => { clearTimeout(timer); resolveRun({ exitCode: exitCode ?? undefined, timedOut, stdout: stdout.summary(), stderr: stderr.summary() }); });
  });
}

function safePhysicalGroups(groups: readonly string[]): boolean {
  return groups.length > 0 && groups.length <= 64 && groups.every((group) => /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(group));
}

function evidence(status: CaeEngineStatus, startedAt: number, details: Partial<GmshExecutionEvidence> = {}): GmshExecutionEvidence {
  return {
    engine: "GMSH",
    executionStatus: status,
    durationMs: Date.now() - startedAt,
    stdoutSummary: "",
    stderrSummary: "",
    cleanupStatus: "NOT_STARTED",
    ...details,
  };
}

/**
 * The adapter is intentionally server-only. `stepPath` must be resolved from
 * managed storage by an authorized orchestrator; this class never accepts a
 * client executable, arbitrary command, or unverified artifact hash.
 */
export class GmshAdapter implements IMesher {
  readonly kind = "GMSH" as const;

  async availability(): Promise<EngineAvailability> {
    const context: CaeExecutionContext = {
      projectId: "availability-probe",
      authorizedProjectId: "availability-probe",
      operationAuthorized: true,
      cadArtifactHash: "0".repeat(64),
      cadRevisionHash: "0".repeat(64),
      workingDirectory: process.cwd(),
      resourceLimits: { timeoutMs: 3_000, maxMemoryMb: 1, maxCpuSeconds: 1, maxDiskMb: 1, networkDisabled: true },
    };
    const admission = await admitCaeEngine("GMSH", context);
    return { status: admission.status, identity: admission.identity, diagnostics: admission.diagnostics };
  }

  async mesh(context: CaeExecutionContext, request: MeshRequest): Promise<MeshResult> {
    const startedAt = Date.now();
    if (!safePhysicalGroups(request.physicalGroups)) return { status: "REQUIRED_INPUT", diagnostics: ["at least one bounded physical group identifier is required"], evidence: evidence("REQUIRED_INPUT", startedAt) };
    if (request.globalSize !== undefined && (!Number.isFinite(request.globalSize) || request.globalSize <= 0)) return { status: "INVALID_INPUT", diagnostics: ["global mesh size must be positive when specified"], evidence: evidence("INVALID_INPUT", startedAt) };
    if (Object.keys(request.options).length) return { status: "INVALID_INPUT", diagnostics: ["Gmsh options are server-controlled and the request contract accepts no arbitrary options"], evidence: evidence("INVALID_INPUT", startedAt) };
    const admission = await admitCaeEngine("GMSH", context);
    if (!admission.admitted || !admission.identity) return { status: admission.status, diagnostics: admission.diagnostics, evidence: evidence(admission.status, startedAt) };

    const inputPath = resolve(request.stepPath);
    const jobDirectory = resolve(context.workingDirectory);
    if (!inputPath.startsWith(`${jobDirectory}/`)) return { status: "INVALID_INPUT", diagnostics: ["STEP input must reside in the isolated job directory"], evidence: evidence("INVALID_INPUT", startedAt) };
    let input: Buffer;
    try {
      input = await readFile(inputPath);
      if (input.length === 0 || input.length > context.resourceLimits.maxDiskMb * 1024 * 1024 || sha256(input) !== request.stepHash || request.stepHash !== context.cadArtifactHash) return { status: "INVALID_INPUT", diagnostics: ["managed STEP bytes do not match the admitted CAD artifact hash or resource policy"], evidence: evidence("INVALID_INPUT", startedAt, { inputHash: sha256(input) }) };
      if (!(await stat(inputPath)).isFile()) return { status: "INVALID_INPUT", diagnostics: ["STEP input is not a regular file"], evidence: evidence("INVALID_INPUT", startedAt) };
    } catch {
      return { status: "INVALID_INPUT", diagnostics: ["managed STEP input is unavailable"], evidence: evidence("INVALID_INPUT", startedAt) };
    }
    const workDirectory = await mkdtemp(join(tmpdir(), "cad-ai-gmsh-"));
    const localInputPath = join(workDirectory, `${basename(inputPath, ".step")}.step`);
    const outputPath = join(workDirectory, "mesh.msh");
    let result: MeshResult | undefined;
    let cleanupStatus: GmshExecutionEvidence["cleanupStatus"] = "NOT_STARTED";
    try {
      await writeFile(localInputPath, input, { flag: "wx" });
      const args = [request.dimension === 3 ? "-3" : "-2", localInputPath, "-o", outputPath, "-format", "msh2", "-order", String(request.elementOrder), "-v", "2"];
      if (request.globalSize !== undefined) args.push("-clmax", String(request.globalSize));
      const execution = await runFile(admission.identity.executablePath, args, context.resourceLimits.timeoutMs);
      const details = { version: admission.identity.version, binaryPath: admission.identity.executablePath, inputHash: request.stepHash, exitCode: execution.exitCode, stdoutSummary: execution.stdout, stderrSummary: execution.stderr };
      if (execution.timedOut) {
        result = { status: "EXECUTION_TIMEOUT", diagnostics: ["Gmsh exceeded the server-controlled execution timeout"], evidence: evidence("EXECUTION_TIMEOUT", startedAt, details) };
        return result;
      }
      if (execution.exitCode === undefined) {
        result = { status: "EXECUTION_FAILED", diagnostics: ["Gmsh process could not start", execution.stderr].filter(Boolean), evidence: evidence("EXECUTION_FAILED", startedAt, details) };
        return result;
      }
      if (execution.exitCode !== 0) {
        result = { status: "EXECUTION_FAILED", diagnostics: ["Gmsh returned a non-zero exit status", execution.stderr].filter(Boolean), evidence: evidence("EXECUTION_FAILED", startedAt, details) };
        return result;
      }
      const meshBytes = await readFile(outputPath);
      if (meshBytes.length === 0 || meshBytes.length > context.resourceLimits.maxDiskMb * 1024 * 1024) {
        result = { status: "OUTPUT_INVALID", diagnostics: ["Gmsh output is empty or exceeds the server-controlled disk limit"], evidence: evidence("OUTPUT_INVALID", startedAt, details) };
        return result;
      }
      const counts = parseMsh2Counts(meshBytes.toString("utf8"));
      if (!counts) {
        result = { status: "OUTPUT_INVALID", diagnostics: ["Gmsh output lacks valid MSH2 node or element counts"], evidence: evidence("OUTPUT_INVALID", startedAt, details) };
        return result;
      }
      const meshHash = sha256(meshBytes);
      result = { status: "READY", meshBytes, meshHash, ...counts, diagnostics: ["Gmsh generated a validated MSH2 mesh from admitted managed STEP bytes"], evidence: evidence("READY", startedAt, { ...details, outputHash: meshHash }) };
      return result;
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "unknown Gmsh output failure";
      result = { status: "OUTPUT_INVALID", diagnostics: ["Gmsh did not produce a readable mesh output", diagnostic], evidence: evidence("OUTPUT_INVALID", startedAt, { version: admission.identity.version, binaryPath: admission.identity.executablePath, inputHash: request.stepHash }) };
      return result;
    } finally {
      try {
        await rm(workDirectory, { recursive: true, force: true });
        cleanupStatus = "PASS";
      } catch {
        cleanupStatus = "FAIL";
      }
      if (result?.evidence) result.evidence.cleanupStatus = cleanupStatus;
    }
  }
}
