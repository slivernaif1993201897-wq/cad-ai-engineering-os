import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/engineering-os-ui";
import { getApiBaseUrl } from "@/constants/oauth";
import {
  clearEngineeringConnection,
  createEngineeringProject,
  getEngineeringResult,
  healthCheckEngineeringApi,
  listEngineeringJobs,
  loadEngineeringConnection,
  normalizeEngineeringApiBaseUrl,
  submitMountingBlockRequest,
  type EngineeringConnection,
  type EngineeringJobSnapshot,
} from "@/lib/engineering-api";

type Notice = { tone: "error" | "info" | "success"; text: string } | null;

export default function WorkspaceScreen() {
  const [connection, setConnection] = useState<EngineeringConnection | null>(null);
  const [projectName, setProjectName] = useState("Engineering Project");
  const [jobs, setJobs] = useState<EngineeringJobSnapshot[]>([]);
  const [selected, setSelected] = useState<EngineeringJobSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const refresh = useCallback(async (active = connection) => {
    if (!active) return;
    try {
      setJobs(await listEngineeringJobs(active));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "PROJECT_READ_FAILED" });
    }
  }, [connection]);

  useEffect(() => {
    loadEngineeringConnection().then(async (stored) => {
      setConnection(stored);
      if (stored) await refresh(stored);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [refresh]);

  const status = useMemo(() => selected?.runtimeEvidence ? "INTERNAL_RUNTIME_VERIFIED" as const : connection ? "UNKNOWN" as const : "NOT_CONNECTED" as const, [connection, selected]);

  async function connectOrCreate() {
    const normalized = normalizeEngineeringApiBaseUrl(getApiBaseUrl());
    if (!normalized) return setNotice({ tone: "error", text: "CONNECTION_PROBLEM" });
    try {
      setSubmitting(true);
      const health = await healthCheckEngineeringApi(normalized);
      if (!health.ok) throw new Error("ENGINEERING_API_HEALTHCHECK_FAILED");
      const created = await createEngineeringProject(normalized, projectName.trim());
      setConnection(created);
      setNotice({ tone: "success", text: "Project created. You can now design a seat or review project work." });
      await refresh(created);
    } catch {
      setNotice({ tone: "error", text: "Unable to create the project. Retry when the connection is available." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (!connection) return;
    try {
      setSubmitting(true);
      const job = await submitMountingBlockRequest(connection, { name: "Mobile mounting block", width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3 });
      setSelected(job);
      await refresh();
      setNotice({ tone: "success", text: "CANONICAL_JOB_ADMITTED_TO_RUNTIME_BOUNDARY" });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "ENGINEERING_REQUEST_REJECTED" });
    } finally {
      setSubmitting(false);
    }
  }

  async function inspectResult(job: EngineeringJobSnapshot) {
    if (!connection) return;
    try {
      const result = await getEngineeringResult(connection, job.jobId);
      setNotice({ tone: "success", text: `VERIFIED_RESULT_AVAILABLE ${result.resultHash.slice(0, 12)}…` });
    } catch (error) {
      setNotice({ tone: "info", text: error instanceof Error ? error.message : "VERIFIED_RUNTIME_RESULT_UNAVAILABLE" });
    }
  }

  if (loading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#2EC5E8" /></ScreenContainer>;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={connection ? jobs : []}
        keyExtractor={(item) => item.jobId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh()} tintColor="#2EC5E8" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Text style={styles.eyebrow}>PROJECT WORKSPACE</Text>
            <View style={styles.titleRow}><Text style={styles.title}>{connection ? connection.projectName : "Create your first project"}</Text><StatusPill status={status} /></View>
            <Text style={styles.description}>{connection ? "Choose a project action or monitor persisted engineering jobs." : "Start with a project name. The configured engineering service connects automatically."}</Text>
            {notice ? <View style={[styles.notice, notice.tone === "error" && styles.noticeError, notice.tone === "success" && styles.noticeSuccess]}><Text style={styles.noticeText}>{notice.text}</Text></View> : null}
            {!connection ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Welcome to your engineering workspace</Text>
                <Text style={styles.cardText}>Create a project to organize Seat Designs, CAD revisions, analysis packages, engineering jobs, reports, and evidence.</Text>
                <TextInput value={projectName} onChangeText={setProjectName} placeholder="Project name" placeholderTextColor="#617B91" style={styles.input} accessibilityLabel="Project name" />
                <PrimaryButton loading={submitting} label="Create project" icon="add-business" onPress={connectOrCreate} />
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.projectRow}><View><Text style={styles.cardTitle}>{connection.projectName}</Text><Text style={styles.endpoint}>{connection.apiBaseUrl}</Text></View><Pressable onPress={async () => { await clearEngineeringConnection(); setConnection(null); setJobs([]); setSelected(null); }} accessibilityLabel="Disconnect engineering project"><MaterialIcons color="#B7CCDA" name="link-off" size={22} /></Pressable></View>
                <Text style={styles.cardText}>Project work is stored securely. Engineering jobs show evidence only after authoritative runtime reconciliation.</Text>
                <PrimaryButton loading={submitting} label="Create engineering job" icon="precision-manufacturing" onPress={submit} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={connection ? <EmptyState /> : null}
        renderItem={({ item }) => <JobCard job={item} selected={selected?.jobId === item.jobId} onPress={() => { setSelected(item); router.push(`/job/${item.jobId}` as never); }} onResult={() => inspectResult(item)} />}
      />
    </ScreenContainer>
  );
}

function PrimaryButton({ label, icon, loading, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; loading: boolean; onPress: () => void }) {
  return <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]} accessibilityRole="button"><Text style={styles.buttonText}>{loading ? "Working…" : label}</Text>{loading ? <ActivityIndicator color="#081827" /> : <MaterialIcons color="#081827" name={icon} size={19} />}</Pressable>;
}

function EmptyState() { return <View style={styles.empty}><MaterialIcons color="#6A8AA2" name="engineering" size={30} /><Text style={styles.emptyTitle}>No engineering jobs</Text><Text style={styles.emptyText}>Submit a validated request to create a canonical job. Runtime artifacts remain unavailable until independently verified evidence is reconciled.</Text></View>; }

function JobCard({ job, selected, onPress, onResult }: { job: EngineeringJobSnapshot; selected: boolean; onPress: () => void; onResult: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.jobCard, selected && styles.jobSelected, pressed && styles.pressed]} accessibilityRole="button">
    <View style={styles.jobHeader}><View style={{ flex: 1 }}><Text style={styles.jobId}>{job.jobId}</Text><Text style={styles.jobState}>{job.state}</Text></View><MaterialIcons color="#2EC5E8" name="chevron-right" size={23} /></View>
    <Text style={styles.hash}>CAD {job.cad?.artifactHash?.slice(0, 16) ?? "unavailable"}…</Text>
    <Text style={styles.hash}>CAE {job.cae?.configurationHash?.slice(0, 16) ?? "unavailable"}…</Text>
    <Text style={styles.dispatch}>{job.runtimeEvidence ? "Verified runtime evidence reconciled" : job.runtimeDispatch?.reason ?? "No runtime state available"}</Text>
    <Pressable onPress={onResult} style={({ pressed }) => [styles.resultButton, pressed && styles.pressed]} accessibilityRole="button"><Text style={styles.resultText}>Inspect verified result</Text><MaterialIcons color="#2EC5E8" name="verified" size={17} /></Pressable>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { alignItems: "center", backgroundColor: "#2EC5E8", borderRadius: 15, flexDirection: "row", justifyContent: "space-between", marginTop: 12, minHeight: 50, paddingHorizontal: 16 },
  buttonText: { color: "#081827", fontSize: 15, fontWeight: "800" },
  card: { backgroundColor: "#10263A", borderColor: "#1B3B53", borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  cardText: { color: "#A9C0D0", fontSize: 13, lineHeight: 19 },
  cardTitle: { color: "#E7F0F6", fontSize: 18, fontWeight: "800" },
  content: { gap: 12, paddingBottom: 32, paddingTop: 18 },
  description: { color: "#B7CCDA", fontSize: 14, lineHeight: 20 },
  dispatch: { color: "#8BA4B8", fontSize: 12, lineHeight: 17, marginTop: 9 },
  empty: { alignItems: "center", borderColor: "#1B3B53", borderRadius: 20, borderStyle: "dashed", borderWidth: 1, gap: 8, padding: 28 },
  emptyText: { color: "#8BA4B8", fontSize: 13, lineHeight: 19, textAlign: "center" },
  emptyTitle: { color: "#D5E2EB", fontSize: 16, fontWeight: "800" },
  endpoint: { color: "#6A8AA2", fontSize: 12, marginTop: 4 },
  eyebrow: { color: "#2EC5E8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  hash: { color: "#A9C0D0", fontFamily: "monospace", fontSize: 11, marginTop: 4 },
  headerStack: { gap: 14, marginBottom: 4 },
  input: { backgroundColor: "#0B1D2D", borderColor: "#285470", borderRadius: 12, borderWidth: 1, color: "#E7F0F6", fontSize: 14, minHeight: 47, paddingHorizontal: 13 },
  jobCard: { backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 18, borderWidth: 1, padding: 15 },
  jobHeader: { alignItems: "center", flexDirection: "row" },
  jobId: { color: "#D5E2EB", fontSize: 14, fontWeight: "800" },
  jobSelected: { borderColor: "#2EC5E8" },
  jobState: { color: "#2EC5E8", fontSize: 12, fontWeight: "800", marginTop: 4 },
  notice: { backgroundColor: "#153348", borderLeftColor: "#2EC5E8", borderLeftWidth: 3, borderRadius: 12, padding: 11 },
  noticeError: { backgroundColor: "#3A1E29", borderLeftColor: "#EE7984" },
  noticeSuccess: { backgroundColor: "#123D39", borderLeftColor: "#59D8B8" },
  noticeText: { color: "#D5E2EB", fontSize: 12, fontWeight: "700", lineHeight: 17 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  projectRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  resultButton: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 13 },
  resultText: { color: "#2EC5E8", fontSize: 13, fontWeight: "800" },
  title: { color: "#E7F0F6", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
