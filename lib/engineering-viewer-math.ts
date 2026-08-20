import type { EngineeringViewerScene, ViewerCameraState } from "@/shared/engineeringViewer";

export type ViewerViewport = { width: number; height: number };
export type ProjectedPoint = { x: number; y: number; depth: number };

export function presetCamera(preset: ViewerCameraState["preset"]): ViewerCameraState {
  const yawPitch: Record<ViewerCameraState["preset"], Pick<ViewerCameraState, "yaw" | "pitch">> = {
    FRONT: { yaw: 0, pitch: 0 }, REAR: { yaw: Math.PI, pitch: 0 }, TOP: { yaw: 0, pitch: Math.PI / 2 }, BOTTOM: { yaw: 0, pitch: -Math.PI / 2 }, LEFT: { yaw: Math.PI / 2, pitch: 0 }, RIGHT: { yaw: -Math.PI / 2, pitch: 0 }, ISO: { yaw: -Math.PI / 4, pitch: Math.PI / 6 },
  };
  return { ...yawPitch[preset], preset, zoom: 1, panX: 0, panY: 0 };
}

export function rotateViewerPoint(point: [number, number, number], scene: EngineeringViewerScene, camera: ViewerCameraState) {
  const bounds = scene.boundingBox; if (!bounds) return { x: point[0], y: point[1], z: point[2] };
  const center: [number, number, number] = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
  const x = point[0] - center[0]; const y = point[1] - center[1]; const z = point[2] - center[2];
  const xYaw = x * Math.cos(camera.yaw) - y * Math.sin(camera.yaw); const yYaw = x * Math.sin(camera.yaw) + y * Math.cos(camera.yaw);
  return { x: xYaw, y: yYaw * Math.sin(camera.pitch) + z * Math.cos(camera.pitch), z: yYaw * Math.cos(camera.pitch) - z * Math.sin(camera.pitch) };
}

export function projectViewerPoint(point: [number, number, number], scene: EngineeringViewerScene, camera: ViewerCameraState, viewport: ViewerViewport): ProjectedPoint {
  const rotated = rotateViewerPoint(point, scene, camera); const diagonal = scene.boundingBox?.diagonal || 1; const scale = Math.min(viewport.width, viewport.height) / Math.max(diagonal, 1) * 1.7 * camera.zoom;
  return { x: viewport.width / 2 + rotated.x * scale + camera.panX, y: viewport.height / 2 - rotated.y * scale + camera.panY, depth: rotated.z };
}

function containsPoint(point: { x: number; y: number }, a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint) {
  const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const first = cross(a, b, point); const second = cross(b, c, point); const third = cross(c, a, point);
  return (first >= 0 && second >= 0 && third >= 0) || (first <= 0 && second <= 0 && third <= 0);
}

export function hitTestViewerFace(scene: EngineeringViewerScene, camera: ViewerCameraState, viewport: ViewerViewport, point: { x: number; y: number }) {
  if (!scene.mesh) return undefined;
  let hit: { faceId: string; triangleIndex: number; depth: number; vertices: [number, number, number][] } | undefined;
  const faceForTriangle = (triangleIndex: number) => scene.mesh!.faceRanges.find((range) => triangleIndex >= range.triangleStart && triangleIndex < range.triangleStart + range.triangleCount);
  scene.mesh.triangles.forEach((triangle, triangleIndex) => {
    const vertices = triangle.map((index) => scene.mesh!.vertices[index]) as [number, number, number][]; const projected = vertices.map((vertex) => projectViewerPoint(vertex, scene, camera, viewport));
    if (!containsPoint(point, projected[0], projected[1], projected[2])) return;
    const depth = (projected[0].depth + projected[1].depth + projected[2].depth) / 3; const face = faceForTriangle(triangleIndex);
    if (!face) return;
    if (!hit || depth > hit.depth) hit = { faceId: face.faceId, triangleIndex, depth, vertices };
  });
  return hit;
}

export function distance3D(a: [number, number, number], b: [number, number, number]) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
export function angle3D(a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
  const ab = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const cb = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]; const denominator = Math.hypot(...ab) * Math.hypot(...cb); if (!denominator) return undefined;
  return Math.acos(Math.max(-1, Math.min(1, (ab[0] * cb[0] + ab[1] * cb[1] + ab[2] * cb[2]) / denominator))) * 180 / Math.PI;
}
