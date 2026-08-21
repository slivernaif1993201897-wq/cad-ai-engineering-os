import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { loadProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { trpc } from "@/lib/trpc";

function tone(value?: string) {
  if (["EVIDENCE_LINKED", "CURRENT", "RESOLVED"].includes(value ?? "")) return "#67B39F";
  if (["REJECTED", "STALE", "CONFLICT", "BLOCKED", "FAIL"].includes(value ?? "")) return "#E78966";
  return "#8EC4E8";
}

function Badge({ value }: { value: string }) {
  const color = tone(value);
  return <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{value}</Text></View>;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricHint}>{hint}</Text></View>;
}

export function EngineeringThreadPlanningPanel() {
  const [project, setProject] = useState<StoredProjectAccess>();
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const value = await loadProjectAccess("active-engineering-workbench");
      if (!cancelled && value) setProject(value);
    };
    void hydrate();
    const interval = setInterval(() => void hydrate(), 1_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const access = { projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE" };
  const artifacts = trpc.digitalThread.listArtifacts.useQuery(access, { enabled: Boolean(project) });
  const relations = trpc.digitalThread.listRelations.useQuery(access, { enabled: Boolean(project) });
  const drawings = trpc.planning.listDrawingPackages.useQuery(access, { enabled: Boolean(project) });
  const boms = trpc.planning.listBOMRevisions.useQuery(access, { enabled: Boolean(project) });
  const plm = trpc.planning.listPLMRevisions.useQuery(access, { enabled: Boolean(project) });
  const manufacturing = trpc.planning.listManufacturingPlans.useQuery(access, { enabled: Boolean(project) });

  const refresh = () => {
    void Promise.all([artifacts.refetch(), relations.refetch(), drawings.refetch(), boms.refetch(), plm.refetch(), manufacturing.refetch()]);
  };
  const threadSummary = useMemo(() => {
    const items = artifacts.data ?? [];
    const counted = (kind: string) => items.filter((item) => item.kind === kind).length;
    return [
      { label: "REQUIREMENTS", value: counted("REQUIREMENT_SET"), hint: "immutable sources" },
      { label: "CAD / CAE", value: counted("CAD_MODEL") + counted("CAD_FEATURE") + counted("CAE_PLAN") + counted("CAE_EVIDENCE"), hint: "declared lineage" },
      { label: "PLANNING", value: drawings.data?.length ?? 0 + (boms.data?.length ?? 0) + (manufacturing.data?.length ?? 0), hint: "non-executable" },
      { label: "RELEASE", value: counted("RELEASE_GATE"), hint: "always blocked" },
    ];
  }, [artifacts.data, boms.data?.length, drawings.data?.length, manufacturing.data?.length]);
  const rows = useMemo(() => [
    ...(artifacts.data ?? []).slice(0, 5).map((item) => ({ id: item.artifactId, type: item.kind, title: item.title, revision: item.revision, state: item.state })),
    ...(drawings.data ?? []).slice(0, 2).map((item) => ({ id: item.drawingPackageId, type: "DRAWING_PACKAGE", title: item.title, revision: item.revision, state: item.state })),
    ...(boms.data ?? []).slice(0, 2).map((item) => ({ id: item.bomRevisionId, type: "BOM_REVISION", title: item.title, revision: item.revision, state: item.state })),
    ...(manufacturing.data ?? []).slice(0, 2).map((item) => ({ id: item.manufacturingPlanId, type: "MANUFACTURING_PLAN", title: item.title, revision: item.revision, state: item.state })),
  ], [artifacts.data, boms.data, drawings.data, manufacturing.data]);
  const loading = !project || artifacts.isLoading || drawings.isLoading || boms.isLoading || plm.isLoading || manufacturing.isLoading;

  return <View style={styles.wrap}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}><Text style={styles.kicker}>PHASE 6.12–6.13 · ENGINEERING THREAD</Text><Text style={styles.title}>One immutable view from requirement to a permanently blocked release gate</Text><Text style={styles.copy}>This workspace reads project-scoped lineage and planning evidence. Drawing, BOM, PLM, and manufacturing records are declared planning artifacts—not rendered drawings, released product data, procurement decisions, toolpaths, post-processed machine instructions, manufacturing validation, or certification.</Text></View>
      <Badge value="NON-EXECUTABLE" />
    </View>

    <View style={styles.runtime}><View style={styles.runtimeText}><Text style={styles.kicker}>RUNTIME STATUS</Text><Text style={styles.runtimeTitle}>RUNTIME_DESIGN_NOT_READY</Text><Text style={styles.runtimeCopy}>No solver, mesher, process, shell, filesystem, network, plugin, toolpath, or numerical-result capability is available from this view.</Text></View><Badge value="RELEASE BLOCKED" /></View>

    <View style={styles.metrics}>{threadSummary.map((item) => <Metric key={item.label} {...item} />)}</View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>CROSS-DOMAIN COVERAGE</Text><Text style={styles.cardTitle}>{project ? `${artifacts.data?.length ?? 0} immutable thread artifact(s) · ${relations.data?.length ?? 0} relation(s)` : "Connect an authorized engineering project to inspect records"}</Text></View><Pressable onPress={refresh} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}><Text style={styles.refreshText}>REFRESH</Text></Pressable></View>
      {loading ? <View style={styles.loading}><ActivityIndicator color="#8EC4E8" /><Text style={styles.meta}>Loading only authorized project records…</Text></View> : <FlatList data={rows} scrollEnabled={false} keyExtractor={(item) => `${item.type}-${item.id}`} renderItem={({ item }) => <View style={styles.record}><View style={styles.recordMain}><Text style={styles.recordType}>{item.type.replaceAll("_", " ")}</Text><Text numberOfLines={1} style={styles.recordTitle}>{item.title}</Text><Text style={styles.meta}>REVISION {item.revision}</Text></View><Badge value={item.state} /></View>} ListEmptyComponent={<Text style={styles.meta}>No digital-thread or planning records are available in this project. Nothing is inferred from the surrounding CAD workspace.</Text>} />}
    </View>

    <View style={styles.grid}>
      <View style={styles.card}><Text style={styles.kicker}>DRAWING INTELLIGENCE</Text><Text style={styles.cardTitle}>{drawings.data?.length ?? 0} declared package(s)</Text><Text style={styles.copy}>Views, source-bound dimensions, annotations, GD&amp;T representations, title blocks, and CAD references are preserved. Renderer availability is false; compliance is never inferred.</Text></View>
      <View style={styles.card}><Text style={styles.kicker}>BOM / PLM</Text><Text style={styles.cardTitle}>{boms.data?.length ?? 0} BOM · {plm.data?.length ?? 0} PLM revision(s)</Text><Text style={styles.copy}>Part quantities, sources, revision parents, engineering-change rationale, and review status are retained. Approval and release are not available.</Text></View>
      <View style={styles.card}><Text style={styles.kicker}>MANUFACTURING / CAM</Text><Text style={styles.cardTitle}>{manufacturing.data?.length ?? 0} declared plan(s)</Text><Text style={styles.copy}>DFM/DFA findings, process intent, setup, tooling metadata, and inspection plans stay explicitly unverified. Toolpath, post processor, machine output, and certification remain unavailable.</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hero: { backgroundColor: "#172932", borderWidth: 1, borderColor: "#315063", borderRadius: 14, padding: 14, gap: 12 },
  heroCopy: { gap: 5 },
  kicker: { color: "#9DAEB6", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#F3F1EA", fontSize: 16, lineHeight: 21, fontWeight: "800" },
  copy: { color: "#C8D5D9", fontSize: 10, lineHeight: 15 },
  runtime: { backgroundColor: "#3A2A1C", borderColor: "#73512E", borderWidth: 1, borderRadius: 12, padding: 12, gap: 9 },
  runtimeText: { gap: 3 }, runtimeTitle: { color: "#F6D8C6", fontSize: 12, fontWeight: "800" }, runtimeCopy: { color: "#E7C8B4", fontSize: 10, lineHeight: 14 },
  badge: { alignSelf: "flex-start", borderRadius: 99, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 }, badgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { minWidth: "47%", flexGrow: 1, backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 }, metricLabel: { color: "#7B8A93", fontSize: 8, fontWeight: "800" }, metricValue: { color: "#F3F1EA", fontSize: 19, fontWeight: "900" }, metricHint: { color: "#8EC4E8", fontSize: 8 },
  card: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, cardTitle: { color: "#F3F1EA", fontSize: 12, lineHeight: 17, fontWeight: "800", maxWidth: 245 }, refresh: { borderColor: "#5B9DCA", borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }, refreshText: { color: "#8EC4E8", fontSize: 8, fontWeight: "900" },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }, record: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#2B3A41", paddingTop: 8 }, recordMain: { flex: 1, gap: 2 }, recordType: { color: "#6EA4CA", fontSize: 8, fontWeight: "900" }, recordTitle: { color: "#E6EEF0", fontSize: 10, fontWeight: "700" }, meta: { color: "#7B8A93", fontSize: 9, lineHeight: 13 },
  grid: { gap: 8 }, pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
