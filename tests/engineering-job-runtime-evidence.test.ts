import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { reconcileEngineeringJobRuntimeEvidence, submitEngineeringJob } from "../server/engineeringJob";
import { openPersistentProject } from "../server/persistentMemory";
import { clearRuntimeEvidenceReplayCacheForTests, signRuntimeEvidence } from "../server/signedRuntimeEvidence";

const key = "a".repeat(64);
const originalKey = process.env.RUNTIME_EVIDENCE_HMAC_KEY;
const trust = { environmentIdentity: "TEST-ENGINEERING-JOB-RUNTIME", commit: "test-commit", workflowRun: "test-run" };
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

afterEach(() => {
  if (originalKey === undefined) delete process.env.RUNTIME_EVIDENCE_HMAC_KEY;
  else process.env.RUNTIME_EVIDENCE_HMAC_KEY = originalKey;
  clearRuntimeEvidenceReplayCacheForTests();
});

async function admittedJob() {
  const project = await openPersistentProject({ name: "Engineering job runtime reconciliation" });
  const job = await submitEngineeringJob({
    projectId: project.id,
    accessKey: project.accessKey,
    request: {
      name: `Runtime Evidence ${crypto.randomUUID()}`,
      sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
      mountingBlock: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
    },
  });
  if (!job.manifest || !job.cad || !job.caeConfiguration) throw new Error("TEST_JOB_NOT_ADMITTED");
  return { project, job };
}

function signedEnvelope(
  project: Awaited<ReturnType<typeof admittedJob>>["project"],
  job: Awaited<ReturnType<typeof admittedJob>>["job"],
  overrides: Record<string, string> = {},
  bindingOverrides: Record<string, string> = {},
) {
  const now = new Date();
  return signRuntimeEvidence({
    version: "runtime-evidence/v1",
    evidenceId: `test-evidence-${crypto.randomUUID()}`,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    ...trust,
    binding: {
      projectId: project.id,
      operationId: job.jobId,
      runtimeAdmissionId: job.manifest!.manifestHash,
      artifactIdentity: job.cad!.artifactHash,
      engineIdentity: "test-calculix-runtime",
      provenanceIdentity: "test-provenance",
      lineageIdentity: "test-lineage",
      ...bindingOverrides,
    },
    artifactHashes: {
      jobId: job.jobId,
      manifestHash: job.manifest!.manifestHash,
      cadRevisionHash: job.cad!.revisionHash,
      cadArtifactHash: job.cad!.artifactHash,
      caeConfigurationHash: job.caeConfiguration!.caeConfigurationHash,
      environmentHash: sha("environment"),
      gmshHash: sha("real-gmsh-binding-test"),
      meshHash: sha("real-mesh-binding-test"),
      calculixHash: sha("real-calculix-binding-test"),
      inputHash: sha("solver-input-binding-test"),
      outputHash: sha("solver-output-binding-test"),
      resultHash: sha("solver-result-binding-test"),
      executionLogHash: sha("execution-log-binding-test"),
      ...overrides,
    },
    resultHash: overrides.resultHash ?? sha("solver-result-binding-test"),
  });
}

describe("engineering job trusted runtime evidence reconciliation", () => {
  it("completes an admitted job only after a cryptographically verified complete binding", async () => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    const { project, job } = await admittedJob();
    const result = await reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope: signedEnvelope(project, job), trust });
    expect(result).toMatchObject({ status: "RECONCILED", job: { state: "SUCCEEDED", runtimeEvidence: { meshHash: expect.stringMatching(/^[a-f0-9]{64}$/), calculixHash: expect.stringMatching(/^[a-f0-9]{64}$/) } } });
  }, 25_000);

  it("rejects a signed foreign job binding and keeps it from becoming a completed result", async () => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    const { project, job } = await admittedJob();
    const result = await reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope: signedEnvelope(project, job, { jobId: "FOREIGN-JOB" }), trust });
    expect(result).toEqual({ status: "BLOCKED", reason: "ENGINEERING_JOB_EVIDENCE_BINDING_MISMATCH" });
  }, 25_000);

  it("rejects a validly signed foreign CAD artifact binding before it can complete the admitted job", async () => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    const { project, job } = await admittedJob();
    const envelope = signedEnvelope(project, job, { cadArtifactHash: "f".repeat(64) }, { artifactIdentity: "f".repeat(64) });
    const result = await reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope, trust });
    expect(result).toEqual({ status: "BLOCKED", reason: "ENGINEERING_JOB_EVIDENCE_BINDING_MISMATCH" });
  }, 25_000);

  it("rejects a validly signed foreign project binding before it can complete the admitted job", async () => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    const { project, job } = await admittedJob();
    const envelope = signedEnvelope(project, job, {}, { projectId: "FOREIGN-PROJECT" });
    const result = await reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope, trust });
    expect(result).toEqual({ status: "BLOCKED", reason: "ENGINEERING_JOB_EVIDENCE_BINDING_MISMATCH" });
  }, 25_000);

  it("rejects a replayed evidence envelope instead of recording duplicate runtime completion", async () => {
    process.env.RUNTIME_EVIDENCE_HMAC_KEY = key;
    const { project, job } = await admittedJob();
    const envelope = signedEnvelope(project, job);
    await expect(reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope, trust })).resolves.toMatchObject({ status: "RECONCILED" });
    await expect(reconcileEngineeringJobRuntimeEvidence({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId, envelope, trust })).resolves.toEqual({ status: "BLOCKED", reason: "REPLAYED_EVIDENCE" });
  }, 25_000);
});
