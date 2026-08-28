import { createHash } from "node:crypto";

import { createMountingBlockConfiguration, getValidatedStepExport } from "./cadAgent";
import { buildAuthorizedRuntimeCAEConfiguration } from "./caeAgent";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";
import { admitCadAgentRuntimeJob, buildCadAgentRuntimeManifest, calculateCadRevisionHash } from "../shared/authoritativeCadAgentRuntime";
import type { EngineeringJob, EngineeringJobComposition, EngineeringJobEvent, EngineeringJobRequest } from "../shared/engineeringJob";
import { verifyRuntimeEvidence, type RuntimeEvidenceTrust, type SignedRuntimeEvidenceEnvelope } from "./signedRuntimeEvidence";
import { readAuthoritativeRuntimeEvidence } from "./runtimeEvidenceApi";
import { executeAuthorizedMountingBlock } from "./sourceLessCadExecution";

type Access = { projectId: string; accessKey: string };
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function persistJob(args: Access, job: EngineeringJob, configurationId?: string) {
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_JOB", title: `Engineering job · ${job.jobId} · ${job.state}`, content: JSON.stringify(job), truthStatus: job.state === "SUCCEEDED" ? "CALCULATED" : job.state === "REJECTED" ? "UNVERIFIED" : "DERIVED", validationStage: job.state === "SUCCEEDED" ? "CAE_VERIFIED" : "CONCEPTUAL", relatedConfigurationId: configurationId, authorSource: "SYSTEM" } });
}

async function persistEvent(args: Access, job: EngineeringJob, item: EngineeringJobEvent, configurationId?: string) {
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_JOB_EVENT", title: `Engineering job event · ${job.jobId} · ${item.state}`, content: JSON.stringify(item), truthStatus: item.state === "SUCCEEDED" ? "CALCULATED" : item.state === "SECURITY_BLOCKED" ? "UNVERIFIED" : "DERIVED", validationStage: item.state === "SUCCEEDED" ? "CAE_VERIFIED" : "CONCEPTUAL", sourceRecordId: job.jobId, relatedConfigurationId: configurationId, authorSource: "SYSTEM" } });
}

function event(state: EngineeringJob["state"], reason: string, evidenceReferences: string[] = []): EngineeringJobEvent {
  return { id: id("ENGINEERING-JOB-EVENT"), state, reason, evidenceReferences, createdAt: now() };
}

/**
 * Composes the verified requirements -> OpenCascade CAD -> CAD-bound CAE -> immutable admission path.
 * It deliberately cannot invoke shell, Gmsh, CalculiX, or arbitrary executables; execution belongs only
 * to the existing admitted GitHub/Docker runtime workflow.
 */
export async function composeEngineeringJobRequest(args: Access & { request: EngineeringJobRequest }): Promise<EngineeringJobComposition> {
  const request = args.request;
  const cad = await createMountingBlockConfiguration({ name: request.name, input: request.mountingBlock, sourceText: request.sourceText });
  if (cad.error || cad.configuration.requirementSet.validation_status !== "VALIDATED") throw new Error(`REQUIREMENTS_NOT_VALIDATED:${cad.error ?? cad.configuration.requirementSet.validation_status}`);
  if (cad.configuration.modelStatus !== "VALIDATED" || cad.configuration.artifact?.validationStatus !== "VALID") throw new Error(`CAD_AGENT_ARTIFACT_NOT_VALIDATED:${cad.configuration.modelStatus}`);
  const stepExport = getValidatedStepExport(cad.configuration.id);
  const stepBytes = Buffer.from(stepExport.stepBase64, "base64");
  const mountingExecution = await executeAuthorizedMountingBlock({ projectId: args.projectId, accessKey: args.accessKey, configurationId: cad.configuration.id, parameters: { width: cad.configuration.input.width, depth: cad.configuration.input.depth, height: cad.configuration.input.height, holeDiameter: cad.configuration.input.holeDiameter, holeEdgeOffset: cad.configuration.input.holeEdgeOffset, filletRadius: cad.configuration.input.filletRadius }, stepBytes, generatorHash: hash(stepBytes) });
  const cadRevisionHash = calculateCadRevisionHash(cad.configuration);
  const cadArtifactHash = mountingExecution.completion.artifact.sha256;
  const caeConfiguration = buildAuthorizedRuntimeCAEConfiguration({
    cadRevision: cad.configuration.id,
    cadRevisionHash,
    cadArtifactHash,
    width: cad.configuration.input.width,
    depth: cad.configuration.input.depth,
    height: cad.configuration.input.height,
  });
  const manifest = buildCadAgentRuntimeManifest({ configuration: cad.configuration, stepExport, stepBytes, caeConfiguration });
  admitCadAgentRuntimeJob(manifest, { jobId: manifest.jobId, cadRevision: cad.configuration.id, cadRevisionHash, cadArtifactHash });
  return { requirementSet: cad.configuration.requirementSet, configuration: cad.configuration, stepExport, stepBytes, caeConfiguration, manifest };
}

