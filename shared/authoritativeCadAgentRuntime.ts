import { createHash } from "node:crypto";

import type { CADConfiguration, CADExport } from "./cadAgent";
import { buildAuthorizedRuntimeCAEConfiguration, type AuthorizedRuntimeCAEConfiguration } from "../server/caeAgent";
import {
  calculateControlledUserJobManifestHash,
  validateControlledUserJobManifest,
  type ControlledUserJobManifest,
} from "./controlledUserJob";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const recordHash = (value: unknown) => hash(JSON.stringify(value));
const volatileProvenanceKeys = new Set(["id", "artifactId", "createdAt", "updatedAt", "timestamp", "requirementSetId", "planId", "revisionId", "configurationId", "artifact_id", "created_at", "updated_at", "requirement_set_id", "plan_id", "revision_id", "configuration_id", "featureId", "feature_id"]);

function semanticProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semanticProvenance);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !volatileProvenanceKeys.has(key))
      .map(([key, nested]) => [key, semanticProvenance(nested)]));
  }
  return value;
}

export type CadAgentRuntimeAdmissionReason = "STALE_JOB_REJECTED" | "STALE_CAD_REJECTED" | "CAD_SOURCE_NOT_AGENT";

export interface CadAgentRuntimeSource {
  configuration: CADConfiguration;
  stepExport: CADExport;
  stepBytes: Buffer;
  caeConfiguration: AuthorizedRuntimeCAEConfiguration;
}

export interface CadAgentRuntimeAdmissionContext {
  jobId: string;
  cadRevision: string;
  cadRevisionHash: string;
  cadArtifactHash: string;
}

export function calculateCadRevisionHash(configuration: CADConfiguration): string {
  return recordHash({
    cadRevision: configuration.id,
    revision: configuration.revision,
    semantic: semanticProvenance({
    sourceText: configuration.sourceText,
    input: configuration.input,
    requirementSet: configuration.requirementSet,
    plan: configuration.plan,
    artifact: {
      validationStatus: configuration.artifact?.validationStatus,
      featureTree: configuration.artifact?.featureTree,
      parameters: configuration.artifact?.parameters,
    },
    }),
  });
}

export function buildCadAgentRuntimeManifest(source: CadAgentRuntimeSource): ControlledUserJobManifest {
  const { configuration, stepExport, stepBytes } = source;
  if (configuration.modelStatus !== "VALIDATED" || configuration.artifact?.validationStatus !== "VALID" || stepExport.validationStatus !== "VALID") {
    throw new Error("CAD_AGENT_ARTIFACT_NOT_VALIDATED");
  }
  const cadArtifactHash = hash(stepBytes);
  const cadRevisionHash = calculateCadRevisionHash(configuration);
  const caeConfiguration = source.caeConfiguration;
  if (caeConfiguration.cadRevision !== configuration.id || caeConfiguration.cadRevisionHash !== cadRevisionHash || caeConfiguration.cadArtifactHash !== cadArtifactHash) throw new Error("CAE_AGENT_CAD_BINDING_INVALID");
  const { analysisPlan, caePlan, material, load, boundary, meshConfiguration, solverConfiguration } = caeConfiguration;
  const resourcePolicy = { policyId: "DOCKER-INTERNAL-CAE-512M-V1", policyHash: recordHash({ cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 }), limits: { cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 } };
  const manifest: ControlledUserJobManifest = {
    manifestVersion: "1.0.0",
    jobId: `CAD-AGENT-RUNTIME-${cadArtifactHash.slice(0, 16).toUpperCase()}`,
    projectId: "CAD-AI-CAD-AGENT-RUNTIME",
    cadRevision: configuration.id,
    cadHash: cadArtifactHash,
    cadRevisionHash,
    cadArtifactHash,
    cadProvenance: { sourceKind: "CAD_AGENT", configurationId: configuration.id, configurationHash: cadRevisionHash, artifactId: `ARTIFACT-${cadArtifactHash.slice(0, 16).toUpperCase()}` },
    caePlanRevision: `CAE-${configuration.id}`,
    caePlanHash: caeConfiguration.caeConfigurationHash,
    materialRevision: "MATERIAL-STEEL-1",
    materialHash: recordHash(material),
    loadRevision: "LOAD-X-AXIAL-800N-1",
    loadHash: recordHash(load),
    boundaryConditionRevision: "BOUNDARY-X-MIN-1",
    boundaryConditionHash: recordHash(boundary),
    meshConfiguration,
    solverConfiguration,
    environment: { environmentId: "GITHUB-DOCKER-INTERNAL-TEST-V1", environmentHash: recordHash({ engine: "docker", image: "cad-ai-generic-user-job", network: "none", readOnlyRoot: true }), approvalEvidenceHash: recordHash({ authorization: "USER_AND_MANUS_INTERNAL_TEST_ONLY" }), executionClass: "INTERNAL_DOCKER_TEST" },
    resourcePolicy,
    analysisPlan: { ...analysisPlan, profileHash: recordHash(analysisPlan) },
    expectedArtifacts: ["ADMISSION_RECEIPT", "EXECUTION_LOG", "PROVENANCE_BUNDLE", "MESH", "MESH_VERIFICATION", "SOLVER_RESULT", "NUMERICAL_VALIDATION"],
    validationPolicy: { policyId: "CAD_AGENT_MOUNTING_BLOCK_AXIAL_NUMERICAL_CHECK_V1", policyHash: recordHash({ method: "F_L_E_A", tolerance: analysisPlan.numericalTolerance, nonProduction: true }) },
    authorization: { authorizationId: "INTERNAL-CAD-AGENT-RUNTIME-AUTH-1", authorizationEvidenceHash: recordHash({ evidence: "USER_AUTHORIZED_CAD_AGENT_RUNTIME_JOB" }), validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2027-12-31T23:59:59.000Z", status: "AUTHORIZED" },
    manifestHash: "",
  };
  manifest.manifestHash = calculateControlledUserJobManifestHash(manifest);
  return manifest;
}

export function admitCadAgentRuntimeJob(candidate: unknown, observed: CadAgentRuntimeAdmissionContext): ControlledUserJobManifest {
  const manifest = validateControlledUserJobManifest(candidate);
  if (manifest.cadProvenance.sourceKind !== "CAD_AGENT") throw new Error("CAD_SOURCE_NOT_AGENT");
  if (manifest.jobId !== observed.jobId) throw new Error("STALE_JOB_REJECTED");
  if (manifest.cadRevision !== observed.cadRevision || manifest.cadRevisionHash !== observed.cadRevisionHash || manifest.cadArtifactHash !== observed.cadArtifactHash) {
    throw new Error("STALE_CAD_REJECTED");
  }
  return manifest;
}
