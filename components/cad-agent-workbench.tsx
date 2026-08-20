import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";

import { trpc } from "@/lib/trpc";
import { ENGINEERING_MODES, type EngineeringMode } from "@/shared/engineeringIntelligence";
import { WORKBENCH_COMMANDS, type CADAgentContext, type CADAgentMessage, type CADChangeProposal, type DesignHistoryEvent, type EngineeringEvidenceItem, type GeometrySelectionContext, type WorkbenchAttachment, type WorkbenchConceptCard, type WorkbenchValidationStage } from "@/shared/cadWorkbench";

function truthColor(status: string) {
  if (["GEOMETRICALLY_VALIDATED", "DERIVED", "CALCULATED", "APPLIED"].includes(status)) return "#67B39F";
  if (["PHYSICS_CONFLICT", "REJECTED", "BLOCKED"].includes(status)) return "#E25555";
  if (["SPECULATIVE", "HYPOTHETICAL", "ESTIMATED"].includes(status)) return "#B09AFF";
  return "#DE6B35";
}

function Truth({ label }: { label: string }) {
  const color = truthColor(label);
  return <View style={[styles.truth, { borderColor: color, backgroundColor: `${color}18` }]}><Text style={[styles.truthText, { color }]}>{label.replaceAll("_", " ")}</Text></View>;
}

function BlockTitle({ children }: { children: string }) { return <Text style={styles.blockTitle}>{children}</Text>; }

