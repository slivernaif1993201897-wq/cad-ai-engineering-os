import { createHash } from "node:crypto";

import type { SeatCadArtifact } from "./seatCadEngine";

export type SeatCaeInput = {
  material: { elasticModulusMpa: number; poissonRatio: number; densityKgM3?: number; source: string };
  mountFixtures: Array<{ id: string; targetFeatureId: "MOUNT_FL" | "MOUNT_FR" | "MOUNT_RL" | "MOUNT_RR"; fixedDofs: Array<1 | 2 | 3>; source: string }>;
  loadRegions: Array<{ id: string; targetFeatureId: "CUSHION" | "BACK"; forceN: number; direction: "GLOBAL_X" | "GLOBAL_Y" | "GLOBAL_Z"; distribution: "UNIFORM"; source: string }>;
  boundaryCondition: { id: string; fixtureDescription: string; source: string };
  mesh: { sizeMm: number; elementType: "C3D4"; source: string };
  solver: { id: "CALCULIX"; version: string; analysisType: "LINEAR_STATIC" };
  validation: { criterionId: string; method: "REQUIRED_INPUT" | "SEAT_MODEL_SPECIFIC_REFERENCE"; tolerance?: number; referenceSolutionId?: string; referenceSolutionHash?: string; source: string };
};

export type SeatCaeConfiguration = {
  seatRevisionId: string;
  cadRevisionHash: string;
  cadArtifactHash: string;
  caeConfigurationHash: string;
  status: "EXPLICIT_INPUTS_VALIDATED" | "NOT_ADMITTED";
  reason?: string;
  requiredInputs: string[];
  input: SeatCaeInput;
};

function sha(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

/** Validates only explicitly supplied CAE data; no material, load, support, or validation assumption is synthesized. */
export function createSeatCaeConfiguration(artifact: SeatCadArtifact, input: SeatCaeInput): SeatCaeConfiguration {
  const featureIds = new Set(artifact.featureTree.map((feature) => feature.id));
  const invalidMount = !input.mountFixtures.length || input.mountFixtures.some((mount) => !featureIds.has(mount.targetFeatureId) || !mount.fixedDofs.length || new Set(mount.fixedDofs).size !== mount.fixedDofs.length || mount.fixedDofs.some((dof) => ![1, 2, 3].includes(dof)) || !mount.source.trim());
  const invalidLoad = !input.loadRegions.length || input.loadRegions.some((load) => !featureIds.has(load.targetFeatureId) || !Number.isFinite(load.forceN) || load.forceN === 0 || !load.source.trim());
  const invalid = !Number.isFinite(input.material.elasticModulusMpa) || input.material.elasticModulusMpa <= 0 || !Number.isFinite(input.material.poissonRatio) || input.material.poissonRatio <= -1 || input.material.poissonRatio >= 0.5 || invalidMount || invalidLoad || !input.boundaryCondition.fixtureDescription.trim() || !input.boundaryCondition.source.trim() || !Number.isFinite(input.mesh.sizeMm) || input.mesh.sizeMm <= 0 || !input.validation.criterionId.trim() || !input.validation.source.trim();
  if (invalid) throw new Error("SEAT_CAE_EXPLICIT_ENGINEERING_INPUTS_REQUIRED");
  const caeConfigurationHash = sha({ seatRevisionId: artifact.seatRevisionId, cadRevisionHash: artifact.cadRevisionHash, cadArtifactHash: artifact.artifactHash, input });
  const requiredInputs: string[] = [];
  if (input.validation.method === "REQUIRED_INPUT") requiredInputs.push("SEAT_MODEL_SPECIFIC_VALIDATION_CRITERION");
  if (!input.validation.referenceSolutionId || !input.validation.referenceSolutionHash || !Number.isFinite(input.validation.tolerance) || input.validation.tolerance! <= 0) requiredInputs.push("SEAT_VALIDATION_REFERENCE_SOLUTION");
  return { seatRevisionId: artifact.seatRevisionId, cadRevisionHash: artifact.cadRevisionHash, cadArtifactHash: artifact.artifactHash, caeConfigurationHash, status: "NOT_ADMITTED", reason: requiredInputs.length ? "SEAT_CAE_REQUIRED_INPUT" : "SEAT_NUMERICAL_VALIDATOR_NOT_IMPLEMENTED", requiredInputs, input };
}
