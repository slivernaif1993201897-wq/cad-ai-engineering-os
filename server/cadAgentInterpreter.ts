import type { EngineeringCapability } from "../shared/capabilityRegistry";

export type ExtractedEngineeringParameter = { name: string; value: number | string; unit?: string; normalizedValue?: number; normalizedUnit?: string; source: "USER_COMMAND"; confidence: "EXPLICIT" };
export type EngineeringCommandInterpretation = {
  normalizedCommand: string;
  intent: string;
  engineeringTerms: string[];
  parameters: ExtractedEngineeringParameter[];
  references: string[];
  missingInputs: string[];
  ambiguity: string[];
};
export type EngineeringOperationPlan = {
  planId: string;
  capabilityId: string;
  intent: string;
  prerequisites: Array<{ requirement: string; status: "SATISFIED" | "REQUIRED_INPUT" | "UNSUPPORTED"; evidence: string }>;
  steps: Array<{ order: number; stage: "CONTEXT_RETRIEVAL" | "CAPABILITY_RESOLUTION" | "PARAMETER_VALIDATION" | "PRECONDITION_CHECK" | "CONFIRMATION" | "EXECUTION" | "POSTCONDITION_CHECK" | "PROVENANCE"; status: "READY" | "BLOCKED" | "PENDING"; detail: string }>;
  postconditions: string[];
  errorRecovery: string[];
};

const numberUnits = /(?:\b(width|height|thickness|depth|diameter|radius|distance|spacing|angle|recline)\b\s*(?:of|=|:|to)?\s*)?(\d+(?:\.\d+)?)\s*(mm|cm|m|in|inch|inches|deg|degree|degrees|°)\b/gi;
const countWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

function normalizedUnit(value: number, unit: string) {
  const lower = unit.toLowerCase();
  if (lower === "cm") return { normalizedValue: value * 10, normalizedUnit: "mm" };
  if (lower === "m") return { normalizedValue: value * 1000, normalizedUnit: "mm" };
  if (["in", "inch", "inches"].includes(lower)) return { normalizedValue: value * 25.4, normalizedUnit: "mm" };
  if (["deg", "degree", "degrees", "°"].includes(lower)) return { normalizedValue: value, normalizedUnit: "deg" };
  return { normalizedValue: value, normalizedUnit: "mm" };
}

function canonicalParameterName(value: string) {
  const lower = value.toLowerCase();
  if (lower === "wide") return "WIDTH";
  if (["high", "tall"].includes(lower)) return "HEIGHT";
  if (lower === "thick") return "THICKNESS";
  if (lower === "deep") return "DEPTH";
  if (lower === "apart") return "SPACING";
  if (lower === "recline") return "ANGLE";
  return lower.toUpperCase();
}

export function interpretEngineeringCommand(message: string): EngineeringCommandInterpretation {
  const normalizedCommand = message.trim().replace(/\s+/g, " "); const lower = normalizedCommand.toLowerCase(); const parameters: ExtractedEngineeringParameter[] = [];
  for (const match of lower.matchAll(numberUnits)) { const value = Number(match[2]); const unit = match[3]; const suffix = lower.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 20); const suffixLabel = /^\s*(wide|high|tall|thick|deep|diameter|radius|apart|spacing|recline)/.exec(suffix)?.[1]; const normalized = normalizedUnit(value, unit); parameters.push({ name: canonicalParameterName(match[1] ?? suffixLabel ?? "DIMENSION"), value, unit, ...normalized, source: "USER_COMMAND", confidence: "EXPLICIT" }); }
  const countMatch = lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:mounting\s+)?(?:holes|instances|components)/); if (countMatch) { const value = /^\d+$/.test(countMatch[1]) ? Number(countMatch[1]) : countWords[countMatch[1]]; parameters.push({ name: "COUNT", value, source: "USER_COMMAND", confidence: "EXPLICIT" }); }
  const terms = ["seat", "cushion", "backrest", "frame", "mounting hole", "assembly", "revision", "CAE", "mesh", "solver", "CalculiX", "Gmsh", "BOM", "STEP", "interference", "constraint", "mate", "drawing", "toolpath"].filter((term) => lower.includes(term.toLowerCase()));
  const references = ["assembly", "revision", "artifact", "component", "CAD file", "STEP"].filter((term) => lower.includes(term.toLowerCase()));
  const missingInputs: string[] = []; const ambiguity: string[] = [];
  if (/\b(create|add|modify)\b/.test(lower) && !parameters.length && !/\b(bom|revision)\b/.test(lower)) missingInputs.push("Explicit dimensions with units");
  if (/\b(?:mounting\s+)?holes?\b/.test(lower)) { if (!parameters.some((parameter) => parameter.name === "DIAMETER")) missingInputs.push("Hole diameter with unit"); if (!parameters.some((parameter) => parameter.name === "DEPTH")) missingInputs.push("Hole depth or through-all definition"); if (!lower.includes("coordinate") && !lower.includes("reference")) missingInputs.push("Stable target reference or coordinates"); }
  if (/\b(seat cushion|backrest frame)\b/.test(lower)) { missingInputs.push("Supported parametric template or complete geometry definition"); ambiguity.push("The current controlled CAD generator does not infer a generic cushion or frame geometry from a single dimension."); }
  if (/\b(recline limit)\b/.test(lower)) missingInputs.push("Supported joint/constraint solver and stable assembly references");
  return { normalizedCommand, intent: terms.length ? terms.join(" · ") : "engineering context inspection", engineeringTerms: terms, parameters, references, missingInputs: [...new Set(missingInputs)], ambiguity };
}

