import type {
  OpenQuestion,
  Requirement,
  RequirementCategory,
  RequirementConflict,
  RequirementParseResult,
  RequirementSet,
  TraceabilityLink,
  UnitConversion,
  ValidationRule,
} from "../shared/requirements";

const UNIT_FACTORS: Record<string, { dimension: UnitConversion["dimension"]; factor: number; normalizedUnit: string }> = {
  mm: { dimension: "LENGTH", factor: 1, normalizedUnit: "mm" },
  millimeter: { dimension: "LENGTH", factor: 1, normalizedUnit: "mm" },
  millimeters: { dimension: "LENGTH", factor: 1, normalizedUnit: "mm" },
  cm: { dimension: "LENGTH", factor: 10, normalizedUnit: "mm" },
  centimeter: { dimension: "LENGTH", factor: 10, normalizedUnit: "mm" },
  centimeters: { dimension: "LENGTH", factor: 10, normalizedUnit: "mm" },
  m: { dimension: "LENGTH", factor: 1000, normalizedUnit: "mm" },
  meter: { dimension: "LENGTH", factor: 1000, normalizedUnit: "mm" },
  meters: { dimension: "LENGTH", factor: 1000, normalizedUnit: "mm" },
  in: { dimension: "LENGTH", factor: 25.4, normalizedUnit: "mm" },
  inch: { dimension: "LENGTH", factor: 25.4, normalizedUnit: "mm" },
  inches: { dimension: "LENGTH", factor: 25.4, normalizedUnit: "mm" },
  ft: { dimension: "LENGTH", factor: 304.8, normalizedUnit: "mm" },
  foot: { dimension: "LENGTH", factor: 304.8, normalizedUnit: "mm" },
  feet: { dimension: "LENGTH", factor: 304.8, normalizedUnit: "mm" },
  degrees: { dimension: "ANGLE", factor: 1, normalizedUnit: "degrees" },
  degree: { dimension: "ANGLE", factor: 1, normalizedUnit: "degrees" },
  radians: { dimension: "ANGLE", factor: 180 / Math.PI, normalizedUnit: "degrees" },
  radian: { dimension: "ANGLE", factor: 180 / Math.PI, normalizedUnit: "degrees" },
  kg: { dimension: "MASS", factor: 1, normalizedUnit: "kg" },
  kilogram: { dimension: "MASS", factor: 1, normalizedUnit: "kg" },
  g: { dimension: "MASS", factor: 0.001, normalizedUnit: "kg" },
  gram: { dimension: "MASS", factor: 0.001, normalizedUnit: "kg" },
  grams: { dimension: "MASS", factor: 0.001, normalizedUnit: "kg" },
  n: { dimension: "FORCE", factor: 1, normalizedUnit: "N" },
  kn: { dimension: "FORCE", factor: 1000, normalizedUnit: "N" },
  pa: { dimension: "PRESSURE", factor: 1, normalizedUnit: "Pa" },
  kpa: { dimension: "PRESSURE", factor: 1000, normalizedUnit: "Pa" },
  mpa: { dimension: "PRESSURE", factor: 1_000_000, normalizedUnit: "Pa" },
  gpa: { dimension: "PRESSURE", factor: 1_000_000_000, normalizedUnit: "Pa" },
  "n·m": { dimension: "TORQUE", factor: 1, normalizedUnit: "N·m" },
  "n*m": { dimension: "TORQUE", factor: 1, normalizedUnit: "N·m" },
};

const LENGTH_WORDS: Record<string, string> = {
  long: "length",
  length: "length",
  wide: "width",
  width: "width",
  deep: "depth",
  depth: "depth",
  high: "height",
  height: "height",
  thick: "thickness",
  thickness: "thickness",
  diameter: "diameter",
  hole: "diameter",
  holes: "diameter",
  radius: "radius",
  fillet: "radius",
};

function cleanUnit(unit: string) {
  return unit.toLowerCase().replace(/\s+/g, "").replace(/μ/g, "µ");
}

