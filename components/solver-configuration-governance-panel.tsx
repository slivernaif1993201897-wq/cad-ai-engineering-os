import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loadProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { trpc } from "@/lib/trpc";

function tone(value?: string) {
  if (["ACTIVE", "VERIFIED", "VALID", "FRESH", "REVIEWED", "UNCHANGED"].includes(value ?? "")) return "#62B39A";
  if (["EXPIRED", "REVOKED", "REPLACED", "CONFLICT", "STALE", "INVALID", "FAIL", "CHANGED"].includes(value ?? "")) return "#E78966";
  return "#8EC4E8";
}

function Badge({ value }: { value: string }) {
  const color = tone(value);
  return <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{value}</Text></View>;
}

function Detail({ label, value }: { label: string; value?: string | number | boolean }) {
  return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text numberOfLines={3} style={styles.detailValue}>{value === undefined ? "UNKNOWN" : String(value)}</Text></View>;
}

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

export function SolverConfigurationGovernancePanel() {
  const [project, setProject] = useState<StoredProjectAccess>();
  const [baselinePackageId, setBaselinePackageId] = useState("");
  const [comparedPackageId, setComparedPackageId] = useState("");
  const [diffSummary, setDiffSummary] = useState<string>();
  const [graphSummary, setGraphSummary] = useState<string>();

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
  const verifications = trpc.cae.listMeshQualityVerifications.useQuery(access, { enabled: Boolean(project) });
  const lifecycle = trpc.cae.listMeshQualityVerificationLifecycle.useQuery(access, { enabled: Boolean(project) });
  const reassignments = trpc.cae.listMeshQualityReviewerReassignments.useQuery(access, { enabled: Boolean(project) });
  const packages = trpc.cae.listSolverInputPackages.useQuery(access, { enabled: Boolean(project) });
  const registry = trpc.cae.listSolverConfigurationRegistry.useQuery(access, { enabled: Boolean(project) });
  const diff = trpc.cae.createSolverInputPackageDiff.useMutation();
  const graph = trpc.cae.solverConfigurationGovernanceGraph.useMutation();

  const pair = useMemo(() => {
    const items = packages.data ?? [];
    return {
      baseline: baselinePackageId || items[0]?.packageId || "",
      compared: comparedPackageId || items[1]?.packageId || items[0]?.packageId || "",
    };
  }, [baselinePackageId, comparedPackageId, packages.data]);
  const selectedPackage = packages.data?.find((item) => item.packageId === pair.baseline) ?? packages.data?.[0];
  const selectedConfiguration = registry.data?.[0];

  const inspectDiff = () => {
    if (!pair.baseline || !pair.compared) return;
    diff.mutate({ ...access, baselinePackageId: pair.baseline, comparedPackageId: pair.compared }, {
      onSuccess: (value) => {
        const counts = value.entries.reduce<Record<string, number>>((accumulator, entry) => ({ ...accumulator, [entry.status]: (accumulator[entry.status] ?? 0) + 1 }), {});
        setDiffSummary(`${value.diffId} · ${Object.entries(counts).map(([status, count]) => `${status} ${count}`).join(" · ")}`);
      },
      onError: (error) => setDiffSummary(error.message),
    });
  };

  const inspectGraph = () => {
    if (!selectedPackage || !selectedConfiguration) return;
    graph.mutate({ ...access, packageId: selectedPackage.packageId, configurationId: selectedConfiguration.configurationId }, {
      onSuccess: (value) => setGraphSummary(`${value.nodes.length} nodes · ${value.edges.length} links · ${value.limitations[0] ?? "No limitations reported."}`),
      onError: (error) => setGraphSummary(error.message),
    });
  };

  return <View style={styles.wrap}>
    <View style={styles.hero}>
      <View style={styles.heroText}><Text style={styles.kicker}>PHASE 6.8 · SOLVER CONFIGURATION GOVERNANCE</Text><Text style={styles.title}>Verification validity, package diffs, and bounded configuration schema</Text><Text style={styles.copy}>This read-only inspector preserves immutable historical evidence. It cannot generate solver input, modify a package, renew a verification, invoke a mesher, run a solver, spawn a process, access the filesystem or network, or present numerical results.</Text></View>
      <Badge value="NON-EXECUTABLE" />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>VERIFICATION HISTORY</Text><Text style={styles.value}>Immutable lifecycle events</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={lifecycle.data ?? []}
        keyExtractor={(item) => item.eventId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No lifecycle events are recorded. The absence of a lifecycle event is not a claim of current validity; this inspector never renews evidence.</Text>}
        renderItem={({ item }) => {
          const verification = verifications.data?.find((candidate) => candidate.verificationId === item.verificationId);
          return <View style={styles.listItem}><View style={styles.row}><Text style={styles.itemTitle}>{item.verificationId}</Text><Badge value={item.newState} /></View><Detail label="TRANSITION" value={`${item.previousState} → ${item.newState}`} /><Detail label="ACTOR / AUTHORIZATION" value={`${item.actor} · ${item.authorization}`} /><Detail label="REASON / TIME" value={`${item.reason} · ${dateLabel(item.timestamp)}`} /><Text style={styles.meta}>Original verification: {verification?.status ?? "UNKNOWN"} · historical event retained permanently.</Text></View>;
        }}
      />
      <Text style={styles.meta}>EXPIRED, REVOKED, and REPLACED evidence is never treated as valid. A new independent verification must create a new immutable record; no event can silently reactivate historical evidence.</Text>
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>REVIEWER ASSIGNMENT</Text><Text style={styles.value}>Authorized reassignment history</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={reassignments.data ?? []}
        keyExtractor={(item) => item.reassignmentId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No reviewer reassignment is recorded. This panel does not assign or approve a reviewer.</Text>}
        renderItem={({ item }) => <View style={styles.listItem}><View style={styles.row}><Text style={styles.itemTitle}>{item.verificationId}</Text><Badge value={item.newState} /></View><Detail label="REVIEWER CHANGE" value={`${item.originalReviewer} → ${item.newReviewer}`} /><Detail label="AUTHORIZATION" value={item.authorization} /><Detail label="REASON / TIME" value={`${item.reason} · ${dateLabel(item.timestamp)}`} /><Text style={styles.meta}>Self-review and unauthorized reassignment are prohibited. The original reviewer record remains historical evidence.</Text></View>}
      />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>MANIFEST DIFF</Text><Text style={styles.value}>Deterministic 14-field comparison</Text></View><Badge value="READ-ONLY" /></View>
      <TextInput value={baselinePackageId} onChangeText={setBaselinePackageId} style={styles.input} placeholder={`Baseline package · ${packages.data?.[0]?.packageId ?? "none available"}`} placeholderTextColor="#77909A" autoCapitalize="characters" />
      <TextInput value={comparedPackageId} onChangeText={setComparedPackageId} style={styles.input} placeholder={`Compared package · ${packages.data?.[1]?.packageId ?? packages.data?.[0]?.packageId ?? "none available"}`} placeholderTextColor="#77909A" autoCapitalize="characters" />
      <Pressable disabled={!pair.baseline || !pair.compared || diff.isPending} onPress={inspectDiff} style={({ pressed }) => [styles.inspect, (!pair.baseline || !pair.compared || diff.isPending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.inspectText}>{diff.isPending ? "COMPARING…" : "INSPECT IMMUTABLE PACKAGE DIFF"}</Text></Pressable>
      {diff.data ? <FlatList data={diff.data.entries} keyExtractor={(item) => item.field} scrollEnabled={false} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.listItem}><View style={styles.row}><Text style={styles.itemTitle}>{item.field}</Text><Badge value={item.status} /></View><Detail label="BEFORE" value={item.before} /><Detail label="AFTER" value={item.after} /><Text style={styles.meta}>{item.reason}</Text></View>} /> : <Text style={styles.meta}>Select existing immutable packages only. The diff never edits either package and never writes any solver input.</Text>}
      {diffSummary ? <Text style={styles.meta}>{diffSummary}</Text> : null}
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>SOLVER CONFIGURATION REGISTRY</Text><Text style={styles.value}>Schema descriptions, not executable adapters</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={registry.data ?? []}
        keyExtractor={(item) => item.configurationId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No configuration schema is registered. This interface will not synthesize a solver setting, schema, command, executable path, credential, environment secret, or network instruction.</Text>}
        renderItem={({ item }) => <View style={styles.listItem}><View style={styles.row}><View style={styles.flex}><Text style={styles.itemTitle}>{item.solverName} · {item.solverVersion}</Text><Text style={styles.meta}>{item.configurationId} · schema {item.configurationSchemaVersion}</Text></View><Badge value={item.status} /></View><Detail label="ANALYSIS / PARAMETERS" value={`${item.analysisType} · ${item.supportedParameters.length} bounded parameter(s)`} /><Detail label="PARAMETER SUMMARY" value={item.supportedParameters.slice(0, 5).map((parameter) => `${parameter.name}:${parameter.type}${parameter.unit ? ` ${parameter.unit}` : ""}`).join(" · ") || "No parameters"} /><Detail label="EVIDENCE" value={item.evidenceHashes.join(" · ")} /><Text style={styles.meta}>Security boundary prohibits shell commands, executable paths, process spawning, filesystem execution, network commands, credentials, and secret environment variables. executable={String(item.securityBoundary.executable)}</Text></View>}
      />
      <View style={styles.traceBox}><Text style={styles.kicker}>TRACEABILITY & STALENESS INSPECTION</Text><Text style={styles.copy}>CAE Job → immutable Solver Input Package → declared configuration → mesh verification evidence. Staleness and graph inspection only report evidence; they do not refresh, modify, or execute any artifact.</Text><Pressable disabled={!selectedPackage || !selectedConfiguration || graph.isPending} onPress={inspectGraph} style={({ pressed }) => [styles.inspect, (!selectedPackage || !selectedConfiguration || graph.isPending) && styles.disabled, pressed && styles.pressed]}><Text style={styles.inspectText}>{graph.isPending ? "INSPECTING…" : "INSPECT GOVERNANCE TRACEABILITY"}</Text></Pressable>{graphSummary ? <Text style={styles.meta}>{graphSummary}</Text> : null}</View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 }, hero: { backgroundColor: "#1A2933", borderWidth: 1, borderColor: "#2F4652", borderRadius: 14, padding: 14, flexDirection: "row", gap: 10 }, heroText: { flex: 1 }, kicker: { color: "#8EC4E8", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 }, title: { color: "#F3F1EA", fontSize: 15, fontWeight: "900", marginTop: 4 }, copy: { color: "#D7E0E3", fontSize: 10, lineHeight: 15, marginTop: 6 }, meta: { color: "#90A0A8", fontSize: 9, lineHeight: 14, marginTop: 5 }, value: { color: "#F3F1EA", fontSize: 11, fontWeight: "900", marginTop: 4 }, card: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, flex: { flex: 1 }, badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start" }, badgeText: { fontSize: 8, fontWeight: "900" }, list: { gap: 7, marginTop: 3 }, listItem: { backgroundColor: "#152129", borderColor: "#314752", borderWidth: 1, borderRadius: 9, padding: 9, gap: 2 }, itemTitle: { color: "#E4EBED", fontSize: 10, fontWeight: "900", flexShrink: 1 }, detail: { marginTop: 3, gap: 2 }, label: { color: "#9DAEB6", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 }, detailValue: { color: "#D7E0E3", fontSize: 9, lineHeight: 13 }, input: { color: "#E4EBED", backgroundColor: "#101B21", borderColor: "#36505C", borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7, fontSize: 10 }, inspect: { marginTop: 4, borderColor: "#5B9DCA", borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, alignSelf: "flex-start" }, inspectText: { color: "#8EC4E8", fontSize: 8, fontWeight: "900" }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, traceBox: { backgroundColor: "#101B21", borderColor: "#36505C", borderWidth: 1, borderRadius: 9, padding: 9, marginTop: 4 },
});
