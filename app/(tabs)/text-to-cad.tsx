import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const starter = "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm corner holes and a 3 mm fillet.";

export default function TextToCadScreen() {
  const colors = useColors();
  const router = useRouter();
  const [prompt, setPrompt] = useState(starter);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const mutation = trpc.textToCad.plan.useMutation();
  const plan = mutation.data;

  const handlePlan = () => {
    const clean = prompt.trim();
    if (clean.length < 12) return;
    setSubmittedPrompt(clean);
    mutation.mutate({ prompt: clean });
  };

  return <ScreenContainer className="px-5 pt-3">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={[styles.backText, { color: colors.tint }]}>‹  Mission</Text></Pressable>
      <Text style={[styles.eyebrow, { color: colors.tint }]}>MANUS / TEXT-TO-CAD HELPER</Text>
      <Text style={[styles.title, { color: colors.text }]}>Describe the part</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Use Text-to-CAD as a design assistant: it structures your brief and surfaces assumptions. CAD-AGENT remains the owner of build execution, runtime gates, and artifact governance.</Text>
      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.inputLabel, { color: colors.muted }]}>ENGINEERING BRIEF</Text>
        <TextInput value={prompt} onChangeText={setPrompt} multiline textAlignVertical="top" placeholder="Describe dimensions, features, material, and constraints…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} maxLength={2000} />
        <View style={styles.inputFooter}><Text style={[styles.counter, { color: colors.muted }]}>{prompt.length}/2000</Text><Pressable onPress={handlePlan} disabled={mutation.isPending || prompt.trim().length < 12} style={({ pressed }) => [styles.button, { backgroundColor: prompt.trim().length < 12 ? colors.border : colors.tint }, pressed && { opacity: 0.78 }]}>{mutation.isPending ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.buttonText, { color: colors.background }]}>Generate plan</Text>}</Pressable></View>
      </View>
      {mutation.isError && <View style={[styles.error, { borderColor: `${colors.error}55`, backgroundColor: `${colors.error}12` }]}><Text style={[styles.errorTitle, { color: colors.error }]}>PLAN UNAVAILABLE</Text><Text style={[styles.errorText, { color: colors.text }]}>Manus could not return a plan. No CAD artifact was created.</Text></View>}
      {plan && <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.resultHeader}><View><Text style={[styles.inputLabel, { color: colors.muted }]}>ASSISTED SPECIFICATION</Text><Text style={[styles.resultTitle, { color: colors.text }]}>{plan.summary}</Text></View><Text style={[styles.readiness, { color: plan.readiness === "BLOCKED" ? colors.error : colors.warning }]}>{plan.readiness.replaceAll("_", " ")}</Text></View>
        <Text style={[styles.subhead, { color: colors.text }]}>Features</Text>
        {plan.features.map((feature) => <Text key={feature} style={[styles.listText, { color: colors.muted }]}>• {feature}</Text>)}
        <Text style={[styles.subhead, { color: colors.text }]}>Assumptions</Text>
        {plan.assumptions.map((assumption) => <Text key={assumption} style={[styles.listText, { color: colors.muted }]}>• {assumption}</Text>)}
        <Text style={[styles.subhead, { color: colors.text }]}>Constraints</Text>
        {plan.constraints.map((constraint) => <Text key={constraint} style={[styles.listText, { color: colors.muted }]}>• {constraint}</Text>)}
        <View style={[styles.boundary, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}44` }]}>          <Text style={[styles.boundaryTitle, { color: colors.warning }]}>APP-OWNED EXECUTION BOUNDARY</Text><Text style={[styles.boundaryText, { color: colors.text }]}>Plan generated from: {submittedPrompt.slice(0, 72)}{submittedPrompt.length > 72 ? "…" : ""}</Text><Text style={[styles.boundaryText, { color: colors.muted }]}>Pinned runtime identity, manifest, CLI smoke, and managed ingestion evidence are still required.</Text></View>
      </View>}
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
  inputCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  inputLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  input: { minHeight: 140, fontSize: 16, lineHeight: 24, fontWeight: "600" },
  inputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontSize: 11, fontWeight: "700" },
  button: { minWidth: 130, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonText: { fontSize: 13, fontWeight: "900" },
  error: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 5 },
  errorTitle: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  errorText: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  resultCard: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 10 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  resultTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24, marginTop: 5, maxWidth: 230 },
  readiness: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 3, textAlign: "right" },
  subhead: { fontSize: 13, fontWeight: "900", marginTop: 5 },
  listText: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  boundary: { borderWidth: 1, borderRadius: 15, padding: 13, gap: 5, marginTop: 5 },
  boundaryTitle: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  boundaryText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
});
