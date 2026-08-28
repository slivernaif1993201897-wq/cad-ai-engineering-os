import { describe, expect, it } from "vitest";
import { svgForMesh } from "../server/cadArtifactOperations";

const validMesh = {
  source: "OpenCascade.js" as const,
  tessellation: "BRepMesh_IncrementalMesh" as const,
  vertices: [[0, 0, 0], [10, 0, 0], [0, 10, 0]] as [number, number, number][],
  triangles: [[0, 1, 2]] as [number, number, number][],
  faceRanges: [{ faceId: "FACE-001", featureId: "TEST", triangleStart: 0, triangleCount: 1 }],
  boundingBox: { min: [0, 0, 0] as [number, number, number], max: [10, 10, 0] as [number, number, number], size: [10, 10, 0] as [number, number, number], diagonal: Math.sqrt(200) },
  measurements: { width: 10, depth: 10, height: 0, boundingBoxDiagonal: Math.sqrt(200) },
};

describe("production SVG mesh limits", () => {
  it("renders a bounded valid production mesh", () => {
    expect(svgForMesh(validMesh, "FRONT", "test drawing")).toContain("<polygon points=");
  });

  it("rejects an empty mesh before SVG construction", () => {
    expect(() => svgForMesh({ ...validMesh, vertices: [], triangles: [] }, "FRONT", "empty")).toThrow("ENGINE_LIMIT_EXCEEDED");
  });

  it("rejects invalid triangle indices before SVG construction", () => {
    expect(() => svgForMesh({ ...validMesh, triangles: [[0, 1, 9]] }, "FRONT", "invalid")).toThrow("ENGINE_LIMIT_EXCEEDED");
  });
});
