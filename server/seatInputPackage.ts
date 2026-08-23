import { createHash, randomUUID } from "node:crypto";

import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };

export const INPUT_PACKAGE_FIELD_TYPES = [
  "MATERIAL_CERTIFICATE", "MATERIAL_PROPERTIES", "MOUNT_FIXTURES", "FIXTURE_COORDINATES", "FIXTURE_DOF",
  "LOAD_REGIONS", "LOAD_MAGNITUDE", "LOAD_DIRECTION", "LOAD_APPLICATION_COORDINATES", "BOUNDARY_CONDITIONS",
  "COORDINATE_SYSTEM", "MESH_SETTINGS", "SOLVER_SETTINGS", "VALIDATION_METHOD", "REFERENCE_CRITERION",
] as const;
export type InputPackageFieldType = (typeof INPUT_PACKAGE_FIELD_TYPES)[number];
export type InputPackageStatus = "DRAFT" | "REQUIRED_INPUT" | "REVIEW" | "APPROVED" | "RELEASED" | "SECURITY_BLOCKED";
export type ApprovalStatus = "UNREVIEWED" | "APPROVED" | "REJECTED";

export type EngineeringInputField = {
  fieldType: InputPackageFieldType;
  value?: unknown;
  unit?: string;
  source?: string;
  evidenceFileIds?: string[];
  applicability?: string;
  approvalStatus: ApprovalStatus;
};

export type EngineeringInputAttachment = {
  attachmentId: string;
  packageId: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  base64: string;
  createdAt: string;
};

export type SeatEngineeringInputPackage = {
  entityType: "SEAT_ENGINEERING_INPUT_PACKAGE";
  packageId: string;
  projectId: string;
  seatDesignId: string;
  seatRevisionId: string;
  cadRevisionHash: string;
  cadArtifactHash: string;
  fields: EngineeringInputField[];
  status: InputPackageStatus;
  requiredInputs: string[];
  packageHash: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
};

type PackageInput = Pick<SeatEngineeringInputPackage, "seatDesignId" | "seatRevisionId" | "cadRevisionHash" | "cadArtifactHash"> & { fields?: EngineeringInputField[] };
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown) => JSON.stringify(value);
const packageHash = (item: Omit<SeatEngineeringInputPackage, "packageHash" | "createdAt" | "updatedAt" | "releasedAt" | "status" | "requiredInputs">) => sha(canonical({ ...item, fields: [...item.fields].sort((a, b) => a.fieldType.localeCompare(b.fieldType)) }));
const unique = (values: string[]) => [...new Set(values)].sort();
const validHash = (value: string) => /^[a-f0-9]{64}$/.test(value);

async function authorize(args: Access) { return openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" }); }
function parse<T>(value: string): T | undefined { try { return JSON.parse(value) as T; } catch { return undefined; } }
async function packageRecords(args: Access) {
  await authorize(args);
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === "CAE_PLAN_SNAPSHOT")
    .flatMap((record) => { const item = parse<SeatEngineeringInputPackage>(record.content); return item?.entityType === "SEAT_ENGINEERING_INPUT_PACKAGE" ? [{ record, item }] : []; });
}
async function attachmentRecords(args: Access) {
  await authorize(args);
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === "EVIDENCE")
    .flatMap((record) => { const item = parse<EngineeringInputAttachment>(record.content); return item?.attachmentId && item?.packageId ? [{ record, item }] : []; });
}
async function hasCadArtifactBinding(args: Access, item: SeatEngineeringInputPackage) {
  const records = await projectMemorySnapshot(args);
  return records.records.some((record) => {
    if (record.kind !== "CAE_READINESS" || record.sourceRecordId !== item.seatRevisionId) return false;
    const verification = parse<{ cadArtifact?: { cadRevisionHash?: string; artifactHash?: string } }>(record.content);
    return verification?.cadArtifact?.cadRevisionHash === item.cadRevisionHash && verification.cadArtifact.artifactHash === item.cadArtifactHash;
  });
}
function fieldMissing(field: EngineeringInputField) {
  const missing: string[] = [];
  if (field.value === undefined || field.value === null || field.value === "") missing.push(`${field.fieldType}:VALUE`);
  if (!field.unit?.trim()) missing.push(`${field.fieldType}:UNIT`);
  if (!field.source?.trim()) missing.push(`${field.fieldType}:SOURCE`);
  if (!field.applicability?.trim()) missing.push(`${field.fieldType}:APPLICABILITY`);
  return missing;
}
function assess(fields: EngineeringInputField[], attachments: EngineeringInputAttachment[]) {
  const byType = new Map(fields.map((field) => [field.fieldType, field]));
  const required = INPUT_PACKAGE_FIELD_TYPES.flatMap((type) => !byType.has(type) ? [`${type}:FIELD`] : fieldMissing(byType.get(type)!));
  const evidenceRequired: InputPackageFieldType[] = ["MATERIAL_CERTIFICATE", "REFERENCE_CRITERION"];
  for (const type of evidenceRequired) {
    const ids = byType.get(type)?.evidenceFileIds ?? [];
    if (!ids.length || ids.some((id) => !attachments.some((item) => item.attachmentId === id))) required.push(`${type}:EVIDENCE_FILE`);
  }
  return unique(required);
}
function immutable(packageItem: SeatEngineeringInputPackage) { return packageItem.status === "RELEASED"; }
async function persist(args: Access, item: SeatEngineeringInputPackage) {
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_PLAN_SNAPSHOT", title: `Seat input package · ${item.packageId} · ${item.status}`, content: canonical(item), truthStatus: item.status === "RELEASED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: item.seatRevisionId, relatedConfigurationId: item.cadRevisionHash, authorSource: "USER" } });
  return item;
}

