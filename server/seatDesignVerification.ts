import { createHash } from "node:crypto";

import { generateSeatCadArtifact, type SeatCadArtifact, type SeatParametricModel } from "./seatCadEngine";
import { createSeatCaeConfiguration, type SeatCaeInput, type SeatCaeConfiguration } from "./seatCaeModel";
import { admitSeatValidation, type SeatValidationAdmission, type SeatValidationInputs } from "./seatValidationAdmission";

export const SEAT_VERIFICATION_STATES = [
  "REQUIRED_INPUT",
  "READY_FOR_EXECUTION",
  "RUNNING",
  "MESH_VALIDATED",
  "SOLVER_COMPLETED",
  "VALIDATED",
  "COMPUTED_RESULT_NOT_REFERENCE_VALIDATED",
  "FAILED",
  "SECURITY_BLOCKED",
] as const;

export type SeatVerificationState = (typeof SEAT_VERIFICATION_STATES)[number];

export type SeatVerificationCoordinateBindings = {
  fixtureCoordinateFrameId?: string;
  mountFixtureCoordinatesMm?: Record<string, [number, number, number]>;
  loadReferenceId?: string;
  loadRegionCoordinatesMm?: Record<string, [number, number, number]>;
  materialCertificateId?: string;
  boundaryVerificationId?: string;
};

export type SeatDesignVerificationRequest = {
  seatModel: SeatParametricModel;
  expectedCadRevisionHash?: string;
  expectedCadArtifactHash?: string;
  caeInput?: SeatCaeInput;
  coordinateBindings?: SeatVerificationCoordinateBindings;
  validationReference?: SeatValidationInputs["reference"];
};

