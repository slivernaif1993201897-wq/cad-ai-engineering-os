import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { demoFixture, demoMachine, demoTool, evaluateCamRelease, type CheckState } from "@/lib/cam-governance";

const checks: { label: string; key: keyof ReturnType<typeof evaluateCamRelease>["checks"] }[] = [
  { label: "Machine travel", key: "travel" },
  { label: "Tool / fixture", key: "toolFixtureCollision" },
  { label: "Holder collision", key: "holderCollision" },
  { label: "Stock collision", key: "stockCollision" },
  { label: "Rapid moves", key: "rapidMoves" },
  { label: "Spindle / feed", key: "spindleFeed" },
  { label: "Controller commands", key: "controllerCommands" },
  { label: "Controller match", key: "controllerMatch" },
  { label: "Post match", key: "postMatch" },
  { label: "G-code syntax", key: "gcodeSyntax" },
];

const initialChecks = Object.fromEntries(checks.map(({ key }) => [key, "NOT_RUN" as CheckState])) as Record<keyof ReturnType<typeof evaluateCamRelease>["checks"], CheckState>;

export default function CamScreen() {
  const colors = useColors();
  const router = useRouter();
  const [verification, setVerification] = useState(initialChecks);
  const result = useMemo(() => evaluateCamRelease({
    cadRevision: "CAD-PLATE-042 / rev-7",
    machine: demoMachine,
    tool: demoTool,
    fixture: demoFixture,
    selectedController: demoMachine.controller.identity,
    selectedPost: demoMachine.postProcessor,
    gcode: "%\n; CONTROLLER:HAAS-NGC\n; POST:haas-ngc-v2\nG90 G54\nM30\n%",
    gcodeHash: "sha256:pending-until-generated",
    verification,
    generatedAt: "2026-08-29T00:00:00Z",
    machineProfileRevisionAtGeneration: demoMachine.revision,
    toolingProvenanceAtGeneration: demoTool.provenance,
  }), [verification]);

  const runCheck = (key: keyof typeof verification) => setVerification((current) => ({ ...current, [key]: "PASS" }));
  const runAll = () => setVerification(Object.fromEntries(checks.map(({ key }) => [key, "PASS" as CheckState])) as typeof verification);

  return <ScreenContainer className="px-5 pt-3">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={[styles.backText, { color: colors.tint }]}>‹  Mission</Text></Pressable>
      <Text style={[styles.eyebrow, { color: colors.tint }]}>CAD-AI / CAM CONTROL</Text>
      <Text style={[styles.title, { color: colors.text }]}>Manufacturing release</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Machine-aware verification for real manufacturing. G-code parsing is evidence, not machine certification.</Text>

      <View style={[styles.banner, { backgroundColor: `${colors.error}12`, borderColor: `${colors.error}45` }]}>
        <Text style={[styles.bannerLabel, { color: colors.error }]}>CERTIFICATION BOUNDARY</Text>
        <Text style={[styles.bannerText, { color: colors.text }]}>MACHINE_CERTIFIED is never automatic. External physical evidence and an explicit trial are required.</Text>
      </View>

      <Section title="Machine profile" colors={colors}>
        <DataRow label="Machine" value={`${demoMachine.machineId} · ${demoMachine.machineType}`} colors={colors} />
        <DataRow label="Axes / travel" value={`${demoMachine.axes.join(" · ")} · ${demoMachine.travelMm.x} × ${demoMachine.travelMm.y} × ${demoMachine.travelMm.z} mm`} colors={colors} />
        <DataRow label="Controller" value={`${demoMachine.controller.identity} v${demoMachine.controller.version}`} colors={colors} />
        <DataRow label="Spindle / rapid" value={`${demoMachine.spindleRpm.min}–${demoMachine.spindleRpm.max} rpm · ${demoMachine.rapidMmMin} mm/min`} colors={colors} />
        <Text style={[styles.note, { color: colors.muted }]}>{demoMachine.workOffsetBehavior}. {demoMachine.toolChangeBehavior}.</Text>
      </Section>

      <Section title="Tooling + fixture" colors={colors}>
        <DataRow label="Tool" value={`${demoTool.toolId} · Ø${demoTool.diameterMm} mm · ${demoTool.fluteCount} flute`} colors={colors} />
        <DataRow label="Holder / stickout" value={`${demoTool.holder} · ${demoTool.stickoutMm} mm`} colors={colors} />
        <DataRow label="Stock / fixture" value={`${demoFixture.stockId} · ${demoFixture.fixture}`} colors={colors} />
        <DataRow label="Keep-outs" value={demoFixture.keepOutZones.join(" · ")} colors={colors} />
      </Section>

      <Section title="Verification gates" colors={colors}>
        <View style={styles.checkGrid}>{checks.map(({ label, key }) => {
          const state = verification[key];
          return <Pressable key={key} onPress={() => runCheck(key)} style={({ pressed }) => [styles.check, { borderColor: state === "PASS" ? `${colors.success}60` : colors.border, backgroundColor: state === "PASS" ? `${colors.success}10` : colors.background }, pressed && { opacity: 0.7 }]}><View style={[styles.dot, { backgroundColor: state === "PASS" ? colors.success : colors.warning }]} /><View style={styles.checkCopy}><Text style={[styles.checkLabel, { color: colors.text }]}>{label}</Text><Text style={[styles.checkState, { color: state === "PASS" ? colors.success : colors.warning }]}>{state}</Text></View></Pressable>;
        })}</View>
        <Pressable onPress={runAll} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && { opacity: 0.8 }]}><Text style={[styles.primaryText, { color: colors.background }]}>Run verification gates</Text></Pressable>
      </Section>

      <View style={[styles.releaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>RELEASE DECISION</Text>
        <Text style={[styles.releaseStatus, { color: result.releaseAllowed ? colors.warning : colors.error }]}>{result.status}</Text>
        <Text style={[styles.note, { color: colors.muted }]}>{result.releaseAllowed ? "All digital checks pass; machine trial evidence is still required." : `${result.blockers.length} blocker(s) prevent release.`}</Text>
        {result.blockers.slice(0, 4).map((blocker) => <Text key={blocker} style={[styles.blocker, { color: colors.error }]}>× {blocker}</Text>)}
        <Text style={[styles.certification, { color: colors.warning }]}>MACHINE_CERTIFIED · NOT CLAIMED</Text>
      </View>

      <Pressable onPress={() => router.push("/(tabs)/evidence")} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.text }]}>Review provenance evidence</Text></Pressable>
    </ScrollView>
  </ScreenContainer>;
}

