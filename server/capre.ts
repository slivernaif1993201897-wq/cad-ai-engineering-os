import crypto from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { chmod, cp, lstat, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  CAPRE_VERSION,
  type CapreCheckpointClass,
  type CapreCheckpointManifest,
  type CapreCheckpointSummary,
  type CapreAuthoritativeRecoveryStatus,
  type CapreDurableStorageStatus,
  type CapreDiscovery,
  type CapreDurabilityClass,
  type CapreEngineIdentity,
  type CapreHealthGate,
  type CapreInventoryClassification,
  type CapreManifestFile,
  type CapreProtectionStatus,
  type CapreRecoveryDrill,
  type CapreResetSurvivalStatus,
  type CapreStateIdentityStatus,
  type CapreRestoreVerification,
  type CapreSecretPrerequisite,
  type CapreStagingRestore,
  type CapreVerificationResult,
} from "../shared/capre";
import { inspectCaeEngine } from "./caeEngineAdmission";

const execFile = promisify(execFileCallback);
const SHA256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const CAPRE_MANIFEST_VERSION = "CAPRE_MANIFEST_V1" as const;
const SAFE_CHECKPOINT_ID = /^CAPRE-[A-Z0-9][A-Z0-9_-]{7,120}$/;
const MEMORY_CLASSIFICATION = "ENVIRONMENT-BOUNDED / PROCESS_LOCAL_NATIVE_WASM_RETENTION_SUSPECTED" as const;
const REQUIRED_SECRETS = ["RUNTIME_EVIDENCE_HMAC_KEY", "DATABASE_URL", "JWT_SECRET", "BUILT_IN_FORGE_API_KEY"] as const;
const SOURCE_ENTRIES = [
  "app", "assets", "components", "constants", "drizzle", "fixtures", "hooks", "lib", "scripts", "server", "shared", "tests",
  ".gitignore", ".npmrc", ".project-config.json", ".watchmanconfig", "app.config.ts", "babel.config.js", "design.md", "eslint.config.js",
  "expo-env.d.ts", "global.css", "metro.config.js", "nativewind-env.d.ts", "package.json", "pnpm-lock.yaml", "tailwind.config.js",
  "theme.config.d.ts", "theme.config.js", "todo.md", "tsconfig.json",
] as const;
const FORBIDDEN_NAME = /(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key|p12)|id_rsa(?:\.pub)?|credentials(?:\.json)?|secrets?(?:\.json)?)(?:$|\/)/i;
const CAPRE_LOCK = ".capture.lock";
const DURABLE_STORAGE_STATUS: CapreDurableStorageStatus = "UNAVAILABLE";
const PROTECTION_STATUS: CapreProtectionStatus = "UNPROTECTED";
const RESET_SURVIVAL_STATUS: CapreResetSurvivalStatus = "NOT_PROVEN";
const AUTHORITATIVE_RECOVERY_STATUS: CapreAuthoritativeRecoveryStatus = "UNAVAILABLE";
const STATE_IDENTITY_STATUS: CapreStateIdentityStatus = "NOT_PROVEN";
const DURABLE_STORAGE_DETAIL = "No CAPRE-authorised durable target with a complete database-and-managed-artifact export/import contract is configured. The official Task Data Backup is owner-operated outside CAPRE.";

type CapreEngineOptions = { projectRoot?: string; snapshotRoot?: string; now?: () => Date };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function stableJson(value: unknown): string { return JSON.stringify(canonicalize(value)); }
function manifestDigest(manifest: CapreCheckpointManifest): string { return SHA256(stableJson({ ...manifest, completeManifestSha256: "" })); }
function manifestFileType(filePath: string): string { return extname(filePath).slice(1).toLowerCase() || "file"; }
function stamp(now: () => Date) { return now().toISOString(); }
function checkpointId(now: () => Date) { return `CAPRE-${now().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`; }

function assertCheckpointId(id: string): void {
  if (!SAFE_CHECKPOINT_ID.test(id)) throw new Error("CAPRE_INVALID_CHECKPOINT_ID");
}

