import type { CADChangeProposal, GeometrySelectionContext } from "../shared/cadWorkbench";
import type {
  CADOperationHistoryRecord,
  CADOperationIssue,
  CADOperationParameter,
  CADOperationPlan,
  CADOperationPlanInput,
  CADOperationPreview,
  CADOperationRecovery,
  CADParameterName,
} from "../shared/cadExecution";
import { appendLineageNode, appendPersistentMemory, openPersistentProject, projectMemorySnapshot } from "./persistentMemory";
import { executeMountingBlockConfigurationAtomically, getCadConfiguration, previewMountingBlockConfiguration } from "./cadAgent";

const plans = new Map<string, CADOperationPlan>();
const key = (projectId: string, operationId: string) => `${projectId}:${operationId}`;
const id = () => `CADOP-${crypto.randomUUID()}`;
const parameterNames = new Set<CADParameterName>(["width", "depth", "height", "holeDiameter", "holeEdgeOffset", "filletRadius"]);

function issue(code: CADOperationIssue["code"], reason: string, recommendedCorrection: string, invalidParameter?: string, affectedEntity?: string): CADOperationIssue {
  return { code, reason, recommendedCorrection, invalidParameter, affectedEntity };
}
function operationRecord(plan: CADOperationPlan, executionStatus: CADOperationHistoryRecord["executionStatus"], validationStatus: CADOperationHistoryRecord["validationStatus"], resultRevision?: string, failure?: CADOperationIssue, recovery?: CADOperationRecovery): CADOperationHistoryRecord {
  return { id: `OPH-${crypto.randomUUID()}`, operationId: plan.operationId, operationType: plan.operationType, parameters: plan.parameters, sourceRevision: plan.sourceModel.configurationId, resultRevision, executionStatus, validationStatus, timestamp: new Date().toISOString(), origin: "CAD_AGENT", truth: executionStatus === "OPERATION_EXECUTED" ? "KERNEL_VALIDATED" : failure ? "FACT" : "INFERRED", issue: failure, recovery };
}
function recoveryFor(plan: CADOperationPlan, failure: CADOperationIssue): CADOperationRecovery {
  const parameter = plan.parameters[0]; const alternatives: CADOperationRecovery["alternatives"] = [];
  if (parameter && parameter.name === "filletRadius" && parameter.value > 0) alternatives.push({ title: "Use a smaller fillet radius", parameterPatch: { filletRadius: Math.max(0.1, parameter.value / 2) }, reason: "A reduced radius can avoid a geometric conflict, but it has not been attempted automatically.", provenance: "INFERRED" });
  if (parameter && ["width", "depth", "height"].includes(parameter.name)) alternatives.push({ title: "Request a smaller positive parameter adjustment", parameterPatch: { [parameter.name]: Math.max(1, Math.round((parameter.priorValue ?? parameter.value) + (parameter.value - (parameter.priorValue ?? parameter.value)) / 2)) }, reason: "A smaller change may preserve the existing feature relationships, but needs separate preview and approval.", provenance: "INFERRED" });
  if (!alternatives.length) alternatives.push({ title: "Inspect the source configuration and choose a supported named parameter", reason: failure.recommendedCorrection, provenance: "UNKNOWN" });
  return { attempted: false, alternatives: alternatives.slice(0, 3), limit: 3 };
}
async function record(args: { projectId: string; accessKey: string; history: CADOperationHistoryRecord }) {
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "CAD_OPERATION", title: `${args.history.executionStatus} · ${args.history.operationType}`, content: JSON.stringify(args.history), truthStatus: args.history.truth === "KERNEL_VALIDATED" ? "DERIVED" : args.history.truth === "FACT" ? "FACT" : "UNVERIFIED", validationStage: args.history.validationStatus === "PASSED" ? "GEOMETRICALLY_VALIDATED" : "CONCEPTUAL", relatedConfigurationId: args.history.resultRevision ?? args.history.sourceRevision, authorSource: "CAD_AGENT" } });
}
async function sourceLineage(projectId: string, accessKey: string, configurationId: string) {
  const snapshot = await projectMemorySnapshot({ projectId, accessKey });
  const existing = snapshot.lineage.find((node) => node.kind === "CONFIGURATION" && node.title.includes(configurationId));
  if (existing) return existing;
  return appendLineageNode({ projectId, accessKey, node: { kind: "CONFIGURATION", title: `Source configuration · ${configurationId}`, reasonForChange: "Configuration first referenced by the controlled CAD Execution Engine.", changeSummary: "Source configuration remains immutable; subsequent approved operations create child revision lineage nodes.", status: "VALIDATED", authorSource: "SYSTEM" } });
}

