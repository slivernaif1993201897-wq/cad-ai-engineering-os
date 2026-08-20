import initOpenCascade from "opencascade.js/dist/node.js";
import { parseRequirements } from "./requirementsAgent";
import type {
  CADArtifact,
  CADFeature,
  CADGenerationResult,
  CADPlan,
  MountingBlockInput,
  OpenQuestion,
  Requirement,
} from "../shared/cad";

let kernelPromise: ReturnType<typeof initOpenCascade> | undefined;

async function getKernel() {
  kernelPromise ??= initOpenCascade();
  return kernelPromise;
}

function makeRequirement(input: MountingBlockInput, prompt: string): Requirement {
  const openQuestions: OpenQuestion[] = input.approveAssumption
    ? []
    : [
        {
          id: "OQ-HOLE-EDGE-OFFSET",
          question: "What exact edge offset should locate the four holes?",
          whyItMatters: "The phrase near the corners does not define a measurable hole center location.",
          assumption: "10 mm from each adjacent edge is used only when the user acknowledges the assumption.",
          status: "OPEN",
        },
      ];

  return {
    id: "REQ-MOUNTING-BLOCK-001",
    description: prompt,
    status: openQuestions.length ? "OPEN_QUESTION" : "VALIDATED",
    source: "NATURAL_LANGUAGE",
    parameters: [
      { name: "width", value: input.width, unit: "mm", editable: true, source: "USER" },
      { name: "depth", value: input.depth, unit: "mm", editable: true, source: "USER" },
      { name: "height", value: input.height, unit: "mm", editable: true, source: "USER" },
      { name: "holeDiameter", value: input.holeDiameter, unit: "mm", editable: true, source: "USER" },
      { name: "filletRadius", value: input.filletRadius, unit: "mm", editable: true, source: "USER" },
      { name: "holeEdgeOffset", value: input.holeEdgeOffset, unit: "mm", editable: true, source: input.approveAssumption ? "USER" : "ASSUMPTION" },
    ],
    openQuestions,
  };
}

function feature(id: string, type: string, status: CADFeature["status"], dependsOn: string[], parameters: CADFeature["parameters"], note?: string): CADFeature {
  return { id, type, status, dependsOn, parameters, ...(note ? { note } : {}) };
}

