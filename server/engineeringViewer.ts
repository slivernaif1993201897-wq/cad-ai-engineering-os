import { createHash } from "node:crypto";

import type { CADFileContext } from "../shared/cadFile";
import {
  type EngineeringViewerScene,
  type ViewerModelBranch,
  type ViewerProposalPreview,
  VIEWER_SCENE_MAX_TRIANGLES,
} from "../shared/engineeringViewer";
import { extractKernelViewerMesh, getOpenCascadeKernel } from "./cadKernel";
import { runWithOpenCascadeAdmission } from "./runtimeAdmission";
import { getCadFileContext, parseStlTriangles } from "./cadFileIntelligence";
import { appendLineageNode, appendPersistentMemory } from "./persistentMemory";
import { storageGetSignedUrl } from "./storage";

const sceneId = (file: CADFileContext, quality: string) => `SCENE-${file.fileId}-${file.sha256.slice(0, 16)}-${quality}`;
const faceId = (index: number) => `FACE-${String(index + 1).padStart(5, "0")}`;

function unavailableScene(file: CADFileContext, reason: string): EngineeringViewerScene {
  return {
    sceneId: sceneId(file, "UNAVAILABLE"), projectId: file.projectId,
    file: { fileId: file.fileId, fileName: file.fileName, version: file.version, format: file.format, sha256: file.sha256, parseStatus: file.parseStatus, validationStatus: file.validationStatus, parser: file.parser, parserVersion: file.parserVersion, createdAt: file.createdAt },
    status: "UNAVAILABLE", statusReason: reason, entities: [], modelTree: [],
    traceability: { requirementIds: [], conceptIds: [], decisionRecordIds: [], cadOperationIds: [], validationStatus: "UNAVAILABLE", evidenceState: "NO_RECORDED_RELATIONSHIP" },
    limitations: [...file.limitations, reason],
  };
}

async function fetchVerifiedSource(file: CADFileContext): Promise<Buffer> {
  const signedUrl = await storageGetSignedUrl(file.storage.key);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Managed source retrieval failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== file.fileSizeBytes) throw new Error("Managed source byte length does not match the persisted file context.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== file.sha256) throw new Error("Managed source hash does not match the persisted file context.");
  return bytes;
}

function stlMesh(file: CADFileContext, bytes: Buffer): NonNullable<EngineeringViewerScene["mesh"]> {
  const parsed = parseStlTriangles(bytes);
  if ("reason" in parsed) throw new Error(parsed.reason);
  if (parsed.triangles.length > VIEWER_SCENE_MAX_TRIANGLES) throw new Error(`The parsed STL contains ${parsed.triangles.length.toLocaleString()} triangles, beyond the ${VIEWER_SCENE_MAX_TRIANGLES.toLocaleString()} interactive scene limit. The original file remains intact; create a lower-density mesh to inspect it interactively.`);
  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];
  const faceRanges = parsed.triangles.map((triangle, index) => {
    const triangleStart = triangles.length;
    const offset = vertices.length;
    vertices.push(...triangle); triangles.push([offset, offset + 1, offset + 2]);
    return { faceId: faceId(index), featureId: `FILE-${file.fileId}`, triangleStart, triangleCount: 1 };
  });
  return { vertices, triangles, faceRanges, representation: "PARSED_STL_TRIANGLES", tessellation: "STL triangle records", sourceHash: file.sha256, triangleLimit: VIEWER_SCENE_MAX_TRIANGLES, complete: true, performanceNote: "Every displayed triangle comes directly from the parsed STL source mesh." };
}