function within(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

function safeJoin(root: string, logicalPath: string): string {
  if (!logicalPath || logicalPath.includes("\0") || isAbsolute(logicalPath)) throw new Error("CAPRE_INVALID_MANIFEST_PATH");
  const target = resolve(root, logicalPath);
  if (!within(root, target)) throw new Error("CAPRE_PATH_TRAVERSAL_REJECTED");
  return target;
}

async function exists(path: string): Promise<boolean> { try { await lstat(path); return true; } catch { return false; } }

async function command(projectRoot: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: projectRoot, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

async function gitState(projectRoot: string) {
  const [head, branch, porcelain, tracked, submodules] = await Promise.all([
    command(projectRoot, "rev-parse", "HEAD"),
    command(projectRoot, "branch", "--show-current"),
    command(projectRoot, "status", "--porcelain=v1"),
    command(projectRoot, "ls-files"),
    command(projectRoot, "submodule", "status").catch(() => ""),
  ]);
  const statusLines = porcelain ? porcelain.split("\n") : [];
  const untrackedFiles = statusLines.filter((line) => line.startsWith("?? ")).map((line) => line.slice(3));
  const deletedFiles = statusLines.filter((line) => line.startsWith(" D") || line.startsWith("D ")).map((line) => line.slice(3));
  return { head, branch: branch || "DETACHED", worktreeState: porcelain ? "DIRTY" as const : "CLEAN" as const, trackedFileCount: tracked ? tracked.split("\n").filter(Boolean).length : 0, untrackedFiles, deletedFiles, submodules: submodules ? submodules.split("\n").filter(Boolean) : [] };
}

async function walkSafe(root: string, absolute: string): Promise<string[]> {
  const entry = await lstat(absolute);
  if (entry.isSymbolicLink()) throw new Error(`CAPRE_SYMLINK_REJECTED:${relative(root, absolute)}`);
  if (entry.isFile()) return [absolute];
  if (!entry.isDirectory()) throw new Error(`CAPRE_UNSUPPORTED_FILE_TYPE:${relative(root, absolute)}`);
  const children = await readdir(absolute, { withFileTypes: true });
  const output: string[] = [];
  for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
    const current = join(absolute, child.name);
    if (child.isSymbolicLink()) throw new Error(`CAPRE_SYMLINK_REJECTED:${relative(root, current)}`);
    if (child.isDirectory() || child.isFile()) output.push(...await walkSafe(root, current));
    else throw new Error(`CAPRE_UNSUPPORTED_FILE_TYPE:${relative(root, current)}`);
  }
  return output;
}

function classify(entry: string): CapreInventoryClassification {
  if (entry === "drizzle" || entry.startsWith("drizzle/")) return "DATABASE_SCHEMA";
  if (entry === "tests" || entry.startsWith("tests/") || entry === "fixtures" || entry.startsWith("fixtures/")) return "TEST_EVIDENCE";
  if (["app.config.ts", "package.json", "pnpm-lock.yaml", "tsconfig.json", ".npmrc", "metro.config.js", "tailwind.config.js", "theme.config.js"].includes(entry)) return "CONFIGURATION";
  return "SOURCE";
}

function secretPrerequisites(): CapreSecretPrerequisite[] {
  return REQUIRED_SECRETS.map((secretName) => ({ secretName, secretRequired: true, secretPresent: Boolean(process.env[secretName]), secretValue: "NEVER_EXPORTED" }));
}

async function capreEngineIdentities(): Promise<CapreEngineIdentity[]> {
  const [gmsh, calculix] = await Promise.all([inspectCaeEngine("GMSH"), inspectCaeEngine("CALCULIX")]);
  const toIdentity = (name: string, result: Awaited<ReturnType<typeof inspectCaeEngine>>): CapreEngineIdentity => result.status === "READY" && result.identity
    ? { name, status: "READY", version: result.identity.version, executablePath: result.identity.executablePath, environmentHash: result.identity.environmentHash, details: result.diagnostics.join("; ") }
    : { name, status: "UNAVAILABLE", details: result.diagnostics.join("; ") };
  return [
    { name: "OpenCascade", status: "NOT_PROBED", details: "CAPRE records no independent OpenCascade identity probe; runtime admission remains the authority." },
    toIdentity("Gmsh", gmsh),
    toIdentity("CalculiX", calculix),
    { name: "CAM", status: "NOT_PROBED", details: "CAPRE does not execute or replace the deterministic in-process CAM runtime." },
    { name: "External Text-to-CAD", status: "NOT_PROBED", details: "CAPRE does not download, execute, or bundle external runtime dependencies." },
    { name: "Node.js", status: "READY", version: process.version, details: `${process.platform}-${process.arch}` },
  ];
}

function healthGateNotRun(): CapreHealthGate {
  return {
    status: "NOT_RUN",
    checks: [
      { name: "TypeScript", status: "NOT_RUN", detail: "Health gate evidence must be produced by an explicit release-gate invocation." },
      { name: "Full serial regression", status: "NOT_RUN", detail: "CAPRE never infers regression success from application startup." },
    ],
    memoryRepeat: "NOT_PROVEN",
    memoryClassification: MEMORY_CLASSIFICATION,
  };
}

async function writeContent(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
}

async function inventoryFiles(root: string, stage: string, baseFiles: Array<{ relativePath: string; classification: CapreInventoryClassification }>): Promise<CapreManifestFile[]> {
  const all = [...baseFiles].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const paths = new Set<string>();
  const output: CapreManifestFile[] = [];
  for (const record of all) {
    if (paths.has(record.relativePath)) throw new Error(`CAPRE_DUPLICATE_LOGICAL_PATH:${record.relativePath}`);
    paths.add(record.relativePath);
    const target = safeJoin(stage, record.relativePath);
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`CAPRE_CAPTURE_MEMBER_INVALID:${record.relativePath}`);
    output.push({ relativePath: record.relativePath, sizeBytes: info.size, sha256: SHA256(await readFile(target)), fileType: manifestFileType(record.relativePath), classification: record.classification });
  }
  return output;
}