export async function submitEngineeringJob(args: Access & { request: EngineeringJobRequest }): Promise<EngineeringJob> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  const createdAt = now();
  const lifecycle: EngineeringJobEvent[] = [event("QUEUED", "Authorized engineering request accepted for deterministic validation.")];
  try {
    lifecycle.push(event("VALIDATING", "Requirements Agent validation started."));
    lifecycle.push(event("CAD_GENERATING", "OpenCascade CAD Agent generation started."));
    const composition = await composeEngineeringJobRequest({ projectId: args.projectId, accessKey: args.accessKey, request: args.request });
    lifecycle.push(event("CAD_VALIDATED", "Validated STEP artifact produced by OpenCascade.", [composition.configuration.id, composition.stepExport.fileName]));
    lifecycle.push(event("CAE_CONFIGURED", "CAE Agent configuration cryptographically bound to the CAD revision and artifact.", [composition.caeConfiguration.caeConfigurationHash]));
    lifecycle.push(event("ADMITTED", "Immutable manifest admitted to the fixed authoritative Docker runtime boundary.", [composition.manifest.manifestHash]));
    const job: EngineeringJob = {
      jobId: composition.manifest.jobId,
      projectId: args.projectId,
      request: args.request,
      state: "ADMITTED",
      requirementSet: composition.requirementSet,
      cad: { revisionId: composition.configuration.id, revisionHash: composition.manifest.cadRevisionHash, artifactHash: composition.manifest.cadArtifactHash, stepExport: { fileName: composition.stepExport.fileName, byteLength: composition.stepExport.byteLength, validationStatus: composition.stepExport.validationStatus } },
      caeConfiguration: composition.caeConfiguration,
      manifest: composition.manifest,
      runtimeDispatch: { status: "ADMITTED_TO_CI_BOUNDARY", reason: "Only the existing fixed-command GitHub/Docker workflow may execute Gmsh and CalculiX; this application service does not spawn processes." },
      events: lifecycle,
      createdAt,
      updatedAt: now(),
    };
    await persistJob(args, job, composition.configuration.id);
    for (const item of lifecycle) await persistEvent(args, job, item, composition.configuration.id);
    return job;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "ENGINEERING_JOB_COMPOSITION_FAILED";
    lifecycle.push(event("REJECTED", reason));
    const job: EngineeringJob = { jobId: id("ENGINEERING-JOB"), projectId: args.projectId, request: args.request, state: "REJECTED", runtimeDispatch: { status: "REJECTED", reason }, events: lifecycle, createdAt, updatedAt: now() };
    await persistJob(args, job);
    return job;
  }
}

export async function listEngineeringJobs(args: Access): Promise<EngineeringJob[]> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === "ENGINEERING_JOB")
    .flatMap((record) => { try { return [JSON.parse(record.content) as EngineeringJob]; } catch { return []; } })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((job, index, jobs) => jobs.findIndex((candidate) => candidate.jobId === job.jobId) === index);
}

export async function getEngineeringJob(args: Access & { jobId: string }): Promise<EngineeringJob | undefined> {
  return (await listEngineeringJobs(args)).find((job) => job.jobId === args.jobId);
}

