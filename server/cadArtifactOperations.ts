import { createHash, randomUUID } from "node:crypto";

import type { CADFileContext } from "../shared/cadFile";
import { exportValidatedStep, extractKernelViewerMesh, getOpenCascadeKernel, KERNEL_VIEWER_LIMITS } from "./cadKernel";
import { getCadFileContext, ingestCadFile, loadVerifiedCadFileBytes } from "./cadFileIntelligence";
import { appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";
import { storagePut } from "./storage";
import { approveCommonFeature, completeCommonFeature, createCommonFeatureDefinition, previewCommonFeature, type CommonFeatureExecution, type CommonFeaturePreview } from "./commonFeatureExecutor";
import { assertOpenCascadeAdmission, runWithOpenCascadeAdmission } from "./runtimeAdmission";

type CheckStatus = "PASS" | "FAIL" | "WARNING" | "NOT_AVAILABLE" | "REQUIRED_INPUT";
type Vector3 = { x: number; y: number; z: number };
type ValidationReport = {
  validationId: string; persistedRecordId?: string; projectId: string; artifact: { fileId: string; fileName: string; format: string; revision: number; sha256: string; byteLength: number; componentIdentity: { status: CheckStatus; value?: string; reason: string } };
  overallStatus: CheckStatus; kernel: { status: CheckStatus; engine: string; loadStatus: CheckStatus }; topology: { status: CheckStatus; shapeValidity: CheckStatus; nullOrEmpty: CheckStatus; selfIntersection: CheckStatus; counts: { solids: number; shells: number; faces: number; edges: number; vertices: number } };
  bounds: { status: CheckStatus; min?: Vector3; max?: Vector3; size?: Vector3; diagonal?: number; unit: string; unitStatus: CheckStatus }; warnings: string[]; failures: string[]; reproducibility: { sourceSha256: string; parser: string; parserVersion: string; createdAt: string }; limitations: string[];
};
type BooleanPreview = { operationId: string; persistedRecordId?: string; projectId: string; operation: "CUT"; source: ArtifactBinding; cutter: ArtifactBinding; commonPreview?: CommonFeaturePreview; previewStatus: "PREVIEW_READY" | "BOOLEAN_OPERATION_FAILED" | "REQUIRED_INPUT"; approvalStatus: "REQUIRED"; proposedArtifactName: string; proposedRevision: string; warnings: string[]; failures: string[]; createdAt: string };
type CylindricalHoleInput = { diameter: number; depth: number; center: Vector3; direction: Vector3; unit: "mm" };
type ControlledFeature = { featureId: string; featureRevision: number; parentArtifact: ArtifactBinding; operationType: "CYLINDRICAL_HOLE"; parameters: CylindricalHoleInput; inputGeometry: "EXPLICIT_CYLINDER"; dependencies: string[]; commonPreview?: CommonFeaturePreview; commonExecution?: CommonFeatureExecution; executionStatus: "PREVIEW_READY" | "KERNEL_VALIDATED" | "FAILED"; validationStatus: "VALID" | "INVALID" | "UNAVAILABLE"; provenance: { operationId: string; sourceSha256: string; createdAt: string }; outputArtifact?: ArtifactBinding };
type HolePreview = { operationId: string; persistedRecordId?: string; projectId: string; operation: "CYLINDRICAL_HOLE"; source: ArtifactBinding; parameters: CylindricalHoleInput; feature: ControlledFeature; previewStatus: "PREVIEW_READY" | "HOLE_OPERATION_FAILED" | "REQUIRED_INPUT"; approvalStatus: "REQUIRED"; proposedArtifactName: string; proposedRevision: string; warnings: string[]; failures: string[]; createdAt: string };
type ArtifactBinding = { fileId: string; fileName: string; revision: number; sha256: string; format: string };
type DrawingExport = { drawingId: string; persistedRecordId?: string; projectId: string; source: ArtifactBinding; validationId: string; view: "FRONT" | "REAR" | "LEFT" | "RIGHT" | "TOP" | "BOTTOM" | "ISOMETRIC"; format: "SVG"; status: "EXPORTED"; drawingRevision: string; sha256: string; storage: { key: string; url: string }; createdAt: string; limitations: string[] };

const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const iso = () => new Date().toISOString();
const binding = (file: CADFileContext): ArtifactBinding => ({ fileId: file.fileId, fileName: file.fileName, revision: file.version, sha256: file.sha256, format: file.format });
const safeJson = <T>(value: string): T | null => { try { return JSON.parse(value) as T; } catch { return null; } };

function count(oc: any, shape: any, enumValue: any) { const explorer = new oc.TopExp_Explorer_2(shape, enumValue, oc.TopAbs_ShapeEnum.TopAbs_SHAPE); let value = 0; while (explorer.More()) { value += 1; explorer.Next(); } explorer.delete(); return value; }
function stepUnit(file: CADFileContext): { unit: string; status: CheckStatus } { return file.units.status === "KNOWN" && file.units.value ? { unit: file.units.value, status: "PASS" } : { unit: "UNKNOWN", status: "NOT_AVAILABLE" }; }
function requireValidStep(file: CADFileContext) { if (file.format !== "STEP") throw new Error("REQUIRED_INPUT: Controlled kernel operation currently requires a verified STEP artifact."); if (file.parseStatus !== "PARSED" || file.validationStatus !== "VALID") throw new Error("REQUIRED_INPUT: CAD artifact must be parsed and geometrically valid before this operation."); }

async function loadShape(args: { projectId: string; accessKey: string; fileId: string }) {
  assertOpenCascadeAdmission();
  const { file, bytes } = await loadVerifiedCadFileBytes(args); requireValidStep(file); const oc = await getOpenCascadeKernel(); const path = `/cad-operation-${randomUUID()}.step`; let reader: any;
  let progress: any;
  try { (oc as any).FS.writeFile(path, bytes); reader = new (oc as any).STEPControl_Reader_1(); const read = reader.ReadFile(path); if (read === false || read === 0 || /fail|error/i.test(String(read))) throw new Error("INVALID_STEP_INPUT: OpenCascade STEP reader rejected the managed source bytes."); const roots = Number(reader.NbRootsForTransfer()); progress = new (oc as any).Message_ProgressRange_1(); const transferred = Number(reader.TransferRoots(progress)); const shape = reader.OneShape(); if (!roots || !transferred || shape.IsNull()) throw new Error("INVALID_STEP_INPUT: OpenCascade could not transfer the verified STEP source into a BRep."); progress.delete?.(); return { oc, file, path, reader, shape }; } catch (error) { try { progress?.delete?.(); reader?.delete?.(); (oc as any).FS.unlink(path); } catch { /* best effort */ } throw error; }
}
function disposeShape(resource: Awaited<ReturnType<typeof loadShape>>) { try { resource.shape?.delete?.(); resource.reader?.delete?.(); (resource.oc as any).FS.unlink(resource.path); } catch { /* best effort */ } }

export async function createCadValidation(args: { projectId: string; accessKey: string; fileId: string }): Promise<ValidationReport> {
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, async () => {
  const authorizedFile = await getCadFileContext(args); const validationId = id("CAD_VALIDATION"); const createdAt = iso(); let report: ValidationReport;
  try {
    const resource = await loadShape(args); const { oc, file, shape } = resource;
    try {
      const analyzer = new oc.BRepCheck_Analyzer(shape, true, false); const valid = Boolean(analyzer.IsValid_2()); analyzer.delete();
      const counts = { solids: count(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID), shells: count(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SHELL), faces: count(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_FACE), edges: count(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE), vertices: count(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_VERTEX) };
      const mesh = extractKernelViewerMesh(oc, shape, `VALIDATION-${file.fileId}`); const unit = stepUnit(file); const empty = !counts.solids && !counts.shells && !counts.faces;
      const failures = [...(!valid ? ["OpenCascade BRepCheck_Analyzer reported an invalid topology."] : []), ...(empty ? ["Imported shape has no solids, shells, or faces."] : [])]; const warnings = [...(unit.status === "NOT_AVAILABLE" ? ["STEP unit declaration was not reliably available from the persisted artifact context."] : []), "Self-intersection classification is not separately asserted because the current OpenCascade binding exposes the authoritative BRep validity result but not a dedicated self-intersection report."];
      report = { validationId, projectId: args.projectId, artifact: { ...binding(file), byteLength: file.fileSizeBytes, componentIdentity: { status: "NOT_AVAILABLE", reason: "The imported STEP parser does not assert a source assembly/component identity without an explicit persisted assembly binding." } }, overallStatus: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS", kernel: { status: "PASS", engine: "OpenCascade.js", loadStatus: "PASS" }, topology: { status: valid && !empty ? "PASS" : "FAIL", shapeValidity: valid ? "PASS" : "FAIL", nullOrEmpty: empty ? "FAIL" : "PASS", selfIntersection: "NOT_AVAILABLE", counts }, bounds: { status: "PASS", min: { x: mesh.boundingBox.min[0], y: mesh.boundingBox.min[1], z: mesh.boundingBox.min[2] }, max: { x: mesh.boundingBox.max[0], y: mesh.boundingBox.max[1], z: mesh.boundingBox.max[2] }, size: { x: mesh.boundingBox.size[0], y: mesh.boundingBox.size[1], z: mesh.boundingBox.size[2] }, diagonal: mesh.boundingBox.diagonal, unit: unit.unit, unitStatus: unit.status }, warnings, failures, reproducibility: { sourceSha256: file.sha256, parser: file.parser, parserVersion: file.parserVersion, createdAt }, limitations: ["This report validates imported geometry using OpenCascade; it is not a material, tolerance, manufacturing, CAE, safety, or compliance validation.", "No source feature history, named topology, or assembly hierarchy is inferred from the STEP artifact."] };
    } finally { disposeShape(resource); }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "OpenCascade validation failed.";
    report = { validationId, projectId: args.projectId, artifact: { ...binding(authorizedFile), byteLength: authorizedFile.fileSizeBytes, componentIdentity: { status: "NOT_AVAILABLE", reason: "No component identity is available because kernel validation did not complete." } }, overallStatus: "FAIL", kernel: { status: "FAIL", engine: "OpenCascade.js", loadStatus: "FAIL" }, topology: { status: "FAIL", shapeValidity: "FAIL", nullOrEmpty: "REQUIRED_INPUT", selfIntersection: "NOT_AVAILABLE", counts: { solids: 0, shells: 0, faces: 0, edges: 0, vertices: 0 } }, bounds: { status: "NOT_AVAILABLE", unit: "UNKNOWN", unitStatus: "NOT_AVAILABLE" }, warnings: [], failures: [reason], reproducibility: { sourceSha256: authorizedFile.sha256, parser: authorizedFile.parser, parserVersion: authorizedFile.parserVersion, createdAt }, limitations: ["A failed authorized artifact cannot produce a validation PASS."] };
  }
  const record = await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAD_VALIDATION", title: `CAD validation · ${report.artifact.fileName} · ${report.overallStatus}`, content: JSON.stringify(report), truthStatus: report.overallStatus === "PASS" || report.overallStatus === "WARNING" ? "DERIVED" : "UNKNOWN", validationStage: report.overallStatus === "PASS" || report.overallStatus === "WARNING" ? "GEOMETRICALLY_VALIDATED" : "CONCEPTUAL", authorSource: "CAD_AGENT" } });
  return { ...report, persistedRecordId: record.id };
  });
}

async function validationRecords(args: { projectId: string; accessKey: string }) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "CAD_VALIDATION").map((record) => ({ record, report: safeJson<ValidationReport>(record.content) })).filter((item): item is { record: typeof snapshot.records[number]; report: ValidationReport } => Boolean(item.report)); }
export async function getCadValidation(args: { projectId: string; accessKey: string; validationId: string }) { const match = (await validationRecords(args)).find((item) => item.report.validationId === args.validationId); if (!match) throw new Error("CAD validation report is not available in the authorized project."); return { ...match.report, persistedRecordId: match.record.id }; }
export async function listCadValidations(args: { projectId: string; accessKey: string; fileId?: string; revision?: number }) { return (await validationRecords(args)).filter((item) => (!args.fileId || item.report.artifact.fileId === args.fileId) && (!args.revision || item.report.artifact.revision === args.revision)).map((item) => ({ ...item.report, persistedRecordId: item.record.id })); }

