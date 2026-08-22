import type { MountingBlockInput } from "./cad";
import type { AuthorizedRuntimeCAEConfiguration } from "../server/caeAgent";
import type { ControlledUserJobManifest } from "./controlledUserJob";
import type { CADConfiguration, CADExport } from "./cadAgent";
import type { RequirementSet } from "./requirements";
import type { RuntimeEvidencePayload } from "../server/signedRuntimeEvidence";

export const ENGINEERING_JOB_STATES = [
  "QUEUED", "VALIDATING", "CAD_GENERATING", "CAD_VALIDATED", "CAE_CONFIGURED", "ADMITTED",
  "MESHING", "MESH_VALIDATED", "SOLVING", "VALIDATING_RESULT", "SUCCEEDED", "FAILED",
  "REJECTED", "CANCELLED", "TIMEOUT", "SECURITY_BLOCKED",
] as const;

export type EngineeringJobState = typeof ENGINEERING_JOB_STATES[number];
export type EngineeringJobEvent = { id: string; state: EngineeringJobState; reason: string; createdAt: string; evidenceReferences: string[] };
export type EngineeringJobRequest = { name: string; sourceText: string; mountingBlock: MountingBlockInput };
export type EngineeringJob = {
  jobId: string;
  projectId: string;
  request: EngineeringJobRequest;
  state: EngineeringJobState;
  requirementSet?: RequirementSet;
  cad?: { revisionId: string; revisionHash: string; artifactHash: string; stepExport: Pick<CADExport, "fileName" | "byteLength" | "validationStatus"> };
  caeConfiguration?: AuthorizedRuntimeCAEConfiguration;
  manifest?: ControlledUserJobManifest;
  runtimeEvidence?: Pick<RuntimeEvidencePayload, "evidenceId" | "evidenceHash" | "environmentIdentity" | "commit" | "workflowRun" | "issuedAt" | "expiresAt"> & {
    gmshHash: string;
    meshHash: string;
    calculixHash: string;
    inputHash: string;
    outputHash: string;
    resultHash: string;
    executionLogHash: string;
  };
  runtimeDispatch: { status: "NOT_DISPATCHED" | "ADMITTED_TO_CI_BOUNDARY" | "COMPLETED" | "REJECTED"; reason: string };
  events: EngineeringJobEvent[];
  createdAt: string;
  updatedAt: string;
};

export type EngineeringJobComposition = {
  requirementSet: RequirementSet;
  configuration: CADConfiguration;
  stepExport: CADExport;
  stepBytes: Buffer;
  caeConfiguration: AuthorizedRuntimeCAEConfiguration;
  manifest: ControlledUserJobManifest;
};