async function setReadOnly(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const current = join(root, entry.name);
    if (entry.isDirectory()) { await setReadOnly(current); await chmod(current, 0o555); }
    else if (entry.isFile()) await chmod(current, 0o444);
    else throw new Error("CAPRE_SEAL_UNSUPPORTED_MEMBER");
  }
  await chmod(root, 0o555);
}

export class CapreEngine {
  readonly projectRoot: string;
  readonly snapshotRoot: string;
  readonly now: () => Date;

  constructor(options: CapreEngineOptions = {}) {
    this.projectRoot = resolve(options.projectRoot ?? process.cwd());
    this.snapshotRoot = resolve(options.snapshotRoot ?? process.env.CAPRE_SNAPSHOT_ROOT ?? "/home/ubuntu/.capre-snapshots");
    this.now = options.now ?? (() => new Date());
    if (this.snapshotRoot === this.projectRoot || within(this.projectRoot, this.snapshotRoot)) throw new Error("CAPRE_SNAPSHOT_ROOT_MUST_BE_OUTSIDE_PROJECT");
  }

  private durability(): CapreDurabilityClass { return "LOCAL_EPHEMERAL"; }
  private snapshotPath(id: string) { assertCheckpointId(id); return safeJoin(this.snapshotRoot, id); }
  private async manifest(id: string): Promise<CapreCheckpointManifest> {
    const file = safeJoin(this.snapshotPath(id), "manifest.json");
    const parsed = JSON.parse(await readFile(file, "utf8")) as CapreCheckpointManifest;
    if (!parsed || parsed.checkpointId !== id || parsed.capreManifestVersion !== CAPRE_MANIFEST_VERSION) throw new Error("CAPRE_MANIFEST_IDENTITY_MISMATCH");
    return parsed;
  }

