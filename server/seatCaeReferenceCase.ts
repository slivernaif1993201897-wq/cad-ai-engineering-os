import { createHash } from "node:crypto";

import type { OfficialSeatRequirement } from "./seatOfficialReference";

export type RequiredInput = "REQUIRED_INPUT";
export type SeatAxis = "SEAT_X" | "SEAT_Y" | "SEAT_Z" | "NEGATIVE_SEAT_X" | "NEGATIVE_SEAT_Y" | "NEGATIVE_SEAT_Z";

export type SeatCoordinateMapping = {
  id: string;
  vehicleLongitudinalAxis: SeatAxis;
  vehicleLateralAxis: SeatAxis;
  vehicleVerticalAxis: SeatAxis;
  source: string;
};

export type SeatReferenceCase = {
  id: string;
  version: string;
  sourceRequirements: OfficialSeatRequirement[];
  analysisType: "LINEAR_STATIC" | "MODAL";
  coordinateMapping?: SeatCoordinateMapping;
  seatWeightN?: number;
  forwardLoadRegionId?: string;
  rearwardLoadRegionId?: string;
  mountFixtureIds?: string[];
  materialCertificateIds?: string[];
  boundaryConditionIds?: string[];
  meshConfigurationId?: string;
  solverConfigurationId?: string;
  validationCriterionId?: string;
  referencePackageId?: string;
  applicability: string;
};

export type ApprovedReferencePackage = {
  id: string;
  version: string;
  geometryHash: string;
  materialCertificateIds: string[];
  fixtureIds: string[];
  loadIds: string[];
  boundaryIds: string[];
  referenceResult: { metric: string; value: number; unit: string };
  referenceSource: { document: string; sectionOrPage: string; requirementId: string };
  tolerance: number;
  declaredContentHash: string;
};

export type PhysicalCorrelationRecord = {
  id: string;
  seatRevisionHash: string;
  caeConfigurationHash: string;
  experimentalResult?: number;
  simulationResult?: number;
  referenceResult?: number;
  tolerance?: number;
  correlationStatus: "REQUIRED_INPUT" | "NOT_EVALUATED" | "PASS" | "FAIL";
};