async function performCut(args: { projectId: string; accessKey: string; sourceFileId: string; cutterFileId: string }) {
  const source = await loadShape({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.sourceFileId }); let cutter: Awaited<ReturnType<typeof loadShape>> | undefined;
  try { cutter = await loadShape({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.cutterFileId }); if (source.file.fileId === cutter.file.fileId) throw new Error("BOOLEAN_OPERATION_FAILED: Source and cutter must be distinct verified CAD artifacts."); const progress = new (source.oc as any).Message_ProgressRange_1(); const cut = new (source.oc as any).BRepAlgoAPI_Cut_3(source.shape, cutter.shape, progress); cut.Build(progress); if (!cut.IsDone?.()) throw new Error("BOOLEAN_OPERATION_FAILED: OpenCascade Boolean Cut did not complete."); const result = cut.Shape(); if (result.IsNull()) throw new Error("BOOLEAN_OPERATION_FAILED: OpenCascade Boolean Cut returned a null result."); const analyzer = new (source.oc as any).BRepCheck_Analyzer(result, true, false); const valid = Boolean(analyzer.IsValid_2()); analyzer.delete(); const solids = count(source.oc, result, source.oc.TopAbs_ShapeEnum.TopAbs_SOLID); if (!valid || !solids) throw new Error("BOOLEAN_OPERATION_FAILED: OpenCascade Boolean Cut produced an invalid or empty result."); return { source, cutter, cut, result, progress }; } catch (error) { if (cutter) disposeShape(cutter); disposeShape(source); throw error; }
}
function disposeCut(resource: Awaited<ReturnType<typeof performCut>>) { try { resource.result?.delete?.(); resource.cut?.delete?.(); resource.progress?.delete?.(); } catch { /* best effort */ } disposeShape(resource.cutter); disposeShape(resource.source); }
async function booleanRecords(args: { projectId: string; accessKey: string }) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "BOOLEAN_OPERATION").map((record) => ({ record, payload: safeJson<BooleanPreview & { execution?: unknown; result?: unknown }>(record.content) })).filter((item): item is { record: typeof snapshot.records[number]; payload: BooleanPreview & { execution?: unknown; result?: unknown } } => Boolean(item.payload)); }

