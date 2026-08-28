import { createHash } from "node:crypto";
import { exportValidatedStep, extractKernelViewerMesh, getOpenCascadeKernel, mergeKernelViewerMeshes } from "./cadKernel";
import { runWithOpenCascadeAdmission } from "./runtimeAdmission";

export type BackrestConceptInput = { seatRevisionId: string; widthMm: number; heightMm: number; thicknessMm: number };
export type BackrestConceptArtifact = { artifactHash: string; cadRevisionHash: string; stepBase64: string; stepByteLength: number; kernel: "OpenCascade.js"; geometryStatus: "PARTIAL_CAD"; undefinedFeatures: string[]; viewerMesh: ReturnType<typeof mergeKernelViewerMeshes> };
const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

/** Generates only the user-defined backrest plate envelope; rails, mounts, welds, and materials remain explicit required inputs. */
export async function generateBackrestConceptCad(input: BackrestConceptInput): Promise<BackrestConceptArtifact> {
  if (!input.seatRevisionId || [input.widthMm, input.heightMm, input.thicknessMm].some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("CONCEPT_CAD_DIMENSIONS_REQUIRED_POSITIVE_MM");
  return runWithOpenCascadeAdmission({ projectId: input.seatRevisionId, resourceClass: "CAD_AUTHORING" }, async () => {
  const oc: any = await getOpenCascadeKernel();
  const solid = new oc.BRepPrimAPI_MakeBox_2(input.widthMm, input.thicknessMm, input.heightMm);
  const shape = solid.Shape();
  const checker = new oc.BRepCheck_Analyzer(shape, true, false);
  let progress: any;
  try {
    if (!checker.IsValid_2()) throw new Error("CONCEPT_CAD_BREP_INVALID");
    progress = new oc.Message_ProgressRange_1();
    const step = exportValidatedStep(oc, shape, progress, `concept-backrest-${sha(input.seatRevisionId).slice(0, 16)}`);
    // The artifact hash is the SHA-256 of the exact persisted STEP bytes, never a JSON serialization of a Buffer.
    const artifactHash = createHash("sha256").update(step).digest("hex");
    const cadRevisionHash = sha({ concept: "BACKREST_LOAD_PATH", seatRevisionId: input.seatRevisionId, input, artifactHash });
    return { artifactHash, cadRevisionHash, stepBase64: step.toString("base64"), stepByteLength: step.byteLength, kernel: "OpenCascade.js", geometryStatus: "PARTIAL_CAD", undefinedFeatures: ["STRUCTURAL_RAIL_GEOMETRY", "MOUNTING_ARCHITECTURE", "WELD_LAYOUT", "MATERIAL_ASSIGNMENT"], viewerMesh: mergeKernelViewerMeshes([{ mesh: extractKernelViewerMesh(oc, shape, "BACKREST_ENVELOPE"), instanceKey: "BACKREST_ENVELOPE", instanceIdentity: "PROVEN" }]) };
  } finally { progress?.delete?.(); checker.delete?.(); solid.delete?.(); }
  });
}
