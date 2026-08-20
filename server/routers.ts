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
import { assessCircleRepeatability, compareFeatureRevisions, createCircleFeatureHistory, createFeatureHistory, diagnoseFeatureHistoryFailure, executeCircleFeatureRegeneration, executeFeatureRegeneration, getCircleFilletReadiness, getCircleGeometryExport, inspectCircleTopology, listFeatureHistory, planCircularBoss, previewCircleFeatureRegeneration, previewFeatureRegeneration } from "./featureHistory";
import { FEATURE_CATALOG } from "../shared/featureHistory";
import { createPersistentConversation, listPersistentConversations, openPersistentProject, projectMemorySnapshot, retrievePersistentMemory, updatePersistentConversation } from "./persistentMemory";
import { persistWorkbenchAttachment, recordPersistentConceptDecision, recordPersistentProposalDecision, restoreWorkbenchConversation, runPersistentWorkbenchMessage } from "./persistentWorkbench";
import { applyRequirementRevision, normalizeUnit, parseRequirements } from "./requirementsAgent";

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
    create: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), width: z.number().finite(), height: z.number().finite(), extrudeDistance: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }) }))
      .mutation(({ input }) => createFeatureHistory(input)),
    createCircle: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), input: z.object({ title: z.string().trim().min(1).max(160), centerX: z.number().finite(), centerY: z.number().finite(), radius: z.number().finite(), extrudeDistance: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }) }))
      .mutation(({ input }) => createCircleFeatureHistory(input)),
    list: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128) }))
      .query(({ input }) => listFeatureHistory(input)),
    preview: publicProcedure
      .input(z.object({ projectId: z.string().trim().min(1).max(96), accessKey: z.string().trim().min(16).max(128), sourceRevisionId: z.string().trim().min(1).max(160), edit: z.object({ featureId: z.string().trim().min(1).max(96), parameter: z.object({ name: z.enum(["width", "height", "radius", "centerX", "centerY", "extrudeDistance"]), value: z.number().finite(), unit: z.enum(["mm", "cm", "m"]) }).optional(), targetReferenceId: z.string().trim().min(1).max(160).optional(), direction: z.literal("NORMAL").optional(), featureType: z.enum(["RECTANGLE_SKETCH", "CIRCLE_SKETCH", "EXTRUDE", "REVOLVE", "SWEEP", "LOFT", "BOOLEAN_UNION", "BOOLEAN_CUT", "BOOLEAN_INTERSECTION", "FILLET", "CHAMFER", "SHELL", "DRAFT", "PATTERN", "MIRROR"]).optional(), operationOrder: z.number().int().min(0).max(32).optional() }) }))
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
