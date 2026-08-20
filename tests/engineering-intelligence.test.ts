import { describe, expect, it } from "vitest";

import { getEngineeringMemory, runEngineeringIntelligence } from "../server/engineeringIntelligence";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 3.5 engineering intelligence core", () => {
  it("decomposes a difficult occupant-safety problem into diverse candidates, specialist challenges, self-correction, and a conceptual-only handoff", () => {
    const result = runEngineeringIntelligence({
      projectId: "BENCH-OCCUPANT",
      mode: "DEEP_ENGINEERING",
      sourceText: "Design a rear automotive seat architecture that controls occupant motion during severe deceleration with low weight, high strength, low cost, high energy absorption, and easy manufacturing.",
    });

    expect(result.decomposition.subsystems.length).toBeGreaterThanOrEqual(5);
    expect(result.decomposition.contradictions.length).toBeGreaterThan(0);
    expect(result.candidates).toHaveLength(5);
    expect(new Set(result.candidates.map((candidate) => candidate.architectureFamily)).size).toBe(5);
    expect(result.specialistFindings).toHaveLength(30);
    expect(new Set(result.specialistFindings.map((finding) => finding.role)).size).toBe(6);
    expect(result.selfCorrections).toHaveLength(5);
    expect(result.cadHandoff.eligibility).toBe("CONCEPTUAL_ONLY");
    expect(result.maximumEffort.remainingAlternatives).toHaveLength(5);
    expect(result.benchmark.passed).toBe(true);
    expect(getEngineeringMemory("BENCH-OCCUPANT").length).toBeGreaterThanOrEqual(11);
  });

  it("generates up to ten genuinely distinct speculative candidates for a major innovation request without claiming evidence", () => {
    const result = runEngineeringIntelligence({
      mode: "SPECULATIVE",
      requestMajorInnovation: true,
      sourceText: "Explore a major innovation for a lightweight automotive occupant system under difficult packaging constraints.",
    });

    expect(result.candidates).toHaveLength(10);
    expect(new Set(result.candidates.map((candidate) => candidate.architectureFamily)).size).toBeGreaterThanOrEqual(7);
    expect(result.candidates.every((candidate) => candidate.truthStatus === "SPECULATIVE")).toBe(true);
    expect(result.candidates.every((candidate) => candidate.requiredEvidence.length > 0)).toBe(true);
    expect(result.ranking.every((rank) => rank.rationale.includes("not a proven" ) || rank.rationale.includes("evidence"))).toBe(true);
  });

  it("does not stop at an impossible statement: it records the physics conflict, attempted work, missing tools, and remaining alternative framing", () => {
    const result = runEngineeringIntelligence({ sourceText: "Create a perpetual motion device with infinite energy and no power source." });

    expect(result.truthReview.gate).toBe("BLOCKED");
    expect(result.cadHandoff.eligibility).toBe("BLOCKED");
    expect(result.maximumEffort.truthStatus).toBe("PHYSICS_CONFLICT");
    expect(result.maximumEffort.attempts.length).toBeGreaterThanOrEqual(4);
    expect(result.maximumEffort.toolsMissing).toContain("No CAE solver execution");
    expect(result.maximumEffort.remainingAlternatives.length).toBeGreaterThanOrEqual(5);
  });

  it("creates a geometry-oriented CAD handoff only when material, load, dimensions, and manufacturing signals are present, without calling it physical validation", () => {
    const result = runEngineeringIntelligence({
      sourceText: "Create a 100 mm × 50 mm × 20 mm steel mounting block for a 1000 N load, machined at low volume.",
    });

    expect(result.cadHandoff.eligibility).toBe("CAD_READY");
    expect(result.cadHandoff.cadPlanOutline).toContain("Define coordinate system and editable parameters.");
    expect(result.cadHandoff.validationPlan.some((item) => item.includes("CAE inputs separately"))).toBe(true);
    expect(result.truthReview.reality.physics).toBe("NOT_ANALYZED");
  });

  it("exposes engineering intelligence and preserved project memory through the mobile-facing API", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.intelligence.analyze({ projectId: "API-BENCH", mode: "CHALLENGE", sourceText: "Design a lightweight high-strength mounting system with low cost." });
    const storedMemory = await caller.intelligence.memory({ projectId: "API-BENCH" });

    expect(result.mode).toBe("CHALLENGE");
    expect(result.specialistFindings.length).toBeGreaterThan(0);
    expect(storedMemory.length).toBeGreaterThan(0);
  });
});
