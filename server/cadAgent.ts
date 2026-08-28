import { generateMountingBlock } from "./cadKernel";
import { runRuthlessEngineeringReview } from "./engineeringReview";
import { runEngineeringIntelligence } from "./engineeringIntelligence";
import { planMountingBlockFeatures } from "./featurePlanner";
import { applyRequirementRevision, parseRequirements } from "./requirementsAgent";
import type { MountingBlockInput } from "../shared/cad";
import type { CADAgentResult, CADConfiguration, CADExport, CADModelStatus } from "../shared/cadAgent";
import type { RequirementSet } from "../shared/requirements";
import { runWithOpenCascadeAdmission } from "./runtimeAdmission";

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
  const initialReview = runRuthlessEngineeringReview({ sourceText: args.sourceText, exploratoryMode: args.conceptual, geometryStatus: "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: id });
  const blocked = requirementSet.validation_status !== "VALIDATED" || initialReview.gate === "BLOCKED";
  const baseConfiguration: CADConfiguration = {
    id,
    name: args.name,
    revision: requirementSet.revision,
    createdAt: new Date().toISOString(),
    sourceText: args.sourceText,
    input: args.input,
    requirementSet,
    engineeringReview: initialReview,
    plan,
    modelStatus: blocked ? "CONCEPTUAL" : "GENERATED",
  };
  if (blocked) {
    configurations.set(id, baseConfiguration);
    return conceptualResult(baseConfiguration, initialReview.gate === "BLOCKED"
      ? `CAD Agent stopped: ${initialReview.verdictReason} The engineering review recorded a PHYSICS_CONFLICT and blocks trusted geometry.`
      : args.conceptual
      ? `Conceptual CAD plan created without geometry: RequirementSet is ${requirementSet.validation_status}. The OpenCascade kernel remains blocked until requirements are validated.`
      : `CAD Agent stopped: RequirementSet is ${requirementSet.validation_status}. Resolve requirements or explicitly request a conceptual plan.`);
  }
  if (configurations.has(id)) return conceptualResult(baseConfiguration, `Configuration ${id} already exists; create a new configuration name rather than overwriting it.`);

  const kernelResult = await runWithOpenCascadeAdmission({ projectId: id, resourceClass: "CAD_AUTHORING" }, () => generateMountingBlock(args.input, canonicalMountingPrompt(args.input)));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus;
  plan.features = plan.features.map((feature) => ({
    ...feature,
    status: kernelResult.artifact?.featureTree.find((item) => item.type === feature.type || ((feature.featureType === "HOLE" || feature.featureType === "PATTERN" || feature.featureType === "CUT") && item.type === "HOLE_PATTERN"))?.status ?? "FAILED",
    executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED",
  }));
  const engineeringReview = runRuthlessEngineeringReview({ sourceText: args.sourceText, exploratoryMode: args.conceptual, geometryStatus: modelStatus === "VALIDATED" ? "GEOMETRICALLY_VALIDATED" : "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: id });
  const engineeringIntelligence = runEngineeringIntelligence({ sourceText: args.sourceText, mode: args.conceptual ? "EXPLORATION" : "NORMAL", projectId: id, geometryStatus: engineeringReview.reality.geometry });
  const configuration: CADConfiguration = { ...baseConfiguration, requirementSet, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, modelStatus, engineeringReview, engineeringIntelligence };
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
  const sourceText = `${previous.sourceText}\nRevision: ${args.updateText}`;
  const initialReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: "NOT_GENERATED", requirementSetId: revisedRequirementSet.id, configurationId: id });
  if (revisedRequirementSet.validation_status !== "VALIDATED" || initialReview.gate === "BLOCKED") {
    const conceptualConfiguration: CADConfiguration = { id, name, revision, createdAt: new Date().toISOString(), sourceText, input, requirementSet: revisedRequirementSet, engineeringReview: initialReview, plan, modelStatus: "CONCEPTUAL" };
    configurations.set(id, conceptualConfiguration);
    return conceptualResult(conceptualConfiguration, initialReview.gate === "BLOCKED" ? `CAD Agent stopped: ${initialReview.verdictReason}` : `CAD Agent stopped: RequirementSet is ${revisedRequirementSet.validation_status}.`);
  }
  const kernelResult = await runWithOpenCascadeAdmission({ projectId: id, resourceClass: "CAD_AUTHORING" }, () => generateMountingBlock(input, canonicalMountingPrompt(input)));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus;
  plan.revision = revision;
  plan.requirement_set_id = revisedRequirementSet.id;
  plan.features = plan.features.map((feature) => ({ ...feature, executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED" }));
  const engineeringReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: modelStatus === "VALIDATED" ? "GEOMETRICALLY_VALIDATED" : "NOT_GENERATED", requirementSetId: revisedRequirementSet.id, configurationId: id });
  const engineeringIntelligence = runEngineeringIntelligence({ sourceText, mode: "NORMAL", projectId: id, geometryStatus: engineeringReview.reality.geometry });
  const configuration: CADConfiguration = { id, name, revision, createdAt: new Date().toISOString(), sourceText, input, requirementSet: revisedRequirementSet, engineeringReview, engineeringIntelligence, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, modelStatus };
  configurations.set(id, configuration);
  return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error };
}

/** Computes a real kernel artifact for review without storing a configuration or changing the current branch. */
export async function previewMountingBlockConfiguration(args: {
  configurationId: string;
  inputPatch: Partial<MountingBlockInput>;
  updateText: string;
}): Promise<CADAgentResult> {
  const previous = configurations.get(args.configurationId);
  if (!previous) throw new Error(`Unknown configuration: ${args.configurationId}`);
  const input = { ...previous.input, ...args.inputPatch };
  const requirementSet = applyRequirementRevision(previous.requirementSet, args.updateText);
  const previewId = `PREVIEW-${previous.id}-${crypto.randomUUID().slice(0, 8)}`;
  const plan = planMountingBlockFeatures(requirementSet, input, `PLAN-${previewId}`);
  const sourceText = `${previous.sourceText}\nPreview only: ${args.updateText}`;
  const initialReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: previewId });
  const base: CADConfiguration = { id: previewId, name: `${previous.name} · Preview`, revision: previous.revision + 1, createdAt: new Date().toISOString(), sourceText, input, requirementSet, engineeringReview: initialReview, plan, modelStatus: "CONCEPTUAL" };
  if (requirementSet.validation_status !== "VALIDATED" || initialReview.gate === "BLOCKED") return conceptualResult(base, initialReview.gate === "BLOCKED" ? `Proposal preview blocked: ${initialReview.verdictReason}` : `Proposal preview remains conceptual because RequirementSet is ${requirementSet.validation_status}.`);
  const kernelResult = await runWithOpenCascadeAdmission({ projectId: previewId, resourceClass: "CAD_AUTHORING" }, () => generateMountingBlock(input, canonicalMountingPrompt(input)));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus; plan.revision = base.revision;
  plan.features = plan.features.map((feature) => ({ ...feature, executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED" }));
  const engineeringReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: modelStatus === "VALIDATED" ? "GEOMETRICALLY_VALIDATED" : "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: previewId });
  const configuration: CADConfiguration = { ...base, modelStatus, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, engineeringReview };
  return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error };
}

/**
 * Executes a bounded parameter revision through the kernel and only stores it after BRep validation succeeds.
 * A failed preview or kernel call produces an uncommitted result; it never mutates the source configuration.
 */
export async function executeMountingBlockConfigurationAtomically(args: {
  configurationId: string;
  name: string;
  inputPatch: Partial<MountingBlockInput>;
  updateText: string;
}): Promise<CADAgentResult> {
  const previous = configurations.get(args.configurationId);
  if (!previous) throw new Error(`Unknown configuration: ${args.configurationId}`);
  const input = { ...previous.input, ...args.inputPatch };
  const requirementSet = applyRequirementRevision(previous.requirementSet, args.updateText);
  const revision = previous.revision + 1;
  const id = configurationId(args.name, revision);
  if (configurations.has(id)) throw new Error(`A configuration already exists at ${id}; create a distinct operation branch name rather than overwriting history.`);
  const plan = planMountingBlockFeatures(requirementSet, input, `PLAN-${args.name.toUpperCase().replace(/\s+/g, "-")}-R${revision}`);
  const sourceText = `${previous.sourceText}\nExecuted revision: ${args.updateText}`;
  const initialReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: id });
  const base: CADConfiguration = { id, name: args.name, revision, createdAt: new Date().toISOString(), sourceText, input, requirementSet, engineeringReview: initialReview, plan, modelStatus: "CONCEPTUAL" };
  if (requirementSet.validation_status !== "VALIDATED" || initialReview.gate === "BLOCKED") return conceptualResult(base, initialReview.gate === "BLOCKED" ? `Kernel execution blocked before start: ${initialReview.verdictReason}` : `Kernel execution blocked before start because RequirementSet is ${requirementSet.validation_status}.`);
  const kernelResult = await runWithOpenCascadeAdmission({ projectId: id, resourceClass: "CAD_AUTHORING" }, () => generateMountingBlock(input, canonicalMountingPrompt(input)));
  const modelStatus: CADModelStatus = kernelResult.artifact?.validationStatus === "VALID" && kernelResult.viewerMesh ? "VALIDATED" : "INVALID";
  plan.model_status = modelStatus; plan.revision = revision;
  plan.features = plan.features.map((feature) => ({ ...feature, executionStatus: modelStatus === "VALIDATED" ? "EXECUTED" : "FAILED" }));
  const engineeringReview = runRuthlessEngineeringReview({ sourceText, geometryStatus: modelStatus === "VALIDATED" ? "GEOMETRICALLY_VALIDATED" : "NOT_GENERATED", requirementSetId: requirementSet.id, configurationId: id });
  const configuration: CADConfiguration = { ...base, modelStatus, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, engineeringReview };
  if (modelStatus !== "VALIDATED") return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error ?? "OpenCascade did not return a validated BRep artifact; the source model was not modified." };
  configurations.set(id, configuration);
  return { configuration, plan, artifact: kernelResult.artifact, viewerMesh: kernelResult.viewerMesh, error: kernelResult.error };
}

export function getCadConfiguration(configurationId: string): CADConfiguration | undefined {
  return configurations.get(configurationId);
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
