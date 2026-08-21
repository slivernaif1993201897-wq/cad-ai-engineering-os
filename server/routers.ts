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
import { assessReadiness, assessUncertainty, buildEvidenceGraph, createExperimentalValidationPlan, getSolverAdapterContract, invalidateCadContext, listExperimentalValidationPlans, listMaterialEvidence, materialPropertyConflicts, negotiateSolver, registerMaterialEvidence } from "./caeEvidence";

const mountingBlockInput = z.object({
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  holeDiameter: z.number().positive(),
  holeEdgeOffset: z.number().positive(),
  filletRadius: z.number().nonnegative(),
  approveAssumption: z.boolean(),
});

const mountingBlockInputPatch = mountingBlockInput.partial();
const caeSelection = z.object({ kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]), id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(320), featureId: z.string().trim().min(1).max(160).optional(), bodyId: z.string().trim().min(1).max(160).optional(), viewerFaceId: z.string().trim().min(1).max(160).optional(), source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]) });
const caePlanInput = z.object({ projectId: z.string().trim().min(1).max(96), sourceCadRevision: z.string().trim().min(1).max(160), sourceCadBranch: z.string().trim().min(1).max(160).optional(), engineeringQuestion: z.string().trim().min(1).max(5000), analysisType: z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"]).optional(), selectedGeometry: caeSelection.optional(), featureHistory: z.array(z.string().trim().min(1).max(160)).max(64).optional(), geometryProvenance: z.enum(["OPENCASCADE_KERNEL", "PARSED_STEP", "PARSED_STL", "UNKNOWN"]).optional(), geometryValidation: z.enum(["VALID", "UNAVAILABLE", "UNKNOWN"]).optional(), requirementIds: z.array(z.string().trim().min(1).max(160)).max(128).optional(), material: z.object({ materialId: z.string().trim().min(1).max(160).optional(), name: z.string().trim().min(1).max(160).optional(), status: z.enum(["COMPLETE", "MATERIAL_KNOWLEDGE_GAP", "UNKNOWN"]), properties: z.array(z.object({ name: z.enum(["ELASTIC_MODULUS", "POISSON_RATIO", "DENSITY", "YIELD_STRENGTH", "THERMAL_CONDUCTIVITY", "THERMAL_EXPANSION", "SPECIFIC_HEAT", "CUSTOM"]), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), source: z.enum(["SOURCE_VERIFIED", "USER_PROVIDED", "DATABASE_VERIFIED", "CALCULATED", "ASSUMED", "UNKNOWN"]), provenance: z.string().trim().min(1).max(500).optional(), requiredFor: z.array(z.enum(["STATIC_STRUCTURAL", "DYNAMIC", "MODAL", "THERMAL", "THERMAL_STRUCTURAL", "CONTACT", "BUCKLING", "FATIGUE"])).max(8) })).max(32) }).optional(), boundaryConditions: z.array(z.object({ id: z.string().trim().min(1).max(160), geometryReference: z.string().trim().min(1).max(240).optional(), type: z.enum(["FIXED", "DISPLACEMENT", "SYMMETRY", "ROLLER", "THERMAL", "CUSTOM"]), direction: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z", "NORMAL", "TANGENTIAL", "ALL"]).optional(), magnitude: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), source: z.enum(["USER_PROVIDED", "REQUIREMENT", "ASSUMED", "UNKNOWN"]), confidence: z.number().min(0).max(1), assumptionStatus: z.enum(["NOT_ASSUMED", "ASSUMED", "UNKNOWN"]), geometryStatus: z.enum(["PROVEN", "AMBIGUOUS", "UNKNOWN"]) })).max(64).optional(), loads: z.array(z.object({ id: z.string().trim().min(1).max(160), type: z.enum(["FORCE", "PRESSURE", "MOMENT", "GRAVITY", "ACCELERATION", "THERMAL", "TIME_DEPENDENT"]), geometryReference: z.string().trim().min(1).max(240).optional(), magnitude: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), direction: z.enum(["GLOBAL_X", "GLOBAL_Y", "GLOBAL_Z", "NORMAL", "CUSTOM"]).optional(), timeDependence: z.string().trim().min(1).max(500).optional(), source: z.enum(["USER_PROVIDED", "REQUIREMENT", "CALCULATED", "ASSUMED", "UNKNOWN"]), assumptionStatus: z.enum(["NOT_ASSUMED", "ASSUMED", "UNKNOWN"]), geometryStatus: z.enum(["PROVEN", "AMBIGUOUS", "UNKNOWN"]) })).max(64).optional(), contacts: z.array(z.object({ id: z.string().trim().min(1).max(160), type: z.enum(["BONDED", "FRICTIONLESS", "FRICTIONAL", "NO_SEPARATION"]), primaryGeometryReference: z.string().trim().min(1).max(240).optional(), secondaryGeometryReference: z.string().trim().min(1).max(240).optional(), source: z.enum(["USER_PROVIDED", "ASSUMED", "UNKNOWN"]), status: z.enum(["PLANNED", "KNOWLEDGE_GAP"]) })).max(64).optional(), meshStrategy: z.object({ elementType: z.enum(["TETRAHEDRAL", "HEXA_HYBRID", "SHELL", "BEAM", "UNKNOWN"]).optional(), targetSize: z.number().positive().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), refinementRegions: z.array(z.object({ geometryReference: z.string().trim().min(1).max(240).optional(), rationale: z.string().trim().min(1).max(500), status: z.enum(["PLANNED", "UNKNOWN"]) })).max(64), qualityRequirements: z.array(z.string().trim().min(1).max(500)).max(32), convergenceRequirement: z.string().trim().min(1).max(500).optional(), status: z.enum(["PLANNED", "MESH_KNOWLEDGE_GAP", "NOT_EXECUTED"]) }).optional() });
const caeAccess = z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) });
const materialEvidenceInput = z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(128).optional(), base64: z.string().min(1).max(7_000_000), type: z.enum(["MATERIAL_DATASHEET", "MANUFACTURER_SPECIFICATION", "TEST_REPORT", "PUBLISHED_RESEARCH", "STANDARDS_DOCUMENTATION", "USER_MEASUREMENT"]), source: z.string().trim().min(1).max(500), sourceDate: z.string().trim().min(1).max(64).optional(), material: z.string().trim().min(1).max(160), property: z.enum(["ELASTIC_MODULUS", "POISSON_RATIO", "DENSITY", "YIELD_STRENGTH", "THERMAL_CONDUCTIVITY", "THERMAL_EXPANSION", "SPECIFIC_HEAT", "CUSTOM"]), value: z.number().finite().optional(), unit: z.string().trim().min(1).max(32).optional(), condition: z.string().trim().min(1).max(500).optional(), provenance: z.enum(["VERIFIED_SOURCE", "USER_PROVIDED", "EXPERIMENTALLY_MEASURED", "CALCULATED", "ASSUMED", "UNKNOWN"]), verificationStatus: z.enum(["VERIFIED", "UNVALIDATED", "CONFLICT", "UNKNOWN"]).optional() });
const experimentalPlanInput = z.object({ simulationId: z.string().trim().min(1).max(160), objective: z.string().trim().min(1).max(2000), hypothesis: z.string().trim().min(1).max(2000), testArticle: z.string().trim().min(1).max(1000), instrumentation: z.array(z.string().trim().min(1).max(500)).max(64), loads: z.array(z.string().trim().min(1).max(500)).max(64), boundaryConditions: z.array(z.string().trim().min(1).max(500)).max(64), measurements: z.array(z.string().trim().min(1).max(500)).max(64), samplingRate: z.string().trim().min(1).max(128).optional(), environment: z.string().trim().min(1).max(500).optional(), acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(64), uncertainties: z.array(z.string().trim().min(1).max(500)).max(64), repeatability: z.string().trim().min(1).max(1000), safetyRequirements: z.array(z.string().trim().min(1).max(500)).max(64), simulationComparison: z.string().trim().min(1).max(2000) });

