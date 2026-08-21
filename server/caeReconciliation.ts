import { createHash } from "node:crypto";

import type {
  CalibrationRecord,
  DatasetProcessingRecord,
  EngineeringReviewDecision,
  MaterialEvidence,
  MaterialPropertyReconciliation,
  MeasurementDataQualityAssessment,
  MeasurementDataset,
  MeasurementDatasetMetadata,
} from "../shared/cae";
import { listExperimentalValidationPlans, listMaterialEvidence } from "./caeEvidence";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";
import { storagePut } from "./storage";

type ProjectAccess = { projectId: string; accessKey: string };
type DatasetInput = ProjectAccess & {
  fileName: string;
  mimeType?: string;
  base64: string;
  experimentId?: string;
  simulationId?: string;
  metadata: MeasurementDatasetMetadata;
};

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const MAX_DATASET_BYTES = 5 * 1024 * 1024;
const key = (value?: string) => value?.trim().toLowerCase().replace(/\s+/g, " ") || "UNKNOWN";
const unitMap: Record<string, { dimension: string; factor: number; canonical: string }> = {
  pa: { dimension: "PRESSURE", factor: 1, canonical: "Pa" },
  kpa: { dimension: "PRESSURE", factor: 1e3, canonical: "Pa" },
  mpa: { dimension: "PRESSURE", factor: 1e6, canonical: "Pa" },
  gpa: { dimension: "PRESSURE", factor: 1e9, canonical: "Pa" },
  "n/mm2": { dimension: "PRESSURE", factor: 1e6, canonical: "Pa" },
  "kg/m3": { dimension: "DENSITY", factor: 1, canonical: "kg/m3" },
  "g/cm3": { dimension: "DENSITY", factor: 1e3, canonical: "kg/m3" },
  "1": { dimension: "DIMENSIONLESS", factor: 1, canonical: "1" },
  dimensionless: { dimension: "DIMENSIONLESS", factor: 1, canonical: "1" },
};

