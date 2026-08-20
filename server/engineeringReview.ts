import type {
  DesignAlternative,
  EngineeringContradiction,
  EngineeringEvidenceChain,
  EngineeringReviewInput,
  EngineeringStatement,
  EngineeringUnknown,
  RedTeamFinding,
  RuthlessEngineeringReview,
} from "../shared/engineeringTruth";

let reviewCounter = 0;

function statement(args: Omit<EngineeringStatement, "id"> & { id?: string }): EngineeringStatement {
  return { id: args.id ?? `ENG-STATEMENT-${++reviewCounter}`, ...args, confidence: Math.max(0, Math.min(1, args.confidence)) };
}

function unknown(id: string, question: string, whyItMatters: string, discipline: EngineeringUnknown["discipline"], blocking = true): EngineeringUnknown {
  return { id, question, whyItMatters, blocking, discipline, truthStatus: "UNKNOWN" };
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}

function extractExplicitAssumptions(sourceText: string): EngineeringStatement[] {
  const matches = [...sourceText.matchAll(/(?:assume|assumption)\s*[:=-]?\s*([^.!?]+)/gi)];
  return matches.map((match, index) => statement({
    id: `ASSUMPTION-${index + 1}`,
    text: match[1].trim(),
    truthStatus: "ASSUMED",
    confidence: 1,
    source: "USER_INPUT",
    discipline: "SYSTEM",
    provenance: "Explicitly supplied by the user; not independently verified.",
    traceabilityIds: ["USER-REQUEST-001"],
  }));
}

function detectUnknowns(sourceText: string): EngineeringUnknown[] {
  const text = sourceText.toLowerCase();
  const items: EngineeringUnknown[] = [];
  const hasDimensions = /\d+(?:\.\d+)?\s*(mm|cm|m|in|inch)/i.test(sourceText);
  const mobility = hasAny(text, ["occupant", "seat", "vehicle", "automotive", "crash", "deceleration"]);
  const hasMaterial = hasAny(text, ["steel", "aluminum", "aluminium", "titanium", "polymer", "composite", "material"]);
  const hasLoad = hasAny(text, ["load", "force", "newton", "n", "stress", "impact", "crash pulse", "deceleration"]);
  const hasManufacturing = hasAny(text, ["machin", "milling", "casting", "additive", "print", "manufactur"]);

  if (!hasDimensions) items.push(unknown("UNKNOWN-GEOMETRY-001", "What are the required geometry dimensions, interfaces, and keep-out zones?", "Geometry cannot be judged for fit, stiffness, manufacturability, or CAD completeness without explicit dimensions.", "GEOMETRY"));
  if (!hasMaterial) items.push(unknown("UNKNOWN-MATERIAL-001", "What material specification or material family is permitted?", "Material behavior, joining, mass, durability, and manufacturing claims cannot be determined without a material definition.", "MATERIAL"));
  if (!hasLoad) items.push(unknown("UNKNOWN-LOAD-001", "What load cases, duty cycle, boundary conditions, and safety factors apply?", "No stress, fatigue, energy absorption, or safety conclusion is valid without defined loads and constraints.", "PHYSICS"));
  if (!hasManufacturing) items.push(unknown("UNKNOWN-MFG-001", "Which manufacturing processes, volumes, tolerances, and cost limits are allowed?", "Manufacturability and cost cannot be claimed without a process and production context.", "MANUFACTURING", false));
  if (mobility) {
    items.push(unknown("UNKNOWN-VEHICLE-001", "What are the occupant population, crash pulse, package envelope, restraint strategy, and applicable verification targets?", "A vehicle-safety concept cannot be assessed or claimed safe without these system-level inputs.", "SAFETY"));
  }
  return items;
}

