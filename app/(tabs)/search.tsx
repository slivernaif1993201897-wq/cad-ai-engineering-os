import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getSeatEngineeringReport, listEngineeringJobs, listSeatDesigns, loadEngineeringConnection, searchEngineeringKnowledge, type EngineeringConnection, type EngineeringSearchResult } from "@/lib/engineering-api";

type Result = { id: string; category: "Project" | "Seat design" | "Revision" | "CAD artifact" | "Engineering job" | "Report" | "Evidence"; title: string; detail: string; route: string };
export default function SearchScreen() {
  const [connection, setConnection] = useState<EngineeringConnection | null>(null);
  const [records, setRecords] = useState<Result[]>([]);
  const [query, setQuery] = useState("");
  const [authoritativeMatches, setAuthoritativeMatches] = useState<EngineeringSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const active = await loadEngineeringConnection(); setConnection(active);
      if (!active) { setRecords([]); return; }
      const [seats, jobs] = await Promise.all([listSeatDesigns(active), listEngineeringJobs(active)]);
      const reports = await Promise.all(seats.map(async (seat) => { try { return [seat.id, await getSeatEngineeringReport(active, seat.id)] as const; } catch { return [seat.id, null] as const; } }));
      const items: Result[] = [{ id: active.projectId, category: "Project", title: active.projectName, detail: "Current authorized project", route: "/workspace" }];
      seats.forEach((seat) => { items.push({ id: seat.id, category: "Seat design", title: seat.name, detail: seat.status, route: "/seats" }); seat.revisions?.forEach((revision) => items.push({ id: revision.id, category: "Revision", title: `${seat.name} · R${revision.revisionNumber}`, detail: revision.status, route: "/seats" })); });
      jobs.forEach((job) => { items.push({ id: job.jobId, category: "Engineering job", title: job.jobId, detail: job.state, route: `/job/${job.jobId}` }); if (job.cad?.artifactHash) items.push({ id: job.cad.artifactHash, category: "CAD artifact", title: job.cad.artifactName ?? "CAD artifact", detail: job.cad.artifactHash, route: "/cad" }); if (job.runtimeEvidence?.evidenceHash) items.push({ id: job.runtimeEvidence.evidenceHash, category: "Evidence", title: "Verified runtime evidence", detail: job.runtimeEvidence.evidenceHash, route: `/job/${job.jobId}` }); });
      reports.forEach(([seatId, report]) => { if (report) items.push({ id: report.reportId, category: "Report", title: `Engineering report · ${seatId}`, detail: report.disclaimer, route: "/seats" }); }); setRecords(items);
    } catch { setError("Unable to search project records right now. Retry when the connection is available."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const term = query.trim();
    if (!term || !connection) { setAuthoritativeMatches(null); return; }
    let active = true;
    const timer = setTimeout(() => {
      searchEngineeringKnowledge(connection, term)
        .then((matches) => { if (active) { setAuthoritativeMatches(matches); setError(null); } })
        .catch(() => { if (active) setError("Authoritative engineering search is temporarily unavailable. Retry when the connection is available."); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [connection, query]);
  const filtered = useMemo(() => {
    if (query.trim() && authoritativeMatches) {
      return authoritativeMatches.map((match): Result => ({
        id: match.id,
        category: match.entityType as Result["category"],
        title: match.title,
        detail: match.status,
        route: match.entityType === "SOLVER_RUN" ? `/job/${match.id}` : match.entityType === "CAD_ARTIFACT" ? "/cad" : "/seats",
      }));
    }
    const term = query.trim().toLowerCase();
    return term ? records.filter((record) => `${record.category} ${record.title} ${record.detail}`.toLowerCase().includes(term)) : records;
  }, [authoritativeMatches, query, records]);
  return <ScreenContainer className="px-5"><FlatList data={filtered} keyExtractor={(item) => `${item.category}-${item.id}`} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2EC5E8" />} contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>GLOBAL SEARCH</Text><Text style={styles.title}>Find project work</Text><Text style={styles.description}>Search only records available to the current authorized project.</Text><View style={styles.search}><MaterialIcons color="#72D8EF" name="search" size={20} /><TextInput value={query} onChangeText={setQuery} placeholder="Search designs, revisions, jobs, reports, evidence…" placeholderTextColor="#6A8AA2" style={styles.input} accessibilityLabel="Search project records" /></View>{error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}</View>} ListEmptyComponent={loading ? <ActivityIndicator color="#2EC5E8" /> : <View style={styles.empty}><MaterialIcons color="#6A8AA2" name={connection ? "search-off" : "folder-off"} size={32} /><Text style={styles.emptyTitle}>{connection ? "No matching records" : "No project is open"}</Text><Text style={styles.emptyText}>{connection ? "Try another project name, revision, job, or evidence identifier." : "Create or open a project to search its authorized records."}</Text></View>} renderItem={({ item }) => <Pressable onPress={() => router.push(item.route as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button"><View style={styles.cardTop}><Text style={styles.category}>{item.category.toUpperCase()}</Text><MaterialIcons color="#72D8EF" name="arrow-forward" size={18} /></View><Text style={styles.cardTitle}>{item.title}</Text><Text numberOfLines={2} style={styles.cardDetail}>{item.detail}</Text></Pressable>} /></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 32, paddingTop: 18 }, header: { gap: 8, marginBottom: 4 }, eyebrow: { color: "#2EC5E8", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, title: { color: "#E7F0F6", fontSize: 28, fontWeight: "800", letterSpacing: -.7 }, description: { color: "#A9C0D0", fontSize: 13, lineHeight: 19 }, search: { alignItems: "center", backgroundColor: "#0E2436", borderColor: "#1B526A", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 5, paddingHorizontal: 11 }, input: { color: "#E7F0F6", flex: 1, fontSize: 13, minHeight: 44 }, card: { backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 14, borderWidth: 1, gap: 5, padding: 13 }, cardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, category: { color: "#72D8EF", fontSize: 10, fontWeight: "800", letterSpacing: .8 }, cardTitle: { color: "#E7F0F6", fontSize: 14, fontWeight: "800" }, cardDetail: { color: "#8BA4B8", fontFamily: "monospace", fontSize: 10, lineHeight: 15 }, empty: { alignItems: "center", borderColor: "#1B3B53", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, gap: 7, padding: 28 }, emptyTitle: { color: "#D5E2EB", fontSize: 16, fontWeight: "800" }, emptyText: { color: "#8BA4B8", fontSize: 12, lineHeight: 18, textAlign: "center" }, error: { backgroundColor: "#3A1E29", borderLeftColor: "#EE7984", borderLeftWidth: 3, borderRadius: 10, padding: 10 }, errorText: { color: "#F6C9CF", fontSize: 12, fontWeight: "700" }, pressed: { opacity: .78, transform: [{ scale: .985 }] } });
