import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { signRuntimeEvidence } from "../../server/signedRuntimeEvidence";

const root = process.argv[2];
if (!root) throw new Error("EVIDENCE_ROOT_REQUIRED");

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

async function main() {
  const provenance = await readJson(join(root, "input", "cad-agent-provenance.json"));
  const manifest = await readJson(join(root, "input", "generic-user-job-manifest.json"));
  const binding = await readJson(join(root, "result", "runtime-output", "result-binding.json"));
  const now = new Date();
  const envelope = signRuntimeEvidence({
    version: "runtime-evidence/v1",
    evidenceId: `cad-agent-runtime-${process.env.GITHUB_RUN_ID ?? "unknown"}`,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    environmentIdentity: "GITHUB-DOCKER-INTERNAL-TEST",
    commit: process.env.GITHUB_SHA ?? "unknown",
    workflowRun: process.env.GITHUB_RUN_ID ?? "unknown",
    artifactHashes: {
      cadRevisionHash: String(provenance.cadRevisionHash),
      cadArtifactHash: String(provenance.cadArtifactHash),
      caeConfigurationHash: String(provenance.caeConfigurationHash),
      jobId: String(binding.jobId),
      manifestHash: String(manifest.manifestHash),
      environmentHash: String(binding.environmentHash),
      gmshHash: String(binding.gmshHash),
      meshHash: String(binding.meshHash),
      calculixHash: String(binding.calculixHash),
      inputHash: String(binding.inputHash),
      outputHash: String(binding.outputHash),
      resultHash: String(binding.resultHash),
      executionLogHash: String(binding.executionLogHash),
    },
    resultHash: String(binding.resultHash),
  });
  const provenanceDirectory = join(root, "provenance");
  await mkdir(provenanceDirectory, { recursive: true });
  await writeFile(join(provenanceDirectory, "signed-runtime-evidence.json"), `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "SIGNED_EVIDENCE_GENERATION_FAILED"); process.exitCode = 1; });
