import { createHash } from "node:crypto";

import type { CADConfiguration, CADExport } from "./cadAgent";
import {
  calculateControlledUserJobManifestHash,
  validateControlledUserJobManifest,
  type ControlledUserJobManifest,
} from "./controlledUserJob";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const recordHash = (value: unknown) => hash(JSON.stringify(value));

export type CadAgentRuntimeAdmissionReason = "STALE_JOB_REJECTED" | "STALE_CAD_REJECTED" | "CAD_SOURCE_NOT_AGENT";

export interface CadAgentRuntimeSource {
  configuration: CADConfiguration;
  stepExport: CADExport;
  stepBytes: Buffer;
}

export interface CadAgentRuntimeAdmissionContext {
  jobId: string;
  cadRevision: string;
  cadRevisionHash: string;
  cadArtifactHash: string;
}

export function calculateCadRevisionHash(configuration: CADConfiguration): string {
  return recordHash({
    configurationId: configuration.id,
    revision: configuration.revision,
    sourceText: configuration.sourceText,
    input: configuration.input,
    requirementSet: configuration.requirementSet,
    plan: configuration.plan,
    artifact: {
      id: configuration.artifact?.id,
      validationStatus: configuration.artifact?.validationStatus,
      featureTree: configuration.artifact?.featureTree,
      parameters: configuration.artifact?.parameters,
    },
  });
}

export function buildCadAgentRuntimeManifest(source: CadAgentRuntimeSource): ControlledUserJobManifest {
  const { configuration, stepExport, stepBytes } = source;
  if (configuration.modelStatus !== "VALIDATED" || configuration.artifact?.validationStatus !== "VALID" || stepExport.validationStatus !== "VALID") {
    throw new Error("CAD_AGENT_ARTIFACT_NOT_VALIDATED");
  }
  const cadArtifactHash = hash(stepBytes);
  const cadRevisionHash = calculateCadRevisionHash(configuration);
  const analysisPlan = {
    profileId: "CAD_AGENT_MOUNTING_BLOCK_AXIAL_X_V1" as const,
    axis: "X" as const,
    expectedBoundsMm: { min: [0, 0, 0] as [number, number, number], max: [configuration.input.width, configuration.input.depth, configuration.input.height] as [number, number, number] },
    meshSizeMm: 4,
    elasticModulusMpa: 210000,
    poissonRatio: 0.3,
    totalAxialForceN: 800,
    referenceCrossSectionAreaMm2: configuration.input.depth * configuration.input.height,
    numericalTolerance: 0.30,
  };
  const caePlan = {
    analysisType: "LINEAR_STATIC",
    source: "CAD_AGENT_VALIDATED_OPEN_CASCADE_REVISION",
    profile: analysisPlan.profileId,
    axis: analysisPlan.axis,
    unitSystem: "mm-N-MPa",
    meshSizeMm: analysisPlan.meshSizeMm,
  };
  const material = { materialId: "STEEL_LINEAR_ELASTIC_V1", elasticModulusMpa: analysisPlan.elasticModulusMpa, poissonRatio: analysisPlan.poissonRatio };
  const load = { loadId: "CAD_AGENT_X_MAX_AXIAL_LOAD_V1", totalForceN: analysisPlan.totalAxialForceN, direction: "GLOBAL_X" };
  const boundary = { boundaryId: "CAD_AGENT_X_MIN_FULL_FIXITY_V1", fixedDofs: [1, 2, 3] };
  const meshConfiguration = { configurationId: "GMSH-TETRA-4MM-V1", configurationHash: recordHash({ solver: "GMSH", version: "4.12.1", element: "TETRA4", sizeMm: analysisPlan.meshSizeMm }), solverId: "GMSH" as const, solverVersion: "4.12.1" };
  const solverConfiguration = { configurationId: "CALCULIX-LINEAR-STATIC-V1", configurationHash: recordHash({ solver: "CALCULIX", version: "2.21", element: "C3D4", nonlinearGeometry: false }), solverId: "CALCULIX" as const, solverVersion: "2.21" };
  const resourcePolicy = { policyId: "DOCKER-INTERNAL-CAE-512M-V1", policyHash: recordHash({ cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 }), limits: { cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 } };
  const manifest: ControlledUserJobManifest = {
    manifestVersion: "1.0.0",
    jobId: `CAD-AGENT-RUNTIME-${cadArtifactHash.slice(0, 16).toUpperCase()}`,
    projectId: "CAD-AI-CAD-AGENT-RUNTIME",
    cadRevision: configuration.id,
    cadHash: cadArtifactHash,
    cadRevisionHash,
    cadArtifactHash,
    cadProvenance: { sourceKind: "CAD_AGENT", configurationId: configuration.id, configurationHash: cadRevisionHash, artifactId: configuration.artifact.id },
    caePlanRevision: `CAE-${configuration.id}`,
    caePlanHash: recordHash(caePlan),
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