  async discover(): Promise<CapreDiscovery> {
    const git = await gitState(this.projectRoot);
    const durabilityClass = this.durability();
    const engines = await capreEngineIdentities();
    return {
      repositoryRoot: this.projectRoot,
      repositoryHead: git.head,
      branch: git.branch,
      worktreeState: git.worktreeState,
      trackedFileCount: git.trackedFileCount,
      untrackedFiles: git.untrackedFiles.filter((path) => !path.startsWith("test-results/")),
      deletedFiles: git.deletedFiles,
      submodules: git.submodules,
      durabilityClass,
      durableBackupAvailable: false,
      protectionStatus: PROTECTION_STATUS,
      durableStorageStatus: DURABLE_STORAGE_STATUS,
      resetSurvivalStatus: RESET_SURVIVAL_STATUS,
      authoritativeRecoveryStatus: AUTHORITATIVE_RECOVERY_STATUS,
      testedStateEqualsCommittedStateEqualsCheckpointState: STATE_IDENTITY_STATUS,
      durableStorageDetail: DURABLE_STORAGE_DETAIL,
      inventory: [
        { classification: "SOURCE", state: "CAPTURED", detail: "Allowlisted project source is eligible for local ephemeral capture." },
        { classification: "CONFIGURATION", state: "CAPTURED", detail: "Allowlisted public configuration and package manifests are eligible for local capture." },
        { classification: "DATABASE_SCHEMA", state: "CAPTURED", detail: "Schema and migrations are captured; live database rows are not copied." },
        { classification: "PERSISTENT_APPLICATION_DATA", state: "NOT_CAPTURED", detail: "No authorised consistent live-database export mechanism is configured." },
        { classification: "MANAGED_ARTIFACTS", state: "NOT_CAPTURED", detail: "No authorised artifact-store enumeration and byte-export mechanism is configured." },
        { classification: "ENGINE_IDENTITIES", state: "CAPTURED", detail: "Identities are recorded without bundling or executing restored engines." },
        { classification: "TEST_EVIDENCE", state: "INVENTORIED_ONLY", detail: "Test source is captured; prior run outputs are intentionally not treated as acceptance evidence." },
        { classification: "ACCEPTANCE_EVIDENCE", state: "INVENTORIED_ONLY", detail: "CAPRE does not infer acceptance from artifacts or startup." },
        { classification: "RECOVERY_METADATA", state: "CAPTURED", detail: "Manifest, secret prerequisites, and capture metadata are captured." },
      ],
      engineIdentities: engines,
      secretPrerequisites: secretPrerequisites(),
      limitations: ["DURABLE_STORAGE=UNAVAILABLE", "PROTECTION_STATUS=UNPROTECTED", "RESET_SURVIVAL=NOT_PROVEN", "Local snapshots are diagnostic copies only and are not protected backups.", "No database rows or managed artifact bytes are captured without an explicit authorised export path."],
    };
  }

  async healthGate(): Promise<CapreHealthGate> { return healthGateNotRun(); }

