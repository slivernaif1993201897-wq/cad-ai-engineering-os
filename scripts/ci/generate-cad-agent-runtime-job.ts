import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createMountingBlockConfiguration, getValidatedStepExport } from "../../server/cadAgent";
import { admitCadAgentRuntimeJob, buildCadAgentRuntimeManifest, calculateCadRevisionHash } from "../../shared/authoritativeCadAgentRuntime";

const inputRoot = join(process.cwd(), "artifacts", "generic-job", "input");

async function main() {
  const result = await createMountingBlockConfiguration({
    name: "Authoritative CAD Agent Runtime Mounting Block",
    input: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
    sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
  });
  if (result.error || result.configuration.modelStatus !== "VALIDATED" || !result.configuration.artifact) {
    throw new Error(`CAD_AGENT_GENERATION_NOT_VALIDATED:${result.error ?? result.configuration.modelStatus}`);
  }
  const stepExport = getValidatedStepExport(result.configuration.id);
  const stepBytes = Buffer.from(stepExport.stepBase64, "base64");
  const manifest = buildCadAgentRuntimeManifest({ configuration: result.configuration, stepExport, stepBytes });
  admitCadAgentRuntimeJob(manifest, {
    jobId: manifest.jobId,
    cadRevision: result.configuration.id,
    cadRevisionHash: calculateCadRevisionHash(result.configuration),
    cadArtifactHash: manifest.cadArtifactHash,
  });
  await mkdir(inputRoot, { recursive: true });
  await writeFile(join(inputRoot, "cad-artifact.step"), stepBytes);
  await writeFile(join(inputRoot, "generic-user-job-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(inputRoot, "cad-agent-provenance.json"), `${JSON.stringify({
    sourceKind: "CAD_AGENT",
    configurationId: result.configuration.id,
    revision: result.configuration.revision,
    cadRevisionHash: manifest.cadRevisionHash,
    cadArtifactHash: manifest.cadArtifactHash,
    manifestHash: manifest.manifestHash,
    validationStatus: result.configuration.artifact.validationStatus,
  }, null, 2)}\n`, "utf8");
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
