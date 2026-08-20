import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CADViewer, type ViewerSelection } from "@/components/cad-viewer";
import { CADAgentWorkbench } from "@/components/cad-agent-workbench";
import { EngineeringReviewPanel } from "@/components/engineering-review-panel";
import { EngineeringIntelligencePanel } from "@/components/engineering-intelligence-panel";
import { ImportedModelWorkspace } from "@/components/imported-model-workspace";
import { CADOperationInspector } from "@/components/cad-operation-inspector";
import { FeatureHistoryWorkspace } from "@/components/feature-history-workspace";
import { CircleFeatureHistoryPanel } from "@/components/circle-feature-history-panel";
import { CircularPatternPanel } from "@/components/circular-pattern-panel";
import { RectangularPatternPanel } from "@/components/rectangular-pattern-panel";
import { trpc } from "@/lib/trpc";
import type { MountingBlockInput } from "@/shared/cad";
import type { CADAgentResult, CADConfiguration, CADModelStatus } from "@/shared/cadAgent";
import type { EngineeringMode } from "@/shared/engineeringIntelligence";
import type { CADChangeProposal, GeometrySelectionContext, WorkbenchValidationStage } from "@/shared/cadWorkbench";

const DEFAULTS: MountingBlockInput = { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true };
const INITIAL_PROMPT = "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners. Add a 3 mm fillet.";

function tone(status?: string) {
  if (["VALIDATED", "VALID", "EXECUTED"].includes(status ?? "")) return "#1F8A70";
  if (["INVALID", "CONFLICT", "FAILED"].includes(status ?? "")) return "#B3261E";
  if (["STALE", "OPEN_QUESTION"].includes(status ?? "")) return "#DE6B35";
  return "#1167B1";
}