function parse<T>(content: string): T | undefined {
  try { return JSON.parse(content) as T; } catch { return undefined; }
}
async function authorize(args: ProjectAccess) {
  return openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
}
async function records<T>(args: ProjectAccess, kind: string): Promise<T[]> {
  await authorize(args);
  return (await projectMemorySnapshot(args)).records
    .filter((record) => record.kind === kind)
    .flatMap((record) => { const item = parse<T>(record.content); return item ? [item] : []; });
}
function safeBytes(base64: string) {
  const clean = base64.replace(/\s/g, "");
  if (!clean || clean.length > Math.ceil(MAX_DATASET_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("Measurement dataset payload is invalid or exceeds the 5 MiB bounded envelope.");
  const data = Buffer.from(clean, "base64");
  if (!data.length || data.length > MAX_DATASET_BYTES || data.toString("base64").replace(/=+$/, "") !== clean.replace(/=+$/, "")) throw new Error("Measurement dataset bytes failed integrity validation.");
  return data;
}
function safeName(value: string) { return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 255) || "dataset.bin"; }
function normalize(value?: number, unit?: string) {
  if (value === undefined || !unit) return undefined;
  const entry = unitMap[unit.trim().toLowerCase().replace(/\s/g, "")];
  return entry ? { value: value * entry.factor, unit: entry.canonical, dimension: entry.dimension } : undefined;
}
function allSame(values: Array<string | undefined>) { return new Set(values.map(key)).size <= 1; }

export async function reconcileMaterialProperty(args: ProjectAccess & { material: string; property: MaterialEvidence["property"] }): Promise<MaterialPropertyReconciliation> {
  const evidence = (await listMaterialEvidence(args)).filter((item) => key(item.material) === key(args.material) && item.property === args.property);
  const candidates = evidence.map((item) => {
    const normalized = normalize(item.value, item.unit);
    return {
      evidenceId: item.evidenceId, property: item.property, value: item.value, unit: item.unit,
      ...(normalized ? { normalizedValue: normalized.value, normalizedUnit: normalized.unit } : {}),
      condition: item.condition, source: item.source, sourceHash: item.sha256, provenance: item.provenance,
      verificationStatus: item.verificationStatus, measurementUncertainty: item.measurementUncertainty,
      temperature: item.temperature, strainRate: item.strainRate, direction: item.direction,
      batch: item.batch, date: item.measurementDate ?? item.sourceDate,
    };
  });
  const conflicts: MaterialPropertyReconciliation["conflicts"] = [];
  if (candidates.length > 1) {
    const evidenceIds = candidates.map((item) => item.evidenceId);
    const normalizedValues = candidates.map((item) => normalize(item.value, item.unit));
    const dimensions = new Set(normalizedValues.map((item) => item?.dimension ?? "UNKNOWN"));
    if (dimensions.size > 1 || dimensions.has("UNKNOWN")) conflicts.push({ kind: "UNIT_CONFLICT", statement: "Units are missing, unsupported, or describe different dimensions; no automatic conversion or selection occurred.", evidenceIds });
    else {
      const values = normalizedValues.map((item) => item?.value).filter((item): item is number => item !== undefined);
      if (values.length !== candidates.length || values.some((value) => Math.abs(value - values[0]) > Math.max(1e-12, Math.abs(values[0]) * 1e-9))) conflicts.push({ kind: "VALUE_CONFLICT", statement: "Normalized values disagree; no candidate was selected automatically.", evidenceIds });
    }
    if (!allSame(candidates.map((item) => item.condition))) conflicts.push({ kind: "CONDITION_CONFLICT", statement: "Evidence conditions differ; no value can be treated as interchangeable without human review.", evidenceIds });
    if (!allSame(evidence.map((item) => item.materialGrade))) conflicts.push({ kind: "MATERIAL_GRADE_CONFLICT", statement: "Material-grade metadata differs or is unknown across evidence sources.", evidenceIds });
    if (!allSame(candidates.map((item) => item.source))) conflicts.push({ kind: "SOURCE_CONFLICT", statement: "Independent evidence sources differ; source disagreement remains visible.", evidenceIds });
    if (!allSame(candidates.map((item) => item.measurementUncertainty))) conflicts.push({ kind: "MEASUREMENT_UNCERTAINTY_CONFLICT", statement: "Measurement uncertainty differs or is unknown across evidence sources.", evidenceIds });
  }
  const signature = createHash("sha256").update(`${args.projectId}|${key(args.material)}|${args.property}|${candidates.map((item) => item.sourceHash).sort().join("|")}`).digest("hex").slice(0, 20);
  const reconciliationId = `MATERIAL-RECONCILIATION-${signature}`;
  const decisions = await records<EngineeringReviewDecision>(args, "CAE_REVIEW_DECISION");
  const decision = decisions.filter((item) => item.reconciliationId === reconciliationId).sort((a, b) => b.revision - a.revision)[0];
  const state = decision?.decision === "RESOLVE" ? "RESOLVED" as const : decision?.decision === "REJECT" ? "REJECTED" as const : conflicts.length ? "CONFLICT" as const : candidates.length ? "CONSISTENT" as const : "UNKNOWN" as const;
  const result: MaterialPropertyReconciliation = { reconciliationId, projectId: args.projectId, material: args.material.trim(), property: args.property, candidates, conflicts, state, ...(decision ? { decisionId: decision.decisionId, selectedValue: decision.selectedValue, selectedUnit: decision.selectedUnit } : {}), revision: candidates.length, createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_MATERIAL_RECONCILIATION", title: `Material reconciliation · ${result.material} · ${result.property} · ${state}`, content: JSON.stringify(result), truthStatus: state === "RESOLVED" ? "DERIVED" : "UNVERIFIED", validationStage: "CONCEPTUAL", authorSource: "SYSTEM" } });
  return result;
}

export async function recordEngineeringReviewDecision(args: ProjectAccess & { reconciliationId: string; reviewer: string; reviewerRole?: string; decision: EngineeringReviewDecision["decision"]; selectedValue?: number; selectedUnit?: string; reason: string; evidenceIds: string[]; revision: number }): Promise<EngineeringReviewDecision> {
  await authorize(args);
  if (!args.reviewer.trim() || !args.reason.trim() || !args.evidenceIds.length) throw new Error("A human reviewer, reason, and one or more evidence references are required. The system cannot approve evidence automatically.");
  if (args.decision === "RESOLVE" && (args.selectedValue === undefined || !args.selectedUnit?.trim())) throw new Error("A resolved material conflict requires an explicit human-selected value and unit.");
  const reconciliation = (await records<MaterialPropertyReconciliation>(args, "CAE_MATERIAL_RECONCILIATION")).find((item) => item.reconciliationId === args.reconciliationId);
  if (!reconciliation) throw new Error("The requested reconciliation is not available in the authorized project.");
  if (!args.evidenceIds.every((item) => reconciliation.candidates.some((candidate) => candidate.evidenceId === item))) throw new Error("A review decision can reference only evidence in its authorized reconciliation.");
  const decision: EngineeringReviewDecision = { decisionId: id("ENGINEERING-REVIEW"), projectId: args.projectId, reconciliationId: args.reconciliationId, reviewer: args.reviewer.trim(), reviewerRole: args.reviewerRole?.trim() || undefined, decision: args.decision, selectedValue: args.selectedValue, selectedUnit: args.selectedUnit?.trim() || undefined, reason: args.reason.trim(), evidenceIds: args.evidenceIds, timestamp: new Date().toISOString(), revision: args.revision, authorType: "HUMAN" };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_REVIEW_DECISION", title: `Human evidence decision · ${decision.decision} · ${decision.reconciliationId}`, content: JSON.stringify(decision), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "USER" } });
  return decision;
}

function invalidQuality(message: string): MeasurementDataQualityAssessment {
  return { status: "INVALID", columnNames: [], missingValues: 0, duplicateSamples: 0, timestampsPresent: false, samplingConsistency: "UNKNOWN", unitsPresent: false, rangeAnomalies: [], findings: [message] };
}
function assessDatasetQuality(buffer: Buffer, fileName: string): MeasurementDataQualityAssessment {
  const lower = fileName.toLowerCase();
  const text = buffer.toString("utf8");
  let headers: string[] = [];
  let rows: string[][] = [];
  try {
    if (lower.endsWith(".json")) {
      const parsed = JSON.parse(text);
      const samples = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
      if (!samples.length || typeof samples[0] !== "object") return invalidQuality("JSON does not contain a non-empty array of object samples.");
      headers = Object.keys(samples[0]);
      rows = samples.map((sample: Record<string, unknown>) => headers.map((header) => String(sample[header] ?? "")));
    } else if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
      const delimiter = lower.endsWith(".tsv") ? "\t" : ",";
      const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length);
      if (lines.length < 2) return invalidQuality("Dataset requires a header and at least one sample row for structural quality checks.");
      headers = lines[0].split(delimiter).map((item) => item.trim());
      rows = lines.slice(1).map((line) => line.split(delimiter).map((item) => item.trim()));
    } else {
      return { status: "UNVERIFIED", columnNames: [], missingValues: 0, duplicateSamples: 0, timestampsPresent: false, samplingConsistency: "UNKNOWN", unitsPresent: false, rangeAnomalies: [], findings: ["Raw bytes are preserved. This file type is not deterministically parsed for structural quality checks."] };
    }
  } catch { return invalidQuality("Dataset parsing failed; raw bytes were not modified."); }
  const missingValues = rows.reduce((count, row) => count + row.filter((cell) => !cell).length, 0);
  const duplicateSamples = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size;
  const timeIndex = headers.findIndex((header) => /^(time|timestamp|datetime)$/i.test(header));
  const times = timeIndex >= 0 ? rows.map((row) => Number(row[timeIndex])) : [];
  const deltas = times.length && times.every(Number.isFinite) ? times.slice(1).map((time, index) => time - times[index]) : [];
  const samplingConsistency = !deltas.length ? "UNKNOWN" as const : deltas.every((item) => item === deltas[0]) ? "CONSISTENT" as const : "INCONSISTENT" as const;
  const rangeAnomalies = rows.flatMap((row, rowIndex) => row.flatMap((cell, columnIndex) => /^[-+]?\d/.test(cell) && !Number.isFinite(Number(cell)) ? [`Row ${rowIndex + 1}, ${headers[columnIndex] ?? "column"} is not finite.`] : [])).slice(0, 20);
  const status = missingValues ? "INCOMPLETE" : duplicateSamples || samplingConsistency === "INCONSISTENT" || rangeAnomalies.length ? "INCONSISTENT" : "UNVERIFIED";
  return { status, rowCount: rows.length, columnNames: headers, missingValues, duplicateSamples, timestampsPresent: timeIndex >= 0, samplingConsistency, unitsPresent: headers.some((header) => /\[.+\]|\(.+\)|unit/i.test(header)), rangeAnomalies, findings: ["Structural checks do not establish scientific validity, calibration, or measurement accuracy."] };
}