export async function previewBooleanCut(args: { projectId: string; accessKey: string; sourceFileId: string; cutterFileId: string }): Promise<BooleanPreview> {
  await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.sourceFileId }); await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.cutterFileId }); const operationId = id("BOOLEAN_CUT"); const createdAt = iso(); let preview: BooleanPreview;
  try {
    preview = await runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, async () => {
      const resource = await performCut(args);
      try {
        return { operationId, projectId: args.projectId, operation: "CUT" as const, source: binding(resource.source.file), cutter: binding(resource.cutter.file), previewStatus: "PREVIEW_READY" as const, approvalStatus: "REQUIRED" as const, proposedArtifactName: `boolean-cut-${resource.source.file.fileId}-by-${resource.cutter.file.fileId}.step`, proposedRevision: `Derived from source file v${resource.source.file.version} and cutter file v${resource.cutter.file.version}`, warnings: ["Preview validates a regenerated kernel result but does not persist or modify any CAD source artifact."], failures: [], createdAt };
      } finally { disposeCut(resource); }
    });
  } catch (error) { const source = await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.sourceFileId }).catch(() => undefined); const cutter = await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.cutterFileId }).catch(() => undefined); preview = { operationId, projectId: args.projectId, operation: "CUT", source: source ? binding(source) : { fileId: args.sourceFileId, fileName: "UNKNOWN", revision: 0, sha256: "UNKNOWN", format: "UNKNOWN" }, cutter: cutter ? binding(cutter) : { fileId: args.cutterFileId, fileName: "UNKNOWN", revision: 0, sha256: "UNKNOWN", format: "UNKNOWN" }, previewStatus: "BOOLEAN_OPERATION_FAILED", approvalStatus: "REQUIRED", proposedArtifactName: "NOT_AVAILABLE", proposedRevision: "NOT_AVAILABLE", warnings: [], failures: [error instanceof Error ? error.message : "BOOLEAN_OPERATION_FAILED"], createdAt }; }
  if (preview.previewStatus === "PREVIEW_READY") { const definition = createCommonFeatureDefinition({ featureId: `FEATURE_BOOLEAN_CUT-${operationId}`, featureRevision: 1, operationType: "BOOLEAN_CUT", sourceArtifact: preview.source, sourceRevision: preview.source.revision, parameters: { cutterArtifact: preview.cutter }, unitSystem: "mm", inputGeometry: ["SOURCE_BREP", "CUTTER_BREP"], dependencies: [preview.source.fileId, preview.source.sha256, preview.cutter.fileId, preview.cutter.sha256], projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY" }); preview = { ...preview, commonPreview: await previewCommonFeature(definition, async () => undefined) }; }
  const record = await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "BOOLEAN_OPERATION", title: `Boolean Cut preview · ${preview.previewStatus}`, content: JSON.stringify(preview), truthStatus: preview.previewStatus === "PREVIEW_READY" ? "DERIVED" : "UNKNOWN", validationStage: "GEOMETRICALLY_VALIDATED", authorSource: "CAD_AGENT" } }); return { ...preview, persistedRecordId: record.id };
}

