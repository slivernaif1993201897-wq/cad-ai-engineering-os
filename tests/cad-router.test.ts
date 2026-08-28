import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

describe("cad.generateMountingBlock", () => {
  it("fails closed because direct geometry generation has been retired pending executor migration", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.cad.generateMountingBlock({
      input: {
        width: 100,
        depth: 50,
        height: 20,
        holeDiameter: 10,
        holeEdgeOffset: 10,
        filletRadius: 3,
        approveAssumption: true,
      },
      prompt: "Create the verified mounting block.",
    })).rejects.toThrow("MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED");
  });
});
