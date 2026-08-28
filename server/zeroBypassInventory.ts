export type ZeroBypassClassification = "EXECUTOR_CONTROLLED" | "RETIRED" | "READ_ONLY" | "VALIDATION_ONLY" | "NON_AUTHORITATIVE";

export type InventoryRecord = {
  path: string;
  classification: ZeroBypassClassification;
  authoritative: boolean;
  route_reachable: boolean;
  executor_controlled: boolean;
  direct_artifact_write: boolean;
  direct_revision_write: boolean;
  direct_provenance_write: boolean;
  direct_lineage_write: boolean;
  verification_basis: readonly string[];
};

export type DiscoveredCandidate = {
  path: string;
  geometry: boolean;
  protectedWrite: boolean;
  approvedBoundary: boolean;
};

export type ResolvedInventoryRecord = InventoryRecord & {
  missing_inventory: boolean;
  stale_inventory: boolean;
  direct_write_violation: boolean;
};

const record = (path: string, classification: ZeroBypassClassification, authoritative: boolean, routeReachable: boolean, executorControlled: boolean, basis: readonly string[]): InventoryRecord => ({ path, classification, authoritative, route_reachable: routeReachable, executor_controlled: executorControlled, direct_artifact_write: false, direct_revision_write: false, direct_provenance_write: false, direct_lineage_write: false, verification_basis: basis });

export const repositoryInventory: readonly InventoryRecord[] = [
  record("server/cadArtifactOperations.ts", "EXECUTOR_CONTROLLED", true, true, true, ["authorized Boolean and Hole operation → managed ingestion"]),
  record("server/cadFileIntelligence.ts", "EXECUTOR_CONTROLLED", true, true, true, ["bounded project-scoped managed ingestion is the shared persistence boundary"]),
  record("server/featureHistory.ts", "EXECUTOR_CONTROLLED", true, true, true, ["authoritative feature STEP promotion → executeAuthorizedFeatureHistoryStep"]),
  record("server/sourceLessCadExecution.ts", "EXECUTOR_CONTROLLED", true, true, true, ["authorized generator bytes → Common Feature Executor completion → managed ingestion"]),
  record("lib/engineering-api.ts", "NON_AUTHORITATIVE", false, false, false, ["client proxy only; no server-side persistence"]),
  record("server/artifactAssembly.ts", "EXECUTOR_CONTROLLED", true, true, true, ["managed artifact lifecycle and verified revision binding"]),
  record("server/cadAgentSkills.ts", "EXECUTOR_CONTROLLED", true, true, true, ["authorized external adapter completion"]),
  record("server/cadExecution.ts", "EXECUTOR_CONTROLLED", true, true, true, ["controlled CAD execution lifecycle"]),
  record("server/capabilityRegistry.ts", "NON_AUTHORITATIVE", false, false, false, ["capability metadata only"]),
  record("server/engineeringJob.ts", "EXECUTOR_CONTROLLED", true, true, true, ["authorized mounting-block completion"]),
  record("server/engineeringJobHttp.ts", "EXECUTOR_CONTROLLED", true, true, true, ["project-authorized HTTP orchestration"]),
  record("server/gmshExecution.ts", "EXECUTOR_CONTROLLED", true, false, true, ["authorized local Gmsh mesh → validated output bytes → managed storage → CAE evidence and lineage"]),
  record("server/calculixExecution.ts", "EXECUTOR_CONTROLLED", true, false, true, ["authorized local CalculiX result → validated FRD bytes → managed storage → CAE evidence and lineage"]),
  record("server/camExecution.ts", "EXECUTOR_CONTROLLED", true, false, true, ["authorized local CAM operation → geometry-derived validated G-code → managed storage → evidence and lineage"]),
  record("server/engineeringViewer.ts", "NON_AUTHORITATIVE", false, false, false, ["display mesh and conceptual state only"]),
  record("server/runtimeAdmission.ts", "NON_AUTHORITATIVE", false, false, false, ["admission governance only; it does not create, promote, or persist a geometry artifact"]),
  record("server/runtimeImplementationReadiness.ts", "VALIDATION_ONLY", false, false, false, ["readiness evidence only"]),
  record("server/seatDesignAuthoring.ts", "EXECUTOR_CONTROLLED", true, true, true, ["concept STEP completion through executor"]),
  record("server/mirrorFeature.ts", "EXECUTOR_CONTROLLED", true, true, true, ["feature-history STEP completion through executor"]),
  record("server/rectangularPattern.ts", "EXECUTOR_CONTROLLED", true, true, true, ["feature-history STEP completion through executor"]),
];

export function resolveRepositoryInventory(discoveredCandidates: readonly DiscoveredCandidate[]): ResolvedInventoryRecord[] {
  const byPath = new Map(repositoryInventory.map((entry) => [entry.path, entry]));
  return discoveredCandidates.map((candidate) => {
    const entry = byPath.get(candidate.path);
    if (!entry) return { ...record(candidate.path, "NON_AUTHORITATIVE", candidate.geometry, false, false, ["missing inventory entry"]), missing_inventory: true, stale_inventory: false, direct_write_violation: candidate.geometry && candidate.protectedWrite };
    const stale = entry.authoritative && entry.classification === "EXECUTOR_CONTROLLED" && !candidate.approvedBoundary;
    const directWriteViolation = entry.authoritative && candidate.protectedWrite && !entry.executor_controlled;
    return { ...entry, missing_inventory: false, stale_inventory: stale, direct_write_violation: directWriteViolation };
  });
}

export function evaluateResolvedInventory(records: readonly ResolvedInventoryRecord[]) {
  const missing_inventory = records.filter((entry) => entry.missing_inventory).length;
  const stale_inventory = records.filter((entry) => entry.stale_inventory).length;
  const unauthorized_paths = records.filter((entry) => entry.direct_write_violation || (entry.authoritative && !entry.executor_controlled && entry.classification !== "RETIRED")).map((entry) => entry.path);
  return { missing_inventory, stale_inventory, unauthorized_paths, pass: missing_inventory === 0 && stale_inventory === 0 && unauthorized_paths.length === 0 };
}