export async function createSeatInputPackage(args: Access & { input: PackageInput }) {
  await authorize(args);
  const now = new Date().toISOString();
  const base = { entityType: "SEAT_ENGINEERING_INPUT_PACKAGE" as const, packageId: `SEAT-INPUT-${randomUUID()}`, projectId: args.projectId, seatDesignId: args.input.seatDesignId, seatRevisionId: args.input.seatRevisionId, cadRevisionHash: args.input.cadRevisionHash, cadArtifactHash: args.input.cadArtifactHash, fields: args.input.fields ?? [] };
  const bindingsValid = validHash(base.cadRevisionHash) && validHash(base.cadArtifactHash);
  const item: SeatEngineeringInputPackage = { ...base, status: bindingsValid ? "DRAFT" : "SECURITY_BLOCKED", requiredInputs: bindingsValid ? INPUT_PACKAGE_FIELD_TYPES.map((type) => `${type}:FIELD`) : ["CAD_REVISION_HASH", "CAD_ARTIFACT_HASH"], packageHash: packageHash(base), createdAt: now, updatedAt: now };
  return persist(args, item);
}

export async function listSeatInputPackages(args: Access & { seatDesignId: string; seatRevisionId?: string }) {
  return (await packageRecords(args)).map(({ item }) => item).filter((item) => item.seatDesignId === args.seatDesignId && (!args.seatRevisionId || item.seatRevisionId === args.seatRevisionId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getSeatInputPackage(args: Access & { packageId: string }) {
  const item = (await packageRecords(args)).map(({ item }) => item).find((candidate) => candidate.packageId === args.packageId);
  if (!item) throw new Error("SEAT_INPUT_PACKAGE_NOT_FOUND");
  return item;
}
export async function attachSeatInputEvidence(args: Access & { packageId: string; fileName: string; mimeType?: string; base64: string }) {
  const packageItem = await getSeatInputPackage(args);
  if (immutable(packageItem)) throw new Error("SEAT_INPUT_PACKAGE_RELEASED_IMMUTABLE");
  const clean = args.base64.replace(/\s/g, "");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("INPUT_EVIDENCE_BASE64_INVALID");
  const bytes = Buffer.from(clean, "base64");
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES || bytes.toString("base64").replace(/=+$/, "") !== clean.replace(/=+$/, "")) throw new Error("INPUT_EVIDENCE_SIZE_OR_INTEGRITY_INVALID");
  const attachment: EngineeringInputAttachment = { attachmentId: `SEAT-ATTACHMENT-${randomUUID()}`, packageId: packageItem.packageId, fileName: args.fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 255) || "evidence.bin", mimeType: args.mimeType?.trim() || "application/octet-stream", byteLength: bytes.length, sha256: sha(bytes), base64: clean, createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "EVIDENCE", title: `Seat input evidence · ${attachment.fileName}`, content: canonical(attachment), truthStatus: "UNVERIFIED", validationStage: "CONCEPTUAL", sourceRecordId: packageItem.packageId, relatedConfigurationId: packageItem.cadRevisionHash, authorSource: "USER" } });
  return attachment;
}
export async function updateSeatInputPackage(args: Access & { packageId: string; fields: EngineeringInputField[] }) {
  const prior = await getSeatInputPackage(args);
  if (immutable(prior)) throw new Error("SEAT_INPUT_PACKAGE_RELEASED_IMMUTABLE");
  const now = new Date().toISOString();
  const base = { entityType: prior.entityType, packageId: prior.packageId, projectId: prior.projectId, seatDesignId: prior.seatDesignId, seatRevisionId: prior.seatRevisionId, cadRevisionHash: prior.cadRevisionHash, cadArtifactHash: prior.cadArtifactHash, fields: args.fields };
  return persist(args, { ...base, status: "DRAFT", requiredInputs: [], packageHash: packageHash(base), createdAt: prior.createdAt, updatedAt: now });
}
export async function validateSeatInputPackage(args: Access & { packageId: string }) {
  const prior = await getSeatInputPackage(args);
  const attachments = (await attachmentRecords(args)).map(({ item }) => item).filter((item) => item.packageId === prior.packageId);
  const requiredInputs = assess(prior.fields, attachments);
  if (!await hasCadArtifactBinding(args, prior)) requiredInputs.push("CAD_ARTIFACT_BINDING");
  const next: SeatEngineeringInputPackage = { ...prior, status: requiredInputs.length ? "REQUIRED_INPUT" : "REVIEW", requiredInputs, updatedAt: new Date().toISOString() };
  return persist(args, next);
}
export async function approveSeatInputPackage(args: Access & { packageId: string }) {
  const prior = await validateSeatInputPackage(args);
  if (prior.requiredInputs.length) throw new Error("SEAT_INPUT_PACKAGE_REQUIRED_INPUT");
  if (prior.fields.some((field) => field.approvalStatus !== "APPROVED")) throw new Error("SEAT_INPUT_PACKAGE_FIELD_APPROVAL_REQUIRED");
  return persist(args, { ...prior, status: "APPROVED", updatedAt: new Date().toISOString() });
}
export async function releaseSeatInputPackage(args: Access & { packageId: string }) {
  const prior = await getSeatInputPackage(args);
  if (prior.status !== "APPROVED") throw new Error("SEAT_INPUT_PACKAGE_APPROVAL_REQUIRED");
  return persist(args, { ...prior, status: "RELEASED", releasedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}