  async capture(args: { checkpointClass?: CapreCheckpointClass; parentCheckpointId?: string; requireCleanWorktree?: boolean } = {}): Promise<CapreCheckpointSummary> {
    const requestedClass = args.checkpointClass ?? "UNPROTECTED_LOCAL_SNAPSHOT";
    if (requestedClass !== "UNPROTECTED_LOCAL_SNAPSHOT") throw new Error("CAPRE_DURABLE_BACKUP_UNAVAILABLE");
    if (args.parentCheckpointId) assertCheckpointId(args.parentCheckpointId);
    const discovery = await this.discover();
    if (args.requireCleanWorktree !== false && discovery.worktreeState !== "CLEAN") throw new Error("CAPRE_DIRTY_WORKTREE_REJECTED");
    await mkdir(this.snapshotRoot, { recursive: true, mode: 0o700 });
    const lockPath = join(this.snapshotRoot, CAPRE_LOCK);
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    let ownsLock = false;
    const id = checkpointId(this.now);
    const temporary = join(this.snapshotRoot, `.${id}.capturing`);
    const finalPath = this.snapshotPath(id);
    try {
      try { lock = await open(lockPath, "wx", 0o600); ownsLock = true; } catch { throw new Error("CAPRE_CAPTURE_IN_PROGRESS"); }
      if (await exists(finalPath)) throw new Error("CAPRE_CHECKPOINT_OVERWRITE_REJECTED");
      await mkdir(temporary, { recursive: true, mode: 0o700 });
      const entries: Array<{ relativePath: string; classification: CapreInventoryClassification }> = [];
      for (const sourceEntry of SOURCE_ENTRIES) {
        const origin = safeJoin(this.projectRoot, sourceEntry);
        if (!(await exists(origin))) continue;
        for (const file of await walkSafe(this.projectRoot, origin)) {
          const projectRelative = relative(this.projectRoot, file).split(sep).join("/");
          if (FORBIDDEN_NAME.test(projectRelative)) throw new Error(`CAPRE_SECRET_PATH_REJECTED:${projectRelative}`);
          const logical = `${classify(projectRelative) === "CONFIGURATION" ? "configuration" : classify(projectRelative) === "DATABASE_SCHEMA" ? "database/schema" : "source"}/${projectRelative}`;
          const destination = safeJoin(temporary, logical);
          await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
          await cp(file, destination, { force: false, errorOnExist: true, dereference: false, preserveTimestamps: true });
          entries.push({ relativePath: logical, classification: classify(projectRelative) });
        }
      }
      const engines = await capreEngineIdentities();
      const secretMetadata = secretPrerequisites();
      const artifactManifest = { status: "NOT_CAPTURED", reason: "No authorised managed-artifact byte export is configured. CAPRE did not regenerate artifacts." };
      const databaseManifest = { status: "NOT_CAPTURED", reason: "Live database export is not available through a consistent, authorised mechanism. Schema files are captured separately." };
      const testManifest = { status: "INVENTORIED_ONLY", reason: "Test source is captured. No test output is accepted as health-gate evidence by capture." };
      const acceptanceManifest = { status: "INVENTORIED_ONLY", reason: "No acceptance report is promoted into a recovery assertion." };
      const metadata = { checkpointId: id, createdAt: stamp(this.now), sourceCommit: discovery.repositoryHead, durabilityClass: discovery.durabilityClass, uncommittedChangesIncluded: false };
      const metadataFiles: Array<{ logical: string; classification: CapreInventoryClassification; content: unknown }> = [
        { logical: "engines/engine-manifest.json", classification: "ENGINE_IDENTITIES", content: { engines } },
        { logical: "artifacts/artifact-manifest.json", classification: "MANAGED_ARTIFACTS", content: artifactManifest },
        { logical: "database/database-manifest.json", classification: "PERSISTENT_APPLICATION_DATA", content: databaseManifest },
        { logical: "tests/test-manifest.json", classification: "TEST_EVIDENCE", content: testManifest },
        { logical: "evidence/acceptance-manifest.json", classification: "ACCEPTANCE_EVIDENCE", content: acceptanceManifest },
        { logical: "recovery/secret-prerequisites.json", classification: "RECOVERY_METADATA", content: secretMetadata },
        { logical: "recovery/capture-metadata.json", classification: "RECOVERY_METADATA", content: metadata },
      ];
      for (const file of metadataFiles) {
        await writeContent(safeJoin(temporary, file.logical), `${stableJson(file.content)}\n`);
        entries.push({ relativePath: file.logical, classification: file.classification });
      }
      const files = await inventoryFiles(this.snapshotRoot, temporary, entries);
      const byClass = (classification: CapreInventoryClassification) => SHA256(stableJson(files.filter((file) => file.classification === classification)));
      const manifest: CapreCheckpointManifest = {
        capreManifestVersion: CAPRE_MANIFEST_VERSION,
        capreVersion: CAPRE_VERSION,
        checkpointId: id,
        checkpointClass: "UNPROTECTED_LOCAL_SNAPSHOT",
        createdAt: metadata.createdAt,
        parentCheckpointId: args.parentCheckpointId,
        durabilityClass: discovery.durabilityClass,
        protectionStatus: discovery.protectionStatus,
        durableStorageStatus: discovery.durableStorageStatus,
        resetSurvivalStatus: discovery.resetSurvivalStatus,
        authoritativeRecoveryStatus: discovery.authoritativeRecoveryStatus,
        testedStateEqualsCommittedStateEqualsCheckpointState: discovery.testedStateEqualsCommittedStateEqualsCheckpointState,
        immutableStatus: "SEALED_READ_ONLY",
        repositoryIdentity: this.projectRoot,
        repositoryHead: discovery.repositoryHead,
        branch: discovery.branch,
        worktreeState: discovery.worktreeState,
        uncommittedChangesIncluded: false,
        sourceManifestSha256: byClass("SOURCE"),
        artifactManifestSha256: SHA256(stableJson(artifactManifest)),
        databaseManifestSha256: SHA256(stableJson(databaseManifest)),
        engineManifestSha256: SHA256(stableJson({ engines })),
        testManifestSha256: SHA256(stableJson(testManifest)),
        completeManifestSha256: "",
        healthGate: healthGateNotRun(),
        restoreVerificationStatus: "NOT_RUN",
        secretPrerequisites: secretMetadata,
        files,
        exclusions: [".env and secret-bearing files", "node_modules", ".git", "dist", ".expo", "test-results", "live database rows", "managed artifact bytes", "external runtime payloads"],
        recoveryLimitations: ["DURABLE_STORAGE=UNAVAILABLE", "PROTECTION_STATUS=UNPROTECTED", "RESET_SURVIVAL=NOT_PROVEN", "AUTHORITATIVE_RECOVERY=UNAVAILABLE", "DATABASE_RECOVERY_NOT_AVAILABLE", "ARTIFACT_RECOVERY_NOT_AVAILABLE", "LIVE_PROMOTION_BLOCKED"],
      };
      manifest.completeManifestSha256 = manifestDigest(manifest);
      await writeContent(safeJoin(temporary, "manifest.json"), `${stableJson(manifest)}\n`);
      await writeContent(safeJoin(temporary, "manifest.sha256"), `${manifest.completeManifestSha256}  manifest.json\n`);
      const verification = await this.verifyAt(temporary, id, false);
      if (verification.status !== "PASS") throw new Error(`CAPRE_CAPTURE_VERIFICATION_FAILED:${verification.failures.join(";")}`);
      await setReadOnly(temporary);
      await rename(temporary, finalPath);
      return this.inspect(id);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    } finally {
      await lock?.close().catch(() => undefined);
      if (ownsLock) await rm(lockPath, { force: true }).catch(() => undefined);
    }
  }

