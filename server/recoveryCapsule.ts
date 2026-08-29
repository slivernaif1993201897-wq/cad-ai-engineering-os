import crypto from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  RECOVERY_CAPSULE_VERSION,
  type RecoveryCapsuleDomain,
  type RecoveryCapsuleExport,
  type RecoveryCapsuleManifest,
  type RecoveryCapsulePayload,
  type RecoveryCapsuleRestore,
  type RecoveryCapsuleVerification,
} from "../shared/recoveryCapsule";
import { CapreEngine } from "./capre";

const execFile = promisify(execFileCallback);
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const MEMORY_CLASSIFICATION = "ENVIRONMENT-BOUNDED / PROCESS_LOCAL_NATIVE_WASM_RETENTION_SUSPECTED" as const;
const CAPSULE_HEADER = "<!-- CAD-AGENT FULL RECOVERY CAPSULE: machine payloads follow; do not edit -->";
const SECRET_PATH = /(^|\/)(\.env(?:\..*)?|.*\.(?:pem|key|p12)|id_rsa(?:\.pub)?|credentials(?:\.json)?|secrets?(?:\.json)?)(?:$|\/)/i;
const SECRET_CONTENT = /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b|\bAKIA[0-9A-Z]{16}\b/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CAPSULE_BYTES = 80 * 1024 * 1024;

type CapsuleOptions = { projectRoot?: string; outputDirectory?: string; now?: () => Date };
type ParsedPayload = RecoveryCapsulePayload & { content: Buffer };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}

function stableJson(value: unknown): string { return JSON.stringify(canonicalize(value)); }
function capsuleId(now: () => Date): string { return `CAPSULE-${now().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`; }
function safeRelative(path: string): string {
  if (!path || path.includes("\0") || isAbsolute(path) || path.split(/[\\/]/).includes("..")) throw new Error("CAPSULE_PATH_REJECTED");
  return path.split(sep).join("/");
}
function safeJoin(root: string, path: string): string {
  const target = resolve(root, safeRelative(path));
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("CAPSULE_PATH_REJECTED");
  return target;
}
function domainFor(path: string): RecoveryCapsuleDomain {
  if (path.startsWith("drizzle/")) return "CONFIGURATION";
  if (path.startsWith("tests/") || path.startsWith("fixtures/")) return "TEST_EVIDENCE";
  if (["package.json", "pnpm-lock.yaml", "app.config.ts", "tsconfig.json", "metro.config.js", "tailwind.config.js", "theme.config.js", ".npmrc", ".gitignore"].includes(path)) return "CONFIGURATION";
  return "SOURCE";
}
function domainHash(payloads: RecoveryCapsulePayload[], domain: RecoveryCapsuleDomain): string { return sha256(stableJson(payloads.filter((payload) => payload.domain === domain))); }
function manifestDigest(manifest: RecoveryCapsuleManifest): string { return sha256(stableJson({ ...manifest, capsuleContentSha256: "", completePayloadManifestSha256: "" })); }

async function git(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 });
  return stdout.toString();
}