export async function generateMountingBlock(input: MountingBlockInput, prompt: string): Promise<CADGenerationResult> {
  const parsedRequirements = parseRequirements(prompt);
  let requirementSet = parsedRequirements.requirementSet;
  if (/mounting block/i.test(prompt) && requirementSet.conflicts.length === 0 && requirementSet.open_questions.every((question) => question.id === "OPEN-SPECIFICATION-001")) {
    requirementSet = parseRequirements(`${input.width} mm x ${input.depth} mm x ${input.height} mm mounting block with ${input.holeDiameter} mm diameter holes and ${input.filletRadius} mm radius fillet`).requirementSet;
    requirementSet.source_text = prompt;
  }
  if (!input.approveAssumption) {
    requirementSet.open_questions.push({
      id: "OPEN-HOLE-OFFSET-001",
      question: "What exact edge offset should locate the four holes?",
      whyItMatters: "The phrase near the corners does not define a measurable hole center location.",
      severity: "IMPORTANT",
      relatedRequirementIds: requirementSet.requirements.map((item) => item.requirement_id),
    });
    requirementSet.validation_status = "OPEN_QUESTION";
  }
  const plan: CADPlan = {
    id: "PLAN-MOUNTING-BLOCK-001",
    intent: "Create a parametric mounting block with four through holes and an external edge fillet.",
    requirements: [makeRequirement(input, prompt)],
    kernel: "OpenCascade.js",
    deterministic: true,
    features: [],
  };

  const p = (name: string, value: number, source: "USER" | "ASSUMPTION" = "USER") => ({ name, value, unit: "mm" as const, editable: true, source });
  const offsetSource = input.approveAssumption ? "USER" : "ASSUMPTION";
  const features: CADFeature[] = [
    feature("FEATURE-001", "BOX", "APPLIED", [], [p("width", input.width), p("depth", input.depth), p("height", input.height)]),
    feature("FEATURE-002", "HOLE_PATTERN", "APPLIED", ["FEATURE-001"], [p("diameter", input.holeDiameter), p("edgeOffset", input.holeEdgeOffset, offsetSource)], input.approveAssumption ? undefined : "Uses an explicit, reviewable 10 mm edge-offset assumption."),
    feature("FEATURE-003", "FILLET", "APPLIED", ["FEATURE-002"], [p("radius", input.filletRadius)]),
  ];
  plan.features = features;

  if (requirementSet.validation_status === "CONFLICT") {
    plan.requirements[0].status = "CONFLICT";
    features[1].status = "UNSUPPORTED";
    features[2].status = "UNSUPPORTED";
    return { plan, requirementSet, error: "Requirement conflict detected; resolve conflicting values before CAD generation." };
  }
  if (requirementSet.validation_status !== "VALIDATED") {
    plan.requirements[0].status = "OPEN_QUESTION";
    features[1].status = "UNSUPPORTED";
    features[2].status = "UNSUPPORTED";
    return { plan, requirementSet, error: "Requirements are not validated; resolve all OPEN_QUESTION items before CAD generation." };
  }
  if (input.width <= 0 || input.depth <= 0 || input.height <= 0 || input.holeDiameter <= 0 || input.filletRadius < 0 || input.holeEdgeOffset <= 0) {
    return { plan, error: "All dimensions must be positive and expressed in millimetres." };
  }
  if (input.holeDiameter >= Math.min(input.width, input.depth) || input.holeEdgeOffset * 2 + input.holeDiameter > Math.min(input.width, input.depth)) {
    return { plan, error: "Hole diameter and edge offset do not fit inside the block footprint." };
  }
  if (input.filletRadius >= Math.min(input.width, input.depth, input.height) / 2) {
    return { plan, error: "Fillet radius is too large for the block dimensions." };
  }

  const oc = await getKernel();
  const progress = new oc.Message_ProgressRange_1();
  const box = new oc.BRepPrimAPI_MakeBox_2(input.width, input.depth, input.height);
  let current = box.Shape();
  let filletApplied = false;
  let fillet: any;
  try {
    fillet = new (oc.BRepFilletAPI_MakeFillet as any)(current, (oc.ChFi3d_FilletShape as any).ChFi3d_Rational);
    const explorer = new oc.TopExp_Explorer_2(current, (oc.TopAbs_ShapeEnum as any).TopAbs_EDGE, (oc.TopAbs_ShapeEnum as any).TopAbs_SHAPE);
    let count = 0;
    while (explorer.More() && count < 12) {
      fillet.Add_2(input.filletRadius, oc.TopoDS.Edge_1(explorer.Current()));
      explorer.Next();
      count += 1;
    }
    fillet.Build(progress);
    filletApplied = Boolean(fillet.IsDone?.() ?? fillet.HasResult());
    if (filletApplied) current = fillet.Shape();
    explorer.delete();
  } catch {
    filletApplied = false;
  }
  const cuts: any[] = [];
  const holePositions = [
    [input.holeEdgeOffset, input.holeEdgeOffset],
    [input.width - input.holeEdgeOffset, input.holeEdgeOffset],
    [input.width - input.holeEdgeOffset, input.depth - input.holeEdgeOffset],
    [input.holeEdgeOffset, input.depth - input.holeEdgeOffset],
  ];

  for (const [x, y] of holePositions) {
    const axis = new (oc.gp_Ax2_3 as any)(new (oc.gp_Pnt_3 as any)(x, y, -1), new (oc.gp_Dir_4 as any)(0, 0, 1));
    const cylinder = new oc.BRepPrimAPI_MakeCylinder_3(axis, input.holeDiameter / 2, input.height + 2);
    const cut = new oc.BRepAlgoAPI_Cut_3(current, cylinder.Shape(), progress);
    cut.Build(progress);
    current = cut.Shape();
    cuts.push(cylinder, cut);
    axis.delete();
  }

  features[2].status = filletApplied ? "APPLIED" : "FAILED";
  if (!filletApplied) features[2].note = "OpenCascade.js could not complete the requested edge set; the artifact is not marked as filleted.";

  const analyzer = new oc.BRepCheck_Analyzer(current, true, false);
  const valid = Boolean(analyzer.IsValid_2());
  const stepPath = `/cad-ai-${Date.now()}.step`;
  const writer = new oc.STEPControl_Writer_1();
  writer.Transfer(current, (oc.STEPControl_StepModelType as any).STEPControl_AsIs, true, progress);
  writer.Write(stepPath);
  const stepBytes = Buffer.from((oc as any).FS.readFile(stepPath));
  (oc as any).FS.unlink(stepPath);

  const artifact: CADArtifact = {
    id: `ARTIFACT-${Date.now()}`,
    kernel: "OpenCascade.js",
    validationStatus: valid && filletApplied ? "VALID" : "INVALID",
    shapeKind: "SOLID",
    featureTree: features,
    parameters: plan.requirements[0].parameters,
    openQuestions: plan.requirements[0].openQuestions,
    stepBase64: stepBytes.toString("base64"),
    stepByteLength: stepBytes.byteLength,
    viewerAvailable: false,
    viewerNote: "A native mobile BRep viewer is not bundled in this vertical slice. The STEP artifact and validation evidence are available; no fabricated mesh preview is shown.",
  };

  analyzer.delete();
  writer.delete();
  if (fillet?.delete) fillet.delete();
  for (const item of cuts) item.delete?.();
  box.delete();

  return { plan, artifact, requirementSet };
}
