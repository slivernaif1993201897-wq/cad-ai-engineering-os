import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { clearRuntimeEvidenceReplayCacheForTests, signRuntimeEvidence, verifyRuntimeEvidence, type RuntimeEvidencePayload } from "../server/signedRuntimeEvidence";

const hasConfiguredKey = Boolean(process.env.RUNTIME_EVIDENCE_HMAC_KEY && /^[a-f0-9]{64,}$/i.test(process.env.RUNTIME_EVIDENCE_HMAC_KEY));
const now = new Date("2026-08-22T16:00:00.000Z");
const trust = { environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST", commit: process.env.GITHUB_SHA ?? "test-commit", workflowRun: process.env.GITHUB_RUN_ID ?? "test-run" };
const payload: Omit<RuntimeEvidencePayload, "evidenceHash"> = {
  version: "runtime-evidence/v1",
  evidenceId: "hmac-evidence-test",
  issuedAt: "2026-08-22T15:30:00.000Z",
  expiresAt: "2026-08-22T16:30:00.000Z",
  ...trust,
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

describe.skipIf(!hasConfiguredKey)("repository-secret signed runtime evidence", () => {
  it("accepts valid evidence and rejects modified, wrong-key, invalid, stale, foreign, missing, and replayed evidence", () => {
    const valid = signRuntimeEvidence(payload);
    expect(verifyRuntimeEvidence(valid, trust, { now })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence({ ...valid, payload: { ...valid.payload, resultHash: "b".repeat(64) } }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    const wrongKey = createHash("sha256").update("non-production-test-key").digest("hex");
    expect(verifyRuntimeEvidence(signRuntimeEvidence({ ...payload, evidenceId: "wrong-key" }, wrongKey), trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    expect(verifyRuntimeEvidence({ ...valid, signature: "0".repeat(64) }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    expect(verifyRuntimeEvidence(null, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" });
    const stale = signRuntimeEvidence({ ...payload, evidenceId: "stale", issuedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T01:00:00.000Z" });
    expect(verifyRuntimeEvidence(stale, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "STALE_OR_INVALID_TIMESTAMP" });
    const foreign = signRuntimeEvidence({ ...payload, evidenceId: "foreign", environmentIdentity: "FOREIGN-ENVIRONMENT" });
    expect(verifyRuntimeEvidence(foreign, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "FOREIGN_EVIDENCE" });
    clearRuntimeEvidenceReplayCacheForTests();
    const replay = signRuntimeEvidence({ ...payload, evidenceId: "replay" });
    expect(verifyRuntimeEvidence(replay, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence(replay, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "BLOCKED", rejectionCode: "REPLAYED_EVIDENCE" });
  });

  it("does not expose the configured key in repository files, generated source, or verification results", async () => {
    const key = process.env.RUNTIME_EVIDENCE_HMAC_KEY as string;
    const files = await sourceFiles(process.cwd());
    for (const file of files) {
      const content = await readFile(file, "utf8").catch(() => "");
      expect(content.includes(key)).toBe(false);
    }
    const result = verifyRuntimeEvidence(signRuntimeEvidence(payload), trust, { now });
    expect(JSON.stringify(result).includes(key)).toBe(false);
    expect(JSON.stringify(result)).not.toContain("RUNTIME_EVIDENCE_HMAC_KEY");
  });
});