async function stepMesh(file: CADFileContext, bytes: Buffer): Promise<NonNullable<EngineeringViewerScene["mesh"]>> {
  return runWithOpenCascadeAdmission({ projectId: file.projectId, resourceClass: "VIEWER" }, async () => {
  const oc = await getOpenCascadeKernel(); const path = `/viewer-${crypto.randomUUID()}.step`; let reader: any; let progress: any; let shape: any;
  try {
    (oc as any).FS.writeFile(path, bytes);
    reader = new (oc as any).STEPControl_Reader_1();
    reader.ReadFile(path);
    const roots = Number(reader.NbRootsForTransfer());
    progress = new (oc as any).Message_ProgressRange_1();
    const transferred = Number(reader.TransferRoots(progress));
    shape = reader.OneShape();
    if (!roots || !transferred || shape.IsNull()) throw new Error("OpenCascade could not transfer the authorized STEP source into a viewer BRep.");
    let mesh = extractKernelViewerMesh(oc, shape, `FILE-${file.fileId}`);
    let complete = true; let performanceNote = "Every displayed triangle is tessellated from the imported OpenCascade BRep.";
    if (mesh.triangles.length > VIEWER_SCENE_MAX_TRIANGLES) {
      mesh = extractKernelViewerMesh(oc, shape, `FILE-${file.fileId}`, 2.4);
      complete = false;
      performanceNote = "The interactive display mesh uses a coarser OpenCascade BRep tessellation because the original tessellation exceeded the Phase 4 interactive triangle limit. The STEP BRep remains authoritative.";
    }
    if (mesh.triangles.length > VIEWER_SCENE_MAX_TRIANGLES) throw new Error(`The imported BRep remains too dense for the ${VIEWER_SCENE_MAX_TRIANGLES.toLocaleString()}-triangle interactive limit, even after an explicitly labeled coarse kernel tessellation.`);
    return { vertices: mesh.vertices, triangles: mesh.triangles, faceRanges: mesh.faceRanges, representation: "KERNEL_BREP_TESSELLATION", tessellation: complete ? mesh.tessellation : `${mesh.tessellation} (coarse)`, sourceHash: file.sha256, triangleLimit: VIEWER_SCENE_MAX_TRIANGLES, complete, performanceNote };
  } finally { try { shape?.delete?.(); progress?.delete?.(); reader?.delete?.(); (oc as any).FS.unlink(path); } catch { /* virtual source cleanup is best effort */ } }
  });
}

function sceneFromMesh(file: CADFileContext, mesh: NonNullable<EngineeringViewerScene["mesh"]>): EngineeringViewerScene {
  const bounds = file.boundingBox ?? (() => {
    const xs = mesh.vertices.map((point) => point[0]); const ys = mesh.vertices.map((point) => point[1]); const zs = mesh.vertices.map((point) => point[2]);
    const min: [number, number, number] = [Math.min(...xs), Math.min(...ys), Math.min(...zs)]; const max: [number, number, number] = [Math.max(...xs), Math.max(...ys), Math.max(...zs)]; const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    return { min, max, size, diagonal: Math.hypot(...size), provenance: "CALCULATED" as const };
  })();
  const rootId = `${file.fileId}:MODEL`; const groupId = `${file.fileId}:${file.format === "STEP" ? "SOLIDS" : "MESH"}`;
  const solidEntities = file.format === "STEP" && file.step?.solids.value === 1 ? [{ id: `${file.fileId}:SOLID-00001`, fileId: file.fileId, sourceFileName: file.fileName, sourceFileVersion: file.version, kind: "SOLID" as const, displayLabel: "SOLID-00001", provenance: "PARSED" as const }] : [];
  const entities = [{ id: rootId, fileId: file.fileId, sourceFileName: file.fileName, sourceFileVersion: file.version, kind: "MODEL" as const, displayLabel: `${file.fileName} · v${file.version}`, provenance: "PARSED" as const }, ...solidEntities, ...mesh.faceRanges.map((range) => ({ id: `${file.fileId}:${range.faceId}`, fileId: file.fileId, sourceFileName: file.fileName, sourceFileVersion: file.version, kind: "FACE" as const, displayLabel: range.faceId, faceId: range.faceId, triangleStart: range.triangleStart, triangleCount: range.triangleCount, featureId: range.featureId, provenance: "DERIVED" as const }))];
  return {
    sceneId: sceneId(file, mesh.complete ? "FULL" : "COARSE"), projectId: file.projectId,
    file: { fileId: file.fileId, fileName: file.fileName, version: file.version, format: file.format, sha256: file.sha256, parseStatus: file.parseStatus, validationStatus: file.validationStatus, parser: file.parser, parserVersion: file.parserVersion, createdAt: file.createdAt },
    status: file.validationStatus === "VALID" ? "GEOMETRICALLY_VALID" : "PARSED", statusReason: file.validationStatus === "VALID" ? "The parser completed and reported a valid imported geometry representation. This is not CAE, experimental, material, or production validation." : "The parser produced geometry data, but its validation state is not valid.", mesh,
    boundingBox: { min: bounds.min, max: bounds.max, size: bounds.size, diagonal: bounds.diagonal, provenance: bounds.provenance === "PARSED" ? "DERIVED" : "CALCULATED" },
    entities, modelTree: [
      { id: rootId, kind: "MODEL", label: `${file.fileName} · File v${file.version}`, geometryReferenceId: rootId, childCount: 1, provenance: "PARSED" },
      { id: groupId, parentId: rootId, kind: file.format === "STEP" ? "SOLID" : "FACE", label: file.format === "STEP" ? `${file.step?.solids.value ?? "UNKNOWN"} parsed solid(s)` : `${mesh.triangles.length} parsed STL triangle face(s)`, childCount: mesh.faceRanges.length, provenance: "PARSED" },
      ...mesh.faceRanges.slice(0, 500).map((range) => ({ id: `${file.fileId}:TREE:${range.faceId}`, parentId: groupId, kind: "FACE" as const, label: `${range.faceId} · ${range.triangleCount} display triangle(s)`, geometryReferenceId: `${file.fileId}:${range.faceId}`, provenance: "DERIVED" as const })),
    ],
    traceability: { requirementIds: [], conceptIds: [], decisionRecordIds: [], cadOperationIds: [], validationStatus: file.validationStatus === "VALID" ? "GEOMETRICALLY_VALID" : "PARSED", evidenceState: "NO_RECORDED_RELATIONSHIP" },
    limitations: [...file.limitations, "Model-tree structure is limited to parser-derived solids or mesh faces; source assembly hierarchy, named parts, feature history, material, and tolerance semantics are not asserted.", mesh.performanceNote],
  };
}

