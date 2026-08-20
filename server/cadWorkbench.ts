import { runEngineeringIntelligence } from "./engineeringIntelligence";
import { WORKBENCH_COMMANDS } from "../shared/cadWorkbench";
import { planCircularPattern } from "./featureHistory";
import { planRectangularPattern } from "./rectangularPattern";
import { planMirror } from "./mirrorFeature";
import type {
  CADAgentContext,
  CADAgentMessage,
  CADChangeProposal,
  CommandPaletteItem,
  DesignHistoryEvent,
  EngineeringEvidenceItem,
  GeometrySelectionContext,
  ProposalStatus,
  WorkbenchActionKind,
  WorkbenchAttachment,
  WorkbenchConceptCard,
  WorkbenchConversationResult,
  WorkbenchInput,
  WorkbenchValidationStage,
} from "../shared/cadWorkbench";

interface WorkbenchProjectState {
  messages: CADAgentMessage[];
  proposals: CADChangeProposal[];
  concepts: WorkbenchConceptCard[];
  evidence: EngineeringEvidenceItem[];
  history: DesignHistoryEvent[];
  attachments: WorkbenchAttachment[];
}

const projects = new Map<string, WorkbenchProjectState>();
let sequence = 0;

const emptySelection: GeometrySelectionContext = { kind: "NONE", label: "No geometry selected", source: "NONE" };

function getState(projectId: string): WorkbenchProjectState {
  const current = projects.get(projectId);
  if (current) return current;
  const created: WorkbenchProjectState = { messages: [], proposals: [], concepts: [], evidence: [], history: [], attachments: [] };
  projects.set(projectId, created);
  return created;
}

function id(prefix: string) { return `${prefix}-${Date.now()}-${++sequence}`; }

function contextFor(input: WorkbenchInput): CADAgentContext {
  return {
    projectId: input.projectId,
    projectName: input.projectName ?? "CAD-AI Project",
    configurationId: input.configurationId,
    modelName: input.modelName,
    selectedGeometry: input.selectedGeometry ?? emptySelection,
    requirementSummary: input.requirementSummary ?? "Requirements not loaded",
    featureSummary: input.featureSummary ?? "No feature selected",
    parameterSummary: input.parameterSummary ?? "No parameter summary available",
    conceptSummary: input.conceptSummary ?? "No concept selected",
    memorySummary: input.memorySummary ?? "No engineering memory loaded",
    validationStage: input.validationStage ?? "CONCEPTUAL",
    mode: input.mode,
    attachedFileIds: input.attachedFileIds ?? [],
  };
}

function classifyCommand(message: string): WorkbenchActionKind {
  const text = message.toLowerCase();
  if (/generate\s+(five|\d+|multiple|alternative)|alternative architecture|different mechanism|concept/.test(text)) return "GENERATE_CONCEPT";
  if (/challenge|weakness|may fail|break|adversarial/.test(text)) return "ANALYZE";
  if (/reduce.*weight|optimiz/.test(text)) return "OPTIMIZE";
  if (/measure|dimension|distance|radius/.test(text)) return "MEASURE";
  if (/validate|prepare.*cad|cad generation/.test(text)) return "VALIDATE";
  if (/upload|attach|file/.test(text)) return "UPLOAD";
  if (/export|step|stp/.test(text)) return "EXPORT";
  if (/modify|change|reduce|increase|stronger|fillet|hole|width|height|thickness/.test(text)) return "MODIFY";
  if (/create|make|generate.*bracket/.test(text)) return "CREATE";
  return "ASK_CAD_AGENT";
}

function history(kind: DesignHistoryEvent["kind"], title: string, detail: string, stage: WorkbenchValidationStage, truthStatus: DesignHistoryEvent["truthStatus"], reversible = false): DesignHistoryEvent {
  return { id: id("HISTORY"), kind, title, detail, timestamp: new Date().toISOString(), validationStage: stage, truthStatus, reversible };
}

