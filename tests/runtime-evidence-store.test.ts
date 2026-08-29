import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { signRuntimeEvidence, type RuntimeEvidencePayload } from "../server/signedRuntimeEvidence";
import { readAuthoritativeRuntimeEvidence } from "../server/runtimeEvidenceApi";
import { readCanonicalRuntimeEvidence, storeCanonicalRuntimeEvidence } from "../server/runtimeEvidenceStore";

const key = "e".repeat(64);
const now = new Date();
const trust = {
  environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST",
  commit: "a".repeat(40),
  workflowRun: "32549971601",
};
const binding = {
  jobId: "CAD-AGENT-RUNTIME-TEST",
  cadRevisionHash: "1".repeat(64),
  cadArtifactHash: "2".repeat(64),
  caeConfigurationHash: "3".repeat(64),
  manifestHash: "4".repeat(64),
  environmentHash: "5".repeat(64),
  gmshHash: "6".repeat(64),
  meshHash: "7".repeat(64),
  calculixHash: "8".repeat(64),
  inputHash: "9".repeat(64),
  outputHash: "a".repeat(64),
  resultHash: "b".repeat(64),
  executionLogHash: "c".repeat(64),
};

const basePayload: Omit<RuntimeEvidencePayload, "evidenceHash"> = {
  version: "runtime-evidence/v1",
  evidenceId: "canonical-store-test",
  issuedAt: new Date(now.getTime() - 60_000).toISOString(),
  expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  ...trust,
  binding: {
    projectId: "test-project",
    operationId: "test-operation",
    runtimeAdmissionId: "test-admission",
    artifactIdentity: binding.cadArtifactHash,
    engineIdentity: "test-engine",
    provenanceIdentity: "test-provenance",
    lineageIdentity: "test-lineage",
  },
  artifactHashes: binding,
  resultHash: binding.resultHash,
};

let storeDirectory = "";
const originalEnvironment = { ...process.env };

describe("canonical runtime evidence store", () => {
  beforeEach(() => {
    storeDirectory = mkdtempSync(join(tmpdir(), "cad-ai-runtime-evidence-"));
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    process.env.RUNTIME_EVIDENCE_STORE_DIR = storeDirectory;
    process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY = trust.environmentIdentity;
    process.env.RUNTIME_EVIDENCE_COMMIT = trust.commit;
    process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN = trust.workflowRun;
  });

  afterEach(() => {
    rmSync(storeDirectory, { recursive: true, force: true });
    for (const [name, value] of Object.entries(originalEnvironment)) process.env[name] = value;
    for (const name of Object.keys(process.env)) if (!(name in originalEnvironment)) delete process.env[name];
  });

  it("stores and exposes only a complete verified envelope through the server-side API", async () => {
    const envelope = signRuntimeEvidence(basePayload);
    await expect(storeCanonicalRuntimeEvidence(envelope, trust, storeDirectory, now)).resolves.toMatchObject({ status: "VERIFIED" });
    await expect(storeCanonicalRuntimeEvidence(envelope, trust, storeDirectory, now)).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "REPLAYED_EVIDENCE" });
    await expect(readCanonicalRuntimeEvidence(storeDirectory, trust)).resolves.toMatchObject({ status: "VERIFIED", evidence: { resultHash: binding.resultHash } });
    await expect(readAuthoritativeRuntimeEvidence()).resolves.toMatchObject({ status: "VERIFIED", evidence: { workflowRun: trust.workflowRun } });
    expect(readFileSync(join(storeDirectory, "active.json"), "utf8")).not.toContain(key);
  });

  it("rejects incomplete bindings, tampered storage, stale evidence, foreign evidence, and missing canonical sources", async () => {
    const incomplete = signRuntimeEvidence({ ...basePayload, evidenceId: "incomplete", artifactHashes: { resultHash: binding.resultHash } });
    await expect(storeCanonicalRuntimeEvidence(incomplete, trust, storeDirectory, now)).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "INCOMPLETE_RESULT_BINDING" });

    const valid = signRuntimeEvidence({ ...basePayload, evidenceId: "tamper" });
    await storeCanonicalRuntimeEvidence(valid, trust, storeDirectory, now);
    const stored = JSON.parse(readFileSync(join(storeDirectory, "active.json"), "utf8"));
    stored.envelope.payload.resultHash = "d".repeat(64);
    writeFileSync(join(storeDirectory, "active.json"), JSON.stringify(stored), "utf8");
    await expect(readCanonicalRuntimeEvidence(storeDirectory, trust)).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "HMAC_MISMATCH" });

    const stale = signRuntimeEvidence({ ...basePayload, evidenceId: "stale", issuedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), expiresAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() });
    await expect(storeCanonicalRuntimeEvidence(stale, trust, storeDirectory, now)).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "STALE_OR_INVALID_TIMESTAMP" });
    const foreign = signRuntimeEvidence({ ...basePayload, evidenceId: "foreign", environmentIdentity: "FOREIGN-ENVIRONMENT" });
    await expect(storeCanonicalRuntimeEvidence(foreign, trust, storeDirectory, now)).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "FOREIGN_EVIDENCE" });
    rmSync(storeDirectory, { recursive: true, force: true });
    await expect(readAuthoritativeRuntimeEvidence()).resolves.toMatchObject({ status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SOURCE" });
  });
});
