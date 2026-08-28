import { createHash } from "node:crypto";

import { getOpenCascadeKernel } from "./cadKernel";
import { runWithOpenCascadeAdmission } from "./runtimeAdmission";
import { getCadFileContext } from "./cadFileIntelligence";
import { storageGetSignedUrl } from "./storage";

type Access = { projectId: string; accessKey: string };
export type SupportedEngineeringReferenceType = "VERTEX";
export type EngineeringReferenceResolutionStatus =
  | "RESOLVED"
  | "INVALID"
  | "ARTIFACT_HASH_MISMATCH"
  | "ARTIFACT_REVISION_MISMATCH"
  | "ENTITY_NOT_FOUND"
  | "UNSUPPORTED"
  | "REQUIRED_INPUT";

export type EngineeringReferenceCandidate = {
  referenceId: string;
  artifactId: string;
  artifactRevision: number;
  artifactSha256: string;
  referenceType: SupportedEngineeringReferenceType;
  kernelEntityIdentity: string;
  sourceCoordinates: { x: number; y: number; z: number };
  coordinateUnit: "mm" | "m" | "inch" | "UNKNOWN";
  resolutionStatus: "RESOLVED";
  identityMechanism: "OPEN_CASCADE_VERTEX_POINT_SIGNATURE";
  limitations: string[];
};

export type PersistedEngineeringReference = EngineeringReferenceCandidate & {
  componentId: string;
  persistedAt: string;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const finite = (value: number) => Number.isFinite(value);
const normalizedCoordinate = (value: number) => Number(value.toFixed(9));
const coordinateUnit = (file: Awaited<ReturnType<typeof getCadFileContext>>) =>
  file.units.status === "KNOWN" && (file.units.value === "mm" || file.units.value === "m" || file.units.value === "inch")
    ? file.units.value
    : "UNKNOWN";

async function fetchVerifiedStep(file: Awaited<ReturnType<typeof getCadFileContext>>) {
  if (file.format !== "STEP") throw new Error("ENGINEERING_REFERENCE_STEP_REQUIRED");
  if (file.parseStatus !== "PARSED" || file.validationStatus !== "VALID") throw new Error("ENGINEERING_REFERENCE_ARTIFACT_NOT_VERIFIED");
  const signedUrl = await storageGetSignedUrl(file.storage.key);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("ENGINEERING_REFERENCE_SOURCE_UNAVAILABLE");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== file.fileSizeBytes) throw new Error("ENGINEERING_REFERENCE_ARTIFACT_LENGTH_MISMATCH");
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("ENGINEERING_REFERENCE_ARTIFACT_HASH_MISMATCH");
  return bytes;
}

async function enumerateVertices(args: Access & { artifactId: string }) {
  const file = await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.artifactId });
  const bytes = await fetchVerifiedStep(file);
  return runWithOpenCascadeAdmission({ projectId: args.projectId, resourceClass: "REFERENCE" }, async () => {
  const oc = await getOpenCascadeKernel();
  const path = `/engineering-reference-${crypto.randomUUID()}.step`;
  let reader: any; let progress: any; let shape: any; let vertexMap: any;
  try {
    (oc as any).FS.writeFile(path, bytes);
    reader = new (oc as any).STEPControl_Reader_1();
    reader.ReadFile(path);
    const roots = Number(reader.NbRootsForTransfer());
    progress = new (oc as any).Message_ProgressRange_1();
    const transferred = Number(reader.TransferRoots(progress));
    shape = reader.OneShape();
    if (!roots || !transferred || shape.IsNull()) throw new Error("ENGINEERING_REFERENCE_KERNEL_IMPORT_FAILED");
    vertexMap = new (oc as any).TopTools_IndexedMapOfShape_1();
    (oc as any).TopExp.MapShapes_1(shape, (oc.TopAbs_ShapeEnum as any).TopAbs_VERTEX, vertexMap);
    const points: Array<{ x: number; y: number; z: number }> = [];
    for (let vertexIndex = 1; vertexIndex <= vertexMap.Size(); vertexIndex += 1) {
      const vertex = oc.TopoDS.Vertex_1(vertexMap.FindKey(vertexIndex));
      const point = oc.BRep_Tool.Pnt(vertex);
      const coordinates = { x: normalizedCoordinate(point.X()), y: normalizedCoordinate(point.Y()), z: normalizedCoordinate(point.Z()) };
      if (finite(coordinates.x) && finite(coordinates.y) && finite(coordinates.z)) points.push(coordinates);
      point.delete?.();
      vertex.delete?.();
    }
    const duplicateCounts = new Map<string, number>();
    for (const point of points) {
      const key = `${point.x}|${point.y}|${point.z}`;
      duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
    }
    const unit = coordinateUnit(file);
    return points.flatMap((point) => {
      const coordinateKey = `${point.x}|${point.y}|${point.z}`;
      if (duplicateCounts.get(coordinateKey) !== 1) return [];
      const kernelEntityIdentity = `OCC_VERTEX_POINT-${hash({ point, unit }).slice(0, 32)}`;
      const referenceId = `ENG_REF-${hash({ artifactId: file.fileId, artifactRevision: file.version, artifactSha256: file.sha256, referenceType: "VERTEX", kernelEntityIdentity }).slice(0, 32)}`;
      const candidate: EngineeringReferenceCandidate = {
        referenceId,
        artifactId: file.fileId,
        artifactRevision: file.version,
        artifactSha256: file.sha256,
        referenceType: "VERTEX",
        kernelEntityIdentity,
        sourceCoordinates: point,
        coordinateUnit: unit,
        resolutionStatus: "RESOLVED",
        identityMechanism: "OPEN_CASCADE_VERTEX_POINT_SIGNATURE",
        limitations: [
          "Only unique OpenCascade BRep vertex point signatures are currently supported.",
          "This artifact-revision-bound identity is not a cross-revision topology remap.",
          "Faces, edges, axes, planes, and coordinate systems remain UNSUPPORTED pending a proven kernel identity mechanism.",
        ],
      };
      return [candidate];
    });
  } finally {
    try { vertexMap?.delete?.(); shape?.delete?.(); progress?.delete?.(); reader?.delete?.(); (oc as any).FS.unlink(path); } catch { /* temporary kernel source cleanup is best effort */ }
  }
  });
}