function render(manifest: RecoveryCapsuleManifest, payloads: ParsedPayload[]): string {
  const guide = [
    CAPSULE_HEADER,
    "# CAD-AGENT FULL RECOVERY CAPSULE",
    "",
    "## Purpose and recovery boundary",
    "This capsule carries byte-preserving payloads only for the included records below. It is a user-downloadable export from an ephemeral environment, not a protected backup until copied outside the environment. Database rows and managed artifact bytes are EXTERNAL_REQUIRED because no authorized consistent export/import contract is configured. Do not restore over a live project.",
    "",
    "## Recovery procedure",
    "1. Verify the capsule with the CAPRE verifier before extraction. 2. Decode only payloads marked INCLUDED into an isolated directory. 3. Supply every listed secret externally; no secret values are included. 4. Restore the database and managed artifacts only with the separately authorized export procedures identified in the manifest. 5. Install external engines from their recorded identity/instructions. 6. Run dependency installation, TypeScript, governance guards, targeted CAD checks, then a serial regression when the external prerequisites are available.",
    "",
    "## Explicit classification",
    `- SELF_CONTAINED: ${manifest.selfContainedCompleteness === "COMPLETE" ? "YES" : "NO"}`,
    `- SOURCE_INCLUDED: ${manifest.sourceIncluded ? "YES" : "NO"}`,
    `- DATABASE_INCLUDED: ${manifest.databaseIncluded ? "YES" : "NO"}`,
    `- MANAGED_ARTIFACTS_INCLUDED: ${manifest.managedArtifactsIncluded ? "YES" : "NO"}`,
    `- ENGINE_IDENTITIES_INCLUDED: ${manifest.engineManifestIncluded ? "YES" : "NO"}`,
    `- GIT_STATE_INCLUDED: ${manifest.gitStateIncluded ? "YES" : "NO"}`,
    `- TEST_EVIDENCE_INCLUDED: ${manifest.testEvidenceIncluded ? "YES" : "NO"}`,
    "- SECRETS_INCLUDED: NO",
    "- MEMORY_REPEAT: NOT_PROVEN",
    `- MEMORY_CLASSIFICATION: ${MEMORY_CLASSIFICATION}`,
    "",
    "## Machine-readable canonical manifest",
    "CAPSULE_MANIFEST_BEGIN",
    Buffer.from(stableJson(manifest), "utf8").toString("base64"),
    "CAPSULE_MANIFEST_END",
  ];
  const blocks = payloads.map((payload) => [
    "BINARY_PAYLOAD_BEGIN",
    `PATH=${payload.logicalPath}`,
    `DOMAIN=${payload.domain}`,
    `SIZE=${payload.sizeBytes}`,
    `SHA256=${payload.sha256}`,
    "ENCODING=BASE64",
    payload.content.toString("base64"),
    "BINARY_PAYLOAD_END",
  ].join("\n"));
  return `${[...guide, ...blocks].join("\n\n")}\n`;
}

function parseCapsule(input: Buffer): { manifest: RecoveryCapsuleManifest; payloads: ParsedPayload[] } {
  if (input.length > MAX_CAPSULE_BYTES) throw new Error("CAPSULE_OVERSIZED");
  const text = input.toString("utf8");
  if (!text.startsWith(CAPSULE_HEADER)) throw new Error("CAPSULE_HEADER_INVALID");
  const match = text.match(/CAPSULE_MANIFEST_BEGIN\s+([A-Za-z0-9+/=]+)\s+CAPSULE_MANIFEST_END/);
  if (!match) throw new Error("CAPSULE_MANIFEST_MISSING");
  let manifest: RecoveryCapsuleManifest;
  try { manifest = JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as RecoveryCapsuleManifest; } catch { throw new Error("CAPSULE_MANIFEST_INVALID"); }
  if (manifest.capsuleVersion !== RECOVERY_CAPSULE_VERSION || !Array.isArray(manifest.payloads)) throw new Error("CAPSULE_MANIFEST_VERSION_INVALID");
  const matches = [...text.matchAll(/BINARY_PAYLOAD_BEGIN\nPATH=([^\n]+)\nDOMAIN=([^\n]+)\nSIZE=(\d+)\nSHA256=([a-f0-9]{64})\nENCODING=BASE64\n([A-Za-z0-9+/=]*)\nBINARY_PAYLOAD_END/g)];
  const paths = new Set<string>();
  const payloads = matches.map((item) => {
    const logicalPath = safeRelative(item[1]);
    if (paths.has(logicalPath)) throw new Error("CAPSULE_DUPLICATE_PAYLOAD_PATH");
    paths.add(logicalPath);
    const content = Buffer.from(item[5], "base64");
    if (content.length > MAX_FILE_BYTES || content.length !== Number(item[3]) || sha256(content) !== item[4]) throw new Error("CAPSULE_PAYLOAD_INTEGRITY_INVALID");
    return { logicalPath, domain: item[2] as RecoveryCapsuleDomain, status: "INCLUDED" as const, encoding: "BASE64" as const, sizeBytes: Number(item[3]), sha256: item[4], detail: "Embedded byte-preserving payload.", content };
  });
  return { manifest, payloads };
}