  private async verifyAt(root: string, id: string, checkReadOnly: boolean): Promise<CapreVerificationResult> {
    const failures: string[] = [];
    let manifest: CapreCheckpointManifest | undefined;
    try { manifest = JSON.parse(await readFile(safeJoin(root, "manifest.json"), "utf8")) as CapreCheckpointManifest; } catch { return { checkpointId: id, status: "FAIL", verifiedAt: stamp(this.now), failures: ["manifest is missing or corrupted"], verifiedFileCount: 0 }; }
    if (manifest.checkpointId !== id || manifest.capreManifestVersion !== CAPRE_MANIFEST_VERSION) failures.push("checkpoint metadata mismatch");
    const digest = manifestDigest(manifest);
    if (manifest.completeManifestSha256 !== digest) failures.push("manifest SHA-256 mismatch");
    const printedDigest = await readFile(safeJoin(root, "manifest.sha256"), "utf8").catch(() => "");
    if (printedDigest.trim() !== `${manifest.completeManifestSha256}  manifest.json`) failures.push("manifest checksum record mismatch");
    const allowed = new Set(["manifest.json", "manifest.sha256", ...manifest.files.map((file) => file.relativePath)]);
    const actual = await walkSafe(root, root).catch((error: Error) => { failures.push(error.message); return []; });
    for (const file of actual) {
      const rel = relative(root, file).split(sep).join("/");
      if (!allowed.has(rel)) failures.push(`unexpected checkpoint member:${rel}`);
    }
    for (const file of manifest.files) {
      try {
        const target = safeJoin(root, file.relativePath);
        const details = await stat(target);
        if (!details.isFile() || details.size !== file.sizeBytes) failures.push(`file size mismatch:${file.relativePath}`);
        if (SHA256(await readFile(target)) !== file.sha256) failures.push(`file hash mismatch:${file.relativePath}`);
        if (checkReadOnly && (details.mode & 0o222) !== 0) failures.push(`sealed file writable:${file.relativePath}`);
      } catch { failures.push(`file missing:${file.relativePath}`); }
    }
    return { checkpointId: id, status: failures.length ? "FAIL" : "PASS", verifiedAt: stamp(this.now), failures, verifiedFileCount: manifest.files.length, manifestSha256: manifest.completeManifestSha256 };
  }