export async function approveBooleanCut(args: { projectId: string; accessKey: string; operationId: string }) {
  const preview = (await booleanRecords(args)).find(
    (item) =>
      item.payload.operationId === args.operationId &&
      item.payload.previewStatus === "PREVIEW_READY",
  )?.payload;
  if (!preview) {
    throw new Error(
      "BOOLEAN_OPERATION_FAILED: Approved execution requires a persisted READY Boolean preview in the authorized project.",
    );
  }
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, async () => {
  const resource = await performCut({
    projectId: args.projectId,
    accessKey: args.accessKey,
    sourceFileId: preview.source.fileId,
    cutterFileId: preview.cutter.fileId,
  });
  const started = Date.now();
  try {
    if (!preview.commonPreview) {
      throw new Error(
        "COMMON_FEATURE_EXECUTOR_REQUIRED: Boolean preview predates the common executor; create a new preview.",
      );
    }
    if (
      resource.source.file.sha256 !== preview.source.sha256 ||
      resource.cutter.file.sha256 !== preview.cutter.sha256
    ) {
      throw new Error(
        "BOOLEAN_OPERATION_FAILED: Preview artifact hash binding is stale; create a new preview before approval.",
      );
    }
    const approved = approveCommonFeature(
      preview.commonPreview,
      binding(resource.source.file),
    );
    const bytes = exportValidatedStep(
      resource.source.oc,
      resource.result,
      resource.progress,
      "boolean-result",
    );
    const ingestStarted = Date.now();
    const result = await ingestCadFile({
      projectId: args.projectId,
      accessKey: args.accessKey,
      fileName: preview.proposedArtifactName,
      mimeType: "application/step",
      base64: bytes.toString("base64"),
    });
    const ingestMs = Date.now() - ingestStarted;
    if (result.file.validationStatus !== "VALID") {
      throw new Error(
        "BOOLEAN_OPERATION_FAILED: Result artifact ingestion did not produce a valid STEP geometry.",
      );
    }
    const validationStarted = Date.now();
    const validation = await createCadValidation({
      projectId: args.projectId,
      accessKey: args.accessKey,
      fileId: result.file.fileId,
    });
    const validationMs = Date.now() - validationStarted;
    const commonExecution = completeCommonFeature({
      preview: preview.commonPreview,
      approved,
      outputArtifact: binding(result.file),
      validationId: validation.validationId,
      timing: {
        kernelExecutionMs: 0,
        artifactIngestionMs: ingestMs,
        validationMs,
        totalExecutionMs: Date.now() - started,
      },
    });
    const execution = {
      ...preview,
      commonExecution,
      approvalStatus: "APPROVED",
      previewStatus: "PREVIEW_READY",
      result: {
        artifact: binding(result.file),
        validationId: validation.validationId,
        validationStatus: validation.overallStatus,
      },
      provenance: {
        sourceArtifact: preview.source,
        cutterArtifact: preview.cutter,
        operation: "CUT",
        previewOperationId: preview.operationId,
      },
      executedAt: iso(),
    };
    const record = await appendPersistentMemory({
      projectId: args.projectId,
      accessKey: args.accessKey,
      record: {
        kind: "BOOLEAN_OPERATION",
        title: `Boolean Cut execution · ${result.file.fileName}`,
        content: JSON.stringify(execution),
        truthStatus: "DERIVED",
        validationStage: "GEOMETRICALLY_VALIDATED",
        authorSource: "CAD_AGENT",
      },
    });
    return { ...execution, persistedRecordId: record.id };
  } finally {
    disposeCut(resource);
  }
  });
}