function defaultEvidence(context: CADAgentContext): EngineeringEvidenceItem[] {
  return [
    { id: "EVIDENCE-CONTEXT-001", category: "INPUT", label: "Active selection", detail: `${context.selectedGeometry.kind}: ${context.selectedGeometry.label}`, truthStatus: context.selectedGeometry.kind === "NONE" ? "UNKNOWN" : "FACT", available: context.selectedGeometry.kind !== "NONE" },
    { id: "EVIDENCE-CONTEXT-002", category: "INPUT", label: "Requirements", detail: context.requirementSummary, truthStatus: "DERIVED", available: context.requirementSummary !== "Requirements not loaded" },
    { id: "EVIDENCE-CONTEXT-003", category: "VALIDATION", label: "Model stage", detail: context.validationStage, truthStatus: context.validationStage === "GEOMETRICALLY_VALIDATED" ? "DERIVED" : "UNVERIFIED", available: context.validationStage === "GEOMETRICALLY_VALIDATED" },
    { id: "EVIDENCE-CONTEXT-005", category: "INPUT", label: "CAD file references", detail: context.attachedFileIds.length ? `${context.attachedFileIds.length} project-authorized CAD file reference(s) were supplied to this chat context. Parser-derived metadata is available only where the file reached PARSED or PARTIALLY_PARSED state.` : "No parsed CAD file reference is attached to this chat action.", truthStatus: context.attachedFileIds.length ? "DERIVED" : "UNKNOWN", available: context.attachedFileIds.length > 0 },
    { id: "EVIDENCE-CONTEXT-004", category: "UNKNOWN", label: "Physical validation", detail: "NOT VERIFIED — no CAE result, experimental data, material-property source, manufacturing qualification, or certification evidence is attached to this chat action.", truthStatus: "UNVERIFIED", available: false },
  ];
}

function selectedGeometry(context: CADAgentContext): GeometrySelectionContext[] {
  return context.selectedGeometry.kind === "NONE" ? [] : [context.selectedGeometry];
}

function numericWidthProposal(input: WorkbenchInput, context: CADAgentContext, action: WorkbenchActionKind): CADChangeProposal | undefined {
  const width = input.message.match(/(?:width|wide)\D{0,16}(\d+(?:\.\d+)?)\s*(mm|cm|m)?/i) ?? input.message.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\s*(?:wide|width)/i);
  if (!width && action !== "MODIFY") return undefined;
  const raw = width ? Number(width[1]) : undefined;
  const unit = width?.[2]?.toLowerCase();
  const millimetres = raw === undefined ? undefined : unit === "cm" ? raw * 10 : unit === "m" ? raw * 1000 : raw;
  const executable = millimetres !== undefined && Number.isFinite(millimetres) && millimetres > 0;
  return {
    id: id("PROPOSAL"),
    title: executable ? `Change width to ${millimetres} mm` : "Engineering modification requires an explicit editable parameter",
    actionKind: "MODIFY",
    before: context.parameterSummary,
    after: executable ? `Proposed width: ${millimetres} mm. No geometry has changed.` : "No executable after-state is available.",
    affectedGeometry: selectedGeometry(context),
    parameters: executable ? [{ name: "width", after: String(millimetres), unit: "mm" }] : [],
    expectedEffect: executable ? "A new parametric CAD revision can be regenerated only after Apply. Physical strength, mass, and safety effects are not established." : "The agent needs a numeric parameter or an editable feature reference before it can create an executable proposal.",
    risks: ["Geometry may violate constraints or create invalid topology.", "No mass, strength, manufacturing, or safety result can be inferred from this parameter change."],
    validationStage: context.validationStage,
    truthStatus: executable ? "HYPOTHETICAL" : "UNKNOWN",
    status: "PENDING",
    reversible: true,
    rationale: context.selectedGeometry.kind === "NONE" ? "The proposal is scoped to the active model because no geometry was selected." : `The proposal references the active ${context.selectedGeometry.kind.toLowerCase()} selection: ${context.selectedGeometry.label}.`,
  };
}

