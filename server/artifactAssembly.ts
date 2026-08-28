import { createHash, randomUUID } from "crypto";

import { getCadFileContext, listCadFiles } from "./cadFileIntelligence";
import { getEngineeringViewerScene } from "./engineeringViewer";
import { listEngineeringReferenceCandidates, resolveEngineeringReference, type PersistedEngineeringReference } from "./engineeringReferences";
import { appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";
import { createSeatKnowledgeEntity, getSeatKnowledgeEntity, listSeatKnowledgeEntities, reviseSeatKnowledgeEntity } from "./seatKnowledgeRecords";

type Access = { projectId: string; accessKey: string };
export type AssemblyVector = { x: number; y: number; z: number };
export type AssemblyComponentInput = { componentId?: string; label: string; cadFileId: string; sourceHash: string; translationMm: AssemblyVector; rotationDeg: AssemblyVector };
export type AssemblyConstraintInput = { kind: string; componentIds: string[]; referencedFaceIds?: string[]; description?: string };
type Transform = { translationMm: AssemblyVector; rotationDeg: AssemblyVector };
type TransformRevision = { transformRevisionId: string; componentId: string; assemblyId: string; sourceArtifactId: string; sourceArtifactRevision: number; sourceArtifactSha256: string; previousTransform: Transform | null; newTransform: Transform; timestamp: string };
type StoredComponent = { componentId: string; assemblyId: string; label: string; artifactId: string; artifactRevision: number; artifactSha256: string; verifiedIngestionState: "VERIFIED"; geometryRepresentation: "KERNEL_DERIVED_MESH"; transform: Transform; transformRevision: TransformRevision; engineeringReferences: PersistedEngineeringReference[]; status: "ACTIVE" };
type StoredAssembly = { schema: "ASSEMBLY_AUTHORING_V2" | "ASSEMBLY_AUTHORING_V3"; assemblyId: string; assemblyRevisionId: string; transformMode: "USER_DEFINED_RIGID_TRANSFORM"; constraintState: "REQUIRED_INPUT" | "UNSUPPORTED"; constraints: AssemblyConstraintInput[]; components: StoredComponent[]; limitations: string[] };

const sourceHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const finiteVector = (value: AssemblyVector, label: string) => { if (!value || ![value.x, value.y, value.z].every((item) => Number.isFinite(item))) throw new Error(`ASSEMBLY_${label}_FINITE_VALUES_REQUIRED`); return value; };
const validHash = (value: string) => /^[a-f0-9]{64}$/i.test(value);
const transformOf = (component: { translationMm: AssemblyVector; rotationDeg: AssemblyVector }): Transform => ({ translationMm: { ...component.translationMm }, rotationDeg: { ...component.rotationDeg } });
const sameTransform = (a: Transform, b: Transform) => [a.translationMm.x, a.translationMm.y, a.translationMm.z, a.rotationDeg.x, a.rotationDeg.y, a.rotationDeg.z].every((value, index) => value === [b.translationMm.x, b.translationMm.y, b.translationMm.z, b.rotationDeg.x, b.rotationDeg.y, b.rotationDeg.z][index]);

async function verifiedComponents(args: Access, assemblyId: string, components: AssemblyComponentInput[], previous?: StoredAssembly) {
  if (!Array.isArray(components) || components.length < 1 || components.length > 64) throw new Error("ASSEMBLY_COMPONENT_COUNT_REQUIRED");
  const known = new Map(previous?.components.map((component) => [component.componentId, component]) ?? []); const ids = new Set<string>();
  return Promise.all(components.map(async (component, index) => {
    const componentId = component.componentId?.trim() || `COMPONENT-${randomUUID()}`;
    if (ids.has(componentId)) throw new Error("ASSEMBLY_COMPONENT_ID_DUPLICATE"); ids.add(componentId);
    if (previous && !component.componentId && previous.components.some((item) => item.artifactId === component.cadFileId && item.label === component.label)) throw new Error("ASSEMBLY_COMPONENT_ID_REQUIRED_FOR_EXISTING_COMPONENT");
    if (!component.label?.trim() || component.label.length > 160 || !component.cadFileId?.trim() || !validHash(component.sourceHash)) throw new Error("ASSEMBLY_COMPONENT_REFERENCE_INVALID");
    finiteVector(component.translationMm, "TRANSLATION"); finiteVector(component.rotationDeg, "ROTATION");
    const [file, scene] = await Promise.all([getCadFileContext({ ...args, fileId: component.cadFileId }), getEngineeringViewerScene({ ...args, fileId: component.cadFileId })]);
    if (file.parseStatus !== "PARSED" || file.validationStatus !== "VALID" || !scene.mesh || scene.file.sha256 !== component.sourceHash.toLowerCase() || scene.mesh.sourceHash !== component.sourceHash.toLowerCase()) throw new Error("ASSEMBLY_ARTIFACT_NOT_VERIFIED");
    if (file.sha256 !== component.sourceHash.toLowerCase()) throw new Error("ASSEMBLY_COMPONENT_SOURCE_HASH_MISMATCH");
    const transform = transformOf(component); const prior = known.get(componentId);
    if (prior && (prior.artifactId !== file.fileId || prior.artifactRevision !== file.version || prior.artifactSha256 !== file.sha256)) throw new Error("ASSEMBLY_COMPONENT_ARTIFACT_REBIND_REQUIRES_NEW_COMPONENT");
    const changed = !prior || !sameTransform(prior.transform, transform); const timestamp = new Date().toISOString();
    const transformRevision: TransformRevision = changed ? { transformRevisionId: `TRANSFORM_REV-${randomUUID()}`, componentId, assemblyId, sourceArtifactId: file.fileId, sourceArtifactRevision: file.version, sourceArtifactSha256: file.sha256, previousTransform: prior?.transform ?? null, newTransform: transform, timestamp } : prior.transformRevision;
    return { componentId, assemblyId, label: component.label.trim(), artifactId: file.fileId, artifactRevision: file.version, artifactSha256: file.sha256, verifiedIngestionState: "VERIFIED" as const, geometryRepresentation: "KERNEL_DERIVED_MESH" as const, transform, transformRevision, engineeringReferences: prior?.engineeringReferences ?? [], status: "ACTIVE" as const };
  }));
}

function assemble(assemblyId: string, assemblyRevisionId: string, components: StoredComponent[], constraints?: AssemblyConstraintInput[]): StoredAssembly {
  const provided = Array.isArray(constraints) ? constraints : [];
  return { schema: "ASSEMBLY_AUTHORING_V3", assemblyId, assemblyRevisionId, transformMode: "USER_DEFINED_RIGID_TRANSFORM", constraintState: provided.length ? "UNSUPPORTED" : "REQUIRED_INPUT", constraints: provided.map((item) => ({ kind: item.kind, componentIds: [...item.componentIds], referencedFaceIds: item.referencedFaceIds ? [...item.referencedFaceIds] : undefined, description: item.description })), components, limitations: ["Source CAD artifacts remain immutable; an assembly owns only explicit user-defined rigid transforms.", "Engineering references are revision-bound OpenCascade vertex signatures only; viewer mesh labels and triangle indices are not engineering reference authority.", "No generic imported-STEP assembly hierarchy, named parts, mates, joints, collision state, or topology semantics are inferred.", "Constraint solving is not implemented: state is REQUIRED_INPUT when absent and UNSUPPORTED when requested."] };
}

function parse(record: Awaited<ReturnType<typeof getSeatKnowledgeEntity>>): StoredAssembly {
  try { const value = JSON.parse(record.valueText ?? ""); if (value?.schema !== "ASSEMBLY_AUTHORING_V2" && value?.schema !== "ASSEMBLY_AUTHORING_V3") throw new Error(); return { ...value, components: value.components.map((component: StoredComponent) => ({ ...component, engineeringReferences: component.engineeringReferences ?? [] })) } as StoredAssembly; } catch { throw new Error("ASSEMBLY_RECORD_CORRUPTED_OR_LEGACY_UNSUPPORTED"); }
}

function recordDescription(assembly: StoredAssembly) { return `ASSEMBLY_AUTHORING_V2; ASSEMBLY_ID=${assembly.assemblyId}; COMPONENTS=${assembly.components.length}; CONSTRAINT_STATE=${assembly.constraintState}; USER_DEFINED_RIGID_TRANSFORMS_ONLY`; }
function artifactHash(assembly: StoredAssembly) { return sourceHash({ assemblyId: assembly.assemblyId, components: assembly.components.map((component) => ({ componentId: component.componentId, artifactId: component.artifactId, artifactRevision: component.artifactRevision, artifactSha256: component.artifactSha256, transform: component.transform, transformRevisionId: component.transformRevision.transformRevisionId, engineeringReferenceIds: component.engineeringReferences.map((reference) => reference.referenceId) })), constraintState: assembly.constraintState }); }

export async function listEligibleAssemblyCadFiles(args: Access) {
  const files = await listCadFiles(args); const eligible = files.filter((file) => file.parseStatus === "PARSED" && file.validationStatus === "VALID");
  return Promise.all(eligible.map(async (file) => { const scene = await getEngineeringViewerScene({ ...args, fileId: file.fileId }); if (!scene.mesh || scene.file.sha256 !== file.sha256) throw new Error("ASSEMBLY_ARTIFACT_NOT_VERIFIED"); return { artifactId: file.fileId, artifactRevision: file.version, artifactSha256: file.sha256, fileName: file.fileName, format: file.format, projectId: file.projectId, createdAt: file.createdAt, availability: "AVAILABLE" as const, verifiedIngestionState: "VERIFIED" as const, geometryRepresentation: "KERNEL_DERIVED_MESH" as const, bounds: scene.boundingBox }; }));
}

export async function createArtifactAssembly(args: Access & { name: string; components: AssemblyComponentInput[]; constraints?: AssemblyConstraintInput[]; seatDesignId?: string; seatRevisionId?: string }) {
  if (!args.name?.trim() || args.name.length > 160) throw new Error("ASSEMBLY_NAME_REQUIRED"); const assemblyId = `ASSEMBLY-${randomUUID()}`;
  const components = await verifiedComponents(args, assemblyId, args.components); const assembly = assemble(assemblyId, `ASSEMBLY_REV-${randomUUID()}`, components, args.constraints); const hash = artifactHash(assembly);
  const record = await createSeatKnowledgeEntity({ ...args, input: { entityType: "ASSEMBLY", externalKey: assemblyId, name: args.name.trim(), description: recordDescription(assembly), valueText: JSON.stringify(assembly), sourceType: "USER_PROVIDED", sourceReference: "User-defined authoritative artifact assembly", artifactHash: hash, createdBy: "ArtifactAssemblyAuthoring", status: assembly.constraintState === "UNSUPPORTED" ? "REQUIRED_INPUT" : "DRAFT", seatDesignId: args.seatDesignId, seatRevisionId: args.seatRevisionId } });
  return { record, assembly, assemblyRevisionHash: hash };
}

export async function getArtifactAssembly(args: Access & { entityId: string }) { const record = await getSeatKnowledgeEntity(args); if (record.entityType !== "ASSEMBLY") throw new Error("ASSEMBLY_NOT_FOUND"); return { record, assembly: parse(record) }; }
export async function listArtifactAssemblies(args: Access) {
  const records = await listSeatKnowledgeEntities({ ...args, entityType: "ASSEMBLY" });
  return records.filter((record) => record.status !== "SUPERSEDED").map((record) => {
    try { return { record, assembly: parse(record), availability: "AVAILABLE" as const }; }
    catch { return { record, availability: "REQUIRED_INPUT" as const, reason: "LEGACY_ASSEMBLY_REBIND_REQUIRED: this historic transform record lacks the required authoritative multi-artifact revision fields." }; }
  });
}
export async function listArtifactAssemblyRevisions(args: Access & { entityId: string }) { const current = await getArtifactAssembly(args); const records = await listSeatKnowledgeEntities({ ...args, entityType: "ASSEMBLY", limit: 100 }); return records.filter((record) => record.externalKey === current.record.externalKey).sort((a, b) => a.revision - b.revision).map((record) => ({ record, assembly: parse(record) })); }

export async function reviseArtifactAssembly(args: Access & { entityId: string; name: string; components: AssemblyComponentInput[]; constraints?: AssemblyConstraintInput[]; reason: string }) {
  const prior = await getArtifactAssembly(args); if (prior.record.status === "RELEASED") throw new Error("ASSEMBLY_RELEASED_REVISION_IMMUTABLE");
  const components = await verifiedComponents(args, prior.assembly.assemblyId, args.components, prior.assembly); const assembly = assemble(prior.assembly.assemblyId, `ASSEMBLY_REV-${randomUUID()}`, components, args.constraints); const hash = artifactHash(assembly);
  const record = await reviseSeatKnowledgeEntity({ ...args, entityId: args.entityId, input: { entityType: "ASSEMBLY", name: args.name?.trim() || prior.record.name, description: recordDescription(assembly), valueText: JSON.stringify(assembly), sourceType: "USER_PROVIDED", sourceReference: "User-defined authoritative artifact assembly", artifactHash: hash, createdBy: "ArtifactAssemblyAuthoring", reason: args.reason || "Assembly transform revision", status: assembly.constraintState === "UNSUPPORTED" ? "REQUIRED_INPUT" : "DRAFT", seatDesignId: prior.record.seatDesignId ?? undefined, seatRevisionId: prior.record.seatRevisionId ?? undefined } });
  return { record, assembly, assemblyRevisionHash: hash, supersededAssemblyId: prior.record.id };
}

export type ArtifactAssemblyBom = {
  bomId: string;
  assemblyEntityId: string;
  assemblyId: string;
  assemblyRevisionId: string;
  assemblyRecordRevision: number;
  assemblyRevisionHash: string;
  generatedAt: string;
  status: "DERIVED_FROM_VERIFIED_ASSEMBLY";
  items: Array<{
    bomItemId: string;
    quantity: number;
    componentIds: string[];
    componentLabels: string[];
    sourceCadFileId: string;
    sourceCadRevision: number;
    sourceCadSha256: string;
    sourceFileName: string;
    format: "STEP";
    verification: "PARSED_VALID_KERNEL_MESH";
  }>;
  limitations: string[];
  bomHash: string;
};

async function deriveArtifactAssemblyBom(args: Access & { entityId: string }): Promise<ArtifactAssemblyBom> {
  const { record, assembly } = await getArtifactAssembly(args);
  const sources = await Promise.all(assembly.components.map(async (component) => {
    const file = await getCadFileContext({ ...args, fileId: component.artifactId });
    if (file.parseStatus !== "PARSED" || file.validationStatus !== "VALID" || file.sha256 !== component.artifactSha256 || file.version !== component.artifactRevision || file.format !== "STEP") {
      throw new Error("ASSEMBLY_BOM_ARTIFACT_BINDING_INVALID");
    }
    return { component, file };
  }));
  const grouped = new Map<string, typeof sources>();
  for (const source of sources) {
    const key = `${source.file.fileId}:${source.file.version}:${source.file.sha256}`;
    grouped.set(key, [...(grouped.get(key) ?? []), source]);
  }
  const assemblyRevisionHash = artifactHash(assembly);
  const items = [...grouped.values()].map((entries) => {
    const first = entries[0];
    const componentIds = entries.map((entry) => entry.component.componentId).sort();
    const componentLabels = entries.map((entry) => entry.component.label).sort();
    const bomItemId = `BOM-ITEM-${createHash("sha256").update(`${record.id}:${first.file.fileId}:${first.file.version}:${first.file.sha256}`).digest("hex").slice(0, 20)}`;
    return {
      bomItemId,
      quantity: entries.length,
      componentIds,
      componentLabels,
      sourceCadFileId: first.file.fileId,
      sourceCadRevision: first.file.version,
      sourceCadSha256: first.file.sha256,
      sourceFileName: first.file.fileName,
      format: "STEP" as const,
      verification: "PARSED_VALID_KERNEL_MESH" as const,
    };
  }).sort((left, right) => left.bomItemId.localeCompare(right.bomItemId));
  const generatedAt = new Date().toISOString();
  const bomId = `BOM-${randomUUID()}`;
  const bomHash = sourceHash({ assemblyEntityId: record.id, assemblyRevisionId: assembly.assemblyRevisionId, assemblyRevisionHash, items: items.map((item) => ({ ...item, componentLabels: undefined })), format: "DERIVED_FROM_VERIFIED_ASSEMBLY_V1" });
  return {
    bomId,
    assemblyEntityId: record.id,
    assemblyId: assembly.assemblyId,
    assemblyRevisionId: assembly.assemblyRevisionId,
    assemblyRecordRevision: record.revision,
    assemblyRevisionHash,
    generatedAt,
    status: "DERIVED_FROM_VERIFIED_ASSEMBLY",
    items,
    limitations: [
      "This BOM is derived only from verified assembly component-to-CAD-artifact bindings and immutable assembly revision data.",
      "Material, mass, cost, supplier, lifecycle, manufacturing, tolerance, and compliance attributes are not inferred.",
      "This BOM does not prove an assembly hierarchy, mates, motion, collision, clearance, or production readiness.",
    ],
    bomHash,
  };
}

export async function createArtifactAssemblyBom(args: Access & { entityId: string }) {
  const bom = await deriveArtifactAssemblyBom(args);
  await appendPersistentMemory({
    projectId: args.projectId,
    accessKey: args.accessKey,
    record: {
      kind: "ENGINEERING_BOM_REVISION",
      title: `Derived assembly BOM · ${bom.bomId}`,
      content: JSON.stringify(bom),
      truthStatus: "DERIVED",
      validationStage: "GEOMETRICALLY_VALIDATED",
      relatedConfigurationId: bom.assemblyEntityId,
      authorSource: "CAD_AGENT",
    },
  });
  return bom;
}

export async function listArtifactAssemblyBoms(args: Access & { entityId: string }) {
  await getArtifactAssembly(args);
  const snapshot = await projectMemorySnapshot(args);
  return snapshot.records
    .filter((record) => record.kind === "ENGINEERING_BOM_REVISION")
    .flatMap((record) => {
      try {
        const bom = JSON.parse(record.content) as ArtifactAssemblyBom;
        return bom.assemblyEntityId === args.entityId ? [bom] : [];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

export async function compareArtifactAssemblyRevisions(args: Access & { fromEntityId: string; toEntityId: string }) {
  const [from, to] = await Promise.all([getArtifactAssembly({ ...args, entityId: args.fromEntityId }), getArtifactAssembly({ ...args, entityId: args.toEntityId })]);
  if (from.assembly.assemblyId !== to.assembly.assemblyId) throw new Error("ASSEMBLY_COMPARISON_REQUIRES_SAME_ASSEMBLY");
  const previous = new Map(from.assembly.components.map((component) => [component.componentId, component])); const next = new Map(to.assembly.components.map((component) => [component.componentId, component]));
  const addedComponents = [...next.keys()].filter((id) => !previous.has(id)); const removedComponents = [...previous.keys()].filter((id) => !next.has(id)); const shared = [...next.keys()].filter((id) => previous.has(id));
  const changedTransforms = shared.filter((id) => !sameTransform(previous.get(id)!.transform, next.get(id)!.transform)); const artifactBindingChanges = shared.filter((id) => { const a = previous.get(id)!; const b = next.get(id)!; return a.artifactId !== b.artifactId || a.artifactRevision !== b.artifactRevision || a.artifactSha256 !== b.artifactSha256; });
  return { assemblyId: to.assembly.assemblyId, fromRevision: { entityId: from.record.id, revision: from.record.revision }, toRevision: { entityId: to.record.id, revision: to.record.revision }, addedComponents, removedComponents, changedTransforms, unchangedComponents: shared.filter((id) => !changedTransforms.includes(id) && !artifactBindingChanges.includes(id)), artifactBindingChanges };
}

function rotateAssemblyPoint(point: { x: number; y: number; z: number }, rotationDeg: AssemblyVector) {
  const radians = { x: rotationDeg.x * Math.PI / 180, y: rotationDeg.y * Math.PI / 180, z: rotationDeg.z * Math.PI / 180 };
  const x1 = point.x; const y1 = point.y * Math.cos(radians.x) - point.z * Math.sin(radians.x); const z1 = point.y * Math.sin(radians.x) + point.z * Math.cos(radians.x);
  const x2 = x1 * Math.cos(radians.y) + z1 * Math.sin(radians.y); const y2 = y1; const z2 = -x1 * Math.sin(radians.y) + z1 * Math.cos(radians.y);
  return { x: x2 * Math.cos(radians.z) - y2 * Math.sin(radians.z), y: x2 * Math.sin(radians.z) + y2 * Math.cos(radians.z), z: z2 };
}

export async function listAssemblyComponentEngineeringReferenceCandidates(args: Access & { entityId: string; componentId: string }) {
  const { assembly } = await getArtifactAssembly(args); const component = assembly.components.find((item) => item.componentId === args.componentId);
  if (!component) throw new Error("ASSEMBLY_COMPONENT_NOT_FOUND");
  return { component: { componentId: component.componentId, artifactId: component.artifactId, artifactRevision: component.artifactRevision, artifactSha256: component.artifactSha256 }, ...(await listEngineeringReferenceCandidates({ ...args, artifactId: component.artifactId })) };
}

export async function resolveAssemblyComponentEngineeringReferences(args: Access & { entityId: string; componentId: string }) {
  const { record, assembly } = await getArtifactAssembly(args); const component = assembly.components.find((item) => item.componentId === args.componentId);
  if (!component) throw new Error("ASSEMBLY_COMPONENT_NOT_FOUND");
  const references = await Promise.all(component.engineeringReferences.map(async (reference) => {
    const resolution = await resolveEngineeringReference({ ...args, reference });
    const assemblySpace = resolution.resolutionStatus === "RESOLVED" && resolution.reference.coordinateUnit === "mm" ? (() => { const rotated = rotateAssemblyPoint(resolution.reference.sourceCoordinates, component.transform.rotationDeg); return { coordinateUnit: "mm" as const, coordinates: { x: rotated.x + component.transform.translationMm.x, y: rotated.y + component.transform.translationMm.y, z: rotated.z + component.transform.translationMm.z }, rotationOrder: "Rx→Ry→Rz intrinsic, then translation" as const }; })() : undefined;
    return { ...resolution, assemblySpace: assemblySpace ?? { status: "REQUIRED_INPUT" as const, reason: resolution.resolutionStatus === "RESOLVED" ? "Assembly-space coordinates require a known millimetre source unit." : "The source reference did not resolve." } };
  }));
  return { record, assemblyRevisionId: assembly.assemblyRevisionId, componentId: component.componentId, references };
}

export async function addAssemblyComponentEngineeringReference(args: Access & { entityId: string; componentId: string; referenceId: string; reason: string }) {
  const prior = await getArtifactAssembly(args); if (prior.record.status === "RELEASED") throw new Error("ASSEMBLY_RELEASED_REVISION_IMMUTABLE");
  const component = prior.assembly.components.find((item) => item.componentId === args.componentId); if (!component) throw new Error("ASSEMBLY_COMPONENT_NOT_FOUND");
  const candidates = await listEngineeringReferenceCandidates({ ...args, artifactId: component.artifactId });
  const candidate = candidates.candidates.find((item) => item.referenceId === args.referenceId); if (!candidate) throw new Error("ENGINEERING_REFERENCE_NOT_RESOLVED_OR_UNSUPPORTED");
  const reference: PersistedEngineeringReference = { ...candidate, componentId: component.componentId, persistedAt: new Date().toISOString() };
  if (component.engineeringReferences.some((item) => item.referenceId === reference.referenceId)) throw new Error("ENGINEERING_REFERENCE_ALREADY_PERSISTED");
  const components = prior.assembly.components.map((item) => item.componentId === component.componentId ? { ...item, engineeringReferences: [...item.engineeringReferences, reference] } : item);
  const assembly = assemble(prior.assembly.assemblyId, `ASSEMBLY_REV-${randomUUID()}`, components, prior.assembly.constraints); const hash = artifactHash(assembly);
  const record = await reviseSeatKnowledgeEntity({ ...args, entityId: prior.record.id, input: { entityType: "ASSEMBLY", name: prior.record.name, description: recordDescription(assembly), valueText: JSON.stringify(assembly), sourceType: "TOOL_GENERATED", sourceReference: "OpenCascade-resolved, artifact-bound assembly engineering reference", artifactHash: hash, createdBy: "EngineeringReferenceFoundation", reason: args.reason?.trim() || "Persist authoritative engineering reference", status: "DRAFT", seatDesignId: prior.record.seatDesignId ?? undefined, seatRevisionId: prior.record.seatRevisionId ?? undefined } });
  return { record, assembly, assemblyRevisionHash: hash, reference };
}