function holeInput(input: unknown): CylindricalHoleInput { const value = input as Partial<CylindricalHoleInput> | undefined; const finite = (item: unknown): item is number => typeof item === "number" && Number.isFinite(item); if (!value || value.unit !== "mm" || !finite(value.diameter) || !finite(value.depth) || !value.center || !value.direction || !finite(value.center.x) || !finite(value.center.y) || !finite(value.center.z) || !finite(value.direction.x) || !finite(value.direction.y) || !finite(value.direction.z) || value.diameter <= 0 || value.depth <= 0) throw new Error("REQUIRED_INPUT: Cylindrical Hole requires explicit positive diameter and depth in mm plus center and direction coordinates."); const magnitude = Math.hypot(value.direction.x, value.direction.y, value.direction.z); if (!magnitude) throw new Error("REQUIRED_INPUT: Cylindrical Hole direction must be a non-zero explicit vector."); return { diameter: value.diameter, depth: value.depth, center: { ...value.center }, direction: { x: value.direction.x / magnitude, y: value.direction.y / magnitude, z: value.direction.z / magnitude }, unit: "mm" }; }
async function executeHole(args: { projectId: string; accessKey: string; sourceFileId: string; parameters: CylindricalHoleInput }) { const source = await loadShape({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.sourceFileId }); let axis: any; let cylinder: any; let progress: any; let cut: any; let result: any; try { if (stepUnit(source.file).status !== "PASS" || stepUnit(source.file).unit !== "mm") throw new Error("REQUIRED_INPUT: Cylindrical Hole only accepts a source artifact with an explicit millimetre STEP unit declaration."); axis = new (source.oc as any).gp_Ax2_3(new (source.oc as any).gp_Pnt_3(args.parameters.center.x, args.parameters.center.y, args.parameters.center.z), new (source.oc as any).gp_Dir_4(args.parameters.direction.x, args.parameters.direction.y, args.parameters.direction.z)); cylinder = new (source.oc as any).BRepPrimAPI_MakeCylinder_3(axis, args.parameters.diameter / 2, args.parameters.depth); progress = new (source.oc as any).Message_ProgressRange_1(); cut = new (source.oc as any).BRepAlgoAPI_Cut_3(source.shape, cylinder.Shape(), progress); cut.Build(progress); result = cut.Shape(); const analyzer = new (source.oc as any).BRepCheck_Analyzer(result, true, false); const valid = Boolean(analyzer.IsValid_2()); analyzer.delete(); const solids = count(source.oc, result, source.oc.TopAbs_ShapeEnum.TopAbs_SOLID); if (!cut.IsDone?.() || !valid || !solids || result.IsNull() || Boolean(result.IsSame?.(source.shape))) throw new Error("HOLE_OPERATION_FAILED: OpenCascade did not produce a changed valid solid; verify the explicit center, direction, depth, and diameter intersect the source body."); return { source, axis, cylinder, progress, cut, result }; } catch (error) { try { result?.delete?.(); cut?.delete?.(); progress?.delete?.(); cylinder?.delete?.(); axis?.delete?.(); } catch { /* best effort */ } disposeShape(source); throw error; } }
function disposeHole(resource: Awaited<ReturnType<typeof executeHole>>) { try { resource.result?.delete?.(); resource.cut?.delete?.(); resource.progress?.delete?.(); resource.cylinder?.delete?.(); resource.axis?.delete?.(); } catch { /* best effort */ } disposeShape(resource.source); }
async function holePreviews(args: { projectId: string; accessKey: string }) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "CAD_OPERATION").map((record) => ({ record, preview: safeJson<HolePreview>(record.content) })).filter((item): item is { record: typeof snapshot.records[number]; preview: HolePreview } => Boolean(item.preview?.operation === "CYLINDRICAL_HOLE")); }
export async function previewCylindricalHole(args: { projectId: string; accessKey: string; sourceFileId: string; parameters: unknown; featureId?: string; featureRevision?: number }): Promise<HolePreview> { const source = await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.sourceFileId }); const operationId = id("CYLINDRICAL_HOLE"); const createdAt = iso(); const fallback = { diameter: 0, depth: 0, center: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 0 }, unit: "mm" as const }; let preview: HolePreview; try { const parameters = holeInput(args.parameters); const resource = await executeHole({ projectId: args.projectId, accessKey: args.accessKey, sourceFileId: args.sourceFileId, parameters }); try { const parentArtifact = binding(resource.source.file); const feature = { featureId: args.featureId?.trim() || id("FEATURE_CYLINDRICAL_HOLE"), featureRevision: args.featureRevision && args.featureRevision > 0 ? Math.floor(args.featureRevision) : 1, parentArtifact, operationType: "CYLINDRICAL_HOLE" as const, parameters, inputGeometry: "EXPLICIT_CYLINDER" as const, dependencies: [parentArtifact.fileId, parentArtifact.sha256], executionStatus: "PREVIEW_READY" as const, validationStatus: "VALID" as const, provenance: { operationId, sourceSha256: parentArtifact.sha256, createdAt } }; const definition = createCommonFeatureDefinition({ featureId: feature.featureId, featureRevision: feature.featureRevision, operationType: "CYLINDRICAL_HOLE", sourceArtifact: parentArtifact, sourceRevision: parentArtifact.revision, parameters, unitSystem: "mm", inputGeometry: [feature.inputGeometry], dependencies: feature.dependencies, projectId: args.projectId, authorizationContext: "PROJECT_ACCESS_KEY" }); const commonPreview = await previewCommonFeature(definition, async () => undefined); preview = { operationId, projectId: args.projectId, operation: "CYLINDRICAL_HOLE", source: parentArtifact, parameters, feature: { ...feature, commonPreview }, previewStatus: "PREVIEW_READY", approvalStatus: "REQUIRED", proposedArtifactName: `cylindrical-hole-${resource.source.file.fileId}-${operationId}.step`, proposedRevision: `Derived from source file v${resource.source.file.version} with explicit cylindrical-hole parameters`, warnings: ["Preview validates a kernel subtraction but does not persist or modify the source artifact."], failures: [], createdAt }; } finally { disposeHole(resource); } } catch (error) { const reason = error instanceof Error ? error.message : "HOLE_OPERATION_FAILED"; const feature = { featureId: args.featureId?.trim() || id("FEATURE_CYLINDRICAL_HOLE"), featureRevision: args.featureRevision && args.featureRevision > 0 ? Math.floor(args.featureRevision) : 1, parentArtifact: binding(source), operationType: "CYLINDRICAL_HOLE" as const, parameters: fallback, inputGeometry: "EXPLICIT_CYLINDER" as const, dependencies: [source.fileId, source.sha256], executionStatus: "FAILED" as const, validationStatus: "UNAVAILABLE" as const, provenance: { operationId, sourceSha256: source.sha256, createdAt } }; preview = { operationId, projectId: args.projectId, operation: "CYLINDRICAL_HOLE", source: binding(source), parameters: fallback, feature, previewStatus: reason.startsWith("REQUIRED_INPUT") ? "REQUIRED_INPUT" : "HOLE_OPERATION_FAILED", approvalStatus: "REQUIRED", proposedArtifactName: "NOT_AVAILABLE", proposedRevision: "NOT_AVAILABLE", warnings: [], failures: [reason], createdAt }; } const record = await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAD_OPERATION", title: `Cylindrical Hole preview · ${preview.previewStatus}`, content: JSON.stringify(preview), truthStatus: preview.previewStatus === "PREVIEW_READY" ? "DERIVED" : "UNKNOWN", validationStage: "GEOMETRICALLY_VALIDATED", authorSource: "CAD_AGENT" } }); return { ...preview, persistedRecordId: record.id }; }
export async function approveCylindricalHole(args: {
  projectId: string;
  accessKey: string;
  operationId: string;
}) {
  const preview = (await holePreviews(args)).find(
    (item) =>
      item.preview.operationId === args.operationId &&
      item.preview.previewStatus === "PREVIEW_READY",
  )?.preview;
  if (!preview) {
    throw new Error(
      "HOLE_OPERATION_FAILED: Approval requires a persisted READY cylindrical-hole preview in the authorized project.",
    );
  }
  if (!preview.feature.commonPreview) {
    throw new Error(
      "COMMON_FEATURE_EXECUTOR_REQUIRED: Cylindrical-hole preview predates the common executor; create a new preview.",
    );
  }
  const started = Date.now();
  const resource = await executeHole({
    projectId: args.projectId,
    accessKey: args.accessKey,
    sourceFileId: preview.source.fileId,
    parameters: preview.parameters,
  });
  try {
    if (resource.source.file.sha256 !== preview.source.sha256) {
      throw new Error(
        "HOLE_OPERATION_FAILED: Preview artifact hash binding is stale; create a new preview before approval.",
      );
    }
    const approved = approveCommonFeature(
      preview.feature.commonPreview,
      binding(resource.source.file),
    );
    const bytes = exportValidatedStep(
      resource.source.oc,
      resource.result,
      resource.progress,
      "cylindrical-hole",
    );
    const ingestStarted = Date.now();
    const result = await ingestCadFile({
      projectId: args.projectId,
      accessKey: args.accessKey,
      fileName: preview.proposedArtifactName,
      mimeType: "application/step",
      base64: bytes.toString("base64"),
    });
    const ingestMs = Date.now() - ingestStarted;
    if (result.file.validationStatus !== "VALID") {
      throw new Error(
        "HOLE_OPERATION_FAILED: Result artifact ingestion did not produce a valid STEP geometry.",
      );
    }
    const validationStarted = Date.now();
    const validation = await createCadValidation({
      projectId: args.projectId,
      accessKey: args.accessKey,
      fileId: result.file.fileId,
    });
    const validationMs = Date.now() - validationStarted;
    const commonExecution = completeCommonFeature({
      preview: preview.feature.commonPreview,
      approved,
      outputArtifact: binding(result.file),
      validationId: validation.validationId,
      timing: {
        kernelExecutionMs: 0,
        artifactIngestionMs: ingestMs,
        validationMs,
        totalExecutionMs: Date.now() - started,
      },
    });
    const feature = {
      ...preview.feature,
      commonExecution,
      executionStatus: "KERNEL_VALIDATED" as const,
      validationStatus:
        validation.overallStatus === "FAIL"
          ? ("INVALID" as const)
          : ("VALID" as const),
      outputArtifact: binding(result.file),
    };
    const execution = {
      ...preview,
      feature,
      approvalStatus: "APPROVED" as const,
      result: {
        artifact: binding(result.file),
        validationId: validation.validationId,
        validationStatus: validation.overallStatus,
      },
      provenance: {
        sourceArtifact: preview.source,
        parameters: preview.parameters,
        operation: "CYLINDRICAL_HOLE",
        previewOperationId: preview.operationId,
        featureId: feature.featureId,
        featureRevision: feature.featureRevision,
      },
      executedAt: iso(),
    };
    const record = await appendPersistentMemory({
      projectId: args.projectId,
      accessKey: args.accessKey,
      record: {
        kind: "CAD_OPERATION",
        title: `Cylindrical Hole execution · ${result.file.fileName}`,
        content: JSON.stringify(execution),
        truthStatus: "DERIVED",
        validationStage: "GEOMETRICALLY_VALIDATED",
        authorSource: "CAD_AGENT",
      },
    });
    return { ...execution, persistedRecordId: record.id };
  } finally {
    disposeHole(resource);
  }
}