export class RecoveryCapsuleEngine {
  readonly projectRoot: string;
  readonly outputDirectory: string;
  readonly now: () => Date;

  constructor(options: CapsuleOptions = {}) {
    this.projectRoot = resolve(options.projectRoot ?? process.cwd());
    this.outputDirectory = resolve(options.outputDirectory ?? "/home/ubuntu/Downloads");
    this.now = options.now ?? (() => new Date());
  }

  async exportFullMarkdown(): Promise<RecoveryCapsuleExport> {
    const [head, branch, status, trackedOutput, log] = await Promise.all([
      git(this.projectRoot, ["rev-parse", "HEAD"]), git(this.projectRoot, ["branch", "--show-current"]), git(this.projectRoot, ["status", "--porcelain=v1"]), git(this.projectRoot, ["ls-files", "-z"]), git(this.projectRoot, ["log", "--format=%H %ct %s", "-n", "100"]),
    ]);
    if (status.trim()) throw new Error("CAPSULE_DIRTY_WORKTREE_REJECTED");
    const files = trackedOutput.split("\0").filter(Boolean).map(safeRelative).sort((a, b) => a.localeCompare(b));
    const payloads: ParsedPayload[] = [];
    for (const logicalPath of files) {
      if (SECRET_PATH.test(logicalPath)) throw new Error(`CAPSULE_SECRET_PATH_REJECTED:${logicalPath}`);
      const content = await readFile(safeJoin(this.projectRoot, logicalPath));
      if (content.length > MAX_FILE_BYTES) throw new Error(`CAPSULE_PAYLOAD_TOO_LARGE:${logicalPath}`);
      if (SECRET_CONTENT.test(content.toString("utf8"))) throw new Error(`CAPSULE_SECRET_CONTENT_REJECTED:${logicalPath}`);
      payloads.push({ logicalPath: `source/${logicalPath}`, domain: domainFor(logicalPath), status: "INCLUDED", encoding: "BASE64", sizeBytes: content.length, sha256: sha256(content), detail: "Tracked repository file preserved byte-for-byte.", content });
    }
    const capreDiscovery = await new CapreEngine({ projectRoot: this.projectRoot }).discover();
    const gitMetadata = Buffer.from(stableJson({ head: head.trim(), branch: branch.trim() || "DETACHED", history: log.trim().split("\n").filter(Boolean), submodules: capreDiscovery.submodules, uncommittedState: "NONE" }), "utf8");
    const engineMetadata = Buffer.from(stableJson({ engines: capreDiscovery.engineIdentities, runtime: { node: process.version, platform: process.platform, arch: process.arch }, externalEnginePayloads: "EXTERNAL_REQUIRED" }), "utf8");
    payloads.push({ logicalPath: "metadata/git-state.json", domain: "GIT", status: "INCLUDED", encoding: "BASE64", sizeBytes: gitMetadata.length, sha256: sha256(gitMetadata), detail: "Git HEAD, branch, bounded history, and submodule state; no Git bundle is embedded because its historical content is not independently secret-audited.", content: gitMetadata });
    payloads.push({ logicalPath: "metadata/engine-identities.json", domain: "ENGINE", status: "INCLUDED", encoding: "BASE64", sizeBytes: engineMetadata.length, sha256: sha256(engineMetadata), detail: "Runtime identities only; arbitrary system binaries and external runtime payloads are not embedded.", content: engineMetadata });
    const excluded: RecoveryCapsulePayload[] = [
      { logicalPath: "database/authoritative-logical-dump", domain: "DATABASE", status: "EXTERNAL_REQUIRED", encoding: "NONE", sizeBytes: 0, sha256: "", detail: "No CAPRE-authorised consistent live database dump/import mechanism is configured. Database recovery is unavailable in this capsule." },
      { logicalPath: "managed-artifacts/authoritative-byte-export", domain: "MANAGED_ARTIFACTS", status: "EXTERNAL_REQUIRED", encoding: "NONE", sizeBytes: 0, sha256: "", detail: "No CAPRE-authorised managed-artifact enumerator and byte-export/import mechanism is configured. Artifact recovery is unavailable in this capsule." },
      { logicalPath: "secrets/runtime-and-service-credentials", domain: "CONFIGURATION", status: "EXCLUDED_SECRET", encoding: "NONE", sizeBytes: 0, sha256: "", detail: "Secret names remain reconstruction prerequisites; values are never exported." },
    ];
    const all = [...payloads.map(({ content: _content, ...payload }) => payload), ...excluded].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
    const manifest: RecoveryCapsuleManifest = {
      capsuleVersion: RECOVERY_CAPSULE_VERSION,
      capsuleId: capsuleId(this.now),
      createdAt: this.now().toISOString(),
      repositoryHead: head.trim(),
      branch: branch.trim() || "DETACHED",
      worktreeState: "CLEAN",
      sourceManifestSha256: domainHash(all, "SOURCE"),
      databaseManifestSha256: domainHash(all, "DATABASE"),
      artifactManifestSha256: domainHash(all, "MANAGED_ARTIFACTS"),
      engineManifestSha256: domainHash(all, "ENGINE"),
      configManifestSha256: domainHash(all, "CONFIGURATION"),
      testManifestSha256: domainHash(all, "TEST_EVIDENCE"),
      completePayloadManifestSha256: "",
      capsuleContentSha256: "",
      selfContainedCompleteness: "PARTIAL",
      sourceIncluded: true,
      databaseIncluded: false,
      managedArtifactsIncluded: false,
      engineManifestIncluded: true,
      gitStateIncluded: true,
      testEvidenceIncluded: all.some((payload) => payload.domain === "TEST_EVIDENCE" && payload.status === "INCLUDED"),
      secretsIncluded: false,
      memoryRepeat: "NOT_PROVEN",
      memoryClassification: MEMORY_CLASSIFICATION,
      externalPrerequisites: ["Operator-provided secret values listed by the application configuration.", "An authorised consistent database export/import procedure.", "An authorised managed-artifact enumerator and byte export/import procedure.", "Engine runtimes recorded in metadata/engine-identities.json."],
      payloads: all,
    };
    manifest.completePayloadManifestSha256 = manifestDigest(manifest);
    const draft = render(manifest, payloads);
    manifest.capsuleContentSha256 = sha256(draft);
    const output = Buffer.from(render(manifest, payloads), "utf8");
    if (output.length > MAX_CAPSULE_BYTES) throw new Error("CAPSULE_OUTPUT_TOO_LARGE");
    await mkdir(this.outputDirectory, { recursive: true, mode: 0o700 });
    const target = join(this.outputDirectory, "CAD-AGENT-FULL-RECOVERY-CAPSULE.md");
    try { await stat(target); throw new Error("CAPSULE_OVERWRITE_REJECTED"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await writeFile(target, output, { mode: 0o600, flag: "wx" });
    const verification = await this.verifyCapsule(target);
    if (verification.status !== "PASS") { await rm(target, { force: true }); throw new Error(`CAPSULE_VERIFICATION_FAILED:${verification.failures.join(";")}`); }
    return { capsulePath: target, capsuleSizeBytes: output.length, capsuleSha256: sha256(output), manifest };
  }

  async verifyCapsule(capsulePath: string): Promise<RecoveryCapsuleVerification> {
    const failures: string[] = [];
    let parsed: ReturnType<typeof parseCapsule>;
    let bytes: Buffer;
    try { bytes = await readFile(capsulePath); parsed = parseCapsule(bytes); } catch (error) { return { status: "FAIL", payloadCount: 0, failures: [error instanceof Error ? error.message : "CAPSULE_PARSE_FAILED"] }; }
    const { manifest, payloads } = parsed;
    const payloadIdentity = (payload: RecoveryCapsulePayload) => ({ logicalPath: payload.logicalPath, domain: payload.domain, status: payload.status, encoding: payload.encoding, sizeBytes: payload.sizeBytes, sha256: payload.sha256 });
    const declared = manifest.payloads.filter((payload) => payload.status === "INCLUDED").map(payloadIdentity).sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
    const actual = payloads.map(({ content: _content, ...payload }) => payloadIdentity(payload)).sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
    if (stableJson(declared) !== stableJson(actual)) failures.push("CAPSULE_PAYLOAD_MANIFEST_MISMATCH");
    if (manifest.completePayloadManifestSha256 !== manifestDigest(manifest)) failures.push("CAPSULE_MANIFEST_HASH_MISMATCH");
    const canonical = { ...manifest, capsuleContentSha256: "" };
    if (manifest.capsuleContentSha256 !== sha256(render(canonical, payloads))) failures.push("CAPSULE_CONTENT_HASH_MISMATCH");
    if (manifest.selfContainedCompleteness !== "PARTIAL" || manifest.databaseIncluded || manifest.managedArtifactsIncluded || manifest.secretsIncluded) failures.push("CAPSULE_COMPLETENESS_CLAIM_INVALID");
    if (bytes.length > MAX_CAPSULE_BYTES) failures.push("CAPSULE_OVERSIZED");
    return { status: failures.length ? "FAIL" : "PASS", capsuleContentSha256: manifest.capsuleContentSha256, payloadCount: payloads.length, failures };
  }

  async restoreToStaging(capsulePath: string): Promise<RecoveryCapsuleRestore> {
    const verification = await this.verifyCapsule(capsulePath);
    if (verification.status !== "PASS") throw new Error("CAPSULE_RESTORE_BLOCKED_INTEGRITY_FAILURE");
    const { manifest, payloads } = parseCapsule(await readFile(capsulePath));
    const stagingPath = await mkdtemp(join(tmpdir(), "cad-agent-recovery-capsule-"));
    try {
      for (const payload of payloads) {
        const destination = safeJoin(stagingPath, payload.logicalPath);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await writeFile(destination, payload.content, { flag: "wx", mode: 0o600 });
      }
      const restored = parseCapsule(await readFile(capsulePath));
      const sourceRestore = restored.payloads.filter((payload) => payload.domain === "SOURCE" || payload.domain === "CONFIGURATION").every((payload) => sha256(payload.content) === payload.sha256) ? "PASS" : "FAIL";
      return { stagingPath, sourceRestore, databaseRestore: "BLOCKED", artifactRestore: "BLOCKED", manifestRestore: restored.manifest.completePayloadManifestSha256 === manifest.completePayloadManifestSha256 ? "PASS" : "FAIL", hashRestore: verification.status, status: sourceRestore === "PASS" ? "PARTIAL" : "FAIL", limitations: ["Database restoration is blocked because the capsule declares DATABASE as EXTERNAL_REQUIRED.", "Managed artifact restoration is blocked because the capsule declares MANAGED_ARTIFACTS as EXTERNAL_REQUIRED.", "Staging output must not be promoted over the live project."] };
    } catch (error) { await rm(stagingPath, { recursive: true, force: true }); throw error; }
  }
}

export const recoveryCapsule = new RecoveryCapsuleEngine({ projectRoot: process.cwd() });
