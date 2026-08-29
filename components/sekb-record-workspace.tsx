import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { createSekbEntity, getSekbAudit, listSekbEntities, searchSekbEntities, uploadSekbAttachment, type EngineeringConnection, type SekbEntitySnapshot, type SekbEntityType } from "@/lib/engineering-api";

const ENTITY_TYPES: SekbEntityType[] = ["DIMENSION", "CONSTRAINT", "LOAD_CASE", "CAE_CONFIGURATION", "MESH", "VALIDATION", "TEST", "REPORT", "PROVENANCE"];

export function SekbRecordWorkspace({ connection, seatDesignId, seatRevisionId }: { connection: EngineeringConnection; seatDesignId?: string; seatRevisionId?: string }) {
  const [records, setRecords] = useState<SekbEntitySnapshot[]>([]);
  const [type, setType] = useState<SekbEntityType>("DIMENSION");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [valueText, setValueText] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setBusy(true); setRecords(await listSekbEntities(connection, { seatDesignId, seatRevisionId, limit: 20 })); }
    catch (error) { setStatus(error instanceof Error ? error.message : "SEKB_RECORD_READ_FAILED"); }
    finally { setBusy(false); }
  }, [connection, seatDesignId, seatRevisionId]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!name.trim() || !description.trim() || !source.trim()) return setStatus("NAME_DESCRIPTION_SOURCE_REQUIRED");
    try {
      setBusy(true);
      await createSekbEntity(connection, {
        entityType: type, externalKey: `${type}_${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
        name: name.trim(), description: description.trim(), valueText: valueText.trim() || undefined, unit: unit.trim() || undefined,
        sourceType: "USER_PROVIDED", sourceReference: source.trim(), evidenceReference: evidenceReference.trim() || undefined,
        seatDesignId, seatRevisionId, createdBy: "ProjectEngineer",
      });
      setName(""); setDescription(""); setValueText(""); setUnit(""); setSource(""); setEvidenceReference(""); setStatus("SEKB_DRAFT_PERSISTED");
      await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "SEKB_RECORD_CREATE_FAILED"); }
    finally { setBusy(false); }
  }

  async function search() {
    if (!query.trim()) return load();
    try { setBusy(true); setRecords(await searchSekbEntities(connection, query.trim(), { type })); }
    catch (error) { setStatus(error instanceof Error ? error.message : "SEKB_SEARCH_FAILED"); }
    finally { setBusy(false); }
  }

  async function revealAudit(entityId: string) {
    try { setBusy(true); const details = await getSekbAudit(connection, entityId); setAudit((current) => ({ ...current, [entityId]: `${details.auditEvents.length} audit events · ${details.attachments.length} attachments · ${details.relations.length} relations` })); }
    catch (error) { setStatus(error instanceof Error ? error.message : "SEKB_AUDIT_READ_FAILED"); }
    finally { setBusy(false); }
  }

  async function uploadEvidence(record: SekbEntitySnapshot) {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 10 * 1024 * 1024) return setStatus("SEKB_ATTACHMENT_SIZE_INVALID");
      setBusy(true);
      const base64 = asset.base64 ?? await new File(asset.uri).base64();
      await uploadSekbAttachment(connection, record.id, { fileName: asset.name, mediaType: asset.mimeType ?? "application/octet-stream", base64, sourceReference: record.sourceReference, actor: "ProjectEngineer" });
      setStatus("SEKB_EVIDENCE_UPLOADED");
      await revealAudit(record.id);
    } catch (error) { setStatus(error instanceof Error ? error.message : "SEKB_ATTACHMENT_UPLOAD_FAILED"); }
    finally { setBusy(false); }
  }

  return <View style={styles.container}>
    <Text style={styles.label}>PERSISTENT ENGINEERING KNOWLEDGE</Text>
    <Text style={styles.help}>Create source-traceable drafts only. Missing values remain absent; approval and release require evidence through the governed API.</Text>
    <View style={styles.chips}>{ENTITY_TYPES.map((item) => <Pressable key={item} onPress={() => setType(item)} style={[styles.chip, type === item && styles.chipActive]}><Text style={[styles.chipText, type === item && styles.chipTextActive]}>{item.replace("_", " ")}</Text></Pressable>)}</View>
    <TextInput value={name} onChangeText={setName} placeholder="Record name" placeholderTextColor="#6A8AA2" style={styles.input} />
    <TextInput value={description} onChangeText={setDescription} placeholder="Engineering description" placeholderTextColor="#6A8AA2" style={styles.input} />
    <View style={styles.row}><TextInput value={valueText} onChangeText={setValueText} placeholder="Value (optional)" placeholderTextColor="#6A8AA2" style={[styles.input, styles.flex]} /><TextInput value={unit} onChangeText={setUnit} placeholder="Unit" placeholderTextColor="#6A8AA2" style={[styles.input, styles.unit]} /></View>
    <TextInput value={source} onChangeText={setSource} placeholder="Source / authority" placeholderTextColor="#6A8AA2" style={styles.input} />
    <TextInput value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Evidence reference (optional until review)" placeholderTextColor="#6A8AA2" style={styles.input} />
    <Pressable onPress={create} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save governed draft"}</Text></Pressable>
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} placeholder="Search this project’s engineering records" placeholderTextColor="#6A8AA2" style={[styles.input, styles.flex]} /><Pressable onPress={search} disabled={busy} style={styles.searchButton}><Text style={styles.searchText}>Search</Text></Pressable></View>
    {status ? <Text style={styles.status}>{status}</Text> : null}
    {busy ? <ActivityIndicator color="#2EC5E8" /> : null}
    {records.map((record) => <View key={record.id} style={styles.record}><View style={styles.recordHeader}><Text style={styles.recordTitle}>{record.name}</Text><Text style={styles.recordStatus}>{record.status}</Text></View><Text style={styles.meta}>{record.entityType} · r{record.revision} · {record.sourceType}</Text><Text style={styles.meta}>{record.valueText ? `${record.valueText}${record.unit ? ` ${record.unit}` : ""}` : "No value supplied"}</Text><Text style={styles.meta}>Source: {record.sourceReference}</Text><View style={styles.recordActions}><Pressable onPress={() => revealAudit(record.id)} disabled={busy} style={styles.auditButton}><Text style={styles.auditText}>Audit & evidence</Text></Pressable><Pressable onPress={() => uploadEvidence(record)} disabled={busy || record.status === "RELEASED"} style={styles.auditButton}><Text style={styles.auditText}>Attach evidence</Text></Pressable></View>{audit[record.id] ? <Text style={styles.meta}>{audit[record.id]}</Text> : null}</View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#0B2030", borderColor: "#31576B", borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8, padding: 12 },
  label: { color: "#72D8EF", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, help: { color: "#B7CCDA", fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, chip: { borderColor: "#31576B", borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 }, chipActive: { backgroundColor: "#2EC5E8", borderColor: "#2EC5E8" }, chipText: { color: "#B7CCDA", fontSize: 9, fontWeight: "800" }, chipTextActive: { color: "#081827" },
  input: { backgroundColor: "#081827", borderColor: "#29536B", borderRadius: 8, borderWidth: 1, color: "#E7F0F6", fontSize: 11, minHeight: 38, paddingHorizontal: 9 }, row: { flexDirection: "row", gap: 8 }, flex: { flex: 1 }, unit: { width: 72 },
  primary: { alignItems: "center", backgroundColor: "#2EC5E8", borderRadius: 9, paddingVertical: 10 }, primaryText: { color: "#081827", fontSize: 12, fontWeight: "800" }, searchRow: { flexDirection: "row", gap: 8 }, searchButton: { alignItems: "center", borderColor: "#2EC5E8", borderRadius: 8, borderWidth: 1, justifyContent: "center", paddingHorizontal: 10 }, searchText: { color: "#BDEFFC", fontSize: 11, fontWeight: "800" }, status: { color: "#E5C173", fontSize: 11, fontWeight: "700" },
  record: { backgroundColor: "#102B3C", borderColor: "#1B526A", borderRadius: 9, borderWidth: 1, gap: 3, padding: 9 }, recordHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, recordTitle: { color: "#E7F0F6", flex: 1, fontSize: 12, fontWeight: "800" }, recordStatus: { color: "#72D8EF", fontSize: 10, fontWeight: "800" }, meta: { color: "#A9C0D0", fontSize: 10, lineHeight: 14 }, recordActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, auditButton: { alignSelf: "flex-start", borderColor: "#31576B", borderRadius: 7, borderWidth: 1, marginTop: 4, paddingHorizontal: 7, paddingVertical: 5 }, auditText: { color: "#BDEFFC", fontSize: 10, fontWeight: "800" },
});
