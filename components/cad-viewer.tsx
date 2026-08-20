import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon as SvgPolygon } from "react-native-svg";

import type { KernelViewerMesh } from "@/shared/cadAgent";

export type ViewerSelectionMode = "FACE" | "EDGE" | "VERTEX" | "FEATURE";
export type ViewerSelection = {
  mode: ViewerSelectionMode;
  faceId: string;
  featureId: string;
  instanceKey?: string;
  instanceIdentity?: "PROVEN" | "INSTANCE_IDENTITY_UNKNOWN";
  vertex?: [number, number, number];
  edge?: [[number, number, number], [number, number, number]];
};

type CameraPreset = "ISO" | "FRONT" | "REAR" | "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
type GestureMode = "ROTATE" | "PAN";

function initialCamera(preset: CameraPreset) {
  switch (preset) {
    case "FRONT": return { yaw: 0, pitch: 0 };
    case "REAR": return { yaw: Math.PI, pitch: 0 };
    case "TOP": return { yaw: 0, pitch: Math.PI / 2 };
    case "BOTTOM": return { yaw: 0, pitch: -Math.PI / 2 };
    case "LEFT": return { yaw: Math.PI / 2, pitch: 0 };
    case "RIGHT": return { yaw: -Math.PI / 2, pitch: 0 };
    default: return { yaw: -Math.PI / 4, pitch: Math.PI / 6 };
  }
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function CADViewer({
  mesh,
  selectedFeatureId,
  selectedInstanceKey,
  onSelectionChange,
  hiddenFeatureIds = [],
  isolatedFeatureId,
  bodyVisible = true,
}: {
  mesh?: KernelViewerMesh;
  selectedFeatureId?: string;
  selectedInstanceKey?: string;
  onSelectionChange?: (selection: ViewerSelection) => void;
  hiddenFeatureIds?: string[];
  isolatedFeatureId?: string;
  bodyVisible?: boolean;
}) {
  const [size, setSize] = useState({ width: 320, height: 250 });
  const [preset, setPreset] = useState<CameraPreset>("ISO");
  const [camera, setCamera] = useState(() => ({ ...initialCamera("ISO"), zoom: 1, panX: 0, panY: 0 }));
  const [gestureMode, setGestureMode] = useState<GestureMode>("ROTATE");
  const [selectionMode, setSelectionMode] = useState<ViewerSelectionMode>("FACE");
  const [selection, setSelection] = useState<ViewerSelection>();
  const gestureStart = useRef({ yaw: 0, pitch: 0, panX: 0, panY: 0 });

  const resetCamera = (nextPreset: CameraPreset = "ISO") => {
    setPreset(nextPreset);
    setCamera({ ...initialCamera(nextPreset), zoom: 1, panX: 0, panY: 0 });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(mesh),
    onMoveShouldSetPanResponder: (_, gesture) => Boolean(mesh) && (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3),
    onPanResponderGrant: () => { gestureStart.current = camera; },
    onPanResponderMove: (_, gesture) => {
      if (gestureMode === "ROTATE") {
        setCamera((current) => ({ ...current, yaw: gestureStart.current.yaw + gesture.dx * 0.012, pitch: Math.max(-1.45, Math.min(1.45, gestureStart.current.pitch + gesture.dy * 0.01)) }));
      } else {
        setCamera((current) => ({ ...current, panX: gestureStart.current.panX + gesture.dx, panY: gestureStart.current.panY + gesture.dy }));
      }
    },
  }), [camera, gestureMode, mesh]);

  const triangles = useMemo(() => {
    if (!mesh || !bodyVisible) return [] as { id: number; points: string; depth: number; faceId: string; featureId: string; instanceKey?: string; instanceIdentity?: "PROVEN" | "INSTANCE_IDENTITY_UNKNOWN"; vertices: [number, number, number][] }[];
    const { min, max } = mesh.boundingBox;
    const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const scale = Math.min(size.width, size.height) / Math.max(mesh.boundingBox.diagonal, 1) * 1.65 * camera.zoom;
    const rangeForTriangle = (index: number) => mesh.faceRanges.find((range) => index >= range.triangleStart && index < range.triangleStart + range.triangleCount);
    const project = (point: [number, number, number]) => {
      const x = point[0] - center[0];
      const y = point[1] - center[1];
      const z = point[2] - center[2];
      const cosYaw = Math.cos(camera.yaw); const sinYaw = Math.sin(camera.yaw);
      const xYaw = x * cosYaw - y * sinYaw;
      const yYaw = x * sinYaw + y * cosYaw;
      const cosPitch = Math.cos(camera.pitch); const sinPitch = Math.sin(camera.pitch);
      const zPitch = yYaw * sinPitch + z * cosPitch;
      const depth = yYaw * cosPitch - z * sinPitch;
      return { x: size.width / 2 + xYaw * scale + camera.panX, y: size.height / 2 - zPitch * scale + camera.panY, depth };
    };
    return mesh.triangles.map((triangle, index) => {
      const vertices = triangle.map((vertexIndex) => mesh.vertices[vertexIndex]) as [number, number, number][];
      const projected = vertices.map(project);
      const range = rangeForTriangle(index);
      return { id: index, points: projected.map((point) => `${point.x},${point.y}`).join(" "), depth: projected.reduce((sum, point) => sum + point.depth, 0) / 3, faceId: range?.faceId ?? "FACE-UNKNOWN", featureId: range?.featureId ?? "FEATURE-UNKNOWN", instanceKey: range?.instanceKey, instanceIdentity: range?.instanceIdentity, vertices };
    }).filter((triangle) => !hiddenFeatureIds.includes(triangle.featureId) && (!isolatedFeatureId || triangle.featureId === isolatedFeatureId)).sort((a, b) => a.depth - b.depth);
  }, [bodyVisible, camera, hiddenFeatureIds, isolatedFeatureId, mesh, size.height, size.width]);

  const selectTriangle = (triangle: (typeof triangles)[number]) => {
    const next: ViewerSelection = { mode: selectionMode, faceId: triangle.faceId, featureId: triangle.featureId, instanceKey: triangle.instanceKey, instanceIdentity: triangle.instanceIdentity };
    if (selectionMode === "VERTEX") next.vertex = triangle.vertices[0];
    if (selectionMode === "EDGE") next.edge = [triangle.vertices[0], triangle.vertices[1]];
    setSelection(next);
    onSelectionChange?.(next);
  };

  const measurements = mesh ? [
    ["BOX", `${mesh.measurements.width.toFixed(1)} × ${mesh.measurements.depth.toFixed(1)} × ${mesh.measurements.height.toFixed(1)} mm`],
    ["DIAGONAL", `${mesh.measurements.boundingBoxDiagonal.toFixed(2)} mm`],
    ["EDGE", selection?.edge ? `${distance(selection.edge[0], selection.edge[1]).toFixed(2)} mm` : "select an edge"],
    ["VERTEX", selection?.vertex ? `${selection.vertex.map((value) => value.toFixed(1)).join(", ")} mm` : "select a vertex"],
  ] : [];

  return (
    <View style={styles.card}>
      <View style={styles.header}><View><Text style={styles.title}>KERNEL-DERIVED CAD VIEWER</Text><Text style={styles.subTitle}>{mesh ? `${mesh.triangles.length} triangles · ${mesh.faceRanges.length} BRep faces · ${mesh.source}` : "No validated BRep mesh available"}</Text></View><Text style={styles.truth}>{mesh ? "TESSELLATED FROM BREP" : "NO FABRICATED PREVIEW"}</Text></View>
      <View style={styles.viewer} onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...panResponder.panHandlers}>
        {mesh ? <Svg width={size.width} height={size.height}>
          {triangles.map((triangle) => <SvgPolygon key={triangle.id} points={triangle.points} fill={selection?.faceId === triangle.faceId || (selectedInstanceKey && triangle.instanceIdentity === "PROVEN" && triangle.instanceKey === selectedInstanceKey) || selectedFeatureId === triangle.featureId ? "#DE6B35" : "#4F8DB5"} fillOpacity={selection?.faceId === triangle.faceId || (selectedInstanceKey && triangle.instanceKey === selectedInstanceKey) ? 0.92 : 0.76} stroke="#B4D9EF" strokeOpacity={0.52} strokeWidth={0.55} onPress={() => selectTriangle(triangle)} />)}
          {selection?.vertex ? <Circle cx={size.width / 2} cy={size.height / 2} r={4} fill="#F3F1EA" /> : null}
          {selection?.edge ? <Line x1={0} y1={0} x2={0} y2={0} stroke="#F3F1EA" /> : null}
        </Svg> : <View style={styles.empty}><Text style={styles.emptyMark}>◇</Text><Text style={styles.emptyTitle}>AWAITING VALIDATED GEOMETRY</Text><Text style={styles.emptyCopy}>Generate the model to receive an OpenCascade.js tessellation. No unrelated placeholder mesh is shown.</Text></View>}
      </View>
      <View style={styles.controls}>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>VIEW</Text>{(["ISO", "FRONT", "REAR", "TOP", "BOTTOM", "LEFT", "RIGHT"] as CameraPreset[]).map((view) => <Pressable key={view} style={[styles.chip, preset === view && styles.chipActive]} onPress={() => resetCamera(view)}><Text style={[styles.chipText, preset === view && styles.chipTextActive]}>{view}</Text></Pressable>)}</View>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>GESTURE</Text>{(["ROTATE", "PAN"] as GestureMode[]).map((mode) => <Pressable key={mode} style={[styles.chip, gestureMode === mode && styles.chipActive]} onPress={() => setGestureMode(mode)}><Text style={[styles.chipText, gestureMode === mode && styles.chipTextActive]}>{mode}</Text></Pressable>)}<Pressable style={styles.chip} onPress={() => setCamera((current) => ({ ...current, zoom: Math.min(3, current.zoom + 0.2) }))}><Text style={styles.chipText}>ZOOM +</Text></Pressable><Pressable style={styles.chip} onPress={() => setCamera((current) => ({ ...current, zoom: Math.max(0.35, current.zoom - 0.2) }))}><Text style={styles.chipText}>ZOOM −</Text></Pressable><Pressable style={styles.chip} onPress={() => resetCamera("ISO")}><Text style={styles.chipText}>FIT</Text></Pressable></View>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>SELECT</Text>{(["FACE", "EDGE", "VERTEX", "FEATURE"] as ViewerSelectionMode[]).map((mode) => <Pressable key={mode} style={[styles.chip, selectionMode === mode && styles.chipActive]} onPress={() => setSelectionMode(mode)}><Text style={[styles.chipText, selectionMode === mode && styles.chipTextActive]}>{mode}</Text></Pressable>)}</View>
      </View>
      {mesh ? <View style={styles.measurements}>{measurements.map(([label, value]) => <View key={label} style={styles.measurement}><Text style={styles.measurementLabel}>{label}</Text><Text style={styles.measurementValue}>{value}</Text></View>)}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderColor: "#34434B", overflow: "hidden", backgroundColor: "#131D23" },
  header: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#2B3A41", flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { color: "#B7C4C9", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  subTitle: { color: "#7B8A93", fontSize: 9, marginTop: 3 },
  truth: { color: "#67B39F", fontSize: 9, fontWeight: "800", textAlign: "right", maxWidth: 105 },
  viewer: { minHeight: 250, backgroundColor: "#0B1217", justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", padding: 24, gap: 6 },
  emptyMark: { color: "#6EA4CA", fontSize: 52, lineHeight: 58 },
  emptyTitle: { color: "#F3F1EA", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  emptyCopy: { color: "#81929A", textAlign: "center", fontSize: 11, lineHeight: 17 },
  controls: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: "#2B3A41" },
  controlRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  controlLabel: { width: 56, color: "#7B8A93", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  chip: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: "#34434B" },
  chipActive: { backgroundColor: "#1167B1", borderColor: "#1167B1" },
  chipText: { color: "#A9B6BC", fontSize: 9, fontWeight: "800" },
  chipTextActive: { color: "#F3F1EA" },
  measurements: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#2B3A41" },
  measurement: { width: "50%", padding: 11, gap: 3, borderBottomWidth: 1, borderBottomColor: "#243139" },
  measurementLabel: { color: "#6EA4CA", fontSize: 9, fontWeight: "800" },
  measurementValue: { color: "#D7E0E3", fontSize: 11, lineHeight: 16 },
});
