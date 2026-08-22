import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getOpenCascadeKernel } from "../../server/cadKernel";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const outputRoot = join(process.cwd(), "artifacts", "generic-job", "input");
const stepOutput = join(outputRoot, "generic-cantilever.step");
const provenanceOutput = join(outputRoot, "generic-cantilever.provenance.json");

/**
 * Repository-controlled generic job geometry, intentionally distinct from the
 * fixed axial-bar benchmark. This is real OpenCascade output, not an uploaded CAD file.
 */
async function main() {
  await mkdir(outputRoot, { recursive: true });
  const oc = await getOpenCascadeKernel();
  const progress = new oc.Message_ProgressRange_1();
  const box = new oc.BRepPrimAPI_MakeBox_2(20, 10, 80);
  const shape = box.Shape();
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  if (!analyzer.IsValid_2()) throw new Error("OpenCascade rejected the generic cantilever solid.");
  const wasmPath = "/cad-ai-generic-cantilever.step";
  const writer = new oc.STEPControl_Writer_1();
  try {
    writer.Transfer(shape, (oc.STEPControl_StepModelType as any).STEPControl_AsIs, true, progress);
    writer.Write(wasmPath);
    const stepBytes = Buffer.from((oc as any).FS.readFile(wasmPath));
    if (!stepBytes.byteLength) throw new Error("OpenCascade STEP export produced no bytes.");
    await writeFile(stepOutput, stepBytes);
    await writeFile(provenanceOutput, `${JSON.stringify({
      artifactKind: "CAD_STEP",
      jobIdentity: "GENERIC-CANTILEVER-USER-JOB-001",
      geometry: { widthMm: 20, depthMm: 10, lengthMm: 80, shapeKind: "SOLID" },
      kernel: "OpenCascade.js",
      cadTruthStatus: "KERNEL_VALIDATED",
      engineeringTruthStatus: "NOT_ENGINEERING_VALIDATED",
      stepSha256: sha256(stepBytes),
      generatedAt: new Date().toISOString(),
      sourceControl: { fixedRepositoryScript: "scripts/ci/generate-cad-generic-cantilever.ts", userSuppliedGeometry: false },
    }, null, 2)}\n`, "utf8");
  } finally {
    try { (oc as any).FS.unlink(wasmPath); } catch { /* absent after failed write */ }
    writer.delete?.();
    analyzer.delete?.();
    box.delete?.();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
