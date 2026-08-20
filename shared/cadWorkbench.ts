import type { EngineeringMode } from "./engineeringIntelligence";
import type { EngineeringTruthStatus } from "./engineeringTruth";

export const WORKBENCH_VALIDATION_STAGES = ["CONCEPTUAL", "ESTIMATED", "CALCULATED", "GEOMETRICALLY_VALIDATED", "PHYSICALLY_PLAUSIBLE", "CAE_VERIFIED", "EXPERIMENTALLY_VALIDATED", "PRODUCTION_READY"] as const;
export type WorkbenchValidationStage = (typeof WORKBENCH_VALIDATION_STAGES)[number];
export type GeometrySelectionKind = "FACE" | "EDGE" | "VERTEX" | "FEATURE" | "BODY" | "ASSEMBLY" | "REGION" | "NONE";
export type ChatRole = "USER" | "CAD_AGENT" | "SYSTEM";
export type ProposalStatus = "PENDING" | "PREVIEWED" | "APPLIED" | "REJECTED" | "EDIT_REQUESTED" | "REVERTED";
export type WorkbenchActionKind = "CREATE" | "MODIFY" | "MEASURE" | "ANALYZE" | "OPTIMIZE" | "GENERATE_CONCEPT" | "COMPARE_CONCEPTS" | "VALIDATE" | "UPLOAD" | "EXPORT" | "ASK_CAD_AGENT";
export type FileKind = "STEP" | "IGES" | "STL" | "OBJ" | "DXF" | "PDF" | "CSV" | "IMAGE" | "ENGINEERING_DOCUMENT" | "UNKNOWN";
export type FileParseStatus = "METADATA_ONLY" | "PREVIEW_AVAILABLE" | "UNSUPPORTED" | "PARSE_FAILED";
export type HistoryEventKind = "REQUIREMENT" | "CONCEPT" | "CAD" | "MODIFICATION" | "VALIDATION" | "OPTIMIZATION" | "REVISION" | "PROPOSAL" | "FILE" | "CONVERSATION";

export interface GeometrySelectionContext {
  kind: GeometrySelectionKind;
  id?: string;
  label: string;
  featureId?: string;
  bodyId?: string;
  viewerFaceId?: string;
  source: "VIEWER" | "FEATURE_TREE" | "WORKBENCH" | "NONE";
}

export interface CADAgentContext {
  projectId: string;
  projectName: string;
  configurationId?: string;
  modelName?: string;
  selectedGeometry: GeometrySelectionContext;
  requirementSummary: string;
  featureSummary: string;
  parameterSummary: string;
  conceptSummary: string;
  memorySummary: string;
  validationStage: WorkbenchValidationStage;
  mode: EngineeringMode;
  attachedFileIds: string[];
}

export interface CADAgentMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  context: CADAgentContext;
  actionKind?: WorkbenchActionKind;
  truthStatus: EngineeringTruthStatus;
  copied?: boolean;
}

export interface CADChangeProposal {
  id: string;
  title: string;
  actionKind: WorkbenchActionKind;
  before: string;
  after: string;
  affectedGeometry: GeometrySelectionContext[];
  parameters: Array<{ name: string; before?: string; after?: string; unit?: string }>;
  expectedEffect: string;
  risks: string[];
  validationStage: WorkbenchValidationStage;
  truthStatus: EngineeringTruthStatus;
  status: ProposalStatus;
  reversible: true;
  rationale: string;
  historyEventId?: string;
}

export interface WorkbenchConceptCard {
  id: string;
  name: string;
  architecture: string;
  primaryMechanism: string;
  advantages: string[];
  risks: string[];
  unknowns: string[];
  manufacturingConsiderations: string[];
  engineeringConfidence: number;
  truthStatus: EngineeringTruthStatus;
  validationStage: WorkbenchValidationStage;
  state: "ACTIVE" | "REJECTED" | "PREVIEW" | "EVOLVED";
}

export interface EngineeringEvidenceItem {
  id: string;
  category: "ASSUMPTION" | "INPUT" | "EQUATION" | "CALCULATION" | "SOURCE" | "VALIDATION" | "UNKNOWN" | "WARNING";
  label: string;
  detail: string;
  truthStatus: EngineeringTruthStatus;
  available: boolean;
}

export interface WorkbenchAttachment {
  id: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  fileKind: FileKind;
  parseStatus: FileParseStatus;
  metadata: Record<string, string | number | boolean>;
  previewSupported: boolean;
  conversationId: string;
  projectId: string;
  failureReason?: string;
}

export interface CommandPaletteItem {
  id: WorkbenchActionKind;
  label: string;
  shortcut?: string;
  description: string;
}

export const WORKBENCH_COMMANDS: CommandPaletteItem[] = [
  { id: "CREATE", label: "Create", shortcut: "C", description: "Prepare an inspectable conceptual or parametric CAD operation." },
  { id: "MODIFY", label: "Modify", shortcut: "M", description: "Propose a reversible parameter or feature change." },
  { id: "MEASURE", label: "Measure", shortcut: "G", description: "Inspect selected geometry or existing kernel-derived measurements." },
  { id: "ANALYZE", label: "Analyze", shortcut: "A", description: "Challenge the active design using engineering evidence gaps." },
  { id: "OPTIMIZE", label: "Optimize", shortcut: "O", description: "Prepare an optimization problem; no result is fabricated." },
  { id: "GENERATE_CONCEPT", label: "Generate Concept", shortcut: "N", description: "Generate diverse architecture families through Phase 3.5 intelligence." },
  { id: "COMPARE_CONCEPTS", label: "Compare Concepts", shortcut: "P", description: "Compare concept assumptions, risks, and evidence requirements." },
  { id: "VALIDATE", label: "Validate", shortcut: "V", description: "Inspect current validation and evidence state." },
  { id: "UPLOAD", label: "Upload", shortcut: "U", description: "Attach a supported engineering file as a metadata-verified reference." },
  { id: "EXPORT", label: "Export", shortcut: "E", description: "Export a STEP file only after geometric validation." },
  { id: "ASK_CAD_AGENT", label: "Ask CAD Agent", shortcut: "⌘K", description: "Ask a contextual engineering question." },
];

export interface DesignHistoryEvent {
  id: string;
  kind: HistoryEventKind;
  title: string;
  detail: string;
  timestamp: string;
  validationStage: WorkbenchValidationStage;
  truthStatus: EngineeringTruthStatus;
  branchFromId?: string;
  reversible: boolean;
  reverted?: boolean;
}

export interface WorkbenchInput {
  projectId: string;
  projectName?: string;
  message: string;
  mode: EngineeringMode;
  configurationId?: string;
  modelName?: string;
  selectedGeometry?: GeometrySelectionContext;
  requirementSummary?: string;
  featureSummary?: string;
  parameterSummary?: string;
  conceptSummary?: string;
  memorySummary?: string;
  validationStage?: WorkbenchValidationStage;
  attachedFileIds?: string[];
}

export interface WorkbenchConversationResult {
  context: CADAgentContext;
  userMessage: CADAgentMessage;
  agentMessage: CADAgentMessage;
  proposal?: CADChangeProposal;
  concepts: WorkbenchConceptCard[];
  evidence: EngineeringEvidenceItem[];
  history: DesignHistoryEvent[];
  command?: CommandPaletteItem;
}
