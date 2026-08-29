import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateMountingBlock } from "./cadKernel";
import { createMountingBlockConfiguration, getValidatedStepExport, listConfigurations, markConfigurationStale, previewMountingBlockConfiguration, reviseMountingBlockConfiguration } from "./cadAgent";
import { runRuthlessEngineeringReview } from "./engineeringReview";
import { getEngineeringMemory, runEngineeringIntelligence } from "./engineeringIntelligence";
import { attachWorkbenchFile, getWorkbenchProject, runWorkbenchMessage, updateProposal } from "./cadWorkbench";
import { analyzeCadFile, getCadFileContext, ingestCadFile, listCadFiles, removeCadFile } from "./cadFileIntelligence";
import { createEngineeringViewerBranch, getEngineeringViewerScene, getViewerProposalPreview } from "./engineeringViewer";
import { executeCadOperation, listCadOperationHistory, planCadOperation, previewCadOperation, rejectCadOperation, revertCadOperation } from "./cadExecution";
import { assessCircleRepeatability, cacheFeatureHistoryRevision, compareFeatureRevisions, createCircularPattern, createCircleFeatureHistory, createFeatureHistory, diagnoseFeatureHistoryFailure, evaluateFilletReadiness, executeCircularPatternRegeneration, executeCircleFeatureRegeneration, executeFeatureRegeneration, getCircleFilletReadiness, getCircleGeometryExport, getFeatureViewerMesh, getTopologyManifest, inspectCircleTopology, listFeatureHistory, matchTopologyRevisions, planCircularBoss, planCircularPattern, previewCircularPatternRegeneration, previewCircleFeatureRegeneration, previewFeatureRegeneration } from "./featureHistory";
import { createRectangularPattern, executeRectangularPatternRegeneration, planRectangularPattern, previewRectangularPatternRegeneration } from "./rectangularPattern";
import { edgeTopologyProofs, matchEdgeTopology } from "./edgeTopology";
import { createMirror, executeMirrorRegeneration, planMirror, previewMirrorRegeneration, rejectMirrorPreview } from "./mirrorFeature";
import { FEATURE_CATALOG } from "../shared/featureHistory";
import { createPersistentConversation, listPersistentConversations, openPersistentProject, projectMemorySnapshot, retrievePersistentMemory, updatePersistentConversation } from "./persistentMemory";
import { persistWorkbenchAttachment, recordPersistentConceptDecision, recordPersistentProposalDecision, restoreWorkbenchConversation, runPersistentWorkbenchMessage } from "./persistentWorkbench";
import { applyRequirementRevision, normalizeUnit, parseRequirements } from "./requirementsAgent";
import { createCAEPlan, getCAEPlan, listCAEPlans, requestCAEExecution, reviewCAEPlan } from "./caeAgent";
import { inspectCaeEngine } from "./caeEngineAdmission";
import { listManagedGmshMeshArtifacts } from "./gmshExecution";
import { listManagedCalculiXResultArtifacts } from "./calculixExecution";
import { inspectLocalCamEngine } from "./camEngine";
import { listManagedCamArtifacts } from "./camExecution";
import { evaluateMachineCamRelease, type MachineCamInput } from "./machineAwareCam";
import { assessReadiness, assessUncertainty, buildEvidenceGraph, createExperimentalValidationPlan, getSolverAdapterContract, invalidateCadContext, listExperimentalValidationPlans, listMaterialEvidence, materialPropertyConflicts, negotiateSolver, registerMaterialEvidence } from "./caeEvidence";
import { createDatasetProcessingRecord, ingestMeasurementDataset, listCalibrationRecords, listDatasetProcessing, listMeasurementDatasets, reconcileMaterialProperty, recordCalibration, recordEngineeringReviewDecision } from "./caeReconciliation";
import { buildExtendedEvidenceGraph, createCalibrationCandidate, createSimulationMeasurementComparison, listComparisons, listExternalSolverAdapterRegistrations, registerExternalSolverAdapter } from "./caeIntegration";
import { adapterEligibility, attachCalibrationCertificate, authorizeEngineeringApproval, buildTrustEvidenceGraph, listAdapterTrustVerifications, listAuthorizedApprovals, listCalibrationCertificates, listReviewerIdentities, listSecurityAudit, registerReviewerIdentity, revokeTrustObject, verifyAdapterTrust, verifyCalibrationCertificate, verifyReviewerIdentity } from "./caeTrust";
import { buildExecutionTrustGraph, evaluateExecutionTrustReadiness, ingestCertificateRevocationSource, listCertificateRevocationSources, listExecutionTrustReadiness, listExternalIdentityClaims, listSandboxAttestationVerifications, listSandboxAttestations, registerExternalIdentityClaim, registerSandboxAttestation, revokeExecutionTrustEvidence, runExecutionTrustSecurityBenchmark, verifyExternalIdentityClaim, verifySandboxAttestation } from "./executionTrust";
import { buildRuntimeArchitectureGraph, createRuntimeArchitectureReview, listRuntimeArchitectureReviews } from "./runtimeArchitectureReview";
import { buildRuntimeReadinessGraph, createCapacityPolicy, createRuntimeReadinessReview, listCapacityPolicies, listIndependentSandboxAttestations, listRuntimeReadinessReviews, registerIndependentSandboxAttestation, validateCapacityPolicy } from "./runtimeReadiness";
import { buildRuntimeImplementationReadinessGraph, createRuntimeImplementationReadinessReview, listRuntimeImplementationReadinessReviews } from "./runtimeImplementationReadiness";
import { buildCAEJobContractGraph, buildCAEJobTraceability, caeJobFailureModel, createCAEJobVerificationRecord, evaluateCAEJobStaleness, getCAEJobContract, listCAEJobContracts, listCAEJobStaleness, registerAllowlistedSolverArtifact, registerFutureCAEJobResultArtifact, registerNonExecutableMeshArtifact, reviseCAEJobContract, submitCAEJobContract } from "./caeJobContract";
import { buildCAEPlanIntegrationGraph, captureValidatedCAEPlanSnapshot, convertCAEPlanSnapshotToJob, createCAEJobDiff, evaluateMeshQualityStaleness, listCAEPlanSnapshots, listMeshQualityEvidence, registerMeshQualityEvidence } from "./caePlanIntegration";
import { assessSolverInputPackageStaleness, buildSolverInputPackageGraph, createMeshQualityVerification, createSolverInputPackageManifest, listMeshQualityVerifications, listSolverInputPackages } from "./solverInputPackage";
import { assessSolverConfigurationStaleness, buildSolverConfigurationGovernanceGraph, createSolverInputPackageDiff, listMeshQualityReviewerReassignments, listMeshQualityVerificationLifecycle, listSolverConfigurationRegistry, reassignMeshQualityVerification, registerSolverConfigurationSchema, transitionMeshQualityVerificationLifecycle, validateSolverConfiguration } from "./solverConfigurationGovernance";
import { assessEvidenceIntegrityTraceability, authorizeReviewerForEvidence, listCADRevisionBindings, listReviewerAuthorizations, registerCADRevisionBinding } from "./evidenceIntegrity";
import { assessSecurityEvidenceTraceability, createSandboxAttestationRubric, listArtifactSBOMReviews, listHostileTestEvidenceRecords, listSandboxAttestationRubrics, listSandboxSecurityAttestations, listSecurityEvidenceConflicts, listSecurityEvidenceLifecycle, recordArtifactSBOMReview, recordHostileTestEvidence, recordSandboxSecurityAttestation } from "./securityEvidenceFoundation";
import { buildExternalVerificationGraph, evaluateExternalVerificationReadiness, importHostileTestEvidence, importInfrastructureEvidence, importSandboxReview, listExternalVerificationReadiness, listHostileTestEnvironments, listHostileTestEvidence, listInfrastructureEvidence, listSandboxReviews, recordExternalEvidenceLifecycle, registerHostileTestEnvironment, verifyExternalEvidence } from "./externalVerification";
import { assignVerificationReview, decideVerificationReview, ensureGovernancePolicies, evaluateVerificationGovernanceReadiness, importTestEnvironmentEvidenceReference, listGovernanceLifecycle, listGovernancePolicies, listTestEnvironmentEvidenceReferences, listVerificationConflicts, listVerificationGovernanceReadiness, listVerificationReviews, resolveVerificationConflict, revokeGovernanceReviewer, submitVerificationReview, transitionVerificationReview } from "./verificationGovernance";
import { assessDigitalThread, createDigitalThreadArtifact, createDigitalThreadRelation, listDigitalThreadArtifacts, listDigitalThreadRelations } from "./digitalThread";
import { createBOMRevision, createDrawingPackage, createManufacturingPlan, createPLMRevision, listBOMRevisions, listDrawingPackages, listManufacturingPlans, listPLMRevisions } from "./planningFoundation";
import { assessOptimizationStudy, createOptimizationCandidate, createOptimizationStudy, listOptimizationCandidates, listOptimizationStudies } from "./optimizationFoundation";
import { assessRuntimeAssurance, buildRuntimeAssuranceReviewPackage, listRuntimeAssuranceAssessments, listRuntimeAssuranceEnvironments, listRuntimeAssuranceFailures, listRuntimeAssuranceObservedTests, listRuntimeAssuranceRepairAttempts, recordRuntimeAssuranceEnvironment, recordRuntimeAssuranceFailure, recordRuntimeAssuranceObservedTest, recordRuntimeAssuranceRepairAttempt } from "./runtimeAssurance";
import { evaluateRuntimeAdmission, listRuntimeAdmissionDecisions } from "./runtimeAdmission";
import { readAuthoritativeRuntimeEvidence } from "./runtimeEvidenceApi";
import { getEngineeringJob, listEngineeringJobs, reconcileEngineeringJobFromAuthoritativeEvidence, submitEngineeringJob } from "./engineeringJob";
import { planTextToCad, textToCadInputSchema } from "./textToCad";
import { executeEngineeringCommand } from "./engineeringExecutionKernel";

const mountingBlockInput = z.object({
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  holeDiameter: z.number().positive(),
  holeEdgeOffset: z.number().positive(),
  filletRadius: z.number().nonnegative(),
  approveAssumption: z.boolean(),
});
const engineeringJobInput = z.object({
  name: z.string().trim().min(1).max(160),
  sourceText: z.string().trim().min(1).max(5000),
  mountingBlock: mountingBlockInput,
});

