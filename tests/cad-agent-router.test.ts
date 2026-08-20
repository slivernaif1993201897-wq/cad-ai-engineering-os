import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const input = { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true };

describe("cadAgent mobile API", () => {
  it("creates a validated configuration, exposes a kernel mesh, and exports real STEP bytes", async () => {
    const caller = appRouter.createCaller(ctx);
    const created = await caller.cadAgent.createConfiguration({
      name: "Router Concept",
      input,
      sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block with four 10 mm holes and a 3 mm fillet.",
    });
    expect(created.configuration.modelStatus).toBe("VALIDATED");
    expect(created.viewerMesh?.triangles.length).toBeGreaterThan(0);

    const exportResult = await caller.cadAgent.exportStep({ configurationId: created.configuration.id });
    expect(exportResult.validationStatus).toBe("VALID");
    expect(Buffer.from(exportResult.stepBase64, "base64").toString("utf8").startsWith("ISO-10303-21")).toBe(true);
  }, 30_000);
});
