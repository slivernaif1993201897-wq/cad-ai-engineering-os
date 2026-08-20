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
