import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { createCncTestPlate, loadEngineeringConnection, type EngineeringConnection, type SourceLessCncExecutionSnapshot } from "@/lib/engineering-api";

function readable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "SOURCELESS_CNC_UNAVAILABLE");
  return message.includes("PROJECT_ACCESS") ? "PROJECT_ACCESS_REQUIRED — create or open the owning project first." : message;
}

/** A real mobile control for the one registered source-less authoring operation. */
export function CncTestPlateAuthoring() {
  const [connection, setConnection] = useState<EngineeringConnection | null>(null);
  const [result, setResult] = useState<SourceLessCncExecutionSnapshot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => { loadEngineeringConnection().then(setConnection).catch((error) => setNotice(readable(error))).finally(() => setBusy(false)); }, []);
  async function execute() {
    if (!connection) return;
    try { setBusy(true); const next = await createCncTestPlate(connection); setResult(next); setNotice("Authoritative DXF plate created through the Common Feature Executor. The exact bytes were managed-ingested and hash-bound."); }
    catch (error) { setNotice(readable(error)); }
    finally { setBusy(false); }
  }

  return <View style={styles.root}>
    <Text style={styles.eyebrow}>SOURCE-LESS AUTHORING</Text>
    <Text style={styles.title}>Verified 2D CNC test plate</Text>
    <Text style={styles.description}>Creates only the registered 300 × 200 mm DXF plate with four Ø12 mm holes. It validates authorization and binary output, then sends exact bytes through managed CAD ingestion. It does not create a toolpath, G-code, DWG, material, tolerance, or manufacturability result.</Text>
    {busy ? <ActivityIndicator color="#C68A4B" /> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {!connection ? <Text style={styles.blocked}>Open a project in the Project workspace to enable this controlled operation.</Text> : <Pressable disabled={busy} onPress={execute} style={styles.action}><Text style={styles.actionText}>Create managed DXF test plate</Text></Pressable>}
    {result ? <View style={styles.result}><Text style={styles.good}>{result.completion.operationId} · {result.completion.validation.validationStatus}</Text><Text style={styles.meta}>DXF artifact v{result.completion.artifact.revision} · {result.completion.generatedByteLength} bytes</Text><Text style={styles.meta}>SHA-256 {result.completion.artifact.sha256}</Text><Text style={styles.meta}>Immutable lineage {result.revisionId} · provenance {result.provenanceRecordId}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({ root: { backgroundColor: "#2A2119", borderColor: "#7A5837", borderRadius: 14, borderWidth: 1, gap: 9, marginTop: 18, padding: 13 }, eyebrow: { color: "#F1B861", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, title: { color: "#F5E7D8", fontSize: 18, fontWeight: "900" }, description: { color: "#D8C4AF", fontSize: 11, lineHeight: 16 }, action: { alignItems: "center", backgroundColor: "#C68A4B", borderRadius: 8, padding: 10 }, actionText: { color: "#20160C", fontSize: 11, fontWeight: "900" }, notice: { backgroundColor: "#3B2B1C", borderLeftColor: "#F1B861", borderLeftWidth: 3, color: "#F5E7D8", fontSize: 10, lineHeight: 15, padding: 8 }, blocked: { backgroundColor: "#392E25", color: "#D8C4AF", fontSize: 10, lineHeight: 15, padding: 8 }, result: { backgroundColor: "#211810", borderColor: "#654A30", borderRadius: 8, borderWidth: 1, gap: 3, padding: 8 }, good: { color: "#9DE0BE", fontSize: 10, fontWeight: "900" }, meta: { color: "#D8C4AF", fontSize: 10, lineHeight: 14 } });
