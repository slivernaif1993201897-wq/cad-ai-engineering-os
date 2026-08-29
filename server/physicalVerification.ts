import { createHash } from "node:crypto";

import type { EngineeringJob } from "../shared/engineeringJob";
import type { MeshConvergenceAssessment, MeshConvergenceCriterion, MeshConvergenceSample, PhysicalEngineeringVerificationInput, PhysicalEngineeringVerificationRecord, PhysicalResultClassification, PhysicalVerificationCheck, VerificationClaimLevels, VerificationCriterion } from "../shared/physicalVerification";
import { getEngineeringJob } from "./engineeringJob";
import { appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";

type Access = { projectId: string; accessKey: string };
const contractVersion = "physical-engineering-verification/v1" as const;
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isHash = (value: string | undefined) => Boolean(value && /^[a-f0-9]{64}$/i.test(value));
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
const finitePositive = (value: number | undefined) => Number.isFinite(value) && value! > 0;

const dimensionUnits: Record<string, ReadonlySet<string>> = {
  STRESS: new Set(["Pa", "kPa", "MPa", "GPa", "N/mm2"]),
  DISPLACEMENT: new Set(["m", "mm"]),
  FORCE: new Set(["N", "kN"]),
  MOMENT: new Set(["N*m", "N*mm"]),
  ENERGY: new Set(["J", "N*mm"]),
  FREQUENCY: new Set(["Hz"]),
  DIMENSIONLESS: new Set(["1"]),
};

function check(check: PhysicalVerificationCheck["check"], status: PhysicalVerificationCheck["status"], statement: string, evidenceIds: string[] = []): PhysicalVerificationCheck {
  return { check, status, statement, evidenceIds: unique(evidenceIds) };
}

function requiredInput(input: PhysicalEngineeringVerificationInput): string[] {
  const missing: string[] = [];
  if (!input.requirementId.trim() || !input.engineeringQuestion.trim()) missing.push("REQUIREMENT_AND_ENGINEERING_QUESTION");
  if (!input.geometryRevision.trim() || !isHash(input.geometryHash)) missing.push("GEOMETRY_REVISION_AND_HASH");
  if (!input.coordinateSystem.trim()) missing.push("COORDINATE_SYSTEM");
  if (!input.material.materialId.trim() || !input.material.definition.trim() || !input.material.source.trim() || !isHash(input.material.propertiesHash) || !input.material.unitSystem.trim() || !input.material.constitutiveModel.trim()) missing.push("MATERIAL_IDENTITY_PROVENANCE_AND_UNITS");
  if (!input.mesh.meshId.trim() || !isHash(input.mesh.meshHash) || !Number.isInteger(input.mesh.nodeCount) || input.mesh.nodeCount < 1 || !Number.isInteger(input.mesh.elementCount) || input.mesh.elementCount < 1 || !input.mesh.elementType.trim()) missing.push("MESH_IDENTITY_AND_STATISTICS");
  if (!input.boundaryConditionIds.length) missing.push("BOUNDARY_CONDITIONS");
  if (!input.loadIds.length) missing.push("LOADS");
  if (!input.solver.identity.trim() || !input.solver.version.trim() || !isHash(input.solver.settingsHash) || !isHash(input.solver.inputHash) || !isHash(input.solver.outputHash)) missing.push("SOLVER_IDENTITY_VERSION_SETTINGS_AND_HASHES");
  if (!Number.isFinite(input.observedResult.value) || !input.observedResult.unit.trim() || !isHash(input.observedResult.resultHash)) missing.push("OBSERVED_RESULT");
  if (!input.criterion.criterionId.trim() || !input.criterion.referenceSolutionId.trim() || !isHash(input.criterion.referenceSolutionHash) || !input.criterion.quantity.trim() || !finitePositive(Math.abs(input.criterion.expectedValue)) || !input.criterion.unit.trim() || !finitePositive(input.criterion.relativeTolerance) || !input.criterion.source.trim()) missing.push("NUMERICAL_REFERENCE_CRITERION");
  if (!input.provenanceReferences.length) missing.push("PROVENANCE_REFERENCES");
  if (!input.lineageReferences.length) missing.push("LINEAGE_REFERENCES");
  if (!input.expectedPhysicalBehavior.trim()) missing.push("EXPECTED_PHYSICAL_BEHAVIOR");
  return unique(missing);
}

export function assessMeshConvergence(input: { criterion: MeshConvergenceCriterion; samples: MeshConvergenceSample[] }): MeshConvergenceAssessment {
  const criterion = input.criterion;
  const samples = [...input.samples].sort((a, b) => b.targetSize - a.targetSize);
  const invalid = !criterion.criterionId.trim() || !criterion.targetQuantity.trim() || !criterion.unit.trim() || !finitePositive(criterion.maximumRelativeChange) || !criterion.source.trim() || samples.length < 3 || samples.some((sample) => !sample.meshId.trim() || !isHash(sample.meshHash) || !finitePositive(sample.targetSize) || !Number.isInteger(sample.elementCount) || sample.elementCount < 1 || !Number.isFinite(sample.result) || sample.unit !== criterion.unit);
  if (invalid) return { criterion, samples, status: "REQUIRED_INPUT", reason: "Mesh convergence requires three or more content-addressed mesh samples, a declared target quantity/unit, and a case-specific sourced tolerance." };
  const ordered = samples.map((sample, index) => ({ ...sample, ...(index ? { relativeChange: Math.abs(sample.result - samples[index - 1].result) / Math.max(Math.abs(sample.result), Number.EPSILON) } : {}) }));
  const monotonic = ordered.slice(1).every((sample, index) => sample.targetSize < ordered[index].targetSize && sample.elementCount > ordered[index].elementCount);
  const finalChange = ordered.at(-1)?.relativeChange;
  const converged = monotonic && finalChange !== undefined && finalChange <= criterion.maximumRelativeChange;
  return { criterion, samples: ordered, status: converged ? "CONVERGED" : "NOT_CONVERGED", reason: converged ? "The explicit fine-versus-medium relative-change criterion is met by monotonically refined, content-addressed meshes." : "Mesh samples are not monotonically refined or the explicit fine-versus-medium relative-change criterion is not met." };
}

function relativeError(observed: number, expected: number) { return Math.abs(observed - expected) / Math.max(Math.abs(expected), Number.EPSILON); }

export function evaluatePhysicalEngineeringVerification(args: { projectId: string; jobId?: string; input: PhysicalEngineeringVerificationInput; createdAt?: string }): PhysicalEngineeringVerificationRecord {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const input = args.input;
  const missing = requiredInput(input);
  const meshConvergence = input.meshConvergence ? assessMeshConvergence(input.meshConvergence) : undefined;
  const unitSet = dimensionUnits[input.criterion.dimension];
  const sameUnit = input.observedResult.unit === input.criterion.unit;
  const unitStatus = unitSet?.has(input.observedResult.unit) && unitSet.has(input.criterion.unit) && sameUnit ? "PASS" as const : "FAIL" as const;
  const dimensionalStatus = unitSet?.has(input.observedResult.unit) && unitSet.has(input.criterion.unit) ? "PASS" as const : "FAIL" as const;
  const resultError = Number.isFinite(input.observedResult.value) && Number.isFinite(input.criterion.expectedValue) ? relativeError(input.observedResult.value, input.criterion.expectedValue) : Number.POSITIVE_INFINITY;
  const resultStatus = unitStatus === "PASS" && resultError <= input.criterion.relativeTolerance ? "PASS" as const : "FAIL" as const;
  const equilibrium = input.reactionEquilibrium;
  const equilibriumStatus = equilibrium ? finitePositive(equilibrium.relativeTolerance) && equilibrium.unit === input.observedResult.unit && relativeError(equilibrium.appliedForce, equilibrium.reactionForce) <= equilibrium.relativeTolerance ? "PASS" as const : "FAIL" as const : "NOT_APPLICABLE" as const;
  const energy = input.energyBalance;
  const energyStatus = energy ? finitePositive(energy.relativeTolerance) && relativeError(energy.inputEnergy, energy.outputEnergy) <= energy.relativeTolerance ? "PASS" as const : "FAIL" as const : "NOT_APPLICABLE" as const;
  const checks: PhysicalVerificationCheck[] = [
    check("UNIT_CONSISTENCY", missing.includes("MATERIAL_IDENTITY_PROVENANCE_AND_UNITS") ? "REQUIRED_INPUT" : unitStatus, unitStatus === "PASS" ? "Observed and criterion units are explicitly equal and accepted for the declared dimension." : "Observed and criterion units are absent, unequal, or incompatible with the declared dimension.", [input.material.propertiesHash]),
    check("DIMENSIONAL_CONSISTENCY", unitStatus === "PASS" ? "PASS" : "FAIL", unitStatus === "PASS" ? `Both values are declared as ${input.criterion.dimension}.` : "The declared numerical dimension and units are inconsistent.", []),
    check("MESH_QUALITY", input.mesh.qualityStatus === "PASS" ? "PASS" : input.mesh.qualityStatus === "FAIL" ? "FAIL" : "REQUIRED_INPUT", input.mesh.qualityStatus === "PASS" ? "Mesh quality has an explicit PASS evidence status." : "Mesh quality is failed or not evidenced.", [input.mesh.meshHash]),
    check("MESH_CONVERGENCE", meshConvergence ? meshConvergence.status === "CONVERGED" ? "PASS" : meshConvergence.status === "NOT_CONVERGED" ? "FAIL" : "REQUIRED_INPUT" : "NOT_APPLICABLE", meshConvergence?.reason ?? "No mesh-convergence study was supplied; it is not inferred from one mesh.", meshConvergence?.samples.map((sample) => sample.meshHash) ?? []),
    check("SOLVER_CONVERGENCE", input.observedResult.solverConvergence === "CONVERGED" ? "PASS" : input.observedResult.solverConvergence === "DIVERGED" ? "FAIL" : "REQUIRED_INPUT", input.observedResult.solverConvergence === "CONVERGED" ? "The result carries explicit solver convergence evidence." : "Solver convergence is divergent or not evidenced.", [input.solver.outputHash]),
    check("REACTION_FORCE_EQUILIBRIUM", equilibriumStatus, equilibrium ? `Reaction equilibrium is evaluated only against explicit tolerance from ${equilibrium.source}.` : "No equilibrium criterion applies to this supplied verification case.", equilibrium ? [equilibrium.source] : []),
    check("ENERGY_BALANCE", energyStatus, energy ? `Energy balance is evaluated only against explicit tolerance from ${energy.source}.` : "No energy-balance criterion applies to this supplied verification case.", energy ? [energy.source] : []),
    check("CONSTRAINT_CONSISTENCY", input.boundaryConditionIds.length ? "PASS" : "REQUIRED_INPUT", input.boundaryConditionIds.length ? "Explicit boundary-condition identities are bound to this record." : "Boundary-condition identities are missing.", input.boundaryConditionIds),
    check("LOAD_PATH_SANITY", input.loadIds.length && input.expectedPhysicalBehavior.trim() ? "PASS" : "REQUIRED_INPUT", input.loadIds.length && input.expectedPhysicalBehavior.trim() ? "Explicit load identities and expected physical behavior are recorded; no physical outcome is inferred." : "Load identities or expected physical behavior are missing.", input.loadIds),
    check("BOUNDARY_CONDITION_COMPLETENESS", input.boundaryConditionIds.length ? "PASS" : "REQUIRED_INPUT", input.boundaryConditionIds.length ? "Boundary conditions are explicitly identified." : "Boundary conditions are not fully identified.", input.boundaryConditionIds),
    check("RESULT_SANITY", resultStatus, resultStatus === "PASS" ? "Observed value satisfies the explicit, case-specific reference criterion." : "Observed value does not satisfy the explicit reference criterion or has incompatible units.", [input.criterion.referenceSolutionHash, input.observedResult.resultHash]),
  ];
  const computational = isHash(input.solver.runtimeEvidenceHash) && !missing.length ? "ACHIEVED" as const : "REQUIRED_INPUT" as const;
  const requiredCheck = checks.some((item) => item.status === "REQUIRED_INPUT");
  const failedCheck = checks.some((item) => item.status === "FAIL");
  const numerical = computational === "ACHIEVED" && !requiredCheck && !failedCheck ? "ACHIEVED" as const : requiredCheck ? "REQUIRED_INPUT" as const : "NOT_ACHIEVED" as const;
  const levels: VerificationClaimLevels = { computation: computational, numericalVerification: numerical, modelValidation: "NOT_ACHIEVED", experimentalCorrelation: "NOT_ACHIEVED", engineeringAcceptance: "NOT_ACHIEVED", regulatoryCertification: "NOT_ACHIEVED" };
  const classification: PhysicalResultClassification = numerical === "ACHIEVED" && input.scope === "ANALYTICAL_REFERENCE_CASE"
    ? "VALIDATED_REFERENCE_CASE"
    : numerical === "ACHIEVED" && meshConvergence?.status === "CONVERGED"
      ? "NUMERICALLY_CONVERGED"
      : numerical === "ACHIEVED"
        ? "MODEL_ASSUMPTION_LIMITED"
        : numerical === "REQUIRED_INPUT"
          ? "NOT_VALIDATED"
          : numerical === "NOT_ACHIEVED"
            ? "NUMERICALLY_UNCERTAIN"
            : computational === "ACHIEVED"
              ? "EXECUTION_ONLY"
              : "NOT_VALIDATED";
  const limitations = unique([
    "Numerical verification does not establish model validation, experimental correlation, engineering acceptance, regulatory certification, physical safety, or machine certification.",
    "No higher claim is inferred from solver or computation execution.",
    ...(input.assumptions.length ? [`Assumptions recorded: ${input.assumptions.join(" | ")}`] : []),
    ...(input.simplifications.length ? [`Simplifications recorded: ${input.simplifications.join(" | ")}`] : []),
  ]);
  const unsigned = { verificationId: id("PHYSICAL-VERIFICATION"), projectId: args.projectId, jobId: args.jobId, scope: input.scope, contractVersion, requirementId: input.requirementId, engineeringQuestion: input.engineeringQuestion, geometryRevision: input.geometryRevision, geometryHash: input.geometryHash, coordinateSystem: input.coordinateSystem, material: input.material, mesh: input.mesh, boundaryConditionIds: unique(input.boundaryConditionIds), loadIds: unique(input.loadIds), contactIds: unique(input.contactIds), solver: input.solver, observedResult: input.observedResult, criterion: input.criterion, checks, ...(meshConvergence ? { meshConvergence } : {}), levels, classification, provenanceReferences: unique(input.provenanceReferences), lineageReferences: unique(input.lineageReferences), assumptions: unique(input.assumptions), simplifications: unique(input.simplifications), expectedPhysicalBehavior: input.expectedPhysicalBehavior, limitations, immutable: true as const, createdAt };
  return { ...unsigned, verificationHash: sha256(unsigned) };
}

function assertEngineeringJobBinding(job: EngineeringJob, input: PhysicalEngineeringVerificationInput): void {
  if (job.state !== "SUCCEEDED" || !job.cad || !job.manifest || !job.runtimeEvidence) throw new Error("PHYSICAL_VERIFICATION_REQUIRES_RECONCILED_RUNTIME_EVIDENCE");
  if (input.geometryRevision !== job.cad.revisionHash || input.geometryHash !== job.cad.artifactHash || input.mesh.meshHash !== job.runtimeEvidence.meshHash || input.solver.inputHash !== job.runtimeEvidence.inputHash || input.solver.outputHash !== job.runtimeEvidence.outputHash || input.observedResult.resultHash !== job.runtimeEvidence.resultHash || input.solver.runtimeEvidenceHash !== job.runtimeEvidence.evidenceHash) throw new Error("PHYSICAL_VERIFICATION_RUNTIME_BINDING_MISMATCH");
}

export async function createPhysicalEngineeringVerification(args: Access & { jobId?: string; input: PhysicalEngineeringVerificationInput }): Promise<PhysicalEngineeringVerificationRecord> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  if (!args.input || typeof args.input !== "object") throw new Error("PHYSICAL_VERIFICATION_INPUT_REQUIRED");
  if (args.input.scope !== "ENGINEERING_JOB" && args.input.scope !== "ANALYTICAL_REFERENCE_CASE") throw new Error("PHYSICAL_VERIFICATION_SCOPE_INVALID");
  if (args.input.scope === "ENGINEERING_JOB") {
    if (!args.jobId?.trim()) throw new Error("PHYSICAL_VERIFICATION_JOB_ID_REQUIRED");
    const job = await getEngineeringJob({ projectId: args.projectId, accessKey: args.accessKey, jobId: args.jobId });
    if (!job) throw new Error("ENGINEERING_JOB_NOT_FOUND");
    assertEngineeringJobBinding(job, args.input);
  } else if (args.jobId) throw new Error("ANALYTICAL_REFERENCE_CASE_CANNOT_BIND_AN_ENGINEERING_JOB");
  const record = evaluatePhysicalEngineeringVerification({ projectId: args.projectId, jobId: args.jobId, input: args.input });
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAE_PHYSICAL_VERIFICATION", title: `Physical verification · ${record.classification}`, content: JSON.stringify(record), truthStatus: record.levels.numericalVerification === "ACHIEVED" ? "CALCULATED" : "UNVERIFIED", validationStage: "GEOMETRICALLY_VALIDATED", sourceRecordId: args.jobId, relatedConfigurationId: record.geometryRevision, authorSource: "SYSTEM" } });
  return record;
}

