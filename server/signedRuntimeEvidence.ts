import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SIGNED_RUNTIME_EVIDENCE_VERSION = "runtime-evidence/v1";
export const SIGNED_RUNTIME_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const RUNTIME_EVIDENCE_VALIDATOR_VERSION = "hmac-sha256/v1";

export type RuntimeEvidenceBinding = {
  projectId: string;
  operationId: string;
  runtimeAdmissionId: string;
  artifactIdentity: string;
  engineIdentity: string;
  provenanceIdentity: string;
  lineageIdentity: string;
};

export type RuntimeEvidencePayload = {
  version: typeof SIGNED_RUNTIME_EVIDENCE_VERSION;
  evidenceId: string;
  issuedAt: string;
  expiresAt: string;
  environmentIdentity: string;
  commit: string;
  workflowRun: string;
  binding: RuntimeEvidenceBinding;
  artifactHashes: Record<string, string>;
  evidenceHash: string;
  resultHash: string;
};

export type SignedRuntimeEvidenceEnvelope = { payload: RuntimeEvidencePayload; signature: string };
export type RuntimeEvidenceTrust = { environmentIdentity: string; commit: string; workflowRun: string };
export type RuntimeEvidenceVerification =
  | { status: "VERIFIED"; evidence: RuntimeEvidencePayload }
  | { status: "BLOCKED"; rejectionCode: string };

const replayCache = new Map<string, number>();

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function configuredKey(): string | null {
  const key = process.env.RUNTIME_EVIDENCE_HMAC_KEY;
  return key && /^[a-f0-9]{64,}$/i.test(key) ? key : null;
}

/** Returns non-secret validation metadata only; the value and a derived fingerprint are never exposed. */
export function runtimeEvidenceKeyDiagnostics(): {
  SECRET_PRESENT: boolean;
  SECRET_LENGTH: number;
  HEX_FORMAT_VALID: boolean;
  CANONICAL_FORMAT_VALID: boolean;
  SECRET_SOURCE: "GITHUB_ACTIONS_ENV" | "PROCESS_ENV";
  VALIDATOR_VERSION: typeof RUNTIME_EVIDENCE_VALIDATOR_VERSION;
} {
  const raw = process.env.RUNTIME_EVIDENCE_HMAC_KEY ?? "";
  return {
    SECRET_PRESENT: raw.length > 0,
    SECRET_LENGTH: raw.length,
    HEX_FORMAT_VALID: /^[a-f0-9]+$/i.test(raw),
    CANONICAL_FORMAT_VALID: /^[a-f0-9]{64,}$/i.test(raw),
    SECRET_SOURCE: process.env.GITHUB_ACTIONS === "true" ? "GITHUB_ACTIONS_ENV" : "PROCESS_ENV",
    VALIDATOR_VERSION: RUNTIME_EVIDENCE_VALIDATOR_VERSION,
  };
}

function expectedEvidenceHash(payload: Omit<RuntimeEvidencePayload, "evidenceHash">): string {
  return hash(canonicalize(payload));
}

function signature(payload: RuntimeEvidencePayload, key: string): string {
  return createHmac("sha256", key).update(canonicalize(payload), "utf8").digest("hex");
}

function hasBinding(binding: RuntimeEvidenceBinding | undefined): binding is RuntimeEvidenceBinding {
  return Boolean(
    binding
    && Object.values(binding).every((value) => typeof value === "string" && value.length > 0 && value.length <= 256),
  );
}

function purgeExpiredReplayEntries(now: number): void {
  for (const [key, expiresAt] of replayCache) if (expiresAt <= now) replayCache.delete(key);
}

/** Signs only through the explicit server runtime configuration. It never accepts a caller-provided key. */
export function signRuntimeEvidence(payload: Omit<RuntimeEvidencePayload, "evidenceHash">): SignedRuntimeEvidenceEnvelope {
  const key = configuredKey();
  if (!key) throw new Error("RUNTIME_EVIDENCE_KEY_UNAVAILABLE");
  if (!hasBinding(payload.binding)) throw new Error("RUNTIME_EVIDENCE_BINDING_INCOMPLETE");
  const signedPayload: RuntimeEvidencePayload = { ...payload, evidenceHash: expectedEvidenceHash(payload) };
  return { payload: signedPayload, signature: signature(signedPayload, key) };
}

export function verifyRuntimeEvidence(
  envelope: SignedRuntimeEvidenceEnvelope | null | undefined,
  trust: RuntimeEvidenceTrust,
  options: { now?: Date; enforceReplayProtection?: boolean } = {},
): RuntimeEvidenceVerification {
  if (!envelope?.payload) return { status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" };
  const key = configuredKey();
  if (!key) return { status: "BLOCKED", rejectionCode: "UNTRUSTED_SIGNING_KEY" };
  const { payload, signature: receivedSignature } = envelope;
  if (payload.version !== SIGNED_RUNTIME_EVIDENCE_VERSION) return { status: "BLOCKED", rejectionCode: "UNKNOWN_EVIDENCE_VERSION" };
  if (!isHash(receivedSignature) || !isHash(payload.evidenceHash) || !payload.evidenceId || !payload.commit || !payload.workflowRun || !payload.environmentIdentity || !hasBinding(payload.binding)) return { status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SCHEMA" };
  if (Object.entries(payload.artifactHashes).some(([field, value]) => field === "jobId" ? typeof value !== "string" || value.length === 0 : !isHash(value))) return { status: "BLOCKED", rejectionCode: "INVALID_ARTIFACT_HASH" };
  const expectedSignature = signature(payload, key);
  if (!timingSafeEqual(Buffer.from(receivedSignature, "hex"), Buffer.from(expectedSignature, "hex"))) return { status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" };
  const { evidenceHash, ...unsignedPayload } = payload;
  if (evidenceHash !== expectedEvidenceHash(unsignedPayload)) return { status: "BLOCKED", rejectionCode: "EVIDENCE_HASH_MISMATCH" };
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  const now = options.now?.getTime() ?? Date.now();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > now + 5 * 60 * 1000 || expiresAt <= now || now - issuedAt > SIGNED_RUNTIME_EVIDENCE_MAX_AGE_MS) return { status: "BLOCKED", rejectionCode: "STALE_OR_INVALID_TIMESTAMP" };
  if (payload.environmentIdentity !== trust.environmentIdentity || payload.commit !== trust.commit || payload.workflowRun !== trust.workflowRun) return { status: "BLOCKED", rejectionCode: "FOREIGN_EVIDENCE" };
  if (options.enforceReplayProtection) {
    purgeExpiredReplayEntries(now);
    const keyId = `${payload.evidenceId}:${payload.evidenceHash}`;
    if (replayCache.has(keyId)) return { status: "BLOCKED", rejectionCode: "REPLAYED_EVIDENCE" };
    replayCache.set(keyId, expiresAt);
  }
  return { status: "VERIFIED", evidence: payload };
}

export function clearRuntimeEvidenceReplayCacheForTests(): void {
  replayCache.clear();
}