function detectContradictions(sourceText: string): EngineeringContradiction[] {
  const text = sourceText.toLowerCase();
  const contradictions: EngineeringContradiction[] = [];
  const add = (id: string, objectiveA: string, objectiveB: string, conflict: string, severity: EngineeringContradiction["severity"], resolutionPrinciples: string[]) => contradictions.push({
    id, objectiveA, objectiveB, conflict, severity, truthStatus: "UNVERIFIED", resolutionPrinciples, requiredEvidence: ["Quantified requirements", "Trade-study criteria", "Prototype or CAE/physical test evidence"],
  });
  if (hasAny(text, ["low weight", "lightweight", "minimum mass"]) && hasAny(text, ["high strength", "strong", "high stiffness"])) add("CONTRADICTION-MASS-STRENGTH", "low mass", "high strength or stiffness", "Reducing section or density can conflict with strength, stiffness, buckling margin, and fatigue life. No universal geometry resolves this automatically.", "HIGH", ["Load-path redesign", "Material substitution with evidence", "Topology or section optimization", "Function separation"]);
  if (hasAny(text, ["low cost", "cheap", "affordable"]) && hasAny(text, ["high energy absorption", "crash", "impact"])) add("CONTRADICTION-COST-ABSORPTION", "low cost", "high energy absorption", "Energy-management performance typically requires controlled deformation, validation, and production controls that may conflict with low cost.", "HIGH", ["Progressive deformation architecture", "Modular sacrificial elements", "Material/process trade study", "System-level energy redistribution"]);
  if (hasAny(text, ["easy manufacturing", "simple manufacturing", "manufacturable"]) && hasAny(text, ["graded", "complex", "lattice", "metamaterial"])) add("CONTRADICTION-MFG-COMPLEXITY", "simple manufacturing", "complex or graded architecture", "Unconventional internal structures may conflict with repeatable, inspectable, low-cost production.", "MEDIUM", ["Separate functional layers", "Use manufacturable surrogate geometry", "Hybrid assembly", "Process capability study"]);
  if (hasAny(text, ["perpetual motion", "zero energy", "no power", "infinite energy"])) contradictions.push({
    id: "CONTRADICTION-PHYSICS-001", objectiveA: "requested mechanism", objectiveB: "conservation laws", conflict: "The stated mechanism conflicts with established conservation constraints under the supplied description.", severity: "HIGH", truthStatus: "PHYSICS_CONFLICT", resolutionPrinciples: ["Define an external energy source", "Reframe the objective as energy recovery", "Measure the actual energy budget"], requiredEvidence: ["Energy balance", "Independent experimental verification"],
  });
  return contradictions;
}

function alternativesFor(sourceText: string): DesignAlternative[] {
  const text = sourceText.toLowerCase();
  const occupant = hasAny(text, ["occupant", "seat", "vehicle", "automotive", "crash"]);
  const alternatives = occupant ? [
    ["Progressive energy-management architecture", "Stage deformation or restraint-force response so energy is managed across multiple events rather than one abrupt mechanism.", "Progressive load-path and energy redistribution."],
    ["Package-aware modular architecture", "Separate the structural, occupant-interface, and replaceable energy-management functions to preserve serviceability and enable package trade-offs.", "Function integration without coupling every risk into one component."],
    ["Kinematic-control architecture", "Control relative motion using geometry, travel limits, and staged engagement before relying on material collapse behavior.", "Mechanism and motion-path control."],
  ] : [
    ["Direct load-path architecture", "Route anticipated loads through simple, inspectable primary members and avoid non-load-bearing geometry becoming a hidden structural path.", "Load-path redesign."],
    ["Distributed-function architecture", "Separate stiffness, mounting, energy-management, and service functions so each can be tested and revised independently.", "Function separation and modularity."],
    ["Progressive-response architecture", "Use staged geometry or compliant elements to avoid concentrating all response into a single brittle or overloaded feature.", "Multi-stage behavior and controlled deformation."],
  ];
  return alternatives.map(([title, architecture, mechanism], index) => ({
    id: `CONCEPT-${String.fromCharCode(65 + index)}`,
    title,
    architecture,
    mechanism,
    tradeoffs: ["No performance claim is made without defined requirements and validation evidence.", "Changes the risk distribution rather than eliminating it."],
    truthStatus: "HYPOTHETICAL",
    confidence: 0.35,
    requiredEvidence: ["Requirements traceability", "Geometry feasibility", "Load-case definition", "CAE or experimental verification"],
    rank: index + 1,
    rankingRationale: index === 0 ? "Ranked first as a starting investigation, not as a proven winner." : "Alternative architecture retained to prevent premature convergence on the first concept.",
  }));
}