export const appRouter = router({
  system: systemRouter,
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
      .input(z.object({ name: z.string().trim().min(1).max(255), projectId: z.string().trim().min(1).max(96).optional(), accessKey: z.string().trim().min(16).max(128).optional() }))
      .mutation(({ input }) => openPersistentProject(input)),
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
        projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), conversationId: z.string().trim().min(1).max(96), projectName: z.string().trim().min(1).max(160).optional(), message: z.string().trim().min(1).max(8000), mode: z.enum(["NORMAL", "DEEP_ENGINEERING", "EXPLORATION", "SPECULATIVE", "CHALLENGE"]), configurationId: z.string().trim().min(1).max(160).optional(), modelName: z.string().trim().min(1).max(160).optional(), selectedGeometry: z.object({ kind: z.enum(["FACE", "EDGE", "VERTEX", "FEATURE", "BODY", "SOLID", "ASSEMBLY", "REGION", "NONE"]), id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(320), featureId: z.string().trim().min(1).max(160).optional(), bodyId: z.string().trim().min(1).max(160).optional(), viewerFaceId: z.string().trim().min(1).max(160).optional(), source: z.enum(["VIEWER", "FEATURE_TREE", "WORKBENCH", "NONE"]) }).optional(), requirementSummary: z.string().trim().max(1000).optional(), featureSummary: z.string().trim().max(1000).optional(), parameterSummary: z.string().trim().max(1000).optional(), conceptSummary: z.string().trim().max(1000).optional(), memorySummary: z.string().trim().max(1000).optional(), validationStage: z.enum(["CONCEPTUAL", "ESTIMATED", "CALCULATED", "GEOMETRICALLY_VALIDATED", "PHYSICALLY_PLAUSIBLE", "CAE_VERIFIED", "EXPERIMENTALLY_VALIDATED", "PRODUCTION_READY"]).optional(), attachedFileIds: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
      }))
      .mutation(({ input }) => runPersistentWorkbenchMessage(input)),
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
      .mutation(({ input }) => generateMountingBlock(input.input, input.prompt)),
  }),

  cadAgent: router({
    createConfiguration: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(80), input: mountingBlockInput, sourceText: z.string().trim().min(1).max(5000), conceptual: z.boolean().optional() }))
      .mutation(({ input }) => createMountingBlockConfiguration(input)),
    reviseConfiguration: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1), name: z.string().trim().min(1).max(80).optional(), inputPatch: mountingBlockInputPatch, updateText: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => reviseMountingBlockConfiguration(input)),
    previewConfiguration: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1), inputPatch: mountingBlockInputPatch, updateText: z.string().trim().min(1).max(2000) }))
      .mutation(({ input }) => previewMountingBlockConfiguration(input)),
    listConfigurations: publicProcedure.query(() => listConfigurations()),
    markStale: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1) }))
      .mutation(({ input }) => markConfigurationStale(input.configurationId)),
    exportStep: publicProcedure
      .input(z.object({ configurationId: z.string().trim().min(1) }))
      .mutation(({ input }) => getValidatedStepExport(input.configurationId)),
  }),
});

export type AppRouter = typeof appRouter;