function proposalFor(input: WorkbenchInput, context: CADAgentContext, action: WorkbenchActionKind): CADChangeProposal | undefined {
  if (action === "MODIFY" || action === "OPTIMIZE") return numericWidthProposal(input, context, action);
  if (action === "CREATE") return {
    id: id("PROPOSAL"), title: "Prepare conceptual CAD operation", actionKind: "CREATE", before: "No generated geometry for this request.", after: "A feature plan would be prepared; no OpenCascade operation has been executed.", affectedGeometry: selectedGeometry(context), parameters: [], expectedEffect: "Creates a traceable conceptual plan only until supported features, dimensions, and requirements are provided.", risks: ["The requested feature may not be supported by the current kernel adapter.", "A conceptual plan is not a geometrically validated model."], validationStage: "CONCEPTUAL", truthStatus: "HYPOTHETICAL", status: "PENDING", reversible: true, rationale: "The workbench never silently generates or alters geometry from a general natural-language request.",
  };
  if (action === "VALIDATE") return {
    id: id("PROPOSAL"), title: "Prepare CAD generation handoff", actionKind: "VALIDATE", before: "Current context and evidence state.", after: "Requirements, editable parameters, feature plan, and validation gates are prepared for review; no CAD operation has been run.", affectedGeometry: selectedGeometry(context), parameters: [], expectedEffect: "Clarifies what must be defined before a trusted kernel operation can be requested.", risks: ["Physical and manufacturing validity remain unverified even after geometric validation."], validationStage: context.validationStage, truthStatus: "DERIVED", status: "PENDING", reversible: true, rationale: "Preparation is an inspectable planning action, not a claim that CAD geometry or CAE evidence exists.",
  };
  return undefined;
}

function conceptsFromIntelligence(input: WorkbenchInput): WorkbenchConceptCard[] {
  const intelligence = runEngineeringIntelligence({ sourceText: input.message, mode: input.mode, projectId: `WORKBENCH-${input.projectId}`, requestMajorInnovation: /major innovation|revolutionary|breakthrough/i.test(input.message) });
  return intelligence.candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.title,
    architecture: candidate.architectureFamily.replaceAll("_", " "),
    primaryMechanism: candidate.mechanism,
    advantages: [candidate.differentiation, "Preserved as an independent architecture for comparison."],
    risks: candidate.risks,
    unknowns: intelligence.truthReview.unknown.map((item) => item.question),
    manufacturingConsiderations: ["NOT VERIFIED — process capability, tolerance stack, inspection, volume, and cost were not evaluated."],
    engineeringConfidence: candidate.truthStatus === "SPECULATIVE" ? 0.2 : 0.35,
    truthStatus: candidate.truthStatus,
    validationStage: "CONCEPTUAL",
    state: "PREVIEW",
  }));
}

