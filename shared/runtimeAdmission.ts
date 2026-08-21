/**
 * Admission records describe an evaluated request only. They never authorize,
 * spawn, queue, or execute a process. Actual execution must remain outside the
 * application boundary and requires all independently observed assurance gates.
 */
export type RuntimeAdmissionAction = "GMSH_MESH" | "CALCULIX_SOLVE";
export type RuntimeAdmissionState = "REJECTED" | "BLOCKED";
export type RuntimeAdmissionReasonCode = "CANONICAL_JOB_MISSING" | "SOLVER_INPUT_PACKAGE_MISSING" | "PACKAGE_JOB_MISMATCH" | "SOLVER_CONFIGURATION_MISSING" | "PACKAGE_CONFIGURATION_MISMATCH" | "ENVIRONMENT_MISSING" | "ENVIRONMENT_EVIDENCE_NOT_CURRENT" | "ENVIRONMENT_NOT_INDEPENDENTLY_APPROVED" | "RUNTIME_ASSURANCE_GATES_NOT_PASS" | "EXECUTION_ENGINE_NOT_IMPLEMENTED";

export interface RuntimeAdmissionDecision {
  admissionDecisionId: string;
  projectId: string;
  requestedAction: RuntimeAdmissionAction;
  canonicalJobId: string;
  solverInputPackageId: string;
  configurationId: string;
  environmentId: string;
  state: RuntimeAdmissionState;
  reasonCodes: RuntimeAdmissionReasonCode[];
  reasons: string[];
  referencedAssessmentId?: string;
  decisionHash: string;
  recordOnly: true;
  executionStarted: false;
  executionEligible: false;
  executable: false;
  createdAt: string;
}
