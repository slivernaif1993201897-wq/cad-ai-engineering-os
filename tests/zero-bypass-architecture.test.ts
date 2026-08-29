import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const server = (file: string) => readFile(join(process.cwd(), "server", file), "utf8");
const assertNoDirectProtectedWrite = (source: string, subject: string) => {
  if (/storagePut\s*\(|\.insert\s*\(engineeringCadFiles\)|appendLineageNode\s*\(|appendPersistentMemory\s*\(/.test(source)) throw new Error(`ZERO_BYPASS_PROTECTED_WRITE_REJECTED:${subject}`);
};
const protectedWriteAllowlist = {
  "cadFileIntelligence.ts": ["ingestCadFile"],
  "sourceLessCadExecution.ts": ["persistSourceLessExecution"],
  "engineeringJob.ts": ["persistJob", "persistEvent"],
  "featureHistory.ts": ["persistRevision", "persistFailure"],
  "cadAgentSkills.ts": ["executeCadAgentCommand"],
} as const;

describe("zero-bypass architectural guard", () => {
  it("permits external text-to-CAD to return untrusted bytes only and forbids direct authoritative promotion from its adapter or command handler", async () => {
    const [adapter, commands, sourceLess] = await Promise.all([server("externalTextToCadAdapter.ts"), server("cadAgentSkills.ts"), server("sourceLessCadExecution.ts")]);
    expect(adapter).not.toMatch(/ingestCadFile|storagePut|appendPersistentMemory|appendLineageNode/);
    expect(commands).toContain("executeAuthorizedExternalTextToCadPlate");
    expect(commands).not.toMatch(/ingestCadFile\s*\(/);
    expect(sourceLess).toContain("completeSourceLessGeneration");
    expect(sourceLess).toContain("appendPersistentMemory");
    expect(sourceLess).toContain("appendLineageNode");
  });

  it("requires explicit operation, authorization, shared-format, exact-byte, managed-ingestion, and ownership checks at the sole source-less completion boundary", async () => {
    const executor = await server("commonFeatureExecutor.ts");
    for (const required of ["SOURCELESS_GENERATION_OPERATION_UNAUTHORIZED", "SOURCELESS_GENERATION_FORMAT_INVALID", "SOURCELESS_GENERATION_FILENAME_INVALID", "SOURCELESS_GENERATION_BYTES_INVALID", "SOURCELESS_GENERATION_INGESTION_INVALID", "SOURCELESS_OPERATION_CONTRACT", "ingestCadFile"]) expect(executor).toContain(required);
  });

  it("requires concept backrest promotion to use the shared source-less executor while keeping residual direct modules visible", async () => {
    const [concept, history, sourceLess, engineeringJob, router] = await Promise.all([server("seatDesignAuthoring.ts"), server("featureHistory.ts"), server("sourceLessCadExecution.ts"), server("engineeringJob.ts"), server("routers.ts")]);
    expect(concept).toContain("generateBackrestConceptCad");
    expect(concept).toContain("executeAuthorizedConceptBackrestEnvelope");
    expect(concept).not.toMatch(/ingestCadFile\s*\(/);
    expect(history).toContain("promoteFeatureHistoryStep");
    expect(history).toContain("executeAuthorizedFeatureHistoryStep");
    expect(history).not.toMatch(/storagePut\s*\(/);
    expect(sourceLess).toContain("CREATE_FEATURE_HISTORY_STEP");
    expect(sourceLess).toContain("CREATE_MOUNTING_BLOCK");
    expect(engineeringJob).toContain("executeAuthorizedMountingBlock");
    expect(router).toContain("generateMountingBlock");
    expect(router).toContain("MOUNTING_BLOCK_DIRECT_EXECUTION_RETIRED");
  });

  it("enforces a narrow function-level protected-write allowlist for authoritative geometry promotion", async () => {
    const protectedModules = ["cadAgent.ts", "cadKernel.ts", "seatDesignAuthoring.ts", "externalTextToCadAdapter.ts", "routers.ts"];
    for (const file of protectedModules) {
      const source = await server(file);
      expect(() => assertNoDirectProtectedWrite(source, file)).not.toThrow();
    }
    for (const [file, owners] of Object.entries(protectedWriteAllowlist)) {
      const source = await server(file);
      for (const owner of owners) expect(source).toContain(owner);
    }
  });

  it("rejects a controlled forbidden direct geometry-to-storage fixture so enforcement is not documentation only", () => {
    const forbiddenRouteFixture = "export async function forbiddenRoute() { const bytes = generateGeometry(); return storagePut('engineering-projects/x/forbidden.step', bytes, 'application/step'); }";
    expect(() => assertNoDirectProtectedWrite(forbiddenRouteFixture, "forbidden-route-fixture")).toThrow("ZERO_BYPASS_PROTECTED_WRITE_REJECTED:forbidden-route-fixture");
  });
});
