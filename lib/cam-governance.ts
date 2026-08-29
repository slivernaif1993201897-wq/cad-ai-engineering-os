export const CAM_STATUSES = [
  "CAM_GENERATED",
  "TOOLPATH_VERIFIED",
  "GCODE_VERIFIED",
  "MACHINE_SIMULATED",
  "MACHINE_TRIAL_REQUIRED",
  "MACHINE_CERTIFIED",
] as const;

export type CamStatus = (typeof CAM_STATUSES)[number];
export type CheckState = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export type MachineProfile = {
  machineId: string;
  machineType: "3_AXIS_MILL" | "5_AXIS_MILL" | "LATHE";
  axes: string[];
  travelMm: { x: number; y: number; z: number };
  spindleRpm: { min: number; max: number };
  feedMmMin: { min: number; max: number };
  rapidMmMin: number;
  controller: { identity: string; version: string };
  postProcessor: string;
  coordinateConventions: string;
  workOffsetBehavior: string;
  toolChangeBehavior: string;
  safetyConstraints: string[];
  revision: string;
  active: boolean;
};

export type ToolRecord = {
  toolId: string;
  toolType: "END_MILL" | "DRILL" | "FACE_MILL";
  diameterMm: number;
  fluteCount: number;
  lengthMm: number;
  holder: string;
  stickoutMm: number;
  material: string;
  spindleRpm: { min: number; max: number };
  feedMmMin: { min: number; max: number };
  provenance: string;
};

export type FixtureStockModel = {
  stockId: string;
  stock: { x: number; y: number; z: number };
  fixture: string;
  clamps: string[];
  table: string;
  keepOutZones: string[];
  collisionAnalysisSupported: boolean;
  revision: string;
};

export type VerificationChecks = {
  travel: CheckState;
  toolFixtureCollision: CheckState;
  holderCollision: CheckState;
  stockCollision: CheckState;
  rapidMoves: CheckState;
  spindleFeed: CheckState;
  controllerCommands: CheckState;
  controllerMatch: CheckState;
  postMatch: CheckState;
  gcodeSyntax: CheckState;
};

export type CamReleaseInput = {
  cadRevision: string;
  machine: MachineProfile;
  tool: ToolRecord;
  fixture: FixtureStockModel;
  selectedController: string;
  selectedPost: string;
  gcode: string;
  gcodeHash: string;
  verification: VerificationChecks;
  generatedAt: string;
  machineProfileRevisionAtGeneration: string;
  toolingProvenanceAtGeneration: string;
};

export type CamReleaseResult = {
  status: CamStatus;
  releaseAllowed: boolean;
  machineCertified: false;
  checks: VerificationChecks;
  provenance: {
    cadRevision: string;
    camOperation: string;
    machineId: string;
    machineProfileRevision: string;
    toolId: string;
    fixtureId: string;
    postProcessor: string;
    gcodeHash: string;
  };
  blockers: string[];
};

const requiredToolKeys: (keyof ToolRecord)[] = ["toolId", "toolType", "diameterMm", "fluteCount", "lengthMm", "holder", "stickoutMm", "material", "provenance"];

export function validateTool(tool: Partial<ToolRecord>): string[] {
  const blockers = requiredToolKeys.filter((key) => !tool[key]).map((key) => `TOOL_MISSING_${String(key).toUpperCase()}`);
  if (typeof tool.diameterMm !== "number" || tool.diameterMm <= 0) blockers.push("TOOL_INVALID_DIAMETER");
  if (typeof tool.fluteCount !== "number" || tool.fluteCount < 1) blockers.push("TOOL_INVALID_FLUTE_COUNT");
  if (typeof tool.stickoutMm === "number" && typeof tool.lengthMm === "number" && tool.stickoutMm > tool.lengthMm) blockers.push("TOOL_INVALID_STICKOUT");
  if (!tool.holder?.trim()) blockers.push("HOLDER_INVALID");
  return blockers;
}

export function validateFixture(fixture: Partial<FixtureStockModel>): string[] {
  const blockers: string[] = [];
  if (!fixture.stockId || !fixture.fixture || !fixture.table || !fixture.revision) blockers.push("FIXTURE_INCOMPLETE");
  if (!fixture.clamps?.length) blockers.push("FIXTURE_CLAMPS_MISSING");
  if (!fixture.keepOutZones?.length) blockers.push("FIXTURE_KEEP_OUT_MISSING");
  if (fixture.collisionAnalysisSupported !== true) blockers.push("FIXTURE_COLLISION_ANALYSIS_UNSUPPORTED");
  return blockers;
}

