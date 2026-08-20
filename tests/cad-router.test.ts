import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

describe("cad.generateMountingBlock", () => {
  it("exposes validated kernel evidence through the mobile API", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cad.generateMountingBlock({
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
    });

    expect(result.artifact?.validationStatus).toBe("VALID");
    expect(result.artifact?.stepByteLength).toBeGreaterThan(0);
  });
});
