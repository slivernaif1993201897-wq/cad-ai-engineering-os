import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const input = { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true };

describe("cadAgent mobile API", () => {
  it("fails closed for retired unauthenticated mounting-block generation and direct STEP export", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.cadAgent.createConfiguration({
      name: "Router Concept",
      input,
      sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block with four 10 mm holes and a 3 mm fillet.",
    })).rejects.toThrow("MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED");
    await expect(caller.cadAgent.exportStep({ configurationId: "CONFIG-RETIRED-R1" })).rejects.toThrow("MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED");
  });
});
