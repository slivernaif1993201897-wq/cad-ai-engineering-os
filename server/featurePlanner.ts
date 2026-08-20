import type { CADParameter } from "../shared/cad";
import type { CADPlanV2, PlannedFeature } from "../shared/cadAgent";
import type { RequirementSet } from "../shared/requirements";

export function makeMountingParameters(input: {
  width: number;
  depth: number;
  height: number;
  holeDiameter: number;
  holeEdgeOffset: number;
  filletRadius: number;
}) {
  const parameter = (name: string, value: number): CADParameter => ({ name, value, unit: "mm", editable: true, source: "USER" });
  return [
    parameter("width", input.width),
    parameter("depth", input.depth),
    parameter("height", input.height),
    parameter("holeDiameter", input.holeDiameter),
    parameter("holeEdgeOffset", input.holeEdgeOffset),
    parameter("filletRadius", input.filletRadius),
  ];
}

function feature(
  id: string,
  type: PlannedFeature["type"],
  featureType: PlannedFeature["featureType"],
  dependsOn: string[],
  parameters: CADParameter[],
  requirementIds: string[],
): PlannedFeature {
  return {
    id,
    type,
    featureType,
    status: "APPLIED",
    dependsOn,
    parentFeatures: dependsOn,
    parameters,
    geometryReference: `GEOMETRY-${id}`,
    executionStatus: "PLANNED",
    traceabilityRequirementIds: requirementIds,
  };
}

export function planMountingBlockFeatures(
  requirementSet: RequirementSet,
  input: { width: number; depth: number; height: number; holeDiameter: number; holeEdgeOffset: number; filletRadius: number },
  planId: string,
): CADPlanV2 {
  const parameters = makeMountingParameters(input);
  const requirementIds = requirementSet.requirements.filter((requirement) => requirement.status === "VALIDATED").map((requirement) => requirement.requirement_id);
  const byName = (names: string[]) => parameters.filter((parameter) => names.includes(parameter.name));
  const features: PlannedFeature[] = [
    feature("FEATURE-001", "BOX", "BOX", [], byName(["width", "depth", "height"]), requirementIds),
    feature("FEATURE-002", "FILLET", "FILLET", ["FEATURE-001"], byName(["filletRadius"]), requirementIds),
    feature("FEATURE-003", "HOLE", "HOLE", ["FEATURE-001"], byName(["holeDiameter", "holeEdgeOffset"]), requirementIds),
    feature("FEATURE-004", "HOLE_PATTERN", "PATTERN", ["FEATURE-003"], byName(["holeDiameter", "holeEdgeOffset"]), requirementIds),
    feature("FEATURE-005", "CUT", "CUT", ["FEATURE-001", "FEATURE-002", "FEATURE-004"], byName(["holeDiameter", "holeEdgeOffset"]), requirementIds),
  ];

  return {
    plan_id: planId,
    units: "mm",
    coordinate_system: { id: "CSYS-WORLD", origin: [0, 0, 0], axes: { x: "+X", y: "+Y", z: "+Z" }, unit: "mm" },
    parameters,
    sketches: [{ id: "SKETCH-NOT-REQUIRED", plane: "XY", constraints: [], status: "NOT_REQUIRED" }],
    features,
    feature_order: features.map((item) => item.id),
    constraints: ["All dimensions are positive.", "Hole diameter and offsets fit inside the footprint.", "Fillet radius is less than half the minimum block dimension."],
    references: requirementSet.traceability,
    validation_rules: ["RequirementSet must be VALIDATED.", "OpenCascade BRepCheck_Analyzer must accept the final solid.", "STEP serialization must complete before export."],
    execution_notes: ["The current OpenCascade adapter applies the external fillet to the base block before cutting holes. This topology order is deliberate: filleting after intersecting hole topology did not produce a kernel result in the verified runtime."],
    expected_outputs: ["SOLID", "STEP", "TESSELLATED_VIEWER_MESH", "BOUNDING_BOX"],
    model_status: "CONCEPTUAL",
    requirement_set_id: requirementSet.id,
    revision: requirementSet.revision,
  };
}
