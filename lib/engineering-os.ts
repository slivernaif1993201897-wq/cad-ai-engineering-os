export type EvidenceStatus =
  | "NOT_CONNECTED"
  | "UNKNOWN"
  | "BLOCKED"
  | "BLOCKED_EXTERNAL_EVIDENCE"
  | "INTERNAL_RUNTIME_VERIFIED"
  | "REQUIRES_EXTERNAL_REVIEW"
  | "PASS";

export type DetailRecord = {
  id: string;
  eyebrow: string;
  title: string;
  status: EvidenceStatus;
  description: string;
  requiredForPass: string;
};

export const statusPresentation: Record<
  EvidenceStatus,
  { label: string; tone: "neutral" | "warning" | "blocked" | "verified" }
> = {
  NOT_CONNECTED: { label: "Not connected", tone: "neutral" },
  UNKNOWN: { label: "Unknown", tone: "warning" },
  BLOCKED: { label: "Blocked", tone: "blocked" },
  BLOCKED_EXTERNAL_EVIDENCE: { label: "External evidence required", tone: "warning" },
  INTERNAL_RUNTIME_VERIFIED: { label: "Internally verified", tone: "verified" },
  REQUIRES_EXTERNAL_REVIEW: {
    label: "External review required",
    tone: "warning",
  },
  PASS: { label: "Pass", tone: "verified" },
};

export const authoritativeRuntimeEvidence = {
  source: "Retained authoritative CAD Agent-to-CAE Docker bridge evidence",
  commit: "e919c476e3c25dec3d39c842f39f9c13a951e535",
  primaryRun: "32549971601",
  reproducibilityRun: "32548950838",
  environment: "GITHUB-DOCKER-INTERNAL-TEST",
  evidenceHash: "dd2505c1b648fdfbe5050d83f7ddfade86da4dccaa212727c01ed213c24fcc9b",
  resultHash: "24c6e283acedb1639fa9da713cf0ee41c3308cdae9990af6f232ac13228092bb",
  importedAt: "2026-08-22T03:47:00Z",
  testCount: 32,
  failedTests: 0,
  unresolvedFindings: [
    "Approved production environment is not independently evidenced.",
    "Independent security assessment and external review are not attached.",
  ],
} as const;

export const runtimeReadiness = {
  internal: "INTERNAL_RUNTIME_VERIFIED",
  independentAssessment: "READY_FOR_INDEPENDENT_SECURITY_ASSESSMENT",
  externalReview: "READY_FOR_EXTERNAL_REVIEW",
  production: "BLOCKED_EXTERNAL_EVIDENCE",
} as const;

export const cadRecords: DetailRecord[] = [
  {
    id: "cad-source",
    eyebrow: "CAD source",
    title: "Model source",
    status: "NOT_CONNECTED",
    description:
      "No project-scoped CAD source is attached to this local workspace. A source reference must be available before a feature lineage can be assessed.",
    requiredForPass:
      "Connect an authoritative project source with a durable model identifier and provenance record.",
  },
  {
    id: "requirements-binding",
    eyebrow: "Requirements",
    title: "Requirements binding",
    status: "NOT_CONNECTED",
    description:
      "No requirement set has been retrieved. The mobile workspace therefore cannot assert that geometry decisions are requirement-bound.",
    requiredForPass:
      "Retrieve the reviewed requirement records and their binding to the active CAD model source.",
  },
  {
    id: "feature-ledger",
    eyebrow: "Feature history",
    title: "Feature ledger",
    status: "NOT_CONNECTED",
    description:
      "Feature history is intentionally unavailable until an authoritative CAD record is connected. A local card is not a geometry operation.",
    requiredForPass:
      "Connect immutable feature-history records with source, timestamp, and project lineage.",
  },
];

