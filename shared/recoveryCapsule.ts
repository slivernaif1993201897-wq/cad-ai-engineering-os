export const RECOVERY_CAPSULE_VERSION = "CAPRE_FULL_MD_V1";

export type RecoveryCapsulePayloadStatus = "INCLUDED" | "EXTERNAL_REQUIRED" | "EXCLUDED_SECRET";
export type RecoveryCapsulePayloadEncoding = "BASE64" | "NONE";
export type RecoveryCapsuleDomain = "SOURCE" | "CONFIGURATION" | "DATABASE" | "MANAGED_ARTIFACTS" | "ENGINE" | "GIT" | "TEST_EVIDENCE" | "RECOVERY_METADATA";

export type RecoveryCapsulePayload = {
  logicalPath: string;
  domain: RecoveryCapsuleDomain;
  status: RecoveryCapsulePayloadStatus;
  encoding: RecoveryCapsulePayloadEncoding;
  sizeBytes: number;
  sha256: string;
  detail: string;
};

export type RecoveryCapsuleManifest = {
  capsuleVersion: typeof RECOVERY_CAPSULE_VERSION;
  capsuleId: string;
  createdAt: string;
  repositoryHead: string;
  branch: string;
  worktreeState: "CLEAN" | "DIRTY";
  sourceManifestSha256: string;
  databaseManifestSha256: string;
  artifactManifestSha256: string;
  engineManifestSha256: string;
  configManifestSha256: string;
  testManifestSha256: string;
  completePayloadManifestSha256: string;
  capsuleContentSha256: string;
  selfContainedCompleteness: "COMPLETE" | "PARTIAL";
  sourceIncluded: boolean;
  databaseIncluded: boolean;
  managedArtifactsIncluded: boolean;
  engineManifestIncluded: boolean;
  gitStateIncluded: boolean;
  testEvidenceIncluded: boolean;
  secretsIncluded: false;
  memoryRepeat: "NOT_PROVEN";
  memoryClassification: "ENVIRONMENT-BOUNDED / PROCESS_LOCAL_NATIVE_WASM_RETENTION_SUSPECTED";
  externalPrerequisites: string[];
  payloads: RecoveryCapsulePayload[];
};

export type RecoveryCapsuleExport = {
  capsulePath: string;
  capsuleSizeBytes: number;
  capsuleSha256: string;
  manifest: RecoveryCapsuleManifest;
};

export type RecoveryCapsuleVerification = {
  status: "PASS" | "FAIL";
  capsuleContentSha256?: string;
  payloadCount: number;
  failures: string[];
};

export type RecoveryCapsuleRestore = {
  stagingPath: string;
  sourceRestore: "PASS" | "FAIL";
  databaseRestore: "PASS" | "FAIL" | "BLOCKED";
  artifactRestore: "PASS" | "FAIL" | "BLOCKED";
  manifestRestore: "PASS" | "FAIL";
  hashRestore: "PASS" | "FAIL";
  status: "PASS" | "FAIL" | "PARTIAL";
  limitations: string[];
};
