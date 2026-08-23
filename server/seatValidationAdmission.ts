import { createHash } from "node:crypto";

export type SeatValidationReference = {
  method: "SEAT_MODEL_SPECIFIC_REFERENCE";
  criterionId: string;
  referenceSolutionId: string;
  referenceSolutionHash: string;
  metric: string;
  referenceValue: number;
  tolerance: number;
  source: string;
};

export type SeatValidationInputs = {
  seatRevisionHash: string;
  cadArtifactHash: string;
  caeConfigurationHash: string;
  fixtureCoordinateFrameId?: string;
  loadReferenceId?: string;
  materialCertificateId?: string;
  boundaryVerificationId?: string;
  reference?: SeatValidationReference;
};

export type SeatValidationAdmission = {
  status: "ADMITTED" | "REQUIRED_INPUT";
  requiredInputs: string[];
  validationBindingHash?: string;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isHash = (value: string | undefined) => Boolean(value && /^[a-f0-9]{64}$/.test(value));

/** Does not supply engineering data. It only admits a seat result comparison when the caller provides a fully traceable, model-specific reference criterion. */
export function admitSeatValidation(input: SeatValidationInputs): SeatValidationAdmission {
  const requiredInputs: string[] = [];
  if (!isHash(input.seatRevisionHash)) requiredInputs.push("SEAT_REVISION_HASH");
  if (!isHash(input.cadArtifactHash)) requiredInputs.push("CAD_ARTIFACT_HASH");
  if (!isHash(input.caeConfigurationHash)) requiredInputs.push("CAE_CONFIGURATION_HASH");
  if (!input.fixtureCoordinateFrameId?.trim()) requiredInputs.push("FIXTURE_COORDINATE_FRAME_ID");
  if (!input.loadReferenceId?.trim()) requiredInputs.push("LOAD_REFERENCE_ID");
  if (!input.materialCertificateId?.trim()) requiredInputs.push("MATERIAL_CERTIFICATE_ID");
  if (!input.boundaryVerificationId?.trim()) requiredInputs.push("BOUNDARY_VERIFICATION_ID");
  const reference = input.reference;
  if (!reference || reference.method !== "SEAT_MODEL_SPECIFIC_REFERENCE" || !reference.criterionId.trim() || !reference.referenceSolutionId.trim() || !isHash(reference.referenceSolutionHash) || !reference.metric.trim() || !Number.isFinite(reference.referenceValue) || !Number.isFinite(reference.tolerance) || reference.tolerance <= 0 || !reference.source.trim()) requiredInputs.push("MODEL_SPECIFIC_REFERENCE_CRITERION");
  if (requiredInputs.length) return { status: "REQUIRED_INPUT", requiredInputs };
  return { status: "ADMITTED", requiredInputs: [], validationBindingHash: hash({ seatRevisionHash: input.seatRevisionHash, cadArtifactHash: input.cadArtifactHash, caeConfigurationHash: input.caeConfigurationHash, fixtureCoordinateFrameId: input.fixtureCoordinateFrameId, loadReferenceId: input.loadReferenceId, materialCertificateId: input.materialCertificateId, boundaryVerificationId: input.boundaryVerificationId, reference }) };
}

/** Compares an extracted solver metric only against an admitted, caller-supplied model-specific reference criterion. */
export function validateSeatSolverMetric(admission: SeatValidationAdmission, reference: SeatValidationReference, observedMetric: number) {
  if (admission.status !== "ADMITTED" || !admission.validationBindingHash) throw new Error("SEAT_VALIDATION_NOT_ADMITTED");
  if (!Number.isFinite(observedMetric)) throw new Error("SEAT_SOLVER_METRIC_INVALID");
  const relativeError = Math.abs(observedMetric - reference.referenceValue) / Math.max(Math.abs(reference.referenceValue), Number.EPSILON);
  return { validationStatus: relativeError <= reference.tolerance ? "PASS" as const : "FAIL" as const, method: reference.method, criterionId: reference.criterionId, referenceSolutionId: reference.referenceSolutionId, validationBindingHash: admission.validationBindingHash, observedMetric, referenceValue: reference.referenceValue, relativeError, tolerance: reference.tolerance };
}