function responseText(action: WorkbenchActionKind, context: CADAgentContext, proposal?: CADChangeProposal, conceptCount = 0, patternPlan?: ReturnType<typeof planCircularPattern> | ReturnType<typeof planRectangularPattern> | ReturnType<typeof planMirror>): string {
  const selection = context.selectedGeometry.kind === "NONE" ? "No geometry is selected." : `Active selection: ${context.selectedGeometry.kind.toLowerCase()} “${context.selectedGeometry.label}”.`;
  if (patternPlan) { if (patternPlan.status === "READY_FOR_PREVIEW" && patternPlan.operation === "CIRCULAR_PATTERN") { const input = patternPlan.input as { sourceRevisionId: string; sourceFeatureId: string; axis: string; instanceCount: number; angleDegrees: number }; return `${selection} The guarded CIRCULAR_PATTERN plan is ready for review: source ${input.sourceRevisionId}, feature ${input.sourceFeatureId}, axis ${input.axis}, ${input.instanceCount} instances, ${input.angleDegrees}°. Review and submit it through the Pattern Inspector; no geometry has changed. FILLET_READY remains FALSE and no fillet is proposed or executed.`; } if (patternPlan.status === "READY_FOR_PREVIEW" && patternPlan.operation === "MIRROR") { const input = patternPlan.input as { sourceRevisionId: string; sourceFeatureId: string; mirrorPlane: string }; return `${selection} The bounded MIRROR plan is ready for preview: source ${input.sourceRevisionId}, feature ${input.sourceFeatureId}, plane ${input.mirrorPlane}. It maps YZ→GLOBAL_X, XZ→GLOBAL_Y, and XY→GLOBAL_Z only. Review it through the Mirror Inspector; no geometry has changed. CAD KERNEL VALIDATED does not imply engineering validation.`; } if (patternPlan.status === "READY_FOR_PREVIEW") { const input = patternPlan.input as { sourceRevisionId: string; sourceFeatureId: string; countX: number; countY: number; directionX: string; directionY: string; spacingX: number; spacingY: number }; return `${selection} The guarded RECTANGULAR_PATTERN plan is ready for review: source ${input.sourceRevisionId}, feature ${input.sourceFeatureId}, ${input.countX} × ${input.countY}, X ${input.directionX} at ${input.spacingX} mm, Y ${input.directionY} at ${input.spacingY} mm. Review and submit it through the Pattern Inspector; no geometry has changed. FILLET_READY remains FALSE and no fillet is proposed or executed.`; } const blockedLabel = patternPlan.operation === "MIRROR" ? "Mirror" : patternPlan.operation === "CIRCULAR_PATTERN" ? "Circular Pattern" : "Rectangular Pattern"; return `${selection} ${blockedLabel} is blocked pending explicit evidence: ${patternPlan.questions.join(" ")} FILLET_READY remains FALSE and no fillet is proposed or executed.`; }
  if (/circular boss|circle sketch|cylinder boss/i.test(context.modelName ?? "") || /circular boss|circle sketch|cylinder boss/i.test((proposal?.title ?? ""))) return `${selection} The supported circular-boss route is CIRCLE_SKETCH → EXTRUDE only. Supply explicit radius, extrusion distance, and center X/Y units; the deterministic circular-boss planner then yields a previewable plan. FILLET_READY remains FALSE, so no fillet will be proposed or executed.`;
  if (context.selectedGeometry.source === "FEATURE_TREE") return `${selection} This is a declared feature-history context, not an arbitrary BRep target. Review the Feature Inspector’s parent dependencies and explicit parameter, then use its controlled edit → preview regeneration → approval flow. If the selected feature or reference is unavailable, I will preserve REFERENCE_INVALIDATED rather than silently remapping geometry.`;
  if (action === "GENERATE_CONCEPT") return `${selection} I generated ${conceptCount} distinct architecture families using the existing Phase 3.5 intelligence core. They are conceptual candidates with explicit evidence gaps, not proven solutions.`;
  if (action === "ANALYZE") return `${selection} I challenged the active context through the engineering review path. The weaknesses shown are evidence gaps and risk hypotheses; they are not simulation, material, safety, or manufacturing results.`;
  if (action === "OPTIMIZE") return `${selection} Reducing weight is an optimization objective, not a guaranteed outcome. I created a transparent proposal only when an editable numeric parameter was present; mass reduction requires material, volume, density, constraints, and validation evidence.`;
  if (action === "MEASURE") return `${selection} I can report kernel-derived viewer measurements when they exist. I will not invent a distance, radius, area, or mass measurement from chat text.`;
  if (action === "EXPORT") return `${selection} STEP export remains available only through the validated CAD artifact path. This chat action does not fabricate an export file.`;
  if (action === "UPLOAD") return `${selection} Use the CAD File Center to upload STEP/STP or STL source bytes. The workbench records managed-storage provenance and can reference only parser-derived file context; unsupported, corrupted, and failed files remain explicitly unparsed, and design, material, safety, manufacturing, physics, and CAE unknowns remain unknown.`;
  if (proposal) return `${selection} I created a reversible PROPOSED CHANGE. Review Before, After, affected geometry, parameters, expected effect, risks, and validation status before Preview, Apply, Reject, or Edit.`;
  return `${selection} I can help prepare a structured engineering action. Provide a measurable target, parameter, feature, or selected geometry; I will preserve unknowns instead of silently choosing a design.`;
}

export function runWorkbenchMessage(input: WorkbenchInput): WorkbenchConversationResult {
  const context = contextFor(input);
  const state = getState(input.projectId);
  const action = classifyCommand(input.message);
  const patternPlan = /\bmirror\b|\byz\s*plane\b|\bxz\s*plane\b|\bxy\s*plane\b/i.test(input.message) ? planMirror(input.message) : /rectangular\s+pattern|grid\s+pattern|(?:\d+)\s*(?:x|×|by)\s*(?:\d+)\s+(?:bosses|instances|pattern)/i.test(input.message) ? planRectangularPattern(input.message) : /circular\s+pattern|(?:place|pattern)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:identical\s+)?bosses|identical\s+bosses\s+around/i.test(input.message) ? planCircularPattern(input.message) : undefined;
  const proposal = proposalFor(input, context, action);
  const concepts = action === "GENERATE_CONCEPT" ? conceptsFromIntelligence(input) : [];
  const evidence = defaultEvidence(context);
  const userMessage: CADAgentMessage = { id: id("MESSAGE"), role: "USER", text: input.message, createdAt: new Date().toISOString(), context, actionKind: action, truthStatus: "FACT" };
  const agentMessage: CADAgentMessage = { id: id("MESSAGE"), role: "CAD_AGENT", text: responseText(action, context, proposal, concepts.length, patternPlan), createdAt: new Date().toISOString(), context, actionKind: action, truthStatus: proposal?.truthStatus ?? (action === "ANALYZE" ? "UNVERIFIED" : patternPlan?.status === "READY_FOR_PREVIEW" ? "DERIVED" : "UNKNOWN") };
  const events = [history("CONVERSATION", `CAD Agent · ${action.replaceAll("_", " ")}`, agentMessage.text, context.validationStage, agentMessage.truthStatus)];
  if (proposal) events.push(history("PROPOSAL", proposal.title, proposal.rationale, proposal.validationStage, proposal.truthStatus, true));
  if (concepts.length) events.push(history("CONCEPT", `${concepts.length} candidate architectures generated`, "Candidates remain conceptual until their requirements and evidence are established.", "CONCEPTUAL", concepts[0].truthStatus, true));
  state.messages.push(userMessage, agentMessage);
  if (proposal) state.proposals.push(proposal);
  if (concepts.length) state.concepts.push(...concepts);
  state.evidence = evidence;
  state.history.push(...events);
  return { context, userMessage, agentMessage, proposal, concepts, evidence, history: state.history, command: WORKBENCH_COMMANDS.find((item) => item.id === action) };
}

