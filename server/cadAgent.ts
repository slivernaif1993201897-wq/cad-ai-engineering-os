import { generateMountingBlock } from "./cadKernel";
import { planMountingBlockFeatures } from "./featurePlanner";
import { applyRequirementRevision, parseRequirements } from "./requirementsAgent";
import type { MountingBlockInput } from "../shared/cad";
import type { CADAgentResult, CADConfiguration, CADExport, CADModelStatus } from "../shared/cadAgent";
import type { RequirementSet } from "../shared/requirements";

const configurations = new Map<string, CADConfiguration>();

function canonicalMountingPrompt(input: MountingBlockInput) {
  return `Create a ${input.width} mm x ${input.depth} mm x ${input.height} mm mounting block with four ${input.holeDiameter} mm holes near the corners using a ${input.holeEdgeOffset} mm edge offset and a ${input.filletRadius} mm fillet.`;
}

function prepareRequirements(input: MountingBlockInput, sourceText: string): RequirementSet {
  const parsed = parseRequirements(sourceText).requirementSet;
  if (parsed.validation_status === "VALIDATED") return parsed;
  const onlyMissingSpecification = parsed.conflicts.length === 0 && parsed.open_questions.every((question) => question.id === "OPEN-SPECIFICATION-001");
  if (onlyMissingSpecification && /mounting block/i.test(sourceText)) {
    const structured = parseRequirements(canonicalMountingPrompt(input)).requirementSet;
    structured.source_text = sourceText;
    return structured;
  }
  return parsed;
}

function conceptualResult(configuration: CADConfiguration, error: string): CADAgentResult {
  return { configuration, plan: configuration.plan, error };
}

function configurationId(name: string, revision: number) {
  return `CONFIG-${name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase()}-R${revision}`;
}

export async function createMountingBlockConfiguration(args: {
  name: string;
  input: MountingBlockInput;
  sourceText: string;
  conceptual?: boolean;
}): Promise<CADAgentResult> {
  const requirementSet = prepareRequirements(args.input, args.sourceText);
  const plan = planMountingBlockFeatures(requirementSet, args.input, `PLAN-${args.name.toUpperCase().replace(/\s+/g, "-")}-R${requirementSet.revision}`);
  const id = configurationId(args.name, requirementSet.revision);
  const blocked = requirementSet.validation_status !== "VALIDATED";
  const baseConfiguration: CADConfiguration = {
    id,
    name: args.name,
    revision: requirementSet.revision,
    createdAt: new Date().toISOString(),
    input: args.input,
    requirementSet,
    plan,
    modelStatus: blocked ? "CONCEPTUAL" : "GENERATED",
  };
  if (blocked) {
    configurations.set(id, baseConfiguration);
    return conceptualResult(baseConfiguration, args.conceptual
      ? `Conceptual CAD plan created without geometry: RequirementSet is ${requirementSet.validation_status}. The OpenCascade kernel remains blocked until requirements are validated.`
      : `CAD Agent stopped: RequirementSet is ${requirementSet.validation_status}. Resolve requirements or explicitly request a conceptual plan.`);
  }
  if (configurations.has(id)) return conceptualResult(baseConfiguration, `Configuration ${id} already exists; create a new configuration name rather than overwriting it.`);

  const kernelResult = await generateMountingBlock(args.input, canonicalMountingPrompt(args.input));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus;
  plan.features = plan.features.map((feature) => ({
    ...feature,
    status: kernelResult.artifact?.featureTree.find((item) => item.type === feature.type || ((feature.featureType === "HOLE" || feature.featureType === "PATTERN" || feature.featureType === "CUT") && item.type === "HOLE_PATTERN"))?.status ?? "FAILED",
    executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED",
  }));
  const configuration: CADConfiguration = { ...baseConfiguration, requirementSet, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, modelStatus };
  configurations.set(id, configuration);
  return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error };
}

export async function reviseMountingBlockConfiguration(args: {
  configurationId: string;
  name?: string;
  inputPatch: Partial<MountingBlockInput>;
  updateText: string;
}): Promise<CADAgentResult> {
  const previous = configurations.get(args.configurationId);
  if (!previous) throw new Error(`Unknown configuration: ${args.configurationId}`);
  const input = { ...previous.input, ...args.inputPatch };
  const revisedRequirementSet = applyRequirementRevision(previous.requirementSet, args.updateText);
  const revision = previous.revision + 1;
  const name = args.name ?? previous.name;
  const id = configurationId(name, revision);
  const plan = planMountingBlockFeatures(revisedRequirementSet, input, `PLAN-${name.toUpperCase().replace(/\s+/g, "-")}-R${revision}`);
  const kernelResult = await generateMountingBlock(input, canonicalMountingPrompt(input));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus;
  plan.revision = revision;
  plan.requirement_set_id = revisedRequirementSet.id;
  plan.features = plan.features.map((feature) => ({ ...feature, executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED" }));
  const configuration: CADConfiguration = { id, name, revision, createdAt: new Date().toISOString(), input, requirementSet: revisedRequirementSet, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, modelStatus };
  configurations.set(id, configuration);
  return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error };
}

export function listConfigurations(): CADConfiguration[] {
  return [...configurations.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getValidatedStepExport(configurationId: string): CADExport {
  const configuration = configurations.get(configurationId);
  if (!configuration) throw new Error(`Unknown configuration: ${configurationId}`);
  if (configuration.modelStatus !== "VALIDATED" || configuration.artifact?.validationStatus !== "VALID" || !configuration.artifact.stepBase64 || !configuration.artifact.stepByteLength) {
    throw new Error("STEP export blocked: the selected configuration does not have a validated OpenCascade artifact.");
  }
  return {
    configurationId,
    revision: configuration.revision,
    format: "STEP",
    fileName: `${configuration.name.replace(/\s+/g, "-").toLowerCase()}-r${configuration.revision}.step`,
    mimeType: "application/step",
    stepBase64: configuration.artifact.stepBase64,
    byteLength: configuration.artifact.stepByteLength,
    validationStatus: "VALID",
  };
}

export function markConfigurationStale(configurationId: string): CADConfiguration {
  const configuration = configurations.get(configurationId);
  if (!configuration) throw new Error(`Unknown configuration: ${configurationId}`);
  const stale = { ...configuration, modelStatus: "STALE" as const, plan: { ...configuration.plan, model_status: "STALE" as const } };
  configurations.set(configurationId, stale);
  return stale;
}
