export type RuntimeAssuranceGateId = "G0_APPROVED_TEST_ENVIRONMENT" | "G1_REAL_SANDBOX" | "G2_ESCAPE_RESISTANCE" | "G3_RESOURCE_ISOLATION" | "G4_REAL_GMSH" | "G5_MESH_VERIFICATION" | "G6_REAL_CALCULIX" | "G7_NUMERICAL_VALIDATION" | "G8_RESULT_INTEGRITY" | "G9_HOSTILE_SECURITY_TESTING" | "G10_FAILURE_RECOVERY" | "G11_REPRODUCIBILITY" | "G12_INDEPENDENT_REVIEW" | "G13_PRODUCTION_READINESS";
export type RuntimeAssuranceGateState = "PASS" | "FAIL" | "UNKNOWN" | "BLOCKED" | "INCONCLUSIVE";
export type RuntimeAssuranceReadiness = "NOT_READY" | "BLOCKED" | "READY_FOR_EXTERNAL_REVIEW" | "PRODUCTION_READY";
export type AssuranceEvidenceScope = "INTERNAL_VERIFIED" | "INDEPENDENTLY_VERIFIED" | "EXTERNAL_REVIEW_REQUIRED";

export interface RuntimeAssuranceEnvironment {
  environmentRecordId: string;
  projectId: string;
  environmentId: string;
  imageBaseline: string;
  operatingSystem: string;
  kernel: string;
  cpuLimit: string;
  memoryLimit: string;
  storageLimit: string;
  networkPolicy: string;
  timeoutPolicy: string;
  environmentHash: string;
  provenance: string[];
  approvalState: "APPROVED" | "UNKNOWN" | "REVOKED" | "EXPIRED";
  approvalScope: AssuranceEvidenceScope;
  approvedByReviewerId?: string;
  reviewerAuthorizationId?: string;
  validFrom: string;
  validUntil: string;
  observedEvidenceHash: string;
  recordOnly: true;
  executionEligible: false;
  executable: false;
  createdAt: string;
}

export interface RuntimeAssuranceObservedTest {
  assuranceTestId: string;
  projectId: string;
  gateId: RuntimeAssuranceGateId;
  testId: string;
  evidenceScope: AssuranceEvidenceScope;
  evidenceOrigin: "EXTERNAL_OBSERVED" | "INTERNAL_TEST" | "FUTURE_DEFINITION";
  environmentId: string;
  performerIdentity: string;
  reviewerId?: string;
  reviewerAuthorizationId?: string;
  expectedBehavior: string;
  observedBehavior: string;
  inputHash: string;
  rawEvidenceHash: string;
  result: RuntimeAssuranceGateState;
  timestamp: string;
  limitations: string[];
  recordOnly: true;
  executionEligible: false;
  executable: false;
  createdAt: string;
}

export interface RuntimeAssuranceFailure {
  failureId: string;
  projectId: string;
  gateId: RuntimeAssuranceGateId;
  rootCauseId: string;
  classification: "CODE" | "DATA" | "ARCHITECTURE" | "SECURITY" | "INFRASTRUCTURE" | "NUMERICAL" | "EVIDENCE" | "GOVERNANCE" | "EXTERNAL_DEPENDENCY";
  observedEvidenceIds: string[];
  rootCauseSummary: string;
  remainingRisk: string;
  state: "OPEN" | "RETEST_REQUIRED" | "ROOT_CAUSE_ESCALATION" | "CLOSED";
  immutable: true;
  createdAt: string;
}

export interface RuntimeAssuranceRepairAttempt {
  repairAttemptId: string;
  projectId: string;
  failureId: string;
  rootCauseId: string;
  repairStrategy: string;
  attemptCount: number;
  targetedTestReference: string;
  regressionStatus: "NOT_RUN" | "PASS" | "FAIL" | "UNKNOWN";
  result: "REPAIRED" | "NOT_REPAIRED" | "BLOCKED" | "INCONCLUSIVE";
  evidence: string[];
  escalationRequired: boolean;
  immutable: true;
  createdAt: string;
}

export interface RuntimeAssuranceGateAssessment {
  gateId: RuntimeAssuranceGateId;
  dependencies: RuntimeAssuranceGateId[];
  state: RuntimeAssuranceGateState;
  determination: "OBSERVED_INDEPENDENT_EVIDENCE" | "DEPENDENCY_BLOCKED" | "EVIDENCE_MISSING" | "EXTERNAL_INFRASTRUCTURE_BLOCKED" | "CONFLICT_OR_INVALIDITY";
  evidenceIds: string[];
  missingEvidence: string[];
  internalEvidenceIds: string[];
  externalReviewRequired: boolean;
}

export interface RuntimeAssuranceAssessment {
  assessmentId: string;
  projectId: string;
  gates: RuntimeAssuranceGateAssessment[];
  readiness: RuntimeAssuranceReadiness;
  criticalBlockers: string[];
  internalVerificationDoesNotAuthorizeProduction: true;
  externalReviewRequired: boolean;
  executionEligible: false;
  executable: false;
  createdAt: string;
}

export interface RuntimeAssuranceReviewPackage {
  packageId: string;
  projectId: string;
  assessment: RuntimeAssuranceAssessment;
  requiredSections: Array<"SANDBOX" | "ESCAPE" | "RESOURCE" | "GMSH" | "MESH" | "CALCULIX" | "NUMERICAL" | "RESULT_INTEGRITY" | "HOSTILE" | "FAILURE_RECOVERY" | "REPRODUCIBILITY" | "SBOM" | "AUDIT" | "ENVIRONMENT">;
  presentEvidenceIds: string[];
  missingSections: string[];
  independentReviewerRequired: true;
  selfApprovalProhibited: true;
  productionAuthorization: false;
  createdAt: string;
}
