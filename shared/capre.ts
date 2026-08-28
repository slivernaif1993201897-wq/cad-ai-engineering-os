/**
 * CAD-AGENT Protected Recovery Engine (CAPRE) contracts.
 *
 * A CAPRE record distinguishes a local, process-bound recovery snapshot from
 * an externally durable backup. It does not grant production promotion.
 */

export const CAPRE_VERSION = "1.0.0";

export type CapreDurabilityClass = "LOCAL_EPHEMERAL" | "LOCAL_PERSISTENT" | "EXTERNAL_DURABLE";
export type CapreCheckpointClass = "UNPROTECTED_LOCAL_SNAPSHOT" | "VERIFIED_CHECKPOINT" | "GOLDEN_RELEASE_BASELINE";
export type CapreProtectionStatus = "PROTECTED" | "UNPROTECTED";
export type CapreDurableStorageStatus = "AVAILABLE" | "UNAVAILABLE";
export type CapreResetSurvivalStatus = "PROVEN" | "NOT_PROVEN";
export type CapreAuthoritativeRecoveryStatus = "COMPLETE" | "INCOMPLETE" | "UNAVAILABLE";
export type CapreStateIdentityStatus = "YES" | "NO" | "NOT_PROVEN";
export type CapreIntegrityStatus = "PASS" | "FAIL" | "NOT_RUN" | "BLOCKED";
export type CapreRestoreStatus = "NOT_RUN" | "STAGING_RESTORED" | "VERIFYING" | "PASS" | "FAIL" | "BLOCKED";
export type CapreInventoryClassification =
  | "SOURCE"
  | "CONFIGURATION"
  | "DATABASE_SCHEMA"
  | "PERSISTENT_APPLICATION_DATA"
  | "MANAGED_ARTIFACTS"
  | "ENGINE_IDENTITIES"
  | "TEST_EVIDENCE"
  | "ACCEPTANCE_EVIDENCE"
  | "RECOVERY_METADATA";

export type CapreManifestFile = {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
  fileType: string;
  classification: CapreInventoryClassification;
};

export type CapreSecretPrerequisite = {
  secretName: string;
  secretRequired: true;
  secretPresent: boolean;
  secretValue: "NEVER_EXPORTED";
};

export type CapreEngineIdentity = {
  name: string;
  status: "READY" | "UNAVAILABLE" | "NOT_PROBED";
  version?: string;
  executablePath?: string;
  environmentHash?: string;
  details: string;
};

export type CapreHealthGate = {
  status: "NOT_RUN" | "PASS" | "FAIL";
  checks: Array<{ name: string; status: "PASS" | "FAIL" | "NOT_RUN"; detail: string }>;
  memoryRepeat: "NOT_PROVEN";
  memoryClassification: "ENVIRONMENT-BOUNDED / PROCESS_LOCAL_NATIVE_WASM_RETENTION_SUSPECTED";
};

export type CapreCheckpointManifest = {
  capreManifestVersion: "CAPRE_MANIFEST_V1";
  capreVersion: string;
  checkpointId: string;
  checkpointClass: CapreCheckpointClass;
  createdAt: string;
  parentCheckpointId?: string;
  durabilityClass: CapreDurabilityClass;
  protectionStatus: CapreProtectionStatus;
  durableStorageStatus: CapreDurableStorageStatus;
  resetSurvivalStatus: CapreResetSurvivalStatus;
  authoritativeRecoveryStatus: CapreAuthoritativeRecoveryStatus;
  testedStateEqualsCommittedStateEqualsCheckpointState: CapreStateIdentityStatus;
  immutableStatus: "SEALED_READ_ONLY";
  repositoryIdentity: string;
  repositoryHead: string;
  branch: string;
  worktreeState: "CLEAN" | "DIRTY";
  uncommittedChangesIncluded: false;
  sourceManifestSha256: string;
  artifactManifestSha256: string;
  databaseManifestSha256: string;
  engineManifestSha256: string;
  testManifestSha256: string;
  completeManifestSha256: string;
  healthGate: CapreHealthGate;
  restoreVerificationStatus: "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";
  secretPrerequisites: CapreSecretPrerequisite[];
  files: CapreManifestFile[];
  exclusions: string[];
  recoveryLimitations: string[];
};

export type CapreDiscovery = {
  repositoryRoot: string;
  repositoryHead: string;
  branch: string;
  worktreeState: "CLEAN" | "DIRTY";
  trackedFileCount: number;
  untrackedFiles: string[];
  deletedFiles: string[];
  submodules: string[];
  durabilityClass: CapreDurabilityClass;
  durableBackupAvailable: boolean;
  protectionStatus: CapreProtectionStatus;
  durableStorageStatus: CapreDurableStorageStatus;
  resetSurvivalStatus: CapreResetSurvivalStatus;
  authoritativeRecoveryStatus: CapreAuthoritativeRecoveryStatus;
  testedStateEqualsCommittedStateEqualsCheckpointState: CapreStateIdentityStatus;
  durableStorageDetail: string;
  inventory: Array<{ classification: CapreInventoryClassification; state: "CAPTURED" | "INVENTORIED_ONLY" | "NOT_CAPTURED"; detail: string }>;
  engineIdentities: CapreEngineIdentity[];
  secretPrerequisites: CapreSecretPrerequisite[];
  limitations: string[];
};

export type CapreCheckpointSummary = Pick<
  CapreCheckpointManifest,
  "checkpointId" | "checkpointClass" | "createdAt" | "parentCheckpointId" | "durabilityClass" | "protectionStatus" | "durableStorageStatus" | "resetSurvivalStatus" | "authoritativeRecoveryStatus" | "testedStateEqualsCommittedStateEqualsCheckpointState" | "repositoryHead" | "branch" | "worktreeState" | "completeManifestSha256" | "immutableStatus" | "restoreVerificationStatus"
>;

export type CapreVerificationResult = {
  checkpointId: string;
  status: CapreIntegrityStatus;
  verifiedAt: string;
  failures: string[];
  verifiedFileCount: number;
  manifestSha256?: string;
};

export type CapreStagingRestore = {
  checkpointId: string;
  stagingId: string;
  stagingPath: string;
  status: CapreRestoreStatus;
  sourceManifestSha256: string;
  limitations: string[];
};

export type CapreRestoreVerification = {
  checkpointId: string;
  stagingId: string;
  status: CapreRestoreStatus;
  checks: Array<{ name: string; status: "PASS" | "FAIL" | "BLOCKED"; detail: string }>;
  failures: string[];
};

export type CapreRecoveryDrill = {
  checkpointId: string;
  capture: CapreIntegrityStatus;
  integrity: CapreIntegrityStatus;
  restore: CapreRestoreStatus;
  verification: CapreRestoreStatus;
  status: "PASS" | "FAIL" | "BLOCKED";
  reason: string;
};
