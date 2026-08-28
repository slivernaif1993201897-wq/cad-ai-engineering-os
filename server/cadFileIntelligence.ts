import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import initOpenCascade from "opencascade.js/dist/node.js";
import { importDxf, validateDesign2D } from "./cad2d";

import { engineeringCadFiles } from "../drizzle/schema";
import {
  CAD_FILE_MAX_BYTES,
  type CADFileAnalysisContext,
  type CADFileBoundingBox,
  type CADFileContext,
  type CADFileFormat,
  type CADFileParserStatus,
  type CADFileProperty,
  type CADFileUploadInput,
  type CADFileUploadResult,
  type StlGeometryStatistics,
  type StepGeometryStatistics,
} from "../shared/cadFile";
import { appendPersistentMemory, openPersistentProject } from "./persistentMemory";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { storageGetSignedUrl } from "./storage";

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
let kernelPromise: ReturnType<typeof initOpenCascade> | undefined;
const getKernel = async () => (kernelPromise ??= initOpenCascade());

export type ParserError = NonNullable<CADFileContext["parserError"]>;
type ParseOutcome = Pick<CADFileContext, "format" | "parser" | "parserVersion" | "parseStatus" | "validationStatus" | "units" | "boundingBox" | "step" | "stl" | "limitations" | "parserError">;

