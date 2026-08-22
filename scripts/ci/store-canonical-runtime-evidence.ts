import { readFile } from "node:fs/promises";

import { storeCanonicalRuntimeEvidence } from "../../server/runtimeEvidenceStore";
import type { SignedRuntimeEvidenceEnvelope } from "../../server/signedRuntimeEvidence";

const [evidencePath, storeDirectory] = process.argv.slice(2);
if (!evidencePath || !storeDirectory) throw new Error("CANONICAL_EVIDENCE_STORAGE_ARGUMENTS_REQUIRED");

async function main() {
  const envelope = JSON.parse(await readFile(evidencePath, "utf8")) as SignedRuntimeEvidenceEnvelope;
  const environmentIdentity = "GITHUB-DOCKER-INTERNAL-TEST";
  const commit = process.env.GITHUB_SHA;
  const workflowRun = process.env.GITHUB_RUN_ID;
  if (!commit || !workflowRun) throw new Error("CANONICAL_EVIDENCE_STORAGE_TRUST_UNAVAILABLE");
  const result = await storeCanonicalRuntimeEvidence(envelope, { environmentIdentity, commit, workflowRun }, storeDirectory);
  if (result.status !== "VERIFIED") throw new Error(`CANONICAL_EVIDENCE_STORAGE_REJECTED:${result.rejectionCode}`);
  console.log("CANONICAL_EVIDENCE_STORAGE=VERIFIED");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "CANONICAL_EVIDENCE_STORAGE_FAILED");
  process.exitCode = 1;
});