export type SeatReferenceAdmission = {
  status: "ADMITTED" | "REQUIRED_INPUT";
  requiredInputs: string[];
  loadCases: Array<{ id: string; direction: "FORWARD_LONGITUDINAL" | "REARWARD_LONGITUDINAL"; multiplier: 20; regionId?: string }>;
  mappingHash?: string;
  referencePackageHash?: string;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isHash = (value: string | undefined) => Boolean(value && /^[a-f0-9]{64}$/.test(value));
const vector = (axis: SeatAxis) => axis.replace("NEGATIVE_", "");

/** Rejects ambiguous or non-right-handed coordinate declarations before CAD-to-CAE mapping. */
export function validateCoordinateMapping(mapping?: SeatCoordinateMapping): string[] {
  if (!mapping?.id.trim() || !mapping.source.trim()) return ["COORDINATE_SYSTEM_MAPPING"];
  const axes = [vector(mapping.vehicleLongitudinalAxis), vector(mapping.vehicleLateralAxis), vector(mapping.vehicleVerticalAxis)];
  return new Set(axes).size === 3 ? [] : ["COORDINATE_SYSTEM_MAPPING"];
}

/** Verifies a content-addressed external package; it does not treat unsigned or altered source data as authoritative. */
export function verifyReferencePackage(reference?: ApprovedReferencePackage): { status: "VERIFIED" | "REQUIRED_INPUT"; requiredInputs: string[]; packageHash?: string } {
  if (!reference) return { status: "REQUIRED_INPUT", requiredInputs: ["APPROVED_REFERENCE_PACKAGE"] };
  const requiredInputs: string[] = [];
  if (!reference.id.trim() || !reference.version.trim() || !isHash(reference.geometryHash)) requiredInputs.push("REFERENCE_GEOMETRY");
  if (!reference.materialCertificateIds.length || !reference.fixtureIds.length || !reference.loadIds.length || !reference.boundaryIds.length) requiredInputs.push("REFERENCE_FIXTURES_LOADS_BOUNDARIES_MATERIAL");
  if (!reference.referenceResult.metric.trim() || !Number.isFinite(reference.referenceResult.value) || !reference.referenceResult.unit.trim()) requiredInputs.push("REFERENCE_RESULT");
  if (!reference.referenceSource.document.trim() || !reference.referenceSource.sectionOrPage.trim() || !reference.referenceSource.requirementId.trim()) requiredInputs.push("REFERENCE_SOURCE");
  if (!Number.isFinite(reference.tolerance) || reference.tolerance <= 0) requiredInputs.push("REFERENCE_TOLERANCE");
  const content = { id: reference.id, version: reference.version, geometryHash: reference.geometryHash, materialCertificateIds: reference.materialCertificateIds, fixtureIds: reference.fixtureIds, loadIds: reference.loadIds, boundaryIds: reference.boundaryIds, referenceResult: reference.referenceResult, referenceSource: reference.referenceSource, tolerance: reference.tolerance };
  if (!isHash(reference.declaredContentHash) || hash(content) !== reference.declaredContentHash) requiredInputs.push("REFERENCE_PACKAGE_INTEGRITY");
  return requiredInputs.length ? { status: "REQUIRED_INPUT", requiredInputs } : { status: "VERIFIED", requiredInputs: [], packageHash: reference.declaredContentHash };
}

/** Builds literal FMVSS 207 static load cases but admits CAE only after every test-rig and validation input is explicitly provided. */
export function admitSeatReferenceCase(referenceCase: SeatReferenceCase, referencePackage?: ApprovedReferencePackage): SeatReferenceAdmission {
  const requiredInputs = [...validateCoordinateMapping(referenceCase.coordinateMapping)];
  if (referenceCase.analysisType !== "LINEAR_STATIC") requiredInputs.push("SUPPORTED_ANALYSIS_TYPE");
  if (!Number.isFinite(referenceCase.seatWeightN) || (referenceCase.seatWeightN ?? 0) <= 0) requiredInputs.push("SEAT_WEIGHT_N");
  if (!referenceCase.forwardLoadRegionId?.trim()) requiredInputs.push("FORWARD_LOAD_REGION_ID");
  if (!referenceCase.rearwardLoadRegionId?.trim()) requiredInputs.push("REARWARD_LOAD_REGION_ID");
  if (!referenceCase.mountFixtureIds?.length) requiredInputs.push("MOUNT_FIXTURES");
  if (!referenceCase.materialCertificateIds?.length) requiredInputs.push("MATERIAL_CERTIFICATES");
  if (!referenceCase.boundaryConditionIds?.length) requiredInputs.push("BOUNDARY_CONDITIONS");
  if (!referenceCase.meshConfigurationId?.trim()) requiredInputs.push("MESH_CONFIGURATION");
  if (!referenceCase.solverConfigurationId?.trim()) requiredInputs.push("SOLVER_CONFIGURATION");
  if (!referenceCase.validationCriterionId?.trim()) requiredInputs.push("VALIDATION_CRITERION");
  const verified = verifyReferencePackage(referencePackage);
  requiredInputs.push(...verified.requiredInputs);
  const loadCases = [
    { id: "FMVSS207-FORWARD-20X", direction: "FORWARD_LONGITUDINAL" as const, multiplier: 20 as const, regionId: referenceCase.forwardLoadRegionId },
    { id: "FMVSS207-REARWARD-20X", direction: "REARWARD_LONGITUDINAL" as const, multiplier: 20 as const, regionId: referenceCase.rearwardLoadRegionId },
  ];
  return requiredInputs.length ? { status: "REQUIRED_INPUT", requiredInputs: [...new Set(requiredInputs)], loadCases } : { status: "ADMITTED", requiredInputs: [], loadCases, mappingHash: hash(referenceCase.coordinateMapping), referencePackageHash: verified.packageHash };
}

export function correlateSeatPhysicalTest(record: Omit<PhysicalCorrelationRecord, "correlationStatus">): PhysicalCorrelationRecord {
  if (![record.experimentalResult, record.simulationResult, record.referenceResult, record.tolerance].every(Number.isFinite) || (record.tolerance ?? 0) <= 0) return { ...record, correlationStatus: "REQUIRED_INPUT" };
  const error = Math.abs((record.simulationResult as number) - (record.referenceResult as number)) / Math.max(Math.abs(record.referenceResult as number), Number.EPSILON);
  return { ...record, correlationStatus: error <= (record.tolerance as number) ? "PASS" : "FAIL" };
}
