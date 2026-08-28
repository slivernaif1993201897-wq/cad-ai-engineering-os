import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { StatusPill } from "@/components/engineering-os-ui";
import { getEngineeringEvidence, getEngineeringJob, getEngineeringJobStatus, getEngineeringMesh, getEngineeringResult, listCrashSafetyEvidence, listPhysicalEngineeringVerifications, loadEngineeringConnection, type EngineeringJobSnapshot } from "@/lib/engineering-api";
import type { PhysicalEngineeringVerificationRecord } from "../../shared/physicalVerification";
import type { CrashSafetyEvidenceRecord } from "../../shared/crashSafety";

type Artifact<T> = { value?: T; error?: string };

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<EngineeringJobSnapshot | null>(null);
  const [mesh, setMesh] = useState<Artifact<{ gmshHash: string; meshHash: string; executionLogHash: string }>>({});
  const [result, setResult] = useState<Artifact<{ calculixHash: string; inputHash: string; outputHash: string; resultHash: string; evidenceHash: string }>>({});
  const [evidence, setEvidence] = useState<Artifact<{ manifestHash?: string; runtimeEvidence: EngineeringJobSnapshot["runtimeEvidence"] }>>({});
  const [physicalVerification, setPhysicalVerification] = useState<Artifact<PhysicalEngineeringVerificationRecord>>({});
  const [crashSafetyEvidence, setCrashSafetyEvidence] = useState<Artifact<CrashSafetyEvidenceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const connection = await loadEngineeringConnection();
    if (!connection) { setError("PROJECT_CONNECTION_REQUIRED"); setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const detail = await getEngineeringJob(connection, jobId);
      setJob(detail);
      const [status, meshResult, solverResult, evidenceResult, physicalVerificationResult, crashSafetyResult] = await Promise.allSettled([
        getEngineeringJobStatus(connection, jobId),
        getEngineeringMesh(connection, jobId),
        getEngineeringResult(connection, jobId),
        getEngineeringEvidence(connection, jobId),
        listPhysicalEngineeringVerifications(connection, jobId),
        listCrashSafetyEvidence(connection),
      ]);
      if (status.status === "fulfilled") setJob((current) => current ? { ...current, state: status.value.state, runtimeDispatch: status.value.runtimeDispatch, events: status.value.events } : current);
      setMesh(meshResult.status === "fulfilled" ? { value: meshResult.value } : { error: meshResult.reason instanceof Error ? meshResult.reason.message : "VERIFIED_RUNTIME_MESH_UNAVAILABLE" });
      setResult(solverResult.status === "fulfilled" ? { value: solverResult.value } : { error: solverResult.reason instanceof Error ? solverResult.reason.message : "VERIFIED_RUNTIME_RESULT_UNAVAILABLE" });
      setEvidence(evidenceResult.status === "fulfilled" ? { value: evidenceResult.value } : { error: evidenceResult.reason instanceof Error ? evidenceResult.reason.message : "VERIFIED_RUNTIME_EVIDENCE_UNAVAILABLE" });
      setPhysicalVerification(physicalVerificationResult.status === "fulfilled" ? physicalVerificationResult.value[0] ? { value: physicalVerificationResult.value[0] } : { error: "PHYSICAL_VERIFICATION_NOT_RECORDED" } : { error: physicalVerificationResult.reason instanceof Error ? physicalVerificationResult.reason.message : "PHYSICAL_VERIFICATION_UNAVAILABLE" });
      const matchingCrashEvidence = crashSafetyResult.status === "fulfilled" ? crashSafetyResult.value.find((record) => record.seatRevisionHash === detail.cad?.revisionHash) : undefined;
      setCrashSafetyEvidence(crashSafetyResult.status === "fulfilled" ? matchingCrashEvidence ? { value: matchingCrashEvidence } : { error: "CRASH_SAFETY_EVIDENCE_NOT_RECORDED_FOR_CAD_REVISION" } : { error: crashSafetyResult.reason instanceof Error ? crashSafetyResult.reason.message : "CRASH_SAFETY_EVIDENCE_UNAVAILABLE" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ENGINEERING_JOB_READ_FAILED"); }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);
  return <ScreenContainer className="px-5"><Stack.Screen options={{ headerShown: false }} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2EC5E8" />}>
      <Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-back" color="#2EC5E8" size={19} /><Text style={styles.backText}>Workspace</Text></Pressable>
      <Text style={styles.eyebrow}>PERSISTED ENGINEERING JOB</Text><Text style={styles.title}>{jobId}</Text>
      {loading && !job ? <ActivityIndicator color="#2EC5E8" /> : null}
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      {job ? <>
        <View style={styles.stateRow}><Text style={styles.state}>{job.state}</Text><StatusPill status={job.runtimeEvidence ? "INTERNAL_RUNTIME_VERIFIED" : "UNKNOWN"} /></View>
        <ExecutionTimeline job={job} meshAvailable={Boolean(mesh.value)} resultAvailable={Boolean(result.value)} evidenceAvailable={Boolean(evidence.value?.runtimeEvidence)} numericalVerified={physicalVerification.value?.levels.numericalVerification === "ACHIEVED"} />
        <Section title="Engineering request" rows={[ ["Runtime admission", `${job.runtimeDispatch?.status ?? "UNKNOWN"} — ${job.runtimeDispatch?.reason ?? "No dispatch record"}` ], ["Requirements", job.requirements?.requirementsId ?? "Unavailable" ], ["CAD revision", job.cad?.revisionHash ?? "Unavailable" ], ["CAD artifact", job.cad?.artifactHash ?? "Unavailable" ], ["CAE configuration", job.cae?.configurationHash ?? "Unavailable" ], ["Manifest", job.manifest?.manifestHash ?? "Unavailable" ]]} />
        <Section title="Mesh verification" rows={mesh.value ? [["Gmsh", mesh.value.gmshHash], ["Mesh", mesh.value.meshHash], ["Execution log", mesh.value.executionLogHash]] : [["Availability", mesh.error ?? "VERIFIED_RUNTIME_MESH_UNAVAILABLE"]]} />
        <Section title="CalculiX and numerical result" rows={result.value ? [["CalculiX", result.value.calculixHash], ["Input", result.value.inputHash], ["Output", result.value.outputHash], ["Result", result.value.resultHash]] : [["Availability", result.error ?? "VERIFIED_RUNTIME_RESULT_UNAVAILABLE"]]} />
        <Section title="Evidence binding" rows={evidence.value ? [["Manifest", evidence.value.manifestHash ?? "Unavailable"], ["Evidence", evidence.value.runtimeEvidence?.evidenceHash ?? "Unavailable"], ["Environment", evidence.value.runtimeEvidence?.environmentIdentity ?? "Unavailable"]] : [["Availability", evidence.error ?? "VERIFIED_RUNTIME_EVIDENCE_UNAVAILABLE"]]} />
        <Section title="Physical verification and claim boundary" rows={physicalVerification.value ? [["Classification", physicalVerification.value.classification], ["Computation", physicalVerification.value.levels.computation], ["Numerical verification", physicalVerification.value.levels.numericalVerification], ["Model validation", physicalVerification.value.levels.modelValidation], ["Experimental correlation", physicalVerification.value.levels.experimentalCorrelation], ["Engineering acceptance", physicalVerification.value.levels.engineeringAcceptance], ["Regulatory certification", physicalVerification.value.levels.regulatoryCertification], ["Verification hash", physicalVerification.value.verificationHash]] : [["Availability", physicalVerification.error ?? "PHYSICAL_VERIFICATION_NOT_RECORDED"], ["Claim boundary", "A runtime result alone is not a numerical, physical, safety, acceptance, or regulatory claim."]]} />
        <Section title="Crash and occupant safety evidence" rows={crashSafetyEvidence.value ? [["Requirement", crashSafetyEvidence.value.requirement.requirementId], ["Pulse", `${crashSafetyEvidence.value.crashPulse.pulseId} — ${crashSafetyEvidence.value.crashPulse.sourceKind}`], ["Physical validation", crashSafetyEvidence.value.validationArchitecture.physicalValidation], ["Certification", crashSafetyEvidence.value.certificationStatus], ["Evidence hash", crashSafetyEvidence.value.evidenceHash], ["Claim boundary", crashSafetyEvidence.value.claimBoundary]] : [["Availability", crashSafetyEvidence.error ?? "CRASH_SAFETY_EVIDENCE_NOT_RECORDED_FOR_CAD_REVISION"], ["Claim boundary", "No crashworthiness, occupant-safety, physical-validation, or certification claim is inferred from runtime execution."]]} />
        <Section title="Lifecycle events" rows={(job.events ?? []).map((event) => [event.state, `${event.createdAt} — ${event.reason}`])} />
      </> : null}
    </ScrollView>
  </ScreenContainer>;
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{rows.length ? rows.map(([label, value]) => <View key={`${label}-${value}`} style={styles.row}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View>) : <Text style={styles.value}>No persisted events.</Text>}</View>; }
function ExecutionTimeline({ job, meshAvailable, resultAvailable, evidenceAvailable, numericalVerified }: { job: EngineeringJobSnapshot; meshAvailable: boolean; resultAvailable: boolean; evidenceAvailable: boolean; numericalVerified: boolean }) {
  const admission = job.runtimeDispatch?.status === "ADMITTED" || job.runtimeDispatch?.status === "DISPATCHED";
  const stages = [["Created", true], ["Admission", admission], ["Mesh", meshAvailable], ["Solver", resultAvailable], ["Numerical", numericalVerified], ["Evidence", evidenceAvailable]] as const;
  return <View style={styles.timeline}><View><Text style={styles.timelineEyebrow}>EXECUTION TIMELINE</Text><Text style={styles.timelineTitle}>Authoritative runtime state</Text></View><View style={styles.timelineStages}>{stages.map(([label, available], index) => <View key={label} style={styles.timelineStage}><View style={[styles.timelineDot, available ? styles.timelineDotActive : styles.timelineDotBlocked]}>{available ? <MaterialIcons color="#071522" name="check" size={11} /> : <MaterialIcons color="#B7CCDA" name="remove" size={11} />}</View>{index < stages.length - 1 ? <View style={[styles.timelineLine, available && styles.timelineLineActive]} /> : null}<Text style={[styles.timelineLabel, available ? styles.timelineLabelActive : styles.timelineLabelBlocked]}>{label}</Text></View>)}</View><Text style={styles.timelineNote}>{job.runtimeDispatch?.reason ?? "No runtime admission record is available."}</Text></View>;
}
const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 36, paddingTop: 20 }, back: { alignItems: "center", flexDirection: "row", gap: 7 }, backText: { color: "#2EC5E8", fontWeight: "800" }, eyebrow: { color: "#2EC5E8", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 8 }, title: { color: "#E7F0F6", fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }, stateRow: { alignItems: "center", backgroundColor: "#10263A", borderColor: "#1B3B53", borderRadius: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 14 }, state: { color: "#E7F0F6", fontSize: 16, fontWeight: "800" }, timeline: { backgroundColor: "#0B2030", borderColor: "#1B526A", borderRadius: 16, borderWidth: 1, gap: 11, padding: 14 }, timelineEyebrow: { color: "#72D8EF", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, timelineTitle: { color: "#E7F0F6", fontSize: 15, fontWeight: "800", marginTop: 3 }, timelineStages: { flexDirection: "row", justifyContent: "space-between" }, timelineStage: { alignItems: "center", flex: 1, position: "relative" }, timelineDot: { alignItems: "center", borderRadius: 10, height: 20, justifyContent: "center", width: 20, zIndex: 1 }, timelineDotActive: { backgroundColor: "#59D8B8" }, timelineDotBlocked: { backgroundColor: "#263946" }, timelineLine: { backgroundColor: "#263946", height: 2, left: "50%", position: "absolute", top: 9, width: "100%" }, timelineLineActive: { backgroundColor: "#59D8B8" }, timelineLabel: { fontSize: 9, fontWeight: "800", marginTop: 5, textAlign: "center" }, timelineLabelActive: { color: "#8BE4CE" }, timelineLabelBlocked: { color: "#8BA4B8" }, timelineNote: { color: "#A9C0D0", fontSize: 11, lineHeight: 16 }, section: { backgroundColor: "#0E2436", borderColor: "#1B3B53", borderRadius: 16, borderWidth: 1, padding: 14 }, sectionTitle: { color: "#E7F0F6", fontSize: 16, fontWeight: "800", marginBottom: 8 }, row: { borderTopColor: "#1B3B53", borderTopWidth: 1, gap: 4, paddingVertical: 10 }, label: { color: "#8BA4B8", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }, value: { color: "#C8D9E5", fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, error: { backgroundColor: "#3A1E29", borderLeftColor: "#EE7984", borderLeftWidth: 3, borderRadius: 10, padding: 12 }, errorText: { color: "#F6C9CF", fontWeight: "700" } });
