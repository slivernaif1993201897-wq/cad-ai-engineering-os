import { createHash } from "node:crypto";

export const MACHINE_CAM_STATUSES = [
  "CAM_GENERATED",
  "TOOLPATH_VERIFIED",
  "GCODE_VERIFIED",
  "MACHINE_SIMULATED",
  "MACHINE_TRIAL_REQUIRED",
  "MACHINE_CERTIFIED",
] as const;
export type MachineCamStatus = (typeof MACHINE_CAM_STATUSES)[number];
export type CheckState = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export type MachineProfile = {
  machineId: string; machineType: "3_AXIS_MILL" | "5_AXIS_MILL" | "LATHE"; axes: string[];
  travelLimitsMm: { x: number; y: number; z: number }; spindleLimitsRpm: { min: number; max: number };
  feedLimitsMmMin: { min: number; max: number }; rapidLimitMmMin: number;
  controller: { identity: string; version: string }; postProcessor: string;
  coordinateConventions: string; workOffsetBehavior: string; toolChangeBehavior: string;
  safetyConstraints: string[]; revision: string; active: boolean;
};
export type ToolingRecord = {
  toolId: string; toolType: "END_MILL" | "DRILL" | "FACE_MILL"; diameterMm: number; fluteCount: number;
  lengthMm: number; holder: string; stickoutMm: number; material: string;
  spindleLimitsRpm: { min: number; max: number }; feedLimitsMmMin: { min: number; max: number }; provenance: string;
};
export type FixtureStock = {
  stockId: string; stockMm: { x: number; y: number; z: number }; fixture: string; clamps: string[];
  workholding: string; machineTable: string; keepOutZones: string[]; collisionAnalysisSupported: boolean; revision: string;
};
export type CamVerification = {
  axisTravel: CheckState; toolpathSimulation: CheckState; toolFixtureCollision: CheckState;
  holderCollision: CheckState; stockCollision: CheckState; rapidMoves: CheckState; spindleFeedLimits: CheckState;
  unsupportedCommands: CheckState; controllerValidation: CheckState; postValidation: CheckState; gcodeSyntax: CheckState;
};
export type MachineCamInput = {
  cadRevision: string; camOperation: string; machine: MachineProfile; tooling: ToolingRecord; fixture: FixtureStock;
  selectedController: string; selectedPost: string; generatedToolpathHash: string; gcode: string; gcodeHash: string;
  verification: CamVerification; capturedMachineRevision: string; capturedToolProvenance: string;
};
export type MachineCamResult = {
  status: MachineCamStatus; releaseAllowed: boolean; machineCertified: false; blockers: string[];
  verification: CamVerification; provenance: {
    cadRevision: string; camOperation: string; machineId: string; machineRevision: string; toolId: string;
    fixtureId: string; postProcessor: string; generatedToolpathHash: string; gcodeHash: string;
  };
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const finitePositive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function validateTooling(tool: Partial<ToolingRecord>): string[] {
  const required: (keyof ToolingRecord)[] = ["toolId", "toolType", "diameterMm", "fluteCount", "lengthMm", "holder", "stickoutMm", "material", "provenance"];
  const blockers = required.filter((key) => !tool[key]).map((key) => `INVALID_TOOL_${String(key).toUpperCase()}`);
  if (!finitePositive(tool.diameterMm) || (tool.diameterMm ?? 0) > 100) blockers.push("INVALID_TOOL_DIAMETER");
  if (!Number.isInteger(tool.fluteCount) || (tool.fluteCount ?? 0) < 1) blockers.push("INVALID_TOOL_FLUTES");
  if (!finitePositive(tool.lengthMm) || !finitePositive(tool.stickoutMm) || (tool.stickoutMm ?? 0) > (tool.lengthMm ?? 0)) blockers.push("INVALID_TOOL_GEOMETRY");
  if (!tool.holder?.trim()) blockers.push("INVALID_HOLDER");
  return blockers;
}

export function validateFixtureStock(fixture: Partial<FixtureStock>): string[] {
  const blockers: string[] = [];
  if (!fixture.stockId || !fixture.fixture || !fixture.workholding || !fixture.machineTable || !fixture.revision) blockers.push("INVALID_FIXTURE_DEFINITION");
  if (!fixture.clamps?.length) blockers.push("INVALID_FIXTURE_CLAMPS");
  if (!fixture.keepOutZones?.length) blockers.push("INVALID_FIXTURE_KEEP_OUT_ZONES");
  if (fixture.collisionAnalysisSupported !== true) blockers.push("FIXTURE_COLLISION_ANALYSIS_UNSUPPORTED");
  return blockers;
}

export function validateGcodeAgainstController(gcode: string, controller: string, post: string): string[] {
  const blockers: string[] = [];
  if (!/^%[\s\S]*M30\n%$/.test(gcode.trim())) blockers.push("MALFORMED_GCODE");
  if (/\b(G05\.1|G43\.4|M198|G28|G53)\b/.test(gcode)) blockers.push("UNSUPPORTED_GCODE_COMMAND");
  if (!gcode.includes(`; CONTROLLER:${controller}`)) blockers.push("CONTROLLER_MISMATCH");
  if (!gcode.includes(`; POST:${post}`)) blockers.push("POST_MISMATCH");
  return blockers;
}

export function evaluateMachineCamRelease(input: MachineCamInput): MachineCamResult {
  const blockers: string[] = [];
  blockers.push(...validateTooling(input.tooling), ...validateFixtureStock(input.fixture));
  if (!input.cadRevision.trim()) blockers.push("STALE_CAD_REVISION");
  if (!input.machine.active || input.machine.revision !== input.capturedMachineRevision) blockers.push("STALE_MACHINE_PROFILE");
  if (input.tooling.provenance !== input.capturedToolProvenance) blockers.push("STALE_TOOLING");
  if (input.selectedController !== input.machine.controller.identity) blockers.push("CONTROLLER_MISMATCH");
  if (input.selectedPost !== input.machine.postProcessor) blockers.push("POST_MISMATCH");
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.gcodeHash) || input.gcodeHash !== `sha256:${sha256(input.gcode)}`) blockers.push("GCODE_HASH_MISMATCH");
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.generatedToolpathHash)) blockers.push("TOOLPATH_HASH_MISSING");
  blockers.push(...validateGcodeAgainstController(input.gcode, input.selectedController, input.selectedPost));
  for (const [name, state] of Object.entries(input.verification)) if (state !== "PASS") blockers.push(`${name.toUpperCase()}_${state}`);
  const releaseAllowed = blockers.length === 0;
  return {
    status: releaseAllowed ? "MACHINE_TRIAL_REQUIRED" : "CAM_GENERATED",
    releaseAllowed,
    machineCertified: false,
    blockers: [...new Set(blockers)],
    verification: input.verification,
    provenance: {
      cadRevision: input.cadRevision, camOperation: input.camOperation, machineId: input.machine.machineId,
      machineRevision: input.machine.revision, toolId: input.tooling.toolId, fixtureId: input.fixture.stockId,
      postProcessor: input.machine.postProcessor, generatedToolpathHash: input.generatedToolpathHash, gcodeHash: input.gcodeHash,
    },
  };
}

export function canMachineBeCertified(result: MachineCamResult, externalPhysicalEvidence: boolean): boolean {
  return result.releaseAllowed && externalPhysicalEvidence === true;
}
