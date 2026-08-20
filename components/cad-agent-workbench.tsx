import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { trpc } from "@/lib/trpc";
import { loadProjectAccess, saveProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { ENGINEERING_MODES, type EngineeringMode } from "@/shared/engineeringIntelligence";
import { WORKBENCH_COMMANDS, type CADAgentContext, type CADAgentMessage, type CADChangeProposal, type DesignHistoryEvent, type EngineeringEvidenceItem, type GeometrySelectionContext, type WorkbenchConceptCard, type WorkbenchValidationStage } from "@/shared/cadWorkbench";
import type { CADFileContext } from "@/shared/cadFile";
import type { PersistentMessage } from "@/shared/persistentMemory";

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

function bytesLabel(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`; }
function geometrySummary(file: CADFileContext) {
  if (file.step) return `${file.step.solids.value ?? "UNKNOWN"} solid(s) · ${file.step.faces.value ?? "UNKNOWN"} face(s) · ${file.step.edges.value ?? "UNKNOWN"} edge(s)`;
  if (file.stl) return `${file.stl.triangles.value ?? "UNKNOWN"} triangles · watertight ${file.stl.watertight.value === undefined ? "UNKNOWN" : file.stl.watertight.value ? "YES" : "NO"}`;
  return "No trustworthy geometry metadata was produced.";
}
function parserFactSummary(file: CADFileContext) { return `${file.format} · ${file.parseStatus} · ${geometrySummary(file)} · units ${file.units.value ?? "UNKNOWN"} (${file.units.provenance})${file.boundingBox ? ` · extent ${file.boundingBox.size.map((value) => value.toFixed(3)).join(" × ")}` : ""}`; }

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
  onPreviewProposal,
  onProposalCreated,
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
  onPreviewProposal?: (proposal: CADChangeProposal) => Promise<boolean>;
  onProposalCreated?: (proposal: CADChangeProposal) => void;
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
  const [referencedCadFileIds, setReferencedCadFileIds] = useState<string[]>([]);
  const [selectedCadFileId, setSelectedCadFileId] = useState<string>();
  const [compareCadFileIds, setCompareCadFileIds] = useState<string[]>([]);
  const [cadFileAnalysis, setCadFileAnalysis] = useState<string>();
  const [uploadStage, setUploadStage] = useState<"IDLE" | "UPLOADING" | "PROCESSING" | "PARSING" | "READY" | "FAILED">("IDLE");
  const [selectedConceptId, setSelectedConceptId] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [workbenchNotice, setWorkbenchNotice] = useState<string>();
  const [persistentProject, setPersistentProject] = useState<StoredProjectAccess>();
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [conversationTitleDraft, setConversationTitleDraft] = useState("");
  const [lineageByConcept, setLineageByConcept] = useState<Record<string, string>>({});
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryResponse, setMemoryResponse] = useState<string>();
  const [showArchivedConversations, setShowArchivedConversations] = useState(false);

  const openPersistentProject = trpc.persistentMemory.openProject.useMutation();
  const createPersistentConversation = trpc.persistentMemory.createConversation.useMutation();
  const updatePersistentConversation = trpc.persistentMemory.updateConversation.useMutation();
  const sendMessage = trpc.persistentMemory.message.useMutation();
  const uploadCadFile = trpc.cadFiles.upload.useMutation();
  const removeCadFile = trpc.cadFiles.remove.useMutation();
  const analyzeCadFile = trpc.cadFiles.analyze.useMutation();
  const persistentConceptDecision = trpc.persistentMemory.decideConcept.useMutation();
  const persistentProposalDecision = trpc.persistentMemory.decideProposal.useMutation();
  const updateProposal = trpc.workbench.proposal.useMutation();
  const utils = trpc.useUtils();
  const conversations = trpc.persistentMemory.listConversations.useQuery({ projectId: persistentProject?.projectId ?? "UNAVAILABLE", accessKey: persistentProject?.accessKey ?? "UNAVAILABLE", includeArchived: showArchivedConversations }, { enabled: Boolean(persistentProject) });
  const memorySnapshot = trpc.persistentMemory.snapshot.useQuery({ projectId: persistentProject?.projectId ?? "UNAVAILABLE", accessKey: persistentProject?.accessKey ?? "UNAVAILABLE" }, { enabled: Boolean(persistentProject) });
  const cadFiles = trpc.cadFiles.list.useQuery({ projectId: persistentProject?.projectId ?? "UNAVAILABLE", accessKey: persistentProject?.accessKey ?? "UNAVAILABLE", includeRemoved: false }, { enabled: Boolean(persistentProject) });
  const visibleCadFiles = cadFiles.data ?? [];
  const selectedCadFile = visibleCadFiles.find((file) => file.fileId === selectedCadFileId);
  const context = useMemo<CADAgentContext>(() => ({ projectId, projectName, configurationId, modelName, selectedGeometry, requirementSummary, featureSummary, parameterSummary, conceptSummary, memorySummary, validationStage, mode, attachedFileIds: referencedCadFileIds }), [configurationId, conceptSummary, featureSummary, memorySummary, mode, modelName, parameterSummary, projectId, projectName, referencedCadFileIds, requirementSummary, selectedGeometry, validationStage]);
  const selectedConcept = concepts.find((item) => item.id === selectedConceptId) ?? concepts[0];

  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      const stored = await loadProjectAccess("active-engineering-workbench");
      openPersistentProject.mutate({ name: projectName, projectId: stored?.projectId, accessKey: stored?.accessKey }, {
        onSuccess: async (project) => {
          if (cancelled) return;
          const credentials = { projectId: project.id, accessKey: project.accessKey, projectName: project.name };
          await saveProjectAccess("active-engineering-workbench", credentials);
          if (cancelled) return;
          setPersistentProject(credentials);
          try {
            const existing = await utils.persistentMemory.listConversations.fetch({ projectId: project.id, accessKey: project.accessKey });
            if (existing[0]) {
              const restored = await utils.persistentMemory.restoreConversation.fetch({ projectId: project.id, accessKey: project.accessKey, conversationId: existing[0].id });
              if (!cancelled) {
                const restoredMessages = restored.messages.map((message) => ({ id: message.id, role: message.role, text: message.text, createdAt: message.createdAt, actionKind: message.actionKind as CADAgentMessage["actionKind"], truthStatus: message.truthStatus, context: { ...context, ...message.context, projectId: project.id, projectName: project.name, mode: message.mode, attachedFileIds: [] } }));
                setMessages(restoredMessages);
                setActiveConversationId(restored.conversation.id);
                setConversationTitleDraft(restored.conversation.title);
                setWorkbenchNotice(`Recovered ${restored.messages.length} persisted messages for this authorized project.`);
              }
            } else {
              createPersistentConversation.mutate({ projectId: project.id, accessKey: project.accessKey, title: "CAD Agent workbench", reason: "Opened persistent workbench session" }, { onSuccess: (conversation) => { if (!cancelled) { setActiveConversationId(conversation.id); setConversationTitleDraft(conversation.title); } }, onError: (error) => setWorkbenchNotice(`Persistent conversation could not be created: ${error.message}`) });
            }
          } catch (error) { if (!cancelled) setWorkbenchNotice(`Persistent conversation history could not be restored: ${error instanceof Error ? error.message : "Unknown error"}`); }
        },
        onError: (error) => setWorkbenchNotice(`Persistent project memory is unavailable: ${error.message}`),
      });
    };
    void open();
    return () => { cancelled = true; };
  }, []);

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
    if (!trimmed || sendMessage.isPending || !persistentProject || !activeConversationId) { if (!persistentProject || !activeConversationId) setWorkbenchNotice("Persistent project memory is initializing. No message was sent before an authorized project and conversation were created."); return; }
    setWorkbenchNotice(undefined);
    sendMessage.mutate({ ...context, projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId: activeConversationId, message: trimmed }, {
      onSuccess: (result) => {
        setMessages((items) => [...items, result.userMessage, result.agentMessage]);
        if (result.proposal) { setProposals((items) => [...items, result.proposal!]); onProposalCreated?.(result.proposal); }
        if (result.concepts.length) setConcepts((items) => [...items, ...result.concepts]);
        setEvidence(result.evidence);
        setHistory(result.history);
        setLineageByConcept((items) => ({ ...items, ...result.lineageByConcept }));
        setDraft("");
        setPaletteOpen(false);
        void memorySnapshot.refetch();
        void conversations.refetch();
      },
      onError: (error) => setWorkbenchNotice(`CAD Agent request failed honestly: ${error.message}`),
    });
  };

  const actOnProposal = async (proposal: CADChangeProposal, status: "PREVIEWED" | "APPLIED" | "REJECTED" | "EDIT_REQUESTED" | "REVERTED") => {
    let nextStatus = status;
    if (status === "PREVIEWED") {
      const previewed = onPreviewProposal ? await onPreviewProposal(proposal) : false;
      if (!previewed) setWorkbenchNotice("No proposed geometry preview was rendered. The proposal remains inspectable, but it cannot be shown as a kernel-derived alternate model for this active configuration.");
    }
    if (status === "APPLIED") {
      const applied = onApplyProposal ? await onApplyProposal(proposal) : false;
      if (!applied) { nextStatus = "EDIT_REQUESTED"; setWorkbenchNotice("The proposal was not silently applied: the selected change is not executable in the active CAD configuration. Edit it or use the supported parametric controls."); }
    }
    updateProposal.mutate({ projectId: persistentProject?.projectId ?? projectId, proposalId: proposal.id, status: nextStatus }, { onSuccess: (updated) => {
      setProposals((items) => items.map((item) => item.id === updated.id ? updated : item));
      if (persistentProject && activeConversationId) persistentProposalDecision.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId: activeConversationId, proposalId: proposal.id, title: proposal.title, action: nextStatus, detail: `User selected ${nextStatus}. ${nextStatus === "APPLIED" ? "The supported CAD revision route was requested explicitly." : "No geometry was silently changed."}` }, { onSuccess: () => void memorySnapshot.refetch() });
    }, onError: (error) => setWorkbenchNotice(`Proposal update failed: ${error.message}`) });
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      for (const asset of result.assets) {
        if (!persistentProject || !activeConversationId) { setWorkbenchNotice("Persistent project memory is initializing. The selected bytes were not uploaded, associated, or interpreted."); return; }
        if ((asset.size ?? 0) > 10 * 1024 * 1024) { setUploadStage("FAILED"); setWorkbenchNotice(`${asset.name} was not uploaded: picker metadata exceeds the 10 MiB CAD file limit. The server independently enforces the same bound.`); continue; }
        setUploadStage("UPLOADING");
        try {
          const base64 = asset.base64 ?? await new File(asset.uri).base64();
          setUploadStage("PROCESSING");
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          setUploadStage("PARSING");
          const uploaded = await uploadCadFile.mutateAsync({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId: activeConversationId, fileName: asset.name, mimeType: asset.mimeType ?? undefined, base64 });
          await cadFiles.refetch();
          setSelectedCadFileId(uploaded.file.fileId);
          setReferencedCadFileIds((items) => items.includes(uploaded.file.fileId) ? items : [...items, uploaded.file.fileId]);
          setUploadStage(uploaded.file.parseStatus === "PARSED" || uploaded.file.parseStatus === "PARTIALLY_PARSED" ? "READY" : "FAILED");
          setWorkbenchNotice(uploaded.duplicateOfFileId ? `${asset.name} matches File v${uploaded.file.version}; no duplicate storage object or version was created. Its existing parser status is ${uploaded.file.parseStatus}.` : `${asset.name} was stored as File v${uploaded.file.version}. Parser status: ${uploaded.file.parseStatus}. ${uploaded.file.parserError?.recommendedAction ?? "Only parser-derived properties are available."}`);
          void memorySnapshot.refetch();
        } catch (error) { setUploadStage("FAILED"); setWorkbenchNotice(`CAD file upload failed before READY. No geometry was fabricated. ${error instanceof Error ? error.message : "Unknown upload error."}`); }
      }
    } catch (error) {
      setWorkbenchNotice(`File selection failed. No file was interpreted. ${error instanceof Error ? error.message : "Unknown picker error."}`);
    }
  };

  const toggleCadReference = (fileId: string) => setReferencedCadFileIds((items) => items.includes(fileId) ? items.filter((item) => item !== fileId) : [...items, fileId]);
  const toggleCompare = (fileId: string) => setCompareCadFileIds((items) => items.includes(fileId) ? items.filter((item) => item !== fileId) : items.length >= 2 ? [items[1], fileId] : [...items, fileId]);
  const compareCadFiles = () => {
    const chosen = visibleCadFiles.filter((file) => compareCadFileIds.includes(file.fileId));
    if (chosen.length !== 2) { setWorkbenchNotice("Select exactly two CAD file cards for comparison. This control compares parser-derived metadata only; it does not register geometry, calculate deviation, or certify interchangeability."); return; }
    setCadFileAnalysis(`PARSER METADATA COMPARISON\n${chosen.map((file) => `• ${file.fileName} v${file.version}: ${parserFactSummary(file)}`).join("\n")}\nUNKNOWN: This Phase 3.9 comparison does not perform geometric alignment, deviation analysis, assembly fit, material comparison, CAE, or validation.`);
  };
  const inspectCadFile = (file: CADFileContext) => { setSelectedCadFileId(file.fileId); setCadFileAnalysis(`INSPECTION\n${parserFactSummary(file)}\nPARSER · ${file.parser} (${file.parserVersion})\nSHA-256 · ${file.sha256}\nSTORAGE · ${file.storage.key}\nLIMITATIONS · ${file.limitations.join(" ")}`); };
  const analyzeSelectedCadFile = (file: CADFileContext) => {
    if (!persistentProject) return;
    analyzeCadFile.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, fileId: file.fileId, question: "Summarize parser-derived facts, unknowns, and evidence gaps." }, { onSuccess: (analysis) => setCadFileAnalysis(`FILE ANALYSIS\nFACTS\n${analysis.facts.map((item) => `• ${item}`).join("\n")}\nINFERENCES\n${analysis.inferences.map((item) => `• ${item}`).join("\n")}\nUNKNOWNS\n${analysis.unknowns.map((item) => `• ${item}`).join("\n")}\nREQUIRES CAE\n${analysis.requiresCAE.map((item) => `• ${item}`).join("\n")}\nREQUIRES PHYSICAL TESTING\n${analysis.requiresPhysicalTesting.map((item) => `• ${item}`).join("\n")}`), onError: (error) => setWorkbenchNotice(`CAD file analysis could not be completed: ${error.message}`) });
  };
  const removeSelectedCadFile = (file: CADFileContext) => {
    if (!persistentProject) return;
    Alert.alert("Remove CAD file reference?", `File v${file.version} will be marked REMOVED in this project. The source object is retained under the managed storage lifecycle.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeCadFile.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, fileId: file.fileId }, { onSuccess: async () => { setReferencedCadFileIds((items) => items.filter((item) => item !== file.fileId)); setCompareCadFileIds((items) => items.filter((item) => item !== file.fileId)); setSelectedCadFileId(undefined); setWorkbenchNotice(`${file.fileName} v${file.version} is now marked REMOVED. No prior revision was overwritten.`); await cadFiles.refetch(); }, onError: (error) => setWorkbenchNotice(`CAD file removal failed: ${error.message}`) }) }]);
  };

  const copyMessage = async (message: CADAgentMessage) => {
    try { await Clipboard.setStringAsync(message.text); setCopiedMessageId(message.id); } catch { setWorkbenchNotice("Clipboard copy was not available. The response remains visible in this workbench."); }
  };

  const evolve = (concept: WorkbenchConceptCard) => {
    const evolved: WorkbenchConceptCard = { ...concept, id: `${concept.id}-EVOLVED-${Date.now()}`, name: `${concept.name} · Evolved`, state: "EVOLVED", risks: [...concept.risks, "Evolution remains conceptual until requirements and evidence are reassessed."], engineeringConfidence: Math.min(concept.engineeringConfidence, 0.35) };
    setConcepts((items) => [...items, evolved]);
    setSelectedConceptId(evolved.id);
    setWorkbenchNotice("A separate evolved concept branch was created. The original concept remains preserved.");
    if (persistentProject && activeConversationId && lineageByConcept[concept.id]) persistentConceptDecision.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId: activeConversationId, conceptId: concept.id, conceptName: concept.name, action: "EVOLVE", reason: "User requested an evolved conceptual branch from the preserved parent concept.", parentLineageId: lineageByConcept[concept.id] }, { onSuccess: () => void memorySnapshot.refetch() });
  };

  const rejectConcept = (conceptId: string) => {
    const concept = concepts.find((item) => item.id === conceptId);
    setConcepts((items) => items.map((item) => item.id === conceptId ? { ...item, state: "REJECTED" } : item));
    if (concept && persistentProject && activeConversationId) persistentConceptDecision.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId: activeConversationId, conceptId, conceptName: concept.name, action: "REJECT", reason: "User rejected the conceptual candidate from the CAD Agent workbench." }, { onSuccess: () => void memorySnapshot.refetch() });
  };

  const restoreConversation = async (conversationId: string) => {
    if (!persistentProject) return;
    try {
      const restored = await utils.persistentMemory.restoreConversation.fetch({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId });
      const toChatMessage = (message: PersistentMessage): CADAgentMessage => ({ id: message.id, role: message.role, text: message.text, createdAt: message.createdAt, actionKind: message.actionKind as CADAgentMessage["actionKind"], truthStatus: message.truthStatus, context: { ...context, ...message.context, projectId: persistentProject.projectId, projectName: persistentProject.projectName, mode: message.mode, attachedFileIds: [] } });
      setMessages(restored.messages.map(toChatMessage));
      setActiveConversationId(conversationId);
      setConversationTitleDraft(restored.conversation.title);
      setWorkbenchNotice(`Restored ${restored.messages.length} persisted messages and ${restored.relevantMemory.length} related memory records. Only this project’s records were loaded.`);
    } catch (error) { setWorkbenchNotice(`Conversation could not be restored: ${error instanceof Error ? error.message : "Unknown error"}`); }
  };

  const newConversation = () => {
    if (!persistentProject) return;
    createPersistentConversation.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, title: "New CAD Agent conversation", reason: "User opened a new conversation branch" }, { onSuccess: (conversation) => { setActiveConversationId(conversation.id); setConversationTitleDraft(conversation.title); setMessages([]); setProposals([]); setConcepts([]); setEvidence([]); setHistory([]); setReferencedCadFileIds([]); setSelectedCadFileId(undefined); setCadFileAnalysis(undefined); void conversations.refetch(); void memorySnapshot.refetch(); }, onError: (error) => setWorkbenchNotice(`Conversation could not be created: ${error.message}`) });
  };

  const changeConversation = (action: "RENAME" | "ARCHIVE" | "RESTORE" | "DELETE", conversationId = activeConversationId) => {
    if (!persistentProject || !conversationId) return;
    updatePersistentConversation.mutate({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, conversationId, action, title: action === "RENAME" ? conversationTitleDraft : undefined, reason: action === "RENAME" ? "User updated the visible conversation title" : `User selected ${action.toLowerCase()} in conversation history` }, { onSuccess: async (conversation) => { await conversations.refetch(); await memorySnapshot.refetch(); if (action === "DELETE" || action === "ARCHIVE") { if (conversation.id === activeConversationId) { setActiveConversationId(undefined); setMessages([]); } } else { setConversationTitleDraft(conversation.title); } }, onError: (error) => setWorkbenchNotice(`Conversation lifecycle action failed: ${error.message}`) });
  };

  const searchMemory = async () => {
    if (!persistentProject || !memorySearch.trim()) return;
    try { const result = await utils.persistentMemory.retrieve.fetch({ projectId: persistentProject.projectId, accessKey: persistentProject.accessKey, query: memorySearch.trim() }); setMemoryResponse(result.response); } catch (error) { setMemoryResponse(`Memory retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`); }
  };

  return <View style={[styles.shell, isWide && styles.shellWide]}>
    <View style={styles.contextBar} accessibilityLabel="CAD Agent active engineering context">
      <Text style={styles.contextLabel}>CAD AGENT CONTEXT</Text>
      <View style={styles.contextGrid}>
        <Text style={styles.contextItem}>PROJECT · {projectName}</Text><Text style={styles.contextItem}>MODEL · {modelName ?? "NONE"}</Text><Text style={styles.contextItem}>SELECTED · {selectedGeometry.kind}: {selectedGeometry.label}</Text><Text style={styles.contextItem}>MODE · {mode.replace("_", " ")}</Text><Text style={styles.contextItem}>REQUIREMENTS · {requirementSummary}</Text><Text style={styles.contextItem}>VALIDATION · {validationStage.replaceAll("_", " ")}</Text><Text style={styles.contextItem}>CAD FILES · {visibleCadFiles.length} / REFERENCED · {referencedCadFileIds.length}</Text>
      </View>
    </View>

    <View style={[styles.columns, isWide && styles.columnsWide]}>
      <View style={[styles.chatColumn, isWide && styles.chatColumnWide]}>
        <View style={styles.chatHeader}><View><Text style={styles.title}>CAD AGENT</Text><Text style={styles.subTitle}>Engineering copilot attached to the active CAD context — not a generic chat.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open CAD Agent command palette" style={styles.commandButton} onPress={() => setPaletteOpen((value) => !value)}><Text style={styles.commandButtonText}>⌘ / CTRL K</Text></Pressable></View>
        <View style={styles.modeRow}>{ENGINEERING_MODES.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Set CAD Agent mode to ${item.replace("_", " ")}`} style={[styles.mode, mode === item && styles.modeActive]} onPress={() => setMode(item)}><Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item.replace("_", " ")}</Text></Pressable>)}</View>
        {paletteOpen ? <View style={styles.palette}><Text style={styles.paletteTitle}>COMMAND PALETTE</Text>{WORKBENCH_COMMANDS.map((command) => <Pressable key={command.id} accessibilityRole="button" accessibilityLabel={`${command.label}: ${command.description}`} style={styles.commandItem} onPress={() => { setDraft(command.label === "Ask CAD Agent" ? "" : `${command.label}: `); setPaletteOpen(false); }}><View><Text style={styles.commandName}>{command.label}</Text><Text style={styles.commandDescription}>{command.description}</Text></View><Text style={styles.shortcut}>{command.shortcut}</Text></Pressable>)}</View> : null}
        <View style={styles.messageList}>{messages.length ? messages.map((message) => <View key={message.id} style={[styles.message, message.role === "USER" ? styles.userMessage : styles.agentMessage]}><View style={styles.messageTop}><Text style={styles.messageRole}>{message.role === "USER" ? "YOU" : "CAD AGENT"}</Text><Truth label={message.truthStatus} /></View><Text style={styles.messageText}>{message.text}</Text>{message.role === "CAD_AGENT" ? <Pressable accessibilityRole="button" accessibilityLabel="Copy CAD Agent response" style={styles.copyButton} onPress={() => copyMessage(message)}><Text style={styles.copyText}>{copiedMessageId === message.id ? "COPIED" : "COPY"}</Text></Pressable> : null}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>CONTEXTUAL ENGINEERING CONVERSATION</Text><Text style={styles.emptyText}>Try “Make this stronger,” “Generate five alternative architectures,” “Challenge this design,” or “Prepare this concept for CAD generation.” Selected geometry and validation state travel with every message.</Text></View>}</View>
        <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => send()} returnKeyType="send" multiline style={styles.input} placeholder="Ask CAD Agent about the active model, feature, selection, requirements, concepts, or referenced CAD files…" placeholderTextColor="#71828B" accessibilityLabel="CAD Agent message" /><View style={styles.composerActions}><Pressable accessibilityRole="button" accessibilityLabel="Upload STEP or STL engineering file" style={styles.attachmentButton} onPress={pickFiles}><Text style={styles.attachmentText}>{uploadCadFile.isPending ? "PROCESSING…" : "UPLOAD CAD"}</Text></Pressable><Pressable disabled={sendMessage.isPending} accessibilityRole="button" accessibilityLabel="Send message to CAD Agent" style={[styles.sendButton, sendMessage.isPending && styles.disabled]} onPress={() => send()}>{sendMessage.isPending ? <ActivityIndicator color="#F3F1EA" /> : <Text style={styles.sendText}>SEND</Text>}</Pressable></View></View>
        <Text style={styles.chatNote}>Responses are deterministic and inspectable. There is no hidden chain-of-thought, streaming LLM, background solver, or fabricated evidence in this phase.</Text>
      </View>

      <View style={[styles.inspectorColumn, isWide && styles.inspectorColumnWide]}>
        <View style={styles.inspector}><BlockTitle>PROPOSED CHANGES</BlockTitle>{proposals.length ? proposals.slice().reverse().map((proposal) => <View key={proposal.id} style={styles.proposal}><View style={styles.proposalTop}><Text style={styles.proposalTitle}>{proposal.title}</Text><Truth label={proposal.status} /></View><Text style={styles.detailLabel}>BEFORE</Text><Text style={styles.detail}>{proposal.before}</Text><Text style={styles.detailLabel}>AFTER</Text><Text style={styles.detail}>{proposal.after}</Text><Text style={styles.detailLabel}>AFFECTED</Text><Text style={styles.detail}>{proposal.affectedGeometry.length ? proposal.affectedGeometry.map((item) => `${item.kind}: ${item.label}`).join(" · ") : "Active model scope; no geometry is selected."}</Text><Text style={styles.detailLabel}>EXPECTED EFFECT</Text><Text style={styles.detail}>{proposal.expectedEffect}</Text><Text style={styles.detailLabel}>RISKS</Text><Text style={styles.detail}>{proposal.risks.join(" ")}</Text><Text style={styles.detailLabel}>VALIDATION</Text><View style={styles.proposalStatus}><Truth label={proposal.validationStage} /><Truth label={proposal.truthStatus} /></View><View style={styles.proposalActions}><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "PREVIEWED")}><Text style={styles.secondaryText}>PREVIEW</Text></Pressable><Pressable accessibilityRole="button" style={styles.primaryAction} onPress={() => actOnProposal(proposal, "APPLIED")}><Text style={styles.primaryActionText}>APPLY</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "REJECTED")}><Text style={styles.secondaryText}>REJECT</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => actOnProposal(proposal, "EDIT_REQUESTED")}><Text style={styles.secondaryText}>EDIT</Text></Pressable></View><Text style={styles.reversible}>REVERSIBLE · {proposal.reversible ? "YES" : "NO"}</Text></View>) : <Text style={styles.muted}>No proposed operation. CAD Agent cannot silently modify geometry.</Text>}</View>

        <View style={styles.inspector}><BlockTitle>CONCEPT EXPLORER</BlockTitle>{concepts.length ? concepts.map((concept) => <View key={concept.id} style={[styles.concept, selectedConcept?.id === concept.id && styles.conceptSelected]}><View style={styles.proposalTop}><Text style={styles.proposalTitle}>{concept.name}</Text><Truth label={concept.truthStatus} /></View><Text style={styles.detail}>{concept.architecture} · {concept.primaryMechanism}</Text><Text style={styles.detailLabel}>ADVANTAGES</Text><Text style={styles.detail}>{concept.advantages.join(" ")}</Text><Text style={styles.detailLabel}>RISKS & UNKNOWNS</Text><Text style={styles.detail}>{[...concept.risks, ...concept.unknowns].join(" ")}</Text><Text style={styles.detailLabel}>MANUFACTURING</Text><Text style={styles.detail}>{concept.manufacturingConsiderations.join(" ")}</Text><Text style={styles.conceptMeta}>CONFIDENCE {Math.round(concept.engineeringConfidence * 100)}% · {concept.validationStage.replaceAll("_", " ")} · {concept.state}</Text><View style={styles.proposalActions}><Pressable style={styles.secondary} onPress={() => setSelectedConceptId(concept.id)}><Text style={styles.secondaryText}>PREVIEW</Text></Pressable><Pressable style={styles.secondary} onPress={() => setWorkbenchNotice(`Compare ${concept.name}: select another concept card to inspect a different architecture. No performance winner is asserted without shared evidence.`)}><Text style={styles.secondaryText}>COMPARE</Text></Pressable><Pressable style={styles.secondary} onPress={() => setWorkbenchNotice(`Generate CAD for ${concept.name} is blocked until its geometry, interfaces, requirements, and supported feature operations are defined.`)}><Text style={styles.secondaryText}>GENERATE CAD</Text></Pressable><Pressable style={styles.secondary} onPress={() => evolve(concept)}><Text style={styles.secondaryText}>EVOLVE</Text></Pressable><Pressable style={styles.secondary} onPress={() => rejectConcept(concept.id)}><Text style={styles.secondaryText}>REJECT</Text></Pressable></View></View>) : <Text style={styles.muted}>Ask the CAD Agent to generate alternatives. Concept cards will remain conceptual and evidence-labeled.</Text>}</View>
      </View>
    </View>

    <View style={[styles.lowerGrid, isWide && styles.lowerGridWide]}>
      <View style={styles.inspector}><BlockTitle>PERSISTENT ENGINEERING MEMORY</BlockTitle><Text style={styles.detail}>{persistentProject ? `AUTHORIZED PROJECT · ${persistentProject.projectName}` : "Initializing project capability. No message is persisted until authorization is ready."}</Text><View style={styles.proposalActions}><Pressable style={styles.primaryAction} onPress={newConversation}><Text style={styles.primaryActionText}>NEW CONVERSATION</Text></Pressable><Pressable style={styles.secondary} onPress={() => setShowArchivedConversations((value) => !value)}><Text style={styles.secondaryText}>{showArchivedConversations ? "HIDE ARCHIVED" : "SHOW ARCHIVED"}</Text></Pressable></View><TextInput value={conversationTitleDraft} onChangeText={setConversationTitleDraft} style={memoryStyles.input} placeholder="Conversation title" placeholderTextColor="#71828B" accessibilityLabel="Persistent conversation title" /><View style={styles.proposalActions}><Pressable style={styles.secondary} onPress={() => changeConversation("RENAME")}><Text style={styles.secondaryText}>RENAME</Text></Pressable><Pressable style={styles.secondary} onPress={() => changeConversation("ARCHIVE")}><Text style={styles.secondaryText}>ARCHIVE</Text></Pressable><Pressable style={styles.secondary} onPress={() => changeConversation("DELETE")}><Text style={styles.secondaryText}>DELETE</Text></Pressable></View>{conversations.data?.length ? conversations.data.map((conversation) => <View key={conversation.id} style={memoryStyles.record}><Text style={styles.historyTitle}>{conversation.title}</Text><Text style={styles.historyMeta}>{conversation.status} · {conversation.updatedAt.slice(0, 19).replace("T", " ")}</Text><View style={styles.proposalActions}><Pressable style={styles.secondary} onPress={() => restoreConversation(conversation.id)}><Text style={styles.secondaryText}>OPEN</Text></Pressable>{conversation.status === "ARCHIVED" ? <Pressable style={styles.secondary} onPress={() => changeConversation("RESTORE", conversation.id)}><Text style={styles.secondaryText}>RESTORE</Text></Pressable> : null}</View></View>) : <Text style={styles.muted}>No active persistent conversations. New CAD Agent messages are appended only after project authorization is ready.</Text>}</View>
      <View style={styles.inspector}><BlockTitle>MEMORY RETRIEVAL & SOURCE EVIDENCE</BlockTitle><TextInput value={memorySearch} onChangeText={setMemorySearch} onSubmitEditing={() => void searchMemory()} style={memoryStyles.input} placeholder="Why did we reject Concept B?" placeholderTextColor="#71828B" accessibilityLabel="Search current project engineering memory" /><Pressable style={styles.secondary} onPress={() => void searchMemory()}><Text style={styles.secondaryText}>SEARCH CURRENT PROJECT</Text></Pressable>{memoryResponse ? <View style={memoryStyles.response}><Text style={styles.detail}>{memoryResponse}</Text></View> : <Text style={styles.muted}>Selective retrieval searches only this authorized project. If no matching historical source exists, it returns: NO RECORDED EVIDENCE.</Text>}{memorySnapshot.data?.records.slice(0, 5).map((record) => <View key={record.id} style={memoryStyles.record}><View style={styles.proposalTop}><Text style={styles.historyTitle}>{record.kind} · {record.title}</Text><Truth label={record.truthStatus} /></View><Text style={styles.detail}>{record.content}</Text><Text style={styles.historyMeta}>SOURCE RECORD · {record.id}</Text></View>)}</View>
      <View style={styles.inspector}><BlockTitle>DECISIONS · REJECTED CONCEPTS · LINEAGE</BlockTitle>{memorySnapshot.data?.records.filter((record) => record.kind === "DECISION" || record.kind === "CONCEPT_REJECTED").slice(0, 6).map((record) => <View key={record.id} style={memoryStyles.record}><Text style={styles.historyTitle}>{record.kind} · {record.title}</Text><Text style={styles.detail}>{record.content}</Text><Text style={styles.historyMeta}>SOURCE RECORD · {record.id}</Text></View>)}{memorySnapshot.data?.lineage.slice(0, 8).map((node) => <View key={node.id} style={memoryStyles.lineage}><Text style={styles.historyKind}>{node.kind}</Text><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{node.title}</Text><Text style={styles.detail}>{node.changeSummary}</Text><Text style={styles.historyMeta}>ID {node.id} · PARENT {node.parentId ?? "ROOT"} · {node.status}</Text></View></View>)}{!memorySnapshot.data?.lineage.length ? <Text style={styles.muted}>Concept and revision lineage will appear when concepts are generated, rejected, or evolved. Parent nodes are never overwritten.</Text> : null}</View>
      <View style={styles.inspector}><BlockTitle>ENGINEERING EVIDENCE</BlockTitle>{evidence.length ? evidence.map((item) => <View key={item.id} style={styles.evidence}><View style={styles.proposalTop}><Text style={styles.evidenceTitle}>{item.category} · {item.label}</Text><Truth label={item.truthStatus} /></View><Text style={styles.detail}>{item.detail}</Text>{!item.available ? <Text style={styles.notVerified}>NOT VERIFIED</Text> : null}</View>) : <Text style={styles.muted}>Send a CAD Agent message to assemble an evidence panel. Missing evidence will be labeled NOT VERIFIED.</Text>}</View>
      <View style={styles.inspector}><BlockTitle>DESIGN HISTORY</BlockTitle>{history.length ? history.slice().reverse().map((event) => <View key={event.id} style={styles.history}><Text style={styles.historyKind}>{event.kind}</Text><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{event.title}</Text><Text style={styles.detail}>{event.detail}</Text><Text style={styles.historyMeta}>{event.timestamp.slice(11, 19)} · {event.validationStage.replaceAll("_", " ")} · {event.reversible ? "REVERSIBLE" : "INSPECT ONLY"}</Text></View><Truth label={event.truthStatus} /></View>) : <Text style={styles.muted}>History records requirements, concepts, CAD actions, modifications, validation, revisions, proposals, conversations, and file references as they occur.</Text>}</View>
      <View style={styles.inspector}><BlockTitle>CAD FILE CENTER</BlockTitle><View style={styles.fileTimeline}><Text style={[styles.timelineStep, uploadStage !== "IDLE" && styles.timelineComplete]}>UPLOAD</Text><Text style={styles.timelineArrow}>→</Text><Text style={[styles.timelineStep, ["PROCESSING", "PARSING", "READY"].includes(uploadStage) && styles.timelineComplete]}>PROCESSING</Text><Text style={styles.timelineArrow}>→</Text><Text style={[styles.timelineStep, ["PARSING", "READY"].includes(uploadStage) && styles.timelineComplete]}>PARSING</Text><Text style={styles.timelineArrow}>→</Text><Text style={[styles.timelineStep, uploadStage === "READY" && styles.timelineReady]}>READY</Text></View><Text style={styles.detail}>Supported source bytes: STEP/STP and STL, up to 10 MiB. Other extensions are retained as UNSUPPORTED only; parser results never create CAD geometry, CAE evidence, or engineering certification.</Text>{visibleCadFiles.length ? visibleCadFiles.map((file) => <View key={file.fileId} style={[styles.file, selectedCadFile?.fileId === file.fileId && styles.fileSelected]}><View style={styles.proposalTop}><Text style={styles.fileName}>{file.fileName} · FILE v{file.version}</Text><Truth label={file.parseStatus} /></View><Text style={styles.detail}>{file.format} · {bytesLabel(file.fileSizeBytes)} · {file.parser}</Text><Text style={styles.detail}>{geometrySummary(file)}</Text><Text style={styles.detail}>UNITS · {file.units.value ?? "UNKNOWN"} <Text style={styles.provenance}>[{file.units.provenance}]</Text></Text>{file.boundingBox ? <Text style={styles.detail}>EXTENT · {file.boundingBox.size.map((value) => value.toFixed(3)).join(" × ")} <Text style={styles.provenance}>[{file.boundingBox.provenance}]</Text></Text> : null}<Text style={styles.fileMeta}>SHA-256 {file.sha256.slice(0, 16)}… · {file.createdAt.slice(0, 19).replace("T", " ")}</Text>{file.parserError ? <View style={styles.parseFailure}><Text style={styles.failureTitle}>PARSING {file.parseStatus.replaceAll("_", " ")}</Text><Text style={styles.detail}>{file.parserError.reason}</Text><Text style={styles.detail}>SUPPORTED · {file.parserError.supportedOperation}</Text><Text style={styles.detail}>NEXT · {file.parserError.recommendedAction}</Text></View> : null}<View style={styles.proposalActions}><Pressable style={styles.secondary} onPress={() => inspectCadFile(file)}><Text style={styles.secondaryText}>INSPECT</Text></Pressable><Pressable style={styles.secondary} onPress={() => analyzeSelectedCadFile(file)}><Text style={styles.secondaryText}>{analyzeCadFile.isPending && selectedCadFileId === file.fileId ? "ANALYZING…" : "ANALYZE"}</Text></Pressable><Pressable style={[styles.secondary, referencedCadFileIds.includes(file.fileId) && styles.referenceActive]} onPress={() => toggleCadReference(file.fileId)}><Text style={styles.secondaryText}>{referencedCadFileIds.includes(file.fileId) ? "REFERENCED" : "REFERENCE"}</Text></Pressable><Pressable style={[styles.secondary, compareCadFileIds.includes(file.fileId) && styles.compareActive]} onPress={() => toggleCompare(file.fileId)}><Text style={styles.secondaryText}>{compareCadFileIds.includes(file.fileId) ? "COMPARE ON" : "COMPARE"}</Text></Pressable><Pressable style={styles.removeAction} onPress={() => removeSelectedCadFile(file)}><Text style={styles.removeActionText}>REMOVE</Text></Pressable></View></View>) : <Text style={styles.muted}>No uploaded CAD source files. Select UPLOAD CAD to transfer STEP/STP or STL bytes into managed storage, parse only supported formats, and receive an honest status.</Text>}<View style={styles.proposalActions}><Pressable style={styles.primaryAction} onPress={compareCadFiles}><Text style={styles.primaryActionText}>COMPARE SELECTED ({compareCadFileIds.length}/2)</Text></Pressable></View>{cadFileAnalysis ? <View style={styles.fileAnalysis}><Text style={styles.detail}>{cadFileAnalysis}</Text></View> : null}</View>
    </View>
    {workbenchNotice ? <View style={styles.notice}><Text style={styles.noticeTitle}>WORKBENCH NOTICE</Text><Text style={styles.noticeText}>{workbenchNotice}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  shell: { gap: 12 }, shellWide: { maxWidth: 1400, alignSelf: "center", width: "100%" }, contextBar: { backgroundColor: "#13242D", borderWidth: 1, borderColor: "#365667", borderRadius: 12, padding: 10, gap: 7 }, contextLabel: { color: "#88B9D2", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, contextGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, contextItem: { color: "#D0E0E5", fontSize: 8, borderWidth: 1, borderColor: "#395363", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4 }, columns: { gap: 12 }, columnsWide: { flexDirection: "row", alignItems: "flex-start" }, chatColumn: { gap: 10 }, chatColumnWide: { flex: 1.25 }, inspectorColumn: { gap: 10 }, inspectorColumnWide: { flex: 1 }, chatHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }, title: { color: "#F3F1EA", fontSize: 13, fontWeight: "900", letterSpacing: 0.6 }, subTitle: { color: "#91A4AD", fontSize: 9, lineHeight: 14, marginTop: 3, maxWidth: 300 }, commandButton: { borderWidth: 1, borderColor: "#5E91AB", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 }, commandButtonText: { color: "#9DD0EC", fontSize: 8, fontWeight: "900" }, modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, mode: { borderWidth: 1, borderColor: "#425D6C", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 6 }, modeActive: { backgroundColor: "#145E95", borderColor: "#6CB6E3" }, modeText: { color: "#A7C4D2", fontSize: 8, fontWeight: "900" }, modeTextActive: { color: "#F5F9FA" }, palette: { backgroundColor: "#1B2930", borderWidth: 1, borderColor: "#4E7182", borderRadius: 9, padding: 8, gap: 3 }, paletteTitle: { color: "#A6D5ED", fontSize: 9, fontWeight: "900", marginBottom: 3 }, commandItem: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#334B58" }, commandName: { color: "#E2EAED", fontSize: 10, fontWeight: "800" }, commandDescription: { color: "#91A6B0", fontSize: 8, lineHeight: 12, maxWidth: 300 }, shortcut: { color: "#78B7DB", fontSize: 9, fontWeight: "900" }, messageList: { gap: 8, minHeight: 120 }, message: { borderRadius: 10, padding: 10, gap: 5, borderWidth: 1 }, userMessage: { backgroundColor: "#1B3140", borderColor: "#365F78" }, agentMessage: { backgroundColor: "#1A252B", borderColor: "#3B515C" }, messageTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, messageRole: { color: "#9DCDE8", fontSize: 8, fontWeight: "900" }, messageText: { color: "#DCE5E8", fontSize: 10, lineHeight: 15 }, copyButton: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: "#486274", borderRadius: 5 }, copyText: { color: "#A4D2EA", fontSize: 8, fontWeight: "900" }, empty: { backgroundColor: "#172127", borderWidth: 1, borderStyle: "dashed", borderColor: "#48606C", borderRadius: 10, padding: 12, gap: 4 }, emptyTitle: { color: "#9DCCE4", fontSize: 9, fontWeight: "900" }, emptyText: { color: "#A5B4BA", fontSize: 10, lineHeight: 15 }, composer: { backgroundColor: "#17242B", borderWidth: 1, borderColor: "#3B5665", borderRadius: 10, padding: 8, gap: 7 }, input: { minHeight: 62, color: "#F3F1EA", fontSize: 11, lineHeight: 16, textAlignVertical: "top" }, composerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7 }, attachmentButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: "#7194A8" }, attachmentText: { color: "#B2D9EC", fontSize: 8, fontWeight: "900" }, sendButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 7, backgroundColor: "#1167B1", minWidth: 64, alignItems: "center" }, sendText: { color: "#F5F9FA", fontSize: 8, fontWeight: "900" }, chatNote: { color: "#7E939D", fontSize: 8, lineHeight: 12 }, inspector: { backgroundColor: "#172228", borderWidth: 1, borderColor: "#36505E", borderRadius: 11, padding: 10, gap: 8 }, blockTitle: { color: "#86B9D5", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, muted: { color: "#91A3AA", fontSize: 9, lineHeight: 14 }, proposal: { backgroundColor: "#202B31", borderWidth: 1, borderColor: "#4D6673", borderRadius: 8, padding: 8, gap: 4 }, proposalTop: { flexDirection: "row", justifyContent: "space-between", gap: 7, alignItems: "flex-start" }, proposalTitle: { color: "#E4ECEE", fontSize: 10, fontWeight: "900", flex: 1 }, detailLabel: { color: "#87B8CF", fontSize: 7, fontWeight: "900", marginTop: 2 }, detail: { color: "#BDCDD3", fontSize: 8, lineHeight: 12 }, proposalStatus: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, proposalActions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 3 }, secondary: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#608EA7" }, secondaryText: { color: "#A5D5ED", fontSize: 8, fontWeight: "900" }, primaryAction: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6, backgroundColor: "#1F8A70" }, primaryActionText: { color: "#F3F1EA", fontSize: 8, fontWeight: "900" }, reversible: { color: "#9ECDB8", fontSize: 7, fontWeight: "900" }, concept: { backgroundColor: "#1C2632", borderWidth: 1, borderColor: "#495371", borderRadius: 8, padding: 8, gap: 4 }, conceptSelected: { borderColor: "#A78BF0", backgroundColor: "#272440" }, conceptMeta: { color: "#C2B2F3", fontSize: 8, fontWeight: "900" }, lowerGrid: { gap: 12 }, lowerGridWide: { flexDirection: "row", alignItems: "flex-start" }, evidence: { borderTopWidth: 1, borderTopColor: "#334A55", paddingTop: 7, gap: 3 }, evidenceTitle: { color: "#C7D8DE", fontSize: 8, fontWeight: "900", flex: 1 }, notVerified: { color: "#F0A776", fontSize: 8, fontWeight: "900" }, history: { flexDirection: "row", gap: 7, borderTopWidth: 1, borderTopColor: "#334A55", paddingTop: 7 }, historyKind: { color: "#83B8D7", fontSize: 7, fontWeight: "900", width: 62 }, historyTitle: { color: "#DCE6E9", fontSize: 9, fontWeight: "900" }, historyMeta: { color: "#8CA0A9", fontSize: 7, marginTop: 3 }, file: { backgroundColor: "#1C2830", borderWidth: 1, borderColor: "#3D5968", borderRadius: 7, padding: 8, gap: 3 }, fileName: { color: "#D5E5EA", fontSize: 9, fontWeight: "900", flex: 1 }, notice: { backgroundColor: "#3A2A1C", borderLeftWidth: 3, borderLeftColor: "#DE6B35", borderRadius: 7, padding: 9, gap: 3 }, noticeTitle: { color: "#F1C2A1", fontSize: 8, fontWeight: "900" }, noticeText: { color: "#E5D0C3", fontSize: 9, lineHeight: 14 }, truth: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, alignSelf: "flex-start" }, truthText: { fontSize: 7, fontWeight: "900" }, disabled: { opacity: 0.5 }, fileTimeline: { flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center", backgroundColor: "#13242D", borderRadius: 6, padding: 7 }, timelineStep: { color: "#71828B", fontSize: 7, fontWeight: "900" }, timelineArrow: { color: "#5E91AB", fontSize: 9 }, timelineComplete: { color: "#B8DDEF" }, timelineReady: { color: "#8FD1B8" }, fileSelected: { borderColor: "#A78BF0", backgroundColor: "#23263A" }, provenance: { color: "#B8A8F2", fontWeight: "900" }, fileMeta: { color: "#8EA4AD", fontSize: 7 }, parseFailure: { backgroundColor: "#35251F", borderLeftWidth: 2, borderLeftColor: "#E25555", borderRadius: 5, padding: 6, gap: 2 }, failureTitle: { color: "#FFB2A8", fontSize: 7, fontWeight: "900" }, referenceActive: { backgroundColor: "#173D45", borderColor: "#67B39F" }, compareActive: { backgroundColor: "#31294C", borderColor: "#B09AFF" }, removeAction: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#B76565" }, removeActionText: { color: "#FFB2A8", fontSize: 8, fontWeight: "900" }, fileAnalysis: { backgroundColor: "#142A31", borderLeftWidth: 2, borderLeftColor: "#6CB6E3", borderRadius: 6, padding: 8 },
});

const memoryStyles = StyleSheet.create({
  input: { minHeight: 34, color: "#F3F1EA", fontSize: 9, lineHeight: 13, borderWidth: 1, borderColor: "#425D6C", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  record: { backgroundColor: "#1C2830", borderWidth: 1, borderColor: "#3D5968", borderRadius: 7, padding: 8, gap: 4 },
  response: { backgroundColor: "#203039", borderLeftWidth: 2, borderLeftColor: "#6CB6E3", borderRadius: 6, padding: 8 },
  lineage: { flexDirection: "row", gap: 7, borderTopWidth: 1, borderTopColor: "#334A55", paddingTop: 7 },
});
