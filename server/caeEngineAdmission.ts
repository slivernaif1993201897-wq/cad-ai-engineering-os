import { createHash } from "node:crypto";
import { access, realpath, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import type {
  CaeEngineKind,
  CaeEngineStatus,
  CaeExecutionContext,
  EngineAvailability,
  EngineIdentity,
} from "./caeEngineContracts";

const APPROVED_EXECUTABLES: Readonly<Record<CaeEngineKind, readonly string[]>> = {
  GMSH: ["/usr/bin/gmsh", "/usr/local/bin/gmsh"],
  CALCULIX: ["/usr/bin/ccx", "/usr/local/bin/ccx", "/usr/bin/calculix"],
};

const CAPABILITIES: Readonly<Record<CaeEngineKind, readonly string[]>> = {
  GMSH: ["STEP_INPUT", "MESH_2D", "MESH_3D", "MSH_OUTPUT"],
  CALCULIX: ["STATIC_STRUCTURAL", "INP_INPUT", "FRD_OUTPUT", "DAT_OUTPUT"],
};
const VERSION_ARGUMENTS: Readonly<Record<CaeEngineKind, readonly string[]>> = {
  GMSH: ["--version"],
  CALCULIX: ["-v"],
};
let activeCaeExecutions = 0;
const MAX_ACTIVE_CAE_EXECUTIONS = 1;

export interface CaeAdmissionResult extends EngineAvailability {
  engine: CaeEngineKind;
  admitted: boolean;
  workingDirectory?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

const VERSION_OUTPUT_LIMIT_BYTES = 8 * 1024;

type VersionProbe = { state: "AVAILABLE"; version: string } | { state: "INVALID"; diagnostic: string };

async function executableVersion(executable: string, engine: CaeEngineKind): Promise<VersionProbe> {
  return new Promise((resolveVersion) => {
    const child = spawn(executable, [...VERSION_ARGUMENTS[engine]], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let outputBytes = 0;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 3_000);
    const appendOutput = (chunk: Buffer) => {
      if (outputBytes >= VERSION_OUTPUT_LIMIT_BYTES) return;
      const allowed = Math.min(chunk.length, VERSION_OUTPUT_LIMIT_BYTES - outputBytes);
      outputBytes += allowed;
      output += chunk.subarray(0, allowed).toString("utf8");
    };
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.once("error", (error) => { clearTimeout(timer); resolveVersion({ state: "INVALID", diagnostic: `version command could not start: ${error.message}` }); });
    child.once("close", (code) => {
      clearTimeout(timer);
      const version = output.trim().split(/\r?\n/)[0];
      if (timedOut) return resolveVersion({ state: "INVALID", diagnostic: "version command exceeded the 3000 ms limit" });
      const calculiXVersionExit = engine === "CALCULIX" && code === 201 && /^This is Version\s+\d/.test(version);
      if ((code !== 0 && !calculiXVersionExit) || !version) return resolveVersion({ state: "INVALID", diagnostic: "version command returned no successful version output" });
      resolveVersion({ state: "AVAILABLE", version });
    });
  });
}

type EngineDiscovery =
  | { state: "AVAILABLE"; executablePath: string; version: string }
  | { state: "UNAVAILABLE" }
  | { state: "INVALID"; diagnostic: string };

async function discoverApprovedExecutable(engine: CaeEngineKind): Promise<EngineDiscovery> {
  let invalidDiagnostic: string | undefined;
  for (const approvedPath of APPROVED_EXECUTABLES[engine]) {
    try {
      await access(approvedPath, fsConstants.X_OK);
      const canonicalPath = await realpath(approvedPath);
      if (!APPROVED_EXECUTABLES[engine].includes(canonicalPath) && canonicalPath !== approvedPath) {
        invalidDiagnostic = `approved path resolves outside the ${engine} allowlist`;
        continue;
      }
      const version = await executableVersion(canonicalPath, engine);
      if (version.state === "AVAILABLE") return { state: "AVAILABLE", executablePath: canonicalPath, version: version.version };
      invalidDiagnostic = version.diagnostic;
    } catch (error) {
      if (error instanceof Error && !/ENOENT/.test(error.message)) invalidDiagnostic = `approved executable is invalid: ${error.message}`;
      // Absence and non-executable paths are expected fail-closed conditions.
    }
  }
  return invalidDiagnostic ? { state: "INVALID", diagnostic: invalidDiagnostic } : { state: "UNAVAILABLE" };
}

function validateContext(context: CaeExecutionContext): readonly string[] {
  const failures: string[] = [];
  if (!context.operationAuthorized) failures.push("operation authorization is required");
  if (!context.projectId || context.projectId !== context.authorizedProjectId) failures.push("project authorization mismatch");
  if (!isHash(context.cadArtifactHash) || !isHash(context.cadRevisionHash)) failures.push("server-calculated CAD artifact and revision hashes are required");
  if (!context.workingDirectory || !resolve(context.workingDirectory).startsWith("/")) failures.push("an absolute isolated working directory is required");
  if (context.resourceLimits.timeoutMs <= 0 || context.resourceLimits.maxMemoryMb <= 0 || context.resourceLimits.maxCpuSeconds <= 0 || context.resourceLimits.maxDiskMb <= 0) failures.push("positive resource limits are required");
  if (context.resourceLimits.networkDisabled !== true) failures.push("network must be disabled for CAE execution");
  return failures;
}

/**
 * Performs server-side admission diagnostics only. It never executes a mesh
 * or solver job, accepts no client executable path, and fails closed when an
 * approved local engine is absent.
 */
export async function admitCaeEngine(engine: CaeEngineKind, context: CaeExecutionContext): Promise<CaeAdmissionResult> {
  const diagnostics = [...validateContext(context)];
  if (diagnostics.length > 0) return { engine, admitted: false, status: "ADMISSION_DENIED", diagnostics };

  try {
    const directory = resolve(context.workingDirectory);
    const directoryStat = await stat(directory);
    if (!directoryStat.isDirectory()) return { engine, admitted: false, status: "INVALID_INPUT", diagnostics: ["working directory is not a directory"] };
    if (resolve(dirname(directory)) === directory) return { engine, admitted: false, status: "INVALID_INPUT", diagnostics: ["root directory cannot be used as a job directory"] };
  } catch {
    return { engine, admitted: false, status: "INVALID_INPUT", diagnostics: ["isolated working directory does not exist"] };
  }

  const discovered = await discoverApprovedExecutable(engine);
  if (discovered.state === "UNAVAILABLE") return { engine, admitted: false, status: "ENGINE_UNAVAILABLE", diagnostics: [`approved ${engine} executable is unavailable`] };
  if (discovered.state === "INVALID") return { engine, admitted: false, status: "ENGINE_INVALID", diagnostics: [discovered.diagnostic] };

  const identity: EngineIdentity = {
    kind: engine,
    executablePath: discovered.executablePath,
    version: discovered.version,
    capabilities: CAPABILITIES[engine],
    environmentHash: sha256([engine, discovered.executablePath, discovered.version, context.resourceLimits.timeoutMs, context.resourceLimits.maxMemoryMb, context.resourceLimits.maxCpuSeconds, context.resourceLimits.maxDiskMb, context.resourceLimits.networkDisabled].join("|")),
  };
  return { engine, admitted: true, status: "READY", identity, workingDirectory: resolve(context.workingDirectory), diagnostics: ["authorized engine identity and isolated runtime prerequisites verified"] };
}

export async function inspectCaeEngine(engine: CaeEngineKind): Promise<EngineAvailability> {
  const discovered = await discoverApprovedExecutable(engine);
  if (discovered.state === "UNAVAILABLE") return { status: "ENGINE_UNAVAILABLE", diagnostics: [`approved ${engine} executable is unavailable`] };
  if (discovered.state === "INVALID") return { status: "ENGINE_INVALID", diagnostics: [discovered.diagnostic] };
  return {
    status: "READY",
    identity: { kind: engine, executablePath: discovered.executablePath, version: discovered.version, capabilities: CAPABILITIES[engine], environmentHash: sha256(`${engine}|${discovered.executablePath}|${discovered.version}`) },
    diagnostics: ["approved engine executable is available for later runtime admission"],
  };
}

/** The sole live CAE process-capacity boundary. No caller-controlled capacity exists. */
export async function runWithCaeExecutionAdmission<T>(context: CaeExecutionContext, execute: () => Promise<T>): Promise<T> {
  const failures = validateContext(context);
  if (failures.length) throw new Error(`CAE_ADMISSION_DENIED:${failures.join(";")}`);
  if (activeCaeExecutions >= MAX_ACTIVE_CAE_EXECUTIONS) throw new Error("CAE_CAPACITY_EXHAUSTED");
  activeCaeExecutions += 1;
  try {
    return await execute();
  } finally {
    activeCaeExecutions -= 1;
  }
}

export function caeExecutionAdmissionSnapshot() {
  return { maxConcurrent: MAX_ACTIVE_CAE_EXECUTIONS, activeConcurrency: activeCaeExecutions };
}
