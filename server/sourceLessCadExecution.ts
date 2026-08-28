import { createCncTestPlate, exportDxf } from "./cad2d";
import { ingestCadFile } from "./cadFileIntelligence";
import { approveSourceLessGeneration, completeSourceLessGeneration, createSourceLessGenerationDefinition, type SourceLessCompletionResult, type SourceLessGenerationDefinition } from "./commonFeatureExecutor";
import type { ExternalTextToCadExecution } from "./externalTextToCadAdapter";
import { appendLineageNode, appendPersistentMemory } from "./persistentMemory";

export type SourceLessCadExecution = { completion: SourceLessCompletionResult; provenanceRecordId: string; revisionId: string };
export type SourceLessCncPlateExecution = SourceLessCadExecution;

async function persistSourceLessExecution(args: { projectId: string; accessKey: string; actor?: "USER" | "CAD_AGENT" | "SYSTEM"; definition: SourceLessGenerationDefinition; completion: SourceLessCompletionResult; generatorVersion: string }): Promise<SourceLessCadExecution> {
  const provenance = await appendPersistentMemory({
    projectId: args.projectId,
    accessKey: args.accessKey,
    record: {
      kind: "CAD_OPERATION",
      title: `Source-less CAD execution · ${args.completion.operationId} · ${args.completion.artifact.fileName}`,
      content: JSON.stringify({ schema: "SOURCELESS_CAD_EXECUTION_V1", projectId: args.projectId, operationId: args.completion.operationId, definition: args.definition, generator: { id: args.completion.provenance.generatorId, version: args.generatorVersion }, authorization: { context: "PROJECT_ACCESS_KEY", verified: true }, artifact: args.completion.artifact, exactGeneratedByteLength: args.completion.generatedByteLength, validation: args.completion.validation, executor: args.completion.provenance, createdAt: args.completion.provenance.executedAt }),
      truthStatus: "DERIVED",
      validationStage: "GEOMETRICALLY_VALIDATED",
      relatedConfigurationId: args.completion.artifact.fileId,
      authorSource: args.actor ?? "CAD_AGENT",
    },
  });
  const revision = await appendLineageNode({
    projectId: args.projectId,
    accessKey: args.accessKey,
    node: {
      kind: "REVISION",
      sourceRecordId: provenance.id,
      title: `Source-less revision · ${args.completion.artifact.fileName} · v${args.completion.artifact.revision}`,
      reasonForChange: `Authorized ${args.completion.operationId} source-less generation completed through the Common Feature Executor.`,
      changeSummary: JSON.stringify({ artifactFileId: args.completion.artifact.fileId, artifactSha256: args.completion.artifact.sha256, artifactRevision: args.completion.artifact.revision, operationId: args.completion.operationId, executorId: args.completion.provenance.executorId, createdAt: args.completion.provenance.executedAt }),
      status: "VALIDATED",
      authorSource: args.actor ?? "CAD_AGENT",
    },
  });
  return { completion: args.completion, provenanceRecordId: provenance.id, revisionId: revision.id };
}

/** The only server-side authoring entry point for the deterministic DXF plate. */
export async function executeAuthorizedCncTestPlate(args: { projectId: string; accessKey: string; actor?: "USER" | "CAD_AGENT" | "SYSTEM" }): Promise<SourceLessCncPlateExecution> {
  const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_2D_CNC_PLATE", projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: "CAD-AGENT.CAD2D", upstreamRepository: "LOCAL_DETERMINISTIC_MODULE", upstreamCommit: "WORKTREE", upstreamVersion: "1.0.0", parameters: { widthMm: 300, heightMm: 200, holeCount: 4, holeDiameterMm: 12 }, unitSystem: "mm" }));
  const completion = await completeSourceLessGeneration({ definition, executionContext: { projectId: args.projectId, accessKey: args.accessKey, authorizedOperations: ["CREATE_2D_CNC_PLATE"] }, operationId: "CREATE_2D_CNC_PLATE", format: "DXF", filename: "cnc-test-plate.dxf", bytes: exportDxf(createCncTestPlate()), generatorId: "CAD-AGENT.CAD2D", ingestCadFile });
  return persistSourceLessExecution({ ...args, definition, completion, generatorVersion: "1.0.0" });
}