export function normalizeUnit(value: number, unit: string): UnitConversion {
  const definition = UNIT_FACTORS[cleanUnit(unit)];
  if (!definition) throw new Error(`Unsupported or ambiguous unit: ${unit}`);
  return {
    inputValue: value,
    inputUnit: unit,
    normalizedValue: Number((value * definition.factor).toFixed(9)),
    normalizedUnit: definition.normalizedUnit,
    dimension: definition.dimension,
  };
}

function nextId(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function categoryFor(parameter: string): RequirementCategory {
  if (["width", "length", "depth", "height", "thickness", "diameter", "radius"].includes(parameter)) return "DIMENSION";
  if (parameter === "material") return "MATERIAL";
  if (parameter === "load") return "LOAD";
  if (parameter === "manufacturing") return "MANUFACTURING";
  return "UNKNOWN";
}

function rule(id: string, type: ValidationRule["type"], description: string, passed: boolean): ValidationRule {
  return { id, type, description, passed };
}

function makeDimensionRequirement(index: number, parameter: string, value: number, unit: string, source: Requirement["source"], description: string): Requirement {
  const normalized = normalizeUnit(value, unit);
  const positive = normalized.normalizedValue > 0;
  const requirementId = nextId("REQ-DIM", index);
  return {
    requirement_id: requirementId,
    category: categoryFor(parameter),
    parameter,
    description,
    value: normalized.normalizedValue,
    unit: normalized.normalizedUnit,
    source,
    confidence: 1,
    status: positive ? "VALIDATED" : "REJECTED",
    dependencies: [],
    validation_rules: [
      rule(`${requirementId}-UNIT`, "UNIT", `Normalize ${unit} to ${normalized.normalizedUnit}.`, true),
      rule(`${requirementId}-RANGE`, "RANGE", "Dimension must be greater than zero.", positive),
    ],
    revision: 1,
  };
}

function parseDimensions(text: string, source: Requirement["source"]): Requirement[] {
  const requirements: Requirement[] = [];
  const pattern = /(?:([\d.]+)\s*(mm|millimeters?|cm|centimeters?|m|meters?|in|inches?|ft|feet|degrees?|radians?|kg|g|kn|n|kpa|mpa|gpa|pa|n[·*]m))\s*(?:([a-z]+)|(?:diameter|Ø))?/gi;
  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = pattern.exec(text))) {
    const rawValue = Number(match[1]);
    const unit = match[2];
    const before = text.slice(Math.max(0, match.index - 18), match.index).toLowerCase();
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 18).toLowerCase();
    const afterLabel = Object.entries(LENGTH_WORDS).find(([word]) => new RegExp(`\\b${word}\\b`).test(after))?.[1];
    const beforeLabel = Object.entries(LENGTH_WORDS).reverse().find(([word]) => new RegExp(`\\b${word}\\b`).test(before))?.[1];
    const capturedLabel = match[3] ? LENGTH_WORDS[match[3].toLowerCase()] : undefined;
    const parameter = capturedLabel ?? afterLabel ?? beforeLabel ?? "dimension";
    requirements.push(makeDimensionRequirement(index, parameter, rawValue, unit, source, match[0].trim()));
    index += 1;
  }
  return requirements;
}

function parseNamedUpdates(text: string, source: Requirement["source"]): Requirement[] {
  const requirements: Requirement[] = [];
  const pattern = /(?:make|change|set)\s+(?:the\s+)?(width|length|depth|height|thickness|diameter|radius)\s+(?:to\s+)?([\d.]+)\s*(mm|millimeters?|cm|centimeters?|m|meters?|in|inches?|ft|feet)/gi;
  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = pattern.exec(text))) {
    requirements.push(makeDimensionRequirement(index, match[1].toLowerCase(), Number(match[2]), match[3], source, match[0]));
    index += 1;
  }
  return requirements;
}

function parseMaterial(text: string, source: Requirement["source"]): Requirement[] {
  const match = text.match(/(?:use|material(?:\s+is)?|made\s+of)\s+(aluminum|aluminium|steel|stainless steel|plastic|carbon fiber)/i);
  if (!match) return [];
  const id = "REQ-MAT-001";
  return [{
    requirement_id: id,
    category: "MATERIAL",
    parameter: "material",
    description: match[0],
    value: match[1],
    source,
    confidence: 1,
    status: "VALIDATED",
    dependencies: [],
    validation_rules: [rule(`${id}-PRESENCE`, "COMPLETENESS", "Material is explicitly stated.", true)],
    revision: 1,
  }];
}

