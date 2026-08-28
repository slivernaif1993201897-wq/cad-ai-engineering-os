import { createHash, randomUUID } from "node:crypto";

import type { CADFileFormat, CADFileUploadInput, CADFileUploadResult } from "../shared/cadFile";

export type FeatureBinding = { fileId: string; fileName: string; revision: number; sha256: string; format: string; storageKey?: string; storageUrl?: string };
export type FeatureOperationType = "CYLINDRICAL_HOLE" | "BOOLEAN_CUT" | "SOURCELESS_TEXT_TO_CAD";
export type FeatureApproval = "REQUIRED" | "APPROVED" | "INVALIDATED";
export type FeatureExecutionStatus = "PREVIEW_READY" | "KERNEL_EXECUTED" | "VALIDATED" | "FAILED" | "REJECTED";
export type CommonFeatureDefinition = {
  featureId: string;
  featureRevision: number;
  operationType: FeatureOperationType;
  sourceArtifact: FeatureBinding;
  sourceRevision: number;
  parameters: Record<string, unknown>;
  unitSystem: "mm";
  inputGeometry: string[];
  dependencies: string[];
  projectId: string;
  authorizationContext: "PROJECT_ACCESS_KEY";
  approvalState: FeatureApproval;
  previewStatus: FeatureExecutionStatus;
  executionStatus: FeatureExecutionStatus;
  validationStatus: "PENDING" | "VALID" | "INVALID" | "UNAVAILABLE";
  definitionHash: string;
};
export type CommonFeaturePreview = { operationId: string; definition: CommonFeatureDefinition; previewHash: string; createdAt: string; timing: { inputValidationMs: number; previewKernelMs: number; totalPreviewMs: number } };
export type CommonFeatureExecution = { executionId: string; operationId: string; definitionHash: string; outputArtifact?: FeatureBinding; outputHash?: string; outputRevision?: number; validationId?: string; status: FeatureExecutionStatus; provenance: { executorId: "CAD-AGENT.COMMON_FEATURE_EXECUTOR"; operationId: string; version: "1.0.0"; sourceHash: string; sourceRevision: number; approvalHash: string; executedAt: string }; timing: { kernelExecutionMs: number; artifactIngestionMs: number; validationMs: number; totalExecutionMs: number } };
export type CommonFeatureOperation = { operationId: FeatureOperationType; version: "1.0.0"; engine: "OpenCascade"; previewSupport: true; executionSupport: true; validationSupport: true; testReference: string[]; status: "VERIFIED" };
export type SourceLessOperationType = "CREATE_2D_CNC_PLATE" | "CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE" | "CREATE_CONCEPT_BACKREST_ENVELOPE" | "CREATE_FEATURE_HISTORY_STEP" | "CREATE_MOUNTING_BLOCK";
export type SourceLessGenerationDefinition = { generationId: string; operationType: "SOURCELESS_TEXT_TO_CAD" | SourceLessOperationType; projectId: string; authorizationContext: "PROJECT_ACCESS_KEY"; adapterId: string; upstreamRepository: string; upstreamCommit: string; upstreamVersion: string; parameters: Record<string, unknown>; unitSystem: "mm"; confirmationState: "REQUIRED" | "APPROVED"; requestHash: string };
export type SourceLessExecutionContext = { projectId: string; accessKey: string; authorizedOperations: readonly SourceLessOperationType[] };
export type SourceLessCadIngestion = (input: CADFileUploadInput) => Promise<CADFileUploadResult>;
export type SourceLessCompletionResult = {
  success: true;
  executionId: string;
  operationId: SourceLessOperationType;
  projectId: string;
  format: "DXF" | "STEP";
  generatedByteLength: number;
  artifact: FeatureBinding;
  validation: { parseStatus: string; validationStatus: string };
  provenance: { executorId: "CAD-AGENT.COMMON_FEATURE_EXECUTOR"; version: "1.0.0"; generatorId: string; approvalHash: string; executedAt: string };
};

export const COMMON_FEATURE_OPERATION_REGISTRY: readonly CommonFeatureOperation[] = [
  { operationId: "CYLINDRICAL_HOLE", version: "1.0.0", engine: "OpenCascade", previewSupport: true, executionSupport: true, validationSupport: true, testReference: ["tests/common-feature-executor.test.ts", "tests/cad-artifact-operations-http.test.ts"], status: "VERIFIED" },
  { operationId: "BOOLEAN_CUT", version: "1.0.0", engine: "OpenCascade", previewSupport: true, executionSupport: true, validationSupport: true, testReference: ["tests/common-feature-executor.test.ts", "tests/cad-artifact-operations-http.test.ts"], status: "VERIFIED" },
  { operationId: "SOURCELESS_TEXT_TO_CAD", version: "1.0.0", engine: "OpenCascade", previewSupport: true, executionSupport: true, validationSupport: true, testReference: ["tests/external-text-to-cad-http.test.ts"], status: "VERIFIED" },
] as const;

