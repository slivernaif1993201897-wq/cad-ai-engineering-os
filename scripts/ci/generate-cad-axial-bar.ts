import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getOpenCascadeKernel } from "../../server/cadKernel";

const sha256 = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");
const outputRoot = join(process.cwd(), "artifacts", "cad");
const stepOutput = join(outputRoot, "axial-bar.step");
const provenanceOutput = join(outputRoot, "axial-bar.provenance.json");

/**
 * Fixed, deterministic benchmark geometry. This is not a user-submitted CAE job.
 * The solid is constructed and STEP-exported by the same OpenCascade.js kernel that
 * CAD-AI uses for its validated geometry flow.
 */
async function main() {
  await mkdir(outputRoot, { recursive: true });
  const oc = await getOpenCascadeKernel();
  const progress = new oc.Message_ProgressRange_1();
  const box = new oc.BRepPrimAPI_MakeBox_2(10, 10, 100);
  const shape = box.Shape();
  const analyzer = new oc.BRepCheck_Analyzer(shape, true, false);
  if (!analyzer.IsValid_2())
    throw new Error(
      "OpenCascade rejected the fixed axial-bar benchmark solid.",
    );
  const wasmPath = "/cad-ai-ci-axial-bar.step";
  const writer = new oc.STEPControl_Writer_1();
  try {
    writer.Transfer(
      shape,
      (oc.STEPControl_StepModelType as any).STEPControl_AsIs,
      true,
      progress,
    );
    writer.Write(wasmPath);
    const stepBytes = Buffer.from((oc as any).FS.readFile(wasmPath));
    if (!stepBytes.byteLength)
      throw new Error("OpenCascade STEP export produced no bytes.");
    await writeFile(stepOutput, stepBytes);
    const provenance = {
      artifactKind: "CAD_STEP",
      benchmarkIdentity: "CAD-AI-AXIAL-BAR-OPEN-CASCADE-V1",
      kernel: "OpenCascade.js",
      geometry: { widthMm: 10, depthMm: 10, lengthMm: 100, shapeKind: "SOLID" },
      cadTruthStatus: "KERNEL_VALIDATED",
      engineeringTruthStatus: "NOT_ENGINEERING_VALIDATED",
      stepSha256: sha256(stepBytes),
      byteLength: stepBytes.byteLength,
      generatedAt: new Date().toISOString(),
      sourceControl: {
        fixedRepositoryScript: "scripts/ci/generate-cad-axial-bar.ts",
        userSuppliedGeometry: false,
      },
    };
    await writeFile(
      provenanceOutput,
      `${JSON.stringify(provenance, null, 2)}\n`,
      "utf8",
    );
  } finally {
    try {
      (oc as any).FS.unlink(wasmPath);
    } catch {
      /* absent after a failed write */
    }
    writer.delete?.();
    analyzer.delete?.();
    box.delete?.();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
