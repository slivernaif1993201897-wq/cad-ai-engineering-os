import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Classification = "EXECUTOR_CONTROLLED" | "RETIRED" | "READ_ONLY" | "VALIDATION_ONLY";
type InventoryEntry = { id: string; files: string[]; classification: Classification; required: string[] };

const server = (file: string) => readFile(join(process.cwd(), "server", file), "utf8");
const directProtectedWrite = /storagePut\s*\(|\.insert\s*\(engineeringCadFiles\)|appendLineageNode\s*\(|appendPersistentMemory\s*\(/;

const inventory: InventoryEntry[] = [
  { id: "SOURCELESS_DXF", files: ["sourceLessCadExecution.ts", "cad2d.ts"], classification: "EXECUTOR_CONTROLLED", required: ["CREATE_2D_CNC_PLATE", "completeSourceLessGeneration"] },
  { id: "EXTERNAL_TEXT_TO_CAD", files: ["cadAgentSkills.ts", "externalTextToCadAdapter.ts", "sourceLessCadExecution.ts"], classification: "EXECUTOR_CONTROLLED", required: ["executeAuthorizedExternalTextToCadPlate", "CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE"] },
  { id: "CONCEPT_BACKREST", files: ["seatDesignAuthoring.ts", "seatConceptCadEngine.ts", "sourceLessCadExecution.ts"], classification: "EXECUTOR_CONTROLLED", required: ["executeAuthorizedConceptBackrestEnvelope", "CREATE_CONCEPT_BACKREST_ENVELOPE"] },
  { id: "FEATURE_HISTORY_RECTANGLE_CIRCLE_PATTERN", files: ["featureHistory.ts", "sourceLessCadExecution.ts"], classification: "EXECUTOR_CONTROLLED", required: ["promoteFeatureHistoryStep", "CREATE_FEATURE_HISTORY_STEP"] },
  { id: "MOUNTING_BLOCK_ENGINEERING_JOB", files: ["engineeringJob.ts", "cadAgent.ts", "cadKernel.ts", "sourceLessCadExecution.ts"], classification: "EXECUTOR_CONTROLLED", required: ["executeAuthorizedMountingBlock", "CREATE_MOUNTING_BLOCK"] },
  { id: "SOURCE_BOUND_HOLE_BOOLEAN", files: ["cadArtifactOperations.ts", "commonFeatureExecutor.ts"], classification: "EXECUTOR_CONTROLLED", required: ["completeCommonFeature", "ingestCadFile"] },
  { id: "PUBLIC_MOUNTING_BLOCK_ROUTES", files: ["routers.ts"], classification: "RETIRED", required: ["MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED"] },
  { id: "SEAT_KERNEL_GENERATOR", files: ["seatCadEngine.ts", "seatDesignVerification.ts"], classification: "VALIDATION_ONLY", required: ["generateSeatCadArtifact"] },
];

describe("zero-bypass acceptance inventory", () => {
  it("classifies every registered authoritative geometry boundary without UNKNOWN or legacy-direct states", async () => {
    expect(inventory.length).toBeGreaterThan(0);
    expect(inventory.every((entry) => ["EXECUTOR_CONTROLLED", "RETIRED", "READ_ONLY", "VALIDATION_ONLY"].includes(entry.classification))).toBe(true);
    for (const entry of inventory) {
      const sources = await Promise.all(entry.files.map(server));
      for (const marker of entry.required) expect(sources.some((source) => source.includes(marker)), `${entry.id} missing ${marker}`).toBe(true);
    }
  });

  it("requires every executor-controlled entry to reach an approved executor boundary before managed artifact promotion", async () => {
    for (const entry of inventory.filter((item) => item.classification === "EXECUTOR_CONTROLLED")) {
      const sources = await Promise.all(entry.files.map(server));
      expect(sources.some((source) => source.includes("completeSourceLessGeneration") || source.includes("completeCommonFeature")), entry.id).toBe(true);
    }
  });

  it("rejects direct protected writes in adapter, generator, route, and feature-history entry modules", async () => {
    const forbiddenEntryModules = ["externalTextToCadAdapter.ts", "seatConceptCadEngine.ts", "seatCadEngine.ts", "cadKernel.ts", "routers.ts"];
    for (const file of forbiddenEntryModules) expect(await server(file), file).not.toMatch(directProtectedWrite);
  });

  it("proves transitive mounting-block execution reaches the authorized executor and that public alternatives are retired", async () => {
    const [job, sourceLess, routes] = await Promise.all([server("engineeringJob.ts"), server("sourceLessCadExecution.ts"), server("routers.ts")]);
    expect(job).toContain("executeAuthorizedMountingBlock");
    expect(sourceLess).toContain("completeSourceLessGeneration");
    expect(routes).toContain("function retiredMountingBlock");
    for (const procedure of ["createConfiguration", "reviseConfiguration", "previewConfiguration", "exportStep", "generateMountingBlock"]) {
      const declaration = `${procedure}: publicProcedure`;
      const start = routes.indexOf(declaration);
      const section = routes.slice(start, start + 700);
      expect(start, declaration).toBeGreaterThanOrEqual(0);
      expect(section, procedure).toContain("retiredMountingBlock");
    }
  });

  it("rejects transitive forbidden fixtures for route, service, adapter, feature-history, generator, revision, and provenance writes", () => {
    const fixtures = [
      "route -> service -> storagePut(",
      "service -> helper -> storagePut(",
      "adapter -> appendPersistentMemory(",
      "mountingBlock -> storagePut(",
      "featureHistory -> storagePut(",
      "generator -> appendLineageNode(",
      "route -> appendPersistentMemory(",
    ];
    for (const fixture of fixtures) expect(directProtectedWrite.test(fixture), fixture).toBe(true);
  });
});