function redTeamFor(sourceText: string): RedTeamFinding[] {
  const text = sourceText.toLowerCase();
  const vehicle = hasAny(text, ["occupant", "seat", "vehicle", "automotive", "crash"]);
  const generic: RedTeamFinding[] = [
    { id: "RED-STRUCTURAL", category: "STRUCTURAL", finding: "Structural load paths and local stress concentrations have not been analyzed.", applicability: "UNKNOWN", truthStatus: "UNKNOWN", evidenceNeeded: ["Load cases", "Material model", "FEA or physical test"] },
    { id: "RED-MFG", category: "MANUFACTURING", finding: "Manufacturing capability, tolerances, inspection, and cost have not been demonstrated.", applicability: "UNKNOWN", truthStatus: "UNKNOWN", evidenceNeeded: ["Process plan", "Tolerance stack", "Supplier/process evidence"] },
    { id: "RED-ASSEMBLY", category: "ASSEMBLY", finding: "Interfaces, fasteners, assembly sequence, and service access remain undefined.", applicability: "UNKNOWN", truthStatus: "UNKNOWN", evidenceNeeded: ["Interface control document", "Assembly study"] },
  ];
  if (vehicle) generic.push(
    { id: "RED-SAFETY", category: "SAFETY", finding: "Occupant interaction, restraint timing, injury criteria, and crash-pulse sensitivity are not evaluated.", applicability: "UNKNOWN", truthStatus: "UNKNOWN", evidenceNeeded: ["System-level crash requirements", "Validated occupant model or physical test"] },
    { id: "RED-INTEGRATION", category: "INTEGRATION", finding: "Vehicle package, adjacent systems, and deployment constraints are unknown.", applicability: "UNKNOWN", truthStatus: "UNKNOWN", evidenceNeeded: ["Vehicle package data", "Integration review"] },
  );
  return generic;
}

function makeEvidenceChain(known: EngineeringStatement[], assumptions: EngineeringStatement[], limitations: EngineeringStatement[]): EngineeringEvidenceChain {
  const result = statement({
    id: "RESULT-NO-PHYSICAL-VALIDATION",
    text: "No physical performance result has been calculated, simulated, or experimentally verified by this review.",
    truthStatus: "UNVERIFIED",
    confidence: 1,
    source: "DETERMINISTIC_RULE",
    discipline: "VERIFICATION",
    provenance: "The review has no solver output, test record, or verified material dataset.",
    traceabilityIds: ["REVIEW-METHOD-001"],
  });
  return { id: "EVIDENCE-CHAIN-001", conclusionId: result.id, inputs: known, assumptions, method: "Deterministic prompt audit, contradiction rules, and evidence-gap analysis. This is not a physics solver, material database, CAE run, experiment, patent search, certification review, or manufacturing qualification.", results: [result], limitations };
}