function detectConflicts(requirements: Requirement[]): RequirementConflict[] {
  const groups = new Map<string, Requirement[]>();
  for (const requirement of requirements) {
    const key = `${requirement.category}:${requirement.parameter ?? requirement.requirement_id}`;
    groups.set(key, [...(groups.get(key) ?? []), requirement]);
  }
  return [...groups.entries()].flatMap(([key, group], index) => {
    const values = group.map((item) => item.value).filter((value): value is number => typeof value === "number");
    const distinct = [...new Set(values)];
    if (distinct.length < 2) return [];
    const ids = group.map((item) => item.requirement_id);
    return [{
      id: nextId("REQUIREMENT-CONFLICT", index + 1),
      conflicting_requirements: ids,
      explanation: `${key} has multiple incompatible values: ${distinct.join(", ")}.`,
      recommended_resolution: "Choose the intended value or explicitly create a new revision; do not resolve silently.",
    }];
  });
}

function detectOpenQuestions(text: string, requirements: Requirement[]): OpenQuestion[] {
  const normalized = text.toLowerCase();
  const questions: OpenQuestion[] = [];
  if (/bracket|load-bearing/.test(normalized) && !/\d+\s*(n|kn)\b/.test(normalized)) {
    questions.push({ id: "OPEN-LOAD-001", question: "What mounting load must the part withstand?", whyItMatters: "A load-bearing design cannot be validated without a quantified load case.", severity: "CRITICAL", relatedRequirementIds: requirements.map((item) => item.requirement_id) });
  }
  if (/bracket|part|component/.test(normalized) && !/aluminum|aluminium|steel|stainless steel|plastic|carbon fiber/.test(normalized)) {
    questions.push({ id: "OPEN-MATERIAL-001", question: "What material should be used?", whyItMatters: "Material affects strength, mass, manufacturability, and downstream validation.", severity: "CRITICAL", relatedRequirementIds: requirements.map((item) => item.requirement_id) });
  }
  if (/bracket|part|component/.test(normalized) && !/milling|turning|drilling|sheet metal|additive|3d print|manufactur/.test(normalized)) {
    questions.push({ id: "OPEN-MANUFACTURING-001", question: "What manufacturing process is intended?", whyItMatters: "Manufacturing constraints can change feasible geometry and tolerances.", severity: "IMPORTANT", relatedRequirementIds: requirements.map((item) => item.requirement_id) });
  }
  if (!requirements.length && normalized.trim().length > 0) {
    questions.push({ id: "OPEN-SPECIFICATION-001", question: "What measurable dimensions and constraints define the requested part?", whyItMatters: "The request does not contain enough measurable information for deterministic CAD.", severity: "CRITICAL", relatedRequirementIds: [] });
  }
  return questions;
}

function buildTraceability(sourceText: string, requirements: Requirement[]): TraceabilityLink[] {
  const links: TraceabilityLink[] = [];
  requirements.forEach((requirement, index) => {
    links.push({ id: `TRACE-${index + 1}-REQUEST`, from_type: "USER_REQUEST", from_id: "USER-REQUEST-001", to_type: "REQUIREMENT", to_id: requirement.requirement_id, rationale: `Extracted from: ${sourceText}` });
    if (typeof requirement.value === "number") {
      const parameterId = `CAD-PARAM-${requirement.requirement_id}`;
      links.push({ id: `TRACE-${index + 1}-PARAM`, from_type: "REQUIREMENT", from_id: requirement.requirement_id, to_type: "CAD_PARAMETER", to_id: parameterId, rationale: "Normalized requirement value drives an editable CAD parameter." });
      links.push({ id: `TRACE-${index + 1}-FEATURE`, from_type: "CAD_PARAMETER", from_id: parameterId, to_type: "CAD_FEATURE", to_id: `FEATURE-${String(index + 1).padStart(3, "0")}`, rationale: "Parameter is consumed by the deterministic feature plan." });
    }
  });
  return links;
}

