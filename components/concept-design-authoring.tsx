import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createConceptDesign, createConceptDesignSuccessor, generateConceptCad, getCadViewerScene, getConceptDesign, listEngineeringDesignTemplates, setConceptDesignParameter, type CadViewerSceneSnapshot, type ConceptCadSnapshot, type ConceptDesignSnapshot, type EngineeringConnection, type EngineeringDesignTemplate, type SeatDesignSnapshot } from "@/lib/engineering-api";
import { ArtifactCadViewer } from "@/components/artifact-cad-viewer";
import { ArtifactAssemblyAuthoring } from "@/components/artifact-assembly-authoring";

export function ConceptDesignAuthoring({ connection, onCreated }: { connection: EngineeringConnection; onCreated: () => Promise<void> | void }) {
  const [templates, setTemplates] = useState<EngineeringDesignTemplate[]>([]);
  const [templateId, setTemplateId] = useState("CONCEPT_BACKREST_LOAD_PATH");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<{ seat: SeatDesignSnapshot; revisionId: string } | null>(null);
  const [model, setModel] = useState<ConceptDesignSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [artifact, setArtifact] = useState<ConceptCadSnapshot | null>(null);
  const [viewer, setViewer] = useState<CadViewerSceneSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { listEngineeringDesignTemplates(connection).then(setTemplates).catch((error) => setMessage(error instanceof Error ? error.message : "DESIGN_TEMPLATES_UNAVAILABLE")); }, [connection]);
  const selected = templates.find((template) => template.id === templateId);
  async function load(seatDesignId: string, revisionId: string) {
    const next = await getConceptDesign(connection, seatDesignId, revisionId);
    setModel(next); setDrafts(Object.fromEntries(next.parameters.map((parameter) => [parameter.name, parameter.value ?? ""]))); setArtifact(null);
    const persistedFileId = next.artifacts.find((item) => item.cadFileId)?.cadFileId;
    if (persistedFileId) getCadViewerScene(connection, persistedFileId).then(setViewer).catch(() => setViewer(null)); else setViewer(null);
    return next;
  }
  async function create() {
    if (!name.trim() || !description.trim()) return setMessage("DESIGN_NAME_AND_DESCRIPTION_REQUIRED");
    try { setBusy(true); const next = await createConceptDesign(connection, { templateId, name: name.trim(), description: description.trim() }); setDesign({ seat: next.seat, revisionId: next.revisionId }); await load(next.seat.id, next.revisionId); await onCreated(); setMessage("DESIGN_TEMPLATE_PERSISTED"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "DESIGN_TEMPLATE_CREATE_FAILED"); } finally { setBusy(false); }
  }
  async function save(parameterName: string, unit: string) {
    if (!design) return; const value = drafts[parameterName]?.trim();
    if (!value) return setMessage(`VALUE_REQUIRED: ${parameterName}`);
    try { setBusy(true); await setConceptDesignParameter(connection, design.seat.id, design.revisionId, parameterName, value, unit); await load(design.seat.id, design.revisionId); setMessage(`${parameterName}_PERSISTED`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "PARAMETER_PERSIST_FAILED"); } finally { setBusy(false); }
  }
  async function successor() {
    if (!design) return;
    try { setBusy(true); const next = await createConceptDesignSuccessor(connection, design.seat.id, design.revisionId); setDesign({ seat: next.successor, revisionId: next.revisionId }); await load(next.successor.id, next.revisionId); setMessage("SUCCESSOR_REVISION_CREATED; PRIOR_CAD_STALE"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "SUCCESSOR_REVISION_FAILED"); } finally { setBusy(false); }
  }
  async function generate() {
    if (!design) return;
    try { setBusy(true); const next = await generateConceptCad(connection, design.seat.id, design.revisionId); setArtifact(next); setViewer(await getCadViewerScene(connection, next.artifact.cadFileId)); await load(design.seat.id, design.revisionId); setMessage("REAL_OPENCASCADE_CONCEPT_CAD_GENERATED; FE_BLOCKED"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "CONCEPT_CAD_GENERATION_FAILED"); } finally { setBusy(false); }
  }

  return <View style={styles.card}>
    <Text style={styles.eyebrow}>USER DESIGN AUTHORING</Text><Text style={styles.title}>Engineering concept → editable design</Text><Text style={styles.description}>All inputs are user-defined. A CAD artifact appears only when this concept has the required geometry parameters; FE remains blocked until the separate engineering package is approved.</Text>
    {message ? <Text style={styles.notice}>{message}</Text> : null}
    {!design ? <><View style={styles.templateWrap}>{templates.map((template) => <Pressable key={template.id} onPress={() => setTemplateId(template.id)} style={[styles.template, template.id === templateId && styles.templateSelected]}><Text style={styles.templateTitle}>{template.name}</Text><Text style={styles.templateText}>{template.cadReadiness.replaceAll("_", " ")}</Text></Pressable>)}</View><Text style={styles.source}>{selected ? `Source rationale: ${selected.source}` : "Loading templates…"}</Text><TextInput value={name} onChangeText={setName} placeholder="Design name" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Design intent / revision description" placeholderTextColor="#6A8AA2" style={styles.input} /><Pressable onPress={create} disabled={busy || !selected} style={styles.primary}><Text style={styles.primaryText}>Create editable design</Text>{busy ? <ActivityIndicator color="#081827" /> : null}</Pressable></> : <><Text style={styles.designName}>{design.seat.name} · Revision {design.revisionId.slice(-8)}</Text><Text style={styles.state}>{model?.cadReadiness ?? "LOADING"} · {model?.feStatus ?? "FE_BLOCKED"}</Text>{model?.parameters.map((parameter) => <View key={parameter.name} style={styles.parameter}><View style={styles.parameterHeader}><Text style={styles.parameterName}>{parameter.name.replaceAll("_", " ")}</Text><Text style={parameter.state === "USER_DEFINED" ? styles.defined : styles.required}>{parameter.state}</Text></View><Text style={styles.parameterMeta}>{parameter.category} · {parameter.unit}{parameter.cadRequired ? " · CAD REQUIRED" : ""}</Text><View style={styles.parameterRow}><TextInput value={drafts[parameter.name] ?? ""} onChangeText={(value) => setDrafts((current) => ({ ...current, [parameter.name]: value }))} placeholder={parameter.state === "REQUIRED_INPUT" ? "Enter user value" : "User value"} placeholderTextColor="#6A8AA2" keyboardType={parameter.unit === "mm" ? "decimal-pad" : "default"} style={styles.parameterInput} /><Pressable onPress={() => save(parameter.name, parameter.unit)} disabled={busy} style={styles.small}><Text style={styles.smallText}>Save</Text></Pressable></View></View>)}<View style={styles.actions}><Pressable onPress={successor} disabled={busy} style={styles.outline}><Text style={styles.outlineText}>New revision for geometry change</Text></Pressable>{model?.cadReadiness === "CAD_READY" ? <Pressable onPress={generate} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>Generate real CAD</Text>{busy ? <ActivityIndicator color="#081827" /> : null}</Pressable> : <Text style={styles.blocked}>CAD remains blocked until required dimensions are saved.</Text>}</View>{artifact ? <View style={styles.artifact}><Text style={styles.artifactTitle}>REAL CAD ARTIFACT</Text><Text style={styles.artifactText}>OpenCascade · {artifact.artifact.stepByteLength} bytes · SHA-256 {artifact.artifact.artifactHash.slice(0, 16)}…</Text><Text style={styles.artifactText}>Partial CAD only. Undefined: {artifact.artifact.undefinedFeatures.join(", ")}. FE: BLOCKED.</Text></View> : null}</>}
    {viewer ? <ArtifactCadViewer scene={viewer} /> : null}{design ? <ArtifactAssemblyAuthoring connection={connection} prefill={viewer ? { cadFileId: viewer.file.fileId, sourceHash: viewer.file.sha256, label: viewer.file.fileName, artifactRevision: viewer.file.version } : undefined} seatDesignId={design.seat.id} seatRevisionId={design.revisionId} /> : null}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#0D2638", borderColor: "#24516B", borderRadius: 16, borderWidth: 1, gap: 10, marginTop: 14, padding: 14 }, eyebrow: { color: "#2EC5E8", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, title: { color: "#E7F0F6", fontSize: 17, fontWeight: "800" }, description: { color: "#B7CCDA", fontSize: 12, lineHeight: 17 }, notice: { backgroundColor: "#153348", borderLeftColor: "#E5C173", borderLeftWidth: 3, color: "#E7F0F6", fontSize: 11, padding: 9 }, templateWrap: { gap: 7 }, template: { backgroundColor: "#102B3C", borderColor: "#25495D", borderRadius: 10, borderWidth: 1, padding: 9 }, templateSelected: { borderColor: "#2EC5E8", backgroundColor: "#13384D" }, templateTitle: { color: "#E7F0F6", fontSize: 13, fontWeight: "800" }, templateText: { color: "#9FC8D8", fontSize: 10, marginTop: 3 }, source: { color: "#7EA6B7", fontSize: 10 }, input: { backgroundColor: "#081827", borderColor: "#29536B", borderRadius: 9, borderWidth: 1, color: "#E7F0F6", minHeight: 42, paddingHorizontal: 11 }, primary: { alignItems: "center", backgroundColor: "#2EC5E8", borderRadius: 10, flexDirection: "row", justifyContent: "space-between", minHeight: 46, paddingHorizontal: 13 }, primaryText: { color: "#071923", fontSize: 13, fontWeight: "900" }, designName: { color: "#E7F0F6", fontSize: 14, fontWeight: "800" }, state: { color: "#E5C173", fontSize: 11, fontWeight: "800" }, parameter: { backgroundColor: "#102B3C", borderColor: "#25495D", borderRadius: 10, borderWidth: 1, gap: 5, padding: 9 }, parameterHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, parameterName: { color: "#E7F0F6", fontSize: 12, fontWeight: "800" }, parameterMeta: { color: "#8FAFBD", fontSize: 10 }, required: { color: "#E5C173", fontSize: 10, fontWeight: "800" }, defined: { color: "#78D8A8", fontSize: 10, fontWeight: "800" }, parameterRow: { flexDirection: "row", gap: 7 }, parameterInput: { backgroundColor: "#081827", borderColor: "#29536B", borderRadius: 8, borderWidth: 1, color: "#E7F0F6", flex: 1, minHeight: 39, paddingHorizontal: 9 }, small: { alignItems: "center", borderColor: "#2EC5E8", borderRadius: 8, borderWidth: 1, justifyContent: "center", paddingHorizontal: 10 }, smallText: { color: "#BDEFFC", fontSize: 11, fontWeight: "800" }, actions: { gap: 8, marginTop: 4 }, outline: { borderColor: "#B7CCDA", borderRadius: 9, borderWidth: 1, padding: 10 }, outlineText: { color: "#D5E2EB", fontSize: 11, fontWeight: "800", textAlign: "center" }, blocked: { color: "#E5C173", fontSize: 11, lineHeight: 16 }, artifact: { backgroundColor: "#123328", borderColor: "#2A7A5D", borderRadius: 10, borderWidth: 1, gap: 4, padding: 10 }, artifactTitle: { color: "#80E7B5", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, artifactText: { color: "#C5E7D4", fontSize: 10, lineHeight: 15 } });