function property<T>(value: T | undefined, provenance: CADFileProperty<T>["provenance"], note?: string): CADFileProperty<T> {
  return { ...(value === undefined ? {} : { value }), provenance, ...(note ? { note } : {}) };
}
function parserFailure(status: Extract<CADFileParserStatus, "PARSE_FAILED" | "CORRUPTED" | "UNSUPPORTED">, format: CADFileFormat, reason: string, recommendedAction: string): ParseOutcome {
  return { format, parser: "NONE", parserVersion: "none", parseStatus: status, validationStatus: status === "UNSUPPORTED" ? "UNKNOWN" : "INVALID", units: { status: "UNKNOWN", provenance: "UNKNOWN", note: "No trustworthy unit declaration was extracted." }, limitations: ["No geometry metadata was emitted because parsing did not complete successfully."], parserError: { reason, supportedOperation: format === "UNSUPPORTED" ? "Store file metadata only" : "Inspect parser error and retain the uploaded source", recommendedAction } };
}
function normalizedName(name: string) { return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 255) || "unnamed"; }
function extension(name: string) { return name.toLowerCase().split(".").pop() ?? ""; }
export function formatFromName(name: string): CADFileFormat { const ext = extension(name); return ext === "step" || ext === "stp" ? "STEP" : ext === "stl" ? "STL" : ext === "dxf" ? "DXF" : "UNSUPPORTED"; }
function opaqueId(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, "_"); }
function safeBase64(input: string): Buffer {
  const raw = input.replace(/\s/g, "");
  if (!raw || raw.length > Math.ceil(CAD_FILE_MAX_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new Error("Upload payload is not valid base64 or exceeds the bounded upload envelope.");
  const bytes = Buffer.from(raw, "base64");
  if (!bytes.length || bytes.length > CAD_FILE_MAX_BYTES || bytes.toString("base64").replace(/=+$/, "") !== raw.replace(/=+$/, "")) throw new Error("Upload bytes failed integrity validation or exceed the 10 MiB CAD file limit.");
  return bytes;
}
function bbox(points: Array<[number, number, number]>): CADFileBoundingBox | undefined {
  if (!points.length) return undefined;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, diagonal: Math.hypot(...size), provenance: "CALCULATED" };
}
function stepUnits(text: string) {
  const normalized = text.toUpperCase().replace(/\s/g, "");
  if (/SI_UNIT\(\.MILLI\.?,\.METRE\.?\)/.test(normalized)) return { status: "KNOWN" as const, value: "mm", provenance: "PARSED" as const };
  if (/SI_UNIT\(\$?,\.METRE\.?\)/.test(normalized)) return { status: "KNOWN" as const, value: "m", provenance: "PARSED" as const };
  if (/INCH/.test(normalized)) return { status: "KNOWN" as const, value: "inch", provenance: "PARSED" as const };
  return { status: "UNKNOWN" as const, provenance: "UNKNOWN" as const, note: "The STEP unit declaration was not reliably recognized by this parser." };
}
function countShapes(oc: any, shape: any, enumValue: any): number {
  const explorer = new oc.TopExp_Explorer_2(shape, enumValue, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let count = 0; while (explorer.More()) { count += 1; explorer.Next(); } explorer.delete(); return count;
}
function stepBounds(oc: any, shape: any): CADFileBoundingBox | undefined {
  const mesh = new oc.BRepMesh_IncrementalMesh_2(shape, 0.8, false, 0.5, false);
  const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  const points: Array<[number, number, number]> = [];
  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulationHandle = oc.BRep_Tool.Triangulation(face, location, 0);
    if (!triangulationHandle.IsNull()) {
      const triangulation = triangulationHandle.get();
      const transform = location.IsIdentity() ? undefined : location.Transformation();
      for (let node = 1; node <= triangulation.NbNodes(); node += 1) {
        const original = triangulation.Node(node); const transformed = transform ? original.Transformed(transform) : original;
        points.push([transformed.X(), transformed.Y(), transformed.Z()]); transformed.delete?.();
      }
      triangulationHandle.delete?.();
    }
    location.delete(); explorer.Next();
  }
  explorer.delete(); mesh.delete();
  return bbox(points);
}
async function parseStep(bytes: Buffer): Promise<ParseOutcome> {
  const text = bytes.toString("latin1");
  if (!/ISO-10303-21/i.test(text) || !/END-ISO-10303-21/i.test(text)) return parserFailure("CORRUPTED", "STEP", "STEP exchange header or terminator is missing.", "Upload a complete ISO 10303-21 STEP file (.step or .stp).");
  const oc = await getKernel(); const path = `/cad-file-${crypto.randomUUID()}.step`; let reader: any;
  try {
    (oc as any).FS.writeFile(path, bytes);
    reader = new (oc as any).STEPControl_Reader_1();
    reader.ReadFile(path);
    const roots = Number(reader.NbRootsForTransfer());
    const transferred = Number(reader.TransferRoots(new (oc as any).Message_ProgressRange_1()));
    const shape = reader.OneShape();
    if (!roots || !transferred || shape.IsNull()) return parserFailure("PARSE_FAILED", "STEP", "OpenCascade could not transfer any STEP root into a BRep shape.", "Open the file in a desktop CAD system to repair or re-export its STEP exchange data.");
    const analyzer = new (oc as any).BRepCheck_Analyzer(shape, true, false);
    const valid = Boolean(analyzer.IsValid_2());
    analyzer.delete();
    const step: StepGeometryStatistics = {
      solids: property(countShapes(oc, shape, (oc as any).TopAbs_ShapeEnum.TopAbs_SOLID), "PARSED"),
      shells: property(countShapes(oc, shape, (oc as any).TopAbs_ShapeEnum.TopAbs_SHELL), "PARSED"),
      faces: property(countShapes(oc, shape, (oc as any).TopAbs_ShapeEnum.TopAbs_FACE), "PARSED"),
      edges: property(countShapes(oc, shape, (oc as any).TopAbs_ShapeEnum.TopAbs_EDGE), "PARSED"),
      vertices: property(countShapes(oc, shape, (oc as any).TopAbs_ShapeEnum.TopAbs_VERTEX), "PARSED"),
      transferRoots: property(roots, "PARSED"),
    };
    const bounds = stepBounds(oc, shape);
    return { format: "STEP", parser: "OpenCascade.js", parserVersion: "OpenCascade.js WASM", parseStatus: valid ? "PARSED" : "PARTIALLY_PARSED", validationStatus: valid ? "VALID" : "INVALID", units: stepUnits(text), boundingBox: bounds, step, limitations: ["Assembly hierarchy, named parts, materials, feature history, tolerances, and primitive recognition are not claimed by this Phase 3.9 parser.", ...(bounds ? [] : ["A tessellated bounding box was not available from the imported BRep."])], ...(valid ? {} : { parserError: { reason: "OpenCascade imported topology but its BRep validity check failed.", supportedOperation: "Topology counts and any available extents", recommendedAction: "Repair or re-export the STEP file before treating geometry as valid." } }) };
  } catch (error) { return parserFailure("PARSE_FAILED", "STEP", error instanceof Error ? error.message : "OpenCascade STEP import failed.", "Re-export the file as ISO 10303-21 STEP and retry."); }
  finally { try { reader?.delete?.(); (oc as any).FS.unlink(path); } catch { /* virtual temporary file cleanup is best effort */ } }
}
function vectorArea(a: number[], b: number[], c: number[]) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; return { area: Math.hypot(...cross) / 2, signedVolume: (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6 }; }
export function parseStlTriangles(bytes: Buffer): { triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]>; normalsPresent: boolean } | ParserError {
  const ascii = bytes.toString("utf8");
  if (/^\s*solid\b/i.test(ascii) && /facet\s+normal/i.test(ascii)) {
    const vertices = [...ascii.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number]);
    if (!vertices.length || vertices.length % 3) return { reason: "ASCII STL vertex records are incomplete.", supportedOperation: "None", recommendedAction: "Export a complete ASCII or binary STL mesh and retry." };
    if (vertices.some((point) => point.some((value) => !Number.isFinite(value)))) return { reason: "ASCII STL contains non-finite vertex coordinates.", supportedOperation: "None", recommendedAction: "Repair or re-export the STL mesh." };
    return { triangles: Array.from({ length: vertices.length / 3 }, (_, index) => [vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]]), normalsPresent: true };
  }
  if (bytes.length < 84) return { reason: "Binary STL is shorter than its 84-byte header.", supportedOperation: "None", recommendedAction: "Upload a complete binary STL file." };
  const count = bytes.readUInt32LE(80); const expected = 84 + count * 50;
  if (count > 500_000) return { reason: "STL triangle count exceeds the 500,000-triangle Phase 3.9 resource limit.", supportedOperation: "Metadata storage only", recommendedAction: "Decimate or split the mesh before upload." };
  if (expected !== bytes.length) return { reason: `Binary STL byte length does not match its declared ${count} triangle records.`, supportedOperation: "None", recommendedAction: "Upload a complete binary STL file." };
  const triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [];
  for (let index = 0; index < count; index += 1) { const offset = 84 + index * 50; const point = (at: number): [number, number, number] => [bytes.readFloatLE(at), bytes.readFloatLE(at + 4), bytes.readFloatLE(at + 8)]; const triangle = [point(offset + 12), point(offset + 24), point(offset + 36)] as [[number, number, number], [number, number, number], [number, number, number]]; if (triangle.flat().some((value) => !Number.isFinite(value))) return { reason: "Binary STL contains non-finite vertex coordinates.", supportedOperation: "None", recommendedAction: "Repair or re-export the STL mesh." }; triangles.push(triangle); }
  return { triangles, normalsPresent: true };
}
function parseStl(bytes: Buffer): ParseOutcome {
  const parsed = parseStlTriangles(bytes); if ("reason" in parsed) return parserFailure("CORRUPTED", "STL", parsed.reason, parsed.recommendedAction);
  const points = parsed.triangles.flat(); const edges = new Map<string, number>(); let surfaceArea = 0; let signedVolume = 0;
  const pointKey = (point: number[]) => point.map((value) => value.toPrecision(15)).join(",");
  for (const triangle of parsed.triangles) { const calculated = vectorArea(...triangle); surfaceArea += calculated.area; signedVolume += calculated.signedVolume; for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]] as Array<[number[], number[]]>) { const key = [pointKey(a), pointKey(b)].sort().join("|"); edges.set(key, (edges.get(key) ?? 0) + 1); } }
  const watertight = [...edges.values()].every((count) => count === 2);
  const stl: StlGeometryStatistics = { triangles: property(parsed.triangles.length, "PARSED"), surfaceArea: property(surfaceArea, "CALCULATED"), signedVolume: watertight ? property(Math.abs(signedVolume), "CALCULATED") : property<number>(undefined, "UNKNOWN", "Volume is withheld because the edge-incidence calculation did not confirm a watertight mesh."), watertight: property(watertight, "CALCULATED"), normals: property(parsed.normalsPresent ? "PRESENT" : "UNAVAILABLE", "PARSED") };
  return { format: "STL", parser: "Native STL Scanner", parserVersion: "Phase 3.9", parseStatus: "PARSED", validationStatus: "VALID", units: { status: "UNKNOWN", provenance: "UNKNOWN", note: "STL does not carry a reliable universal unit declaration." }, boundingBox: bbox(points), stl, limitations: ["STL is a triangle mesh; feature history, solids, assemblies, materials, and exact CAD surfaces are not present.", "Watertight status is derived from coordinate-matched triangle edge incidence and does not certify manufacturability or physical integrity."] };
}
function parseDxf(bytes: Buffer): ParseOutcome {
  try {
    const design = importDxf(bytes);
    const validation = validateDesign2D(design);
    if (validation.status !== "PASS") return parserFailure("PARSE_FAILED", "DXF", validation.failures.join(", "), "Upload a supported LINE/CIRCLE DXF design with a closed outer profile and valid millimetre entities.");
    const points: Array<[number, number, number]> = design.entities.flatMap((entity) => entity.type === "LINE" ? [[entity.x1, entity.y1, 0], [entity.x2, entity.y2, 0]] : [[entity.cx - entity.radius, entity.cy - entity.radius, 0], [entity.cx + entity.radius, entity.cy + entity.radius, 0]]);
    return { format: "DXF", parser: "NONE", parserVersion: "CAD2D DXF subset", parseStatus: "PARSED", validationStatus: "VALID", units: { status: "KNOWN", value: "mm", provenance: "PARSED" }, boundingBox: bbox(points), limitations: ["Only LINE and CIRCLE entities are admitted by the authoritative DXF subset parser.", "No CAM toolpath, machining, tolerance, material, or manufacturability result is claimed from DXF validation."] };
  } catch (error) { return parserFailure("PARSE_FAILED", "DXF", error instanceof Error ? error.message : "DXF parse failed.", "Upload a supported LINE/CIRCLE DXF design."); }
}
export async function parseCadFileBytes(fileName: string, bytes: Buffer): Promise<ParseOutcome> { const format = formatFromName(fileName); if (format === "UNSUPPORTED") return parserFailure("UNSUPPORTED", format, `.${extension(fileName) || "unknown"} is not a Phase 3.9 geometry parser target.`, "Upload STEP/STP, STL, or a supported LINE/CIRCLE DXF file, or retain the file as unsupported metadata only."); return format === "STEP" ? parseStep(bytes) : format === "STL" ? parseStl(bytes) : parseDxf(bytes); }
function rowToContext(row: typeof engineeringCadFiles.$inferSelect): CADFileContext { return JSON.parse(row.contextJson) as CADFileContext; }
async function authorize(projectId: string, accessKey: string) { return openPersistentProject({ name: "", projectId, accessKey }); }
async function database() { const db = await getDb(); if (!db) throw new Error("CAD file intelligence database is unavailable; no session-only file fallback is used."); return db; }