function parameterFrom(input: CADOperationPlanInput): CADOperationParameter | CADOperationIssue {
  if (input.requestedParameter) return input.requestedParameter;
  const candidate = input.proposal?.parameters[0];
  if (!candidate?.name || candidate.after === undefined) return issue("OPERATION_INVALID", "The CAD proposal does not contain a bounded editable numeric parameter.", "Provide one supported named mounting-block parameter and a millimetre value.");
  if (!parameterNames.has(candidate.name as CADParameterName)) return issue("UNSUPPORTED_OPERATION", `${candidate.name} is not an executable Phase 4.5 mounting-block parameter.`, "Use width, depth, height, holeDiameter, holeEdgeOffset, or filletRadius; generic sketch and BRep operations are not available.", candidate.name);
  const value = Number(candidate.after); if (!Number.isFinite(value)) return issue("OPERATION_INVALID", `Parameter ${candidate.name} is not a finite number.`, "Use a finite numeric millimetre value.", candidate.name);
  return { name: candidate.name as CADParameterName, value, unit: candidate.unit === "mm" ? "mm" : "mm" };
}
function validate(parameter: CADOperationParameter, source: NonNullable<ReturnType<typeof getCadConfiguration>>, selection?: GeometrySelectionContext): CADOperationIssue | undefined {
  if (source.modelStatus !== "VALIDATED") return issue("SOURCE_MODEL_INVALID", `Source configuration is ${source.modelStatus}, not VALIDATED.`, "Select a validated parametric configuration before planning a modifying operation.", undefined, source.id);
  if (!Number.isFinite(parameter.value) || parameter.value < 0 || (parameter.name !== "filletRadius" && parameter.value === 0)) return issue("OPERATION_INVALID", `${parameter.name} must be ${parameter.name === "filletRadius" ? "zero or positive" : "positive"}.`, "Use a valid millimetre value within the source model's design envelope.", parameter.name);
  if (selection?.featureId?.startsWith("FILE-") || (selection?.source === "VIEWER" && selection?.kind !== "NONE" && !selection.featureId)) return issue("REFERENCE_INVALIDATED", "The selected imported-file entity does not map to an editable mounting-block feature or stable operation target.", "Use imported STEP/STL only for inspection, or select a named parametric mounting-block feature before applying an operation.", undefined, selection.label);
  const next = { ...source.input, [parameter.name]: parameter.value };
  if (next.holeEdgeOffset * 2 + next.holeDiameter > next.width || next.holeEdgeOffset * 2 + next.holeDiameter > next.depth) return issue("OPERATION_INVALID", "Hole diameter and edge offset would place a corner hole outside the mounting-block footprint.", "Increase width/depth or reduce holeDiameter/holeEdgeOffset before preview.", parameter.name, "HOLE_PATTERN");
  if (next.filletRadius > Math.min(next.width, next.depth, next.height) / 2) return issue("OPERATION_INVALID", "Fillet radius exceeds half of the smallest mounting-block dimension.", "Reduce filletRadius before preview.", parameter.name, "EDGE_FILLET");
  return undefined;
}

