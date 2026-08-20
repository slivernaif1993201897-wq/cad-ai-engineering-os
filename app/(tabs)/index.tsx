import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

const DEFAULTS = {
  width: 100,
  depth: 50,
  height: 20,
  holeDiameter: 10,
  holeEdgeOffset: 10,
  filletRadius: 3,
  approveAssumption: true,
};

const INITIAL_PROMPT =
  "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm diameter holes near the corners and a 3 mm external edge fillet.";

function StatusPill({ label, tone }: { label: string; tone: "green" | "orange" | "red" | "blue" }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: `${tone === "green" ? "#1F8A70" : tone === "orange" ? "#DE6B35" : tone === "red" ? "#B3261E" : "#1167B1"}18` }]}>
      <View style={[styles.statusDot, { backgroundColor: tone === "green" ? "#1F8A70" : tone === "orange" ? "#DE6B35" : tone === "red" ? "#B3261E" : "#1167B1" }]} />
      <Text style={[styles.statusText, { color: tone === "green" ? "#1F8A70" : tone === "orange" ? "#DE6B35" : tone === "red" ? "#B3261E" : "#1167B1" }]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [width, setWidth] = useState(String(DEFAULTS.width));
  const [assumptionApproved, setAssumptionApproved] = useState(true);
  const mutation = trpc.cad.generateMountingBlock.useMutation();

  const input = useMemo(() => ({
    ...DEFAULTS,
    width: Number(width) || 0,
    approveAssumption: assumptionApproved,
  }), [assumptionApproved, width]);

  const generate = () => mutation.mutate({ input, prompt });
  const result = mutation.data;
  const requirement = result?.plan.requirements[0];
  const artifact = result?.artifact;
  const isValid = artifact?.validationStatus === "VALID";
  const hasOpenQuestion = Boolean(requirement?.openQuestions.length);

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#101820]" safeAreaClassName="bg-[#101820]" containerStyle={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>CAD-AI / WORKSPACE</Text>
            <Text style={styles.title}>Mounting Block</Text>
          </View>
          <View style={styles.threadBadge}>
            <Text style={styles.threadBadgeText}>DIGITAL THREAD</Text>
            <Text style={styles.threadId}>{result?.plan.id ?? "READY"}</Text>
          </View>
        </View>

        <View style={styles.stateCard}>
          <View style={styles.stateHeader}>
            <Text style={styles.stateLabel}>ENGINEERING TRUTH LAYER</Text>
            <StatusPill label={isValid ? "VALIDATED" : hasOpenQuestion ? "OPEN QUESTION" : "CONCEPTUAL"} tone={isValid ? "green" : hasOpenQuestion ? "orange" : "blue"} />
          </View>
          <Text style={styles.stateCopy}>
            {isValid ? "The real OpenCascade.js kernel produced a validated solid and STEP evidence." : "AI may propose intent. The kernel and validators decide what becomes geometry."}
          </Text>
        </View>

        <Section title="NATURAL-LANGUAGE INTENT">
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="Describe the part…"
            placeholderTextColor="#80909A"
            style={styles.promptInput}
          />
        </Section>

        <Section title="REQUIREMENTS">
          <View style={styles.requirementCard}>
            <View style={styles.requirementHeader}>
              <Text style={styles.requirementId}>{requirement?.id ?? "REQ-MOUNTING-BLOCK-001"}</Text>
              <StatusPill label={requirement?.status ?? "NOT RUN"} tone={requirement?.status === "VALIDATED" ? "green" : "orange"} />
            </View>
            <Text style={styles.requirementText}>{requirement?.description ?? "Awaiting a kernel-backed generation run."}</Text>
            {requirement?.openQuestions.map((question) => (
              <View key={question.id} style={styles.questionBox}>
                <Text style={styles.questionKicker}>OPEN_QUESTION · {question.id}</Text>
                <Text style={styles.questionText}>{question.question}</Text>
                <Text style={styles.questionWhy}>{question.whyItMatters}</Text>
              </View>
            ))}
            <Pressable style={({ pressed }) => [styles.assumptionRow, pressed && styles.pressed]} onPress={() => setAssumptionApproved((value) => !value)}>
              <View style={[styles.checkbox, assumptionApproved && styles.checkboxOn]}>
                {assumptionApproved ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.assumptionText}>I acknowledge the explicit 10 mm hole-edge offset assumption.</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="PARAMETRIC INPUTS · MILLIMETRES">
          <View style={styles.parameterGrid}>
            <View style={styles.parameterCell}><Text style={styles.parameterLabel}>WIDTH</Text><TextInput value={width} onChangeText={setWidth} keyboardType="decimal-pad" style={styles.parameterInput} /></View>
            <View style={styles.parameterCell}><Text style={styles.parameterLabel}>DEPTH</Text><Text style={styles.parameterValue}>{DEFAULTS.depth}</Text></View>
            <View style={styles.parameterCell}><Text style={styles.parameterLabel}>HEIGHT</Text><Text style={styles.parameterValue}>{DEFAULTS.height}</Text></View>
            <View style={styles.parameterCell}><Text style={styles.parameterLabel}>HOLE Ø</Text><Text style={styles.parameterValue}>{DEFAULTS.holeDiameter}</Text></View>
          </View>
        </Section>

        <View style={styles.viewerCard}>
          <View style={styles.viewerTopline}><Text style={styles.viewerTitle}>MODEL EVIDENCE</Text><Text style={styles.kernelLabel}>KERNEL · OpenCascade.js</Text></View>
          <View style={styles.viewerBody}>
            <Text style={styles.cubeMark}>◇</Text>
            <Text style={styles.viewerState}>{artifact ? "SOLID ARTIFACT GENERATED" : "NO FABRICATED PREVIEW"}</Text>
            <Text style={styles.viewerNote}>{artifact?.viewerNote ?? "A native BRep viewer is not bundled. The workspace will show only kernel-derived evidence."}</Text>
            {artifact ? <Text style={styles.stepEvidence}>STEP EXPORT · {artifact.stepByteLength?.toLocaleString()} bytes · {artifact.validationStatus}</Text> : null}
          </View>
        </View>

        <Section title="FEATURE TREE">
          {(result?.plan.features ?? [
            { id: "FEATURE-001", type: "BOX", status: "PENDING" },
            { id: "FEATURE-002", type: "HOLE_PATTERN", status: "PENDING" },
            { id: "FEATURE-003", type: "FILLET", status: "PENDING" },
          ]).map((feature) => (
            <View key={feature.id} style={styles.featureRow}>
              <View style={styles.featureLine} />
              <View style={styles.featureCopy}><Text style={styles.featureType}>{feature.type}</Text><Text style={styles.featureId}>{feature.id}</Text></View>
              <Text style={[styles.featureStatus, feature.status === "APPLIED" && styles.featureStatusApplied]}>{feature.status}</Text>
            </View>
          ))}
        </Section>

        {mutation.error || result?.error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>GENERATION STOPPED</Text><Text style={styles.errorText}>{mutation.error?.message ?? result?.error}</Text></View> : null}

        <Pressable disabled={mutation.isPending} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, mutation.isPending && styles.disabled]} onPress={generate}>
          {mutation.isPending ? <ActivityIndicator color="#F3F1EA" /> : <Text style={styles.primaryButtonText}>{result ? "REGENERATE VERIFIED CAD" : "GENERATE VERIFIED CAD PLAN"}</Text>}
        </Pressable>
        <Text style={styles.footerNote}>No geometry is trusted until the deterministic kernel returns validation evidence.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: "#101820" },
  content: { padding: 20, paddingBottom: 44, gap: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { color: "#7B8A93", fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
  title: { color: "#F3F1EA", fontSize: 28, fontWeight: "800", marginTop: 5 },
  threadBadge: { borderWidth: 1, borderColor: "#34434B", borderRadius: 10, padding: 9, alignItems: "flex-end", maxWidth: 130 },
  threadBadgeText: { color: "#6EA4CA", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  threadId: { color: "#A9B6BC", fontSize: 9, marginTop: 3 },
  stateCard: { backgroundColor: "#192831", borderColor: "#2F4652", borderWidth: 1, borderRadius: 14, padding: 15 },
  stateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  stateLabel: { color: "#9DAEB6", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  stateCopy: { color: "#D7E0E3", lineHeight: 20, fontSize: 13, marginTop: 10 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  section: { gap: 9 },
  sectionTitle: { color: "#7B8A93", fontSize: 10, letterSpacing: 1.3, fontWeight: "800" },
  promptInput: { minHeight: 82, borderColor: "#34434B", borderWidth: 1, borderRadius: 12, padding: 13, color: "#F3F1EA", backgroundColor: "#19232A", fontSize: 14, lineHeight: 20, textAlignVertical: "top" },
  requirementCard: { backgroundColor: "#F3F1EA", borderRadius: 14, padding: 15, gap: 10 },
  requirementHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  requirementId: { color: "#3C4A50", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  requirementText: { color: "#101820", fontSize: 14, lineHeight: 20 },
  questionBox: { borderLeftWidth: 3, borderLeftColor: "#DE6B35", backgroundColor: "#F9E7DE", padding: 10, gap: 3 },
  questionKicker: { color: "#A94E25", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  questionText: { color: "#4D2518", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  questionWhy: { color: "#754432", fontSize: 11, lineHeight: 16 },
  assumptionRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingTop: 2 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: "#9BA6A8", borderRadius: 5, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#1167B1", borderColor: "#1167B1" },
  checkmark: { color: "#FFFFFF", fontWeight: "800" },
  assumptionText: { flex: 1, color: "#536168", fontSize: 11, lineHeight: 16 },
  parameterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  parameterCell: { width: "48%", backgroundColor: "#192831", borderRadius: 10, padding: 11, borderWidth: 1, borderColor: "#2F4652" },
  parameterLabel: { color: "#7B8A93", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  parameterValue: { color: "#F3F1EA", fontSize: 19, fontWeight: "700", marginTop: 6 },
  parameterInput: { color: "#8EC4E8", fontSize: 19, fontWeight: "700", marginTop: 2, padding: 0 },
  viewerCard: { borderRadius: 14, borderWidth: 1, borderColor: "#34434B", overflow: "hidden", backgroundColor: "#131D23" },
  viewerTopline: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#2B3A41" },
  viewerTitle: { color: "#B7C4C9", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  kernelLabel: { color: "#6EA4CA", fontSize: 9, fontWeight: "700" },
  viewerBody: { minHeight: 170, alignItems: "center", justifyContent: "center", padding: 22, gap: 7 },
  cubeMark: { color: "#6EA4CA", fontSize: 58, lineHeight: 64 },
  viewerState: { color: "#F3F1EA", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  viewerNote: { color: "#81929A", textAlign: "center", lineHeight: 17, fontSize: 11 },
  stepEvidence: { color: "#67B39F", fontSize: 10, fontWeight: "800", marginTop: 3 },
  featureRow: { flexDirection: "row", alignItems: "center", minHeight: 46, borderBottomWidth: 1, borderBottomColor: "#27363D", gap: 10 },
  featureLine: { width: 2, height: 30, backgroundColor: "#1167B1", borderRadius: 1 },
  featureCopy: { flex: 1 },
  featureType: { color: "#DDE6E8", fontSize: 13, fontWeight: "700" },
  featureId: { color: "#74858D", fontSize: 10, marginTop: 2 },
  featureStatus: { color: "#DE6B35", fontSize: 10, fontWeight: "800" },
  featureStatusApplied: { color: "#67B39F" },
  errorBox: { backgroundColor: "#3A1E1E", borderColor: "#B3261E", borderWidth: 1, borderRadius: 12, padding: 12, gap: 5 },
  errorTitle: { color: "#FFB4AB", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  errorText: { color: "#F8D2CD", fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 52, borderRadius: 13, backgroundColor: "#1167B1", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#F3F1EA", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  footerNote: { color: "#71828B", textAlign: "center", fontSize: 10, lineHeight: 15, paddingHorizontal: 12 },
});