export async function ingestCadFile(input: CADFileUploadInput): Promise<CADFileUploadResult> {
  await authorize(input.projectId, input.accessKey); const db = await database(); const bytes = safeBase64(input.base64); const hash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await db.select().from(engineeringCadFiles).where(and(eq(engineeringCadFiles.projectId, input.projectId), eq(engineeringCadFiles.sha256, hash), isNull(engineeringCadFiles.removedAt))).limit(1);
  if (duplicate[0]) return { file: rowToContext(duplicate[0]), duplicateOfFileId: duplicate[0].id, recordedToConversation: Boolean(input.conversationId) };
  const name = input.fileName.trim().slice(0, 255) || "unnamed"; const normalized = normalizedName(name); const previous = await db.select().from(engineeringCadFiles).where(and(eq(engineeringCadFiles.projectId, input.projectId), eq(engineeringCadFiles.normalizedName, normalized))).orderBy(desc(engineeringCadFiles.version)).limit(1); const version = (previous[0]?.version ?? 0) + 1; const outcome = await parseCadFileBytes(name, bytes); const fileId = id("CAD_FILE");
  const storage = await storagePut(`engineering-projects/${opaqueId(input.projectId)}/cad-files/${hash}/${opaqueId(name)}`, bytes, input.mimeType || "application/octet-stream");
  const context: CADFileContext = { fileId, projectId: input.projectId, conversationId: input.conversationId, fileName: name, fileSizeBytes: bytes.length, sha256: hash, version, parentFileId: previous[0]?.id ?? undefined, storage, createdAt: new Date().toISOString(), ...outcome };
  await db.insert(engineeringCadFiles).values({ id: fileId, projectId: input.projectId, conversationId: input.conversationId ?? null, fileName: name, normalizedName: normalized, format: outcome.format, mimeType: input.mimeType ?? null, sizeBytes: bytes.length, sha256: hash, version, parentFileId: previous[0]?.id ?? null, storageKey: storage.key, storageUrl: storage.url, parser: outcome.parser, parserVersion: outcome.parserVersion, parseStatus: outcome.parseStatus, validationStatus: outcome.validationStatus, contextJson: JSON.stringify(context), parserErrorJson: outcome.parserError ? JSON.stringify(outcome.parserError) : null, createdAt: new Date(context.createdAt) });
  if (input.conversationId) await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { conversationId: input.conversationId, kind: "FILE", title: `${name} · v${version} · ${outcome.parseStatus}`, content: `${outcome.format} · ${bytes.length.toLocaleString()} bytes · SHA-256 ${hash}. ${outcome.parserError?.reason ?? `Parser: ${outcome.parser}.`}`, truthStatus: outcome.parseStatus === "PARSED" || outcome.parseStatus === "PARTIALLY_PARSED" ? "DERIVED" : "UNKNOWN", validationStage: outcome.validationStatus === "VALID" ? "GEOMETRICALLY_VALIDATED" : "CONCEPTUAL", authorSource: "USER" } });
  return { file: context, recordedToConversation: Boolean(input.conversationId) };
}
export async function listCadFiles(args: { projectId: string; accessKey: string; conversationId?: string; includeRemoved?: boolean }) { await authorize(args.projectId, args.accessKey); const db = await database(); const rows = await db.select().from(engineeringCadFiles).where(eq(engineeringCadFiles.projectId, args.projectId)).orderBy(desc(engineeringCadFiles.createdAt)); return rows.filter((row) => (args.includeRemoved || !row.removedAt) && (!args.conversationId || row.conversationId === args.conversationId)).map(rowToContext); }
export async function getCadFileContext(args: { projectId: string; accessKey: string; fileId: string }) { await authorize(args.projectId, args.accessKey); const db = await database(); const rows = await db.select().from(engineeringCadFiles).where(and(eq(engineeringCadFiles.projectId, args.projectId), eq(engineeringCadFiles.id, args.fileId))).limit(1); if (!rows[0] || rows[0].removedAt) throw new Error("CAD file is not available in the authorized project."); return rowToContext(rows[0]); }
export async function loadVerifiedCadFileBytes(args: { projectId: string; accessKey: string; fileId: string }) {
  const file = await getCadFileContext(args);
  const signedUrl = await storageGetSignedUrl(file.storage.key);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Managed CAD source retrieval failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== file.fileSizeBytes) throw new Error("Managed CAD source byte length does not match the persisted artifact context.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== file.sha256) throw new Error("Managed CAD source SHA-256 does not match the persisted artifact context.");
  return { file, bytes };
}
export async function removeCadFile(args: { projectId: string; accessKey: string; fileId: string }) { const context = await getCadFileContext(args); const db = await database(); const removed = { ...context, parseStatus: "REMOVED" as const, validationStatus: "UNKNOWN" as const, limitations: [...context.limitations, "The project reference was removed. Managed object storage does not expose a direct delete operation in this environment." ] }; await db.update(engineeringCadFiles).set({ removedAt: new Date(), parseStatus: "REMOVED", validationStatus: "UNKNOWN", contextJson: JSON.stringify(removed) }).where(and(eq(engineeringCadFiles.projectId, args.projectId), eq(engineeringCadFiles.id, args.fileId))); return removed; }
export async function analyzeCadFile(args: { projectId: string; accessKey: string; fileId: string }): Promise<CADFileAnalysisContext> { const file = await getCadFileContext(args); const facts = [file.format, file.boundingBox ? `Bounding box: ${file.boundingBox.size.join(" × ")} (${file.boundingBox.provenance}).` : "Bounding box: UNKNOWN.", file.step ? `Topology: ${file.step.solids.value ?? 0} solids, ${file.step.faces.value ?? 0} faces, ${file.step.edges.value ?? 0} edges.` : file.stl ? `Mesh: ${file.stl.triangles.value ?? 0} triangles; watertight: ${file.stl.watertight.value ?? "UNKNOWN"}.` : "Geometry statistics: UNKNOWN."]; return { file, facts, inferences: ["No design-strength, mass, manufacturability, or safety inference is asserted from file parsing alone."], unknowns: file.limitations, requiresCAE: ["Structural performance, loads, stresses, vibration, fatigue, thermal behavior, and optimization require a future CAE workflow."], requiresPhysicalTesting: ["Safety, regulatory compliance, material properties, durability, and manufacturing qualification require physical evidence." ] }; }