const SOURCELESS_OPERATION_CONTRACT: Record<SourceLessOperationType, { format: "DXF" | "STEP"; extension: ".dxf" | ".step"; mimeType: string }> = {
  CREATE_2D_CNC_PLATE: { format: "DXF", extension: ".dxf", mimeType: "application/dxf" },
  CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE: { format: "STEP", extension: ".step", mimeType: "application/step" },
  CREATE_CONCEPT_BACKREST_ENVELOPE: { format: "STEP", extension: ".step", mimeType: "application/step" },
  CREATE_FEATURE_HISTORY_STEP: { format: "STEP", extension: ".step", mimeType: "application/step" },
  CREATE_MOUNTING_BLOCK: { format: "STEP", extension: ".step", mimeType: "application/step" },
};

function canonical(value: unknown) { return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort()); }
function sha(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }
const now = () => new Date().toISOString();
const elapsed = (started: number) => Math.max(0, Date.now() - started);

export function createCommonFeatureDefinition(input: Omit<CommonFeatureDefinition, "definitionHash" | "approvalState" | "previewStatus" | "executionStatus" | "validationStatus">): CommonFeatureDefinition {
  if (!COMMON_FEATURE_OPERATION_REGISTRY.some((entry) => entry.operationId === input.operationType)) throw new Error("FEATURE_OPERATION_UNREGISTERED");
  if (!input.projectId || !input.sourceArtifact.fileId || !input.sourceArtifact.sha256 || input.sourceArtifact.revision !== input.sourceRevision) throw new Error("FEATURE_DEFINITION_SOURCE_BINDING_INVALID");
  if (input.unitSystem !== "mm") throw new Error("FEATURE_UNIT_SYSTEM_UNSUPPORTED");
  const base = { ...input, approvalState: "REQUIRED" as const, previewStatus: "PREVIEW_READY" as const, executionStatus: "PREVIEW_READY" as const, validationStatus: "PENDING" as const };
  return { ...base, definitionHash: sha(base) };
}

export function createSourceLessGenerationDefinition(input: Omit<SourceLessGenerationDefinition, "generationId" | "confirmationState" | "requestHash">): SourceLessGenerationDefinition {
  if (!input.projectId || input.authorizationContext !== "PROJECT_ACCESS_KEY" || !input.adapterId || !input.upstreamRepository || !input.upstreamCommit || !input.upstreamVersion || input.unitSystem !== "mm" || !["SOURCELESS_TEXT_TO_CAD", "CREATE_2D_CNC_PLATE", "CREATE_EXTERNAL_TEXT_TO_CAD_RECTANGULAR_PLATE", "CREATE_CONCEPT_BACKREST_ENVELOPE", "CREATE_FEATURE_HISTORY_STEP", "CREATE_MOUNTING_BLOCK"].includes(input.operationType)) throw new Error("SOURCELESS_GENERATION_AUTHORITY_INVALID");
  const base = { ...input, generationId: `SOURCELESS-GENERATION-${randomUUID()}`, confirmationState: "REQUIRED" as const };
  return { ...base, requestHash: sha(base) };
}

export function approveSourceLessGeneration(definition: SourceLessGenerationDefinition) {
  if (definition.confirmationState !== "REQUIRED") throw new Error("SOURCELESS_GENERATION_APPROVAL_INVALID");
  return { ...definition, confirmationState: "APPROVED" as const };
}

/**
 * Source-less execution owns authorization, operation, format, and byte-envelope
 * checks. The injected authoritative ingestion boundary owns byte hashing,
 * managed storage, CAD validation, and durable artifact creation.
 */
