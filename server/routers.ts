import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateMountingBlock } from "./cadKernel";
import { createMountingBlockConfiguration, getValidatedStepExport, listConfigurations, markConfigurationStale, reviseMountingBlockConfiguration } from "./cadAgent";
import { runRuthlessEngineeringReview } from "./engineeringReview";
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
