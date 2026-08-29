import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { executeEngineeringCommand } from "../engineeringExecutionKernel";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
const eekMutation = t.middleware(async (opts) => {
  if (opts.type !== "mutation" || opts.path === "persistentMemory.openProject" || opts.path === "persistentMemory.message") return opts.next();
  const input = (opts.input ?? {}) as Record<string, unknown>;
  const projectId = typeof input.projectId === "string" ? input.projectId : undefined;
  const accessKey = typeof input.accessKey === "string" ? input.accessKey : undefined;
  if (!projectId || !accessKey) return opts.next();
  const suppliedCommandId = typeof input.commandId === "string" ? input.commandId : undefined;
  const commandId = suppliedCommandId ?? `TRPC:${opts.path}:${projectId}:${JSON.stringify(input).slice(0, 96).replace(/[^A-Za-z0-9._:-]+/g, "-")}`;
  const event = await executeEngineeringCommand({ commandId, operation: `TRPC.${opts.path}`, actor: "USER", projectId, accessKey }, async () => ({ result: await opts.next(), projectId, accessKey }));
  return event.result;
});

export const publicProcedure = t.procedure.use(eekMutation);

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
