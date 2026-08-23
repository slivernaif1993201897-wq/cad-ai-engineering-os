import { createHash } from "node:crypto";

import type { SeatCadArtifact } from "./seatCadEngine";

export type SeatCaeInput = {
  material: { elasticModulusMpa: number; poissonRatio: number; densityKgM3?: number; source: string };
  loadCase: { id: string; forceN: number; direction: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z"; application: string };
  boundaryCondition: { id: string; fixtureDescription: string; fixedDofs: Array<1 | 2 | 3> };
  mesh: { sizeMm: number; elementType: "C3D4"; source: string };
  solver: { id: "CALCULIX"; version: string; analysisType: "LINEAR_STATIC" };
  validation: { criterionId: string; method: string; tolerance: number; source: string };
};

export type SeatCaeConfiguration = {
  seatRevisionId: string;
  cadRevisionHash: string;
  cadArtifactHash: string;
  caeConfigurationHash: string;
  status: "EXPLICIT_INPUTS_VALIDATED" | "NOT_ADMITTED";
  reason?: string;
  input: SeatCaeInput;
};

function sha(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

/** Validates only explicitly supplied CAE data; no material, load, support, or validation assumption is synthesized. */
export function createSeatCaeConfiguration(artifact: SeatCadArtifact, input: SeatCaeInput): SeatCaeConfiguration {
  const invalid = !Number.isFinite(input.material.elasticModulusMpa) || input.material.elasticModulusMpa <= 0 || !Number.isFinite(input.material.poissonRatio) || input.material.poissonRatio <= -1 || input.material.poissonRatio >= 0.5 || !Number.isFinite(input.loadCase.forceN) || input.loadCase.forceN === 0 || !input.loadCase.application.trim() || !input.boundaryCondition.fixtureDescription.trim() || !input.boundaryCondition.fixedDofs.length || !Number.isFinite(input.mesh.sizeMm) || input.mesh.sizeMm <= 0 || !input.validation.criterionId.trim() || !input.validation.method.trim() || !Number.isFinite(input.validation.tolerance) || input.validation.tolerance <= 0;
  if (invalid) throw new Error("SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
  const caeConfigurationHash = sha({ seatRevisionId: artifact.seatRevisionId, cadRevisionHash: artifact.cadRevisionHash, cadArtifactHash: artifact.artifactHash, input });
  return { seatRevisionId: artifact.seatRevisionId, cadRevisionHash: artifact.cadRevisionHash, cadArtifactHash: artifact.artifactHash, caeConfigurationHash, status: "NOT_ADMITTED", reason: "SEAT_CAE_MODEL_SPECIFIC_NUMERICAL_VALIDATION_NOT_IMPLEMENTED: the existing axial cantilever criterion is not valid for this compound seat assembly.", input };
}