export function CADAgentWorkbench({
  projectId,
  projectName,
  modelName,
  configurationId,
  selectedGeometry,
  requirementSummary,
  featureSummary,
  parameterSummary,
  conceptSummary,
  memorySummary,
  validationStage,
  onApplyProposal,
}: {
  projectId: string;
  projectName: string;
  modelName?: string;
  configurationId?: string;
  selectedGeometry: GeometrySelectionContext;
  requirementSummary: string;
  featureSummary: string;
  parameterSummary: string;
  conceptSummary: string;
  memorySummary: string;
  validationStage: WorkbenchValidationStage;
  onApplyProposal?: (proposal: CADChangeProposal) => Promise<boolean>;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [mode, setMode] = useState<EngineeringMode>("NORMAL");
  const [draft, setDraft] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [messages, setMessages] = useState<CADAgentMessage[]>([]);
  const [proposals, setProposals] = useState<CADChangeProposal[]>([]);
  const [concepts, setConcepts] = useState<WorkbenchConceptCard[]>([]);
  const [evidence, setEvidence] = useState<EngineeringEvidenceItem[]>([]);
  const [history, setHistory] = useState<DesignHistoryEvent[]>([]);
  const [attachments, setAttachments] = useState<WorkbenchAttachment[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [workbenchNotice, setWorkbenchNotice] = useState<string>();

  const sendMessage = trpc.workbench.message.useMutation();
  const updateProposal = trpc.workbench.proposal.useMutation();
  const attachFile = trpc.workbench.attach.useMutation();
  const attachedFileIds = attachments.map((item) => item.id);
  const context = useMemo<CADAgentContext>(() => ({ projectId, projectName, configurationId, modelName, selectedGeometry, requirementSummary, featureSummary, parameterSummary, conceptSummary, memorySummary, validationStage, mode, attachedFileIds }), [attachedFileIds, configurationId, conceptSummary, featureSummary, memorySummary, mode, modelName, parameterSummary, projectId, projectName, requirementSummary, selectedGeometry, validationStage]);
  const selectedConcept = concepts.find((item) => item.id === selectedConceptId) ?? concepts[0];

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((value) => !value); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const send = (message = draft) => {
    const trimmed = message.trim();
    if (!trimmed || sendMessage.isPending) return;
    setWorkbenchNotice(undefined);
    sendMessage.mutate({ ...context, message: trimmed }, {
      onSuccess: (result) => {
        setMessages((items) => [...items, result.userMessage, result.agentMessage]);
        if (result.proposal) setProposals((items) => [...items, result.proposal!]);
        if (result.concepts.length) setConcepts((items) => [...items, ...result.concepts]);
        setEvidence(result.evidence);
        setHistory(result.history);
        setDraft("");
        setPaletteOpen(false);
      },
      onError: (error) => setWorkbenchNotice(`CAD Agent request failed honestly: ${error.message}`),
    });
  };

  const actOnProposal = async (proposal: CADChangeProposal, status: "PREVIEWED" | "APPLIED" | "REJECTED" | "EDIT_REQUESTED" | "REVERTED") => {
    let nextStatus = status;
    if (status === "APPLIED") {
      const applied = onApplyProposal ? await onApplyProposal(proposal) : false;
      if (!applied) { nextStatus = "EDIT_REQUESTED"; setWorkbenchNotice("The proposal was not silently applied: the selected change is not executable in the active CAD configuration. Edit it or use the supported parametric controls."); }
    }
    updateProposal.mutate({ projectId, proposalId: proposal.id, status: nextStatus }, { onSuccess: (updated) => setProposals((items) => items.map((item) => item.id === updated.id ? updated : item)), onError: (error) => setWorkbenchNotice(`Proposal update failed: ${error.message}`) });
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      for (const asset of result.assets) {
        attachFile.mutate({ projectId, conversationId: "CURRENT-CONVERSATION", name: asset.name, sizeBytes: asset.size, mimeType: asset.mimeType }, { onSuccess: (attachment) => setAttachments((items) => [...items, attachment]), onError: (error) => setWorkbenchNotice(`Attachment metadata could not be associated: ${error.message}`) });
      }
    } catch (error) {
      setWorkbenchNotice(`File selection failed. No file was interpreted. ${error instanceof Error ? error.message : "Unknown picker error."}`);
    }
  };

  const copyMessage = async (message: CADAgentMessage) => {
    try { await Clipboard.setStringAsync(message.text); setCopiedMessageId(message.id); } catch { setWorkbenchNotice("Clipboard copy was not available. The response remains visible in this workbench."); }
  };

  const evolve = (concept: WorkbenchConceptCard) => {
    const evolved: WorkbenchConceptCard = { ...concept, id: `${concept.id}-EVOLVED-${Date.now()}`, name: `${concept.name} · Evolved`, state: "EVOLVED", risks: [...concept.risks, "Evolution remains conceptual until requirements and evidence are reassessed."], engineeringConfidence: Math.min(concept.engineeringConfidence, 0.35) };
    setConcepts((items) => [...items, evolved]);
    setSelectedConceptId(evolved.id);
    setWorkbenchNotice("A separate evolved concept branch was created. The original concept remains preserved.");
  };

  const rejectConcept = (conceptId: string) => setConcepts((items) => items.map((item) => item.id === conceptId ? { ...item, state: "REJECTED" } : item));

  return <View style={[styles.shell, isWide && styles.shellWide]}>
    <View style={styles.contextBar} accessibilityLabel="CAD Agent active engineering context">
      <Text style={styles.contextLabel}>CAD AGENT CONTEXT</Text>
      <View style={styles.contextGrid}>
        <Text style={styles.contextItem}>PROJECT · {projectName}</Text><Text style={styles.contextItem}>MODEL · {modelName ?? "NONE"}</Text><Text style={styles.contextItem}>SELECTED · {selectedGeometry.kind}: {selectedGeometry.label}</Text><Text style={styles.contextItem}>MODE · {mode.replace("_", " ")}</Text><Text style={styles.contextItem}>REQUIREMENTS · {requirementSummary}</Text><Text style={styles.contextItem}>VALIDATION · {validationStage.replaceAll("_", " ")}</Text><Text style={styles.contextItem}>FILES · {attachments.length}</Text>
      </View>
    </View>

    <View style={[styles.columns, isWide && styles.columnsWide]}>
      <View style={[styles.chatColumn, isWide && styles.chatColumnWide]}>
        <View style={styles.chatHeader}><View><Text style={styles.title}>CAD AGENT</Text><Text style={styles.subTitle}>Engineering copilot attached to the active CAD context — not a generic chat.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open CAD Agent command palette" style={styles.commandButton} onPress={() => setPaletteOpen((value) => !value)}><Text style={styles.commandButtonText}>⌘ / CTRL K</Text></Pressable></View>
        <View style={styles.modeRow}>{ENGINEERING_MODES.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Set CAD Agent mode to ${item.replace("_", " ")}`} style={[styles.mode, mode === item && styles.modeActive]} onPress={() => setMode(item)}><Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item.replace("_", " ")}</Text></Pressable>)}</View>
        {paletteOpen ? <View style={styles.palette}><Text style={styles.paletteTitle}>COMMAND PALETTE</Text>{WORKBENCH_COMMANDS.map((command) => <Pressable key={command.id} accessibilityRole="button" accessibilityLabel={`${command.label}: ${command.description}`} style={styles.commandItem} onPress={() => { setDraft(command.label === "Ask CAD Agent" ? "" : `${command.label}: `); setPaletteOpen(false); }}><View><Text style={styles.commandName}>{command.label}</Text><Text style={styles.commandDescription}>{command.description}</Text></View><Text style={styles.shortcut}>{command.shortcut}</Text></Pressable>)}</View> : null}
        <View style={styles.messageList}>{messages.length ? messages.map((message) => <View key={message.id} style={[styles.message, message.role === "USER" ? styles.userMessage : styles.agentMessage]}><View style={styles.messageTop}><Text style={styles.messageRole}>{message.role === "USER" ? "YOU" : "CAD AGENT"}</Text><Truth label={message.truthStatus} /></View><Text style={styles.messageText}>{message.text}</Text>{message.role === "CAD_AGENT" ? <Pressable accessibilityRole="button" accessibilityLabel="Copy CAD Agent response" style={styles.copyButton} onPress={() => copyMessage(message)}><Text style={styles.copyText}>{copiedMessageId === message.id ? "COPIED" : "COPY"}</Text></Pressable> : null}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>CONTEXTUAL ENGINEERING CONVERSATION</Text><Text style={styles.emptyText}>Try “Make this stronger,” “Generate five alternative architectures,” “Challenge this design,” or “Prepare this concept for CAD generation.” Selected geometry and validation state travel with every message.</Text></View>}</View>
        <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => send()} returnKeyType="send" multiline style={styles.input} placeholder="Ask CAD Agent about the active model, feature, selection, requirements, or concepts…" placeholderTextColor="#71828B" accessibilityLabel="CAD Agent message" /><View style={styles.composerActions}><Pressable accessibilityRole="button" accessibilityLabel="Attach engineering file" style={styles.attachmentButton} onPress={pickFiles}><Text style={styles.attachmentText}>{attachFile.isPending ? "ATTACHING…" : "ATTACH"}</Text></Pressable><Pressable disabled={sendMessage.isPending} accessibilityRole="button" accessibilityLabel="Send message to CAD Agent" style={[styles.sendButton, sendMessage.isPending && styles.disabled]} onPress={() => send()}>{sendMessage.isPending ? <ActivityIndicator color="#F3F1EA" /> : <Text style={styles.sendText}>SEND</Text>}</Pressable></View></View>
        <Text style={styles.chatNote}>Responses are deterministic and inspectable. There is no hidden chain-of-thought, streaming LLM, background solver, or fabricated evidence in this phase.</Text>
      </View>

      <View style={[styles.inspectorColumn, isWide && styles.inspectorColumnWide]}>
        <View style={styles.inspector}><BlockTitle>PROPOSED CHANGES</BlockTitle>{proposals.length ? proposals.slice().reverse().map((proposal) => <View key={proposal.id} style={styles.proposal}><View style={styles.proposalTop}><Text style={styles.proposalTitle}>{proposal.title}</Text><Truth label={proposal.status} /></View><Text style={styles.detailLabel}>BEFORE</Text><Text style={styles.detail}>{proposal.before}</Text><Text style={styles.detailLabel}>AFTER</Text><Text style={styles.detail}>{proposal.after}</Text><Text style={styles.detailLabel}>AFFECTED</Text><Text style={styles.detail}>{proposal.affectedGeometry.length ? proposal.affectedGeometry.map((item) => `${item.kind}: ${item.label}`).join(" · ") : "Active model scope; no geometry is selected."}</Text><Text style={styles.detailLabel}>EXPECTED EFFECT</Text><Text style={styles.detail}>{proposal.expectedEffect}</Text><Text style={styles.detailLabel}>RISKS</Text><Text style={styles.detail}>{proposal.risks.join(" ")}</Text><Text style={styles.detailLabel}>VALIDATION</Text><View style={styles.proposalStatus}><Truth label={proposal.validationStage} /><Truth label={proposal.truthStatus} /></View><View style={styles.proposalActions}><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "PREVIEWED")}><Text style={styles.secondaryText}>PREVIEW</Text></Pressable><Pressable accessibilityRole="button" style={styles.primaryAction} onPress={() => actOnProposal(proposal, "APPLIED")}><Text style={styles.primaryActionText}>APPLY</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "REJECTED")}><Text style={styles.secondaryText}>REJECT</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "EDIT_REQUESTED")}><Text style={styles.secondaryText}>EDIT</Text></Pressable></View><Text style={styles.reversible}>REVERSIBLE · {proposal.reversible ? "YES" : "NO"}</Text></View>) : <Text style={styles.muted}>No proposed operation. CAD Agent cannot silently modify geometry.</Text>}</View>

        <View style={styles.inspector}><BlockTitle>CONCEPT EXPLORER</BlockTitle>{concepts.length ? concepts.map((concept) => <View key={concept.id} style={[styles.concept, selectedConcept?.id === concept.id && styles.conceptSelected]}><View style={styles.proposalTop}><Text style={styles.proposalTitle}>{concept.name}</Text><Truth label={concept.truthStatus} /></View><Text style={styles.detail}>{concept.architecture} · {concept.primaryMechanism}</Text><Text style={styles.detailLabel}>ADVANTAGES</Text><Text style={styles.detail}>{concept.advantages.join(" ")}</Text><Text style={styles.detailLabel}>RISKS & UNKNOWNS</Text><Text style={styles.detail}>{[...concept.risks, ...concept.unknowns].join(" ")}</Text><Text style={styles.detailLabel}>MANUFACTURING</Text><Text style={styles.detail}>{concept.manufacturingConsiderations.join(" ")}</Text><Text style={styles.conceptMeta}>CONFIDENCE {Math.round(concept.engineeringConfidence * 100)}% · {concept.validationStage.replaceAll("_", " ")} · {concept.state}</Text><View style={styles.proposalActions}><Pressable style={styles.secondary} onPress={() => setSelectedConceptId(concept.id)}><Text style={styles.secondaryText}>PREVIEW</Text></Pressable><Pressable style={styles.secondary} onPress={() => setWorkbenchNotice(`Compare ${concept.name}: select another concept card to inspect a different architecture. No performance winner is asserted without shared evidence.`)}><Text style={styles.secondaryText}>COMPARE</Text></Pressable><Pressable style={styles.secondary} onPress={() => setWorkbenchNotice(`Generate CAD for ${concept.name} is blocked until its geometry, interfaces, requirements, and supported feature operations are defined.`)}><Text style={styles.secondaryText}>GENERATE CAD</Text></Pressable><Pressable style={styles.secondary} onPress={() => evolve(concept)}><Text style={styles.secondaryText}>EVOLVE</Text></Pressable><Pressable style={styles.secondary} onPress={() => rejectConcept(concept.id)}><Text style={styles.secondaryText}>REJECT</Text></Pressable></View></View>) : <Text style={styles.muted}>Ask the CAD Agent to generate alternatives. Concept cards will remain conceptual and evidence-labeled.</Text>}</View>
      </View>
    </View>

    <View style={[styles.lowerGrid, isWide && styles.lowerGridWide]}>
      <View style={styles.inspector}><BlockTitle>ENGINEERING EVIDENCE</BlockTitle>{evidence.length ? evidence.map((item) => <View key={item.id} style={styles.evidence}><View style={styles.proposalTop}><Text style={styles.evidenceTitle}>{item.category} · {item.label}</Text><Truth label={item.truthStatus} /></View><Text style={styles.detail}>{item.detail}</Text>{!item.available ? <Text style={styles.notVerified}>NOT VERIFIED</Text> : null}</View>) : <Text style={styles.muted}>Send a CAD Agent message to assemble an evidence panel. Missing evidence will be labeled NOT VERIFIED.</Text>}</View>
      <View style={styles.inspector}><BlockTitle>DESIGN HISTORY</BlockTitle>{history.length ? history.slice().reverse().map((event) => <View key={event.id} style={styles.history}><Text style={styles.historyKind}>{event.kind}</Text><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{event.title}</Text><Text style={styles.detail}>{event.detail}</Text><Text style={styles.historyMeta}>{event.timestamp.slice(11, 19)} · {event.validationStage.replaceAll("_", " ")} · {event.reversible ? "REVERSIBLE" : "INSPECT ONLY"}</Text></View><Truth label={event.truthStatus} /></View>) : <Text style={styles.muted}>History records requirements, concepts, CAD actions, modifications, validation, revisions, proposals, conversations, and file references as they occur.</Text>}</View>
      <View style={styles.inspector}><BlockTitle>FILE CENTER</BlockTitle>{attachments.length ? attachments.map((attachment) => <View key={attachment.id} style={styles.file}><View style={styles.proposalTop}><Text style={styles.fileName}>{attachment.name}</Text><Truth label={attachment.parseStatus} /></View><Text style={styles.detail}>{attachment.fileKind} · {attachment.sizeBytes?.toLocaleString() ?? "unknown"} bytes · {attachment.mimeType ?? "unknown type"}</Text><Text style={styles.detail}>{attachment.failureReason}</Text></View>) : <Text style={styles.muted}>Attach STEP, STP, IGES, IGS, STL, OBJ, DXF, PDF, CSV, images, or engineering documents. This phase validates metadata only; it does not claim content interpretation.</Text>}</View>
    </View>
    {workbenchNotice ? <View style={styles.notice}><Text style={styles.noticeTitle}>WORKBENCH NOTICE</Text><Text style={styles.noticeText}>{workbenchNotice}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { gap: 12 }, shellWide: { maxWidth: 1400, alignSelf: "center", width: "100%" }, contextBar: { backgroundColor: "#13242D", borderWidth: 1, borderColor: "#365667", borderRadius: 12, padding: 10, gap: 7 }, contextLabel: { color: "#88B9D2", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, contextGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, contextItem: { color: "#D0E0E5", fontSize: 8, borderWidth: 1, borderColor: "#395363", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4 }, columns: { gap: 12 }, columnsWide: { flexDirection: "row", alignItems: "flex-start" }, chatColumn: { gap: 10 }, chatColumnWide: { flex: 1.25 }, inspectorColumn: { gap: 10 }, inspectorColumnWide: { flex: 1 }, chatHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }, title: { color: "#F3F1EA", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 }, subTitle: { color: "#91A4AD", fontSize: 9, lineHeight: 14, marginTop: 3, maxWidth: 300 }, commandButton: { borderWidth: 1, borderColor: "#5E91AB", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 }, commandButtonText: { color: "#9DD0EC", fontSize: 8, fontWeight: "900" }, modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, mode: { borderWidth: 1, borderColor: "#425D6C", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 6 }, modeActive: { backgroundColor: "#145E95", borderColor: "#6CB6E3" }, modeText: { color: "#A7C4D2", fontSize: 8, fontWeight: "900" }, modeTextActive: { color: "#F5F9FA" }, palette: { backgroundColor: "#1B2930", borderWidth: 1, borderColor: "#4E7182", borderRadius: 9, padding: 8, gap: 3 }, paletteTitle: { color: "#A6D5ED", fontSize: 9, fontWeight: "900", marginBottom: 3 }, commandItem: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#334B58" }, commandName: { color: "#E2EAED", fontSize: 10, fontWeight: "800" }, commandDescription: { color: "#91A6B0", fontSize: 8, lineHeight: 12, maxWidth: 300 }, shortcut: { color: "#78B7DB", fontSize: 9, fontWeight: "900" }, messageList: { gap: 8, minHeight: 120 }, message: { borderRadius: 10, padding: 10, gap: 5, borderWidth: 1 }, userMessage: { backgroundColor: "#1B3140", borderColor: "#365F78" }, agentMessage: { backgroundColor: "#1A252B", borderColor: "#3B515C" }, messageTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, messageRole: { color: "#9DCDE8", fontSize: 8, fontWeight: "900" }, messageText: { color: "#DCE5E8", fontSize: 10, lineHeight: 15 }, copyButton: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: "#486274", borderRadius: 5 }, copyText: { color: "#A4D2EA", fontSize: 8, fontWeight: "900" }, empty: { backgroundColor: "#172127", borderWidth: 1, borderStyle: "dashed", borderColor: "#48606C", borderRadius: 10, padding: 12, gap: 4 }, emptyTitle: { color: "#9DCCE4", fontSize: 9, fontWeight: "900" }, emptyText: { color: "#A5B4BA", fontSize: 10, lineHeight: 15 }, composer: { backgroundColor: "#17242B", borderWidth: 1, borderColor: "#3B5665", borderRadius: 10, padding: 8, gap: 7 }, input: { minHeight: 62, color: "#F3F1EA", fontSize: 11, lineHeight: 16, textAlignVertical: "top" }, composerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7 }, attachmentButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: "#7194A8" }, attachmentText: { color: "#B2D9EC", fontSize: 8, fontWeight: "900" }, sendButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 7, backgroundColor: "#1167B1", minWidth: 64, alignItems: "center" }, sendText: { color: "#F5F9FA", fontSize: 8, fontWeight: "900" }, chatNote: { color: "#7E939D", fontSize: 8, lineHeight: 12 }, inspector: { backgroundColor: "#172228", borderWidth: 1, borderColor: "#36505E", borderRadius: 11, padding: 10, gap: 8 }, blockTitle: { color: "#86B9D5", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, muted: { color: "#91A3AA", fontSize: 9, lineHeight: 14 }, proposal: { backgroundColor: "#202B31", borderWidth: 1, borderColor: "#4D6673", borderRadius: 8, padding: 8, gap: 4 }, proposalTop: { flexDirection: "row", justifyContent: "space-between", gap: 7, alignItems: "flex-start" }, proposalTitle: { color: "#E4ECEE", fontSize: 10, fontWeight: "900", flex: 1 }, detailLabel: { color: "#87B8CF", fontSize: 7, fontWeight: "900", marginTop: 2 }, detail: { color: "#BDCDD3", fontSize: 8, lineHeight: 12 }, proposalStatus: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, proposalActions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 3 }, secondary: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#608EA7" }, secondaryText: { color: "#A5D5ED", fontSize: 8, fontWeight: "900" }, primaryAction: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6, backgroundColor: "#1F8A70" }, primaryActionText: { color: "#F3F1EA", fontSize: 8, fontWeight: "900" }, reversible: { color: "#9ECDB8", fontSize: 7, fontWeight: "900" }, concept: { backgroundColor: "#1C2632", borderWidth: 1, borderColor: "#495371", borderRadius: 8, padding: 8, gap: 4 }, conceptSelected: { borderColor: "#A78BF0", backgroundColor: "#272440" }, conceptMeta: { color: "#C2B2F3", fontSize: 8, fontWeight: "900" }, lowerGrid: { gap: 12 }, lowerGridWide: { flexDirection: "row", alignItems: "flex-start" }, evidence: { borderTopWidth: 1, borderTopColor: "#334A55", paddingTop: 7, gap: 3 }, evidenceTitle: { color: "#C7D8DE", fontSize: 8, fontWeight: "900", flex: 1 }, notVerified: { color: "#F0A776", fontSize: 8, fontWeight: "900" }, history: { flexDirection: "row", gap: 7, borderTopWidth: 1, borderTopColor: "#334A55", paddingTop: 7 }, historyKind: { color: "#83B8D7", fontSize: 7, fontWeight: "900", width: 62 }, historyTitle: { color: "#DCE6E9", fontSize: 9, fontWeight: "900" }, historyMeta: { color: "#8CA0A9", fontSize: 7, marginTop: 3 }, file: { backgroundColor: "#1C2830", borderWidth: 1, borderColor: "#3D5968", borderRadius: 7, padding: 8, gap: 3 }, fileName: { color: "#D5E5EA", fontSize: 9, fontWeight: "900", flex: 1 }, notice: { backgroundColor: "#3A2A1C", borderLeftWidth: 3, borderLeftColor: "#DE6B35", borderRadius: 7, padding: 9, gap: 3 }, noticeTitle: { color: "#F1C2A1", fontSize: 8, fontWeight: "900" }, noticeText: { color: "#E5D0C3", fontSize: 9, lineHeight: 14 }, truth: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, alignSelf: "flex-start" }, truthText: { fontSize: 7, fontWeight: "900" }, disabled: { opacity: 0.5 },
});