export function runRuthlessEngineeringReview(input: EngineeringReviewInput): RuthlessEngineeringReview {
  const sourceText = input.sourceText.trim();
  if (!sourceText) throw new Error("Engineering review requires a non-empty problem statement.");
  const lower = sourceText.toLowerCase();
  const unknowns = detectUnknowns(sourceText);
  const assumptions = extractExplicitAssumptions(sourceText);
  const contradictions = detectContradictions(sourceText);
  const physicsConflict = contradictions.some((item) => item.truthStatus === "PHYSICS_CONFLICT");
  const geometry = input.geometryStatus ?? "NOT_GENERATED";
  const known = [statement({ id: "KNOWN-OBJECTIVE-001", text: `The user requested: ${sourceText}`, truthStatus: "FACT", confidence: 1, source: "USER_INPUT", discipline: "SYSTEM", provenance: "Direct user-provided statement; this confirms intent, not feasibility or performance.", traceabilityIds: ["USER-REQUEST-001"] })];
  const constraints = contradictions.map((item) => statement({ id: `CONSTRAINT-${item.id}`, text: `${item.objectiveA} versus ${item.objectiveB}: ${item.conflict}`, truthStatus: item.truthStatus, confidence: 1, source: "DETERMINISTIC_RULE", discipline: "SYSTEM", provenance: "Deterministic contradiction rule triggered by stated objectives.", traceabilityIds: [item.id] }));
  const physics = physicsConflict ? [statement({ id: "PHYSICS-CONFLICT-001", text: "The requested mechanism conflicts with an established conservation constraint as stated.", truthStatus: "PHYSICS_CONFLICT", confidence: 1, source: "DETERMINISTIC_RULE", discipline: "PHYSICS", provenance: "Rule-triggered physics conflict; a defined external energy source or revised objective is required.", traceabilityIds: ["CONTRADICTION-PHYSICS-001"] })] : [statement({ id: "PHYSICS-UNKNOWN-001", text: "No force, load case, boundary condition, material model, or solver result was supplied; physical behavior remains unverified.", truthStatus: "UNVERIFIED", confidence: 1, source: "NOT_PROVIDED", discipline: "PHYSICS", provenance: "Absence of solver/test inputs prevents a physical validation claim.", traceabilityIds: ["UNKNOWN-LOAD-001"] })];
  const limitations = [statement({ id: "LIMITATION-CAE-001", text: "No CAE solver, mesh, material model, boundary condition, convergence record, or result file was used.", truthStatus: "UNVERIFIED", confidence: 1, source: "NOT_PROVIDED", discipline: "VERIFICATION", provenance: "Phase 3.6 has not started CAE.", traceabilityIds: [] }), statement({ id: "LIMITATION-MFG-001", text: "No manufacturing capability, certification, patent, material database, or test evidence was consulted.", truthStatus: "UNKNOWN", confidence: 1, source: "NOT_PROVIDED", discipline: "MANUFACTURING", provenance: "No external evidence source was provided or invoked.", traceabilityIds: [] })];
  const alternatives = alternativesFor(sourceText);
  const redTeam = redTeamFor(sourceText);
  const difficult = unknowns.length >= 3 || contradictions.length > 0 || hasAny(lower, ["revolutionary", "extreme", "safety", "crash", "automotive"]);
  const difficultyLevel = (physicsConflict ? 5 : difficult ? 3 : 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  const gate = physicsConflict ? "BLOCKED" : unknowns.some((item) => item.blocking) ? "CONCEPTUAL_ONLY" : "CAD_ELIGIBLE";
  const verdict = physicsConflict ? "THIS_APPROACH_FAILS_BECAUSE" : unknowns.length >= 4 ? "THE_CONCEPT_IS_WEAK" : "THE_CONCEPT_IS_PROMISING_BUT_RISKS_REMAIN";
  const verdictReason = physicsConflict ? "The stated mechanism conflicts with physics under the supplied description. Define an external energy source or revise the objective." : unknowns.length >= 4 ? "The request lacks the geometry, material, load, and verification inputs needed to support a feasibility claim." : "The stated objective can be explored, but no physical, manufacturing, safety, or performance validation exists.";
  const nextTest = statement({ id: "NEXT-TEST-001", text: physicsConflict ? "Create an energy balance and define the external energy source before proceeding." : "Convert the blocking unknowns into measurable requirements, then define a geometry, load case, material, and verification method before any performance claim.", truthStatus: "DERIVED", confidence: 1, source: "DETERMINISTIC_RULE", discipline: "VERIFICATION", provenance: "Derived from unresolved evidence gaps and review gate.", traceabilityIds: unknowns.filter((item) => item.blocking).map((item) => item.id) });
  const evidenceChains = [makeEvidenceChain(known, assumptions, limitations)];
  return {
    reviewId: `REVIEW-${Date.now()}-${++reviewCounter}`,
    sourceText,
    exploratoryMode: Boolean(input.exploratoryMode),
    understanding: known[0], known, unknown: unknowns, assumptions, constraints, physics, contradictions, alternatives, redTeam, evidenceChains,
    verdict, verdictReason, gate, difficultyLevel,
    reality: { geometry, physics: physicsConflict ? "PHYSICS_CONFLICT" : "NOT_ANALYZED", manufacturing: "NOT_ASSESSED", productionReadiness: "NOT_READY" },
    selfCritique: {
      couldBeWrong: ["The deterministic keyword rules may not capture all domain constraints or user intent."],
      weakestAssumptions: assumptions.length ? assumptions.map((item) => item.text) : ["No explicit user assumption was supplied; unprovided engineering inputs remain UNKNOWN rather than assumed."],
      missingData: unknowns.map((item) => item.question),
      nonValidatedClaims: ["No structural, fatigue, thermal, crash, cost, manufacturability, safety, or certification result is validated."],
      overlookedAlternatives: ["Additional alternatives may emerge after requirements, interfaces, and load paths are quantified."],
      correctedStatement: "A geometrically generated model would establish geometry only; it would not establish physical validity, safety, manufacturability, or production readiness.",
    },
    nextTest,
    limitations,
  };
}