export const caeRecords: DetailRecord[] = [
  {
    id: "cae-plan",
    eyebrow: "Plan snapshot",
    title: "CAD-bound CAE configuration",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "Imported authoritative evidence records a bounded CAE Agent configuration cryptographically tied to the validated CAD revision and real STEP artifact before immutable manifest admission.",
    requiredForPass:
      "Production use additionally requires the approved-environment evidence and review decision for this configuration.",
  },
  {
    id: "cae-contract",
    eyebrow: "Canonical contract",
    title: "CAE job contract",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The retained immutable manifest binds the CAD revision, CAD artifact, CAE configuration, mesh and solver configurations, admission policy, numerical-validation policy, and final result.",
    requiredForPass:
      "A production contract requires approved-environment and independent-review evidence; this client cannot grant either.",
  },
  {
    id: "mesh-artifact",
    eyebrow: "Mesh artifact",
    title: "Mesh verification",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The imported bridge run retained a real Gmsh mesh and independent connectivity, orientation, degeneracy, bounds, and configuration checks after immutable admission.",
    requiredForPass:
      "Independent approved-environment evidence is still required before production admission.",
  },
  {
    id: "solver-package",
    eyebrow: "Solver package",
    title: "Solver input package",
    status: "NOT_CONNECTED",
    description:
      "No solver input package manifest is available. A configuration record cannot stand in for numerical execution or validation.",
    requiredForPass:
      "Connect the solver package manifest, configuration registry entry, and a matching verified job record.",
  },
  {
    id: "result-integrity",
    eyebrow: "Results",
    title: "Result integrity",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "Imported authoritative evidence records a real CAD Agent artifact, immutable manifest, Gmsh mesh, independent mesh verification, CalculiX result, numerical validation, and hash-bound result. The mobile client does not execute or reinterpret the result.",
    requiredForPass:
      "Production use additionally requires approved-environment and independent-review evidence.",
  },
];

export const gateRecords: DetailRecord[] = [
  {
    id: "environment",
    eyebrow: "Environment",
    title: "Approved execution environment",
    status: "BLOCKED_EXTERNAL_EVIDENCE",
    description:
      "The retained run observed GitHub-hosted Docker controls, but the execution environment is not independently approved for production admission.",
    requiredForPass:
      "Independent approval evidence for the exact execution environment and its current validity window.",
  },
  {
    id: "sandbox",
    eyebrow: "Sandbox",
    title: "Sandbox and escape resistance",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The imported evidence records real read-only filesystem, path traversal, symlink, privilege, process, DNS, network, credential-path, and executable-boundary observations in the authoritative Docker run.",
    requiredForPass:
      "Current independent security-test evidence covering sandbox boundaries and escape resistance.",
  },
  {
    id: "resources",
    eyebrow: "Resources",
    title: "Resource isolation",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The imported evidence observed CPU, cgroup memory, PID, timeout, and output-storage enforcement in the actual internal Docker execution.",
    requiredForPass:
      "Observed evidence for enforced CPU, memory, process, and storage limits in the approved runtime.",
  },
  {
    id: "solver-runtime",
    eyebrow: "Execution toolchain",
    title: "Real mesher and solver",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The imported evidence records a real CAD Agent STEP artifact through Gmsh, independent mesh verification, CalculiX, numerical validation, and canonical result binding.",
    requiredForPass:
      "Observed Gmsh, mesh-verification, CalculiX, numerical-validation, and result-integrity evidence.",
  },
  {
    id: "recovery",
    eyebrow: "Operational assurance",
    title: "Recovery and reproducibility",
    status: "INTERNAL_RUNTIME_VERIFIED",
    description:
      "The imported evidence records controlled solver, timeout, CPU, memory, storage, invalid-input, invalid-mesh, corrupted-artifact, and partial-output failures. Repeated real runs reproduced the canonical CAD, manifest, mesh, solver, output, and result hashes.",
    requiredForPass:
      "Validated recovery exercises and reproducible result records bound to the same inputs and environment.",
  },
  {
    id: "external-review",
    eyebrow: "Independent oversight",
    title: "External security review",
    status: "BLOCKED_EXTERNAL_EVIDENCE",
    description:
      "Independent security testing and external engineering review are external dependencies. This app cannot grant or simulate either approval.",
    requiredForPass:
      "A completed independent security assessment and external review decision attached to the project evidence record.",
  },
];

export function canAdmitExecution(gates: DetailRecord[]): boolean {
  return gates.length > 0 && gates.every((gate) => gate.status === "PASS");
}

export function mobileClientCanStartExecution(): false {
  return false;
}
