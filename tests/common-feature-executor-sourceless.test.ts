import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createCncTestPlate, exportDxf } from "../server/cad2d";
import { ingestCadFile } from "../server/cadFileIntelligence";
import { approveSourceLessGeneration, completeSourceLessGeneration, createSourceLessGenerationDefinition } from "../server/commonFeatureExecutor";
import { openPersistentProject } from "../server/persistentMemory";

describe("source-less Common Feature Executor completion", () => {
  it("ingests exact authorized CNC-plate DXF bytes through the authoritative lifecycle", async () => {
    const project = await openPersistentProject({ name: "Source-less CNC executor integration" });
    const bytes = exportDxf(createCncTestPlate());
    const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({
      operationType: "CREATE_2D_CNC_PLATE",
      projectId: project.id,
      authorizationContext: "PROJECT_ACCESS_KEY",
      adapterId: "CAD-AGENT.CAD2D",
      upstreamRepository: "LOCAL_DETERMINISTIC_MODULE",
      upstreamCommit: "WORKTREE",
      upstreamVersion: "1.0.0",
      parameters: { widthMm: 300, heightMm: 200, holeCount: 4 },
      unitSystem: "mm",
    }));

    const result = await completeSourceLessGeneration({
      definition,
      executionContext: { projectId: project.id, accessKey: project.accessKey, authorizedOperations: ["CREATE_2D_CNC_PLATE"] },
      operationId: "CREATE_2D_CNC_PLATE",
      format: "DXF",
      filename: "cnc-test-plate.dxf",
      bytes,
      generatorId: "CAD-AGENT.CAD2D",
      ingestCadFile,
    });

    expect(result).toMatchObject({ success: true, operationId: "CREATE_2D_CNC_PLATE", projectId: project.id, format: "DXF", generatedByteLength: bytes.byteLength, validation: { validationStatus: "VALID" } });
    expect(result.artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.artifact.format).toBe("DXF");
  }, 30_000);

  it("rejects unauthorized, wrong-format, and empty-byte attempts before ingestion", async () => {
    const project = await openPersistentProject({ name: "Source-less CNC executor rejection" });
    const approved = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_2D_CNC_PLATE", projectId: project.id, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: "CAD-AGENT.CAD2D", upstreamRepository: "LOCAL_DETERMINISTIC_MODULE", upstreamCommit: "WORKTREE", upstreamVersion: "1.0.0", parameters: {}, unitSystem: "mm" }));
    const base = { definition: approved, executionContext: { projectId: project.id, accessKey: project.accessKey, authorizedOperations: [] as const }, operationId: "CREATE_2D_CNC_PLATE" as const, filename: "plate.dxf", generatorId: "CAD-AGENT.CAD2D", ingestCadFile };
    await expect(completeSourceLessGeneration({ ...base, format: "DXF", bytes: exportDxf(createCncTestPlate()) })).rejects.toThrow("SOURCELESS_GENERATION_OPERATION_UNAUTHORIZED");
    await expect(completeSourceLessGeneration({ ...base, executionContext: { ...base.executionContext, authorizedOperations: ["CREATE_2D_CNC_PLATE"] }, format: "STEP", bytes: Buffer.from("not-dxf") })).rejects.toThrow("SOURCELESS_GENERATION_FORMAT_INVALID");
    await expect(completeSourceLessGeneration({ ...base, executionContext: { ...base.executionContext, authorizedOperations: ["CREATE_2D_CNC_PLATE"] }, format: "DXF", bytes: Buffer.alloc(0) })).rejects.toThrow("SOURCELESS_GENERATION_BYTES_INVALID");
  }, 30_000);
});
