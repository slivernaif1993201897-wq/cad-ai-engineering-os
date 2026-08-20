import { z } from "zod";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateMountingBlock } from "./cadKernel";

const mountingBlockInput = z.object({
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  holeDiameter: z.number().positive(),
  holeEdgeOffset: z.number().positive(),
  filletRadius: z.number().nonnegative(),
  approveAssumption: z.boolean(),
});

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
});

export type AppRouter = typeof appRouter;
