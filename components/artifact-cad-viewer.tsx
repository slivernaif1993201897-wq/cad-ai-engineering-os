import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import type { CadViewerSceneSnapshot } from "@/lib/engineering-api";

function point(value: [number, number, number], min: [number, number, number], max: [number, number, number], yaw: number, pitch: number, zoom: number) {
  const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const x0 = value[0] - center[0]; const y0 = value[1] - center[1]; const z0 = value[2] - center[2];
  const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
  const x = x0 * cy - z0 * sy; const z = x0 * sy + z0 * cy; const y = y0 * cp - z * sp;
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1);
  return [160 + (x / span) * 210 * zoom, 120 - (y / span) * 210 * zoom] as const;
}

function centroid(vertices: [number, number, number][], triangle: [number, number, number]) { const points = triangle.map((index) => vertices[index]); return [(points[0][0] + points[1][0] + points[2][0]) / 3, (points[0][1] + points[1][1] + points[2][1]) / 3, (points[0][2] + points[1][2] + points[2][2]) / 3] as [number, number, number]; }

/** Inspects only viewer triangles tessellated from a verified persisted STEP artifact. It never invents topology. */
export function ArtifactCadViewer({ scene }: { scene: CadViewerSceneSnapshot }) {
  const [selected, setSelected] = useState<string[]>([]); const [yaw, setYaw] = useState(0.65); const [pitch, setPitch] = useState(-0.35); const [zoom, setZoom] = useState(1);
  const triangles = useMemo(() => {
    if (!scene.mesh || !scene.boundingBox) return [];
    return scene.mesh.triangles.slice(0, 800).map((triangle, index) => ({ index, centroid: centroid(scene.mesh!.vertices, triangle), points: triangle.map((vertex) => point(scene.mesh!.vertices[vertex], scene.boundingBox!.min, scene.boundingBox!.max, yaw, pitch, zoom).join(",")).join(" ") }));
  }, [scene, yaw, pitch, zoom]);
  const measurement = useMemo(() => { if (!scene.mesh || selected.length !== 2) return null; const a = triangles.find((item) => `FACE-${String(item.index + 1).padStart(5, "0")}` === selected[0])?.centroid; const b = triangles.find((item) => `FACE-${String(item.index + 1).padStart(5, "0")}` === selected[1])?.centroid; return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null; }, [scene.mesh, selected, triangles]);
  function choose(faceId: string) { setSelected((current) => current.includes(faceId) ? current.filter((item) => item !== faceId) : [...current.slice(-1), faceId]); }
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>ARTIFACT-BOUND CAD INSPECTION</Text><Text style={styles.title}>{scene.file.fileName} · v{scene.file.version}</Text>
    <Text style={styles.meta}>{scene.status} · SHA-256 {scene.file.sha256.slice(0, 16)}…</Text>
    {scene.mesh && scene.boundingBox ? <><View style={styles.controls}><Pressable onPress={() => setYaw((value) => value - 0.18)} style={styles.control}><Text style={styles.controlText}>Orbit −</Text></Pressable><Pressable onPress={() => setYaw((value) => value + 0.18)} style={styles.control}><Text style={styles.controlText}>Orbit +</Text></Pressable><Pressable onPress={() => setPitch((value) => Math.max(-1.2, value - 0.12))} style={styles.control}><Text style={styles.controlText}>Tilt</Text></Pressable><Pressable onPress={() => setZoom((value) => Math.min(2.5, value + 0.2))} style={styles.control}><Text style={styles.controlText}>Zoom +</Text></Pressable><Pressable onPress={() => setZoom((value) => Math.max(0.45, value - 0.2))} style={styles.control}><Text style={styles.controlText}>Zoom −</Text></Pressable></View><Svg width="320" height="240" viewBox="0 0 320 240" style={styles.canvas}>{triangles.map((triangle) => <Polygon key={triangle.index} points={triangle.points} fill={selected.includes(`FACE-${String(triangle.index + 1).padStart(5, "0")}`) ? "#2EC5E8" : "#24516B"} stroke="#8FC8D8" strokeWidth="0.45" onPress={() => choose(`FACE-${String(triangle.index + 1).padStart(5, "0")}`)} />)}</Svg><Text style={styles.meta}>Derived bounds: {scene.boundingBox.size.map((value) => value.toFixed(3)).join(" × ")} · {scene.boundingBox.provenance}</Text><Text style={styles.selection}>{measurement !== null ? `Derived centroid distance: ${measurement.toFixed(4)} model units` : selected.length ? `Selected ${selected.join(" + ")}; select one more face to measure.` : "Tap two tessellated source faces to measure their derived centroids."}</Text></> : <Text style={styles.warn}>{scene.statusReason}</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.tree}>{scene.entities.slice(0, 18).map((entity) => <Text key={entity.id} style={styles.treeText}>{entity.kind} · {entity.displayLabel} · {entity.provenance}</Text>)}</View></ScrollView>
    <Text style={styles.limit}>Measurements are limited to kernel-derived bounds. Face IDs are revision-scoped display references, not inferred engineering features. {scene.limitations[0] ?? ""}</Text>
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: "#102B3C", borderColor: "#2A7A9A", borderRadius: 14, borderWidth: 1, gap: 7, marginTop: 12, padding: 12 }, eyebrow: { color: "#2EC5E8", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, title: { color: "#E7F0F6", fontSize: 14, fontWeight: "800" }, meta: { color: "#9FC8D8", fontSize: 10 }, controls: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, control: { borderColor: "#2E7895", borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 }, controlText: { color: "#BDEFFC", fontSize: 10, fontWeight: "700" }, canvas: { alignSelf: "center", backgroundColor: "#081827", borderColor: "#29536B", borderRadius: 10, borderWidth: 1 }, selection: { color: "#BDEFFC", fontSize: 11, fontWeight: "700" }, warn: { color: "#E5C173", fontSize: 11 }, tree: { gap: 3, paddingVertical: 4 }, treeText: { color: "#C5D8E3", fontSize: 10 }, limit: { color: "#7899AA", fontSize: 9, lineHeight: 13 } });