export async function completeSourceLessGeneration(args: {
  definition: SourceLessGenerationDefinition;
  executionContext: SourceLessExecutionContext;
  operationId: SourceLessOperationType;
  format: CADFileFormat;
  filename: string;
  bytes: Buffer | Uint8Array;
  generatorId: string;
  ingestCadFile: SourceLessCadIngestion;
}): Promise<SourceLessCompletionResult> {
  if (args.definition.confirmationState !== "APPROVED") throw new Error("SOURCELESS_GENERATION_APPROVAL_REQUIRED");
  if (args.definition.operationType !== args.operationId) throw new Error("SOURCELESS_GENERATION_DEFINITION_OPERATION_MISMATCH");
  if (args.definition.projectId !== args.executionContext.projectId || !args.executionContext.accessKey) throw new Error("SOURCELESS_GENERATION_PROJECT_AUTHORIZATION_INVALID");
  if (!args.executionContext.authorizedOperations.includes(args.operationId)) throw new Error("SOURCELESS_GENERATION_OPERATION_UNAUTHORIZED");
  const contract = SOURCELESS_OPERATION_CONTRACT[args.operationId];
  if (!contract) throw new Error("SOURCELESS_GENERATION_OPERATION_UNREGISTERED");
  if (args.format !== contract.format) throw new Error("SOURCELESS_GENERATION_FORMAT_INVALID");
  if (!args.filename.trim().toLowerCase().endsWith(contract.extension)) throw new Error("SOURCELESS_GENERATION_FILENAME_INVALID");
  if (!(args.bytes instanceof Uint8Array) || args.bytes.byteLength === 0) throw new Error("SOURCELESS_GENERATION_BYTES_INVALID");
  if (!args.generatorId.trim()) throw new Error("SOURCELESS_GENERATION_GENERATOR_INVALID");

  const exactBytes = Buffer.from(args.bytes.buffer, args.bytes.byteOffset, args.bytes.byteLength);
  const result = await args.ingestCadFile({ projectId: args.executionContext.projectId, accessKey: args.executionContext.accessKey, fileName: args.filename, mimeType: contract.mimeType, base64: exactBytes.toString("base64") });
  if (result.file.projectId !== args.executionContext.projectId || result.file.format !== contract.format || result.file.validationStatus !== "VALID") throw new Error("SOURCELESS_GENERATION_INGESTION_INVALID");

  return {
    success: true,
    executionId: `SOURCELESS_EXECUTION-${randomUUID()}`,
    operationId: args.operationId,
    projectId: args.executionContext.projectId,
    format: contract.format,
    generatedByteLength: exactBytes.byteLength,
    artifact: { fileId: result.file.fileId, fileName: result.file.fileName, revision: result.file.version, sha256: result.file.sha256, format: result.file.format, storageKey: result.file.storage.key, storageUrl: result.file.storage.url },
    validation: { parseStatus: result.file.parseStatus, validationStatus: result.file.validationStatus },
    provenance: { executorId: "CAD-AGENT.COMMON_FEATURE_EXECUTOR", version: "1.0.0", generatorId: args.generatorId, approvalHash: createHash("sha256").update(args.definition.requestHash).digest("hex"), executedAt: now() },
  };
}

export async function previewCommonFeature(definition: CommonFeatureDefinition, kernelPreview: () => Promise<void>): Promise<CommonFeaturePreview> {
  const started = Date.now(); await kernelPreview(); const total = elapsed(started); const operationId = `FEATURE_PREVIEW-${randomUUID()}`;
  return { operationId, definition, previewHash: sha({ operationId, definitionHash: definition.definitionHash, sourceHash: definition.sourceArtifact.sha256, sourceRevision: definition.sourceRevision }), createdAt: now(), timing: { inputValidationMs: 0, previewKernelMs: total, totalPreviewMs: total } };
}

export function approveCommonFeature(preview: CommonFeaturePreview, source: FeatureBinding) {
  if (preview.definition.sourceArtifact.fileId !== source.fileId || preview.definition.sourceArtifact.sha256 !== source.sha256 || preview.definition.sourceRevision !== source.revision) throw new Error("APPROVAL_INVALIDATED: source artifact revision or hash differs from preview definition.");
  return { ...preview.definition, approvalState: "APPROVED" as const };
}

export function completeCommonFeature(args: { preview: CommonFeaturePreview; approved: CommonFeatureDefinition; outputArtifact: FeatureBinding; validationId: string; timing: CommonFeatureExecution["timing"] }): CommonFeatureExecution {
  if (args.approved.approvalState !== "APPROVED" || args.approved.definitionHash !== args.preview.definition.definitionHash) throw new Error("APPROVAL_INVALIDATED: approval is not bound to the previewed feature definition.");
  return { executionId: `FEATURE_EXECUTION-${randomUUID()}`, operationId: args.preview.operationId, definitionHash: args.approved.definitionHash, outputArtifact: args.outputArtifact, outputHash: args.outputArtifact.sha256, outputRevision: args.outputArtifact.revision, validationId: args.validationId, status: "VALIDATED", provenance: { executorId: "CAD-AGENT.COMMON_FEATURE_EXECUTOR", operationId: args.preview.operationId, version: "1.0.0", sourceHash: args.approved.sourceArtifact.sha256, sourceRevision: args.approved.sourceRevision, approvalHash: args.preview.previewHash, executedAt: now() }, timing: args.timing };
}
