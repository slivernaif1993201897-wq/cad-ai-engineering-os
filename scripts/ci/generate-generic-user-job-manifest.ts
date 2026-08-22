import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { calculateControlledUserJobManifestHash, type ControlledUserJobManifest } from "../../shared/controlledUserJob";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const inputRoot = join(process.cwd(), "artifacts", "generic-job", "input");

const hashRecord = (value: unknown) => sha256(JSON.stringify(value));

async function main() {
  await mkdir(inputRoot, { recursive: true });
  const cadBytes = await readFile(join(inputRoot, "generic-cantilever.step"));
  const caePlan = { analysisType: "LINEAR_STATIC", scope: "GENERIC_CANTILEVER", unitSystem: "mm-N-MPa", meshSizeMm: 4 };
  const material = { materialId: "STEEL_LINEAR_ELASTIC_V1", elasticModulusMpa: 210000, poissonRatio: 0.3 };
  const load = { loadId: "END_FACE_AXIAL_LOAD_V1", totalForceN: 800, direction: "GLOBAL_Z" };
  const boundary = { boundaryId: "Z_MIN_FULL_FIXITY_V1", fixedDofs: [1, 2, 3] };
  const meshConfiguration = { configurationId: "GMSH-TETRA-4MM-V1", configurationHash: hashRecord({ solver: "GMSH", version: "4.12.1", element: "TETRA4", sizeMm: 4 }), solverId: "GMSH" as const, solverVersion: "4.12.1" };
  const solverConfiguration = { configurationId: "CALCULIX-LINEAR-STATIC-V1", configurationHash: hashRecord({ solver: "CALCULIX", version: "2.21", element: "C3D4", nonlinearGeometry: false }), solverId: "CALCULIX" as const, solverVersion: "2.21" };
  const resourcePolicy = { policyId: "DOCKER-INTERNAL-CAE-512M-V1", policyHash: hashRecord({ cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 }), limits: { cpuMilliCores: 1000, memoryMiB: 512, storageMiB: 64, processCount: 256, runtimeSeconds: 120, inputBytes: 5242880, outputBytes: 67108864, artifactBytes: 67108864 } };
  const expectedArtifacts: ControlledUserJobManifest["expectedArtifacts"] = ["ADMISSION_RECEIPT", "EXECUTION_LOG", "PROVENANCE_BUNDLE", "MESH", "MESH_VERIFICATION", "SOLVER_RESULT", "NUMERICAL_VALIDATION"];
  const manifestWithoutHash = {
    manifestVersion: "1.0.0" as const,
    jobId: "GENERIC-CANTILEVER-USER-JOB-001",
    projectId: "CAD-AI-PROJECT-FIXTURE",
    cadRevision: "CAD-REVISION-GENERIC-CANTILEVER-1",
    cadHash: sha256(cadBytes),
    cadRevisionHash: hashRecord({ revision: "CAD-REVISION-GENERIC-CANTILEVER-1", source: "FIXTURE_BASELINE" }),
    cadArtifactHash: sha256(cadBytes),
    cadProvenance: { sourceKind: "FIXTURE_BASELINE" as const, configurationId: "GENERIC-CANTILEVER-FIXTURE", configurationHash: hashRecord({ revision: "CAD-REVISION-GENERIC-CANTILEVER-1", source: "FIXTURE_BASELINE" }), artifactId: "ARTIFACT-GENERIC-CANTILEVER-1" },
    caePlanRevision: "CAE-PLAN-GENERIC-CANTILEVER-1",
    caePlanHash: hashRecord(caePlan),
    materialRevision: "MATERIAL-STEEL-1",
    materialHash: hashRecord(material),
    loadRevision: "LOAD-AXIAL-800N-1",
    loadHash: hashRecord(load),
    boundaryConditionRevision: "BOUNDARY-Z-MIN-1",
    boundaryConditionHash: hashRecord(boundary),
    meshConfiguration,
    solverConfiguration,
    environment: { environmentId: "GITHUB-DOCKER-INTERNAL-TEST-V1", environmentHash: hashRecord({ engine: "docker", image: "cad-ai-generic-user-job", network: "none", readOnlyRoot: true }), approvalEvidenceHash: hashRecord({ authorization: "USER_AND_MANUS_INTERNAL_TEST_ONLY" }), executionClass: "INTERNAL_DOCKER_TEST" as const },
    resourcePolicy,
    analysisPlan: { profileId: "GENERIC_CANTILEVER_AXIAL_Z_V1" as const, profileHash: hashRecord({ profile: "GENERIC_CANTILEVER_AXIAL_Z_V1", axis: "Z", bounds: [20, 10, 80] }), axis: "Z" as const, expectedBoundsMm: { min: [0, 0, 0] as [number, number, number], max: [20, 10, 80] as [number, number, number] }, meshSizeMm: 4, elasticModulusMpa: 210000, poissonRatio: 0.3, totalAxialForceN: 800, referenceCrossSectionAreaMm2: 200, numericalTolerance: 0.30 },
    expectedArtifacts,
    validationPolicy: { policyId: "AXIAL_CANTILEVER-NUMERICAL-CHECK-V1", policyHash: hashRecord({ method: "F_L_E_A", tolerance: 0.3, nonProduction: true }) },
    authorization: { authorizationId: "INTERNAL-GENERIC-JOB-AUTH-1", authorizationEvidenceHash: hashRecord({ evidence: "USER_AUTHORIZED_INTERNAL_GENERIC_JOB" }), validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2027-12-31T23:59:59.000Z", status: "AUTHORIZED" as const },
  };
  const manifest: ControlledUserJobManifest = { ...manifestWithoutHash, manifestHash: "" };
  manifest.manifestHash = calculateControlledUserJobManifestHash(manifest);
  await writeFile(join(inputRoot, "generic-user-job-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