export async function listPhysicalEngineeringVerifications(args: Access & { jobId?: string }): Promise<PhysicalEngineeringVerificationRecord[]> {
  await openPersistentProject({ projectId: args.projectId, accessKey: args.accessKey, name: "" });
  return (await projectMemorySnapshot(args)).records.filter((record) => record.kind === "CAE_PHYSICAL_VERIFICATION").flatMap((record) => { try { return [JSON.parse(record.content) as PhysicalEngineeringVerificationRecord]; } catch { return []; } }).filter((record) => !args.jobId || record.jobId === args.jobId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Known analytical fixture used only to verify the numerical contract, never to certify a real design. */
export function axialStressReferenceInput(): PhysicalEngineeringVerificationInput {
  const loadN = 1_000;
  const areaMm2 = 50;
  const expectedMpa = loadN / areaMm2;
  const fixtureHash = sha256({ case: "AXIAL_STRESS_REFERENCE", loadN, areaMm2, expectedMpa });
  return {
    scope: "ANALYTICAL_REFERENCE_CASE", requirementId: "ANALYTICAL-AXIAL-STRESS", engineeringQuestion: "Does the computational result reproduce the explicitly defined axial-stress analytical reference?", geometryRevision: "ANALYTICAL-AXIAL-STRESS-V1", geometryHash: fixtureHash, coordinateSystem: "ANALYTICAL-1D-AXIS", material: { materialId: "ANALYTICAL-LINEAR-ELASTIC", definition: "Linear elastic analytical reference material", source: "ANALYTICAL_REFERENCE_CASE", propertiesHash: sha256({ elastic: "not used by axial stress closed form" }), unitSystem: "N-mm-MPa", constitutiveModel: "LINEAR_ELASTIC" }, mesh: { meshId: "ANALYTICAL-MESH-FINE", meshHash: sha256({ mesh: "analytical-reference-fine" }), nodeCount: 3, elementCount: 2, qualityStatus: "PASS", elementType: "REFERENCE_1D" }, boundaryConditionIds: ["ANALYTICAL-FIXED-END"], loadIds: ["ANALYTICAL-AXIAL-1000N"], contactIds: [], solver: { identity: "ANALYTICAL_REFERENCE_EVALUATOR", version: "1.0.0", settingsHash: sha256({ formula: "sigma=F/A" }), inputHash: sha256({ loadN, areaMm2 }), outputHash: sha256({ expectedMpa }), runtimeEvidenceHash: sha256({ fixture: "AXIAL_STRESS_REFERENCE", version: 1 }) }, observedResult: { value: expectedMpa, unit: "MPa", resultHash: sha256({ value: expectedMpa, unit: "MPa" }), solverConvergence: "CONVERGED", solverWarnings: [] }, criterion: { criterionId: "ANALYTICAL-AXIAL-STRESS-EXACT", referenceSolutionId: "SIGMA_EQUALS_FORCE_OVER_AREA", referenceSolutionHash: fixtureHash, quantity: "AXIAL_STRESS", dimension: "STRESS", expectedValue: expectedMpa, unit: "MPa", relativeTolerance: 1e-12, source: "Closed-form axial stress reference: sigma = force / area" }, meshConvergence: { criterion: { criterionId: "ANALYTICAL-MESH-CONVERGENCE", targetQuantity: "AXIAL_STRESS", unit: "MPa", maximumRelativeChange: 0.02, source: "Analytical reference-case criterion" }, samples: [ { meshId: "ANALYTICAL-COARSE", meshHash: sha256({ mesh: "coarse" }), targetSize: 10, elementCount: 4, result: 19.6, unit: "MPa" }, { meshId: "ANALYTICAL-MEDIUM", meshHash: sha256({ mesh: "medium" }), targetSize: 5, elementCount: 16, result: 19.9, unit: "MPa" }, { meshId: "ANALYTICAL-FINE", meshHash: sha256({ mesh: "fine" }), targetSize: 2.5, elementCount: 64, result: expectedMpa, unit: "MPa" } ] }, provenanceReferences: ["ANALYTICAL-AXIAL-STRESS-V1", fixtureHash], lineageReferences: ["ANALYTICAL-AXIAL-STRESS-V1"], assumptions: ["Small-strain uniaxial linear-elastic closed-form reference."], simplifications: ["This fixture is not a seat, product model, experimental test, or regulatory test."], expectedPhysicalBehavior: "Uniform axial stress equals applied axial force divided by cross-sectional area.",
  };
}
