import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { loadProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { trpc } from "@/lib/trpc";

function tone(value?: string) {
  if (["DECLARED", "REVIEW_REQUIRED"].includes(value ?? "")) return "#8EC4E8";
  if (["BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE", "NOT_EVALUATED", "NUMERICAL_CAE_UNAVAILABLE"].includes(value ?? "")) return "#E9B76A";
  if (["REJECTED", "INVALID", "UNKNOWN"].includes(value ?? "")) return "#E78966";
  return "#9DAEB6";
}

function Badge({ value }: { value: string }) {
  const color = tone(value);
  return <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{value.replaceAll("_", " ")}</Text></View>;
}

export function OptimizationInspectorPanel() {
  const [project, setProject] = useState<StoredProjectAccess>();
  const [selectedStudyId, setSelectedStudyId] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const stored = await loadProjectAccess("active-engineering-workbench");
      if (!cancelled && stored) setProject(stored);
    };
    void hydrate();
    const interval = setInterval(() => void hydrate(), 1_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const access = { projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE" };
  const studies = trpc.optimization.listStudies.useQuery(access, { enabled: Boolean(project) });
  const selected = useMemo(() => studies.data?.find((item) => item.optimizationStudyId === selectedStudyId) ?? studies.data?.[0], [selectedStudyId, studies.data]);
  const candidates = trpc.optimization.listCandidates.useQuery({ ...access, optimizationStudyId: selected?.optimizationStudyId }, { enabled: Boolean(project && selected) });
  const refresh = () => { void Promise.all([studies.refetch(), candidates.refetch()]); };
  const loading = !project || studies.isLoading || (Boolean(selected) && candidates.isLoading);

  return <View style={styles.wrap}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}><Text style={styles.kicker}>PHASE 6.14 · CONCEPTUAL OPTIMIZATION</Text><Text style={styles.title}>Design-space declarations, never inferred numerical performance</Text><Text style={styles.copy}>Studies, design variables, objectives, constraints, and candidates are immutable project evidence. This inspector does not generate CAD, mesh, solver input, objective values, constraint values, sensitivity results, a Pareto front, a rank, or an optimization decision.</Text></View>
      <Badge value="NON-EXECUTABLE" />
    </View>

    <View style={styles.blocked}><Text style={styles.kicker}>NUMERICAL ASSESSMENT</Text><Text style={styles.blockedTitle}>BLOCKED_NUMERICAL_EVALUATION_UNAVAILABLE</Text><Text style={styles.blockedCopy}>No trusted numerical CAE runtime or result evidence is available. All candidates remain conceptual; numerical optimization is not eligible and no result is presented as calculated, verified, or production-ready.</Text></View>

    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricLabel}>STUDIES</Text><Text style={styles.metricValue}>{studies.data?.length ?? 0}</Text><Text style={styles.metricHint}>immutable declarations</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>CANDIDATES</Text><Text style={styles.metricValue}>{candidates.data?.length ?? 0}</Text><Text style={styles.metricHint}>not evaluated</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>EXECUTION</Text><Text style={styles.metricValue}>FALSE</Text><Text style={styles.metricHint}>always fail-closed</Text></View>
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>DECLARED STUDIES</Text><Text style={styles.cardTitle}>{project ? `${studies.data?.length ?? 0} authorized study record(s)` : "Connect an authorized engineering project to inspect studies"}</Text></View><Pressable onPress={refresh} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}><Text style={styles.refreshText}>REFRESH</Text></Pressable></View>
      {loading ? <View style={styles.loading}><ActivityIndicator color="#8EC4E8" /><Text style={styles.meta}>Loading only authorized project records…</Text></View> : <FlatList data={studies.data ?? []} scrollEnabled={false} keyExtractor={(item) => item.optimizationStudyId} renderItem={({ item }) => <Pressable onPress={() => setSelectedStudyId(item.optimizationStudyId)} style={({ pressed }) => [styles.studyRow, item.optimizationStudyId === selected?.optimizationStudyId && styles.studyActive, pressed && styles.pressed]}><View style={styles.studyCopy}><Text style={styles.studyTitle}>{item.title}</Text><Text style={styles.meta}>REVISION {item.revision} · {item.method.replaceAll("_", " ")}</Text><Text style={styles.meta}>CAD sources: {item.sourceArtifactIds.length} · Variables: {item.variables.length} · Objectives: {item.objectives.length} · Constraints: {item.constraints.length}</Text></View><Badge value={item.state} /></Pressable>} ListEmptyComponent={<Text style={styles.meta}>No CAD-bound optimization study is available in this project. Nothing is inferred from a concept or from surrounding CAD parameters.</Text>} />}
    </View>

    {selected ? <>
      <View style={styles.card}><View style={styles.row}><View><Text style={styles.kicker}>STUDY INSPECTOR</Text><Text style={styles.cardTitle}>{selected.title}</Text></View><Badge value={selected.evaluationAvailability} /></View><Text style={styles.copy}>Revision {selected.revision} · Method {selected.method.replaceAll("_", " ")}. Numerical results available: FALSE. Execution eligible: FALSE. Executable: FALSE.</Text><Text style={styles.meta}>CAD-bound source artifacts: {selected.sourceArtifactIds.join(", ")}</Text></View>
      <View style={styles.detailGrid}>
        <View style={styles.card}><Text style={styles.kicker}>DESIGN VARIABLES</Text><FlatList data={selected.variables} scrollEnabled={false} keyExtractor={(item) => item.variableId} renderItem={({ item }) => <View style={styles.detailRow}><Text style={styles.detailTitle}>{item.name}</Text><Text style={styles.meta}>{item.kind} · {item.minimum ?? "—"} to {item.maximum ?? "—"} {item.unit ?? ""}</Text><Text style={styles.meta}>SOURCE {item.sourceArtifactId} · {item.truthStatus}</Text></View>} /></View>
        <View style={styles.card}><Text style={styles.kicker}>OBJECTIVES & CONSTRAINTS</Text><FlatList data={[...selected.objectives.map((item) => ({ id: item.objectiveId, title: item.title, detail: `${item.direction} · ${item.metricReference}`, status: item.evaluationAvailability })), ...selected.constraints.map((item) => ({ id: item.constraintId, title: item.title, detail: `${item.comparison}${item.targetValue === undefined ? "" : ` ${item.targetValue}`} ${item.unit ?? ""}`, status: item.evaluationAvailability }))]} scrollEnabled={false} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={styles.detailRow}><Text style={styles.detailTitle}>{item.title}</Text><Text style={styles.meta}>{item.detail}</Text><Badge value={item.status} /></View>} ListEmptyComponent={<Text style={styles.meta}>No declared constraints are present.</Text>} /></View>
      </View>
      <View style={styles.card}><Text style={styles.kicker}>CONCEPTUAL CANDIDATES</Text><FlatList data={candidates.data ?? []} scrollEnabled={false} keyExtractor={(item) => item.candidateId} renderItem={({ item }) => <View style={styles.candidate}><View style={styles.candidateCopy}><Text style={styles.detailTitle}>{item.candidateLabel}</Text><Text style={styles.meta}>{item.parameterValues.map((value) => `${value.variableId} = ${String(value.value)}`).join(" · ")}</Text><Text style={styles.meta}>Objective values: none · Constraint values: none · Rank assigned: FALSE</Text></View><View style={styles.candidateBadges}><Badge value={item.evaluationStatus} /><Badge value={item.rankingState} /></View></View>} ListEmptyComponent={<Text style={styles.meta}>No candidates have been declared. A candidate is never generated or evaluated automatically.</Text>} /></View>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 }, hero: { backgroundColor: "#172932", borderWidth: 1, borderColor: "#315063", borderRadius: 14, padding: 14, gap: 12 }, heroCopy: { gap: 5 }, kicker: { color: "#9DAEB6", fontSize: 9, fontWeight: "800", letterSpacing: 1 }, title: { color: "#F3F1EA", fontSize: 16, lineHeight: 21, fontWeight: "800" }, copy: { color: "#C8D5D9", fontSize: 10, lineHeight: 15 }, blocked: { backgroundColor: "#3A2A1C", borderColor: "#73512E", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 }, blockedTitle: { color: "#F6D8C6", fontSize: 12, fontWeight: "900", lineHeight: 16 }, blockedCopy: { color: "#E7C8B4", fontSize: 10, lineHeight: 15 }, badge: { alignSelf: "flex-start", borderRadius: 99, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 }, badgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.35 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { minWidth: "30%", flexGrow: 1, backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 }, metricLabel: { color: "#7B8A93", fontSize: 8, fontWeight: "800" }, metricValue: { color: "#F3F1EA", fontSize: 18, fontWeight: "900" }, metricHint: { color: "#8EC4E8", fontSize: 8 }, card: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, cardTitle: { color: "#F3F1EA", fontSize: 12, lineHeight: 17, fontWeight: "800", maxWidth: 240 }, refresh: { borderColor: "#5B9DCA", borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, refreshText: { color: "#8EC4E8", fontSize: 8, fontWeight: "900" }, loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }, meta: { color: "#7B8A93", fontSize: 9, lineHeight: 13 }, studyRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#2B3A41", paddingTop: 8 }, studyActive: { backgroundColor: "#203846", marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 8, borderTopColor: "#5B9DCA" }, studyCopy: { flex: 1, gap: 2 }, studyTitle: { color: "#E6EEF0", fontSize: 10, fontWeight: "800" }, detailGrid: { gap: 8 }, detailRow: { gap: 3, borderTopWidth: 1, borderTopColor: "#2B3A41", paddingTop: 8, marginTop: 2 }, detailTitle: { color: "#E6EEF0", fontSize: 10, fontWeight: "800" }, candidate: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderTopWidth: 1, borderTopColor: "#2B3A41", paddingTop: 8 }, candidateCopy: { flex: 1, gap: 3 }, candidateBadges: { gap: 4, alignItems: "flex-end" }, pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
