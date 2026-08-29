import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ConceptDesignAuthoring } from "@/components/concept-design-authoring";
import { SeatInputPackageEditor } from "@/components/seat-input-package-editor";
import { SekbRecordWorkspace } from "@/components/sekb-record-workspace";
import { createSeatDesign, createSeatRevision, getSeatEngineeringReport, getSeatEngineeringTraceability, listSeatDesigns, loadEngineeringConnection, releaseSeatRevision, type EngineeringConnection, type SeatDesignSnapshot, type SeatTraceabilitySnapshot, type SeatVerificationSnapshot } from "@/lib/engineering-api";

export default function SeatsScreen() {
  const [connection, setConnection] = useState<EngineeringConnection | null>(null);
  const [records, setRecords] = useState<SeatDesignSnapshot[]>([]);
  const [verificationByDesign, setVerificationByDesign] = useState<Record<string, SeatVerificationSnapshot | null>>({});
  const [traceabilityByDesign, setTraceabilityByDesign] = useState<Record<string, SeatTraceabilitySnapshot | null>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [requirementDescription, setRequirementDescription] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [componentName, setComponentName] = useState("");
  const refresh = useCallback(async (current?: EngineeringConnection | null) => {
    const active = current ?? connection;
    if (!active) return;
    try {
      const designs = await listSeatDesigns(active);
      setRecords(designs);
      const reports = await Promise.all(designs.map(async (design) => {
        try { return [design.id, (await getSeatEngineeringReport(active, design.id)).seatVerification] as const; } catch { return [design.id, null] as const; }
      }));
      setVerificationByDesign(Object.fromEntries(reports));
      setMessage(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "SEAT_RECORD_READ_FAILED"); }
  }, [connection]);
  useEffect(() => { loadEngineeringConnection().then(async (stored) => { setConnection(stored); if (stored) await refresh(stored); setLoading(false); }); }, [refresh]);
  const payload = () => ({
    description: description.trim(),
    requirements: [{ requirementId: requirementId.trim(), description: requirementDescription.trim(), constraint: { source: "USER_ENTERED" }, verificationMethod: "OPEN_QUESTION" }],
    materials: [{ name: materialName.trim(), specification: "USER_DECLARED", properties: {}, validationStatus: "UNKNOWN" as const }],
    components: [{ name: componentName.trim(), componentType: "USER_DECLARED", materialName: materialName.trim(), quantity: 1 }],
  });
  async function createRecord() {
    if (!connection) return setMessage("PROJECT_CONNECTION_REQUIRED");
    if (!name.trim() || !description.trim() || !requirementId.trim() || !requirementDescription.trim() || !materialName.trim() || !componentName.trim()) return setMessage("COMPLETE_SEAT_DESIGN_FIELDS");
    try {
      setCreating(true);
      await createSeatDesign(connection, { name: name.trim(), ...payload() });
      setMessage("SEAT_RECORD_PERSISTED"); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "SEAT_RECORD_REJECTED"); } finally { setCreating(false); }
  }
  async function revise(record: SeatDesignSnapshot) { if (!connection) return; try { setCreating(true); await createSeatRevision(connection, record.id, payload()); setMessage("SEAT_SUCCESSOR_REVISION_PERSISTED"); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "SEAT_REVISION_REJECTED"); } finally { setCreating(false); } }
  async function release(record: SeatDesignSnapshot) { if (!connection || !record.revisions?.[0]) return; try { setCreating(true); await releaseSeatRevision(connection, record.id, record.revisions[0].id); setMessage("SEAT_RELEASED"); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "SEAT_RELEASE_REJECTED"); } finally { setCreating(false); } }
  async function loadTraceability(record: SeatDesignSnapshot) {
    if (!connection || !record.revisions?.[0]) return;
    try {
      setCreating(true);
      const traceability = await getSeatEngineeringTraceability(connection, record.id, record.revisions[0].id);
      setTraceabilityByDesign((current) => ({ ...current, [record.id]: traceability }));
      setMessage(traceability.stale ? "TRACEABILITY_STALE_REVISION" : "TRACEABILITY_LOADED");
    } catch (error) { setMessage(error instanceof Error ? error.message : "TRACEABILITY_READ_FAILED"); }
    finally { setCreating(false); }
  }
  return <ScreenContainer className="px-5"><FlatList data={records} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh()} tintColor="#2EC5E8" />} contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>KNOWLEDGE BASE</Text><Text style={styles.title}>Seat engineering</Text><Text style={styles.description}>Create immutable, project-scoped seat revisions. CAD and CAE results remain unavailable until a matching verified engineering job is reconciled.</Text>{message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}{connection ? <ConceptDesignAuthoring connection={connection} onCreated={refresh} /> : null}<View style={styles.form}><TextInput value={name} onChangeText={setName} placeholder="Seat design name" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Revision description" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={requirementId} onChangeText={setRequirementId} placeholder="Requirement ID" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={requirementDescription} onChangeText={setRequirementDescription} placeholder="Measurable requirement" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={materialName} onChangeText={setMaterialName} placeholder="Material name" placeholderTextColor="#6A8AA2" style={styles.input} /><TextInput value={componentName} onChangeText={setComponentName} placeholder="Assembly component" placeholderTextColor="#6A8AA2" style={styles.input} /></View><Pressable onPress={createRecord} disabled={creating} style={({ pressed }) => [styles.button, (pressed || creating) && styles.pressed]}><Text style={styles.buttonText}>{creating ? "Persisting…" : "Create seat record"}</Text>{creating ? <ActivityIndicator color="#081827" /> : <MaterialIcons name="event-seat" color="#081827" size={20} />}</Pressable></View>}
    ListEmptyComponent={loading ? <ActivityIndicator color="#2EC5E8" /> : <View style={styles.empty}><MaterialIcons name="event-seat" color="#6A8AA2" size={32} /><Text style={styles.emptyText}>{connection ? "No persisted seat records." : "Connect a project in Workspace to read seat records."}</Text></View>}
    renderItem={({ item }) => {
      const verification = verificationByDesign[item.id];
      const traceability = traceabilityByDesign[item.id];
      return <View style={styles.card}><View style={styles.cardHeader}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.status}>{item.status}</Text></View><Text style={styles.id}>{item.id}</Text><Text style={styles.meta}>Updated {item.updatedAt ?? "unavailable"}</Text><View style={styles.verification}><Text style={styles.verificationLabel}>DESIGN VERIFICATION</Text>{verification ? <><Text style={styles.verificationState}>{verification.state}</Text><Text style={styles.verificationText}>CAD {verification.cadArtifact.validationStatus} · {verification.cadArtifact.kernel}</Text><Text style={styles.verificationText}>Required inputs: {verification.requiredInputs.length ? verification.requiredInputs.join(", ") : "none"}</Text><Text style={styles.verificationText}>{verification.runtimeDispatch.reason}</Text></> : <Text style={styles.verificationText}>No verification case is persisted. Create an immutable revision, then bind its validated CAD artifact in the engineering input package.</Text>}</View>{traceability ? <View style={styles.trace}><Text style={styles.traceLabel}>TRACEABILITY · {traceability.stale ? "STALE" : "CURRENT"}</Text><Text style={styles.traceText}>{traceability.nodes.map((item) => `${item.type}: ${item.status}`).join(" · ")}</Text><Text style={styles.traceText}>{traceability.edges.length} persisted dependency links</Text></View> : null}{connection && item.revisions?.[0] ? <><SeatInputPackageEditor connection={connection} seatDesignId={item.id} revisionId={item.revisions[0].id} /><SekbRecordWorkspace connection={connection} seatDesignId={item.id} seatRevisionId={item.revisions[0].id} /></> : null}<View style={styles.actions}><Pressable onPress={() => loadTraceability(item)} disabled={creating || !item.revisions?.[0]} style={styles.secondaryButton}><Text style={styles.secondaryText}>Traceability</Text></Pressable><Pressable onPress={() => revise(item)} disabled={creating || !description.trim()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Create successor</Text></Pressable><Pressable onPress={() => release(item)} disabled={creating} style={styles.secondaryButton}><Text style={styles.secondaryText}>Release revision</Text></Pressable></View></View>}}
  /></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 32, paddingTop: 18 }, header: { gap: 12, marginBottom: 4 }, eyebrow: { color: "#2EC5E8", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#E7F0F6", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 }, description: { color: "#B7CCDA", fontSize: 14, lineHeight: 20 }, form: { gap: 8 }, input: { backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 10, borderWidth: 1, color: "#E7F0F6", minHeight: 42, paddingHorizontal: 12 }, button: { alignItems: "center", backgroundColor: "#2EC5E8", borderRadius: 15, flexDirection: "row", justifyContent: "space-between", minHeight: 50, paddingHorizontal: 16 }, buttonText: { color: "#081827", fontSize: 15, fontWeight: "800" }, pressed: { opacity: 0.8 }, notice: { backgroundColor: "#153348", borderLeftColor: "#2EC5E8", borderLeftWidth: 3, borderRadius: 10, padding: 10 }, noticeText: { color: "#D5E2EB", fontSize: 12, fontWeight: "700" }, card: { backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 16, borderWidth: 1, gap: 6, padding: 15 }, cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, cardTitle: { color: "#E7F0F6", fontSize: 16, fontWeight: "800" }, status: { color: "#2EC5E8", fontSize: 11, fontWeight: "800" }, id: { color: "#A9C0D0", fontFamily: "monospace", fontSize: 11 }, meta: { color: "#6A8AA2", fontSize: 12 }, verification: { backgroundColor: "#102B3C", borderColor: "#1B526A", borderRadius: 10, borderWidth: 1, gap: 4, marginTop: 5, padding: 10 }, verificationLabel: { color: "#72D8EF", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, verificationState: { color: "#E7F0F6", fontSize: 13, fontWeight: "800" }, verificationText: { color: "#B7CCDA", fontSize: 11, lineHeight: 16 }, trace: { backgroundColor: "#0B2030", borderColor: "#31576B", borderRadius: 10, borderWidth: 1, gap: 4, padding: 10 }, traceLabel: { color: "#E5C173", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, traceText: { color: "#B7CCDA", fontSize: 11, lineHeight: 16 }, packageInput: { backgroundColor: "#081827", borderColor: "#29536B", borderRadius: 8, borderWidth: 1, color: "#E7F0F6", fontFamily: "monospace", fontSize: 11, minHeight: 92, padding: 9, textAlignVertical: "top" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }, secondaryButton: { borderColor: "#2EC5E8", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, secondaryText: { color: "#BDEFFC", fontSize: 12, fontWeight: "700" }, empty: { alignItems: "center", borderColor: "#1B3B53", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, gap: 8, padding: 28 }, emptyText: { color: "#8BA4B8", textAlign: "center" } });