  async verify(id: string): Promise<CapreVerificationResult> { return this.verifyAt(this.snapshotPath(id), id, true); }

  async list(): Promise<CapreCheckpointSummary[]> {
    if (!(await exists(this.snapshotRoot))) return [];
    const directories = await readdir(this.snapshotRoot, { withFileTypes: true });
    const output: CapreCheckpointSummary[] = [];
    for (const entry of directories) {
      if (!entry.isDirectory() || !SAFE_CHECKPOINT_ID.test(entry.name)) continue;
      try { output.push(await this.inspect(entry.name)); } catch { /* corrupted entries stay undiscoverable until explicitly inspected */ }
    }
    return output.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async inspect(id: string): Promise<CapreCheckpointSummary> {
    const manifest = await this.manifest(id);
    return {
      checkpointId: manifest.checkpointId,
      checkpointClass: manifest.checkpointClass,
      createdAt: manifest.createdAt,
      parentCheckpointId: manifest.parentCheckpointId,
      durabilityClass: manifest.durabilityClass,
      protectionStatus: manifest.protectionStatus,
      durableStorageStatus: manifest.durableStorageStatus,
      resetSurvivalStatus: manifest.resetSurvivalStatus,
      authoritativeRecoveryStatus: manifest.authoritativeRecoveryStatus,
      testedStateEqualsCommittedStateEqualsCheckpointState: manifest.testedStateEqualsCommittedStateEqualsCheckpointState,
      repositoryHead: manifest.repositoryHead,
      branch: manifest.branch,
      worktreeState: manifest.worktreeState,
      completeManifestSha256: manifest.completeManifestSha256,
      immutableStatus: manifest.immutableStatus,
      restoreVerificationStatus: manifest.restoreVerificationStatus,
    };
  }

  /** Returns the complete non-secret manifest for read-only operational inspection. */
  async inspectManifest(id: string): Promise<CapreCheckpointManifest> { return this.manifest(id); }

  /** Capture performs the only physical sealing step; this verifies the sealed checkpoint before returning it. */
  async seal(id: string): Promise<CapreCheckpointSummary> {
    const integrity = await this.verify(id);
    if (integrity.status !== "PASS") throw new Error("CAPRE_SEAL_BLOCKED_INTEGRITY_FAILURE");
    return this.inspect(id);
  }

  async restoreToStaging(id: string): Promise<CapreStagingRestore> {
    const integrity = await this.verify(id);
    if (integrity.status !== "PASS") throw new Error("CAPRE_RESTORE_BLOCKED_INTEGRITY_FAILURE");
    const manifest = await this.manifest(id);
    const stagingRoot = resolve(this.snapshotRoot, "staging");
    await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
    const stagingId = `STAGING-${crypto.randomUUID()}`;
    const stagingPath = safeJoin(stagingRoot, stagingId);
    await mkdir(stagingPath, { recursive: true, mode: 0o700 });
    try {
      for (const file of manifest.files) {
        if (!["SOURCE", "CONFIGURATION", "DATABASE_SCHEMA", "ENGINE_IDENTITIES", "TEST_EVIDENCE", "ACCEPTANCE_EVIDENCE", "RECOVERY_METADATA"].includes(file.classification)) continue;
        const origin = safeJoin(this.snapshotPath(id), file.relativePath);
        const destination = safeJoin(stagingPath, file.relativePath);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await cp(origin, destination, { force: false, errorOnExist: true, dereference: false, preserveTimestamps: true });
      }
      await writeContent(safeJoin(stagingPath, "recovery/staging-metadata.json"), `${stableJson({ checkpointId: id, stagingId, restoredAt: stamp(this.now), promotion: "BLOCKED" })}\n`);
      return { checkpointId: id, stagingId, stagingPath, status: "STAGING_RESTORED", sourceManifestSha256: manifest.sourceManifestSha256, limitations: ["Database rows were not restored.", "Managed artifacts were not restored.", "Live promotion is blocked."] };
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true });
      throw error;
    }
  }

  async verifyRestore(restore: Pick<CapreStagingRestore, "checkpointId" | "stagingId" | "stagingPath">): Promise<CapreRestoreVerification> {
    const failures: string[] = [];
    const checks: CapreRestoreVerification["checks"] = [];
    const manifest = await this.manifest(restore.checkpointId);
    const expected = manifest.files.filter((file) => !["PERSISTENT_APPLICATION_DATA", "MANAGED_ARTIFACTS"].includes(file.classification));
    for (const file of expected) {
      try {
        const copy = safeJoin(restore.stagingPath, file.relativePath);
        const copyInfo = await stat(copy);
        const valid = copyInfo.isFile() && copyInfo.size === file.sizeBytes && SHA256(await readFile(copy)) === file.sha256;
        if (!valid) failures.push(`staged hash mismatch:${file.relativePath}`);
      } catch { failures.push(`staged file missing:${file.relativePath}`); }
    }
    checks.push({ name: "Source and metadata hashes", status: failures.length ? "FAIL" : "PASS", detail: failures.length ? failures.join("; ") : "Captured source and metadata match the checkpoint manifest." });
    checks.push({ name: "Database consistency", status: "BLOCKED", detail: "Live database rows are not present in the local recovery snapshot." });
    checks.push({ name: "Managed artifact recovery", status: "BLOCKED", detail: "Managed artifact bytes are not present in the local recovery snapshot." });
    checks.push({ name: "Live promotion", status: "BLOCKED", detail: "CAPRE never promotes a partial staging restore over the live project." });
    return { checkpointId: restore.checkpointId, stagingId: restore.stagingId, status: failures.length ? "FAIL" : "BLOCKED", checks, failures };
  }

  async promoteRestore(): Promise<never> { throw new Error("CAPRE_PROMOTION_BLOCKED_PARTIAL_RESTORE"); }
  async rollback(): Promise<never> { throw new Error("CAPRE_ROLLBACK_BLOCKED_NO_VERIFIED_DURABLE_CHECKPOINT"); }

  async recoveryDrill(): Promise<CapreRecoveryDrill> {
    let summary: CapreCheckpointSummary;
    try { summary = await this.capture(); } catch (error) { return { checkpointId: "NOT_CREATED", capture: "FAIL", integrity: "NOT_RUN", restore: "NOT_RUN", verification: "NOT_RUN", status: "FAIL", reason: error instanceof Error ? error.message : "capture failed" }; }
    const integrity = await this.verify(summary.checkpointId);
    if (integrity.status !== "PASS") return { checkpointId: summary.checkpointId, capture: "PASS", integrity: "FAIL", restore: "NOT_RUN", verification: "NOT_RUN", status: "FAIL", reason: integrity.failures.join("; ") };
    const restore = await this.restoreToStaging(summary.checkpointId);
    const verification = await this.verifyRestore(restore);
    return { checkpointId: summary.checkpointId, capture: "PASS", integrity: "PASS", restore: restore.status, verification: verification.status, status: "BLOCKED", reason: "The staging restore correctly remains blocked from PASS because database and managed artifact recovery are unavailable." };
  }
}

export const capre = new CapreEngine({ projectRoot: process.cwd() });

/** Project-scoped snapshot roots prevent one authorised project from listing another project's recovery metadata. */
export function capreForProject(projectId: string): CapreEngine {
  if (!projectId || projectId.length > 256) throw new Error("CAPRE_INVALID_PROJECT_SCOPE");
  const root = resolve(process.env.CAPRE_SNAPSHOT_ROOT ?? "/home/ubuntu/.capre-snapshots", "projects", SHA256(projectId).slice(0, 32));
  return new CapreEngine({ projectRoot: process.cwd(), snapshotRoot: root });
}
