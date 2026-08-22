import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { admitControlledUserJob } from "../../shared/controlledUserJob";

const [manifestPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !outputPath) throw new Error("Expected manifest and output paths.");
const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
const invalid = { ...manifest, cadArtifactHash: "0".repeat(64) };
const receipt = admitControlledUserJob(invalid);
if (receipt.state !== "REJECTED" || receipt.reasonCodes[0] !== "CAD_ARTIFACT_HASH_MISMATCH" || receipt.executionStarted || receipt.genericSolverExecutionStarted) {
  throw new Error("INVALID_INPUT_REJECTION_NOT_ENFORCED");
}
writeFileSync(resolve(outputPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
