import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { loadProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { trpc } from "@/lib/trpc";

function tone(value?: string) {
  if (["PASS", "CURRENT", "APPROVED", "RESOLVED"].includes(value ?? "")) return "#62B39A";
  if (["FAIL", "EXPIRED", "REVOKED", "CONFLICT", "REJECTED", "ORPHANED"].includes(value ?? "")) return "#E78966";
  return "#8EC4E8";
}

function Badge({ value }: { value: string }) {
  const color = tone(value);
  return <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{value}</Text></View>;
}

function Detail({ label, value }: { label: string; value?: string | number | boolean }) {
  return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text numberOfLines={3} style={styles.detailValue}>{value === undefined ? "UNKNOWN" : String(value)}</Text></View>;
}

function dateLabel(value?: string) {
  if (!value) return "UNKNOWN";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function SecurityEvidenceFoundationPanel() {
  const [project, setProject] = useState<StoredProjectAccess>();
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => { const stored = await loadProjectAccess("active-engineering-workbench"); if (!cancelled && stored) setProject(stored); };
    void hydrate();
    const interval = setInterval(() => void hydrate(), 1_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const access = { projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE" };
  const rubrics = trpc.cae.listSandboxAttestationRubrics.useQuery(access, { enabled: Boolean(project) });
  const attestations = trpc.cae.listSandboxSecurityAttestations.useQuery(access, { enabled: Boolean(project) });
  const artifacts = trpc.cae.listArtifactSBOMReviews.useQuery(access, { enabled: Boolean(project) });
  const hostileEvidence = trpc.cae.listSecurityHostileTestEvidence.useQuery(access, { enabled: Boolean(project) });
  const lifecycle = trpc.cae.listSecurityEvidenceLifecycle.useQuery(access, { enabled: Boolean(project) });
  const conflicts = trpc.cae.listSecurityEvidenceConflicts.useQuery(access, { enabled: Boolean(project) });

  return <View style={styles.wrap}>
    <View style={styles.hero}>
      <View style={styles.flex}><Text style={styles.kicker}>PHASE 6.11 · SECURITY EVIDENCE FOUNDATION</Text><Text style={styles.title}>Attestation, artifact/SBOM, and hostile-test evidence</Text><Text style={styles.copy}>These are immutable evidence records for a future review process. This inspector cannot build or run a sandbox, execute hostile tests, run a solver or mesher, spawn a process, access the filesystem or network, or create numerical results.</Text></View><Badge value="NON-EXECUTABLE" />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>SANDBOX ATTESTATION</Text><Text style={styles.value}>15 mandatory evidence controls</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={attestations.data ?? []}
        keyExtractor={(item) => item.attestationEvidenceId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No attestation evidence is recorded. All sandbox controls therefore remain UNKNOWN; no control is treated as PASS without evidence.</Text>}
        renderItem={({ item }) => {
          const passCount = item.controlAssessments.filter((control) => control.state === "PASS").length;
          const rubric = rubrics.data?.find((candidate) => candidate.rubricId === item.rubricId);
          return <View style={styles.listItem}><View style={styles.row}><Text style={styles.itemTitle}>{item.attestationSubject}</Text><Badge value={item.status} /></View><Detail label="SCOPE / ATTESTOR" value={`${item.attestationScope} · ${item.attestorIdentity}`} /><Detail label="VALIDITY / REVOCATION" value={`${dateLabel(item.validFrom)} → ${dateLabel(item.validUntil)} · ${item.revocationState}`} /><Detail label="CONTROL COVERAGE" value={`${passCount}/${item.controlAssessments.length} PASS · rubric ${rubric ? "RESOLVED" : "UNKNOWN"}`} /><Detail label="INDEPENDENCE" value={`${item.independence} · self-review required=${String(item.selfAttestationReviewRequired)}`} /><Text style={styles.meta}>A PASS evidence state does not enable execution. The attestation remains declarative until future independent verification and readiness gates are separately satisfied.</Text></View>;
        }}
      />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>ARTIFACT / SBOM REVIEW</Text><Text style={styles.value}>Future executable artifacts remain unapproved by registration</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={artifacts.data ?? []}
        keyExtractor={(item) => item.artifactReviewId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No artifact or SBOM review exists. A registered artifact cannot become executable, trusted, or approved by absence of evidence.</Text>}
        renderItem={({ item }) => <View style={styles.listItem}><View style={styles.row}><View style={styles.flex}><Text style={styles.itemTitle}>{item.artifactIdentity} · {item.artifactVersion}</Text><Text style={styles.meta}>{item.artifactReviewId}</Text></View><Badge value={item.reviewStatus} /></View><Detail label="ARTIFACT / SBOM HASH" value={`${item.artifactHash} · ${item.sbomHash}`} /><Detail label="PUBLISHER / LICENSE" value={`${item.publisher} · ${item.license}`} /><Detail label="DEPENDENCIES / VULNERABILITIES" value={`${item.dependencies.length} dependency record(s) · ${item.knownVulnerabilities.length} declared vulnerability item(s)`} /><Detail label="VALIDITY / REVOCATION" value={`${dateLabel(item.reviewValidFrom)} → ${dateLabel(item.reviewValidUntil)} · ${item.revocationState}`} /><Text style={styles.meta}>registrationDoesNotAuthorizeExecution={String(item.registrationDoesNotAuthorizeExecution)} · executable={String(item.executable)}</Text></View>}
      />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>HOSTILE-TEST EVIDENCE</Text><Text style={styles.value}>Bounded evidence declarations; tests are not run here</Text></View><Badge value="NON-EXECUTABLE" /></View>
      <FlatList
        data={hostileEvidence.data ?? []}
        keyExtractor={(item) => item.hostileTestEvidenceId}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.meta}>No hostile-test evidence is recorded. No hostile test has been started, and no missing evidence is converted into a PASS claim.</Text>}
        renderItem={({ item }) => <View style={styles.listItem}><View style={styles.row}><Text style={styles.itemTitle}>{item.testCategory}</Text><Badge value={item.result} /></View><Detail label="TEST / ENVIRONMENT" value={`${item.testId} · ${item.environmentIdentity}`} /><Detail label="EVIDENCE IDENTITY" value={`${item.testInputHash} · ${item.rawEvidenceHash}`} /><Detail label="REVIEWER / AUTHORIZATION" value={`${item.reviewerId} · ${item.reviewerAuthorizationId}`} /><Detail label="REPRODUCIBILITY" value={`${item.reproducibilityInformation.length} declared item(s) · limitations ${item.limitations.length}`} /><Text style={styles.meta}>actualTestExecutionClaimed={String(item.actualTestExecutionClaimed)} · this record does not prove a test was executed by CAD-AI.</Text></View>}
      />
    </View>

    <View style={styles.card}>
      <View style={styles.row}><View><Text style={styles.kicker}>EVIDENCE LIFECYCLE & CONFLICTS</Text><Text style={styles.value}>Historical states are retained; no silent renewal</Text></View><Badge value={conflicts.data?.length ? "CONFLICT" : "UNKNOWN"} /></View>
      <Text style={styles.meta}>Lifecycle events: {lifecycle.data?.length ?? 0} · conflict records: {conflicts.data?.length ?? 0}. EXPIRED, REVOKED, and CONFLICT evidence cannot be silently reused. RUNTIME_DESIGN_NOT_READY remains unchanged.</Text>
      {conflicts.data?.slice(0, 2).map((item) => <View key={item.conflictId} style={styles.conflict}><Text style={styles.itemTitle}>{item.subjectType} · {item.field}</Text><Text style={styles.meta}>{item.reason}</Text></View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 }, hero: { backgroundColor: "#1A2933", borderWidth: 1, borderColor: "#2F4652", borderRadius: 14, padding: 14, flexDirection: "row", gap: 10 }, flex: { flex: 1 }, kicker: { color: "#8EC4E8", fontSize: 8, fontWeight: "900", letterSpacing: 0.9 }, title: { color: "#F3F1EA", fontSize: 15, fontWeight: "900", marginTop: 4 }, copy: { color: "#D7E0E3", fontSize: 10, lineHeight: 15, marginTop: 6 }, meta: { color: "#90A0A8", fontSize: 9, lineHeight: 14, marginTop: 5 }, value: { color: "#F3F1EA", fontSize: 11, fontWeight: "900", marginTop: 4 }, card: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start" }, badgeText: { fontSize: 8, fontWeight: "900" }, list: { gap: 7, marginTop: 3 }, listItem: { backgroundColor: "#152129", borderColor: "#314752", borderWidth: 1, borderRadius: 9, padding: 9, gap: 2 }, itemTitle: { color: "#E4EBED", fontSize: 10, fontWeight: "900", flexShrink: 1 }, detail: { marginTop: 3, gap: 2 }, label: { color: "#9DAEB6", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 }, detailValue: { color: "#D7E0E3", fontSize: 9, lineHeight: 13 }, conflict: { backgroundColor: "#33251D", borderColor: "#9A6843", borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 3 },
});
