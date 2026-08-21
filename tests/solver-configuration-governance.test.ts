import { beforeAll, describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const h = (letter: string) => letter.repeat(64);
const hs = (seed: string, offset: number) => h("0123456789abcdef"[("0123456789abcdef".indexOf(seed.toLowerCase()) + offset) % 16] ?? "0");
const limits = ["CPU_LIMIT", "MEMORY_LIMIT", "DISK_LIMIT", "EXECUTION_TIMEOUT", "INPUT_SIZE_LIMIT", "OUTPUT_SIZE_LIMIT", "PROCESS_LIMIT", "CONCURRENT_JOB_LIMIT"] as const;

function planInput(projectId: string, suffix: string, loadMagnitude: number) {
  return {
    projectId,
    sourceCadRevision: `CAD-REV-CFG-${suffix}`,
    sourceCadBranch: "ROOT",
    engineeringQuestion: "Assess a bounded non-executable static structural configuration contract.",
    analysisType: "STATIC_STRUCTURAL" as const,
    selectedGeometry: { kind: "FACE" as const, id: `FACE-CFG-${suffix}`, label: "Declared configuration load face", source: "VIEWER" as const },
    featureHistory: [`FEATURE-CFG-${suffix}`],
    geometryProvenance: "OPENCASCADE_KERNEL" as const,
    geometryValidation: "VALID" as const,
    requirementIds: [`REQ-CFG-${suffix}`],
    material: { materialId: `MAT-CFG-${suffix}`, name: "Steel schema", status: "COMPLETE" as const, properties: [{ name: "ELASTIC_MODULUS" as const, value: 210, unit: "GPa", source: "SOURCE_VERIFIED" as const, provenance: "Material evidence schema", requiredFor: ["STATIC_STRUCTURAL" as const] }, { name: "POISSON_RATIO" as const, value: 0.3, unit: "dimensionless", source: "SOURCE_VERIFIED" as const, provenance: "Material evidence schema", requiredFor: ["STATIC_STRUCTURAL" as const] }] },
    boundaryConditions: [{ id: `BC-CFG-${suffix}`, geometryReference: `FACE-CFG-FIXED-${suffix}`, type: "FIXED" as const, source: "USER_PROVIDED" as const, confidence: 1, assumptionStatus: "NOT_ASSUMED" as const, geometryStatus: "PROVEN" as const }],
    loads: [{ id: `LOAD-CFG-${suffix}`, type: "FORCE" as const, geometryReference: `FACE-CFG-${suffix}`, magnitude: loadMagnitude, unit: "N", direction: "GLOBAL_Z" as const, source: "USER_PROVIDED" as const, assumptionStatus: "NOT_ASSUMED" as const, geometryStatus: "PROVEN" as const }],
    contacts: [],
    meshStrategy: { elementType: "TETRAHEDRAL" as const, targetSize: 2, unit: "mm", refinementRegions: [], qualityRequirements: ["Independent evidence is required before any future runtime."], convergenceRequirement: "Future convergence policy", status: "PLANNED" as const },
  };
}

const configurationParameters = [
  { name: "maxIterations", type: "INTEGER" as const, required: true, minimum: 1, maximum: 10, constraints: ["Bounded schema value only."], incompatibleWith: [] },
  { name: "loadScale", type: "NUMBER" as const, required: true, unit: "dimensionless", minimum: 0, maximum: 1, constraints: ["Configuration description only."], incompatibleWith: [] },
  { name: "solverMode", type: "ENUM" as const, required: true, allowedValues: ["LINEAR", "NONLINEAR"], constraints: ["Declared analysis mode only."], incompatibleWith: ["contactStabilization"] },
  { name: "contactStabilization", type: "BOOLEAN" as const, required: false, constraints: ["No runtime instruction."], incompatibleWith: ["solverMode"] },
];

async function registerConfiguration(caller: ReturnType<typeof appRouter.createCaller>, access: { projectId: string; accessKey: string }, suffix: string, status: "DRAFT" | "REVIEWED" | "DEPRECATED" | "REVOKED" | "UNKNOWN") {
  return caller.cae.registerSolverConfigurationSchema({ ...access, solverName: "CALCULIX_LINEAR_STATIC_SCHEMA_ONLY", solverVersion: "V1", analysisType: "STATIC_STRUCTURAL", configurationSchemaVersion: "V1", supportedParameters: configurationParameters, provenance: [`Registry fixture ${suffix}; schema only, no adapter is created.`], evidenceHashes: [h("8")], status });
}

function validity() { return { validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 3_600_000).toISOString() }; }
async function createPackageFixture(caller: ReturnType<typeof appRouter.createCaller>, access: { projectId: string; accessKey: string }, reviewerId: string, reviewerAuthorizationId: string, configuration: Awaited<ReturnType<typeof registerConfiguration>>, suffix: string, hashSeed: string, loadMagnitude: number) {
  const plan = await caller.cae.createPlan({ ...access, input: planInput(access.projectId, suffix, loadMagnitude) });
  const geometryHash = h(hashSeed);
  const cadBinding = await caller.cae.registerCADRevisionBinding({ ...access, cadProjectId: `CAD-PROJECT-CFG-${suffix}`, cadRevision: planInput(access.projectId, suffix, loadMagnitude).sourceCadRevision, cadGeometryHash: geometryHash, source: "TEST_CAD_BINDING", creator: "ConfigurationFixtureAuthor", revision: 1, provenance: ["Phase 6.9 immutable test CAD binding."] });
  const snapshot = await caller.cae.captureValidatedCAEPlanSnapshot({ ...access, simulationId: plan.simulationId, cadBindingId: cadBinding.cadBindingId, sourceCadGeometryHash: geometryHash, requirementRevision: `REQ-CFG-REV-${suffix}`, requirementHash: hs(hashSeed, 1), materialEvidenceHash: hs(hashSeed, 2), expectedOutputs: ["DISPLACEMENT", "VON_MISES_STRESS", "SOLVER_LOG", "EXECUTION_RECEIPT"] });
  const resourcePolicy = { policyReference: `RESOURCE-CFG-${suffix}`, policyVersion: "V1", policyHash: hs(hashSeed, 3), environmentReference: `ENV-CFG-${suffix}`, constraints: [...limits] };
  const job = (await caller.cae.convertCAEPlanSnapshotToJob({ ...access, snapshotId: snapshot.snapshotId, solverVersion: "V1", environmentReference: `ENV-CFG-${suffix}`, resourcePolicy, createdBy: "ConfigurationFixtureAuthor" })).job;
  const mesh = await caller.cae.registerNonExecutableMeshArtifact({ ...access, input: { jobId: job.jobId, sourceCadHash: geometryHash, nodeCount: 0, elementCount: 0, elementTypes: ["UNKNOWN"], coordinatesHash: hs(hashSeed, 4), connectivityHash: hs(hashSeed, 5), qualitySummary: "NOT_MEASURED", units: "UNKNOWN", generatorReference: `MESH-CFG-${suffix}`, generatorVersion: "V1" } });
  const quality = await caller.cae.registerMeshQualityEvidence({ ...access, input: { meshId: mesh.meshId, jobId: job.jobId, sourceCadHash: geometryHash, meshGenerator: `MESH-CFG-${suffix}`, meshGeneratorVersion: "V1", elementTypes: ["UNKNOWN"], elementCount: 0, nodeCount: 0, qualityMetrics: [{ metric: "UNKNOWN", source: "UNKNOWN", status: "UNKNOWN" }], qualityThresholds: [{ metric: "ASPECT_RATIO", value: 1, unit: "schema-unit", source: "Threshold evidence schema", version: "T-CFG-1", rationale: "Contract fixture only; no engineering threshold is claimed.", evidenceHash: hs(hashSeed, 6) }], provenance: { cadRevision: job.cadRevision, cadGeometryHash: geometryHash, jobId: job.jobId, jobRevision: job.revision, meshArtifactId: mesh.meshId, meshGenerator: `MESH-CFG-${suffix}`, meshGeneratorVersion: "V1", qualityAlgorithm: "QUALITY-CFG-SCHEMA", qualityAlgorithmVersion: "V1", thresholdVersion: "T-CFG-1", references: ["Provenance schema only"] }, reportedStatus: "PASS" } });
  const verification = await caller.cae.createMeshQualityVerification({ ...access, meshQualityEvidenceId: quality.evidenceId, submitter: `EvidenceSubmitter-${suffix}`, verifier: reviewerId, reviewerAuthorizationId, ...validity(), verificationMethod: "INDEPENDENT_REVIEW", verificationVersion: "V1", findings: ["Independent identity review only; no meshing or solving occurred."], requestedStatus: "VERIFIED" });
  const pkg = await caller.cae.createSolverInputPackageManifest({ ...access, jobId: job.jobId, meshId: mesh.meshId, meshHash: mesh.artifactHash, meshQualityEvidenceId: quality.evidenceId, meshQualityVerificationId: verification.verificationId, solverConfigurationId: configuration.configurationId, solverConfigurationHash: configuration.configurationHash! });
  return { plan, cadBinding, job, mesh, quality, verification, pkg };
}

