import { createHash } from "crypto";
import { z } from "zod";

export const CONTROLLED_USER_JOB_MANIFEST_VERSION = "1.0.0" as const;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hash.");
const boundedId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}$/, "Expected a bounded identifier without a path, URL, command, or whitespace.");
const timestamp = z.string().datetime({ offset: true });

const solverConfiguration = z.object({
  configurationId: boundedId,
  configurationHash: sha256,
  solverId: z.enum(["GMSH", "CALCULIX"]),
  solverVersion: boundedId,
}).strict();

const environment = z.object({
  environmentId: boundedId,
  environmentHash: sha256,
  approvalEvidenceHash: sha256,
  executionClass: z.enum(["GITHUB_HOSTED_CI", "INTERNAL_DOCKER_TEST", "APPROVED_SEGREGATED_ENVIRONMENT"]),
}).strict();

const resourcePolicy = z.object({
  policyId: boundedId,
  policyHash: sha256,
  limits: z.object({
    cpuMilliCores: z.number().int().positive().max(64000),
    memoryMiB: z.number().int().positive().max(1048576),
    storageMiB: z.number().int().positive().max(1048576),
    processCount: z.number().int().positive().max(4096),
    runtimeSeconds: z.number().int().positive().max(86400),
    inputBytes: z.number().int().positive().max(1073741824),
    outputBytes: z.number().int().positive().max(1073741824),
    artifactBytes: z.number().int().positive().max(1073741824),
  }).strict(),
}).strict();

const authorization = z.object({
  authorizationId: boundedId,
  authorizationEvidenceHash: sha256,
  validFrom: timestamp,
  validUntil: timestamp,
  status: z.literal("AUTHORIZED"),
}).strict();

export const controlledUserJobManifestSchema = z.object({
  manifestVersion: z.literal(CONTROLLED_USER_JOB_MANIFEST_VERSION),
  jobId: boundedId,
  projectId: boundedId,
  cadRevision: boundedId,
  cadHash: sha256,
  caePlanRevision: boundedId,
  caePlanHash: sha256,
  materialRevision: boundedId,
  materialHash: sha256,
  loadRevision: boundedId,
  loadHash: sha256,
  boundaryConditionRevision: boundedId,
  boundaryConditionHash: sha256,
  meshConfiguration: solverConfiguration.extend({ solverId: z.literal("GMSH") }),
  solverConfiguration: solverConfiguration.extend({ solverId: z.literal("CALCULIX") }),
  environment,
  resourcePolicy,
  expectedArtifacts: z.array(z.enum(["ADMISSION_RECEIPT", "EXECUTION_LOG", "PROVENANCE_BUNDLE", "MESH", "MESH_VERIFICATION", "SOLVER_RESULT", "NUMERICAL_VALIDATION"])).min(3).max(7),
  validationPolicy: z.object({ policyId: boundedId, policyHash: sha256 }).strict(),
  authorization,
  manifestHash: sha256,
}).strict();

export type ControlledUserJobManifest = z.infer<typeof controlledUserJobManifestSchema>;
export type ControlledUserJobAdmissionState = "REJECTED" | "BLOCKED" | "INTERNAL_TEST_ADMITTED";
export type ControlledUserJobAdmissionReason =
  | "MANIFEST_SCHEMA_INVALID"
  | "MANIFEST_HASH_MISMATCH"
  | "MANIFEST_AUTHORIZATION_INVALID"
  | "UNKNOWN_SOLVER_CONFIGURATION"
  | "GITHUB_HOSTED_SANDBOX_INSUFFICIENT"
  | "APPROVED_EXECUTION_ENVIRONMENT_REQUIRED"
  | "INTERNAL_DOCKER_PREFLIGHT_REQUIRED"
  | "EXECUTION_ENGINE_NOT_IMPLEMENTED";

export interface ControlledUserJobAdmissionReceipt {
  receiptVersion: "1.0.0";
  jobId?: string;
  projectId?: string;
  manifestHash?: string;
  state: ControlledUserJobAdmissionState;
  reasonCodes: ControlledUserJobAdmissionReason[];
  executionStarted: boolean;
  genericSolverExecutionStarted: boolean;
  createdAt: string;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateControlledUserJobManifestHash(manifest: Omit<ControlledUserJobManifest, "manifestHash"> | ControlledUserJobManifest): string {
  const { manifestHash: _ignored, ...body } = manifest as ControlledUserJobManifest;
  return createHash("sha256").update(canonicalize(body)).digest("hex");
}

export function validateControlledUserJobManifest(candidate: unknown, observedAt = new Date()): ControlledUserJobManifest {
  const manifest = controlledUserJobManifestSchema.parse(candidate);
  if (manifest.meshConfiguration.solverVersion !== "4.12.1" || manifest.solverConfiguration.solverVersion !== "2.21") {
    throw new Error("UNKNOWN_SOLVER_CONFIGURATION");
  }
  if (new Set(manifest.expectedArtifacts).size !== manifest.expectedArtifacts.length) {
    throw new Error("MANIFEST_SCHEMA_INVALID: expected artifacts must be unique.");
  }
  const calculated = calculateControlledUserJobManifestHash(manifest);
  if (calculated !== manifest.manifestHash) throw new Error("MANIFEST_HASH_MISMATCH");
  const validFrom = Date.parse(manifest.authorization.validFrom);
  const validUntil = Date.parse(manifest.authorization.validUntil);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validFrom > observedAt.getTime() || validUntil < observedAt.getTime() || validFrom > validUntil) {
    throw new Error("MANIFEST_AUTHORIZATION_INVALID");
  }
  return manifest;
}

export function admitControlledUserJob(candidate: unknown, observedAt = new Date()): ControlledUserJobAdmissionReceipt {
  const createdAt = observedAt.toISOString();
  try {
    const manifest = validateControlledUserJobManifest(candidate, observedAt);
    const common = { receiptVersion: "1.0.0" as const, jobId: manifest.jobId, projectId: manifest.projectId, manifestHash: manifest.manifestHash, executionStarted: false as const, genericSolverExecutionStarted: false as const, createdAt };
    if (manifest.environment.executionClass === "GITHUB_HOSTED_CI") {
      return { ...common, state: "BLOCKED", reasonCodes: ["GITHUB_HOSTED_SANDBOX_INSUFFICIENT", "APPROVED_EXECUTION_ENVIRONMENT_REQUIRED", "EXECUTION_ENGINE_NOT_IMPLEMENTED"] };
    }
    if (manifest.environment.executionClass === "INTERNAL_DOCKER_TEST") {
      return { ...common, state: "INTERNAL_TEST_ADMITTED", reasonCodes: ["INTERNAL_DOCKER_PREFLIGHT_REQUIRED"] };
    }
    return { ...common, state: "BLOCKED", reasonCodes: ["EXECUTION_ENGINE_NOT_IMPLEMENTED"] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MANIFEST_SCHEMA_INVALID";
    const reason = (message.split(":")[0] as ControlledUserJobAdmissionReason);
    const known = new Set<ControlledUserJobAdmissionReason>(["MANIFEST_SCHEMA_INVALID", "MANIFEST_HASH_MISMATCH", "MANIFEST_AUTHORIZATION_INVALID", "UNKNOWN_SOLVER_CONFIGURATION"]);
    return { receiptVersion: "1.0.0", state: "REJECTED", reasonCodes: [known.has(reason) ? reason : "MANIFEST_SCHEMA_INVALID"], executionStarted: false, genericSolverExecutionStarted: false, createdAt };
  }
}