export function updateProposal(projectId: string, proposalId: string, status: Extract<ProposalStatus, "PREVIEWED" | "APPLIED" | "REJECTED" | "EDIT_REQUESTED" | "REVERTED">): CADChangeProposal {
  const state = getState(projectId);
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error("Proposal not found in this project workbench session.");
  proposal.status = status;
  const label = status === "APPLIED" ? "Proposal marked applied; any executable CAD regeneration must be completed through the parametric CAD route and remains reversible through the preserved prior revision." : `Proposal status updated to ${status}.`;
  const event = history("PROPOSAL", proposal.title, label, proposal.validationStage, proposal.truthStatus, true);
  proposal.historyEventId = event.id;
  state.history.push(event);
  return proposal;
}

export function getWorkbenchProject(projectId: string): WorkbenchProjectState {
  return getState(projectId);
}

function kindFromFile(name: string, mimeType?: string): WorkbenchAttachment["fileKind"] {
  const extension = name.split(".").pop()?.toLowerCase();
  if (["step", "stp"].includes(extension ?? "")) return "STEP";
  if (["iges", "igs"].includes(extension ?? "")) return "IGES";
  if (extension === "stl") return "STL";
  if (extension === "obj") return "OBJ";
  if (extension === "dxf") return "DXF";
  if (extension === "pdf") return "PDF";
  if (extension === "csv") return "CSV";
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) return "IMAGE";
  if (["doc", "docx", "txt", "md", "rtf"].includes(extension ?? "")) return "ENGINEERING_DOCUMENT";
  return "UNKNOWN";
}

export function attachWorkbenchFile(args: { projectId: string; conversationId?: string; name: string; sizeBytes?: number; mimeType?: string }): WorkbenchAttachment {
  const state = getState(args.projectId);
  const fileKind = kindFromFile(args.name, args.mimeType);
  const allowed = fileKind !== "UNKNOWN";
  const tooLarge = (args.sizeBytes ?? 0) > 100 * 1024 * 1024;
  const attachment: WorkbenchAttachment = {
    id: id("FILE"), name: args.name, sizeBytes: args.sizeBytes, mimeType: args.mimeType, fileKind,
    parseStatus: !allowed ? "UNSUPPORTED" : tooLarge ? "PARSE_FAILED" : "METADATA_ONLY",
    metadata: { name: args.name, sizeBytes: args.sizeBytes ?? 0, mimeType: args.mimeType ?? "unknown", binaryTransferred: false, contentInterpreted: false },
    previewSupported: false,
    conversationId: args.conversationId ?? "CURRENT-CONVERSATION",
    projectId: args.projectId,
    failureReason: !allowed ? "Unsupported file extension or MIME type. No parsing was attempted." : tooLarge ? "File exceeds the 100 MB metadata-only session limit. No parsing was attempted." : "Metadata validated and associated. Binary upload and content parsing are not implemented in this phase; the workbench must not claim file interpretation.",
  };
  state.attachments.push(attachment);
  state.history.push(history("FILE", `Attached ${attachment.name}`, attachment.failureReason ?? "Attachment metadata associated.", "CONCEPTUAL", allowed ? "DERIVED" : "UNKNOWN", false));
  return attachment;
}