export async function ingestMeasurementDataset(input: DatasetInput): Promise<MeasurementDataset> {
  await authorize(input);
  const data = safeBytes(input.base64);
  if (input.experimentId && input.simulationId) {
    const experiments = await listExperimentalValidationPlans({ ...input, simulationId: input.simulationId });
    if (!experiments.some((item) => item.experimentId === input.experimentId)) throw new Error("The measurement dataset can link only to an experiment in the authorized simulation context.");
  }
  const fileName = safeName(input.fileName);
  const fileHash = createHash("sha256").update(data).digest("hex");
  const existing = (await records<MeasurementDataset>(input, "CAE_MEASUREMENT_DATASET")).find((item) => item.fileHash === fileHash);
  if (existing) return existing;
  const storage = await storagePut(`engineering-projects/${input.projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}/measurement-datasets/${fileHash}/${fileName}`, data, input.mimeType ?? "application/octet-stream");
  const dataset: MeasurementDataset = { datasetId: id("MEASUREMENT-DATASET"), projectId: input.projectId, experimentId: input.experimentId, simulationId: input.simulationId, fileName, mimeType: input.mimeType ?? "application/octet-stream", fileSizeBytes: data.length, fileHash, storage, metadata: input.metadata, quality: assessDatasetQuality(data, fileName), stage: "RAW", truthCategory: input.metadata.provenance === "MEASURED" ? "MEASURED" : "UNKNOWN", createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: input.projectId, accessKey: input.accessKey, record: { kind: "CAE_MEASUREMENT_DATASET", title: `Raw measurement dataset · ${dataset.fileName}`, content: JSON.stringify(dataset), truthStatus: dataset.truthCategory === "MEASURED" ? "FACT" : "UNVERIFIED", validationStage: "CONCEPTUAL", relatedConfigurationId: input.metadata.testRevision, authorSource: "USER" } });
  return dataset;
}
export async function listMeasurementDatasets(args: ProjectAccess & { simulationId?: string }) {
  return (await records<MeasurementDataset>(args, "CAE_MEASUREMENT_DATASET")).filter((item) => !args.simulationId || item.simulationId === args.simulationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createDatasetProcessingRecord(args: ProjectAccess & { datasetId: string; parentRecordId?: string; stage: Exclude<DatasetProcessingRecord["stage"], "RAW">; transformation: string; evidenceIds: string[] }): Promise<DatasetProcessingRecord> {
  const dataset = (await listMeasurementDatasets(args)).find((item) => item.datasetId === args.datasetId);
  if (!dataset) throw new Error("The raw dataset is unavailable in the authorized project.");
  if (!args.transformation.trim()) throw new Error("A processing lineage record requires an explicit transformation description; original raw bytes remain immutable.");
  const record: DatasetProcessingRecord = { recordId: id("DATASET-PROCESS"), projectId: args.projectId, datasetId: dataset.datasetId, parentRecordId: args.parentRecordId, stage: args.stage, transformation: args.transformation.trim(), sourceHash: dataset.fileHash, evidenceIds: args.evidenceIds, truthCategory: "DERIVED", createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_DATASET_PROCESSING", title: `Dataset processing · ${record.stage} · ${dataset.fileName}`, content: JSON.stringify(record), truthStatus: "DERIVED", validationStage: "CONCEPTUAL", authorSource: "USER" } });
  return record;
}
export async function listDatasetProcessing(args: ProjectAccess & { datasetId: string }) { return (await records<DatasetProcessingRecord>(args, "CAE_DATASET_PROCESSING")).filter((item) => item.datasetId === args.datasetId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
export async function recordCalibration(args: ProjectAccess & Omit<CalibrationRecord, "calibrationId" | "projectId" | "createdAt">): Promise<CalibrationRecord> {
  await authorize(args);
  if (args.status === "CALIBRATED" && !args.evidenceIds.length) throw new Error("An instrument cannot be claimed calibrated without one or more calibration evidence references.");
  const record: CalibrationRecord = { calibrationId: id("CALIBRATION"), projectId: args.projectId, datasetId: args.datasetId, instrument: args.instrument.trim() || "UNKNOWN", calibrationDate: args.calibrationDate, calibrationSource: args.calibrationSource, certificateReference: args.certificateReference, validFrom: args.validFrom, validUntil: args.validUntil, uncertainty: args.uncertainty, status: args.status, evidenceIds: args.evidenceIds, truthCategory: args.status === "CALIBRATED" ? "DERIVED" : "UNKNOWN", createdAt: new Date().toISOString() };
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_CALIBRATION", title: `Calibration record · ${record.instrument} · ${record.status}`, content: JSON.stringify(record), truthStatus: record.status === "CALIBRATED" ? "DERIVED" : "UNKNOWN", validationStage: "CONCEPTUAL", authorSource: "USER" } });
  return record;
}
export async function listCalibrationRecords(args: ProjectAccess & { datasetId?: string }) { return (await records<CalibrationRecord>(args, "CAE_CALIBRATION")).filter((item) => !args.datasetId || item.datasetId === args.datasetId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