/** Public production boundary for Hole preview. The legacy calculation body remains
 * nested so its B-Rep resources are disposed before the admission callback ends. */
export function previewCylindricalHoleAdmitted(args: Parameters<typeof previewCylindricalHole>[0]) {
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, () => previewCylindricalHole(args));
}

/** Public production boundary for Hole approval. No kernel resource crosses this callback. */
export function approveCylindricalHoleAdmitted(args: Parameters<typeof approveCylindricalHole>[0]) {
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, () => approveCylindricalHole(args));
}

function project(point: [number, number, number], view: DrawingExport["view"]): [number, number] { const [x, y, z] = point; if (view === "FRONT" || view === "REAR") return [view === "FRONT" ? x : -x, z]; if (view === "LEFT" || view === "RIGHT") return [view === "LEFT" ? y : -y, z]; if (view === "TOP" || view === "BOTTOM") return [x, view === "TOP" ? y : -y]; return [x - y * 0.5, z + (x + y) * 0.25]; }
export const DRAWING_SVG_LIMITS = Object.freeze({ maxSvgBytes: 8 * 1024 * 1024, maxPolygons: KERNEL_VIEWER_LIMITS.maxTriangles });
export function svgForMesh(mesh: ReturnType<typeof extractKernelViewerMesh>, view: DrawingExport["view"], title: string) {
  if (!mesh.vertices.length || !mesh.triangles.length) throw new Error("ENGINE_LIMIT_EXCEEDED: Drawing export requires a non-empty viewer mesh.");
  if (mesh.vertices.length > KERNEL_VIEWER_LIMITS.maxVertices || mesh.triangles.length > DRAWING_SVG_LIMITS.maxPolygons) throw new Error("ENGINE_LIMIT_EXCEEDED: Viewer mesh exceeds the server-controlled drawing limit.");
  let minX = mesh.vertices[0][0]; let maxX = minX; let minY = mesh.vertices[0][1]; let maxY = minY;
  const projected = mesh.vertices.map((point) => { const projectedPoint = project(point, view); minX = Math.min(minX, projectedPoint[0]); maxX = Math.max(maxX, projectedPoint[0]); minY = Math.min(minY, projectedPoint[1]); maxY = Math.max(maxY, projectedPoint[1]); return projectedPoint; });
  const scale = 960 / Math.max(Math.max(maxX - minX, 1), Math.max(maxY - minY, 1)); const ox = 20 - minX * scale; const oy = 20 + maxY * scale;
  const prefix = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="${title.replace(/&/g, "and")}"><rect width="1000" height="1000" fill="#ffffff"/><g fill="none" stroke="#0a3550" stroke-width="0.55" vector-effect="non-scaling-stroke">`;
  const suffix = `</g><text x="20" y="980" font-family="Arial, sans-serif" font-size="14" fill="#173b55">${title}</text><text x="20" y="996" font-family="Arial, sans-serif" font-size="10" fill="#526a7b">Tessellation-derived reference view. No dimensions, tolerances, hidden-line removal, material, or manufacturing claims.</text></svg>`;
  let byteLength = Buffer.byteLength(prefix) + Buffer.byteLength(suffix); const polygons: string[] = [];
  for (const triangle of mesh.triangles) { if (triangle.some((index) => !Number.isInteger(index) || index < 0 || index >= projected.length)) throw new Error("ENGINE_LIMIT_EXCEEDED: Drawing mesh contains an invalid triangle index."); const points = triangle.map((index) => { const [x, y] = projected[index]; return `${(x * scale + ox).toFixed(3)},${(-y * scale + oy).toFixed(3)}`; }).join(" "); const polygon = `<polygon points="${points}"/>`; byteLength += Buffer.byteLength(polygon); if (byteLength > DRAWING_SVG_LIMITS.maxSvgBytes) throw new Error("ENGINE_LIMIT_EXCEEDED: Drawing SVG exceeds the server-controlled byte limit."); polygons.push(polygon); }
  return `${prefix}${polygons.join("")}${suffix}`;
}

export async function exportOrthographicDrawing(args: { projectId: string; accessKey: string; fileId: string; validationId: string; view: DrawingExport["view"] }): Promise<DrawingExport> {
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "CAD_OPERATION" }, async () => {
  const validation = await getCadValidation({ projectId: args.projectId, accessKey: args.accessKey, validationId: args.validationId }); if (validation.artifact.fileId !== args.fileId || (validation.overallStatus !== "PASS" && validation.overallStatus !== "WARNING")) throw new Error("REQUIRED_INPUT: Drawing export requires a persisted passing or warning-level validation bound to the selected artifact."); const resource = await loadShape({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.fileId });
  try { const mesh = extractKernelViewerMesh(resource.oc, resource.shape, `DRAWING-${resource.file.fileId}`, 1.2); const drawingId = id("DRAWING"); const createdAt = iso(); const svg = svgForMesh(mesh, args.view, `${resource.file.fileName} · ${args.view} · file v${resource.file.version}`); const bytes = Buffer.from(svg, "utf8"); const sha256 = createHash("sha256").update(bytes).digest("hex"); const storage = await storagePut(`engineering-projects/${args.projectId}/drawings/${resource.file.sha256}/${args.view.toLowerCase()}.svg`, bytes, "image/svg+xml"); const drawing: DrawingExport = { drawingId, projectId: args.projectId, source: binding(resource.file), validationId: validation.validationId, view: args.view, format: "SVG", status: "EXPORTED", drawingRevision: `DRAWING-${resource.file.version}-${args.view}`, sha256, storage, createdAt, limitations: ["SVG uses actual OpenCascade BRep tessellation projected into the selected reference orientation.", "The export is not a dimensioned or tolerance-controlled engineering drawing and does not assert hidden-line removal, drawing standards, material, manufacturing, or compliance information.", "PDF, DXF, and DWG exports are UNSUPPORTED in this verified service."] }; const record = await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "ENGINEERING_DRAWING_PACKAGE", title: `Orthographic drawing · ${args.view} · ${resource.file.fileName}`, content: JSON.stringify(drawing), truthStatus: "DERIVED", validationStage: "GEOMETRICALLY_VALIDATED", authorSource: "CAD_AGENT" } }); return { ...drawing, persistedRecordId: record.id }; } finally { disposeShape(resource); }
  });
}

export async function listDrawings(args: { projectId: string; accessKey: string; fileId?: string }) { const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "ENGINEERING_DRAWING_PACKAGE").map((record) => ({ record, drawing: safeJson<DrawingExport>(record.content) })).filter((item): item is { record: typeof snapshot.records[number]; drawing: DrawingExport } => Boolean(item.drawing)).filter((item) => !args.fileId || item.drawing.source.fileId === args.fileId).map((item) => ({ ...item.drawing, persistedRecordId: item.record.id })); }