function Pill({ label }: { label: string }) {
  const color = tone(label);
  return <View style={[styles.pill, { backgroundColor: `${color}18` }]}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.pillText, { color }]}>{label}</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function commandPatch(command: string, current: MountingBlockInput): Partial<MountingBlockInput> | undefined {
  const text = command.toLowerCase();
  const match = command.match(/(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?/i);
  const raw = match ? Number(match[1]) : undefined;
  const value = raw === undefined ? undefined : match?.[2]?.toLowerCase() === "cm" ? raw * 10 : match?.[2]?.toLowerCase() === "m" ? raw * 1000 : raw;
  if (/width/.test(text) && value !== undefined) return { width: value };
  if (/(thickness|height)/.test(text) && value !== undefined) return { height: value };
  if (/(holes?|hole).*(outward|out|offset)/.test(text) && value !== undefined) return { holeEdgeOffset: current.holeEdgeOffset + value };
  if (/(holes?|hole).*(inward|in)/.test(text) && value !== undefined) return { holeEdgeOffset: Math.max(0.1, current.holeEdgeOffset - value) };
  if (/remove.*fillet/.test(text)) return { filletRadius: 0 };
  if (/fillet/.test(text) && value !== undefined) return { filletRadius: value };
  if (/diameter/.test(text) && value !== undefined) return { holeDiameter: value };
  return undefined;
}

export function CADWorkspace() {
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [width, setWidth] = useState("100");
  const [offset, setOffset] = useState("10");
  const [approved, setApproved] = useState(true);
  const [command, setCommand] = useState("Change width to 70 mm.");
  const [active, setActive] = useState<CADAgentResult>();
  const [dirty, setDirty] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>();
  const [selection, setSelection] = useState<ViewerSelection>();
  const [importedSelection, setImportedSelection] = useState<GeometrySelectionContext>();
  const [hidden, setHidden] = useState<string[]>([]);
  const [isolated, setIsolated] = useState<string>();
  const [bodyVisible, setBodyVisible] = useState(true);
  const [exportMessage, setExportMessage] = useState<string>();
  const [proposalPreview, setProposalPreview] = useState<{ proposal: CADChangeProposal; result: CADAgentResult }>();
  const [executionProposal, setExecutionProposal] = useState<CADChangeProposal>();
  const [exploratoryMode, setExploratoryMode] = useState(false);
  const [intelligenceMode, setIntelligenceMode] = useState<EngineeringMode>("NORMAL");

  const requirements = trpc.requirements.parse.useMutation();
  const create = trpc.cadAgent.createConfiguration.useMutation();
  const revise = trpc.cadAgent.reviseConfiguration.useMutation();
  const previewConfiguration = trpc.cadAgent.previewConfiguration.useMutation();
  const exportStep = trpc.cadAgent.exportStep.useMutation();
  const engineeringReview = trpc.engineering.review.useMutation();
  const intelligence = trpc.intelligence.analyze.useMutation();
  const configurations = trpc.cadAgent.listConfigurations.useQuery();

  const input = useMemo<MountingBlockInput>(() => ({ ...DEFAULTS, width: Number(width) || 0, holeEdgeOffset: Number(offset) || 0, approveAssumption: approved }), [approved, offset, width]);
  const requirementSet = active?.configuration.requirementSet ?? requirements.data?.requirementSet;
  const review = active?.configuration.engineeringReview ?? engineeringReview.data;
  const intelligenceResult = active?.configuration.engineeringIntelligence ?? intelligence.data;
  const modelStatus: CADModelStatus | "CONCEPTUAL" = dirty ? "STALE" : active?.configuration.modelStatus ?? "CONCEPTUAL";
  const activeId = active?.configuration.id;
  const configs = configurations.data ?? (active ? [active.configuration] : []);
  const pending = create.isPending || revise.isPending;
  const workbenchSelection = useMemo<GeometrySelectionContext>(() => {
    if (importedSelection) return importedSelection;
    if (selection) return { kind: selection.mode, id: selection.faceId, label: `${selection.mode} ${selection.faceId}`, featureId: selection.featureId, viewerFaceId: selection.faceId, source: "VIEWER" };
    if (selectedFeature) return { kind: "FEATURE", id: selectedFeature, label: selectedFeature, featureId: selectedFeature, source: "FEATURE_TREE" };
    return { kind: "NONE", label: "No geometry selected", source: "NONE" };
  }, [importedSelection, selectedFeature, selection]);
  const workbenchValidationStage: WorkbenchValidationStage = modelStatus === "VALIDATED" ? "GEOMETRICALLY_VALIDATED" : modelStatus === "CONCEPTUAL" ? "CONCEPTUAL" : "ESTIMATED";

  const adopt = (result: CADAgentResult) => { setActive(result); setDirty(false); setHidden([]); setIsolated(undefined); setExportMessage(undefined); configurations.refetch(); };
  const generate = () => {
    if (activeId) {
      revise.mutate({ configurationId: activeId, inputPatch: { width: input.width, holeEdgeOffset: input.holeEdgeOffset }, updateText: `Change width to ${input.width} mm and set hole edge offset to ${input.holeEdgeOffset} mm.` }, { onSuccess: adopt });
    } else create.mutate({ name: "Concept A", input, sourceText: prompt, conceptual: exploratoryMode }, { onSuccess: adopt });
  };
  const applyCommand = () => {
    if (!activeId) return Alert.alert("Generate first", "Create a validated configuration before applying a parametric change.");
    const patch = commandPatch(command, input);
    if (!patch) return Alert.alert("Unsupported command", "Use a numeric width, thickness, hole offset, hole diameter, or fillet command.");
    revise.mutate({ configurationId: activeId, inputPatch: patch, updateText: command }, { onSuccess: (result) => { adopt(result); if (patch.width !== undefined) setWidth(String(patch.width)); if (patch.holeEdgeOffset !== undefined) setOffset(String(patch.holeEdgeOffset)); } });
  };
  const createConceptB = () => {
    const conceptInput = { ...input, holeEdgeOffset: input.holeEdgeOffset + 5 };
    create.mutate({ name: "Concept B", input: conceptInput, sourceText: `Create a ${conceptInput.width} mm × ${conceptInput.depth} mm × ${conceptInput.height} mm mounting block with four ${conceptInput.holeDiameter} mm holes arranged at a ${conceptInput.holeEdgeOffset} mm edge offset and a ${conceptInput.filletRadius} mm fillet.` }, { onSuccess: adopt });
  };
  const choose = (configuration: CADConfiguration) => { setActive({ configuration, plan: configuration.plan, artifact: configuration.artifact, viewerMesh: configuration.viewerMesh }); setWidth(String(configuration.input.width)); setOffset(String(configuration.input.holeEdgeOffset)); setDirty(false); setHidden([]); setIsolated(undefined); };
  const downloadStep = () => {
    if (!activeId) return;
    exportStep.mutate({ configurationId: activeId }, { onSuccess: (result) => {
      setExportMessage(`Validated STEP ready · ${result.fileName} · ${result.byteLength.toLocaleString()} bytes`);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const bytes = Uint8Array.from(globalThis.atob(result.stepBase64), (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName; anchor.click(); URL.revokeObjectURL(url);
      }
    } });
  };
  const applyWorkbenchProposal = async (proposal: CADChangeProposal): Promise<boolean> => {
    const widthChange = proposal.parameters.find((parameter) => parameter.name === "width" && parameter.after);
    const nextWidth = widthChange?.after ? Number(widthChange.after) : Number.NaN;
    if (!activeId || !Number.isFinite(nextWidth) || nextWidth <= 0) return false;
    return new Promise((resolve) => revise.mutate({ configurationId: activeId, inputPatch: { width: nextWidth }, updateText: `Apply reviewed CAD Agent proposal: change width to ${nextWidth} mm.` }, { onSuccess: (result) => { adopt(result); setWidth(String(nextWidth)); resolve(true); }, onError: () => resolve(false) }));
  };
  const previewWorkbenchProposal = async (proposal: CADChangeProposal): Promise<boolean> => {
    const widthChange = proposal.parameters.find((parameter) => parameter.name === "width" && parameter.after);
    const nextWidth = widthChange?.after ? Number(widthChange.after) : Number.NaN;
    if (!activeId || !Number.isFinite(nextWidth) || nextWidth <= 0) return false;
    try {
      const result = await previewConfiguration.mutateAsync({ configurationId: activeId, inputPatch: { width: nextWidth }, updateText: `Preview CAD Agent proposal only: change width to ${nextWidth} mm.` });
      if (!result.viewerMesh || result.configuration.modelStatus !== "VALIDATED") return false;
      setProposalPreview({ proposal, result });
      return true;
    } catch { return false; }
  };
  const error = create.error?.message ?? revise.error?.message ?? previewConfiguration.error?.message ?? exportStep.error?.message ?? engineeringReview.error?.message ?? intelligence.error?.message ?? active?.error;
  const features = active?.plan.features ?? [];

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View><Text style={styles.eyebrow}>CAD-AI / CAD AGENT</Text><Text style={styles.title}>{active?.configuration.name ?? "Mounting Block"}</Text><Text style={styles.subtitle}>{active ? `REVISION ${active.configuration.revision} · ${active.plan.plan_id}` : "Requirements → Feature Plan → OpenCascade.js"}</Text></View><View style={styles.thread}><Text style={styles.threadKicker}>DIGITAL THREAD</Text><Text style={styles.threadValue}>{active?.configuration.id ?? "AWAITING PLAN"}</Text></View></View>

    <View style={styles.truth}><View style={styles.row}><Text style={styles.cardKicker}>GEOMETRY TRUTH · SEPARATE FROM ENGINEERING VALIDITY</Text><Pill label={modelStatus} /></View><Text style={styles.cardCopy}>{modelStatus === "VALIDATED" ? "OpenCascade.js validated the BRep, derived the viewer tessellation, and serialized a STEP artifact. Physical behavior, manufacturability, safety, and production readiness remain separate review states." : modelStatus === "STALE" ? "A parameter changed. Regenerate and validate before export." : "Only deterministic requirements validation and kernel evidence can create a trusted geometric model."}</Text></View>

    <Section title="PHASE 4 · NATIVE IMPORTED MODEL VIEWER"><ImportedModelWorkspace onGeometrySelection={setImportedSelection} /></Section>

    <Section title="PHASE 4.6 · GENERIC PARAMETRIC FEATURE HISTORY"><FeatureHistoryWorkspace onFeatureSelection={setImportedSelection} /></Section>

    <Section title="PHASE 4.7 · CIRCLE SKETCH + TOPOLOGY STABILITY"><CircleFeatureHistoryPanel onFeatureSelection={setImportedSelection} /></Section>

    <Section title="PHASE 4.9 · CONTROLLED PATTERN CAPABILITY"><CircularPatternPanel onFeatureSelection={setImportedSelection} /><RectangularPatternPanel onFeatureSelection={setImportedSelection} /></Section>

    <Section title="PHASE 3.7 · CAD AGENT CONVERSATIONAL WORKBENCH"><CADAgentWorkbench projectId={activeId ?? "WORKSPACE-EXPLORATION"} projectName={active?.configuration.name ?? "Mounting Block Study"} modelName={active?.configuration.name} configurationId={activeId} selectedGeometry={workbenchSelection} requirementSummary={requirementSet ? `${requirementSet.requirements.length} requirements · ${requirementSet.validation_status}` : "Requirements not validated"} featureSummary={selectedFeature ? `Selected feature ${selectedFeature}` : `${features.length} planned features`} parameterSummary={`Width ${input.width} mm · Depth ${input.depth} mm · Height ${input.height} mm · Hole Ø ${input.holeDiameter} mm · Offset ${input.holeEdgeOffset} mm · Fillet ${input.filletRadius} mm`} conceptSummary={active?.configuration.engineeringIntelligence ? `${active.configuration.engineeringIntelligence.candidates.length} engineering candidates attached` : "No intelligence candidates attached"} memorySummary={active?.configuration.engineeringIntelligence ? `${active.configuration.engineeringIntelligence.memory.length} project-session memory records` : "No project memory attached"} validationStage={workbenchValidationStage} onApplyProposal={applyWorkbenchProposal} onPreviewProposal={previewWorkbenchProposal} onProposalCreated={setExecutionProposal} /></Section>

    <Section title="PHASE 4.5 · CONTROLLED CAD EXECUTION"><CADOperationInspector configurationId={activeId} selectedGeometry={workbenchSelection} proposal={executionProposal} onExecuted={(configurationId) => { void configurations.refetch().then((refreshed) => { const configuration = refreshed.data?.find((item) => item.id === configurationId); if (configuration) setActive({ configuration, plan: configuration.plan, artifact: configuration.artifact, viewerMesh: configuration.viewerMesh }); }); setExecutionProposal(undefined); setProposalPreview(undefined); }} /></Section>

    <Section title="PHASE 3.6 · TRUTH, RIGOR & RADICAL PROBLEM SOLVING"><EngineeringReviewPanel review={review} exploratoryMode={exploratoryMode} onToggleExploration={() => setExploratoryMode((value) => !value)} onRunReview={() => engineeringReview.mutate({ sourceText: prompt, exploratoryMode, geometryStatus: active?.configuration.engineeringReview.reality.geometry, requirementSetId: requirementSet?.id, configurationId: activeId })} pending={engineeringReview.isPending} /></Section>

    <Section title="PHASE 3.5 · GENIUS ENGINEERING CORE"><EngineeringIntelligencePanel result={intelligenceResult} mode={intelligenceMode} onModeChange={setIntelligenceMode} onRun={() => intelligence.mutate({ sourceText: prompt, mode: intelligenceMode, projectId: activeId ?? "WORKSPACE-EXPLORATION", requestMajorInnovation: /major innovation|revolutionary|breakthrough/i.test(prompt), geometryStatus: active?.configuration.engineeringReview.reality.geometry })} pending={intelligence.isPending} /></Section>

    <Section title="NATURAL-LANGUAGE INTENT"><TextInput value={prompt} onChangeText={(value) => { setPrompt(value); setDirty(true); }} multiline style={styles.prompt} placeholderTextColor="#80909A" /><View style={styles.row}><Pressable style={styles.secondary} onPress={() => requirements.mutate({ sourceText: prompt, revision: requirementSet?.revision ?? 1 })}><Text style={styles.secondaryText}>{requirements.isPending ? "CHECKING…" : "VALIDATE REQUIREMENTS"}</Text></Pressable><Pressable style={({ pressed }) => [styles.approval, pressed && styles.pressed]} onPress={() => { setApproved(!approved); setDirty(true); }}><Text style={styles.approvalText}>{approved ? "✓ OFFSET APPROVED" : "APPROVE OFFSET"}</Text></Pressable></View></Section>

    <Section title="REQUIREMENTS AGENT · PREFLIGHT"><View style={styles.card}><View style={styles.row}><View><Text style={styles.cardTitle}>RequirementSet</Text><Text style={styles.meta}>{requirementSet ? `R${requirementSet.revision} · ${requirementSet.validation_status}` : "Not validated yet"}</Text></View>{requirementSet ? <Pill label={requirementSet.validation_status} /> : null}</View>{requirementSet?.requirements.slice(0, 5).map((item) => <View key={item.requirement_id} style={styles.req}><View style={{ flex: 1 }}><Text style={styles.reqId}>{item.requirement_id}</Text><Text style={styles.reqText}>{item.parameter ?? item.category} · {item.description}</Text></View><Text style={styles.reqValue}>{item.value ?? "—"} {item.unit ?? ""}</Text></View>)}{requirementSet?.open_questions.length ? <Text style={styles.alert}>OPEN QUESTIONS · {requirementSet.open_questions.map((item) => item.question).join(" ")}</Text> : null}{requirementSet?.conflicts.length ? <Text style={[styles.alert, styles.conflict]}>CONFLICTS · {requirementSet.conflicts.map((item) => item.explanation).join(" ")}</Text> : null}<Text style={styles.meta}>{requirementSet ? `${requirementSet.traceability.length} traceability links: Requirement → CAD parameter → feature.` : "No ambiguity is silently resolved."}</Text></View></Section>

    <Section title="PARAMETRIC INPUTS · MILLIMETRES"><View style={styles.grid}><View style={styles.param}><Text style={styles.paramLabel}>WIDTH</Text><TextInput value={width} onChangeText={(value) => { setWidth(value); setDirty(true); }} keyboardType="decimal-pad" style={styles.paramInput} /></View><View style={styles.param}><Text style={styles.paramLabel}>DEPTH</Text><Text style={styles.paramValue}>{DEFAULTS.depth}</Text></View><View style={styles.param}><Text style={styles.paramLabel}>HEIGHT</Text><Text style={styles.paramValue}>{DEFAULTS.height}</Text></View><View style={styles.param}><Text style={styles.paramLabel}>HOLE Ø</Text><Text style={styles.paramValue}>{DEFAULTS.holeDiameter}</Text></View><View style={styles.param}><Text style={styles.paramLabel}>HOLE OFFSET</Text><TextInput value={offset} onChangeText={(value) => { setOffset(value); setDirty(true); }} keyboardType="decimal-pad" style={styles.paramInput} /></View><View style={styles.param}><Text style={styles.paramLabel}>FILLET R</Text><Text style={styles.paramValue}>{DEFAULTS.filletRadius}</Text></View></View><Pressable disabled={pending} style={({ pressed }) => [styles.primary, pending && styles.disabled, pressed && styles.pressed]} onPress={generate}>{pending ? <ActivityIndicator color="#F3F1EA" /> : <Text style={styles.primaryText}>{active ? "REGENERATE REVISION" : "GENERATE VALIDATED CAD"}</Text>}</Pressable></Section>

    <Section title="CONVERSATIONAL MODIFICATION"><View style={styles.command}><TextInput value={command} onChangeText={setCommand} style={styles.commandInput} placeholder="Change width to 70 mm…" placeholderTextColor="#71828B" /><Pressable disabled={revise.isPending} style={styles.secondary} onPress={applyCommand}><Text style={styles.secondaryText}>{revise.isPending ? "UPDATING…" : "APPLY"}</Text></Pressable></View><Text style={styles.meta}>Supported: width, thickness, hole diameter, move holes outward/inward, add/remove fillet. Unsupported geometry operations are reported rather than invented.</Text></Section>

    <Section title="DESIGN CONFIGURATIONS"><View style={styles.card}><View style={styles.row}><Text style={styles.cardKicker}>{configs.length} PRESERVED CONFIGURATION{configs.length === 1 ? "" : "S"}</Text><Pressable style={styles.secondary} onPress={createConceptB}><Text style={styles.secondaryText}>CREATE CONCEPT B</Text></Pressable></View>{configs.map((configuration) => <Pressable key={configuration.id} style={[styles.config, configuration.id === activeId && styles.configActive]} onPress={() => choose(configuration)}><View><Text style={styles.cardTitle}>{configuration.name}</Text><Text style={styles.meta}>R{configuration.revision} · {configuration.input.width} × {configuration.input.depth} × {configuration.input.height} mm · offset {configuration.input.holeEdgeOffset} mm</Text></View><Pill label={configuration.id === activeId ? modelStatus : configuration.modelStatus} /></Pressable>)}</View></Section>

    <Section title="CAD VIEWER · REAL OPEN CASCADE TESSELLATION"><CADViewer mesh={active?.viewerMesh} selectedFeatureId={selectedFeature} onSelectionChange={setSelection} hiddenFeatureIds={hidden} isolatedFeatureId={isolated} bodyVisible={bodyVisible} /></Section>

    {proposalPreview ? <Section title="PROPOSAL PREVIEW · ORIGINAL PRESERVED"><View style={styles.preview}><Text style={styles.cardKicker}>CURRENT MODEL VERSUS PROPOSED KERNEL MODEL</Text><Text style={styles.meta}>{proposalPreview.proposal.title} · PREVIEW ONLY · The proposed artifact is not saved, exported, or applied.</Text><View style={styles.previewGrid}><View style={{ flex: 1 }}><Text style={styles.previewLabel}>CURRENT · {active?.configuration.id ?? "NONE"}</Text><CADViewer mesh={active?.viewerMesh} /></View><View style={{ flex: 1 }}><Text style={styles.previewLabel}>PROPOSED · {proposalPreview.result.configuration.id}</Text><CADViewer mesh={proposalPreview.result.viewerMesh} /></View></View><View style={styles.row}><Pressable style={styles.secondary} onPress={() => setProposalPreview(undefined)}><Text style={styles.secondaryText}>REJECT PREVIEW</Text></Pressable><Pressable style={styles.primary} onPress={() => { void applyWorkbenchProposal(proposalPreview.proposal).then((applied) => { if (applied) setProposalPreview(undefined); }); }}><Text style={styles.primaryText}>APPLY AS NEW REVISION</Text></Pressable></View></View></Section> : null}

    <Section title="FEATURE TREE · ORDERED EXECUTION"><View style={styles.card}>{features.length ? features.map((feature) => <View key={feature.id} style={styles.feature}><View style={styles.featureMain}><Pressable onPress={() => { setSelectedFeature(feature.id); setIsolated(undefined); }}><Text style={styles.cardTitle}>{feature.featureType} · {feature.id}</Text><Text style={styles.meta}>Parents: {feature.parentFeatures.length ? feature.parentFeatures.join(", ") : "ROOT"}</Text><Text style={styles.trace}>WHY · {feature.traceabilityRequirementIds.join(", ") || "No requirement link"}</Text></Pressable></View><View style={styles.featureActions}><Pill label={feature.executionStatus} /><Pressable style={styles.mini} onPress={() => setHidden((items) => items.includes(feature.id) ? items.filter((id) => id !== feature.id) : [...items, feature.id])}><Text style={styles.miniText}>{hidden.includes(feature.id) ? "SHOW" : "HIDE"}</Text></Pressable><Pressable style={styles.mini} onPress={() => setIsolated((id) => id === feature.id ? undefined : feature.id)}><Text style={styles.miniText}>{isolated === feature.id ? "ALL" : "ISO"}</Text></Pressable></View></View>) : <Text style={styles.meta}>Generate a validated configuration to inspect the deterministic plan.</Text>}<Pressable style={styles.bodyButton} onPress={() => setBodyVisible(!bodyVisible)}><Text style={styles.miniText}>{bodyVisible ? "HIDE BODY" : "SHOW BODY"}</Text></Pressable></View></Section>

    <Section title="MODEL EVIDENCE · STEP EXPORT"><View style={styles.export}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{active?.artifact ? "REAL STEP ARTIFACT" : "STEP BLOCKED"}</Text><Text style={styles.meta}>{active?.artifact ? `${active.artifact.stepByteLength?.toLocaleString()} bytes · ${active.artifact.validationStatus} · ${active.artifact.viewerAvailable ? "kernel tessellation" : "viewer unavailable"}` : "Export is enabled only after BRep validation succeeds."}</Text></View><Pressable disabled={modelStatus !== "VALIDATED" || exportStep.isPending} style={[styles.exportButton, (modelStatus !== "VALIDATED" || exportStep.isPending) && styles.disabled]} onPress={downloadStep}><Text style={styles.exportText}>{exportStep.isPending ? "EXPORTING…" : "EXPORT STEP"}</Text></Pressable></View>{exportMessage ? <Text style={styles.success}>{exportMessage}</Text> : null}<Text style={styles.meta}>{Platform.OS === "web" ? "A browser download is created from the validated real STEP bytes." : "The validated STEP artifact is available from the CAD Agent export endpoint."}</Text></Section>

    {selection ? <View style={styles.selection}><Text style={styles.cardKicker}>VIEWER SELECTION</Text><Text style={styles.cardCopy}>{selection.mode} · {selection.faceId} · {selection.featureId}</Text></View> : null}{error ? <View style={styles.error}><Text style={styles.cardKicker}>CAD AGENT STOPPED</Text><Text style={styles.cardCopy}>{error}</Text></View> : null}<Text style={styles.footer}>AI intent is untrusted until deterministic requirements validation, OpenCascade BRep generation, kernel validation, viewer tessellation, and STEP serialization succeed.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 18 }, header: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, eyebrow: { color: "#7B8A93", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" }, title: { color: "#F3F1EA", fontSize: 27, fontWeight: "800", marginTop: 5 }, subtitle: { color: "#7E929B", fontSize: 10, marginTop: 6, maxWidth: 215 }, thread: { borderWidth: 1, borderColor: "#34434B", borderRadius: 10, padding: 8, alignItems: "flex-end", maxWidth: 126 }, threadKicker: { color: "#6EA4CA", fontSize: 8, fontWeight: "800" }, threadValue: { color: "#A9B6BC", fontSize: 8, marginTop: 3, textAlign: "right" },
  truth: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 14, padding: 14 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, cardKicker: { color: "#9DAEB6", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 }, cardCopy: { color: "#D7E0E3", fontSize: 12, lineHeight: 18, marginTop: 8 }, pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5 }, dot: { width: 5, height: 5, borderRadius: 3 }, pillText: { fontSize: 8, fontWeight: "800" },
  section: { gap: 8 }, sectionTitle: { color: "#7B8A93", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" }, prompt: { minHeight: 82, borderColor: "#34434B", borderWidth: 1, borderRadius: 12, padding: 12, color: "#F3F1EA", backgroundColor: "#19232A", fontSize: 13, lineHeight: 19, textAlignVertical: "top" }, secondary: { borderRadius: 8, borderWidth: 1, borderColor: "#5B9DCA", paddingHorizontal: 10, paddingVertical: 8 }, secondaryText: { color: "#8EC4E8", fontSize: 9, fontWeight: "800" }, approval: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8 }, approvalText: { color: "#67B39F", fontSize: 9, fontWeight: "800" },
  card: { backgroundColor: "#192831", borderRadius: 14, padding: 13, gap: 9, borderWidth: 1, borderColor: "#2F4652" }, cardTitle: { color: "#F3F1EA", fontSize: 12, fontWeight: "800" }, meta: { color: "#7B8A93", fontSize: 9, lineHeight: 14, marginTop: 3 }, req: { flexDirection: "row", gap: 7, borderTopWidth: 1, borderTopColor: "#2B3A41", paddingTop: 8 }, reqId: { color: "#6EA4CA", fontSize: 8, fontWeight: "800" }, reqText: { color: "#D7E0E3", fontSize: 10, marginTop: 2 }, reqValue: { color: "#F3F1EA", fontSize: 9, fontWeight: "800", textAlign: "right", maxWidth: 80 }, alert: { backgroundColor: "#3A2A1C", borderLeftWidth: 3, borderLeftColor: "#DE6B35", color: "#F6D8C6", fontSize: 10, lineHeight: 15, padding: 8 }, conflict: { backgroundColor: "#3A1E1E", borderLeftColor: "#B3261E" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, param: { width: "48%", backgroundColor: "#192831", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#2F4652" }, paramLabel: { color: "#7B8A93", fontSize: 8, fontWeight: "800" }, paramValue: { color: "#F3F1EA", fontSize: 17, fontWeight: "700", marginTop: 5 }, paramInput: { color: "#8EC4E8", fontSize: 17, fontWeight: "700", marginTop: 1, padding: 0 }, primary: { minHeight: 51, borderRadius: 13, backgroundColor: "#1167B1", alignItems: "center", justifyContent: "center", marginTop: 3 }, primaryText: { color: "#F3F1EA", fontSize: 11, fontWeight: "800" }, command: { flexDirection: "row", gap: 8, backgroundColor: "#192831", borderWidth: 1, borderColor: "#2F4652", borderRadius: 12, padding: 9 }, commandInput: { flex: 1, minHeight: 36, borderWidth: 1, borderColor: "#34434B", borderRadius: 8, paddingHorizontal: 9, color: "#F3F1EA", fontSize: 10 },
  config: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#2B3A41" }, configActive: { backgroundColor: "#1D3440", marginHorizontal: -13, paddingHorizontal: 13 }, feature: { flexDirection: "row", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#2B3A41" }, featureMain: { flex: 1 }, trace: { color: "#6EA4CA", fontSize: 8, marginTop: 4 }, featureActions: { alignItems: "flex-end", gap: 4 }, mini: { borderWidth: 1, borderColor: "#34434B", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 }, miniText: { color: "#8EC4E8", fontSize: 8, fontWeight: "800" }, bodyButton: { alignItems: "center", paddingTop: 3 },
  export: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#192831", borderWidth: 1, borderColor: "#2F4652", borderRadius: 12 }, exportButton: { backgroundColor: "#1F8A70", paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 }, exportText: { color: "#F3F1EA", fontSize: 9, fontWeight: "800" }, success: { color: "#67B39F", fontSize: 9, lineHeight: 14 }, preview: { backgroundColor: "#192831", borderWidth: 1, borderColor: "#61538E", borderRadius: 12, padding: 10, gap: 8 }, previewGrid: { gap: 8 }, previewLabel: { color: "#C2B2F3", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }, selection: { backgroundColor: "#17303A", borderRadius: 10, padding: 11 }, error: { backgroundColor: "#3A1E1E", borderWidth: 1, borderColor: "#B3261E", borderRadius: 10, padding: 11 }, footer: { color: "#71828B", textAlign: "center", fontSize: 9, lineHeight: 14, paddingHorizontal: 10 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, disabled: { opacity: 0.5 },
});
