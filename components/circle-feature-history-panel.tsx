import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loadProjectAccess, type StoredProjectAccess } from "@/lib/project-memory";
import { trpc } from "@/lib/trpc";
import type { GeometrySelectionContext } from "@/shared/cadWorkbench";
import type { FeatureHistoryRevision, FeatureParameterName } from "@/shared/featureHistory";

const parameters: Array<{ name: Extract<FeatureParameterName, "radius" | "centerX" | "centerY" | "extrudeDistance">; label: string }> = [
  { name: "radius", label: "RADIUS" }, { name: "centerX", label: "CENTER X" }, { name: "centerY", label: "CENTER Y" }, { name: "extrudeDistance", label: "EXTRUDE" },
];
type Unit = "mm" | "cm" | "m";

export function CircleFeatureHistoryPanel({ onFeatureSelection }: { onFeatureSelection: (selection: GeometrySelectionContext) => void }) {
  const [project, setProject] = useState<StoredProjectAccess>();
  const [form, setForm] = useState({ title: "Circular boss", centerX: "0", centerY: "0", radius: "10", extrudeDistance: "20" });
  const [unit, setUnit] = useState<Unit>("mm");
  const [selectedId, setSelectedId] = useState<string>();
  const [parameterName, setParameterName] = useState<(typeof parameters)[number]["name"]>("radius");
  const [editValue, setEditValue] = useState("15");
  const [preview, setPreview] = useState<FeatureHistoryRevision>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => { const stored = await loadProjectAccess("active-engineering-workbench"); if (!cancelled && stored) setProject(stored); };
    void hydrate(); const timer = setInterval(() => void hydrate(), 1_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const history = trpc.featureHistory.list.useQuery({ projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE" }, { enabled: Boolean(project) });
  const circleRevisions = useMemo(() => history.data?.filter((item) => item.features.some((feature) => feature.featureType === "CIRCLE_SKETCH")) ?? [], [history.data]);
  const selected = circleRevisions.find((item) => item.revisionId === selectedId) ?? preview ?? circleRevisions.at(-1);
  const circle = selected?.features.find((feature) => feature.featureType === "CIRCLE_SKETCH");
  const currentParameter = [...(circle?.parameters ?? []), ...(selected?.features.find((feature) => feature.featureId === "EXTRUDE-CIRCLE-001")?.parameters ?? [])].find((item) => item.name === parameterName);

  const create = trpc.featureHistory.createCircle.useMutation();
  const previewCircle = trpc.featureHistory.previewCircle.useMutation();
  const execute = trpc.featureHistory.executeCircle.useMutation();
  const topology = trpc.featureHistory.topology.useQuery({ projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE", revisionId: selected?.revisionId ?? "UNAVAILABLE" }, { enabled: Boolean(project && selected?.status === "KERNEL_VALIDATED") });
  const repeatability = trpc.featureHistory.repeatability.useQuery({ projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE", revisionId: selected?.revisionId ?? "UNAVAILABLE" }, { enabled: Boolean(project && selected?.status === "KERNEL_VALIDATED") });
  const gate = trpc.featureHistory.filletReadiness.useQuery({ projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE", revisionId: selected?.revisionId }, { enabled: Boolean(project && selected?.status === "KERNEL_VALIDATED") });
  const geometryExport = trpc.featureHistory.geometryExport.useQuery({ projectId: project?.projectId ?? "UNAVAILABLE", accessKey: project?.accessKey ?? "UNAVAILABLE", revisionId: selected?.revisionId ?? "UNAVAILABLE" }, { enabled: Boolean(project && selected?.status === "KERNEL_VALIDATED") });

  const createCircle = async () => {
    if (!project) return;
    const values = [Number(form.centerX), Number(form.centerY), Number(form.radius), Number(form.extrudeDistance)];
    if (!form.title.trim() || values.some((value) => !Number.isFinite(value))) { setNotice("Provide a title plus finite center, radius, and extrusion values with an explicit unit."); return; }
    try {
      const revision = await create.mutateAsync({ projectId: project.projectId, accessKey: project.accessKey, input: { title: form.title.trim(), centerX: values[0], centerY: values[1], radius: values[2], extrudeDistance: values[3], unit } });
      setNotice(revision.status === "KERNEL_VALIDATED" ? `KERNEL VALIDATED: ${revision.revisionId}. CIRCLE_SKETCH → EXTRUDE is immutable.` : `CIRCLE CREATION FAILED: ${revision.failure?.reason ?? "No geometry was created."}`);
      if (revision.status === "KERNEL_VALIDATED") { setSelectedId(revision.revisionId); await history.refetch(); }
    } catch (error) { setNotice(`Circle creation blocked: ${error instanceof Error ? error.message : "Unknown error"}`); }
  };

  const selectRevision = (revision: FeatureHistoryRevision) => {
    setSelectedId(revision.revisionId); const sketch = revision.features.find((feature) => feature.featureType === "CIRCLE_SKETCH");
    if (sketch) {
      const radius = sketch.parameters.find((item) => item.name === "radius") ?? sketch.parameters[0]; setParameterName(radius.name as (typeof parameters)[number]["name"]); setEditValue(String(radius.value));
      onFeatureSelection({ kind: "FEATURE", id: sketch.featureId, label: `${sketch.featureType} · ${sketch.status}`, featureId: sketch.featureId, source: "FEATURE_TREE" });
    }
  };

  const makePreview = async () => {
    if (!project || !selected || !Number.isFinite(Number(editValue))) { setNotice("Select a stored circle revision and enter a finite parameter value."); return; }
    const isExtrude = parameterName === "extrudeDistance";
    try {
      const result = await previewCircle.mutateAsync({ projectId: project.projectId, accessKey: project.accessKey, sourceRevisionId: selected.revisionId, edit: { featureId: isExtrude ? "EXTRUDE-CIRCLE-001" : "CIRCLE-SKETCH-001", parameter: { name: parameterName, value: Number(editValue), unit }, targetReferenceId: isExtrude ? "REF-CIRCLE-SKETCH-001-PROFILE" : undefined, direction: isExtrude ? "NORMAL" : undefined } });
      setPreview(result); setNotice(result.status === "PREVIEW" ? `PREVIEW READY: ${result.revisionId}. The source revision remains unchanged.` : `PREVIEW FAILED: ${result.failure?.stage ?? "VALIDATION"} · ${result.failure?.reason ?? "No geometry generated."}`);
    } catch (error) { setNotice(`Circle preview blocked: ${error instanceof Error ? error.message : "Unknown error"}`); }
  };

  const applyPreview = async () => {
    if (!project || !preview) return;
    const result = await execute.mutateAsync({ projectId: project.projectId, accessKey: project.accessKey, previewRevisionId: preview.revisionId });
    setNotice(result.status === "KERNEL_VALIDATED" ? `IMMUTABLE BRANCH CREATED: ${result.revisionId}.` : `REGENERATION FAILED: ${result.failure?.reason ?? "Prior revision remains intact."}`);
    if (result.status === "KERNEL_VALIDATED") { setPreview(undefined); setSelectedId(result.revisionId); await history.refetch(); }
  };

  return <View style={styles.card}>
    <View style={styles.header}><View><Text style={styles.kicker}>PHASE 4.7 · CIRCLE + TOPOLOGY STABILITY</Text><Text style={styles.title}>CIRCLE SKETCH / EXTRUDE</Text></View><Text style={styles.badge}>{selected?.status ?? "NO CIRCLE"}</Text></View>
    <Text style={styles.guard}>CIRCLE_SKETCH and dependent EXTRUDE are kernel-backed. Body, face, edge, and vertex ordinals are revision-scoped inspection references only; they are never silently remapped. Production fillet execution is blocked.</Text>
    <View style={styles.body}>
      <Text style={styles.label}>CREATE CIRCLE FEATURE CHAIN</Text>
      <TextInput value={form.title} onChangeText={(title) => setForm((value) => ({ ...value, title }))} placeholder="Circular boss title" placeholderTextColor="#6E858F" style={styles.input} />
      <View style={styles.row}>{(["centerX", "centerY", "radius", "extrudeDistance"] as const).map((name) => <TextInput key={name} value={form[name]} onChangeText={(value) => setForm((state) => ({ ...state, [name]: value }))} keyboardType="decimal-pad" placeholder={name} placeholderTextColor="#6E858F" style={styles.small} />)}</View>
      <UnitPicker value={unit} onChange={setUnit} /><Pressable style={styles.primary} onPress={() => void createCircle()}><Text style={styles.primaryText}>{create.isPending ? "CREATING…" : "CREATE CIRCLE + EXTRUDE"}</Text></Pressable>
      <Text style={styles.meta}>OpenCascade builds a gp_Circ edge, closed wire, planar face, and +Z prism. Kernel validation is not structural, manufacturing, safety, or production validation.</Text>

      <Text style={styles.label}>CIRCLE FEATURE TREE</Text>
      {history.isLoading ? <ActivityIndicator color="#87C8E9" /> : circleRevisions.map((revision) => <Pressable key={revision.revisionId} style={[styles.revision, selected?.revisionId === revision.revisionId && styles.active]} onPress={() => selectRevision(revision)}><Text style={styles.feature}>{revision.title}</Text><Text style={styles.meta}>{revision.revisionId} · {revision.features.map((feature) => feature.featureType).join(" → ")}</Text></Pressable>)}

      {selected ? <View style={styles.inspector}>
        <Text style={styles.label}>CIRCLE INSPECTOR</Text><Text style={styles.feature}>{selected.revisionId}</Text>
        {circle?.parameters.map((parameter) => <Text key={parameter.name} style={styles.parameter}>{parameter.name}: {parameter.value} {parameter.unit} · normalized {parameter.normalizedValueMm} mm</Text>)}
        <Text style={styles.meta}>Geometry: {selected.geometry.validation}. Viewer mesh bounds are tessellated display data, not a topology naming mechanism.</Text>
        <Text style={styles.label}>CONTROLLED PARAMETER EDIT</Text><View style={styles.row}>{parameters.map((entry) => <Pressable key={entry.name} style={[styles.unit, parameterName === entry.name && styles.active]} onPress={() => { setParameterName(entry.name); const next = [...(circle?.parameters ?? []), ...(selected.features.find((feature) => feature.featureId === "EXTRUDE-CIRCLE-001")?.parameters ?? [])].find((item) => item.name === entry.name); setEditValue(String(next?.value ?? "")); }}><Text style={styles.unitText}>{entry.label}</Text></Pressable>)}</View>
        <TextInput value={editValue} onChangeText={setEditValue} keyboardType="decimal-pad" placeholder="New value" placeholderTextColor="#6E858F" style={styles.input} /><UnitPicker value={unit} onChange={setUnit} /><Pressable style={styles.secondary} onPress={() => void makePreview()}><Text style={styles.secondaryText}>{previewCircle.isPending ? "PREVIEWING…" : "PREVIEW REGENERATION"}</Text></Pressable>
        <Text style={styles.meta}>Current target: {currentParameter ? `${currentParameter.value} ${currentParameter.unit}` : "UNKNOWN"}. Every edit regenerates the full chain and checks references, units, and positive radius/distance.</Text>
      </View> : null}

      {preview ? <View style={styles.preview}><Text style={styles.label}>NON-PERSISTENT CIRCLE PREVIEW</Text><Text style={styles.feature}>{preview.status} · {preview.revisionId}</Text>{preview.failure ? <Text style={styles.failure}>{preview.failure.stage} · {preview.failure.reason}</Text> : <Pressable style={styles.primary} onPress={() => void applyPreview()}><Text style={styles.primaryText}>APPLY IMMUTABLE CIRCLE REVISION</Text></Pressable>}</View> : null}

      {selected?.status === "KERNEL_VALIDATED" ? <View style={styles.inspector}>
        <Text style={styles.label}>TOPOLOGY STABILITY INSPECTION</Text><Text style={styles.meta}>Bodies {topology.data?.counts.bodies ?? "…"} · Faces {topology.data?.counts.faces ?? "…"} · Edges {topology.data?.counts.edges ?? "…"} · Vertices {topology.data?.counts.vertices ?? "…"}</Text><Text style={styles.failure}>REFERENCE POLICY: {topology.data?.references[0]?.stability ?? "UNKNOWN"}</Text><Text style={styles.meta}>Repeatability: {repeatability.data?.performed ? `counts ${String(repeatability.data.sameCounts)} · bounds ${String(repeatability.data.sameBoundingBox)} · stable identity ${String(repeatability.data.stableIdentityAcrossRegeneration)}` : "AWAITING"}</Text>
        <Text style={styles.label}>STEP GEOMETRY EXPORT</Text><Text style={styles.meta}>{geometryExport.data?.status ?? "AWAITING"} · {geometryExport.data?.format ?? "STEP_GEOMETRY"} · Feature history: {geometryExport.data?.featureHistory ?? "NOT_PRESERVED"}</Text>{geometryExport.data?.url ? <Text style={styles.exportPath}>{geometryExport.data.url}</Text> : null}
        <Text style={styles.label}>FILLET READINESS GATE</Text><Text style={[styles.gate, { color: gate.data?.ready ? "#8FD2AE" : "#F2AB9E" }]}>FILLET_READY = {String(gate.data?.ready ?? false).toUpperCase()}</Text><Text style={styles.meta}>{gate.data?.conclusion ?? "Evaluating formal gate…"}</Text>{gate.data?.missing.map((missing) => <Text key={missing} style={styles.failure}>MISSING · {missing}</Text>)}
      </View> : null}
      {notice ? <View style={styles.notice}><Text style={styles.label}>CIRCLE HISTORY STATE</Text><Text style={styles.noticeText}>{notice}</Text></View> : null}
    </View>
  </View>;
}

function UnitPicker({ value, onChange }: { value: Unit; onChange: (value: Unit) => void }) { return <View style={styles.row}>{(["mm", "cm", "m"] as const).map((entry) => <Pressable key={entry} style={[styles.unit, value === entry && styles.active]} onPress={() => onChange(entry)}><Text style={styles.unitText}>{entry.toUpperCase()}</Text></Pressable>)}</View>; }

const styles = StyleSheet.create({
  card: { backgroundColor: "#17242D", borderWidth: 1, borderColor: "#456473", borderRadius: 14, overflow: "hidden" }, header: { padding: 11, flexDirection: "row", justifyContent: "space-between", gap: 8 }, kicker: { color: "#8ECBEA", fontSize: 8, letterSpacing: .8, fontWeight: "900" }, title: { color: "#F1F6F8", fontSize: 13, fontWeight: "900", marginTop: 3 }, badge: { color: "#B8DAE9", fontSize: 8, fontWeight: "900", borderWidth: 1, borderColor: "#446878", padding: 6, borderRadius: 6, alignSelf: "flex-start" }, guard: { backgroundColor: "#303022", color: "#D7DAB9", fontSize: 8, lineHeight: 12, padding: 9 }, body: { padding: 11, gap: 6 }, label: { color: "#8ECBEA", fontSize: 8, fontWeight: "900", letterSpacing: .6, marginTop: 5 }, input: { borderWidth: 1, borderColor: "#4A6876", color: "#F3F8F9", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 7, fontSize: 10 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center" }, small: { width: 76, borderWidth: 1, borderColor: "#4A6876", color: "#F3F8F9", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 7, fontSize: 9 }, unit: { borderWidth: 1, borderColor: "#5D95AE", borderRadius: 7, paddingVertical: 6, paddingHorizontal: 7 }, active: { backgroundColor: "#285B75", borderColor: "#8ECBEA" }, unitText: { color: "#C1E1EF", fontSize: 8, fontWeight: "900" }, primary: { backgroundColor: "#247A65", paddingVertical: 7, paddingHorizontal: 9, borderRadius: 7, alignSelf: "flex-start" }, primaryText: { color: "#F3FCF8", fontSize: 8, fontWeight: "900" }, secondary: { borderWidth: 1, borderColor: "#5D95AE", paddingVertical: 7, paddingHorizontal: 8, borderRadius: 7, alignSelf: "flex-start" }, secondaryText: { color: "#BFE1EF", fontSize: 8, fontWeight: "900" }, meta: { color: "#A9BBC3", fontSize: 8, lineHeight: 12 }, revision: { borderTopWidth: 1, borderTopColor: "#2B424D", padding: 7 }, feature: { color: "#E6F0F5", fontSize: 9, fontWeight: "900" }, inspector: { backgroundColor: "#1B333D", borderRadius: 8, padding: 8, gap: 4 }, parameter: { color: "#DAC7FF", fontSize: 8, fontWeight: "800" }, preview: { backgroundColor: "#2D2941", borderLeftWidth: 3, borderLeftColor: "#B69EFF", borderRadius: 7, padding: 8, gap: 4 }, failure: { color: "#F3AE9D", fontSize: 8, lineHeight: 12, fontWeight: "800" }, gate: { fontSize: 10, fontWeight: "900" }, exportPath: { color: "#9FD9BA", fontSize: 8, lineHeight: 12 }, notice: { backgroundColor: "#1C3039", borderRadius: 7, padding: 8, gap: 3 }, noticeText: { color: "#E1EEF2", fontSize: 9, lineHeight: 13 },
});
