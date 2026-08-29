import { describe, expect, it } from "vitest";
import { COMMON_FEATURE_OPERATION_REGISTRY, approveCommonFeature, completeCommonFeature, createCommonFeatureDefinition, previewCommonFeature } from "../server/commonFeatureExecutor";

const source = { fileId: "cad-source", fileName: "source.step", revision: 1, sha256: "a".repeat(64), format: "STEP" };

describe("Common Feature Executor", () => {
  it("registers cylindrical hole and Boolean Cut under the same typed preview-approval-output contract", async () => {
    expect(COMMON_FEATURE_OPERATION_REGISTRY.map((entry) => entry.operationId)).toEqual(expect.arrayContaining(["CYLINDRICAL_HOLE", "BOOLEAN_CUT"]));
    for (const operationType of ["CYLINDRICAL_HOLE", "BOOLEAN_CUT"] as const) {
      const definition = createCommonFeatureDefinition({ featureId: `feature-${operationType}`, featureRevision: 1, operationType, sourceArtifact: source, sourceRevision: 1, parameters: operationType === "CYLINDRICAL_HOLE" ? { diameter: 10, depth: 5 } : { cutter: "cad-cutter" }, unitSystem: "mm", inputGeometry: ["EXPLICIT_BREP"], dependencies: [source.fileId, source.sha256], projectId: "project", authorizationContext: "PROJECT_ACCESS_KEY" });
      const preview = await previewCommonFeature(definition, async () => undefined);
      const approved = approveCommonFeature(preview, source);
      const output = { ...source, fileId: `result-${operationType}`, fileName: `${operationType}.step`, revision: 1, sha256: operationType === "CYLINDRICAL_HOLE" ? "b".repeat(64) : "c".repeat(64) };
      const execution = completeCommonFeature({ preview, approved, outputArtifact: output, validationId: "CAD_VALIDATION-proof", timing: { kernelExecutionMs: 5, artifactIngestionMs: 4, validationMs: 3, totalExecutionMs: 12 } });
      expect(execution).toMatchObject({ status: "VALIDATED", outputHash: output.sha256, outputRevision: 1, provenance: { executorId: "CAD-AGENT.COMMON_FEATURE_EXECUTOR", sourceHash: source.sha256 }, timing: { totalExecutionMs: 12 } });
      expect(() => approveCommonFeature(preview, { ...source, revision: 2 })).toThrow("APPROVAL_INVALIDATED");
    }
  });
});
