import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getAuthoritativeRuntimeEvidence } from "../server/authoritative-evidence";
import {
  clearRuntimeEvidenceReplayCacheForTests,
  signRuntimeEvidenceForServer,
  verifyRuntimeEvidence,
  type RuntimeEvidencePayload,
} from "../server/runtime-evidence";

const now = new Date("2026-08-22T04:00:00.000Z");
const trust = { environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST", commit: "e919c476e3c25dec3d39c842f39f9c13a951e535", workflowRun: "32549971601" };
const testKey = "f".repeat(64);
const originalKey = process.env.RUNTIME_EVIDENCE_HMAC_KEY;
const basePayload: Omit<RuntimeEvidencePayload, "evidenceHash"> = {
  version: "runtime-evidence/v1",
  evidenceId: "test-evidence-001",
  issuedAt: "2026-08-22T03:30:00.000Z",
  expiresAt: "2026-08-22T04:30:00.000Z",
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

describe("server-only signed runtime evidence", () => {
  beforeEach(() => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = testKey;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RUNTIME_EVIDENCE_HMAC_KEY;
    else process.env.RUNTIME_EVIDENCE_HMAC_KEY = originalKey;
    delete process.env.RUNTIME_EVIDENCE_ENVELOPE_PATH;
    delete process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY;
    delete process.env.RUNTIME_EVIDENCE_COMMIT;
    delete process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN;
  });

  it("returns BLOCKED when no canonical evidence source has been configured", () => {
    expect(getAuthoritativeRuntimeEvidence(now)).toMatchObject({ status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE_SOURCE" });
  });

  it("accepts a valid signature and rejects payload, signature, stale, foreign, and missing evidence", () => {
    const valid = signRuntimeEvidenceForServer(basePayload);
    expect(verifyRuntimeEvidence(valid, trust, { now })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence({ ...valid, payload: { ...valid.payload, resultHash: "b".repeat(64) } }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    expect(verifyRuntimeEvidence({ ...valid, signature: "0".repeat(64) }, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });
    const stale = signRuntimeEvidenceForServer({ ...basePayload, evidenceId: "stale-evidence", issuedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T01:00:00.000Z" });
    expect(verifyRuntimeEvidence(stale, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "STALE_OR_INVALID_TIMESTAMP" });
    const foreign = signRuntimeEvidenceForServer({ ...basePayload, evidenceId: "foreign-evidence", environmentIdentity: "FOREIGN-ENVIRONMENT" });
    expect(verifyRuntimeEvidence(foreign, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "FOREIGN_EVIDENCE" });
    expect(verifyRuntimeEvidence(null, trust, { now })).toMatchObject({ status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" });
  });

  it("rejects replayed evidence when replay protection is explicitly required", () => {
    clearRuntimeEvidenceReplayCacheForTests();
    const valid = signRuntimeEvidenceForServer({ ...basePayload, evidenceId: "replay-evidence" });
    expect(verifyRuntimeEvidence(valid, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "VERIFIED" });
    expect(verifyRuntimeEvidence(valid, trust, { now, enforceReplayProtection: true })).toMatchObject({ status: "BLOCKED", rejectionCode: "REPLAYED_EVIDENCE" });
  });

  it("reads only a server-configured canonical envelope and does not expose a configured HMAC key", () => {
    const directory = mkdtempSync(join(tmpdir(), "runtime-evidence-"));
    const sourcePath = join(directory, "envelope.json");
    const valid = signRuntimeEvidenceForServer(basePayload);
    writeFileSync(sourcePath, JSON.stringify(valid), "utf8");
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = testKey;
    process.env.RUNTIME_EVIDENCE_ENVELOPE_PATH = sourcePath;
    process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY = trust.environmentIdentity;
    process.env.RUNTIME_EVIDENCE_COMMIT = trust.commit;
    process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN = trust.workflowRun;
    const result = getAuthoritativeRuntimeEvidence(now);
    expect(result).toMatchObject({ status: "VERIFIED", evidence: { workflowRun: trust.workflowRun } });
    expect(JSON.stringify(result)).not.toContain(process.env.RUNTIME_EVIDENCE_HMAC_KEY ?? "__missing__");
    expect(JSON.stringify(result)).not.toContain("HMAC_KEY");
    rmSync(directory, { recursive: true, force: true });
  });
});
