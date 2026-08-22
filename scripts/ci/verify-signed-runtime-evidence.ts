import { readFile } from "node:fs/promises";

import { verifyRuntimeEvidence, type SignedRuntimeEvidenceEnvelope } from "../../server/signedRuntimeEvidence";

const path = process.argv[2];
if (!path) throw new Error("SIGNED_EVIDENCE_PATH_REQUIRED");

async function main() {
  const envelope = JSON.parse(await readFile(path, "utf8")) as SignedRuntimeEvidenceEnvelope;
  const result = verifyRuntimeEvidence(envelope, {
    environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST",
    commit: process.env.GITHUB_SHA ?? "unknown",
    workflowRun: process.env.GITHUB_RUN_ID ?? "unknown",
  });
  if (result.status !== "VERIFIED") throw new Error(`SIGNED_EVIDENCE_REJECTED:${result.rejectionCode}`);
  process.stdout.write("SIGNED_RUNTIME_EVIDENCE_VERIFIED\n");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "SIGNED_EVIDENCE_VERIFICATION_FAILED"); process.exitCode = 1; });
