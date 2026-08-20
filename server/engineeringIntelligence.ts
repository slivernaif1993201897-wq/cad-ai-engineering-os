import { runRuthlessEngineeringReview } from "./engineeringReview";
import type {
  CADHandoffPlan,
  CandidateRanking,
  ConceptCandidate,
  EngineeringBenchmark,
  EngineeringDecomposition,
  EngineeringIntelligenceInput,
  EngineeringIntelligenceResult,
  EngineeringMemoryRecord,
  EngineeringSubsystem,
  MaximumEffortReport,
  SelfCorrectionRecord,
  SpecialistFinding,
  SpecialistRole,
} from "../shared/engineeringIntelligence";
import type { EngineeringTruthStatus } from "../shared/engineeringTruth";

const memoryByProject = new Map<string, EngineeringMemoryRecord[]>();
let runCounter = 0;

function contains(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function memory(projectId: string, type: EngineeringMemoryRecord["type"], referenceId: string, summary: string, truthStatus: EngineeringTruthStatus): EngineeringMemoryRecord {
  return { id: `MEM-${projectId}-${Date.now()}-${++runCounter}`, type, referenceId, summary, truthStatus, timestamp: new Date().toISOString() };
}

function subsystemsFor(sourceText: string, unknowns: string[]): EngineeringSubsystem[] {
  const text = sourceText.toLowerCase();
  const safety = contains(text, ["occupant", "seat", "vehicle", "automotive", "crash", "safety"]);
  return [
    { id: "SUBSYS-OBJECTIVE", name: "System objective", objective: "Translate the user request into a measurable engineering objective without converting intent into a performance claim.", constraints: ["User statement is intent only."], unknowns: unknowns.filter((item) => /requirement|objective|interface/i.test(item)), truthStatus: "DERIVED" },
    { id: "SUBSYS-PHYSICS", name: "Load path and physics", objective: "Identify forces, motion, energy, boundary conditions, and failure mechanisms that would govern the concept.", constraints: ["No solver, material model, or test result is available in this phase."], unknowns: unknowns.filter((item) => /load|force|crash|duty|boundary/i.test(item)), truthStatus: "UNVERIFIED" },
    { id: "SUBSYS-CAD", name: "Geometry and interfaces", objective: "Define editable parameters, interfaces, keep-out zones, motion envelopes, and a feature strategy before CAD execution.", constraints: ["A successful solid proves geometry only."], unknowns: unknowns.filter((item) => /geometry|dimension|interface|zone/i.test(item)), truthStatus: "UNKNOWN" },
    { id: "SUBSYS-MFG", name: "Material and manufacturing", objective: "Identify candidate material families, production processes, tolerances, inspection, and serviceability requirements.", constraints: ["No supplier, cost, certification, or process capability data has been consulted."], unknowns: unknowns.filter((item) => /material|manufactur|process|tolerance/i.test(item)), truthStatus: "UNKNOWN" },
    { id: "SUBSYS-VALIDATION", name: safety ? "Safety and system integration" : "Validation and system integration", objective: safety ? "Define occupant/system interfaces, integration envelope, and verification targets." : "Define validation method, assembly interfaces, and system interactions.", constraints: ["No validation plan has been executed."], unknowns: unknowns.filter((item) => /vehicle|safety|verification|integration/i.test(item)), truthStatus: "UNKNOWN" },
  ];
}

function decompose(input: EngineeringIntelligenceInput, review: ReturnType<typeof runRuthlessEngineeringReview>): EngineeringDecomposition {
  const unknowns = review.unknown.map((item) => item.question);
  return {
    problemStatement: input.sourceText,
    objective: "Develop multiple testable engineering architectures while keeping every unverified physical, manufacturing, safety, and performance claim explicitly labeled.",
    requirements: review.known.map((item) => item.text),
    constraints: review.constraints.map((item) => item.text),
    unknowns,
    contradictions: review.contradictions.map((item) => item.conflict),
    solutionSpace: ["load-path redesign", "functional modularity", "progressive response", "kinematic control", "distributed energy management", "material-led architecture", "speculative architecture under explicit evidence gaps"],
    subsystems: subsystemsFor(input.sourceText, unknowns),
  };
}

type CandidateSeed = Pick<ConceptCandidate, "title" | "architectureFamily" | "mechanism" | "differentiation">;

function candidateSeeds(safetyContext: boolean, includeExtended: boolean): CandidateSeed[] {
  const primary: CandidateSeed[] = safetyContext ? [
    { title: "Load-path-first restraint architecture", architectureFamily: "DIRECT_LOAD_PATH", mechanism: "Route occupant or system loads through defined primary paths before adding secondary energy-management functions.", differentiation: "Prioritizes inspectable structural load paths over complex response mechanisms." },
    { title: "Modular safety-function architecture", architectureFamily: "MODULAR_FUNCTIONAL", mechanism: "Separate structural support, occupant interface, energy-management, and service modules.", differentiation: "Separates functions so a change in one does not silently alter all others." },
    { title: "Progressive energy-response architecture", architectureFamily: "PROGRESSIVE_RESPONSE", mechanism: "Use staged engagement or controlled deformation concepts to distribute response over time or travel.", differentiation: "Explores multi-stage behavior rather than a single abrupt event." },
    { title: "Kinematic motion-control architecture", architectureFamily: "KINEMATIC_CONTROL", mechanism: "Use constrained motion paths, travel limits, and staged interfaces to control relative movement.", differentiation: "Treats geometry and mechanism as the primary control variables, not material collapse." },
    { title: "Distributed system energy-management architecture", architectureFamily: "DISTRIBUTED_ENERGY", mechanism: "Distribute energy management across multiple interfaces or components instead of concentrating it in one part.", differentiation: "Reduces single-point dependence by moving the design question to system architecture." },
  ] : [
    { title: "Direct load-path architecture", architectureFamily: "DIRECT_LOAD_PATH", mechanism: "Use simple primary members and explicit load paths with minimal hidden structural dependencies.", differentiation: "Prioritizes inspectability and direct force transfer." },
    { title: "Modular function architecture", architectureFamily: "MODULAR_FUNCTIONAL", mechanism: "Separate mounting, stiffness, service, and energy-management functions into replaceable or independently testable modules.", differentiation: "Avoids coupling every function into one geometry." },
    { title: "Progressive-response architecture", architectureFamily: "PROGRESSIVE_RESPONSE", mechanism: "Use staged geometry or compliant elements to distribute response instead of concentrating it in a single feature.", differentiation: "Explores controlled sequence rather than binary stiff/fail behavior." },
    { title: "Kinematic control architecture", architectureFamily: "KINEMATIC_CONTROL", mechanism: "Control motion with links, stops, guides, and bounded travel before relying on material behavior.", differentiation: "Uses mechanisms and envelopes as primary design variables." },
    { title: "Distributed load-sharing architecture", architectureFamily: "DISTRIBUTED_ENERGY", mechanism: "Divide load transfer across redundant paths or interfaces subject to explicit verification.", differentiation: "Explores system-level distribution instead of one dominant member." },
  ];
  if (!includeExtended) return primary;
  return [...primary,
    { title: "Material-led architecture", architectureFamily: "MATERIAL_LED", mechanism: "Investigate candidate material-family effects only after verified property and process data are supplied.", differentiation: "Changes material/section strategy rather than only geometry.", },
    { title: "Adaptive interface architecture", architectureFamily: "SPECULATIVE_ARCHITECTURE", mechanism: "Explore staged or adjustable interfaces as a hypothesis, with no claim that they are robust or manufacturable.", differentiation: "Introduces controllability as an explicit but unverified design variable." },
    { title: "Hybrid sacrificial-module architecture", architectureFamily: "SPECULATIVE_ARCHITECTURE", mechanism: "Explore replaceable sacrificial elements that localize controlled damage or service replacement.", differentiation: "Separates durable structure from potentially consumable response elements." },
    { title: "Graded-response architecture", architectureFamily: "SPECULATIVE_ARCHITECTURE", mechanism: "Explore spatially varied section or response concepts only as a manufacturability-dependent hypothesis.", differentiation: "Varies response through architecture rather than one uniform section." },
    { title: "System-reframing architecture", architectureFamily: "SPECULATIVE_ARCHITECTURE", mechanism: "Move the primary function to a different system boundary when part-level optimization remains contradictory.", differentiation: "Challenges the assumption that the requested component must carry every function." },
  ];
}

function candidatesFor(input: EngineeringIntelligenceInput, review: ReturnType<typeof runRuthlessEngineeringReview>): ConceptCandidate[] {
  const text = input.sourceText.toLowerCase();
  const safetyContext = contains(text, ["occupant", "seat", "vehicle", "automotive", "crash", "safety"]);
  const extended = Boolean(input.requestMajorInnovation) || input.mode === "SPECULATIVE" || input.mode === "EXPLORATION";
  const speculative = input.mode === "SPECULATIVE" || input.mode === "EXPLORATION";
  return candidateSeeds(safetyContext, extended).map((seed, index) => ({
    id: `CANDIDATE-${String.fromCharCode(65 + index)}`,
    ...seed,
    truthStatus: speculative || seed.architectureFamily === "SPECULATIVE_ARCHITECTURE" ? "SPECULATIVE" : "HYPOTHETICAL",
    state: speculative || seed.architectureFamily === "SPECULATIVE_ARCHITECTURE" ? "SPECULATIVE" : "NEEDS_REVISION",
    assumptions: ["No physical performance, material property, process capability, cost, or safety result is supplied."],
    risks: ["May violate unknown packaging, load, material, manufacturing, or integration constraints.", "Requires comparison against the same measurable requirements before selection."],
    requiredEvidence: ["Measurable requirements", "Interface and geometry definition", "Load cases and material data", "CAE plan or physical experiment"],
    traceabilityIds: [review.reviewId, "USER-REQUEST-001"],
  }));
}

function specialistFindingsFor(candidates: ConceptCandidate[], review: ReturnType<typeof runRuthlessEngineeringReview>): SpecialistFinding[] {
  const roles: { role: SpecialistRole; category: SpecialistFinding["category"]; challenge: string; evidenceNeeded: string[] }[] = [
    { role: "PHYSICS_REVIEWER", category: "PHYSICS", challenge: "No load case, boundary condition, energy balance, material behavior, or solver result validates the proposed mechanism.", evidenceNeeded: ["Load cases", "Boundary conditions", "Material model", "CAE or experiment"] },
    { role: "CAD_REVIEWER", category: "GEOMETRY", challenge: "The architecture is not yet a feature-complete parametric CAD model with interfaces, tolerances, and keep-out zones.", evidenceNeeded: ["CAD parameter set", "Feature plan", "Interface geometry"] },
    { role: "MANUFACTURING_REVIEWER", category: "MANUFACTURING", challenge: "Process capability, tolerance stack, inspection, volume, and cost remain unknown.", evidenceNeeded: ["Process plan", "Tolerance study", "Production assumptions"] },
    { role: "SAFETY_REVIEWER", category: "FAILURE_MODE", challenge: "Safety-relevant failure modes, misuse cases, and verification targets have not been evaluated.", evidenceNeeded: ["Hazard analysis", "Verification plan", "Relevant system requirements"] },
    { role: "OPTIMIZATION_REVIEWER", category: "ASSUMPTION", challenge: "No objective functions, constraints, or evaluation data exist; optimization cannot rank performance yet.", evidenceNeeded: ["Objectives", "Constraints", "Real evaluation data"] },
    { role: "SYSTEMS_REVIEWER", category: "INTEGRATION", challenge: "System interfaces, package envelope, adjacent components, assembly sequence, and service conditions remain unverified.", evidenceNeeded: ["Interface control", "Package envelope", "Assembly/service analysis"] },
  ];
  return candidates.flatMap((candidate) => roles.map((item, index) => ({
    id: `SPECIALIST-${candidate.id}-${index + 1}`,
    role: item.role,
    candidateId: candidate.id,
    challenge: item.challenge,
    category: item.category,
    truthStatus: review.gate === "BLOCKED" && item.role === "PHYSICS_REVIEWER" ? "PHYSICS_CONFLICT" : "UNVERIFIED",
    outcome: review.gate === "BLOCKED" && item.role === "PHYSICS_REVIEWER" ? "REJECT" : "CHALLENGE",
    evidenceNeeded: item.evidenceNeeded,
  })));
}

function selfCorrect(candidates: ConceptCandidate[], review: ReturnType<typeof runRuthlessEngineeringReview>): SelfCorrectionRecord[] {
  return candidates.map((candidate) => ({
    candidateId: candidate.id,
    failure: review.gate === "BLOCKED" ? "The source statement contains a physics conflict that prevents this candidate from being considered a trusted solution." : "The candidate lacks the quantified inputs and evidence required for a performance conclusion.",
    cause: review.gate === "BLOCKED" ? review.verdictReason : "Loads, materials, interfaces, production constraints, and verification criteria remain incomplete or unexecuted.",
    modification: "Retain the architecture as a hypothesis, constrain it with measurable requirements, and compare it against the other candidates instead of asserting success.",
    reevaluation: "Needs new requirements, geometry definition, load cases, material data, and a CAE or experiment plan before any physical ranking can be validated.",
    truthStatus: review.gate === "BLOCKED" ? "PHYSICS_CONFLICT" : "UNVERIFIED",
  }));
}

function rankingFor(candidates: ConceptCandidate[], review: ReturnType<typeof runRuthlessEngineeringReview>): CandidateRanking[] {
  return candidates.map((candidate, index) => ({
    candidateId: candidate.id,
    rank: index + 1,
    rationale: index === 0 ? "Ranked as the first investigation because it offers a direct, inspectable starting point; it is not a proven superior solution." : "Retained as a meaningfully different architecture to avoid selecting the first plausible concept before evidence exists.",
    state: review.gate === "BLOCKED" ? "SPECULATIVE" : candidate.state,
    truthStatus: review.gate === "BLOCKED" ? "SPECULATIVE" : candidate.truthStatus,
  }));
}

function buildCadHandoff(review: ReturnType<typeof runRuthlessEngineeringReview>, candidates: ConceptCandidate[], decomposition: EngineeringDecomposition): CADHandoffPlan {
  if (review.gate === "BLOCKED") return { eligibility: "BLOCKED", reason: review.verdictReason, requirementsNeeded: review.unknown.map((item) => item.question), cadPlanOutline: ["Do not create trusted CAD for the conflicting mechanism."], validationPlan: ["Resolve the physics conflict before geometric embodiment."], truthStatus: "PHYSICS_CONFLICT" };
  if (review.gate !== "CAD_ELIGIBLE") return { eligibility: "CONCEPTUAL_ONLY", reason: "Problem decomposition and alternatives are available, but blocking unknowns prevent a trusted CAD handoff.", requirementsNeeded: review.unknown.filter((item) => item.blocking).map((item) => item.question), cadPlanOutline: ["Create a conceptual block diagram or parametric placeholder only.", "Do not claim physical or production validity."], validationPlan: ["Convert blocking unknowns into measurable requirements.", "Then define load cases, material, interfaces, and verification method."], truthStatus: "UNVERIFIED" };
  return { eligibility: "CAD_READY", reason: "The current problem contains the minimum explicit dimensional, material, load, and manufacturing signals for a geometry-oriented handoff; this is not a physical validation.", selectedCandidateId: candidates[0]?.id, requirementsNeeded: decomposition.unknowns, cadPlanOutline: ["Define coordinate system and editable parameters.", "Define interfaces and keep-out zones.", "Generate ordered features with stable IDs.", "Validate BRep geometry and preserve STEP evidence."], validationPlan: ["Define CAE inputs separately; no solver result exists.", "Create a manufacturing and assembly review.", "Verify the selected candidate against measurable requirements."], truthStatus: "DERIVED" };
}

function buildMaximumEffort(review: ReturnType<typeof runRuthlessEngineeringReview>, candidates: ConceptCandidate[]): MaximumEffortReport {
  return {
    attempts: ["Decomposed the problem into system, physics, CAD, material/manufacturing, and validation subsystems.", `Generated ${candidates.length} meaningfully different architecture families.`, "Applied Physics, CAD, Manufacturing, Safety, Optimization, and Systems challenge reviews.", "Applied self-correction rather than treating candidate generation as validation."],
    failedApproaches: review.gate === "BLOCKED" ? ["The original mechanism conflicts with physics under the stated assumptions."] : ["No candidate has enough evidence for a physical, safety, manufacturing, or production claim."],
    remainingUnknowns: review.unknown.map((item) => item.question),
    toolsMissing: ["No CAE solver execution", "No material database lookup", "No manufacturing capability database", "No physical experiment or certification evidence"],
    informationRequired: review.unknown.filter((item) => item.blocking).map((item) => item.question),
    experimentOrAnalysisPlan: ["Define measurable requirements and interfaces.", "Define loads, boundary conditions, materials, and acceptance criteria.", "Create a solver-independent CAE plan or physical test plan before claiming performance."],
    remainingAlternatives: candidates.map((candidate) => candidate.title),
    conclusion: review.gate === "BLOCKED" ? "The requested approach is unresolved because a physics conflict remains; alternative reframing is available, but no success claim is warranted." : "The architecture space is not exhausted, but physical and production conclusions remain unresolved until evidence is created.",
    truthStatus: review.gate === "BLOCKED" ? "PHYSICS_CONFLICT" : "UNVERIFIED",
  };
}

function benchmark(result: Omit<EngineeringIntelligenceResult, "benchmark">): EngineeringBenchmark {
  const values = {
    problemDecomposition: result.decomposition.subsystems.length >= 5,
    constraintSatisfaction: result.truthReview.constraints.length === result.decomposition.contradictions.length,
    conceptDiversity: new Set(result.candidates.map((item) => item.architectureFamily)).size >= Math.min(5, result.candidates.length),
    physicsConsistency: result.truthReview.physics.every((item) => item.truthStatus !== "FACT" || item.source !== "NOT_PROVIDED"),
    failureDetection: result.specialistFindings.some((item) => item.outcome === "CHALLENGE" || item.outcome === "REJECT"),
    alternativeGeneration: result.candidates.length >= 5,
    selfCorrection: result.selfCorrections.length === result.candidates.length,
    requirementTraceability: result.candidates.every((item) => item.traceabilityIds.includes("USER-REQUEST-001")),
    manufacturingReasoning: result.specialistFindings.some((item) => item.role === "MANUFACTURING_REVIEWER"),
    cadHandoffIntegrity: result.cadHandoff.eligibility !== "CAD_READY" || result.cadHandoff.validationPlan.length > 0,
  };
  return { ...values, passed: Object.values(values).every(Boolean), limitations: ["This is a deterministic coverage benchmark, not a measurement of general intelligence or engineering performance.", "The benchmark proves the required review artifacts were generated and labeled; it does not validate a physical design."] };
}

export function runEngineeringIntelligence(input: EngineeringIntelligenceInput): EngineeringIntelligenceResult {
  const sourceText = input.sourceText.trim();
  if (!sourceText) throw new Error("Engineering intelligence requires a non-empty problem statement.");
  const projectId = input.projectId?.trim() || "PROJECT-DEFAULT";
  const mode = input.mode ?? "NORMAL";
  const truthReview = runRuthlessEngineeringReview({ sourceText, exploratoryMode: mode === "EXPLORATION" || mode === "SPECULATIVE", geometryStatus: input.geometryStatus });
  const decomposition = decompose(input, truthReview);
  const candidates = candidatesFor(input, truthReview);
  const specialistFindings = specialistFindingsFor(candidates, truthReview);
  const selfCorrections = selfCorrect(candidates, truthReview);
  const ranking = rankingFor(candidates, truthReview);
  const cadHandoff = buildCadHandoff(truthReview, candidates, decomposition);
  const maximumEffort = buildMaximumEffort(truthReview, candidates);
  const previousMemory = memoryByProject.get(projectId) ?? [];
  const newMemory = [
    memory(projectId, "REQUIREMENT", "USER-REQUEST-001", `Problem statement captured: ${sourceText}`, "FACT"),
    ...truthReview.assumptions.map((item) => memory(projectId, "ASSUMPTION", item.id, item.text, item.truthStatus)),
    ...candidates.map((item) => memory(projectId, "CONCEPT", item.id, item.title, item.truthStatus)),
    ...selfCorrections.map((item) => memory(projectId, "FAILED_CONCEPT", item.candidateId, item.failure, item.truthStatus)),
    memory(projectId, "DESIGN_DECISION", cadHandoff.selectedCandidateId ?? "NO-CANDIDATE", cadHandoff.reason, cadHandoff.truthStatus),
  ];
  const allMemory = [...previousMemory, ...newMemory];
  memoryByProject.set(projectId, allMemory);
  const base = { runId: `INTEL-${Date.now()}-${++runCounter}`, projectId, mode, decomposition, truthReview, candidates, specialistFindings, selfCorrections, ranking, memory: allMemory, maximumEffort, cadHandoff };
  return { ...base, benchmark: benchmark(base) };
}

export function getEngineeringMemory(projectId = "PROJECT-DEFAULT"): EngineeringMemoryRecord[] {
  return memoryByProject.get(projectId) ?? [];
}