describe("Phase 6.8 Solver Configuration Governance", () => {
  const caller = appRouter.createCaller(ctx);
  let access: { projectId: string; accessKey: string };
  let otherAccess: { projectId: string; accessKey: string };
  let approverId: string;
  let approverAuthorizationId: string;
  let replacementReviewerId: string;
  let unverifiedReviewerId: string;
  let packageOne: Awaited<ReturnType<typeof createPackageFixture>>;
  let packageTwo: Awaited<ReturnType<typeof createPackageFixture>>;
  let verificationExpiry: string;
  let verificationRevocation: string;
  let verificationReassignment: string;
  let verificationSelfReview: string;
  let verificationUnauthorized: string;
  let reviewedConfiguration: Awaited<ReturnType<typeof registerConfiguration>>;
  let reviewedConfigurationTwo: Awaited<ReturnType<typeof registerConfiguration>>;
  let deprecatedConfiguration: Awaited<ReturnType<typeof registerConfiguration>>;

  beforeAll(async () => {
    const project = await caller.persistentMemory.openProject({ name: "Phase 6.8 configuration governance" });
    const other = await caller.persistentMemory.openProject({ name: "Phase 6.8 configuration governance isolation" });
    access = { projectId: project.id, accessKey: project.accessKey };
    otherAccess = { projectId: other.id, accessKey: other.accessKey };
    const approver = await caller.cae.registerReviewer({ ...access, displayName: "Configuration Approver", role: "Validation Reviewer", projectScope: [project.id], permissions: ["APPROVE_VALIDATION"], actor: "GovernanceAdmin" });
    approverId = (await caller.cae.verifyReviewer({ ...access, reviewerId: approver.reviewerId, verificationMethod: "DIRECT_IDENTITY_VERIFICATION", actor: "GovernanceAdmin" })).reviewerId;
    approverAuthorizationId = (await caller.cae.authorizeReviewerForEvidence({ ...access, reviewerId: approverId, organization: "Independent Review Organization", role: "Validation Reviewer", authorizationScope: ["APPROVE_VALIDATION"], authorizationSource: "Independent authorization fixture", authorizationHash: h("a"), issuedBy: "IndependentAuthorizationIssuer", ...validity(), independenceStatement: "Issuer is independent from reviewer and submitters." })).reviewerAuthorizationId;
    const replacement = await caller.cae.registerReviewer({ ...access, displayName: "Replacement Reviewer", role: "Validation Reviewer", projectScope: [project.id], permissions: ["APPROVE_VALIDATION"], actor: "GovernanceAdmin" });
    replacementReviewerId = (await caller.cae.verifyReviewer({ ...access, reviewerId: replacement.reviewerId, verificationMethod: "DIRECT_IDENTITY_VERIFICATION", actor: "GovernanceAdmin" })).reviewerId;
    const unverified = await caller.cae.registerReviewer({ ...access, displayName: "Unverified Reviewer", role: "Validation Reviewer", projectScope: [project.id], permissions: ["APPROVE_VALIDATION"], actor: "GovernanceAdmin" });
    unverifiedReviewerId = unverified.reviewerId;
    await registerConfiguration(caller, access, "DRAFT", "DRAFT");
    reviewedConfiguration = await registerConfiguration(caller, access, "REVIEWED", "REVIEWED");
    reviewedConfigurationTwo = await registerConfiguration(caller, access, "REVIEWED-TWO", "REVIEWED");
    deprecatedConfiguration = await registerConfiguration(caller, access, "DEPRECATED", "DEPRECATED");
    packageOne = await createPackageFixture(caller, access, approverId, approverAuthorizationId, reviewedConfiguration, "ONE", "a", 100);
    packageTwo = await createPackageFixture(caller, access, approverId, approverAuthorizationId, reviewedConfigurationTwo, "TWO", "b", 200);
    const reviewRecords = await Promise.all(["EXPIRY", "REVOCATION", "REASSIGNMENT", "SELF", "UNAUTHORIZED"].map(async (suffix) => createPackageFixture(caller, access, approverId, approverAuthorizationId, reviewedConfiguration, suffix, suffix === "EXPIRY" ? "c" : suffix === "REVOCATION" ? "d" : suffix === "REASSIGNMENT" ? "e" : suffix === "SELF" ? "f" : "7", 125)));
    verificationExpiry = reviewRecords[0]!.verification.verificationId;
    verificationRevocation = reviewRecords[1]!.verification.verificationId;
    verificationReassignment = reviewRecords[2]!.verification.verificationId;
    verificationSelfReview = reviewRecords[3]!.verification.verificationId;
    verificationUnauthorized = reviewRecords[4]!.verification.verificationId;
  }, 30000);

  it("1. records verification expiry as ACTIVE → EXPIRING → EXPIRED without renewal", async () => {
    const active = (await caller.cae.listMeshQualityVerificationLifecycle({ ...access, verificationId: verificationExpiry }))[0]!;
    const expiring = await caller.cae.transitionMeshQualityVerificationLifecycle({ ...access, verificationId: verificationExpiry, newState: "EXPIRING", reason: "Validity window is ending.", authorization: "APPROVE_VALIDATION", actor: approverId });
    const expired = await caller.cae.transitionMeshQualityVerificationLifecycle({ ...access, verificationId: verificationExpiry, newState: "EXPIRED", reason: "Validity window ended; replacement evidence is required.", authorization: "APPROVE_VALIDATION", actor: approverId });
    expect([active.newState, expiring.newState, expired.newState]).toEqual(["ACTIVE", "EXPIRING", "EXPIRED"]);
    await expect(caller.cae.transitionMeshQualityVerificationLifecycle({ ...access, verificationId: verificationExpiry, newState: "ACTIVE", reason: "Silent renewal must fail.", authorization: "APPROVE_VALIDATION", actor: approverId })).rejects.toThrow(/new independent verification/i);
  });

  it("2. records verification revocation and prohibits reactivation", async () => {
    const revoked = await caller.cae.transitionMeshQualityVerificationLifecycle({ ...access, verificationId: verificationRevocation, newState: "REVOKED", reason: "Evidence provenance was withdrawn.", authorization: "APPROVE_VALIDATION", actor: approverId });
    expect(revoked).toMatchObject({ previousState: "ACTIVE", newState: "REVOKED", immutable: true });
    await expect(caller.cae.transitionMeshQualityVerificationLifecycle({ ...access, verificationId: verificationRevocation, newState: "ACTIVE", reason: "Revocation cannot be reversed.", authorization: "APPROVE_VALIDATION", actor: approverId })).rejects.toThrow(/new independent verification/i);
  });

  it("3. records an authorized reassignment to a distinct verified reviewer", async () => {
    const reassignment = await caller.cae.reassignMeshQualityVerification({ ...access, verificationId: verificationReassignment, newReviewer: replacementReviewerId, reason: "Conflict-free reviewer replacement.", authorization: "APPROVE_VALIDATION", actor: approverId });
    expect(reassignment).toMatchObject({ originalReviewer: approverId, newReviewer: replacementReviewerId, newState: "REPLACED", immutable: true });
    expect(await caller.cae.listMeshQualityReviewerReassignments({ ...access, verificationId: verificationReassignment })).toEqual(expect.arrayContaining([expect.objectContaining({ reassignmentId: reassignment.reassignmentId })]));
  });

  it("4. prevents reviewer self-review during reassignment", async () => {
    await expect(caller.cae.reassignMeshQualityVerification({ ...access, verificationId: verificationSelfReview, newReviewer: approverId, reason: "Original verifier cannot replace itself.", authorization: "APPROVE_VALIDATION", actor: approverId })).rejects.toThrow(/self-review/i);
  });

  it("5. prevents unauthorized reassignment to an unverified reviewer", async () => {
    await expect(caller.cae.reassignMeshQualityVerification({ ...access, verificationId: verificationUnauthorized, newReviewer: unverifiedReviewerId, reason: "Unverified identity is not eligible.", authorization: "APPROVE_VALIDATION", actor: approverId })).rejects.toThrow(/active verified reviewer/i);
  });

  it("6. detects changed fields in a read-only manifest diff", async () => {
    const diff = await caller.cae.createSolverInputPackageDiff({ ...access, baselinePackageId: packageOne.pkg.packageId, comparedPackageId: packageTwo.pkg.packageId });
    expect(diff).toMatchObject({ readOnly: true, baselinePackageId: packageOne.pkg.packageId, comparedPackageId: packageTwo.pkg.packageId });
    expect(diff.entries).toEqual(expect.arrayContaining([expect.objectContaining({ field: "CAD", status: "CHANGED" }), expect.objectContaining({ field: "LOADS", status: "CHANGED" }), expect.objectContaining({ field: "SOLVER_CONFIGURATION", status: "CHANGED" })]));
  });

  it("7. produces a deterministic diff for the same immutable packages", async () => {
    const first = await caller.cae.createSolverInputPackageDiff({ ...access, baselinePackageId: packageOne.pkg.packageId, comparedPackageId: packageTwo.pkg.packageId });
    const second = await caller.cae.createSolverInputPackageDiff({ ...access, baselinePackageId: packageOne.pkg.packageId, comparedPackageId: packageTwo.pkg.packageId });
    expect(second).toEqual(first);
  });

  it("8. registers immutable DRAFT and REVIEWED configuration schemas", async () => {
    const records = await caller.cae.listSolverConfigurationRegistry(access);
    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ status: "DRAFT", immutable: true, securityBoundary: expect.objectContaining({ executable: false }) }), expect.objectContaining({ configurationId: reviewedConfiguration.configurationId, status: "REVIEWED", immutable: true })]));
  });

  it("9. rejects wrong parameter types and out-of-range values", async () => {
    const validation = await caller.cae.validateSolverConfiguration({ ...access, configurationId: reviewedConfiguration.configurationId, configurationSchemaVersion: "V1", parameters: { maxIterations: 1.5, loadScale: 2, solverMode: "LINEAR" }, units: { loadScale: "dimensionless" } });
    expect(validation).toMatchObject({ status: "INVALID", executionEligible: false, executable: false });
    expect(validation.checks).toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "maxIterations", status: "FAIL" }), expect.objectContaining({ parameter: "loadScale", status: "FAIL" })]));
  });

  it("10. rejects unknown parameters rather than silently accepting them", async () => {
    const validation = await caller.cae.validateSolverConfiguration({ ...access, configurationId: reviewedConfiguration.configurationId, configurationSchemaVersion: "V1", parameters: { maxIterations: 5, loadScale: 0.5, solverMode: "LINEAR", unknownParameter: 7 }, units: { loadScale: "dimensionless" } });
    expect(validation.status).toBe("INVALID");
    expect(validation.checks).toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "unknownParameter", status: "FAIL" })]));
  });

  it("11. rejects a configuration schema-version conflict", async () => {
    const validation = await caller.cae.validateSolverConfiguration({ ...access, configurationId: reviewedConfiguration.configurationId, configurationSchemaVersion: "V2", parameters: { maxIterations: 5, loadScale: 0.5, solverMode: "LINEAR" }, units: { loadScale: "dimensionless" } });
    expect(validation.status).toBe("INVALID");
    expect(validation.checks).toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "SCHEMA_VERSION", status: "FAIL" })]));
  });

  it("12. fails validation for a deprecated configuration schema", async () => {
    const validation = await caller.cae.validateSolverConfiguration({ ...access, configurationId: deprecatedConfiguration.configurationId, configurationSchemaVersion: "V1", parameters: { maxIterations: 5, loadScale: 0.5, solverMode: "LINEAR" }, units: { loadScale: "dimensionless" } });
    expect(validation.status).toBe("INVALID");
    expect(validation.checks).toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "CONFIGURATION_STATUS", status: "FAIL" })]));
  });

  it("13. marks changed solver provenance stale and never reuses it silently", async () => {
    const result = await caller.cae.assessSolverConfigurationStaleness({ ...access, packageId: packageOne.pkg.packageId, configurationId: reviewedConfiguration.configurationId, observedSolverVersion: "V2", observedSchemaVersion: "V1", observedJobHash: packageOne.job.contractHash, observedMeshHash: packageOne.mesh.artifactHash, observedMaterialEvidenceHash: packageOne.job.materialEvidenceHash, observedVerificationLifecycle: "ACTIVE" });
    expect(result.assessment).toMatchObject({ status: "STALE", executionEligible: false, executable: false });
    expect(result.assessment.checks).toEqual(expect.arrayContaining([expect.objectContaining({ dimension: "SOLVER_VERSION", status: "STALE" })]));
  });

  it("14. preserves job → package → configuration → verification traceability", async () => {
    const result = await caller.cae.assessSolverConfigurationStaleness({ ...access, packageId: packageOne.pkg.packageId, configurationId: reviewedConfiguration.configurationId, observedSolverVersion: "V1", observedSchemaVersion: "V1", observedJobHash: packageOne.job.contractHash, observedMeshHash: packageOne.mesh.artifactHash, observedMaterialEvidenceHash: packageOne.job.materialEvidenceHash, observedVerificationLifecycle: "ACTIVE" });
    const graph = await caller.cae.solverConfigurationGovernanceGraph({ ...access, packageId: packageOne.pkg.packageId, configurationId: reviewedConfiguration.configurationId });
    expect(result.trace).toMatchObject({ jobId: packageOne.job.jobId, packageId: packageOne.pkg.packageId, configurationId: reviewedConfiguration.configurationId, immutable: true });
    expect(graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: packageOne.job.jobId }), expect.objectContaining({ id: packageOne.pkg.packageId }), expect.objectContaining({ id: reviewedConfiguration.configurationId })]));
    expect(graph.limitations.join(" ")).toMatch(/no command|no solver|non-executable/i);
  });

  it("15. rejects execution-oriented configuration parameter names and content", async () => {
    await expect(caller.cae.registerSolverConfigurationSchema({ ...access, solverName: "CALCULIX_SCHEMA_ONLY", solverVersion: "V1", analysisType: "STATIC_STRUCTURAL", configurationSchemaVersion: "V1", supportedParameters: [{ name: "shellCommand", type: "STRING", required: false, constraints: ["curl https://unsafe.example"], incompatibleWith: [] }], provenance: ["Unsafe schema rejection fixture"], evidenceHashes: [h("9")], status: "DRAFT" })).rejects.toThrow(/non-executable names|prohibited execution-oriented/i);
  });

  it("16. isolates lifecycle, package-diff, and configuration records by project and exposes no execution endpoint", async () => {
    expect(await caller.cae.listMeshQualityVerificationLifecycle(otherAccess)).toEqual([]);
    expect(await caller.cae.listMeshQualityReviewerReassignments(otherAccess)).toEqual([]);
    expect(await caller.cae.listSolverConfigurationRegistry(otherAccess)).toEqual([]);
    await expect(caller.cae.createSolverInputPackageDiff({ ...otherAccess, baselinePackageId: packageOne.pkg.packageId, comparedPackageId: packageTwo.pkg.packageId })).rejects.toThrow(/authorized project/i);
    expect(Object.keys(caller.cae)).not.toEqual(expect.arrayContaining(["executeSolver", "executeMesher", "runGmsh", "runCalculiX", "runShell", "runProcess", "executeConfiguration"]));
  });
});
