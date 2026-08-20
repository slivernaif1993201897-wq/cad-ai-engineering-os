import { describe, expect, it } from "vitest";

import {
  createMountingBlockConfiguration,
  getValidatedStepExport,
  listConfigurations,
  markConfigurationStale,
  reviseMountingBlockConfiguration,
} from "../server/cadAgent";

const input = {
  width: 100,
  depth: 50,
  height: 20,
  holeDiameter: 10,
  holeEdgeOffset: 10,
  filletRadius: 3,
  approveAssumption: true,
};

const prompt = "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners. Add a 3 mm fillet.";

describe("CAD Agent and Feature Planner", () => {
  it("creates a validated ordered CAD plan and a kernel-derived viewer mesh", async () => {
    const result = await createMountingBlockConfiguration({ name: "Concept A", input, sourceText: prompt });

    expect(result.error).toBeUndefined();
    expect(result.configuration.modelStatus).toBe("VALIDATED");
    expect(result.plan.units).toBe("mm");
    expect(result.plan.coordinate_system.id).toBe("CSYS-WORLD");
    expect(result.plan.feature_order).toEqual(["FEATURE-001", "FEATURE-002", "FEATURE-003", "FEATURE-004", "FEATURE-005"]);
    expect(result.plan.features.map((feature) => feature.featureType)).toEqual(["BOX", "FILLET", "HOLE", "PATTERN", "CUT"]);
    expect(result.plan.execution_notes[0]).toContain("before cutting holes");
    expect(result.plan.features.every((feature) => feature.executionStatus === "EXECUTED")).toBe(true);
    expect(result.viewerMesh?.source).toBe("OpenCascade.js");
    expect(result.viewerMesh?.vertices.length).toBeGreaterThan(0);
    expect(result.viewerMesh?.triangles.length).toBeGreaterThan(0);
    expect(result.viewerMesh?.faceRanges.length).toBeGreaterThan(0);
    expect(result.viewerMesh?.faceRanges.every((range) => range.featureId === "FEATURE-005")).toBe(true);
    expect(result.viewerMesh?.boundingBox.size).toEqual([100, 50, 20]);
    expect(result.configuration.engineeringIntelligence?.cadHandoff.eligibility).toBeDefined();
  }, 30_000);

  it("marks an unregenerated configuration stale only when explicitly requested", async () => {
    const first = listConfigurations().find((configuration) => configuration.name === "Concept A");
    expect(first).toBeDefined();
    const stale = markConfigurationStale(first!.id);
    expect(stale.modelStatus).toBe("STALE");
  });

  it("creates a new revision for a width update and keeps the original configuration", async () => {
    const original = listConfigurations().find((configuration) => configuration.name === "Concept A");
    const result = await reviseMountingBlockConfiguration({
      configurationId: original!.id,
      inputPatch: { width: 70 },
      updateText: "Change width to 70 mm.",
    });

    expect(result.configuration.id).not.toBe(original!.id);
    expect(result.configuration.revision).toBe(original!.revision + 1);
    expect(result.configuration.input.width).toBe(70);
    expect(result.configuration.modelStatus).toBe("VALIDATED");
    expect(result.viewerMesh?.boundingBox.size[0]).toBe(70);
    expect(listConfigurations().some((configuration) => configuration.id === original!.id)).toBe(true);
  }, 30_000);

  it("preserves Concept A while generating an independently validated Concept B", async () => {
    const conceptB = await createMountingBlockConfiguration({
      name: "Concept B", 
      input: { ...input, holeEdgeOffset: 15 },
      sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block with four 10 mm holes arranged farther inward, using a 15 mm edge offset and a 3 mm fillet.",
    });
    const all = listConfigurations();
    expect(conceptB.configuration.modelStatus).toBe("VALIDATED");
    expect(all.some((configuration) => configuration.name === "Concept A")).toBe(true);
    expect(all.some((configuration) => configuration.name === "Concept B")).toBe(true);
  }, 30_000);

  it("exports only a validated real STEP artifact", () => {
    const validated = listConfigurations().find((configuration) => configuration.modelStatus === "VALIDATED");
    const exportResult = getValidatedStepExport(validated!.id);
    expect(exportResult.validationStatus).toBe("VALID");
    expect(exportResult.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(exportResult.stepBase64, "base64").toString("utf8").startsWith("ISO-10303-21")).toBe(true);
  });

  it("stops the CAD Agent when requirements are incomplete", async () => {
    const blocked = await createMountingBlockConfiguration({ name: "Blocked Concept", input, sourceText: "Design a load-bearing bracket." });
    expect(blocked.configuration.modelStatus).toBe("CONCEPTUAL");
    expect(blocked.artifact).toBeUndefined();
    expect(blocked.error).toContain("CAD Agent stopped");
  });

  it("creates a conceptual plan without allowing unresolved requirements to reach the geometry kernel", async () => {
    const conceptual = await createMountingBlockConfiguration({ name: "Conceptual Only", input, sourceText: "Design a load-bearing bracket.", conceptual: true });
    expect(conceptual.configuration.modelStatus).toBe("CONCEPTUAL");
    expect(conceptual.artifact).toBeUndefined();
    expect(conceptual.viewerMesh).toBeUndefined();
    expect(conceptual.error).toContain("without geometry");
  });
});