export async function planCadOperation(input: CADOperationPlanInput): Promise<CADOperationPlan> {
  await openPersistentProject({ name: "", projectId: input.projectId, accessKey: input.accessKey });
  const source = getCadConfiguration(input.configurationId);
  const now = new Date().toISOString();
  if (!source) {
    const plan: CADOperationPlan = { operationId: id(), operationType: "UNSUPPORTED", state: "OPERATION_INVALID", sourceModel: { configurationId: input.configurationId, configurationName: "UNKNOWN", revision: 0, modelStatus: "INVALID" }, targetEntities: input.selectedGeometry ? [input.selectedGeometry] : [], parameters: [], units: "mm", dependencies: [], expectedResult: "No operation can be planned because the source configuration is unavailable.", validationRequirements: [], riskLevel: "HIGH", provenance: "UNKNOWN", proposalId: input.proposal?.id, createdAt: now, issue: issue("SOURCE_MODEL_INVALID", "The requested configuration does not exist in the controlled CAD kernel session.", "Open an existing validated configuration and create a new operation plan.", undefined, input.configurationId) };
    plans.set(key(input.projectId, plan.operationId), plan); return plan;
  }
  const parameter = parameterFrom(input); const sourceModel = { configurationId: source.id, configurationName: source.name, revision: source.revision, modelStatus: source.modelStatus } as const;
  if ("code" in parameter) {
    const plan: CADOperationPlan = { operationId: id(), operationType: "UNSUPPORTED", state: "OPERATION_INVALID", sourceModel, targetEntities: input.selectedGeometry ? [input.selectedGeometry] : [], parameters: [], units: "mm", dependencies: [source.id], expectedResult: "No kernel action is planned.", validationRequirements: [], riskLevel: "HIGH", provenance: "UNKNOWN", proposalId: input.proposal?.id, createdAt: now, issue: parameter };
    plans.set(key(input.projectId, plan.operationId), plan); return plan;
  }
  const withPrior = { ...parameter, priorValue: source.input[parameter.name] };
  const validationIssue = validate(withPrior, source, input.selectedGeometry);
  const plan: CADOperationPlan = { operationId: id(), operationType: "SET_MOUNTING_BLOCK_PARAMETER", state: validationIssue?.code === "REFERENCE_INVALIDATED" ? "REFERENCE_INVALIDATED" : validationIssue ? "OPERATION_INVALID" : "DRAFT", sourceModel, targetEntities: input.selectedGeometry ? [input.selectedGeometry] : [], parameters: [withPrior], units: "mm", dependencies: [source.id, "VALIDATED_REQUIREMENT_SET", "OpenCascade.js"], expectedResult: `Regenerate a new mounting-block BRep revision with ${withPrior.name} changed from ${withPrior.priorValue} mm to ${withPrior.value} mm. Physical, material, manufacturing, safety, and CAE behavior remain unknown.`, validationRequirements: [{ id: "SOURCE_MODEL", description: "Source configuration is validated and available.", state: source.modelStatus === "VALIDATED" ? "PASSED" : "FAILED" }, { id: "PARAMETER_RANGE", description: "Named parameter is finite and within the controlled mounting-block constraints.", state: validationIssue ? "FAILED" : "PASSED" }, { id: "TARGET_REFERENCE", description: "Selected entity maps to a supported parametric source rather than an imported opaque BRep/STL reference.", state: validationIssue?.code === "REFERENCE_INVALIDATED" ? "FAILED" : "PASSED" }], riskLevel: "MEDIUM", provenance: "INFERRED", proposalId: input.proposal?.id, createdAt: now, issue: validationIssue };
  plans.set(key(input.projectId, plan.operationId), plan); return plan;
}

function findPlan(projectId: string, operationId: string) { const plan = plans.get(key(projectId, operationId)); if (!plan) throw new Error("CAD operation plan is unavailable or expired. Replan the operation; no kernel action was taken."); return plan; }