export function validateGcode(gcode: string, controller: string, post: string): string[] {
  const blockers: string[] = [];
  if (!gcode.trim() || !/^%[\s\S]*M30[\s\S]*%$/.test(gcode.trim())) blockers.push("GCODE_MALFORMED");
  if (/\b(G05\.1|G43\.4|M198)\b/.test(gcode)) blockers.push("GCODE_UNSUPPORTED_CONTROLLER_COMMAND");
  if (!gcode.includes(`; CONTROLLER:${controller}`)) blockers.push("CONTROLLER_MISMATCH");
  if (!gcode.includes(`; POST:${post}`)) blockers.push("POST_MISMATCH");
  return blockers;
}

export function evaluateCamRelease(input: CamReleaseInput): CamReleaseResult {
  const blockers: string[] = [];
  const toolBlockers = validateTool(input.tool);
  const fixtureBlockers = validateFixture(input.fixture);
  blockers.push(...toolBlockers, ...fixtureBlockers);
  if (!input.machine.active || input.machine.revision !== input.machineProfileRevisionAtGeneration) blockers.push("STALE_MACHINE_PROFILE");
  if (!input.tool.provenance || input.tool.provenance !== input.toolingProvenanceAtGeneration) blockers.push("STALE_TOOLING");
  if (input.selectedController !== input.machine.controller.identity) blockers.push("CONTROLLER_MISMATCH");
  if (input.selectedPost !== input.machine.postProcessor) blockers.push("POST_MISMATCH");
  blockers.push(...validateGcode(input.gcode, input.selectedController, input.selectedPost));
  const failedChecks = Object.entries(input.verification).filter(([, state]) => state !== "PASS").map(([name, state]) => `${name.toUpperCase()}_${state}`);
  blockers.push(...failedChecks);
  if (!input.cadRevision.trim()) blockers.push("STALE_CAD_REVISION");
  if (!input.gcodeHash.trim()) blockers.push("GCODE_HASH_MISSING");

  const allChecksPass = Object.values(input.verification).every((state) => state === "PASS");
  const releaseAllowed = blockers.length === 0 && allChecksPass;
  return {
    status: releaseAllowed ? "MACHINE_TRIAL_REQUIRED" : input.verification.travel === "PASS" ? "CAM_GENERATED" : "CAM_GENERATED",
    releaseAllowed,
    machineCertified: false,
    checks: input.verification,
    provenance: {
      cadRevision: input.cadRevision,
      camOperation: "OP-10 / controlled toolpath",
      machineId: input.machine.machineId,
      machineProfileRevision: input.machine.revision,
      toolId: input.tool.toolId,
      fixtureId: input.fixture.stockId,
      postProcessor: input.machine.postProcessor,
      gcodeHash: input.gcodeHash,
    },
    blockers: [...new Set(blockers)],
  };
}

export const demoMachine: MachineProfile = {
  machineId: "HAAS-VF2-001",
  machineType: "3_AXIS_MILL",
  axes: ["X", "Y", "Z"],
  travelMm: { x: 762, y: 406, z: 508 },
  spindleRpm: { min: 100, max: 8100 },
  feedMmMin: { min: 1, max: 12000 },
  rapidMmMin: 18000,
  controller: { identity: "HAAS-NGC", version: "100.22.000.1020" },
  postProcessor: "haas-ngc-v2",
  coordinateConventions: "G54 work offset; Z-positive away from table",
  workOffsetBehavior: "Explicit G54; no implicit offset changes",
  toolChangeBehavior: "M06 requires tool identity and spindle stop",
  safetyConstraints: ["Door interlock required", "Dry-run before first cut", "No unattended first-run"],
  revision: "machine-rev-2026-08-29-a",
  active: true,
};

export const demoTool: ToolRecord = {
  toolId: "T06-EM-10",
  toolType: "END_MILL",
  diameterMm: 10,
  fluteCount: 3,
  lengthMm: 63,
  holder: "ER20-10MM",
  stickoutMm: 28,
  material: "carbide",
  spindleRpm: { min: 3000, max: 8100 },
  feedMmMin: { min: 120, max: 1800 },
  provenance: "tooling-register://T06-EM-10/rev-4",
};

export const demoFixture: FixtureStockModel = {
  stockId: "STOCK-6061-100x60x25",
  stock: { x: 100, y: 60, z: 25 },
  fixture: "Vise-160mm / soft jaws",
  clamps: ["Left fixed jaw", "Right movable jaw"],
  table: "T-slot table 16mm",
  keepOutZones: ["Jaw envelope Z<12mm", "Clamp sweep X=20..80mm"],
  collisionAnalysisSupported: true,
  revision: "fixture-rev-2026-08-29-b",
};