export function parseRequirements(sourceText: string, revision = 1): RequirementParseResult {
  const source = /make|change|set|actually|use|keep|new revision/i.test(sourceText) ? "CONVERSATIONAL_UPDATE" : "NATURAL_LANGUAGE" as Requirement["source"];
  const requirements = [...parseDimensions(sourceText, source), ...parseNamedUpdates(sourceText, source), ...parseMaterial(sourceText, source)];
  const triplet = sourceText.match(/([\d.]+)\s*(mm|cm|m|in|inches|ft|feet)\s*[x×]\s*([\d.]+)\s*(mm|cm|m|in|inches|ft|feet)\s*[x×]\s*([\d.]+)\s*(mm|cm|m|in|inches|ft|feet)/i);
  if (triplet) {
    const tripletValues = [
      { parameter: "length", value: Number(triplet[1]), unit: triplet[2] },
      { parameter: "width", value: Number(triplet[3]), unit: triplet[4] },
      { parameter: "height", value: Number(triplet[5]), unit: triplet[6] },
    ];
    requirements.splice(0, Math.min(3, requirements.length), ...tripletValues.map((item, index) => makeDimensionRequirement(index + 1, item.parameter, item.value, item.unit, source, `${item.value} ${item.unit} ${item.parameter}`)));
  }
  const deduplicated = requirements.filter((item, index, list) => list.findIndex((candidate) => candidate.category === item.category && candidate.description === item.description && candidate.value === item.value) === index);
  const conflicts = detectConflicts(deduplicated);
  const open_questions = detectOpenQuestions(sourceText, deduplicated);
  const status: RequirementSet["validation_status"] = conflicts.length ? "CONFLICT" : open_questions.length ? "OPEN_QUESTION" : deduplicated.length ? "VALIDATED" : "DRAFT";
  for (const requirement of deduplicated) {
    if (conflicts.some((conflict) => conflict.conflicting_requirements.includes(requirement.requirement_id))) requirement.status = "CONFLICT";
    if (open_questions.length && requirement.status === "VALIDATED") requirement.status = "OPEN_QUESTION";
    requirement.revision = revision;
  }
  const requirementSet: RequirementSet = {
    id: `REQSET-${revision}-${Date.now()}`,
    revision,
    source_text: sourceText,
    requirements: deduplicated,
    open_questions,
    conflicts,
    traceability: buildTraceability(sourceText, deduplicated),
    validation_status: status,
  };
  const normalizedText = deduplicated.map((item) => `${item.description} => ${item.value ?? ""}${item.unit ? ` ${item.unit}` : ""}`).join("; ");
  return { requirementSet, normalizedText };
}

export function applyRequirementRevision(previous: RequirementSet, updateText: string): RequirementSet {
  const parsed = parseRequirements(updateText, previous.revision + 1).requirementSet;
  const previousRequirements = previous.requirements.map((requirement) => ({ ...requirement, status: "SUPERSEDED" as const }));
  const superseded = previousRequirements.filter((requirement) => parsed.requirements.some((next) => next.parameter && next.parameter === requirement.parameter));
  const nextRequirements = parsed.requirements.map((requirement) => ({
    ...requirement,
    supersedes: superseded.find((item) => item.parameter === requirement.parameter)?.requirement_id,
  }));
  return {
    ...parsed,
    id: `REQSET-${parsed.revision}-${Date.now()}`,
    requirements: [...previousRequirements, ...nextRequirements],
    traceability: [
      ...previous.traceability,
      ...parsed.traceability.map((link) => ({ ...link, id: `${link.id}-R${parsed.revision}` })),
    ],
  };
}

export function validateRequirementSet(requirementSet: RequirementSet): RequirementSet {
  const hasFailedRules = requirementSet.requirements.some((requirement) => requirement.validation_rules.some((validation) => !validation.passed));
  if (hasFailedRules && requirementSet.validation_status === "VALIDATED") requirementSet.validation_status = "DRAFT";
  return requirementSet;
}