/** Promotes only validated, adapter-returned STEP bytes through the same executor boundary. */
export async function executeAuthorizedExternalTextToCadPlate(args: { projectId: string; accessKey: string; external: ExternalTextToCadExecution; actor?: "USER" | "CAD_AGENT" | "SYSTEM" }): Promise<SourceLessCadExecution> {
  const { external } = args;
  if (external.status !== "EXECUTABLE" || !external.stepBytes || !external.input || !external.skill.sourceRepository || !external.skill.sourceCommit || !external.skill.version) throw new Error("EXTERNAL_TEXT_TO_CAD_OUTPUT_REJECTED");
  const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE", projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: external.skill.skillId, upstreamRepository: external.skill.sourceRepository, upstreamCommit: external.skill.sourceCommit, upstreamVersion: external.skill.version, parameters: external.input, unitSystem: "mm" }));
  const completion = await completeSourceLessGeneration({ definition, executionContext: { projectId: args.projectId, accessKey: args.accessKey, authorizedOperations: ["CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE"] }, operationId: "CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE", format: "STEP", filename: `external-text-to-cad-${definition.generationId}.step`, bytes: external.stepBytes, generatorId: external.skill.skillId, ingestCadFile });
  if (external.stepSha256 && external.stepSha256 !== completion.artifact.sha256) throw new Error("EXTERNAL_TEXT_TO_CAD_HASH_MISMATCH");
  return persistSourceLessExecution({ ...args, definition, completion, generatorVersion: external.skill.version });
}

/** Promotes deterministic concept backrest STEP bytes only through the executor-owned source-less lifecycle. */
export async function executeAuthorizedConceptBackrestEnvelope(args: { projectId: string; accessKey: string; seatRevisionId: string; widthMm: number; heightMm: number; thicknessMm: number; stepBytes: Buffer | Uint8Array; generatorHash: string; actor?: "USER" | "CAD_AGENT" | "SYSTEM" }): Promise<SourceLessCadExecution> {
  if (!args.seatRevisionId || !Number.isFinite(args.widthMm) || !Number.isFinite(args.heightMm) || !Number.isFinite(args.thicknessMm) || args.widthMm <= 0 || args.heightMm <= 0 || args.thicknessMm <= 0) throw new Error("CONCEPT_BACKREST_PARAMETERS_INVALID");
  const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_CONCEPT_BACKREST_ENVELOPE", projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: "CAD-AGENT.CONCEPT_BACKREST", upstreamRepository: "LOCAL_DETERMINISTIC_MODULE", upstreamCommit: "WORKTREE", upstreamVersion: "1.0.0", parameters: { seatRevisionId: args.seatRevisionId, widthMm: args.widthMm, heightMm: args.heightMm, thicknessMm: args.thicknessMm, generatorHash: args.generatorHash }, unitSystem: "mm" }));
  const completion = await completeSourceLessGeneration({ definition, executionContext: { projectId: args.projectId, accessKey: args.accessKey, authorizedOperations: ["CREATE_CONCEPT_BACKREST_ENVELOPE"] }, operationId: "CREATE_CONCEPT_BACKREST_ENVELOPE", format: "STEP", filename: `concept-backrest-${args.generatorHash.slice(0, 12)}.step`, bytes: args.stepBytes, generatorId: "CAD-AGENT.CONCEPT_BACKREST", ingestCadFile });
  if (args.generatorHash !== completion.artifact.sha256) throw new Error("CONCEPT_BACKREST_HASH_MISMATCH");
  return persistSourceLessExecution({ ...args, definition, completion, generatorVersion: "1.0.0" });
}

