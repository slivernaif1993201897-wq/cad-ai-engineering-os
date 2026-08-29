import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearRuntimeEvidenceReplayCacheForTests, signRuntimeEvidence, verifyRuntimeEvidence, type RuntimeEvidencePayload } from "../server/signedRuntimeEvidence";

const testKey = "d".repeat(64);
const originalKey = process.env.RUNTIME_EVIDENCE_HMAC_KEY;
const now = new Date("2026-08-22T16:00:00.000Z");
const trust = { environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST", commit: "test-commit", workflowRun: "test-run" };
const payload: Omit<RuntimeEvidencePayload, "evidenceHash"> = {
  version: "runtime-evidence/v1",
  evidenceId: "hmac-evidence-test",
  issuedAt: "2026-08-22T15:30:00.000Z",
  expiresAt: "2026-08-22T16:30:00.000Z",
  ...trust,
  binding: {
    projectId: "test-project",
    operationId: "test-operation",
    runtimeAdmissionId: "test-admission",
    artifactIdentity: "a".repeat(64),
    engineIdentity: "test-engine",
    provenanceIdentity: "test-provenance",
    lineageIdentity: "test-lineage",
  },
  artifactHashes: { resultHash: "a".repeat(64) },
  resultHash: "a".repeat(64),
};

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.filter((entry) => ![".git", "node_modules", ".expo", ".env"].includes(entry.name)).map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return files.flat();
}

describe("repository-secret signed runtime evidence", () => {
  beforeEach(() => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = testKey;
    clearRuntimeEvidenceReplayCacheForTests();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RUNTIME_EVIDENCE_HMAC_KEY;
    else process.env.RUNTIME_EVIDENCE_HMAC_KEY = originalKey;
    clearRuntimeEvidenceReplayCacheForTests();
  });

  it("accepts valid evidence and rejects modified, wrong-key, invalid, stale, foreign, missing, and replayed evidence", () => {
    const valid = signRuntimeEvidence(payload);
    expect(verifyRuntimeEvidence(valid, trust, { now })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence({ ...valid, payload: { ...valid.payload, resultHash: "b".repeat(64) } }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = createHash("sha256").update("wrong-key-test-only").digest("hex");
    const wrongKeyEnvelope = signRuntimeEvidence({ ...payload, evidenceId: "wrong-key" });
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = testKey;
    expect(verifyRuntimeEvidence(wrongKeyEnvelope, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    expect(verifyRuntimeEvidence({ ...valid, signature: "0".repeat(64) }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    expect(verifyRuntimeEvidence(null, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" });
    const stale = signRuntimeEvidence({ ...payload, evidenceId: "stale", issuedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T01:00:00.000Z" });
    expect(verifyRuntimeEvidence(stale, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "STALE_OR_INVALID_TIMESTAMP" });
    const foreign = signRuntimeEvidence({ ...payload, evidenceId: "foreign", environmentIdentity: "FOREIGN-ENVIRONMENT" });
    expect(verifyRuntimeEvidence(foreign, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "FOREIGN_EVIDENCE" });
    const replay = signRuntimeEvidence({ ...payload, evidenceId: "replay" });
    expect(verifyRuntimeEvidence(replay, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence(replay, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "BLOCKED", rejectionCode: "REPLAYED_EVIDENCE" });
  });

  it("rejects missing or invalid runtime configuration, incompatible schemas, and incomplete bindings", () => {
    delete process.env.RUNTIME_EVIDENCE_HMAC_KEY;
    expect(() => signRuntimeEvidence(payload)).toThrow("RUNTIME_EVIDENCE_KEY_UNAVAILABLE");
    expect(verifyRuntimeEvidence(null, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" });
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = "not-hex";
    expect(verifyRuntimeEvidence({ payload: { ...payload, evidenceHash: "a".repeat(64) }, signature: "a".repeat(64) }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "UNTRUSTED_SIGNING_KEY" });
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = testKey;
    const valid = signRuntimeEvidence(payload);
    expect(verifyRuntimeEvidence({ ...valid, payload: { ...valid.payload, version: "runtime-evidence/v0" as "runtime-evidence/v1" } }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "UNKNOWN_EVIDENCE_VERSION" });
    expect(verifyRuntimeEvidence({ ...valid, payload: { ...valid.payload, binding: { ...valid.payload.binding, projectId: "" } } }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SCHEMA" });
  });

  it("uses deterministic canonical serialization for the same bound payload", () => {
    const first = signRuntimeEvidence(payload);
    const second = signRuntimeEvidence({ ...payload, artifactHashes: { resultHash: "a".repeat(64) } });
    expect(second).toEqual(first);
  });

  it("does not expose the configured key in repository files, generated source, or verification results", async () => {
    const files = await sourceFiles(process.cwd());
    for (const file of files) {
      const content = await readFile(file, "utf8").catch(() => "");
      expect(content.includes(testKey)).toBe(false);
    }
    const result = verifyRuntimeEvidence(signRuntimeEvidence(payload), trust, { now });
    expect(JSON.stringify(result).includes(testKey)).toBe(false);
    expect(JSON.stringify(result)).not.toContain("RUNTIME_EVIDENCE_HMAC_KEY");
  });
});