const mountingBlockInputPatch = mountingBlockInput.partial();
const caeSelection = z.object({ kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]), id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(320), featureId: z.string().trim().min(1).max(160).optional(), bodyId: z.string().trim().min(1).max(160).optional(), viewerFaceId: z.string().trim().min(1).max(160).optional(), source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]) });
const caePlanInput = z.object({ projectId: z.string().trim().min(1).max(96), sourceCadRevision: z.string().trim().min(1).max(160), sourceCadBranch: z.string().trim().min(1).max(160).optional(), engineeringQuestion: z.string().trim().min(1).max(5000), analysisType: z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"]).optional(), selectedGeometry: caeSelection.optional(), featureHistory: z.array(z.string().trim().min(1).max(160)).max(64).optional(), geometryProvenance: z.enum(["OPENCASCADE_KERNEL", "PARSED_STEP", "PARSED_STL", "UNKNOWN"]).optional(), geometryValidation: z.enum(["VALID", "UNAVAILABLE", "UNKNOWN"]).optional(), requirementIds: z.array(z.string().trim().min(1).max(160)).max(128).optional(), material: z.object({ materialId: z.string().trim().min(1).max(160).optional(), name: z.string().trim().min(1).max(160).optional(), status: z.enum(["COMPLETE", "MATERIAL_KNOWLEDGE_GAP", "UNKNOWN"]), properties: z.array(z.object({ name: z.enum(["ELASTIC_MODULUS", "POISSON_RATIO", "DENSITY", "YIELD_STRENGTH", "THERMAL_CONDUCTIVITY", "THERMAL_EXPANSION", "SPECIFIC_HEAT", "CUSTOM"]), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), source: z.enum(["SOURCE_VERIFIED", "USER_PROVIDED", "DATABASE_VERIFIED", "CALCULATED", "ASSUMED", "UNKNOWN"]), provenance: z.string().trim().min(1).max(500).optional(), requiredFor: z.array(z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"])).max(8) })).max(32) }).optional(), boundaryConditions: z.array(z.object({ id: z.string().trim().min(1).max(160), geometryReference: z.string().trim().min(1).max(240).optional(), type: z.enum(["FIXED", "DISPLACEMENT", "SYMMETRY", "ROLLER", "THERMAL", "CUSTOM"]), direction: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z", "NORMAL", "TANGENTIAL", "ALL"]).optional(), magnitude: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), source: z.enum(["USER_PROVIDED", "REQUIREMENT", "ASSUMED", "UNKNOWN"]), confidence: z.number().min(0).max(1), assumptionStatus: z.enum(["NOT_ASSUMED", "ASSUMED", "UNKNOWN"]), geometryStatus: z.enum(["PROVEN", "AMBIGUOUS", "UNKNOWN"]) })).max(64).optional(), loads: z.array(z.object({ id: z.string().trim().min(1).max(160), type: z.enum(["FORCE", "PRESSURE", "MOMENT", "GRAVITY", "ACCELERATION", "THERMAL", "TIME_DEPENDENT"]), geometryReference: z.string().trim().min(1).max(240).optional(), magnitude: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), direction: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z", "NORMAL", "CUSTOM"]).optional(), timeDependence: z.string().trim().min(1).max(500).optional(), source: z.enum(["USER_PROVIDED", "REQUIREMENT", "CALCULATED", "ASSUMED", "UNKNOWN"]), assumptionStatus: z.enum(["NOT_ASSUMED", "ASSUMED", "UNKNOWN"]), geometryStatus: z.enum(["PROVEN", "AMBIGUOUS", "UNKNOWN"]) })).max(64).optional(), contacts: z.array(z.object({ id: z.string().trim().min(1).max(160), type: z.enum(["BONDED", "FRICTIONLESS", "FRICTIONAL", "NO_SEPARATION"]), primaryGeometryReference: z.string().trim().min(1).max(240).optional(), secondaryGeometryReference: z.string().trim().min(1).max(240).optional(), source: z.enum(["USER_PROVIDED", "ASSUMED", "UNKNOWN"]), status: z.enum(["PLANNED", "KNOWLEDGE_GAP"]) })).max(64).optional(), meshStrategy: z.object({ elementType: z.enum(["TETRAHEDRAL", "HEXA_HYBRID", "SHELL", "BEAM", "UNKNOWN"]).optional(), targetSize: z.number().positive().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), refinementRegions: z.array(z.object({ geometryReference: z.string().trim().min(1).max(240).optional(), rationale: z.string().trim().min(1).max(500), status: z.enum(["PLANNED", "UNKNOWN"]) })).max(64), qualityRequirements: z.array(z.string().trim().min(1).max(500)).max(32), convergenceRequirement: z.string().trim().min(1).max(500).optional(), status: z.enum(["PLANNED", "MESH_KNOWLEDGE_GAP", "NOT_EXECUTED"]) }).optional() });
const caeAccess = z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) });
const capacityLimitInput = z.object({ kind: z.enum(["CPU_LIMIT", "MEMORY_LIMIT", "DISK_LIMIT", "EXECUTION_TIMEOUT", "INPUT_SIZE_LIMIT", "OUTPUT_SIZE_LIMIT", "PROCESS_LIMIT", "CONCURRENT_JOB_LIMIT"]), value: z.union([z.number().finite().nonnegative(), z.literal("UNKNOWN")]), unit: z.string().trim().min(1).max(32), rationale: z.string().trim().min(1).max(600), environment: z.string().trim().min(1).max(160), version: z.string().trim().min(1).max(64), effectiveDate: z.string().trim().min(1).max(64) });
const externalProvenanceInput = z.object({ source: z.string().trim().min(1).max(500), issuer: z.string().trim().min(1).max(320), timestamp: z.string().trim().min(1).max(64), rawEvidence: z.string().min(1).max(200_000), originalHash: z.string().regex(/^[a-f0-9]{64}$/i), verificationMethod: z.string().trim().min(1).max(1000), verifier: z.string().trim().min(1).max(320).optional(), validUntil: z.string().trim().min(1).max(64).optional() });
const materialEvidenceInput = z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(128).optional(), base64: z.string().min(1).max(7_000_000), type: z.enum(["MATERIAL_DATASHEET", "MANUFACTURER_SPECIFICATION", "TEST_REPORT", "PUBLISHED_RESEARCH", "STANDARDS_DOCUMENTATION", "USER_MEASUREMENT"]), source: z.string().trim().min(1).max(500), sourceDate: z.string().trim().min(1).max(64).optional(), material: z.string().trim().min(1).max(160), materialGrade: z.string().trim().min(1).max(160).optional(), property: z.enum(["ELASTIC_MODULUS", "POISSON_RATIO", "DENSITY", "YIELD_STRENGTH", "THERMAL_CONDUCTIVITY", "THERMAL_EXPANSION", "SPECIFIC_HEAT", "CUSTOM"]), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), condition: z.string().trim().min(1).max(500).optional(), measurementUncertainty: z.string().trim().min(1).max(160).optional(), temperature: z.string().trim().min(1).max(160).optional(), strainRate: z.string().trim().min(1).max(160).optional(), direction: z.string().trim().min(1).max(160).optional(), batch: z.string().trim().min(1).max(160).optional(), measurementDate: z.string().trim().min(1).max(64).optional(), provenance: z.enum(["VERIFIED_SOURCE", "USER_PROVIDED", "EXPERIMENTALLY_MEASURED", "CALCULATED", "ASSUMED", "UNKNOWN"]), verificationStatus: z.enum(["VERIFIED", "UNVALIDATED", "CONFLICT", "UNKNOWN"]).optional() });
const experimentalPlanInput = z.object({ simulationId: z.string().trim().min(1).max(160), objective: z.string().trim().min(1).max(2000), hypothesis: z.string().trim().min(1).max(2000), testArticle: z.string().trim().min(1).max(1000), instrumentation: z.array(z.string().trim().min(1).max(500)).max(64), loads: z.array(z.string().trim().min(1).max(500)).max(64), boundaryConditions: z.array(z.string().trim().min(1).max(500)).max(64), measurements: z.array(z.string().trim().min(1).max(500)).max(64), samplingRate: z.string().trim().min(1).max(128).optional(), environment: z.string().trim().min(1).max(500).optional(), acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(64), uncertainties: z.array(z.string().trim().min(1).max(500)).max(64), repeatability: z.string().trim().min(1).max(1000), safetyRequirements: z.array(z.string().trim().min(1).max(500)).max(64), simulationComparison: z.string().trim().min(1).max(2000) });
const propertyName = z.enum(["ELASTIC_MODULUS", "POISSON_RATIO", "DENSITY", "YIELD_STRENGTH", "THERMAL_CONDUCTIVITY", "THERMAL_EXPANSION", "SPECIFIC_HEAT", "CUSTOM"]);
const measurementMetadataInput = z.object({ source: z.string().trim().min(1).max(500), instrument: z.string().trim().min(1).max(160).optional(), instrumentId: z.string().trim().min(1).max(160).optional(), operator: z.string().trim().min(1).max(160).optional(), testDate: z.string().trim().min(1).max(64).optional(), units: z.string().trim().min(1).max(160).optional(), samplingRate: z.string().trim().min(1).max(128).optional(), environment: z.string().trim().min(1).max(500).optional(), temperature: z.string().trim().min(1).max(128).optional(), humidity: z.string().trim().min(1).max(128).optional(), testArticle: z.string().trim().min(1).max(320).optional(), testRevision: z.string().trim().min(1).max(160).optional(), calibrationStatus: z.enum(["CALIBRATED", "UNCALIBRATED", "UNKNOWN"]), uncertainty: z.string().trim().min(1).max(500).optional(), provenance: z.enum(["MEASURED", "SIMULATED", "CALCULATED", "DERIVED", "ASSUMED", "UNKNOWN"]) });
const adapterRegistrationInput = z.object({ solverId: z.string().trim().min(1).max(160), solverName: z.string().trim().min(1).max(240), version: z.string().trim().min(1).max(80), provider: z.string().trim().min(1).max(240), adapterVersion: z.string().trim().min(1).max(80), supportedAnalysisTypes: z.array(z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"])).max(8), capabilities: z.array(z.string().trim().min(1).max(240)).max(64), executionMode: z.enum(["LOCAL_ADAPTER", "REMOTE_ADAPTER", "CLOUD_UNCONFIGURED"]), inputSchemaVersion: z.string().trim().min(1).max(80), outputSchemaVersion: z.string().trim().min(1).max(80), securityRequirements: z.array(z.string().trim().min(1).max(500)).max(64), adapterManifest: z.string().trim().min(1).max(100_000), adapterHash: z.string().trim().regex(/^[a-fA-F0-9]{64}$/), publisherIdentity: z.string().trim().min(1).max(320), signature: z.string().trim().min(1).max(20_000).optional(), capabilityManifest: z.array(z.string().trim().min(1).max(240)).max(64) });
const reviewerPermission = z.enum(["APPROVE_MATERIAL", "APPROVE_CALIBRATION", "APPROVE_SOLVER_ADAPTER", "APPROVE_VALIDATION"]);
const adapterPermission = z.enum(["READ_CAD", "READ_REQUIREMENTS", "READ_MATERIAL_EVIDENCE", "READ_CAE_PLAN", "WRITE_RESULTS", "WRITE_LOGS", "NETWORK_ACCESS", "FILESYSTEM_ACCESS"]);
const sandboxInput = z.object({ sandboxType: z.enum(["DECLARATION_ONLY", "CONTAINER", "VM", "UNKNOWN"]).optional(), resourceLimits: z.array(z.string().trim().min(1).max(240)).max(32).optional(), filesystemScope: z.array(z.string().trim().min(1).max(240)).max(32).optional(), networkPolicy: z.enum(["NO_NETWORK", "DECLARATION_ONLY"]).optional(), timeoutSeconds: z.number().int().positive().max(86_400).optional(), memoryLimitMiB: z.number().int().positive().max(1_048_576).optional(), cpuLimit: z.number().positive().max(4096).optional(), allowedInputs: z.array(z.string().trim().min(1).max(240)).max(32).optional(), allowedOutputs: z.array(z.string().trim().min(1).max(240)).max(32).optional() }).optional();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i);
const boundedReference = z.string().trim().min(1).max(320).regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/);
const caeJobInput = z.object({ cadRevision: boundedReference, cadGeometryHash: sha256, cadBindingId: boundedReference, cadProjectId: boundedReference, requirementRevision: boundedReference, analysisType: z.literal("STATIC_STRUCTURAL"), analysisVersion: boundedReference, materialReference: boundedReference, materialEvidenceHash: sha256, boundaryConditions: z.array(z.object({ boundaryId: boundedReference, geometryReference: boundedReference, type: z.enum(["FIXED", "DISPLACEMENT", "SYMMETRY", "ROLLER"]), magnitude: z.number().finite().optional(), unit: z.enum(["mm", "m"]).optional(), sourceHash: sha256 })).min(1).max(32), loads: z.array(z.object({ loadId: boundedReference, geometryReference: boundedReference, type: z.enum(["FORCE", "PRESSURE"]), magnitude: z.number().finite(), unit: z.enum(["N", "kN", "Pa", "MPa"]), direction: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z", "NORMAL"]), sourceHash: sha256 })).min(1).max(32), contacts: z.array(z.object({ contactId: boundedReference, type: z.enum(["BONDED", "FRICTIONLESS", "FRICTIONAL", "NO_SEPARATION"]), primaryGeometryReference: boundedReference, secondaryGeometryReference: boundedReference, sourceHash: sha256 })).max(32), meshStrategy: z.object({ strategyReference: boundedReference, strategyHash: sha256, elementIntent: z.enum(["TETRAHEDRAL", "HEXA_HYBRID", "SHELL", "BEAM"]), targetSize: z.number().positive().finite().optional(), unit: z.enum(["mm", "m"]).optional(), qualityRequirements: z.array(z.string().trim().min(1).max(1000)).min(1).max(32), status: z.enum(["PLANNED", "NOT_EXECUTED", "UNKNOWN"]) }), solverReference: z.literal("CALCULIX_LINEAR_STATIC_SCHEMA_ONLY"), solverVersion: boundedReference, environmentReference: boundedReference, resourcePolicy: z.object({ policyReference: boundedReference, policyVersion: boundedReference, policyHash: sha256, environmentReference: boundedReference, constraints: z.array(z.enum(["CPU_LIMIT", "MEMORY_LIMIT", "DISK_LIMIT", "EXECUTION_TIMEOUT", "INPUT_SIZE_LIMIT", "OUTPUT_SIZE_LIMIT", "PROCESS_LIMIT", "CONCURRENT_JOB_LIMIT"])).length(8) }), expectedOutputs: z.array(z.enum(["DISPLACEMENT", "VON_MISES_STRESS", "SOLVER_LOG", "EXECUTION_RECEIPT"])).min(2).max(4), verificationRequirements: z.array(z.enum(["INPUT_INTEGRITY", "CAD_IDENTITY", "MESH_IDENTITY", "SOLVER_IDENTITY", "SOLVER_VERSION", "UNITS", "BOUNDARY_CONDITIONS", "MATERIAL", "CONVERGENCE", "WARNINGS", "RESULT_INTEGRITY", "REPRODUCIBILITY"])).length(12), provenance: z.object({ requirementIds: z.array(boundedReference).min(1).max(128), requirementRevision: boundedReference, requirementHash: sha256, cadRevision: boundedReference, cadGeometryHash: sha256, cadBindingId: boundedReference, cadProjectId: boundedReference, materialReference: boundedReference, materialEvidenceHash: sha256, sourcePlanId: boundedReference.optional(), createdBy: z.string().trim().min(1).max(160), createdAt: z.string().trim().min(1).max(64).optional() }), createdBy: z.string().trim().min(1).max(160) });
const meshArtifactInput = z.object({ jobId: z.string().trim().min(1).max(160), sourceCadHash: sha256, nodeCount: z.number().int().nonnegative().optional(), elementCount: z.number().int().nonnegative().optional(), elementTypes: z.array(z.enum(["TETRA4", "TETRA10", "HEXA8", "SHELL4", "BEAM2", "UNKNOWN"])).min(1).max(16), coordinatesHash: sha256, connectivityHash: sha256, qualitySummary: z.enum(["NOT_MEASURED", "UNKNOWN"]), units: z.enum(["mm", "m", "UNKNOWN"]), generatorReference: boundedReference, generatorVersion: boundedReference });
const solverArtifactInput = z.object({ solverName: boundedReference, solverVersion: boundedReference, artifactHash: sha256, source: boundedReference, signatureStatus: z.enum(["UNVERIFIED", "VERIFIED_NON_EXECUTABLE", "INVALID", "UNKNOWN"]), allowlistStatus: z.enum(["ALLOWLISTED_NON_EXECUTABLE", "NOT_ALLOWLISTED", "REVOKED", "UNKNOWN"]), capabilities: z.array(z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"])).max(8), licenseReference: z.string().trim().min(1).max(1000), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(32) });
const resultArtifactInput = z.object({ jobId: z.string().trim().min(1).max(160), solverReference: z.literal("CALCULIX_LINEAR_STATIC_SCHEMA_ONLY"), inputHash: sha256, meshHash: sha256, resultHash: sha256, resultTypes: z.array(z.enum(["DISPLACEMENT", "VON_MISES_STRESS", "REACTION_FORCE", "UNKNOWN"])).min(1).max(8), units: z.array(z.string().trim().min(1).max(64)).max(16), convergenceStatus: z.enum(["NOT_AVAILABLE", "UNKNOWN", "DIVERGED"]), warnings: z.array(z.string().trim().min(1).max(1000)).max(64), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(32) });
const planSnapshotInput = z.object({ simulationId: boundedReference, cadBindingId: boundedReference, sourceCadGeometryHash: sha256, requirementRevision: boundedReference, requirementHash: sha256, materialEvidenceHash: sha256, expectedOutputs: z.array(z.enum(["DISPLACEMENT", "VON_MISES_STRESS", "SOLVER_LOG", "EXECUTION_RECEIPT"])).min(2).max(4) });
const meshQualityMetricInput = z.object({ metric: z.enum(["ASPECT_RATIO", "SKEWNESS", "JACOBIAN", "WARPAGE", "MINIMUM_ELEMENT_QUALITY", "MAXIMUM_ELEMENT_QUALITY", "DEGENERATE_ELEMENTS", "INVERTED_ELEMENTS", "DUPLICATE_NODES", "FREE_EDGES", "UNKNOWN"]), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(64).optional(), source: z.enum(["MEASURED", "DECLARED", "UNKNOWN"]), status: z.enum(["KNOWN", "UNKNOWN", "NOT_AVAILABLE"]), evidenceHash: sha256.optional() });
const meshQualityThresholdInput = z.object({ metric: z.enum(["ASPECT_RATIO", "SKEWNESS", "JACOBIAN", "WARPAGE", "MINIMUM_ELEMENT_QUALITY", "MAXIMUM_ELEMENT_QUALITY", "DEGENERATE_ELEMENTS", "INVERTED_ELEMENTS", "DUPLICATE_NODES", "FREE_EDGES", "UNKNOWN"]), value: z.number().finite(), unit: z.string().trim().min(1).max(64), source: z.string().trim().min(1).max(500), version: z.string().trim().min(1).max(96), rationale: z.string().trim().min(1).max(2000), evidenceHash: sha256 });
const meshQualityEvidenceInput = z.object({ meshId: boundedReference, jobId: boundedReference, sourceCadHash: sha256, meshGenerator: boundedReference, meshGeneratorVersion: boundedReference, elementTypes: z.array(z.enum(["TETRA4", "TETRA10", "HEXA8", "SHELL4", "BEAM2", "UNKNOWN"])).min(1).max(16), elementCount: z.number().int().nonnegative().optional(), nodeCount: z.number().int().nonnegative().optional(), qualityMetrics: z.array(meshQualityMetricInput).min(1).max(32), qualityThresholds: z.array(meshQualityThresholdInput).min(1).max(32), provenance: z.object({ cadRevision: boundedReference, cadGeometryHash: sha256, jobId: boundedReference, jobRevision: z.number().int().positive(), meshArtifactId: boundedReference, meshGenerator: boundedReference, meshGeneratorVersion: boundedReference, qualityAlgorithm: boundedReference, qualityAlgorithmVersion: boundedReference, thresholdVersion: z.string().trim().min(1).max(96), references: z.array(z.string().trim().min(1).max(500)).min(1).max(32) }), reportedStatus: z.enum(["NOT_AVAILABLE", "UNKNOWN", "PASS", "FAIL", "WARNING"]).optional() });
const meshQualityVerificationInput = z.object({ meshQualityEvidenceId: boundedReference, submitter: z.string().trim().min(1).max(160), verifier: boundedReference, reviewerAuthorizationId: boundedReference, validFrom: z.string().trim().min(1).max(64), validUntil: z.string().trim().min(1).max(64), verificationMethod: boundedReference, verificationVersion: boundedReference, findings: z.array(z.string().trim().min(1).max(2000)).max(32), requestedStatus: z.enum(["VERIFIED", "REJECTED", "CONFLICT", "UNKNOWN"]) });
const solverInputPackageInput = z.object({ jobId: boundedReference, meshId: boundedReference, meshHash: sha256, meshQualityEvidenceId: boundedReference, meshQualityVerificationId: boundedReference, solverConfigurationId: boundedReference, solverConfigurationHash: sha256 });
const cadBindingInput = z.object({ cadProjectId: boundedReference, cadRevision: boundedReference, cadGeometryHash: sha256, source: z.string().trim().min(1).max(1000), creator: z.string().trim().min(1).max(160), revision: z.number().int().positive(), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(32) });
const runtimeAssuranceGateInput = z.enum(["G0_APPROVED_TEST_ENVIRONMENT", "G1_REAL_SANDBOX", "G2_ESCAPE_RESISTANCE", "G3_RESOURCE_ISOLATION", "G4_REAL_GMSH", "G5_MESH_VERIFICATION", "G6_REAL_CALCULIX", "G7_NUMERICAL_VALIDATION", "G8_RESULT_INTEGRITY", "G9_HOSTILE_SECURITY_TESTING", "G10_FAILURE_RECOVERY", "G11_REPRODUCIBILITY", "G12_INDEPENDENT_REVIEW", "G13_PRODUCTION_READINESS"]);
const runtimeAssuranceStateInput = z.enum(["PASS", "FAIL", "UNKNOWN", "BLOCKED", "INCONCLUSIVE"]);
const runtimeAssuranceEnvironmentInput = z.object({ environmentId: boundedReference, imageBaseline: z.string().trim().min(1).max(320), operatingSystem: z.string().trim().min(1).max(320), kernel: z.string().trim().min(1).max(320), cpuLimit: z.string().trim().min(1).max(160), memoryLimit: z.string().trim().min(1).max(160), storageLimit: z.string().trim().min(1).max(160), networkPolicy: z.string().trim().min(1).max(1000), timeoutPolicy: z.string().trim().min(1).max(1000), environmentHash: sha256, provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), approvalState: z.enum(["APPROVED", "UNKNOWN", "REVOKED", "EXPIRED"]), approvalScope: z.enum(["INTERNAL_VERIFIED", "INDEPENDENTLY_VERIFIED", "EXTERNAL_REVIEW_REQUIRED"]), approvedByReviewerId: boundedReference.optional(), reviewerAuthorizationId: boundedReference.optional(), validFrom: z.string().trim().min(1).max(64), validUntil: z.string().trim().min(1).max(64), observedEvidenceHash: sha256 });
const runtimeAssuranceObservedTestInput = z.object({ gateId: runtimeAssuranceGateInput, testId: boundedReference, evidenceScope: z.enum(["INTERNAL_VERIFIED", "INDEPENDENTLY_VERIFIED", "EXTERNAL_REVIEW_REQUIRED"]), evidenceOrigin: z.enum(["EXTERNAL_OBSERVED", "INTERNAL_TEST", "FUTURE_DEFINITION"]), environmentId: boundedReference, performerIdentity: z.string().trim().min(1).max(160), reviewerId: boundedReference.optional(), reviewerAuthorizationId: boundedReference.optional(), expectedBehavior: z.string().trim().min(1).max(4000), observedBehavior: z.string().trim().min(1).max(4000), inputHash: sha256, rawEvidenceHash: sha256, result: runtimeAssuranceStateInput, timestamp: z.string().trim().min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64) });
const runtimeAssuranceFailureInput = z.object({ gateId: runtimeAssuranceGateInput, rootCauseId: boundedReference, classification: z.enum(["CODE", "DATA", "ARCHITECTURE", "SECURITY", "INFRASTRUCTURE", "NUMERICAL", "EVIDENCE", "GOVERNANCE", "EXTERNAL_DEPENDENCY"]), observedEvidenceIds: z.array(boundedReference).max(64), rootCauseSummary: z.string().trim().min(1).max(4000), remainingRisk: z.string().trim().min(1).max(4000) });
const runtimeAssuranceRepairInput = z.object({ failureId: boundedReference, rootCauseId: boundedReference, repairStrategy: z.string().trim().min(1).max(4000), targetedTestReference: boundedReference, regressionStatus: z.enum(["NOT_RUN", "PASS", "FAIL", "UNKNOWN"]), result: z.enum(["REPAIRED", "NOT_REPAIRED", "BLOCKED", "INCONCLUSIVE"]), evidence: z.array(z.string().trim().min(1).max(1000)).max(64) });
const runtimeAdmissionInput = z.object({ requestedAction: z.enum(["GMSH_MESH", "CALCULIX_SOLVE"]), canonicalJobId: boundedReference, solverInputPackageId: boundedReference, configurationId: boundedReference, environmentId: boundedReference }).strict();
const reviewerAuthorizationInput = z.object({ reviewerId: boundedReference, organization: z.string().trim().min(1).max(320), role: z.string().trim().min(1).max(320), authorizationScope: z.array(reviewerPermission).min(1).max(4), authorizationSource: z.string().trim().min(1).max(1000), authorizationHash: sha256, issuedBy: z.string().trim().min(1).max(320), validFrom: z.string().trim().min(1).max(64), validUntil: z.string().trim().min(1).max(64), independenceStatement: z.string().trim().min(1).max(2000) });
const solverConfigurationParameterInput = z.object({ name: boundedReference, type: z.enum(["NUMBER", "INTEGER", "BOOLEAN", "ENUM", "STRING"]), required: z.boolean(), allowedValues: z.array(z.union([z.string().trim().min(1).max(160), z.number().finite(), z.boolean()])).max(64).optional(), unit: z.string().trim().min(1).max(64).optional(), defaultValue: z.union([z.string().trim().min(1).max(160), z.number().finite(), z.boolean()]).optional(), minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), constraints: z.array(z.string().trim().min(1).max(1000)).max(32), incompatibleWith: z.array(boundedReference).max(32) });
const solverConfigurationRegistryInput = z.object({ solverName: boundedReference, solverVersion: boundedReference, analysisType: z.literal("STATIC_STRUCTURAL"), configurationSchemaVersion: boundedReference, supportedParameters: z.array(solverConfigurationParameterInput).max(64), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(32), evidenceHashes: z.array(sha256).min(1).max(32), status: z.enum(["DRAFT", "REVIEWED", "DEPRECATED", "REVOKED", "UNKNOWN"]) });
const securityControlInput = z.object({ controlId: z.enum(["PROCESS_ISOLATION", "FILESYSTEM_ISOLATION", "NETWORK_ISOLATION", "RESOURCE_LIMITS", "CPU_LIMITS", "MEMORY_LIMITS", "EXECUTION_TIMEOUT", "STORAGE_LIMITS", "PRIVILEGE_BOUNDARIES", "SECRET_ISOLATION", "DEPENDENCY_ISOLATION", "EGRESS_CONTROL", "FAILURE_CONTAINMENT", "AUDITABILITY", "REPRODUCIBILITY"]), state: z.enum(["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]), evidenceIds: z.array(boundedReference).max(64), rationale: z.string().trim().min(1).max(2000) });
const sandboxSecurityAttestationInput = z.object({ rubricId: boundedReference, attestationSubject: z.string().trim().min(1).max(320), attestationScope: z.string().trim().min(1).max(2000), attestorIdentity: boundedReference, attestorAuthorizationId: boundedReference, independence: z.enum(["INDEPENDENT", "SELF_ATTESTATION", "CONFLICT", "UNKNOWN"]), evidenceSource: z.string().trim().min(1).max(1000), evidenceHash: sha256, issuedAt: z.string().trim().min(1).max(64), validFrom: z.string().trim().min(1).max(64), validUntil: z.string().trim().min(1).max(64), controlAssessments: z.array(securityControlInput).length(15), selfAttestationReviewRequired: z.boolean() });
const artifactDependencyInput = z.object({ name: z.string().trim().min(1).max(320), version: z.string().trim().min(1).max(160), sha256: sha256.optional(), source: z.string().trim().min(1).max(1000), knownVulnerabilityState: z.enum(["NONE_DECLARED", "KNOWN", "UNKNOWN", "CONFLICT"]), evidenceHash: sha256.optional() });
const artifactSBOMReviewInput = z.object({ artifactIdentity: boundedReference, artifactVersion: boundedReference, artifactHash: sha256, signature: z.string().trim().min(1).max(20_000).optional(), signatureHash: sha256.optional(), publisher: z.string().trim().min(1).max(320), source: z.string().trim().min(1).max(1000), license: z.string().trim().min(1).max(1000), dependencies: z.array(artifactDependencyInput).min(1).max(128), sbomReference: boundedReference, sbomHash: sha256, knownVulnerabilities: z.array(z.string().trim().min(1).max(1000)).max(128), buildProvenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), reproducibilityEvidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), reviewerId: boundedReference.optional(), reviewerAuthorizationId: boundedReference.optional(), reviewIssuedAt: z.string().trim().min(1).max(64), reviewValidFrom: z.string().trim().min(1).max(64), reviewValidUntil: z.string().trim().min(1).max(64), reviewStatus: z.enum(["UNKNOWN", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVOKED", "EXPIRED"]), revocationState: z.enum(["CURRENT", "EXPIRED", "REVOKED", "UNKNOWN", "CONFLICT"]).optional(), findings: z.array(z.string().trim().min(1).max(2000)).max(64) });
const hostileTestEvidenceInput = z.object({ testId: boundedReference, testCategory: z.enum(["RESOURCE_EXHAUSTION", "MEMORY_EXHAUSTION", "TIMEOUT", "FILESYSTEM_ESCAPE", "NETWORK_ESCAPE", "PRIVILEGE_ESCALATION", "MALFORMED_INPUT", "CORRUPTED_ARTIFACT", "DEPENDENCY_COMPROMISE", "OUTPUT_TAMPERING", "RESULT_SPOOFING", "SANDBOX_BOUNDARY_VIOLATION"]), testObjective: z.string().trim().min(1).max(2000), environmentIdentity: boundedReference, testInputHash: sha256, expectedBehavior: z.string().trim().min(1).max(4000), observedBehavior: z.string().trim().min(1).max(4000), result: z.enum(["PASS", "FAIL", "UNKNOWN", "INCONCLUSIVE"]), rawEvidenceHash: sha256, timestamp: z.string().trim().min(1).max(64), reviewerId: boundedReference, reviewerAuthorizationId: boundedReference, limitations: z.array(z.string().trim().min(1).max(2000)).max(64), reproducibilityInformation: z.array(z.string().trim().min(1).max(2000)).min(1).max(64) });
const digitalThreadArtifactInput = z.object({ kind: z.enum(["REQUIREMENT_SET", "CONCEPT", "CAD_MODEL", "CAD_FEATURE", "CAE_PLAN", "CAE_JOB", "CAE_EVIDENCE", "OPTIMIZATION_STUDY", "OPTIMIZATION_CANDIDATE", "DRAWING_PACKAGE", "BOM_ITEM", "PLM_REVISION", "MANUFACTURING_PLAN", "VERIFICATION_TEST", "REVIEW_GATE", "RELEASE_GATE"]), title: z.string().trim().min(1).max(500), revision: boundedReference, state: z.enum(["DECLARED", "EVIDENCE_LINKED", "REVIEW_REQUIRED", "REJECTED", "STALE", "UNKNOWN"]), truthStatus: z.enum(["FACT", "CALCULATED", "DERIVED", "ESTIMATED", "ASSUMED", "HYPOTHETICAL", "UNVERIFIED", "SPECULATIVE", "PHYSICS_CONFLICT", "UNKNOWN"]), sourceArtifactIds: z.array(boundedReference).max(64).default([]), externalSourceRecordIds: z.array(boundedReference).max(64).default([]), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const digitalThreadRelationInput = z.object({ fromArtifactId: boundedReference, toArtifactId: boundedReference, kind: z.enum(["DERIVES_FROM", "REALIZES", "IMPLEMENTS", "VALIDATES", "OPTIMIZES", "DOCUMENTS", "CONTAINS", "MANUFACTURES", "REQUIRES_REVIEW", "SUPERSEDES"]), evidenceRecordIds: z.array(boundedReference).max(64), state: z.enum(["DECLARED", "EVIDENCE_LINKED", "UNKNOWN"]), rationale: z.string().trim().min(1).max(2000), createdBy: z.string().trim().min(1).max(160) });
const engineeringTruthStatusInput = z.enum(["FACT", "CALCULATED", "DERIVED", "ESTIMATED", "ASSUMED", "HYPOTHETICAL", "UNVERIFIED", "SPECULATIVE", "PHYSICS_CONFLICT", "UNKNOWN"]);
const drawingPackageInput = z.object({ title: z.string().trim().min(1).max(500), revision: boundedReference, sourceCadArtifactIds: z.array(boundedReference).min(1).max(64), sourceCadRevision: boundedReference, sourceCadHash: sha256.optional(), views: z.array(z.object({ viewId: boundedReference, kind: z.enum(["ORTHOGRAPHIC", "SECTION", "DETAIL", "ISOMETRIC", "AUXILIARY"]), label: z.string().trim().min(1).max(320), sourceGeometryReference: z.string().trim().min(1).max(500).optional(), declaredOnly: z.literal(true) })).min(1).max(32), dimensions: z.array(z.object({ dimensionId: boundedReference, label: z.string().trim().min(1).max(320), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(64).optional(), sourceReference: z.string().trim().min(1).max(500).optional(), truthStatus: engineeringTruthStatusInput })).max(128), annotations: z.array(z.object({ annotationId: boundedReference, text: z.string().trim().min(1).max(1000), category: z.enum(["GENERAL", "TOLERANCE", "GD_T_REPRESENTATION", "DATUM_REPRESENTATION", "NOTE"]), truthStatus: engineeringTruthStatusInput })).max(128), titleBlock: z.object({ partNumber: boundedReference.optional(), drawingNumber: boundedReference.optional(), preparedBy: z.string().trim().min(1).max(160), status: z.enum(["DRAFT", "REVIEW_REQUIRED"]) }), state: z.enum(["DECLARED", "REVIEW_REQUIRED", "CAD_REFERENCE_UNRESOLVED", "REJECTED", "UNKNOWN"]), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const bomRevisionInput = z.object({ title: z.string().trim().min(1).max(500), revision: boundedReference, sourceArtifactIds: z.array(boundedReference).min(1).max(64), items: z.array(z.object({ lineId: boundedReference, partNumber: boundedReference, title: z.string().trim().min(1).max(500), quantity: z.number().positive().finite(), sourceArtifactId: boundedReference, materialReference: z.string().trim().min(1).max(320).optional(), supplier: z.string().trim().min(1).max(320).optional(), supplierSource: z.enum(["USER_PROVIDED", "UNKNOWN"]).optional(), truthStatus: engineeringTruthStatusInput })).min(1).max(256), state: z.enum(["DECLARED", "REVIEW_REQUIRED", "REJECTED", "UNKNOWN"]), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const plmRevisionInput = z.object({ partNumber: boundedReference, revision: boundedReference, parentPLMRevisionId: boundedReference.optional(), sourceArtifactIds: z.array(boundedReference).min(1).max(64), lifecycleState: z.enum(["DESIGN", "REVIEW", "RELEASE_CANDIDATE", "SUPERSEDED", "BLOCKED"]), engineeringChangeReason: z.string().trim().min(1).max(2000), comparisonSummary: z.string().trim().min(1).max(2000), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const manufacturingPlanInput = z.object({ title: z.string().trim().min(1).max(500), revision: boundedReference, sourceArtifactIds: z.array(boundedReference).min(1).max(64), processIntent: z.array(z.enum(["MILLING", "TURNING", "DRILLING", "SHEET_METAL", "ADDITIVE", "ASSEMBLY", "MIXED", "UNKNOWN"])).min(1).max(8), materialProcessCompatibility: z.array(z.object({ materialReference: z.string().trim().min(1).max(320), process: z.enum(["MILLING", "TURNING", "DRILLING", "SHEET_METAL", "ADDITIVE", "ASSEMBLY", "MIXED", "UNKNOWN"]), status: z.enum(["DECLARED", "UNKNOWN", "CONFLICT"]), rationale: z.string().trim().min(1).max(1000) })).max(64), dfmFindings: z.array(z.object({ findingId: boundedReference, category: z.enum(["DFM", "DFA", "SETUP", "TOOLING", "INSPECTION", "MATERIAL"]), finding: z.string().trim().min(1).max(2000), truthStatus: engineeringTruthStatusInput, requiredEvidence: z.array(z.string().trim().min(1).max(1000)).max(32) })).max(128), setupPlanning: z.array(z.object({ setupId: boundedReference, description: z.string().trim().min(1).max(1000), status: z.enum(["DECLARED", "UNKNOWN"]) })).max(64), toolSelectionMetadata: z.array(z.object({ toolId: boundedReference, description: z.string().trim().min(1).max(1000), source: z.enum(["USER_PROVIDED", "DECLARED", "UNKNOWN"]), capabilityVerified: z.literal(false).optional() })).max(128), inspectionPlanning: z.array(z.object({ inspectionId: boundedReference, characteristic: z.string().trim().min(1).max(1000), method: z.string().trim().min(1).max(1000).optional(), status: z.enum(["DECLARED", "UNKNOWN"]) })).max(128), state: z.enum(["DECLARED", "REVIEW_REQUIRED", "REJECTED", "UNKNOWN"]), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const optimizationVariableInput = z.object({ variableId: boundedReference, name: z.string().trim().min(1).max(320), kind: z.enum(["CONTINUOUS", "INTEGER", "ENUM", "BOOLEAN"]), unit: z.string().trim().min(1).max(64).optional(), minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), allowedValues: z.array(z.union([z.string().trim().min(1).max(160), z.number().finite(), z.boolean()])).max(64).optional(), sourceArtifactId: boundedReference, truthStatus: engineeringTruthStatusInput });
const optimizationObjectiveInput = z.object({ objectiveId: boundedReference, title: z.string().trim().min(1).max(500), direction: z.enum(["MINIMIZE", "MAXIMIZE", "TARGET"]), metricReference: z.string().trim().min(1).max(1000), unit: z.string().trim().min(1).max(64).optional(), sourceArtifactIds: z.array(boundedReference).min(1).max(64), evaluationAvailability: z.enum(["NUMERICAL_CAE_UNAVAILABLE", "CONCEPTUAL_ONLY", "UNKNOWN"]), truthStatus: engineeringTruthStatusInput });
const optimizationConstraintInput = z.object({ constraintId: boundedReference, title: z.string().trim().min(1).max(500), comparison: z.enum(["LESS_THAN_OR_EQUAL", "GREATER_THAN_OR_EQUAL", "EQUAL", "DECLARED"]), targetValue: z.number().finite().optional(), unit: z.string().trim().min(1).max(64).optional(), sourceArtifactIds: z.array(boundedReference).min(1).max(64), evaluationAvailability: z.enum(["NUMERICAL_CAE_UNAVAILABLE", "CONCEPTUAL_ONLY", "UNKNOWN"]), truthStatus: engineeringTruthStatusInput });
const optimizationStudyInput = z.object({ title: z.string().trim().min(1).max(500), revision: boundedReference, sourceArtifactIds: z.array(boundedReference).min(1).max(64), method: z.enum(["CONCEPTUAL_DESIGN_SPACE", "PARAMETER_SWEEP_DECLARATION", "SENSITIVITY_PLAN", "SINGLE_OBJECTIVE_PLAN", "MULTI_OBJECTIVE_PLAN", "PARETO_PLAN"]), variables: z.array(optimizationVariableInput).min(1).max(64), objectives: z.array(optimizationObjectiveInput).min(1).max(64), constraints: z.array(optimizationConstraintInput).max(64), state: z.enum(["DECLARED", "REVIEW_REQUIRED", "REJECTED", "UNKNOWN"]), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });
const optimizationCandidateInput = z.object({ optimizationStudyId: boundedReference, candidateLabel: z.string().trim().min(1).max(320), parameterValues: z.array(z.object({ variableId: boundedReference, value: z.union([z.string().trim().min(1).max(160), z.number().finite(), z.boolean()]), truthStatus: engineeringTruthStatusInput })).min(1).max(64), sourceArtifactIds: z.array(boundedReference).max(64), provenance: z.array(z.string().trim().min(1).max(1000)).min(1).max(64), limitations: z.array(z.string().trim().min(1).max(1000)).max(64), declaredBy: z.string().trim().min(1).max(160) });

export const appRouter = router({
  system: systemRouter,
  runtimeEvidence: router({
    authoritative: publicProcedure.query(() => readAuthoritativeRuntimeEvidence()),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  engineeringJobs: router({
    submit: publicProcedure.input(caeAccess.extend({ request: engineeringJobInput })).mutation(({ input }) => submitEngineeringJob({ projectId: input.projectId, accessKey: input.accessKey, request: input.request })),
    list: publicProcedure.input(caeAccess).query(({ input }) => listEngineeringJobs(input)),
    get: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(({ input }) => getEngineeringJob(input)),
    reconcileAuthoritativeRuntime: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).mutation(({ input }) => reconcileEngineeringJobFromAuthoritativeEvidence(input)),
    status: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => {
      const job = await getEngineeringJob(input);
      return job ? { jobId: job.jobId, state: job.state, runtimeDispatch: job.runtimeDispatch, updatedAt: job.updatedAt, events: job.events } : null;
    }),
    requirements: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => (await getEngineeringJob(input))?.requirementSet ?? null),
    cad: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => (await getEngineeringJob(input))?.cad ?? null),
    cae: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => (await getEngineeringJob(input))?.caeConfiguration ?? null),
    manifest: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => (await getEngineeringJob(input))?.manifest ?? null),
    mesh: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => {
      const job = await getEngineeringJob(input);
      return job ? job.runtimeEvidence ? { jobId: job.jobId, available: true, gmshHash: job.runtimeEvidence.gmshHash, meshHash: job.runtimeEvidence.meshHash, executionLogHash: job.runtimeEvidence.executionLogHash } : { jobId: job.jobId, available: false, reason: "No verified runtime mesh artifact has been reconciled into this persistent engineering job." } : null;
    }),
    result: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => {
      const job = await getEngineeringJob(input);
      return job ? job.runtimeEvidence ? { jobId: job.jobId, available: true, calculixHash: job.runtimeEvidence.calculixHash, inputHash: job.runtimeEvidence.inputHash, outputHash: job.runtimeEvidence.outputHash, resultHash: job.runtimeEvidence.resultHash, evidenceHash: job.runtimeEvidence.evidenceHash } : { jobId: job.jobId, available: false, reason: "No verified runtime CalculiX result has been reconciled into this persistent engineering job." } : null;
    }),
    evidence: publicProcedure.input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) })).query(async ({ input }) => {
      const job = await getEngineeringJob(input);
      return job ? { jobId: job.jobId, events: job.events, manifestHash: job.manifest?.manifestHash, runtimeDispatch: job.runtimeDispatch } : null;
    }),
  }),

  digitalThread: router({
    createArtifact: publicProcedure.input(caeAccess.extend({ input: digitalThreadArtifactInput })).mutation(({ input }) => createDigitalThreadArtifact({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listArtifacts: publicProcedure.input(caeAccess).query(({ input }) => listDigitalThreadArtifacts(input)),
    createRelation: publicProcedure.input(caeAccess.extend({ input: digitalThreadRelationInput })).mutation(({ input }) => createDigitalThreadRelation({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listRelations: publicProcedure.input(caeAccess).query(({ input }) => listDigitalThreadRelations(input)),
    assess: publicProcedure.input(caeAccess).mutation(({ input }) => assessDigitalThread(input)),
  }),

  planning: router({
    createDrawingPackage: publicProcedure.input(caeAccess.extend({ input: drawingPackageInput })).mutation(({ input }) => createDrawingPackage({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listDrawingPackages: publicProcedure.input(caeAccess).query(({ input }) => listDrawingPackages(input)),
    createBOMRevision: publicProcedure.input(caeAccess.extend({ input: bomRevisionInput })).mutation(({ input }) => createBOMRevision({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listBOMRevisions: publicProcedure.input(caeAccess).query(({ input }) => listBOMRevisions(input)),
    createPLMRevision: publicProcedure.input(caeAccess.extend({ input: plmRevisionInput })).mutation(({ input }) => createPLMRevision({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listPLMRevisions: publicProcedure.input(caeAccess).query(({ input }) => listPLMRevisions(input)),
    createManufacturingPlan: publicProcedure.input(caeAccess.extend({ input: manufacturingPlanInput })).mutation(({ input }) => createManufacturingPlan({ projectId: input.projectId, accessKey: input.accessKey, ...input.input, toolSelectionMetadata: input.input.toolSelectionMetadata.map((tool) => ({ ...tool, capabilityVerified: false as const })) })),
    listManufacturingPlans: publicProcedure.input(caeAccess).query(({ input }) => listManufacturingPlans(input)),
  }),

  optimization: router({
    createStudy: publicProcedure.input(caeAccess.extend({ input: optimizationStudyInput })).mutation(({ input }) => createOptimizationStudy({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listStudies: publicProcedure.input(caeAccess).query(({ input }) => listOptimizationStudies(input)),
    createCandidate: publicProcedure.input(caeAccess.extend({ input: optimizationCandidateInput })).mutation(({ input }) => createOptimizationCandidate({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listCandidates: publicProcedure.input(caeAccess.extend({ optimizationStudyId: boundedReference.optional() })).query(({ input }) => listOptimizationCandidates(input)),
    assess: publicProcedure.input(caeAccess.extend({ optimizationStudyId: boundedReference })).mutation(({ input }) => assessOptimizationStudy(input)),
  }),

  runtimeAssurance: router({
    recordEnvironment: publicProcedure.input(caeAccess.extend({ input: runtimeAssuranceEnvironmentInput })).mutation(({ input }) => recordRuntimeAssuranceEnvironment({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listEnvironments: publicProcedure.input(caeAccess).query(({ input }) => listRuntimeAssuranceEnvironments(input)),
    recordObservedTest: publicProcedure.input(caeAccess.extend({ input: runtimeAssuranceObservedTestInput })).mutation(({ input }) => recordRuntimeAssuranceObservedTest({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listObservedTests: publicProcedure.input(caeAccess).query(({ input }) => listRuntimeAssuranceObservedTests(input)),
    recordFailure: publicProcedure.input(caeAccess.extend({ input: runtimeAssuranceFailureInput })).mutation(({ input }) => recordRuntimeAssuranceFailure({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listFailures: publicProcedure.input(caeAccess).query(({ input }) => listRuntimeAssuranceFailures(input)),
    recordRepairAttempt: publicProcedure.input(caeAccess.extend({ input: runtimeAssuranceRepairInput })).mutation(({ input }) => recordRuntimeAssuranceRepairAttempt({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listRepairAttempts: publicProcedure.input(caeAccess.extend({ failureId: boundedReference.optional() })).query(({ input }) => listRuntimeAssuranceRepairAttempts(input)),
    assess: publicProcedure.input(caeAccess).mutation(({ input }) => assessRuntimeAssurance(input)),
    listAssessments: publicProcedure.input(caeAccess).query(({ input }) => listRuntimeAssuranceAssessments(input)),
    buildReviewPackage: publicProcedure.input(caeAccess.extend({ assessmentId: boundedReference.optional() })).mutation(({ input }) => buildRuntimeAssuranceReviewPackage(input)),
  }),

  runtimeAdmission: router({
    evaluate: publicProcedure.input(caeAccess.extend({ input: runtimeAdmissionInput })).mutation(({ input }) => evaluateRuntimeAdmission({ projectId: input.projectId, accessKey: input.accessKey, ...input.input })),
    listDecisions: publicProcedure.input(caeAccess).query(({ input }) => listRuntimeAdmissionDecisions(input)),
  }),

  requirements: router({
    parse: publicProcedure
      .input(z.object({ sourceText: z.string().trim().min(1).max(5000), revision: z.number().int().positive().optional() }))
      .mutation(({ input }) => parseRequirements(input.sourceText, input.revision ?? 1)),
    normalizeUnit: publicProcedure
      .input(z.object({ value: z.number(), unit: z.string().trim().min(1).max(32) }))
      .query(({ input }) => normalizeUnit(input.value, input.unit)),
    revise: publicProcedure
      .input(z.object({ previous: z.any(), updateText: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => applyRequirementRevision(input.previous, input.updateText)),
  }),

  engineering: router({
    review: publicProcedure
      .input(z.object({
        sourceText: z.string().trim().min(1).max(8000),
        exploratoryMode: z.boolean().optional(),
        geometryStatus: z.enum(["NOT_GENERATED", "GEOMETRICALLY_GENERATED", "GEOMETRICALLY_VALIDATED"]).optional(),
        requirementSetId: z.string().trim().min(1).max(160).optional(),
        configurationId: z.string().trim().min(1).max(160).optional(),
      }))
      .mutation(({ input }) => runRuthlessEngineeringReview(input)),
  }),

  cae: router({
    localGmshStatus: publicProcedure
      .input(caeAccess)
      .query(async ({ input }) => {
        await openPersistentProject({ projectId: input.projectId, accessKey: input.accessKey, name: "" });
        const availability = await inspectCaeEngine("GMSH");
        return {
          status: availability.status,
          diagnostics: availability.diagnostics,
          identity: availability.identity ? {
            kind: availability.identity.kind,
            version: availability.identity.version,
            environmentHash: availability.identity.environmentHash,
            capabilities: availability.identity.capabilities,
          } : undefined,
        };
      }),
    localCalculiXStatus: publicProcedure
      .input(caeAccess)
      .query(async ({ input }) => {
        await openPersistentProject({ projectId: input.projectId, accessKey: input.accessKey, name: "" });
        const availability = await inspectCaeEngine("CALCULIX");
        return {
          status: availability.status,
          diagnostics: availability.diagnostics,
          identity: availability.identity ? { kind: availability.identity.kind, version: availability.identity.version, environmentHash: availability.identity.environmentHash, capabilities: availability.identity.capabilities } : undefined,
        };
      }),
    listManagedGmshMeshes: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listManagedGmshMeshArtifacts(input)),
    listManagedCalculiXResults: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listManagedCalculiXResultArtifacts(input)),
    createPlan: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: caePlanInput }))
      .mutation(({ input }) => createCAEPlan(input)),
    listPlans: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => listCAEPlans(input)),
    getPlan: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), simulationId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getCAEPlan(input)),
    reviewPlan: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => reviewCAEPlan(input)),
    requestExecution: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => requestCAEExecution(input)),
    solverAdapter: publicProcedure.query(() => getSolverAdapterContract()),
    negotiateSolver: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => negotiateSolver(input)),
    registerMaterialEvidence: publicProcedure
      .input(caeAccess.extend({ input: materialEvidenceInput }))
      .mutation(({ input }) => registerMaterialEvidence({ ...input, ...input.input })),
    listMaterialEvidence: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listMaterialEvidence(input)),
    materialConflicts: publicProcedure
      .input(caeAccess)
      .query(({ input }) => materialPropertyConflicts(input)),
    createExperimentalPlan: publicProcedure
      .input(caeAccess.extend({ input: experimentalPlanInput }))
      .mutation(({ input }) => createExperimentalValidationPlan({ ...input, ...input.input })),
    listExperimentalPlans: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listExperimentalValidationPlans(input)),
    uncertainty: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => assessUncertainty(input)),
    readiness: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => assessReadiness(input)),
    invalidateCadContext: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160), observedCadRevision: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => invalidateCadContext(input)),
    evidenceGraph: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => buildEvidenceGraph(input)),
    reconcileMaterialProperty: publicProcedure
      .input(caeAccess.extend({ material: z.string().trim().min(1).max(160), property: propertyName }))
      .mutation(({ input }) => reconcileMaterialProperty(input)),
    recordEngineeringDecision: publicProcedure
      .input(caeAccess.extend({ reconciliationId: z.string().trim().min(1).max(160), reviewer: z.string().trim().min(1).max(160), reviewerRole: z.string().trim().min(1).max(160).optional(), decision: z.enum(["RESOLVE", "REJECT", "REQUEST_EVIDENCE"]), selectedValue: z.number().finite().optional(), selectedUnit: z.string().trim().min(1).max(32).optional(), reason: z.string().trim().min(1).max(2000), evidenceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(64), revision: z.number().int().positive() }))
      .mutation(({ input }) => recordEngineeringReviewDecision(input)),
    ingestMeasurementDataset: publicProcedure
      .input(caeAccess.extend({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(128).optional(), base64: z.string().min(1).max(7_000_000), experimentId: z.string().trim().min(1).max(160).optional(), simulationId: z.string().trim().min(1).max(160).optional(), metadata: measurementMetadataInput }))
      .mutation(({ input }) => ingestMeasurementDataset(input)),
    listMeasurementDatasets: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listMeasurementDatasets(input)),
    createDatasetProcessing: publicProcedure
      .input(caeAccess.extend({ datasetId: z.string().trim().min(1).max(160), parentRecordId: z.string().trim().min(1).max(160).optional(), stage: z.enum(["NORMALIZED", "FILTERED", "DERIVED"]), transformation: z.string().trim().min(1).max(2000), evidenceIds: z.array(z.string().trim().min(1).max(160)).max(64) }))
      .mutation(({ input }) => createDatasetProcessingRecord(input)),
    listDatasetProcessing: publicProcedure
      .input(caeAccess.extend({ datasetId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => listDatasetProcessing(input)),
    recordCalibration: publicProcedure
      .input(caeAccess.extend({ datasetId: z.string().trim().min(1).max(160).optional(), instrument: z.string().trim().min(1).max(160), calibrationDate: z.string().trim().min(1).max(64).optional(), calibrationSource: z.string().trim().min(1).max(500).optional(), certificateReference: z.string().trim().min(1).max(500).optional(), validFrom: z.string().trim().min(1).max(64).optional(), validUntil: z.string().trim().min(1).max(64).optional(), uncertainty: z.string().trim().min(1).max(500).optional(), status: z.enum(["CALIBRATED", "EXPIRED", "UNCALIBRATED", "UNKNOWN"]), evidenceIds: z.array(z.string().trim().min(1).max(160)).max(64), truthCategory: z.enum(["MEASURED", "DERIVED", "UNKNOWN"]) }))
      .mutation(({ input }) => recordCalibration(input)),
    listCalibrationRecords: publicProcedure
      .input(caeAccess.extend({ datasetId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listCalibrationRecords(input)),
    createComparison: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160), datasetId: z.string().trim().min(1).max(160), quantity: z.string().trim().min(1).max(320), location: z.string().trim().min(1).max(500).optional(), timeWindow: z.string().trim().min(1).max(320).optional(), measurementValue: z.number().finite().optional(), uncertainty: z.string().trim().min(1).max(500).optional(), comparisonMethod: z.string().trim().min(1).max(1000) }))
      .mutation(({ input }) => createSimulationMeasurementComparison(input)),
    listComparisons: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listComparisons(input)),
    createCalibrationCandidate: publicProcedure
      .input(caeAccess.extend({ comparisonId: z.string().trim().min(1).max(160), statement: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => createCalibrationCandidate(input)),
    extendedEvidenceGraph: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => buildExtendedEvidenceGraph(input)),
    registerExternalSolverAdapter: publicProcedure
      .input(caeAccess.extend({ input: adapterRegistrationInput }))
      .mutation(({ input }) => registerExternalSolverAdapter({ ...input, ...input.input })),
    listExternalSolverAdapters: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listExternalSolverAdapterRegistrations(input)),
    registerReviewer: publicProcedure
      .input(caeAccess.extend({ displayName: z.string().trim().min(1).max(160), role: z.string().trim().min(1).max(160), projectScope: z.array(z.string().trim().min(1).max(96)).min(1).max(32), permissions: z.array(reviewerPermission).max(4), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => registerReviewerIdentity(input)),
    listReviewers: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listReviewerIdentities(input)),
    verifyReviewer: publicProcedure
      .input(caeAccess.extend({ reviewerId: z.string().trim().min(1).max(160), verificationMethod: z.string().trim().min(1).max(1000), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => verifyReviewerIdentity(input)),
    attachCalibrationCertificate: publicProcedure
      .input(caeAccess.extend({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(128).optional(), base64: z.string().min(1).max(7_000_000), issuer: z.string().trim().min(1).max(320).optional(), certificateNumber: z.string().trim().min(1).max(320).optional(), instrument: z.string().trim().min(1).max(160), calibrationDate: z.string().trim().min(1).max(64).optional(), expirationDate: z.string().trim().min(1).max(64).optional(), scope: z.string().trim().min(1).max(1000).optional(), uncertainty: z.string().trim().min(1).max(500).optional(), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => attachCalibrationCertificate(input)),
    listCalibrationCertificates: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listCalibrationCertificates(input)),
    verifyCalibrationCertificate: publicProcedure
      .input(caeAccess.extend({ certificateId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), sourceVerified: z.boolean(), signatureVerified: z.boolean(), scopeMatch: z.boolean(), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => verifyCalibrationCertificate(input)),
    verifyAdapterTrust: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), manifestVerified: z.boolean(), signatureVerified: z.boolean(), verifiedCapabilities: z.array(z.string().trim().min(1).max(240)).max(64), grantedPermissions: z.array(adapterPermission).max(8), sandbox: sandboxInput, reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => verifyAdapterTrust(input)),
    listAdapterTrustVerifications: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listAdapterTrustVerifications(input)),
    authorizeEngineeringApproval: publicProcedure
      .input(caeAccess.extend({ reviewerId: z.string().trim().min(1).max(160), targetType: z.enum(["MATERIAL_RECONCILIATION", "CALIBRATION", "ADAPTER", "VALIDATION"]), targetId: z.string().trim().min(1).max(160), decision: z.enum(["APPROVE", "REJECT", "REQUEST_EVIDENCE"]), evidenceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(64), revision: z.number().int().positive(), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => authorizeEngineeringApproval(input)),
    listAuthorizedApprovals: publicProcedure
      .input(caeAccess.extend({ targetId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listAuthorizedApprovals(input)),
    adapterEligibility: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => adapterEligibility(input)),
    revokeTrustObject: publicProcedure
      .input(caeAccess.extend({ objectType: z.enum(["REVIEWER", "ADAPTER", "CERTIFICATE"]), objectId: z.string().trim().min(1).max(160), actor: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => revokeTrustObject(input)),
    claimExternalIdentity: publicProcedure
      .input(caeAccess.extend({ provider: z.string().trim().min(1).max(320), providerVersion: z.string().trim().min(1).max(80), subject: z.string().trim().min(1).max(320), verificationMethod: z.string().trim().min(1).max(1000), evidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(32), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => registerExternalIdentityClaim(input)),
    listExternalIdentityClaims: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listExternalIdentityClaims(input)),
    verifyExternalIdentity: publicProcedure
      .input(caeAccess.extend({ claimId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), providerVerified: z.boolean(), evidenceVerified: z.boolean(), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => verifyExternalIdentityClaim(input)),
    ingestRevocationSource: publicProcedure
      .input(caeAccess.extend({ source: z.string().trim().min(1).max(500), sourceIdentity: z.string().trim().min(1).max(500), sourceContentBase64: z.string().min(1).max(7_000_000), certificateIdentifier: z.string().trim().min(1).max(320), reportedStatus: z.enum(["NOT_CHECKED", "VALID", "REVOKED", "EXPIRED", "UNKNOWN"]), independentSourceCount: z.number().int().min(1).max(32), sourceVerified: z.boolean(), effectiveTime: z.string().trim().min(1).max(64).optional(), evidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(32), reviewerId: z.string().trim().min(1).max(160), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => ingestCertificateRevocationSource(input)),
    listRevocationSources: publicProcedure
      .input(caeAccess.extend({ certificateIdentifier: z.string().trim().min(1).max(320).optional() }))
      .query(({ input }) => listCertificateRevocationSources(input)),
    declareSandboxAttestation: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160), version: z.string().trim().min(1).max(80), environmentIdentity: z.string().trim().min(1).max(500), runtimeIdentity: z.string().trim().min(1).max(500), runtimeVersion: z.string().trim().min(1).max(160), operatingSystem: z.string().trim().min(1).max(320), resourceLimits: z.array(z.string().trim().min(1).max(500)).max(32), filesystemBoundary: z.array(z.string().trim().min(1).max(500)).max(32), networkPolicy: z.enum(["NO_NETWORK", "DECLARATION_ONLY", "UNKNOWN"]), processPolicy: z.string().trim().min(1).max(2000), isolationMechanism: z.string().trim().min(1).max(1000), attestationEvidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(32), expiresAt: z.string().trim().min(1).max(64).optional(), actor: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => registerSandboxAttestation(input)),
    listSandboxAttestations: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listSandboxAttestations(input)),
    verifySandboxAttestation: publicProcedure
      .input(caeAccess.extend({ attestationId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), identityVerified: z.boolean(), integrityVerified: z.boolean(), configurationVerified: z.boolean(), permissionsVerified: z.boolean(), resourceBoundariesVerified: z.boolean(), networkRestrictionsVerified: z.boolean(), filesystemRestrictionsVerified: z.boolean(), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => verifySandboxAttestation(input)),
    listSandboxAttestationVerifications: publicProcedure
      .input(caeAccess.extend({ attestationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listSandboxAttestationVerifications(input)),
    evaluateExecutionTrustReadiness: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160), externalIdentityClaimId: z.string().trim().min(1).max(160).optional(), certificateId: z.string().trim().min(1).max(160).optional(), attestationId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => evaluateExecutionTrustReadiness(input)),
    listExecutionTrustReadiness: publicProcedure
      .input(caeAccess.extend({ registrationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listExecutionTrustReadiness(input)),
    runExecutionTrustSecurityBenchmark: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => runExecutionTrustSecurityBenchmark(input)),
    revokeExecutionTrustEvidence: publicProcedure
      .input(caeAccess.extend({ objectType: z.enum(["EXTERNAL_IDENTITY", "REVOCATION_SOURCE", "SANDBOX_ATTESTATION"]), objectId: z.string().trim().min(1).max(160), actor: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => revokeExecutionTrustEvidence(input)),
    securityAudit: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listSecurityAudit(input)),
    trustEvidenceGraph: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => buildTrustEvidenceGraph(input)),
    executionTrustEvidenceGraph: publicProcedure
      .input(caeAccess.extend({ simulationId: z.string().trim().min(1).max(160), registrationId: z.string().trim().min(1).max(160), readinessId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => buildExecutionTrustGraph(input)),
    createRuntimeArchitectureReview: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => createRuntimeArchitectureReview(input)),
    listRuntimeArchitectureReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listRuntimeArchitectureReviews(input)),
    runtimeArchitectureGraph: publicProcedure
      .input(caeAccess.extend({ reviewId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => buildRuntimeArchitectureGraph(input)),
    createRuntimeImplementationReadinessReview: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => createRuntimeImplementationReadinessReview(input)),
    listRuntimeImplementationReadinessReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listRuntimeImplementationReadinessReviews(input)),
    runtimeImplementationReadinessGraph: publicProcedure
      .input(caeAccess.extend({ reviewId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => buildRuntimeImplementationReadinessGraph(input)),
    createCapacityPolicy: publicProcedure
      .input(caeAccess.extend({ limits: z.array(capacityLimitInput).length(8).optional() }))
      .mutation(({ input }) => createCapacityPolicy(input)),
    listCapacityPolicies: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listCapacityPolicies(input)),
    validateCapacityPolicy: publicProcedure
      .input(caeAccess.extend({ policyId: z.string().trim().min(1).max(160), limit: capacityLimitInput.shape.kind, observedValue: z.union([z.number().finite().nonnegative(), z.literal("UNKNOWN")]), observedUnit: z.string().trim().min(1).max(32) }))
      .mutation(({ input }) => validateCapacityPolicy(input)),
    registerIndependentSandboxAttestation: publicProcedure
      .input(caeAccess.extend({ designId: z.string().trim().min(1).max(160), attestorIdentity: z.string().trim().min(1).max(240), attestorPublisherRelationship: z.enum(["INDEPENDENT", "SAME_PUBLISHER", "UNKNOWN"]), attestationScope: z.string().trim().min(1).max(800), environmentIdentity: z.string().trim().min(1).max(240), evidenceHash: z.string().regex(/^[a-f0-9]{64}$/i), attestationTime: z.string().trim().min(1).max(64), expiration: z.string().trim().min(1).max(64).optional(), verificationMethod: z.string().trim().min(1).max(800) }))
      .mutation(({ input }) => registerIndependentSandboxAttestation(input)),
    listIndependentSandboxAttestations: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listIndependentSandboxAttestations(input)),
    createRuntimeReadinessReview: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => createRuntimeReadinessReview(input)),
    listRuntimeReadinessReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listRuntimeReadinessReviews(input)),
    runtimeReadinessGraph: publicProcedure
      .input(caeAccess.extend({ readinessId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => buildRuntimeReadinessGraph(input)),
    importInfrastructureEvidence: publicProcedure
      .input(caeAccess.extend(externalProvenanceInput.shape).extend({ kind: z.enum(["CPU", "RAM", "STORAGE", "IO", "NETWORK", "PROCESS_LIMIT", "RESOURCE_LIMIT"]), measurement: z.string().trim().min(1).max(2000), measurementMethod: z.string().trim().min(1).max(1000), environment: z.string().trim().min(1).max(320) }))
      .mutation(({ input }) => importInfrastructureEvidence(input)),
    listInfrastructureEvidence: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listInfrastructureEvidence(input)),
    importSandboxReview: publicProcedure
      .input(caeAccess.extend(externalProvenanceInput.shape).extend({ reviewer: z.string().trim().min(1).max(320), organization: z.string().trim().min(1).max(320), scope: z.string().trim().min(1).max(2000), architectureRevision: z.string().trim().min(1).max(160), findings: z.array(z.string().trim().min(1).max(1000)).max(64), severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]), reportedStatus: z.enum(["NOT_REVIEWED", "IN_REVIEW", "ACCEPTED", "REJECTED", "EXPIRED"]) }))
      .mutation(({ input }) => importSandboxReview(input)),
    listSandboxReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listSandboxReviews(input)),
    registerHostileTestEnvironment: publicProcedure
      .input(caeAccess.extend({ environmentName: z.string().trim().min(1).max(320), declaredIsolation: z.enum(["DESIGNED", "UNKNOWN"]) }))
      .mutation(({ input }) => registerHostileTestEnvironment(input)),
    listHostileTestEnvironments: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listHostileTestEnvironments(input)),
    importHostileTestEvidence: publicProcedure
      .input(caeAccess.extend(externalProvenanceInput.shape).extend({ testId: z.string().trim().min(1).max(160), environmentId: z.string().trim().min(1).max(160), testVersion: z.string().trim().min(1).max(160), attackDescription: z.string().trim().min(1).max(2000), expectedResult: z.string().trim().min(1).max(2000), actualResult: z.string().trim().min(1).max(4000), logs: z.string().min(1).max(100_000), artifacts: z.array(z.string().trim().min(1).max(1000)).max(128), hash: z.string().regex(/^[a-f0-9]{64}$/i), reviewer: z.string().trim().min(1).max(320), status: z.enum(["NOT_RUN", "PASS", "FAIL", "BLOCKED", "UNKNOWN"]) }))
      .mutation(({ input }) => importHostileTestEvidence(input)),
    listHostileTestEvidence: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listHostileTestEvidence(input)),
    verifyExternalEvidence: publicProcedure
      .input(caeAccess.extend({ evidenceType: z.enum(["INFRASTRUCTURE", "SANDBOX_REVIEW", "HOSTILE_TEST", "HOSTILE_TEST_ENVIRONMENT"]), evidenceId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), sourceVerified: z.boolean(), verificationMethod: z.string().trim().min(1).max(1000), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => verifyExternalEvidence(input)),
    recordExternalEvidenceLifecycle: publicProcedure
      .input(caeAccess.extend({ evidenceType: z.enum(["INFRASTRUCTURE", "SANDBOX_REVIEW", "HOSTILE_TEST", "HOSTILE_TEST_ENVIRONMENT"]), evidenceId: z.string().trim().min(1).max(160), event: z.enum(["EXPIRED", "REVOKED", "SUPERSEDED"]), reason: z.string().trim().min(1).max(2000), replacementEvidenceId: z.string().trim().min(1).max(160).optional(), actor: z.string().trim().min(1).max(320) }))
      .mutation(({ input }) => recordExternalEvidenceLifecycle(input)),
    evaluateExternalVerificationReadiness: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => evaluateExternalVerificationReadiness(input)),
    listExternalVerificationReadiness: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listExternalVerificationReadiness(input)),
    externalVerificationGraph: publicProcedure
      .input(caeAccess.extend({ readinessId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => buildExternalVerificationGraph(input)),
    ensureGovernancePolicies: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => ensureGovernancePolicies(input)),
    listGovernancePolicies: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listGovernancePolicies(input)),
    submitVerificationReview: publicProcedure
      .input(caeAccess.extend({ evidenceType: z.enum(["INFRASTRUCTURE", "SANDBOX_REVIEW", "HOSTILE_TEST", "HOSTILE_TEST_ENVIRONMENT"]), evidenceReference: z.string().trim().min(1).max(160), submitterIdentity: z.string().trim().min(1).max(320), reviewScope: z.string().trim().min(1).max(2000), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => submitVerificationReview(input)),
    assignVerificationReview: publicProcedure
      .input(caeAccess.extend({ reviewId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => assignVerificationReview(input)),
    decideVerificationReview: publicProcedure
      .input(caeAccess.extend({ reviewId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), decision: z.enum(["ACCEPT", "REJECT"]), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => decideVerificationReview(input)),
    transitionVerificationReview: publicProcedure
      .input(caeAccess.extend({ reviewId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), transition: z.enum(["EXPIRE", "REVOKE"]), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => transitionVerificationReview(input)),
    listVerificationReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listVerificationReviews(input)),
    resolveVerificationConflict: publicProcedure
      .input(caeAccess.extend({ conflictId: z.string().trim().min(1).max(160), reviewerId: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => resolveVerificationConflict(input)),
    listVerificationConflicts: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listVerificationConflicts(input)),
    revokeGovernanceReviewer: publicProcedure
      .input(caeAccess.extend({ reviewerId: z.string().trim().min(1).max(160), actor: z.string().trim().min(1).max(320), reason: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => revokeGovernanceReviewer(input)),
    importTestEnvironmentEvidenceReference: publicProcedure
      .input(caeAccess.extend({ environmentId: z.string().trim().min(1).max(160), testRunId: z.string().trim().min(1).max(160), testVersion: z.string().trim().min(1).max(160), evidenceHash: z.string().regex(/^[a-f0-9]{64}$/i), source: z.string().trim().min(1).max(1000), timestamp: z.string().trim().min(1).max(64), reviewer: z.string().trim().min(1).max(320).optional() }))
      .mutation(({ input }) => importTestEnvironmentEvidenceReference(input)),
    listTestEnvironmentEvidenceReferences: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listTestEnvironmentEvidenceReferences(input)),
    listGovernanceLifecycle: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listGovernanceLifecycle(input)),
    evaluateVerificationGovernanceReadiness: publicProcedure
      .input(caeAccess)
      .mutation(({ input }) => evaluateVerificationGovernanceReadiness(input)),
    listVerificationGovernanceReadiness: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listVerificationGovernanceReadiness(input)),
    submitCAEJobContract: publicProcedure
      .input(caeAccess.extend({ input: caeJobInput }))
      .mutation(({ input }) => submitCAEJobContract({ ...input, input: input.input })),
    listCAEJobContracts: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listCAEJobContracts(input)),
    getCAEJobContract: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getCAEJobContract(input)),
    reviseCAEJobContract: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160), input: caeJobInput }))
      .mutation(({ input }) => reviseCAEJobContract({ ...input, input: input.input })),
    evaluateCAEJobStaleness: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160), observedCadRevision: boundedReference.optional(), observedRequirementRevision: boundedReference.optional(), observedMaterialEvidenceHash: sha256.optional(), observedMeshStrategyHash: sha256.optional(), observedSolverVersion: boundedReference.optional() }))
      .mutation(({ input }) => evaluateCAEJobStaleness(input)),
    listCAEJobStaleness: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => listCAEJobStaleness(input)),
    registerNonExecutableMeshArtifact: publicProcedure
      .input(caeAccess.extend({ input: meshArtifactInput }))
      .mutation(({ input }) => registerNonExecutableMeshArtifact({ ...input, input: input.input })),
    registerAllowlistedSolverArtifact: publicProcedure
      .input(caeAccess.extend({ input: solverArtifactInput }))
      .mutation(({ input }) => registerAllowlistedSolverArtifact({ ...input, input: input.input })),
    registerFutureCAEJobResultArtifact: publicProcedure
      .input(caeAccess.extend({ input: resultArtifactInput }))
      .mutation(({ input }) => registerFutureCAEJobResultArtifact({ ...input, input: input.input })),
    createCAEJobVerificationRecord: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160), resultId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => createCAEJobVerificationRecord(input)),
    buildCAEJobTraceability: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => buildCAEJobTraceability(input)),
    caeJobFailureModel: publicProcedure
      .query(() => caeJobFailureModel()),
    caeJobContractGraph: publicProcedure
      .input(caeAccess.extend({ jobId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => buildCAEJobContractGraph(input)),
    captureValidatedCAEPlanSnapshot: publicProcedure
      .input(caeAccess.extend(planSnapshotInput.shape))
      .mutation(({ input }) => captureValidatedCAEPlanSnapshot(input)),
    listCAEPlanSnapshots: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listCAEPlanSnapshots(input)),
    convertCAEPlanSnapshotToJob: publicProcedure
      .input(caeAccess.extend({ snapshotId: boundedReference, solverVersion: boundedReference, environmentReference: boundedReference, resourcePolicy: caeJobInput.shape.resourcePolicy, createdBy: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => convertCAEPlanSnapshotToJob(input)),
    createCAEJobDiff: publicProcedure
      .input(caeAccess.extend({ baselineJobId: boundedReference, comparedJobId: boundedReference }))
      .mutation(({ input }) => createCAEJobDiff(input)),
    registerMeshQualityEvidence: publicProcedure
      .input(caeAccess.extend({ input: meshQualityEvidenceInput }))
      .mutation(({ input }) => registerMeshQualityEvidence({ ...input, input: input.input })),
    listMeshQualityEvidence: publicProcedure
      .input(caeAccess.extend({ jobId: boundedReference.optional() }))
      .query(({ input }) => listMeshQualityEvidence(input)),
    evaluateMeshQualityStaleness: publicProcedure
      .input(caeAccess.extend({ evidenceId: boundedReference, observedCadHash: sha256.optional(), observedJobId: boundedReference.optional(), observedMeshId: boundedReference.optional(), observedQualityAlgorithmVersion: boundedReference.optional(), observedThresholdVersion: z.string().trim().min(1).max(96).optional() }))
      .mutation(({ input }) => evaluateMeshQualityStaleness(input)),
    caePlanIntegrationGraph: publicProcedure
      .input(caeAccess.extend({ jobId: boundedReference }))
      .mutation(({ input }) => buildCAEPlanIntegrationGraph(input)),
    createMeshQualityVerification: publicProcedure
      .input(caeAccess.extend(meshQualityVerificationInput.shape))
      .mutation(({ input }) => createMeshQualityVerification(input)),
    listMeshQualityVerifications: publicProcedure
      .input(caeAccess.extend({ meshQualityEvidenceId: boundedReference.optional(), meshId: boundedReference.optional(), jobId: boundedReference.optional() }))
      .query(({ input }) => listMeshQualityVerifications(input)),
    createSolverInputPackageManifest: publicProcedure
      .input(caeAccess.extend(solverInputPackageInput.shape))
      .mutation(({ input }) => createSolverInputPackageManifest(input)),
    listSolverInputPackages: publicProcedure
      .input(caeAccess.extend({ cadRevision: boundedReference.optional(), cadGeometryHash: sha256.optional(), jobRevision: z.number().int().positive().optional(), meshId: boundedReference.optional(), meshHash: sha256.optional() }))
      .query(({ input }) => listSolverInputPackages(input)),
    assessSolverInputPackageStaleness: publicProcedure
      .input(caeAccess.extend({ packageId: boundedReference, observedCadRevision: boundedReference.optional(), observedCadGeometryHash: sha256.optional(), observedJobRevision: z.number().int().positive().optional(), observedMeshId: boundedReference.optional(), observedMeshHash: sha256.optional(), observedMaterialEvidenceHash: sha256.optional(), observedMeshQualityVerificationId: boundedReference.optional() }))
      .mutation(({ input }) => assessSolverInputPackageStaleness(input)),
    solverInputPackageGraph: publicProcedure
      .input(caeAccess.extend({ packageId: boundedReference }))
      .mutation(({ input }) => buildSolverInputPackageGraph(input)),
    transitionMeshQualityVerificationLifecycle: publicProcedure
      .input(caeAccess.extend({ verificationId: boundedReference, newState: z.enum(["ACTIVE", "EXPIRING", "EXPIRED", "REVOKED"]), reason: z.string().trim().min(1).max(2000), authorization: z.string().trim().min(1).max(1000), actor: boundedReference }))
      .mutation(({ input }) => transitionMeshQualityVerificationLifecycle(input)),
    listMeshQualityVerificationLifecycle: publicProcedure
      .input(caeAccess.extend({ verificationId: boundedReference.optional() }))
      .query(({ input }) => listMeshQualityVerificationLifecycle(input)),
    reassignMeshQualityVerification: publicProcedure
      .input(caeAccess.extend({ verificationId: boundedReference, newReviewer: boundedReference, reason: z.string().trim().min(1).max(2000), authorization: z.string().trim().min(1).max(1000), actor: boundedReference }))
      .mutation(({ input }) => reassignMeshQualityVerification(input)),
    listMeshQualityReviewerReassignments: publicProcedure
      .input(caeAccess.extend({ verificationId: boundedReference.optional() }))
      .query(({ input }) => listMeshQualityReviewerReassignments(input)),
    createSolverInputPackageDiff: publicProcedure
      .input(caeAccess.extend({ baselinePackageId: boundedReference, comparedPackageId: boundedReference }))
      .mutation(({ input }) => createSolverInputPackageDiff(input)),
    registerSolverConfigurationSchema: publicProcedure
      .input(caeAccess.extend(solverConfigurationRegistryInput.shape))
      .mutation(({ input }) => registerSolverConfigurationSchema(input)),
    listSolverConfigurationRegistry: publicProcedure
      .input(caeAccess.extend({ configurationId: boundedReference.optional() }))
      .query(({ input }) => listSolverConfigurationRegistry(input)),
    validateSolverConfiguration: publicProcedure
      .input(caeAccess.extend({ configurationId: boundedReference, configurationSchemaVersion: boundedReference, parameters: z.record(boundedReference, z.union([z.string().trim().min(1).max(160), z.number().finite(), z.boolean()])), units: z.record(boundedReference, z.string().trim().min(1).max(64)) }))
      .mutation(({ input }) => validateSolverConfiguration(input)),
    assessSolverConfigurationStaleness: publicProcedure
      .input(caeAccess.extend({ packageId: boundedReference, configurationId: boundedReference, observedSolverVersion: boundedReference.optional(), observedSchemaVersion: boundedReference.optional(), observedJobHash: sha256.optional(), observedMeshHash: sha256.optional(), observedMaterialEvidenceHash: sha256.optional(), observedVerificationLifecycle: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => assessSolverConfigurationStaleness(input)),
    solverConfigurationGovernanceGraph: publicProcedure
      .input(caeAccess.extend({ packageId: boundedReference, configurationId: boundedReference }))
      .mutation(({ input }) => buildSolverConfigurationGovernanceGraph(input)),
    registerCADRevisionBinding: publicProcedure
      .input(caeAccess.extend(cadBindingInput.shape))
      .mutation(({ input }) => registerCADRevisionBinding(input)),
    listCADRevisionBindings: publicProcedure
      .input(caeAccess.extend({ cadBindingId: boundedReference.optional() }))
      .query(({ input }) => listCADRevisionBindings(input)),
    authorizeReviewerForEvidence: publicProcedure
      .input(caeAccess.extend(reviewerAuthorizationInput.shape))
      .mutation(({ input }) => authorizeReviewerForEvidence(input)),
    listReviewerAuthorizations: publicProcedure
      .input(caeAccess.extend({ reviewerId: boundedReference.optional() }))
      .query(({ input }) => listReviewerAuthorizations(input)),
    assessEvidenceIntegrityTraceability: publicProcedure
      .input(caeAccess.extend({ jobId: boundedReference, packageId: boundedReference, configurationId: boundedReference, reviewerAuthorizationId: boundedReference.optional() }))
      .mutation(({ input }) => assessEvidenceIntegrityTraceability(input)),
    createSandboxAttestationRubric: publicProcedure
      .input(caeAccess.extend({ attestationSubject: z.string().trim().min(1).max(320), attestationScope: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => createSandboxAttestationRubric(input)),
    listSandboxAttestationRubrics: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listSandboxAttestationRubrics(input)),
    recordSandboxSecurityAttestation: publicProcedure
      .input(caeAccess.extend(sandboxSecurityAttestationInput.shape))
      .mutation(({ input }) => recordSandboxSecurityAttestation(input)),
    listSandboxSecurityAttestations: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listSandboxSecurityAttestations(input)),
    recordArtifactSBOMReview: publicProcedure
      .input(caeAccess.extend(artifactSBOMReviewInput.shape))
      .mutation(({ input }) => recordArtifactSBOMReview(input)),
    listArtifactSBOMReviews: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listArtifactSBOMReviews(input)),
    recordSecurityHostileTestEvidence: publicProcedure
      .input(caeAccess.extend(hostileTestEvidenceInput.shape))
      .mutation(({ input }) => recordHostileTestEvidence(input)),
    listSecurityHostileTestEvidence: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listHostileTestEvidenceRecords(input)),
    listSecurityEvidenceLifecycle: publicProcedure
      .input(caeAccess.extend({ subjectId: boundedReference.optional() }))
      .query(({ input }) => listSecurityEvidenceLifecycle(input)),
    listSecurityEvidenceConflicts: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listSecurityEvidenceConflicts(input)),
    assessSecurityEvidenceTraceability: publicProcedure
      .input(caeAccess.extend({ runtimeArchitectureReviewId: boundedReference, rubricId: boundedReference.optional(), attestationEvidenceId: boundedReference.optional(), artifactReviewId: boundedReference.optional(), hostileTestEvidenceId: boundedReference.optional() }))
      .mutation(({ input }) => assessSecurityEvidenceTraceability(input)),
  }),

  cam: router({
    localStatus: publicProcedure
      .input(caeAccess)
      .query(async ({ input }) => {
        await openPersistentProject({ projectId: input.projectId, accessKey: input.accessKey, name: "" });
        const engine = inspectLocalCamEngine();
        return { status: engine.status, engine: engine.engine, version: engine.version, runtime: engine.runtime, supportedOperations: engine.supportedOperations, supportedPostProcessors: engine.supportedPostProcessors };
      }),
    listManagedArtifacts: publicProcedure
      .input(caeAccess)
      .query(({ input }) => listManagedCamArtifacts(input)),
    machineAwareRelease: publicProcedure
      .input(z.object({
        cadRevision: z.string().trim().min(1).max(160),
        camOperation: z.string().trim().min(1).max(160),
        machine: z.record(z.string(), z.unknown()),
        tooling: z.record(z.string(), z.unknown()),
        fixture: z.record(z.string(), z.unknown()),
        selectedController: z.string().trim().min(1).max(160),
        selectedPost: z.string().trim().min(1).max(160),
        generatedToolpathHash: z.string().trim().min(1).max(160),
        gcode: z.string().max(2_000_000),
        gcodeHash: z.string().trim().min(1).max(160),
        verification: z.record(z.string(), z.enum(["PASS", "FAIL", "BLOCKED", "NOT_RUN"])),
        capturedMachineRevision: z.string().trim().min(1).max(160),
        capturedToolProvenance: z.string().trim().min(1).max(512),
      }))
      .mutation(({ input }) => evaluateMachineCamRelease(input as unknown as MachineCamInput)),
  }),

  intelligence: router({
    analyze: publicProcedure
      .input(z.object({
        sourceText: z.string().trim().min(1).max(8000),
        mode: z.enum(["NORMAL", "DEEP_ENGINEERING", "EXPLORATION", "SPECULATIVE", "CHALLENGE"]).optional(),
        projectId: z.string().trim().min(1).max(160).optional(),
        requestMajorInnovation: z.boolean().optional(),
        geometryStatus: z.enum(["NOT_GENERATED", "GEOMETRICALLY_GENERATED", "GEOMETRICALLY_VALIDATED"]).optional(),
      }))
      .mutation(({ input }) => runEngineeringIntelligence(input)),
    memory: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(160).optional() }).optional())
      .query(({ input }) => getEngineeringMemory(input?.projectId)),
  }),

  workbench: router({
    message: publicProcedure
      .input(z.object({
        projectId: z.string().trim().min(1).max(160),
        projectName: z.string().trim().min(1).max(160).optional(),
        message: z.string().trim().min(1).max(8000),
        mode: z.enum(["NORMAL", "DEEP_ENGINEERING", "EXPLORATION", "SPECULATIVE", "CHALLENGE"]),
        configurationId: z.string().trim().min(1).max(160).optional(),
        modelName: z.string().trim().min(1).max(160).optional(),
        selectedGeometry: z.object({
          kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]),
          id: z.string().trim().min(1).max(160).optional(),
          label: z.string().trim().min(1).max(320),
          featureId: z.string().trim().min(1).max(160).optional(),
          bodyId: z.string().trim().min(1).max(160).optional(),
          viewerFaceId: z.string().trim().min(1).max(160).optional(),
          source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]),
        }).optional(),
        requirementSummary: z.string().trim().max(1000).optional(),
        featureSummary: z.string().trim().max(1000).optional(),
        parameterSummary: z.string().trim().max(1000).optional(),
        conceptSummary: z.string().trim().max(1000).optional(),
        memorySummary: z.string().trim().max(1000).optional(),
        validationStage: z.enum(["CONCEPTUAL", "ESTIMATED", "CALCULATED", "GEOMETRICALLY_VALIDATED", "PHYSICALLY_PLAUSIBLE", "CAE_VERIFIED", "EXPERIMENTALLY_VALIDATED", "PRODUCTION_READY"]).optional(),
        attachedFileIds: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
      }))
      .mutation(({ input }) => runWorkbenchMessage(input)),
    proposal: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(160), proposalId: z.string().trim().min(1).max(160), status: z.enum(["PREVIEWED", "APPLIED", "REJECTED", "EDIT_REQUESTED", "REVERTED"]) }))
      .mutation(({ input }) => updateProposal(input.projectId, input.proposalId, input.status)),
    project: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getWorkbenchProject(input.projectId)),
    attach: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(160), conversationId: z.string().trim().min(1).max(160).optional(), name: z.string().trim().min(1).max(512), sizeBytes: z.number().int().nonnegative().max(1024 * 1024 * 1024).optional(), mimeType: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => attachWorkbenchFile(input)),
  }),

  persistentMemory: router({
    openProject: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(255), projectId: z.string().trim().min(1).max(96).optional(), accessKey: z.string().trim().min(16).max(128).optional(), commandId: z.string().trim().min(8).max(160).optional() }))
      .mutation(({ input }) => executeEngineeringCommand({ commandId: input.commandId ?? `CREATE_PROJECT:${input.projectId ?? input.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`, operation: "CREATE_PROJECT", actor: "USER", projectId: input.projectId, accessKey: input.accessKey }, async () => { const project = await openPersistentProject(input); return { result: project, projectId: project.id, accessKey: project.accessKey, lineage: { title: `EEK project root · ${project.name}`, changeSummary: "Project was created or reopened through the authoritative Engineering Execution Kernel." } }; }).then((event) => event.result)),
    createConversation: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), title: z.string().trim().min(1).max(255), reason: z.string().trim().min(1).max(1000).optional() }))
      .mutation(({ input }) => createPersistentConversation(input)),
    listConversations: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), includeArchived: z.boolean().optional(), includeDeleted: z.boolean().optional() }))
      .query(({ input }) => listPersistentConversations(input)),
    updateConversation: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), action: z.enum(["RENAME", "ARCHIVE", "RESTORE", "DELETE"]), title: z.string().trim().min(1).max(255).optional(), reason: z.string().trim().min(1).max(1000) }))
      .mutation(({ input }) => updatePersistentConversation(input)),
    message: publicProcedure
      .input(z.object({
        projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), projectName: z.string().trim().min(1).max(160).optional(), message: z.string().trim().min(1).max(8000), mode: z.enum(["NORMAL", "DEEP_ENGINEERING", "EXPLORATION", "SPECULATIVE", "CHALLENGE"]), configurationId: z.string().trim().min(1).max(160).optional(), modelName: z.string().trim().min(1).max(160).optional(), commandId: z.string().trim().min(8).max(160).optional(), selectedGeometry: z.object({ kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]), id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(320), featureId: z.string().trim().min(1).max(160).optional(), bodyId: z.string().trim().min(1).max(160).optional(), viewerFaceId: z.string().trim().min(1).max(160).optional(), source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]) }).optional(), requirementSummary: z.string().trim().max(1000).optional(), featureSummary: z.string().trim().max(1000).optional(), parameterSummary: z.string().trim().max(1000).optional(), conceptSummary: z.string().trim().max(1000).optional(), memorySummary: z.string().trim().max(1000).optional(), validationStage: z.enum(["CONCEPTUAL", "ESTIMATED", "CALCULATED", "GEOMETRICALLY_VALIDATED", "PHYSICALLY_PLAUSIBLE", "CAE_VERIFIED", "EXPERIMENTALLY_VALIDATED", "PRODUCTION_READY"]).optional(), attachedFileIds: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
      }))
      .mutation(({ input }) => executeEngineeringCommand({ commandId: input.commandId ?? `CAD_AGENT_MESSAGE:${input.projectId}:${input.conversationId}:${input.message.slice(0, 64)}`, operation: "CAD_AGENT_MESSAGE", actor: "CAD_AGENT", projectId: input.projectId, accessKey: input.accessKey }, async () => ({ result: await runPersistentWorkbenchMessage(input), projectId: input.projectId, accessKey: input.accessKey })).then((event) => event.result)),
    attach: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), name: z.string().trim().min(1).max(512), sizeBytes: z.number().int().nonnegative().max(1024 * 1024 * 1024).optional(), mimeType: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => persistWorkbenchAttachment(input)),
    decideConcept: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), conceptId: z.string().trim().min(1).max(160), conceptName: z.string().trim().min(1).max(255), action: z.enum(["REJECT", "EVOLVE", "ACCEPT"]), reason: z.string().trim().min(1).max(2000), parentLineageId: z.string().trim().min(1).max(96).optional() }))
      .mutation(({ input }) => recordPersistentConceptDecision(input)),
    decideProposal: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), proposalId: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(255), action: z.enum(["PREVIEWED", "APPLIED", "REJECTED", "EDIT_REQUESTED", "REVERTED"]), detail: z.string().trim().min(1).max(4000) }))
      .mutation(({ input }) => recordPersistentProposalDecision(input)),
    retrieve: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), query: z.string().trim().min(1).max(2000), limit: z.number().int().min(1).max(16).optional() }))
      .query(({ input }) => retrievePersistentMemory(input)),
    restoreConversation: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96) }))
      .query(({ input }) => restoreWorkbenchConversation(input)),
    snapshot: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => projectMemorySnapshot(input)),
  }),

  cadFiles: router({
    upload: publicProcedure
      .input(z.object({
        projectId: z.string().trim().min(1).max(96),
        accessKey: z.string().trim().min(16).max(128),
        conversationId: z.string().trim().min(1).max(96).optional(),
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(128).optional(),
        base64: z.string().trim().min(1).max(14_000_000),
      }))
      .mutation(({ input }) => ingestCadFile(input)),
    list: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96).optional(), includeRemoved: z.boolean().optional() }))
      .query(({ input }) => listCadFiles(input)),
    get: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96) }))
      .query(({ input }) => getCadFileContext(input)),
    analyze: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96), question: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => analyzeCadFile(input)),
    remove: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96) }))
      .mutation(({ input }) => removeCadFile(input)),
  }),

  engineeringViewer: router({
    scene: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96) }))
      .query(({ input }) => getEngineeringViewerScene(input)),
    createBranch: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96), name: z.string().trim().min(1).max(255), reason: z.string().trim().min(1).max(2000), parentLineageNodeId: z.string().trim().min(1).max(96).optional(), sourceConfigurationId: z.string().trim().min(1).max(160).optional() }))
      .mutation(({ input }) => createEngineeringViewerBranch(input)),
    proposalPreview: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), fileId: z.string().trim().min(1).max(96), proposalId: z.string().trim().min(1).max(160), sourceConfigurationId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => getViewerProposalPreview(input)),
  }),

  cadExecution: router({
    plan: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), configurationId: z.string().trim().min(1).max(160), selectedGeometry: z.object({ kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]), id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(320), featureId: z.string().trim().min(1).max(160).optional(), bodyId: z.string().trim().min(1).max(160).optional(), viewerFaceId: z.string().trim().min(1).max(160).optional(), source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]) }).optional(), proposal: z.object({ id: z.string().trim().min(1).max(160), parameters: z.array(z.object({ name: z.string().trim().min(1).max(64), after: z.string().trim().min(1).max(64).optional(), unit: z.string().trim().min(1).max(16).optional() })).max(8) }).optional(), requestedParameter: z.object({ name: z.enum(["width", "depth", "height", "holeDiameter", "holeEdgeOffset", "filletRadius"]), value: z.number().finite(), unit: z.literal("mm") }).optional() }))
      .mutation(({ input }) => planCadOperation(input)),
    preview: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), operationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => previewCadOperation(input)),
    applyOperation: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), operationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeCadOperation(input)),
    reject: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), operationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => rejectCadOperation(input)),
    revert: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), operationId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => revertCadOperation(input)),
    history: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => listCadOperationHistory(input)),
  }),

  featureHistory: router({
    catalog: publicProcedure.query(() => FEATURE_CATALOG),
    planCircularBoss: publicProcedure
      .input(z.object({ message: z.string().trim().min(1).max(2000) }))
      .query(({ input }) => planCircularBoss(input.message)),
    planCircularPattern: publicProcedure
      .input(z.object({ message: z.string().trim().min(1).max(2000) }))
      .query(({ input }) => planCircularPattern(input.message)),
    planRectangularPattern: publicProcedure
      .input(z.object({ message: z.string().trim().min(1).max(2000) }))
      .query(({ input }) => planRectangularPattern(input.message)),
    planMirror: publicProcedure
      .input(z.object({ message: z.string().trim().min(1).max(2000) }))
      .query(({ input }) => planMirror(input.message)),
    create: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), width: z.number().finite(), height: z.number().finite(), extrudeDistance: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }) }))
      .mutation(({ input }) => createFeatureHistory(input)),
    createCircle: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), centerX: z.number().finite(), centerY: z.number().finite(), radius: z.number().finite(), extrudeDistance: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }) }))
      .mutation(({ input }) => createCircleFeatureHistory(input)),
    createCircularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), sourceRevisionId: z.string().trim().min(1).max(160), sourceFeatureId: z.literal("EXTRUDE-CIRCLE-001"), axis: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z"]), instanceCount: z.number().int().min(2).max(24), angleDegrees: z.number().finite().gt(0).max(360), direction: z.enum(["COUNTERCLOCKWISE", "CLOCKWISE"]) }) }))
      .mutation(({ input }) => createCircularPattern(input)),
    createRectangularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), sourceRevisionId: z.string().trim().min(1).max(160), sourceFeatureId: z.literal("EXTRUDE-CIRCLE-001"), directionX: z.enum(["GLOBAL_X_POSITIVE", "GLOBAL_X_NEGATIVE"]), directionY: z.enum(["GLOBAL_Y_POSITIVE", "GLOBAL_Y_NEGATIVE"]), countX: z.number().int().min(1).max(24), countY: z.number().int().min(1).max(24), spacingX: z.number().finite().gt(0), spacingY: z.number().finite().gt(0), unit: z.enum(["mm", "cm", "m"]) }) }))
      .mutation(({ input }) => createRectangularPattern(input)),
    createMirror: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), sourceRevisionId: z.string().trim().min(1).max(160), sourceFeatureId: z.literal("EXTRUDE-CIRCLE-001"), mirrorPlane: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z"]) }) }))
      .mutation(({ input }) => createMirror(input)),
    list: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => listFeatureHistory(input)),
    viewerMesh: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getFeatureViewerMesh(input)),
    preview: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ featureId: z.string().trim().min(1).max(96), parameter: z.object({ name: z.enum(["width", "height", "radius", "centerX", "centerY", "extrudeDistance", "instanceCount", "angleDegrees", "countX", "countY", "spacingX", "spacingY"]), value: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }).optional(), targetReferenceId: z.string().trim().min(1).max(160).optional(), direction: z.literal("NORMAL").optional(), featureType: z.enum(["RECTANGLE_SKETCH", "CIRCLE_SKETCH", "EXTRUDE", "CIRCULAR_PATTERN", "RECTANGULAR_PATTERN", "REVOLVE", "SWEEP", "LOFT", "BOOLEAN_UNION", "BOOLEAN_CUT", "BOOLEAN_INTERSECTION", "FILLET", "CHAMFER", "SHELL", "DRAFT", "PATTERN", "MIRROR"]).optional(), operationOrder: z.number().int().min(0).max(32).optional() }) }))
      .mutation(({ input }) => previewFeatureRegeneration(input)),
    previewCircle: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ featureId: z.string().trim().min(1).max(96), parameter: z.object({ name: z.enum(["radius", "centerX", "centerY", "extrudeDistance"]), value: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }).optional(), targetReferenceId: z.string().trim().min(1).max(200).optional(), direction: z.literal("NORMAL").optional(), featureType: z.enum(["CIRCLE_SKETCH", "EXTRUDE", "FILLET", "REVOLVE", "SWEEP", "LOFT", "BOOLEAN_UNION", "BOOLEAN_CUT", "BOOLEAN_INTERSECTION", "CHAMFER", "SHELL", "DRAFT", "PATTERN", "MIRROR"]).optional(), operationOrder: z.number().int().min(0).max(32).optional() }) }))
      .mutation(({ input }) => previewCircleFeatureRegeneration(input)),
    execute: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeFeatureRegeneration(input)),
    executeCircle: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeCircleFeatureRegeneration(input)),
    previewCircularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ instanceCount: z.number().int().min(2).max(24).optional(), angleDegrees: z.number().finite().gt(0).max(360).optional(), axis: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z"]).optional(), direction: z.enum(["COUNTERCLOCKWISE", "CLOCKWISE"]).optional() }) }))
      .mutation(({ input }) => previewCircularPatternRegeneration(input)),
    executeCircularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeCircularPatternRegeneration(input)),
    previewRectangularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ directionX: z.enum(["GLOBAL_X_POSITIVE", "GLOBAL_X_NEGATIVE"]).optional(), directionY: z.enum(["GLOBAL_Y_POSITIVE", "GLOBAL_Y_NEGATIVE"]).optional(), countX: z.number().int().min(1).max(24).optional(), countY: z.number().int().min(1).max(24).optional(), spacingX: z.number().finite().gt(0).optional(), spacingY: z.number().finite().gt(0).optional(), unit: z.enum(["mm", "cm", "m"]).optional() }) }))
      .mutation(({ input }) => previewRectangularPatternRegeneration(input)),
    executeRectangularPattern: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeRectangularPatternRegeneration(input)),
    previewMirror: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ mirrorPlane: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z"]).optional() }) }))
      .mutation(({ input }) => previewMirrorRegeneration(input)),
    executeMirror: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => executeMirrorRegeneration(input)),
    rejectMirrorPreview: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), previewRevisionId: z.string().trim().min(1).max(160) }))
      .mutation(({ input }) => rejectMirrorPreview(input)),
    compare: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), baseRevisionId: z.string().trim().min(1).max(160), comparedRevisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => compareFeatureRevisions(input)),
    diagnoseFailure: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => diagnoseFeatureHistoryFailure(input)),
    topology: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => inspectCircleTopology(input)),
    repeatability: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => assessCircleRepeatability(input)),
    filletReadiness: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160).optional() }))
      .query(({ input }) => getCircleFilletReadiness(input)),
    geometryExport: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getCircleGeometryExport(input)),
    topologyManifest: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => getTopologyManifest(input)),
    edgeProofs: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), revisionId: z.string().trim().min(1).max(160) }))
      .query(async ({ input }) => { const revision = (await listFeatureHistory(input)).find((item) => item.revisionId === input.revisionId); if (!revision) throw new Error("An authorized immutable feature revision is required for edge topology proof."); return edgeTopologyProofs(revision); }),
    topologyMatch: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), targetRevisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => matchTopologyRevisions(input)),
    edgeTopologyMatch: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), targetRevisionId: z.string().trim().min(1).max(160) }))
      .query(async ({ input }) => { const revisions = await listFeatureHistory(input); const source = revisions.find((item) => item.revisionId === input.sourceRevisionId); const target = revisions.find((item) => item.revisionId === input.targetRevisionId); if (!source || !target) throw new Error("Both authorized immutable revisions are required for edge topology matching."); return matchEdgeTopology(source, target); }),
    filletGate: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), targetRevisionId: z.string().trim().min(1).max(160) }))
      .query(({ input }) => evaluateFilletReadiness(input)),
  }),

  cad: router({
    generateMountingBlock: publicProcedure
      .input(
        z.object({
          input: mountingBlockInput,
          prompt: z.string().trim().min(1).max(2000),
        }),
      )
      .mutation(() => { throw new Error("MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED: direct geometry generation is disabled until it is migrated through the authorized Common Feature Executor lifecycle."); }),
  }),

  textToCad: router({
    plan: publicProcedure
      .input(textToCadInputSchema)
      .mutation(({ input }) => planTextToCad(input.prompt)),
  }),
  cadAgent: router({
    createConfiguration: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(80), input: mountingBlockInput, sourceText: z.string().trim().min(1).max(5000), conceptual: z.boolean().optional() }))
      .mutation(() => retiredMountingBlock<Awaited<ReturnType<typeof createMountingBlockConfiguration>>>("createConfiguration is disabled until it can provide project authorization and invoke the Common Feature Executor lifecycle.")),
    reviseConfiguration: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1), name: z.string().trim().min(1).max(80).optional(), inputPatch: mountingBlockInputPatch, updateText: z.string().trim().min(1).max(2000) }))
      .mutation(() => retiredMountingBlock<Awaited<ReturnType<typeof reviseMountingBlockConfiguration>>>("reviseConfiguration is disabled until it can provide project authorization and invoke the Common Feature Executor lifecycle.")),
    previewConfiguration: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1), inputPatch: mountingBlockInputPatch, updateText: z.string().trim().min(1).max(2000) }))
      .mutation(() => retiredMountingBlock<Awaited<ReturnType<typeof previewMountingBlockConfiguration>>>("previewConfiguration is disabled because this public route has no authorized preview boundary.")),
    listConfigurations: publicProcedure.query(() => listConfigurations()),
    markStale: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1) }))
      .mutation(({ input }) => markConfigurationStale(input.configurationId)),
    exportStep: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1) }))
      .mutation(() => retiredMountingBlock<ReturnType<typeof getValidatedStepExport>>("exportStep is disabled until it reads only an authorized managed CAD artifact.")),
  }),
});

export type AppRouter = typeof appRouter;
function retiredMountingBlock<T>(reason: string): T { throw new Error(`MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED: ${reason}`); }