/** Completes only kernel-validated feature-history STEP bytes through managed ingestion and immutable source-less records. */
export async function executeAuthorizedFeatureHistoryStep(args: { projectId: string; accessKey: string; featureRevisionId: string; featureKinds: string[]; stepBytes: Buffer | Uint8Array; generatorHash: string; actor?: "USER" | "CAD_AGENT" | "SYSTEM" }): Promise<SourceLessCadExecution> {
  if (!args.featureRevisionId || !args.featureKinds.length || !(args.stepBytes instanceof Uint8Array) || !args.stepBytes.byteLength) throw new Error("FEATURE_HISTORY_EXECUTION_INPUT_INVALID");
  const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_FEATURE_HISTORY_STEP", projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: "CAD-AGENT.FEATURE_HISTORY", upstreamRepository: "LOCAL_OPEN_CASCADE_FEATURE_HISTORY", upstreamCommit: "WORKTREE", upstreamVersion: "1.0.0", parameters: { featureRevisionId: args.featureRevisionId, featureKinds: args.featureKinds, generatorHash: args.generatorHash }, unitSystem: "mm" }));
  const completion = await completeSourceLessGeneration({ definition, executionContext: { projectId: args.projectId, accessKey: args.accessKey, authorizedOperations: ["CREATE_FEATURE_HISTORY_STEP"] }, operationId: "CREATE_FEATURE_HISTORY_STEP", format: "STEP", filename: `feature-history-${args.featureRevisionId}.step`, bytes: args.stepBytes, generatorId: "CAD-AGENT.FEATURE_HISTORY", ingestCadFile });
  if (args.generatorHash !== completion.artifact.sha256) throw new Error("FEATURE_HISTORY_STEP_HASH_MISMATCH");
  return persistSourceLessExecution({ ...args, definition, completion, generatorVersion: "1.0.0" });
}

/** Promotes only kernel-validated mounting-block STEP bytes through the authoritative executor lifecycle. */
export async function executeAuthorizedMountingBlock(args: { projectId: string; accessKey: string; configurationId: string; parameters: Record<string, number>; stepBytes: Buffer | Uint8Array; generatorHash: string; actor?: "USER" | "CAD_AGENT" | "SYSTEM" }): Promise<SourceLessCadExecution> {
  if (!args.configurationId || !Object.values(args.parameters).every((value) => Number.isFinite(value) && value > 0) || !(args.stepBytes instanceof Uint8Array) || !args.stepBytes.byteLength) throw new Error("MOUNTING_BLOCK_EXECUTION_INPUT_INVALID");
  const definition = approveSourceLessGeneration(createSourceLessGenerationDefinition({ operationType: "CREATE_MOUNTING_BLOCK", projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY", adapterId: "CAD-AGENT.MOUNTING_BLOCK", upstreamRepository: "LOCAL_OPEN_CASCADE_MODULE", upstreamCommit: "WORKTREE", upstreamVersion: "1.0.0", parameters: { configurationId: args.configurationId, ...args.parameters, generatorHash: args.generatorHash }, unitSystem: "mm" }));
  const completion = await completeSourceLessGeneration({ definition, executionContext: { projectId: args.projectId, accessKey: args.accessKey, authorizedOperations: ["CREATE_MOUNTING_BLOCK"] }, operationId: "CREATE_MOUNTING_BLOCK", format: "STEP", filename: `mounting-block-${args.configurationId}.step`, bytes: args.stepBytes, generatorId: "CAD-AGENT.MOUNTING_BLOCK", ingestCadFile });
  if (args.generatorHash !== completion.artifact.sha256) throw new Error("MOUNTING_BLOCK_STEP_HASH_MISMATCH");
  return persistSourceLessExecution({ ...args, definition, completion, generatorVersion: "1.0.0" });
}