export type SeatDesignVerificationCase = {
  verificationId: string;
  seatRevisionId: string;
  state: SeatVerificationState;
  requiredInputs: string[];
  cadArtifact: Pick<SeatCadArtifact, "cadRevisionHash" | "artifactHash" | "stepByteLength" | "kernel" | "validationStatus" | "featureTree">;
  caeConfiguration?: Pick<SeatCaeConfiguration, "caeConfigurationHash" | "status" | "reason" | "requiredInputs">;
  validationAdmission?: SeatValidationAdmission;
  runtimeDispatch: { status: "NOT_DISPATCHED"; reason: string };
  reportStatus: "NO_SOLVER_RESULT" | "COMPUTED_RESULT_NOT_REFERENCE_VALIDATED" | "VALIDATED_RESULT";
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unique = (items: string[]) => [...new Set(items)].sort();
const hasCoordinates = (values: Record<string, [number, number, number]> | undefined, ids: string[]) => Boolean(values && ids.every((id) => values[id]?.length === 3 && values[id].every(Number.isFinite)));

function missingCaeContract(request: SeatDesignVerificationRequest) {
  const input = request.caeInput;
  if (!input) return ["MATERIAL_PROPERTIES", "MOUNT_FIXTURES", "LOAD_REGIONS", "BOUNDARY_CONDITIONS", "MESH_CONFIGURATION", "SOLVER_CONFIGURATION"];
  const missing: string[] = [];
  if (!input.material?.source?.trim() || !Number.isFinite(input.material.elasticModulusMpa) || input.material.elasticModulusMpa <= 0 || !Number.isFinite(input.material.poissonRatio)) missing.push("MATERIAL_PROPERTIES");
  if (!input.mountFixtures?.length) missing.push("MOUNT_FIXTURES");
  if (!input.loadRegions?.length) missing.push("LOAD_REGIONS");
  if (!input.boundaryCondition?.fixtureDescription?.trim() || !input.boundaryCondition?.source?.trim()) missing.push("BOUNDARY_CONDITIONS");
  if (!input.mesh?.source?.trim() || !Number.isFinite(input.mesh.sizeMm) || input.mesh.sizeMm <= 0) missing.push("MESH_CONFIGURATION");
  if (!input.solver?.version?.trim()) missing.push("SOLVER_CONFIGURATION");
  return missing;
}

function missingCoordinateContract(request: SeatDesignVerificationRequest) {
  const bindings = request.coordinateBindings;
  const input = request.caeInput;
  if (!input) return ["FIXTURE_COORDINATE_FRAME_ID", "MOUNT_FIXTURE_COORDINATES", "LOAD_REFERENCE_ID", "LOAD_REGION_COORDINATES", "MATERIAL_CERTIFICATE_ID", "BOUNDARY_VERIFICATION_ID"];
  const missing: string[] = [];
  if (!bindings?.fixtureCoordinateFrameId?.trim()) missing.push("FIXTURE_COORDINATE_FRAME_ID");
  if (!hasCoordinates(bindings?.mountFixtureCoordinatesMm, input.mountFixtures.map((fixture) => fixture.id))) missing.push("MOUNT_FIXTURE_COORDINATES");
  if (!bindings?.loadReferenceId?.trim()) missing.push("LOAD_REFERENCE_ID");
  if (!hasCoordinates(bindings?.loadRegionCoordinatesMm, input.loadRegions.map((region) => region.id))) missing.push("LOAD_REGION_COORDINATES");
  if (!bindings?.materialCertificateId?.trim()) missing.push("MATERIAL_CERTIFICATE_ID");
  if (!bindings?.boundaryVerificationId?.trim()) missing.push("BOUNDARY_VERIFICATION_ID");
  return missing;
}

/**
 * Generates the genuine Seat CAD artifact and binds only caller-supplied engineering inputs.
 * It does not dispatch Gmsh or CalculiX: the current authoritative runtime has no admitted
 * compound-seat solver model or model-specific reference criterion.
 */
export async function buildSeatDesignVerificationCase(request: SeatDesignVerificationRequest): Promise<SeatDesignVerificationCase> {
  const artifact = await generateSeatCadArtifact(request.seatModel);
  const bindingErrors = [
    ...(request.expectedCadRevisionHash && request.expectedCadRevisionHash !== artifact.cadRevisionHash ? ["STALE_CAD_REVISION"] : []),
    ...(request.expectedCadArtifactHash && request.expectedCadArtifactHash !== artifact.artifactHash ? ["CAD_ARTIFACT_HASH_MISMATCH"] : []),
  ];
  if (bindingErrors.length) {
    return {
      verificationId: `SEAT_VERIFICATION-${hash({ seatRevisionId: artifact.seatRevisionId, artifactHash: artifact.artifactHash, bindingErrors }).slice(0, 24)}`,
      seatRevisionId: artifact.seatRevisionId,
      state: "SECURITY_BLOCKED",
      requiredInputs: bindingErrors,
      cadArtifact: { cadRevisionHash: artifact.cadRevisionHash, artifactHash: artifact.artifactHash, stepByteLength: artifact.stepByteLength, kernel: artifact.kernel, validationStatus: artifact.validationStatus, featureTree: artifact.featureTree },
      runtimeDispatch: { status: "NOT_DISPATCHED", reason: "CAD revision or artifact binding is stale or mismatched; CAE configuration and solver dispatch are blocked." },
      reportStatus: "NO_SOLVER_RESULT",
    };
  }
  const required = [...missingCaeContract(request), ...missingCoordinateContract(request)];
  let configuration: SeatCaeConfiguration | undefined;
  let admission: SeatValidationAdmission | undefined;

  if (!required.length && request.caeInput) {
    try {
      configuration = createSeatCaeConfiguration(artifact, request.caeInput);
      admission = admitSeatValidation({
        seatRevisionHash: artifact.cadRevisionHash,
        cadArtifactHash: artifact.artifactHash,
        caeConfigurationHash: configuration.caeConfigurationHash,
        fixtureCoordinateFrameId: request.coordinateBindings?.fixtureCoordinateFrameId,
        loadReferenceId: request.coordinateBindings?.loadReferenceId,
        materialCertificateId: request.coordinateBindings?.materialCertificateId,
        boundaryVerificationId: request.coordinateBindings?.boundaryVerificationId,
        reference: request.validationReference,
      });
      required.push(...configuration.requiredInputs, ...(admission.status === "REQUIRED_INPUT" ? admission.requiredInputs : []));
    } catch (error) {
      required.push(error instanceof Error ? error.message : "SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
    }
  }

  const requiredInputs = unique(required);
  const criterionOnlyBlocked = requiredInputs.length > 0 && requiredInputs.every((field) => field === "SEAT_MODEL_SPECIFIC_VALIDATION_CRITERION" || field === "SEAT_VALIDATION_REFERENCE_SOLUTION" || field === "MODEL_SPECIFIC_REFERENCE_CRITERION");
  const state: SeatVerificationState = requiredInputs.length ? "REQUIRED_INPUT" : "READY_FOR_EXECUTION";
  const reason = requiredInputs.length
    ? criterionOnlyBlocked
      ? "Static solver inputs are explicit, but no model-specific reference criterion is supplied; no validation PASS claim is available."
      : "Explicit own-seat engineering inputs are incomplete; solver dispatch is fail-closed."
    : "All explicit caller-supplied inputs are bound. The compound-seat Gmsh/CalculiX runtime requires an admitted seat-specific execution model and is not dispatched by this service.";

  return {
    verificationId: `SEAT_VERIFICATION-${hash({ seatRevisionId: artifact.seatRevisionId, artifactHash: artifact.artifactHash, caeConfigurationHash: configuration?.caeConfigurationHash, requiredInputs }).slice(0, 24)}`,
    seatRevisionId: artifact.seatRevisionId,
    state,
    requiredInputs,
    cadArtifact: { cadRevisionHash: artifact.cadRevisionHash, artifactHash: artifact.artifactHash, stepByteLength: artifact.stepByteLength, kernel: artifact.kernel, validationStatus: artifact.validationStatus, featureTree: artifact.featureTree },
    caeConfiguration: configuration ? { caeConfigurationHash: configuration.caeConfigurationHash, status: configuration.status, reason: configuration.reason, requiredInputs: configuration.requiredInputs } : undefined,
    validationAdmission: admission,
    runtimeDispatch: { status: "NOT_DISPATCHED", reason },
    reportStatus: "NO_SOLVER_RESULT",
  };
}