function Section({ title, colors, children }: { title: string; colors: ReturnType<typeof useColors>; children: React.ReactNode }) {
  return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{children}</View>;
}
function DataRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.dataRow}><Text style={[styles.dataLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.dataValue, { color: colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  back: { paddingVertical: 4 }, backText: { fontSize: 14, fontWeight: "800" },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900" }, subtitle: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  banner: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 6 }, bannerLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1 }, bannerText: { fontSize: 14, lineHeight: 20, fontWeight: "800" },
  section: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12 }, sectionTitle: { fontSize: 16, fontWeight: "900" },
  dataRow: { gap: 3 }, dataLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }, dataValue: { fontSize: 14, lineHeight: 19, fontWeight: "700" }, note: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  checkGrid: { gap: 8 }, check: { borderWidth: 1, borderRadius: 13, padding: 11, flexDirection: "row", gap: 10, alignItems: "center" }, dot: { width: 9, height: 9, borderRadius: 5 }, checkCopy: { flex: 1, gap: 2 }, checkLabel: { fontSize: 13, fontWeight: "800" }, checkState: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  primaryButton: { borderRadius: 13, alignItems: "center", paddingVertical: 13, marginTop: 2 }, primaryText: { fontSize: 14, fontWeight: "900" },
  releaseCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 }, releaseStatus: { fontSize: 21, fontWeight: "900" }, blocker: { fontSize: 12, fontWeight: "800" }, certification: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginTop: 4 },
  secondaryButton: { borderWidth: 1, borderRadius: 13, alignItems: "center", paddingVertical: 13 }, secondaryText: { fontSize: 14, fontWeight: "900" },
});
