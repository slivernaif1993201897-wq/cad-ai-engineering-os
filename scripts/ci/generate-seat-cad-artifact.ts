import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { generateSeatCadArtifact, type SeatParametricModel } from "../../server/seatCadEngine";

const output = join(process.cwd(), "artifacts", "seat-cad", "input");

const model: SeatParametricModel = {
  seatRevisionId: "SEAT-REVISION-RUNTIME-001",
  identity: { designName: "Front seat structural reference", revisionNumber: 1 },
  dimensionsMm: { cushionWidth: 480, cushionDepth: 460, cushionThickness: 80, backHeight: 520, backThickness: 60, supportWidth: 35, supportThickness: 35, frameDepth: 330, frameHeight: 45, mountRadius: 12, mountHeight: 35 },
  materials: { cushion: "PU foam — explicitly declared", back: "Trim shell — explicitly declared", frame: "HSLA steel — explicitly declared", supports: "HSLA steel — explicitly declared" },
  constraints: { minimumBackHeight: 400, minimumMountClearance: 25 },
};

async function main() {
  const artifact = await generateSeatCadArtifact(model);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "seat-engineering.step"), Buffer.from(artifact.stepBase64, "base64"));
  await writeFile(join(output, "seat-cad-binding.json"), `${JSON.stringify({ seatRevisionId: artifact.seatRevisionId, cadRevisionHash: artifact.cadRevisionHash, cadArtifactHash: artifact.artifactHash, stepByteLength: artifact.stepByteLength, kernel: artifact.kernel, validationStatus: artifact.validationStatus, featureIds: artifact.featureTree.map((feature) => feature.id) }, null, 2)}\n`, "utf8");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "SEAT_CAD_ARTIFACT_GENERATION_FAILED"); process.exitCode = 1; });
