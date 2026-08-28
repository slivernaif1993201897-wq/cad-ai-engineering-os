import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { captureCapreCheckpoint, discoverCapre, listCapreCheckpoints, restoreCapreToStaging, runCapreRecoveryDrill, verifyCapreCheckpoint, verifyCapreStagingRestore, loadEngineeringConnection, type CapreCheckpointSummary, type CapreDiscovery, type EngineeringConnection } from "@/lib/engineering-api";

type Action = "DISCOVER" | "CAPTURE" | "DRILL" | "VERIFY" | "RESTORE" | null;

const messageFor = (error: unknown) => error instanceof Error ? error.message.replace(/_/g, " ") : "RECOVERY OPERATION FAILED";

export default function RecoveryScreen() {
  const [connection, setConnection] = useState<EngineeringConnection | null>(null);
  const [discovery, setDiscovery] = useState<CapreDiscovery | null>(null);
  const [checkpoints, setCheckpoints] = useState<CapreCheckpointSummary[]>([]);
  const [notice, setNotice] = useState("Load an authorised project to inspect CAPRE recovery state.");
  const [action, setAction] = useState<Action>(null);

  const refresh = useCallback(async () => {
    setAction("DISCOVER");
    try {
      const active = await loadEngineeringConnection();
      setConnection(active);
      if (!active) { setDiscovery(null); setCheckpoints([]); setNotice("PROJECT ACCESS REQUIRED"); return; }
      const [nextDiscovery, nextCheckpoints] = await Promise.all([discoverCapre(active), listCapreCheckpoints(active)]);
      setDiscovery(nextDiscovery); setCheckpoints(nextCheckpoints);
      setNotice(nextDiscovery.durableBackupAvailable ? "An authorised durable recovery target is available." : "DURABLE BACKUP UNAVAILABLE — local snapshots remain ephemeral only.");
    } catch (error) { setNotice(messageFor(error)); }
    finally { setAction(null); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const durabilityColor = discovery?.durableBackupAvailable ? "#43C6A5" : "#F1B861";
  const capture = useCallback(() => {
    if (!connection) return setNotice("PROJECT ACCESS REQUIRED");
    Alert.alert("Capture local snapshot", "The capture excludes secrets, database rows, and managed artifacts. It is not a durable backup and requires a clean worktree.", [
      { text: "Cancel", style: "cancel" },
      { text: "Capture", onPress: async () => { setAction("CAPTURE"); try { const snapshot = await captureCapreCheckpoint(connection); setNotice(`EPHEMERAL SNAPSHOT CAPTURED: ${snapshot.checkpointId}`); await refresh(); } catch (error) { setNotice(messageFor(error)); } finally { setAction(null); } } },
    ]);
  }, [connection, refresh]);

  const runDrill = useCallback(async () => {
    if (!connection) return setNotice("PROJECT ACCESS REQUIRED");
    setAction("DRILL");
    try { const drill = await runCapreRecoveryDrill(connection); setNotice(`RECOVERY DRILL ${drill.status}: ${drill.reason}`); await refresh(); }
    catch (error) { setNotice(messageFor(error)); }
    finally { setAction(null); }
  }, [connection, refresh]);

  const selectSnapshot = useCallback((snapshot: CapreCheckpointSummary) => {
    if (!connection) return setNotice("PROJECT ACCESS REQUIRED");
    Alert.alert("Inspect snapshot", `${snapshot.checkpointId}\n\nClass: ${snapshot.checkpointClass}\nDurability: ${snapshot.durabilityClass}\n\nVerification recomputes hashes. Restore is staging-only and cannot overwrite the live project.`, [
      { text: "Close", style: "cancel" },
      { text: "Verify", onPress: async () => { setAction("VERIFY"); try { const result = await verifyCapreCheckpoint(connection, snapshot.checkpointId); setNotice(`INTEGRITY ${result.status}: ${result.failures.length ? result.failures.join("; ") : "all captured hashes match"}`); } catch (error) { setNotice(messageFor(error)); } finally { setAction(null); } } },
      { text: "Restore to staging", onPress: async () => { setAction("RESTORE"); try { const restore = await restoreCapreToStaging(connection, snapshot.checkpointId); const verification = await verifyCapreStagingRestore(connection, restore.stagingId); setNotice(`STAGING ${verification.status}: ${verification.checks.map((check) => `${check.name} ${check.status}`).join(" · ")}`); } catch (error) { setNotice(messageFor(error)); } finally { setAction(null); } } },
    ]);
  }, [connection]);

  const header = useMemo(() => <View style={styles.header}><Text style={styles.eyebrow}>CAPRE / RECOVERY</Text><Text style={styles.title}>Protected recovery</Text><Text style={styles.description}>A snapshot protects only bytes that were captured and independently verified. This surface never exports secret values or promotes a partial restore.</Text><View style={[styles.status, { borderColor: durabilityColor }]}><MaterialIcons name={discovery?.durableBackupAvailable ? "verified-user" : "warning-amber"} size={24} color={durabilityColor} /><View style={styles.statusCopy}><Text style={styles.statusTitle}>{discovery?.durabilityClass ?? "NOT MEASURABLE"}</Text><Text style={styles.statusText}>{notice}</Text></View></View><View style={styles.metricRow}><Metric label="CHECKPOINTS" value={String(checkpoints.length)} /><Metric label="WORKTREE" value={discovery?.worktreeState ?? "UNKNOWN"} /><Metric label="MEMORY" value="NOT PROVEN" /></View><Pressable onPress={capture} disabled={action !== null} accessibilityRole="button" style={({ pressed }) => [styles.primary, (pressed || action !== null) && styles.pressed]}><Text style={styles.primaryText}>{action === "CAPTURE" ? "Capturing…" : "Capture local snapshot"}</Text><MaterialIcons color="#081827" name="add-circle-outline" size={20} /></Pressable><Pressable onPress={runDrill} disabled={action !== null} accessibilityRole="button" style={({ pressed }) => [styles.secondary, (pressed || action !== null) && styles.pressed]}><Text style={styles.secondaryText}>{action === "DRILL" ? "Running recovery drill…" : "Run staging recovery drill"}</Text><MaterialIcons color="#8BE4CE" name="science" size={20} /></Pressable><Text style={styles.section}>IMMUTABLE SNAPSHOTS</Text></View>, [action, capture, checkpoints.length, discovery?.durabilityClass, discovery?.durableBackupAvailable, discovery?.worktreeState, durabilityColor, notice, runDrill]);

  return <ScreenContainer className="px-5"><FlatList data={checkpoints} keyExtractor={(item) => item.checkpointId} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => selectSnapshot(item)} style={({ pressed }) => [styles.snapshot, pressed && styles.pressed]}><View><Text style={styles.snapshotId}>{item.checkpointId}</Text><Text style={styles.snapshotMeta}>{item.checkpointClass.replace(/_/g, " ")} · {item.durabilityClass.replace(/_/g, " ")}</Text><Text style={styles.snapshotMeta}>Commit {item.repositoryHead.slice(0, 12)} · {item.worktreeState}</Text></View><MaterialIcons color="#72D8EF" name="chevron-right" size={25} /></Pressable>} ListHeaderComponent={header} ListEmptyComponent={<View style={styles.empty}><MaterialIcons name="inventory-2" color="#8BA4B8" size={26} /><Text style={styles.emptyTitle}>No local snapshots</Text><Text style={styles.emptyText}>Use Discover and capture only after the worktree is clean. A local snapshot is not a durable backup.</Text></View>} refreshControl={<RefreshControl refreshing={action === "DISCOVER"} onRefresh={refresh} tintColor="#2EC5E8" />} contentContainerStyle={styles.content} /></ScreenContainer>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 36, paddingTop: 20 }, header: { gap: 12 }, eyebrow: { color: "#2EC5E8", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#E7F0F6", fontSize: 29, fontWeight: "800", letterSpacing: -0.8 }, description: { color: "#A9C0D0", fontSize: 13, lineHeight: 19 }, status: { alignItems: "flex-start", backgroundColor: "#0D2637", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 }, statusCopy: { flex: 1, gap: 4 }, statusTitle: { color: "#E7F0F6", fontSize: 14, fontWeight: "800" }, statusText: { color: "#A9C0D0", fontSize: 12, lineHeight: 17 }, metricRow: { flexDirection: "row", gap: 8 }, metric: { backgroundColor: "#0B2030", borderColor: "#1B4056", borderRadius: 11, borderWidth: 1, flex: 1, gap: 5, padding: 10 }, metricLabel: { color: "#72D8EF", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 }, metricValue: { color: "#DCEBF3", fontSize: 11, fontWeight: "700" }, primary: { alignItems: "center", backgroundColor: "#2EC5E8", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", minHeight: 50, paddingHorizontal: 15 }, primaryText: { color: "#081827", fontSize: 14, fontWeight: "800" }, secondary: { alignItems: "center", backgroundColor: "#103448", borderColor: "#176070", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 50, paddingHorizontal: 15 }, secondaryText: { color: "#C7F8E9", fontSize: 14, fontWeight: "800" }, section: { color: "#8BA4B8", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 6 }, snapshot: { alignItems: "center", backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 76, padding: 13 }, snapshotId: { color: "#E7F0F6", fontFamily: "monospace", fontSize: 12, fontWeight: "800" }, snapshotMeta: { color: "#9AB4C5", fontSize: 11, lineHeight: 16, marginTop: 3 }, empty: { alignItems: "center", backgroundColor: "#091B2A", borderColor: "#1B4056", borderRadius: 14, borderWidth: 1, gap: 7, padding: 22 }, emptyTitle: { color: "#D8E6EE", fontSize: 14, fontWeight: "800" }, emptyText: { color: "#8BA4B8", fontSize: 12, lineHeight: 18, textAlign: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });
