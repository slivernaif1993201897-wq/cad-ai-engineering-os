import { createHash } from "node:crypto";

import { extractKernelViewerMesh, getOpenCascadeKernel, mergeKernelViewerMeshes } from "./cadKernel";

export type SeatParametricModel = {
  seatRevisionId: string;
  identity: { designName: string; revisionNumber: number };
  dimensionsMm: {
    cushionWidth: number; cushionDepth: number; cushionThickness: number;
    backHeight: number; backThickness: number;
    supportWidth: number; supportThickness: number;
    frameDepth: number; frameHeight: number;
    mountRadius: number; mountHeight: number;
  };
  materials: { cushion: string; back: string; frame: string; supports: string };
  constraints: { minimumBackHeight: number; minimumMountClearance: number };
};

export type SeatCadArtifact = {
  seatRevisionId: string;
  cadRevisionHash: string;
  artifactHash: string;
  stepBase64: string;
  stepByteLength: number;
  kernel: "OpenCascade.js";
  validationStatus: "VALID";
  featureTree: Array<{ id: string; type: string; material: string; dependsOn: string[] }>;
  viewerMesh: ReturnType<typeof mergeKernelViewerMeshes>;
};

function sha(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function assertSeatModel(model: SeatParametricModel) {
  const d = model.dimensionsMm;
  const numbers = Object.entries(d);
  if (!model.seatRevisionId || !model.identity.designName.trim() || !Number.isInteger(model.identity.revisionNumber) || model.identity.revisionNumber < 1) throw new Error("SEAT_REVISION_IDENTITY_REQUIRED");
  if (numbers.some(([, value]) => !Number.isFinite(value) || value <= 0)) throw new Error("SEAT_DIMENSIONS_MUST_BE_POSITIVE_MM");
  if (d.backHeight < model.constraints.minimumBackHeight || d.mountHeight < model.constraints.minimumMountClearance) throw new Error("SEAT_GEOMETRIC_CONSTRAINT_UNSATISFIED");
  if (d.supportWidth * 2 >= d.cushionWidth || d.backThickness >= d.cushionDepth || d.mountRadius * 4 >= Math.min(d.cushionWidth, d.cushionDepth)) throw new Error("SEAT_GEOMETRY_DIMENSIONS_DO_NOT_FIT");
  if (Object.values(model.materials).some((material) => !material.trim())) throw new Error("SEAT_MATERIAL_ASSIGNMENTS_REQUIRED");
}

/** Generates actual parameterized OpenCascade solids, validates the compound BRep, and exports a deterministic STEP artifact. */
export async function generateSeatCadArtifact(model: SeatParametricModel): Promise<SeatCadArtifact> {
  assertSeatModel(model);
  const oc: any = await getOpenCascadeKernel();
  const d = model.dimensionsMm;
  const compound = new oc.TopoDS_Compound();
  const builder = new oc.BRep_Builder();
  builder.MakeCompound(compound);
  const resources: any[] = [compound, builder];
  const meshItems: Array<{ mesh: ReturnType<typeof extractKernelViewerMesh>; instanceKey: string; instanceIdentity: "PROVEN" }> = [];
  const features: SeatCadArtifact["featureTree"] = [];
  const progress = new oc.Message_ProgressRange_1();
  resources.push(progress);

  const addBox = (id: string, width: number, depth: number, height: number, x: number, y: number, z: number, material: string, dependsOn: string[] = []) => {
    const primitive = new oc.BRepPrimAPI_MakeBox_2(width, depth, height);
    const vector = new oc.gp_Vec_4(x, y, z);
    const transform = new oc.gp_Trsf_1();
    transform.SetTranslation_1(vector);
    const placed = new oc.BRepBuilderAPI_Transform_2(primitive.Shape(), transform, true);
    builder.Add(compound, placed.Shape());
    meshItems.push({ mesh: extractKernelViewerMesh(oc, placed.Shape(), id), instanceKey: id, instanceIdentity: "PROVEN" });
    features.push({ id, type: "PARAMETRIC_SOLID", material, dependsOn });
    resources.push(primitive, vector, transform, placed);
  };
  const addMount = (id: string, x: number, y: number) => {
    const point = new oc.gp_Pnt_3(x, y, -d.mountHeight);
    const direction = new oc.gp_Dir_4(0, 0, 1);
    const axis = new oc.gp_Ax2_3(point, direction);
    const cylinder = new oc.BRepPrimAPI_MakeCylinder_3(axis, d.mountRadius, d.mountHeight);
    builder.Add(compound, cylinder.Shape());
    meshItems.push({ mesh: extractKernelViewerMesh(oc, cylinder.Shape(), id), instanceKey: id, instanceIdentity: "PROVEN" });
    features.push({ id, type: "MOUNTING_POINT", material: model.materials.frame, dependsOn: ["FRAME"] });
    resources.push(point, direction, axis, cylinder);
  };

  try {
    addBox("CUSHION", d.cushionWidth, d.cushionDepth, d.cushionThickness, 0, 0, 0, model.materials.cushion);
    addBox("BACK", d.cushionWidth, d.backThickness, d.backHeight, 0, d.cushionDepth - d.backThickness, d.cushionThickness, model.materials.back, ["CUSHION"]);
    addBox("LEFT_SUPPORT", d.supportWidth, d.supportThickness, d.backHeight, 0, d.cushionDepth - d.supportThickness, d.cushionThickness, model.materials.supports, ["BACK"]);
    addBox("RIGHT_SUPPORT", d.supportWidth, d.supportThickness, d.backHeight, d.cushionWidth - d.supportWidth, d.cushionDepth - d.supportThickness, d.cushionThickness, model.materials.supports, ["BACK"]);
    addBox("FRAME", d.cushionWidth, d.frameDepth, d.frameHeight, 0, (d.cushionDepth - d.frameDepth) / 2, -d.frameHeight, model.materials.frame, ["CUSHION"]);
    const offsetX = d.mountRadius * 2; const offsetY = d.mountRadius * 2;
    addMount("MOUNT_FL", offsetX, offsetY); addMount("MOUNT_FR", d.cushionWidth - offsetX, offsetY);
    addMount("MOUNT_RL", offsetX, d.cushionDepth - offsetY); addMount("MOUNT_RR", d.cushionWidth - offsetX, d.cushionDepth - offsetY);
    const analyzer = new oc.BRepCheck_Analyzer(compound, true, false);
    const valid = Boolean(analyzer.IsValid_2());
    analyzer.delete?.();
    if (!valid) throw new Error("SEAT_OPEN_CASCADE_BREP_INVALID");
    const writer = new oc.STEPControl_Writer_1();
    const path = `/seat-${sha({ id: model.seatRevisionId, revision: model.identity.revisionNumber }).slice(0, 16)}.step`;
    writer.Transfer(compound, oc.STEPControl_StepModelType.STEPControl_AsIs, true, progress);
    writer.Write(path);
    const raw = Buffer.from(oc.FS.readFile(path)); oc.FS.unlink(path); writer.delete?.();
    const step = Buffer.from(raw.toString("utf8").replace(/(FILE_NAME\('[^']*',)'[^']*'/, "$1'1970-01-01T00:00:00'"), "utf8");
    const artifactHash = sha(step);
    const cadRevisionHash = sha({ seatRevisionId: model.seatRevisionId, identity: model.identity, dimensionsMm: model.dimensionsMm, materials: model.materials, constraints: model.constraints, artifactHash });
    return { seatRevisionId: model.seatRevisionId, cadRevisionHash, artifactHash, stepBase64: step.toString("base64"), stepByteLength: step.byteLength, kernel: "OpenCascade.js", validationStatus: "VALID", featureTree: features, viewerMesh: mergeKernelViewerMeshes(meshItems) };
  } finally {
    for (const resource of resources.reverse()) resource.delete?.();
  }
}