export async function listEngineeringReferenceCandidates(args: Access & { artifactId: string }) {
  const vertices = await enumerateVertices(args);
  return {
    artifactId: args.artifactId,
    supportedReferenceTypes: ["VERTEX"] as const,
    unsupportedReferenceTypes: ["EDGE", "FACE", "AXIS", "PLANE", "COORDINATE_SYSTEM"] as const,
    candidates: vertices,
    limitations: ["Viewer face labels and mesh triangle indices are excluded from engineering reference identity.", "References are available only for verified STEP artifacts with a successful OpenCascade BRep import."],
  };
}

export async function resolveEngineeringReference(args: Access & { reference: PersistedEngineeringReference }) {
  let file: Awaited<ReturnType<typeof getCadFileContext>>;
  try {
    file = await getCadFileContext({ projectId: args.projectId, accessKey: args.accessKey, fileId: args.reference.artifactId });
  } catch {
    return { reference: args.reference, resolutionStatus: "INVALID" as const, reason: "The project-owned CAD artifact is unavailable." };
  }
  if (file.version !== args.reference.artifactRevision) return { reference: args.reference, resolutionStatus: "ARTIFACT_REVISION_MISMATCH" as const, reason: "The persisted reference targets a different artifact revision." };
  if (file.sha256 !== args.reference.artifactSha256) return { reference: args.reference, resolutionStatus: "ARTIFACT_HASH_MISMATCH" as const, reason: "The persisted reference SHA-256 does not match the authorized artifact." };
  if (args.reference.referenceType !== "VERTEX") return { reference: args.reference, resolutionStatus: "UNSUPPORTED" as const, reason: "This reference type is not implemented by the current kernel integration." };
  try {
    const candidates = await enumerateVertices({ ...args, artifactId: file.fileId });
    const candidate = candidates.find((item) => item.referenceId === args.reference.referenceId && item.kernelEntityIdentity === args.reference.kernelEntityIdentity);
    if (!candidate) return { reference: args.reference, resolutionStatus: "ENTITY_NOT_FOUND" as const, reason: "The exact kernel vertex point signature no longer resolves in the authorized BRep." };
    return { reference: { ...args.reference, ...candidate, componentId: args.reference.componentId, persistedAt: args.reference.persistedAt }, resolutionStatus: "RESOLVED" as const, reason: "The persisted reference resolved to the same authoritative OpenCascade vertex signature." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ENGINEERING_REFERENCE_RESOLUTION_FAILED";
    return { reference: args.reference, resolutionStatus: message.includes("HASH_MISMATCH") ? "ARTIFACT_HASH_MISMATCH" as const : "INVALID" as const, reason: message };
  }
}
