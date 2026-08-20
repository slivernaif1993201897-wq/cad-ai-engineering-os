import { describe, expect, it } from "vitest";

import { createMountingBlockConfiguration } from "../server/cadAgent";
import { runRuthlessEngineeringReview } from "../server/engineeringReview";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 3.6 engineering truth and ruthless review", () => {
  it("challenges an under-specified safety concept without inventing validation evidence", () => {
    const review = runRuthlessEngineeringReview({ sourceText: "Create a revolutionary rear automotive seat architecture that controls occupant motion during severe deceleration." });

    expect(review.verdict).toBe("THE_CONCEPT_IS_WEAK");
    expect(review.gate).toBe("CONCEPTUAL_ONLY");
    expect(review.unknown.some((item) => item.id === "UNKNOWN-VEHICLE-001")).toBe(true);
    expect(review.alternatives).toHaveLength(3);
    expect(review.alternatives.every((item) => item.truthStatus === "HYPOTHETICAL")).toBe(true);
    expect(review.redTeam.some((item) => item.category === "SAFETY")).toBe(true);
    expect(review.evidenceChains[0].results[0].truthStatus).toBe("UNVERIFIED");
    expect(review.selfCritique.nonValidatedClaims[0]).toContain("No structural");
  });

  it("separates an explicit assumption from a fact and never promotes confidence into truth", () => {
    const review = runRuthlessEngineeringReview({ sourceText: "Assume vehicle mass = 1800 kg. Create a low weight, high strength, low cost occupant structure." });
    const assumption = review.assumptions[0];

    expect(assumption.truthStatus).toBe("ASSUMED");
    expect(assumption.confidence).toBe(1);
    expect(review.known[0].truthStatus).toBe("FACT");
    expect(review.known[0].provenance).toContain("intent, not feasibility");
    expect(review.contradictions.length).toBeGreaterThan(0);
  });

  it("identifies a direct physics conflict and returns a reasoned block rather than an unsupported impossibility claim", () => {
    const review = runRuthlessEngineeringReview({ sourceText: "Create a perpetual motion mounting block that delivers infinite energy with no power source." });

    expect(review.gate).toBe("BLOCKED");
    expect(review.verdict).toBe("THIS_APPROACH_FAILS_BECAUSE");
    expect(review.physics[0].truthStatus).toBe("PHYSICS_CONFLICT");
    expect(review.nextTest.text).toContain("energy balance");
    expect(review.contradictions[0].resolutionPrinciples.length).toBeGreaterThan(0);
  });

  it("permits a geometry-ready exploration without claiming physical validation", () => {
    const review = runRuthlessEngineeringReview({ sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block in steel for a 1000 N load, machined at low volume." });

    expect(review.gate).toBe("CAD_ELIGIBLE");
    expect(review.reality.geometry).toBe("NOT_GENERATED");
    expect(review.reality.physics).toBe("NOT_ANALYZED");
    expect(review.reality.productionReadiness).toBe("NOT_READY");
    expect(review.limitations.some((item) => item.text.includes("No CAE solver"))).toBe(true);
  });

  it("blocks OpenCascade execution when the source statement contains a physics conflict", async () => {
    const result = await createMountingBlockConfiguration({
      name: "Physics Blocked",
      sourceText: "Create a 100 mm × 50 mm × 20 mm perpetual motion mounting block with infinite energy and no power source.",
      input: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
    });

    expect(result.configuration.modelStatus).toBe("CONCEPTUAL");
    expect(result.artifact).toBeUndefined();
    expect(result.configuration.engineeringReview.gate).toBe("BLOCKED");
    expect(result.error).toContain("PHYSICS_CONFLICT");
  });

  it("exposes the same truthful review through the mobile-facing API", async () => {
    const caller = appRouter.createCaller(ctx);
    const review = await caller.engineering.review({ sourceText: "Explore a speculative lightweight, high-strength, low-cost mechanism." , exploratoryMode: true });

    expect(review.exploratoryMode).toBe(true);
    expect(review.alternatives.length).toBeGreaterThanOrEqual(3);
    expect(review.alternatives.every((item) => item.truthStatus === "HYPOTHETICAL")).toBe(true);
  });
});