/** Reconciles only a cryptographically verified runtime envelope; client-supplied mesh or result fields are never accepted. */
async function reconcileVerifiedEngineeringJobRuntimeEvidence(args: Access & { jobId: string }, evidence: NonNullable<ReturnType<typeof verifiedEvidence>>): Promise<{ job?: EngineeringJob; status: "RECONCILED" | "BLOCKED"; reason?: string }> {
  const job = await getEngineeringJob(args);
  if (!job || !job.manifest || !job.cad || !job.caeConfiguration) return { status: "BLOCKED", reason: "ENGINEERING_JOB_NOT_ADMITTED" };
  if (job.state !== "ADMITTED") return { status: "BLOCKED", reason: "ENGINEERING_JOB_NOT_RECONCILABLE" };
  const hashes = evidence.artifactHashes;
  const matches = hashes.jobId === job.jobId
    && hashes.manifestHash === job.manifest.manifestHash
    && hashes.cadRevisionHash === job.cad.revisionHash
    && hashes.cadArtifactHash === job.cad.artifactHash
    && hashes.caeConfigurationHash === job.caeConfiguration.caeConfigurationHash
    && hashes.resultHash === evidence.resultHash
    && evidence.binding.projectId === args.projectId
    && evidence.binding.operationId === job.jobId
    && evidence.binding.runtimeAdmissionId === job.manifest.manifestHash
    && evidence.binding.artifactIdentity === job.cad.artifactHash;
  if (!matches) {
    await persistEvent(args, job, event("SECURITY_BLOCKED", "Runtime evidence binding does not match the admitted engineering job."), job.cad.revisionId);
    return { status: "BLOCKED", reason: "ENGINEERING_JOB_EVIDENCE_BINDING_MISMATCH" };
  }
  const required = ["gmshHash", "meshHash", "calculixHash", "inputHash", "outputHash", "resultHash", "executionLogHash"] as const;
  if (required.some((key) => !/^[a-f0-9]{64}$/i.test(hashes[key] ?? ""))) {
    await persistEvent(args, job, event("SECURITY_BLOCKED", "Runtime evidence has an incomplete solver binding."), job.cad.revisionId);
    return { status: "BLOCKED", reason: "ENGINEERING_JOB_INCOMPLETE_RUNTIME_BINDING" };
  }
  const runtimeEvidence = {
    evidenceId: evidence.evidenceId,
    evidenceHash: evidence.evidenceHash,
    environmentIdentity: evidence.environmentIdentity,
    commit: evidence.commit,
    workflowRun: evidence.workflowRun,
    issuedAt: evidence.issuedAt,
    expiresAt: evidence.expiresAt,
    gmshHash: hashes.gmshHash,
    meshHash: hashes.meshHash,
    calculixHash: hashes.calculixHash,
    inputHash: hashes.inputHash,
    outputHash: hashes.outputHash,
    resultHash: hashes.resultHash,
    executionLogHash: hashes.executionLogHash,
  };
  const events = [...job.events,
    event("MESHING", "Real Gmsh execution verified by the trusted runtime evidence binding.", [runtimeEvidence.gmshHash]),
    event("MESH_VALIDATED", "Independent mesh verification binding verified.", [runtimeEvidence.meshHash]),
    event("SOLVING", "Real CalculiX execution verified by the trusted runtime evidence binding.", [runtimeEvidence.calculixHash, runtimeEvidence.inputHash]),
    event("VALIDATING_RESULT", "Numerical validation and result binding verified by trusted runtime evidence.", [runtimeEvidence.outputHash, runtimeEvidence.resultHash]),
    event("SUCCEEDED", "Engineering job completed with verified runtime evidence.", [runtimeEvidence.evidenceHash]),
  ];
  const completed: EngineeringJob = { ...job, state: "SUCCEEDED", runtimeDispatch: { status: "COMPLETED", reason: "Trusted canonical runtime evidence matched the admitted job binding." }, runtimeEvidence, events, updatedAt: now() };
  await persistJob(args, completed, job.cad.revisionId);
  for (const item of events.slice(job.events.length)) await persistEvent(args, completed, item, job.cad.revisionId);
  return { status: "RECONCILED", job: completed };
}

function verifiedEvidence() {
  return {
    version: "runtime-evidence/v1" as const,
    evidenceId: "",
    issuedAt: "",
    expiresAt: "",
    environmentIdentity: "",
    commit: "",
    workflowRun: "",
    binding: {
      projectId: "",
      operationId: "",
      runtimeAdmissionId: "",
      artifactIdentity: "",
      engineIdentity: "",
      provenanceIdentity: "",
      lineageIdentity: "",
    },
    artifactHashes: {} as Record<string, string>,
    evidenceHash: "",
    resultHash: "",
  };
}

/** Accepts an envelope only after its signature, freshness, trust identity, and replay state verify. Not exposed as a client API. */
export async function reconcileEngineeringJobRuntimeEvidence(args: Access & { jobId: string; envelope: SignedRuntimeEvidenceEnvelope; trust: RuntimeEvidenceTrust }): Promise<{ job?: EngineeringJob; status: "RECONCILED" | "BLOCKED"; reason?: string }> {
  const verification = verifyRuntimeEvidence(args.envelope, args.trust, { enforceReplayProtection: true });
  if (verification.status !== "VERIFIED") {
    const job = await getEngineeringJob(args);
    if (job?.cad) await persistEvent(args, job, event("SECURITY_BLOCKED", `Runtime evidence rejected: ${verification.rejectionCode}`), job.cad.revisionId);
    return { status: "BLOCKED", reason: verification.rejectionCode };
  }
  return reconcileVerifiedEngineeringJobRuntimeEvidence(args, verification.evidence);
}

/** Reads the server-configured canonical store or envelope path; no client envelope is accepted. */
export async function reconcileEngineeringJobFromAuthoritativeEvidence(args: Access & { jobId: string }): Promise<{ job?: EngineeringJob; status: "RECONCILED" | "BLOCKED"; reason?: string }> {
  const verification = await readAuthoritativeRuntimeEvidence();
  if (verification.status !== "VERIFIED") {
    const job = await getEngineeringJob(args);
    if (job?.cad) await persistEvent(args, job, event("SECURITY_BLOCKED", `Authoritative runtime evidence unavailable: ${verification.rejectionCode}`), job.cad.revisionId);
    return { status: "BLOCKED", reason: verification.rejectionCode };
  }
  return reconcileVerifiedEngineeringJobRuntimeEvidence(args, verification.evidence);
}