export async function previewCadOperation(args: { projectId: string; accessKey: string; operationId: string }): Promise<{ plan: CADOperationPlan; preview: CADOperationPreview }> {
  await openPersistentProject({ name: "", projectId: args.projectId, accessKey: args.accessKey }); const plan = findPlan(args.projectId, args.operationId);
  if (plan.state === "OPERATION_INVALID" || plan.state === "REFERENCE_INVALIDATED" || plan.operationType !== "SET_MOUNTING_BLOCK_PARAMETER") {
    const failure = plan.issue ?? issue("UNSUPPORTED_OPERATION", "Operation is not executable.", "Create a new supported operation plan.");
    const history = operationRecord(plan, plan.state, "FAILED", undefined, failure, recoveryFor(plan, failure));
    await record({ projectId: args.projectId, accessKey: args.accessKey, history });
    return { plan, preview: { operationId: plan.operationId, state: "OPERATION_INVALID", currentConfigurationId: plan.sourceModel.configurationId, expectedChange: plan.expectedResult, affectedEntities: plan.targetEntities, risks: [failure.reason], validationStatus: "FAILED", viewerMeshAvailable: false, issue: failure } };
  }
  const parameter = plan.parameters[0]; plan.state = "PREVIEWING";
  const preview = await previewMountingBlockConfiguration({ configurationId: plan.sourceModel.configurationId, inputPatch: { [parameter.name]: parameter.value }, updateText: `Preview operation ${plan.operationId}: set ${parameter.name} to ${parameter.value} mm.` });
  if (preview.configuration.modelStatus !== "VALIDATED" || !preview.viewerMesh) {
    const failure = issue("KERNEL_EXECUTION_FAILED", preview.error ?? "OpenCascade preview did not produce a validated BRep.", "Review the parameter and source constraints, then create a new plan. The source model remains unchanged.", parameter.name);
    plan.state = "OPERATION_FAILED"; plan.issue = failure;
    await record({ projectId: args.projectId, accessKey: args.accessKey, history: operationRecord(plan, "OPERATION_FAILED", "FAILED", undefined, failure, recoveryFor(plan, failure)) });
    return { plan, preview: { operationId: plan.operationId, state: "OPERATION_FAILED", currentConfigurationId: plan.sourceModel.configurationId, expectedChange: plan.expectedResult, affectedEntities: plan.targetEntities, risks: [failure.reason], validationStatus: "FAILED", viewerMeshAvailable: false, issue: failure } };
  }
  plan.state = "PREVIEW_READY";
  return { plan, preview: { operationId: plan.operationId, state: "PREVIEW_READY", currentConfigurationId: plan.sourceModel.configurationId, proposedConfigurationId: preview.configuration.id, expectedChange: plan.expectedResult, affectedEntities: plan.targetEntities, risks: ["Preview BRep is non-persistent and may differ if source configuration changes before Apply.", "Geometric preview does not establish physical, material, safety, manufacturing, or certification validity."], validationStatus: "PASSED", modelStatus: preview.configuration.modelStatus, viewerMeshAvailable: true } };
}