export async function getEngineeringViewerScene(args: { projectId: string; accessKey: string; fileId: string }): Promise<EngineeringViewerScene> {
  const file = await getCadFileContext(args);
  if (file.parseStatus !== "PARSED" && file.parseStatus !== "PARTIALLY_PARSED") return unavailableScene(file, `The file parser status is ${file.parseStatus}; the native viewer will not construct geometry from an unsuccessful parser result.`);
  if (file.format === "UNSUPPORTED") return unavailableScene(file, "The file format is unsupported for Phase 4 geometry visualization.");
  try { const bytes = await fetchVerifiedSource(file); const mesh = file.format === "STEP" ? await stepMesh(file, bytes) : stlMesh(file, bytes); return sceneFromMesh(file, mesh); }
  catch (error) { return unavailableScene(file, error instanceof Error ? error.message : "Viewer scene creation failed without a fallback mesh."); }
}

export async function createEngineeringViewerBranch(args: { projectId: string; accessKey: string; fileId: string; name: string; reason: string; parentLineageNodeId?: string; sourceConfigurationId?: string }): Promise<ViewerModelBranch> {
  const file = await getCadFileContext(args);
  const name = args.name.trim().slice(0, 255) || `${file.fileName} branch`;
  const node = await appendLineageNode({ projectId: args.projectId, accessKey: args.accessKey, node: { kind: "REVISION", parentId: args.parentLineageNodeId, title: name, reasonForChange: args.reason.trim().slice(0, 2000) || "User created a preserved model branch.", changeSummary: `Branch references source File v${file.version}: ${file.fileName} · SHA-256 ${file.sha256}. No source file was modified.`, status: "CONCEPTUAL", authorSource: "USER" } });
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "DECISION", title: `Model branch · ${name}`, content: `Created immutable lineage node ${node.id} from File v${file.version} (${file.fileName}). Branching does not modify source geometry.`, truthStatus: "DERIVED", validationStage: "CONCEPTUAL", relatedConfigurationId: args.sourceConfigurationId, authorSource: "USER" } });
  return { lineageNodeId: node.id, projectId: args.projectId, parentLineageNodeId: args.parentLineageNodeId, name, sourceFileId: file.fileId, sourceConfigurationId: args.sourceConfigurationId, status: "PREVIEW", reason: node.reasonForChange, createdAt: node.createdAt };
}

export async function getViewerProposalPreview(args: { projectId: string; accessKey: string; fileId: string; proposalId: string; sourceConfigurationId?: string }): Promise<ViewerProposalPreview> {
  const file = await getCadFileContext(args);
  return { proposalId: args.proposalId, sourceConfigurationId: args.sourceConfigurationId, sourceFileId: file.fileId, status: "UNAVAILABLE", currentSceneId: sceneId(file, "CURRENT"), reason: "Phase 4 cannot regenerate an arbitrary imported STEP/STL source from an LLM proposal. The original file remains unmodified; preview is available only for the existing deterministic parametric CAD configuration route.", reversible: true };
}