export function buildEngineeringOperationPlan(input: { commandId: string; capability: EngineeringCapability; interpretation: EngineeringCommandInterpretation; safety: string; requiresConfirmation: boolean; assemblyEntityId?: string }): EngineeringOperationPlan {
  const prerequisite = (requirement: string) => {
    if (requirement.toLowerCase().includes("confirmation")) return { requirement, status: input.requiresConfirmation ? "REQUIRED_INPUT" as const : "SATISFIED" as const, evidence: input.requiresConfirmation ? "User confirmation has not been supplied." : "User confirmation supplied." };
    if (requirement.toLowerCase().includes("assembly") && !input.assemblyEntityId) return { requirement, status: "REQUIRED_INPUT" as const, evidence: "No saved assembly entity is selected." };
    if (input.interpretation.missingInputs.some((item) => requirement.toLowerCase().includes(item.toLowerCase().split(" ")[0]))) return { requirement, status: "REQUIRED_INPUT" as const, evidence: "The command does not contain this explicit required input." };
    if (["UNSUPPORTED", "BLOCKED"].includes(input.capability.status)) return { requirement, status: "UNSUPPORTED" as const, evidence: `Capability registry status is ${input.capability.status}.` };
    return { requirement, status: "SATISFIED" as const, evidence: "Registered prerequisite is satisfied by project context or explicit command input." };
  };
  const prerequisites = [...input.capability.requiredParameters, ...input.interpretation.missingInputs].map(prerequisite);
  const blocked = prerequisites.some((item) => item.status !== "SATISFIED") || ["UNSUPPORTED", "BLOCKED"].includes(input.safety) || ["UNSUPPORTED", "BLOCKED"].includes(input.capability.status);
  const step = (order: number, stage: EngineeringOperationPlan["steps"][number]["stage"], detail: string, status: "READY" | "BLOCKED" | "PENDING") => ({ order, stage, detail, status });
  return { planId: `PLAN-${input.commandId}`, capabilityId: input.capability.capabilityId, intent: input.interpretation.intent, prerequisites, steps: [step(1, "CONTEXT_RETRIEVAL", "Retrieve only the authorized project context, current assembly selection, persisted artifact bindings, registry snapshot, and evidence state.", "READY"), step(2, "CAPABILITY_RESOLUTION", `${input.capability.capabilityId} resolves to registry status ${input.capability.status}.`, input.capability.status === "VERIFIED" || input.capability.status === "PARTIAL" ? "READY" : "BLOCKED"), step(3, "PARAMETER_VALIDATION", input.interpretation.parameters.length ? `${input.interpretation.parameters.length} explicit user parameter(s) with normalized units were extracted.` : "No engineering parameter was inferred from the command.", input.interpretation.missingInputs.length ? "BLOCKED" : "READY"), step(4, "PRECONDITION_CHECK", blocked ? "Execution prerequisites are incomplete, unsupported, or blocked." : "Registered preconditions are satisfied.", blocked ? "BLOCKED" : "READY"), step(5, "CONFIRMATION", input.requiresConfirmation ? "Await explicit user confirmation before a state-changing operation." : "No additional confirmation gate applies.", input.requiresConfirmation ? "PENDING" : "READY"), step(6, "EXECUTION", blocked ? "No operation executes while plan gates are blocked." : "Only the registered controlled operation may execute.", blocked ? "BLOCKED" : "PENDING"), step(7, "POSTCONDITION_CHECK", "Validate the returned artifact/result only through the registered capability postconditions.", "PENDING"), step(8, "PROVENANCE", "Persist command, plan, registry hash, result status, and project-scoped provenance.", "READY")], postconditions: input.capability.validationRequirements, errorRecovery: ["Preserve REQUIRED_INPUT or UNSUPPORTED state; never invent missing values.", "Record rejected plan provenance and retain the immutable parent revision.", "Re-run only the registered validation after a corrected explicit input is supplied."] };
}
