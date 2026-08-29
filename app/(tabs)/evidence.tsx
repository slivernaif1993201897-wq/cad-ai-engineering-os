import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const evidence = [
  { time: "NOW", title: "Managed artifact promotion", detail: "Held until runtime manifest and CLI smoke evidence exist.", state: "Blocked" },
  { time: "STEP 04", title: "Kernel validation", detail: "No external STEP bytes have entered the managed lifecycle in this review.", state: "Pending" },
  { time: "STEP 03", title: "Pinned source identity", detail: "Exact source commit is a mandatory prerequisite for adapter execution.", state: "Verified" },
  { time: "STEP 02", title: "Runtime manifest", detail: "Interpreter and package identity must be recorded without secrets or temp paths.", state: "Blocked" },
] as const;

export default function EvidenceScreen() {
  const colors = useColors();
  const router = useRouter();
  return <ScreenContainer className="px-5 pt-3">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={[styles.backText, { color: colors.tint }]}>‹  Back</Text></Pressable>
      <Text style={[styles.eyebrow, { color: colors.tint }]}>EVIDENCE / TRACEABILITY</Text>
      <Text style={[styles.title, { color: colors.text }]}>Evidence log</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>A missing record stays visible. Nothing here implies that a runtime or artifact has executed.</Text>
      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View><Text style={[styles.summaryLabel, { color: colors.muted }]}>PROMOTION STATUS</Text><Text style={[styles.summaryValue, { color: colors.error }]}>HELD</Text></View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View><Text style={[styles.summaryLabel, { color: colors.muted }]}>OPEN GATES</Text><Text style={[styles.summaryValue, { color: colors.warning }]}>02</Text></View>
      </View>
      <View style={styles.list}>{evidence.map((item) => {
        const tone = item.state === "Verified" ? colors.success : item.state === "Blocked" ? colors.error : colors.warning;
        return <View key={item.title} style={[styles.item, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.itemTop}><Text style={[styles.time, { color: colors.muted }]}>{item.time}</Text><Text style={[styles.state, { color: tone }]}>{item.state}</Text></View>
          <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text>
        </View>;
      })}</View>
      <View style={[styles.callout, { backgroundColor: `${colors.tint}12`, borderColor: `${colors.tint}40` }]}><Text style={[styles.calloutTitle, { color: colors.tint }]}>TRACEABILITY RULE</Text><Text style={[styles.calloutText, { color: colors.text }]}>Every artifact must carry source identity, runtime evidence, validation result, SHA-256, provenance, and immutable lineage.</Text></View>
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40, gap: 16 },
  back: { paddingVertical: 6, alignSelf: "flex-start" },
  backText: { fontSize: 15, fontWeight: "700" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 10 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8, marginTop: 3 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  summary: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 20 },
  summaryLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  summaryValue: { fontSize: 24, fontWeight: "900", marginTop: 5 },
  divider: { width: 1, height: 42 },
  list: { gap: 10 },
  item: { borderRadius: 16, borderWidth: 1, padding: 15, gap: 6 },
  itemTop: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  state: { fontSize: 11, fontWeight: "800" },
  itemTitle: { fontSize: 15, fontWeight: "800" },
  detail: { fontSize: 12, lineHeight: 18 },
  callout: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 7 },
  calloutTitle: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  calloutText: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
});