export async function executeCadOperation(args: { projectId: string; accessKey: string; operationId: string }): Promise<{ plan: CADOperationPlan; history: CADOperationHistoryRecord; resultConfigurationId?: string }> {
  await openPersistentProject({ name: "", projectId: args.projectId, accessKey: args.accessKey }); const plan = findPlan(args.projectId, args.operationId);
  if (plan.state !== "PREVIEW_READY" || plan.operationType !== "SET_MOUNTING_BLOCK_PARAMETER") throw new Error("Only a successful non-destructive PREVIEW_READY supported plan may be applied. No kernel action was taken.");
  const parameter = plan.parameters[0]; plan.state = "EXECUTING";
  const branchName = `${plan.sourceModel.configurationName} · ${parameter.name}-${parameter.value}mm`;
  const execution = await executeMountingBlockConfigurationAtomically({ configurationId: plan.sourceModel.configurationId, name: branchName, inputPatch: { [parameter.name]: parameter.value }, updateText: `Approved operation ${plan.operationId}: set ${parameter.name} from ${parameter.priorValue} mm to ${parameter.value} mm.` });
  if (execution.configuration.modelStatus !== "VALIDATED" || !execution.artifact) {
    const failure = issue("KERNEL_EXECUTION_FAILED", execution.error ?? "OpenCascade did not return a validated executed BRep.", "Review the operation parameter or select a bounded alternative; the source configuration was preserved.", parameter.name);
    plan.state = "OPERATION_FAILED"; plan.issue = failure; const history = operationRecord(plan, "OPERATION_FAILED", "FAILED", undefined, failure, recoveryFor(plan, failure)); await record({ projectId: args.projectId, accessKey: args.accessKey, history }); return { plan, history };
  }
  plan.state = "VALIDATING";
  const parent = await sourceLineage(args.projectId, args.accessKey, plan.sourceModel.configurationId);
  const lineage = await appendLineageNode({ projectId: args.projectId, accessKey: args.accessKey, node: { kind: "REVISION", parentId: parent.id, title: `Executed revision · ${execution.configuration.id}`, reasonForChange: `Approved ${plan.operationType}: ${parameter.name} ${parameter.priorValue} mm → ${parameter.value} mm.`, changeSummary: `OpenCascade regenerated and validated a new BRep configuration ${execution.configuration.id}. Parent configuration ${plan.sourceModel.configurationId} remains unchanged.`, status: "VALIDATED", authorSource: "CAD_AGENT" } });
  plan.state = "OPERATION_EXECUTED";
  const history = operationRecord(plan, "OPERATION_EXECUTED", "PASSED", execution.configuration.id);
  await record({ projectId: args.projectId, accessKey: args.accessKey, history });
  await appendPersistentMemory({ projectId: args.projectId, accessKey: args.accessKey, record: { kind: "EVIDENCE", title: `Kernel execution evidence · ${plan.operationId}`, content: `Operation executed through OpenCascade into immutable configuration ${execution.configuration.id}; lineage node ${lineage.id}. This proves geometric execution and BRep validation only. It does not prove physical, material, manufacturing, safety, certification, or production readiness.`, truthStatus: "DERIVED", validationStage: "GEOMETRICALLY_VALIDATED", relatedConfigurationId: execution.configuration.id, authorSource: "CAD_AGENT" } });
  return { plan, history, resultConfigurationId: execution.configuration.id };
}

export async function rejectCadOperation(args: { projectId: string; accessKey: string; operationId: string }): Promise<CADOperationHistoryRecord> {
  await openPersistentProject({ name: "", projectId: args.projectId, accessKey: args.accessKey }); const plan = findPlan(args.projectId, args.operationId); plan.state = "REJECTED"; const history = operationRecord(plan, "REJECTED", "PENDING"); await record({ projectId: args.projectId, accessKey: args.accessKey, history }); return history;
}

/** Records a non-destructive activation request for an operation's immutable source configuration. */
export async function revertCadOperation(args: { projectId: string; accessKey: string; operationId: string }): Promise<{ targetConfigurationId: string; history: CADOperationHistoryRecord }> {
  await openPersistentProject({ name: "", projectId: args.projectId, accessKey: args.accessKey }); const plan = findPlan(args.projectId, args.operationId);
  if (plan.state !== "OPERATION_EXECUTED") throw new Error("Only an executed immutable operation can be reverted to its recorded source revision. No model was changed.");
  plan.state = "REVERTED";
  const history: CADOperationHistoryRecord = { ...operationRecord(plan, "REVERTED", "PASSED", plan.sourceModel.configurationId), truth: "FACT" };
  await record({ projectId: args.projectId, accessKey: args.accessKey, history });
  return { targetConfigurationId: plan.sourceModel.configurationId, history };
}

export async function listCadOperationHistory(args: { projectId: string; accessKey: string }): Promise<CADOperationHistoryRecord[]> {
  const snapshot = await projectMemorySnapshot(args); return snapshot.records.filter((record) => record.kind === "CAD_OPERATION").flatMap((record) => { try { return [JSON.parse(record.content) as CADOperationHistoryRecord]; } catch { return []; } }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
