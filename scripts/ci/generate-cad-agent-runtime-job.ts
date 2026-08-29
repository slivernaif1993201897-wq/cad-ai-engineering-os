import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { composeEngineeringJobRequest } from "../../server/engineeringJob";

const inputRoot = join(process.cwd(), "artifacts", "generic-job", "input");

async function main() {
  const composition = await composeEngineeringJobRequest({
    projectId: "GITHUB-DOCKER-CI",
    accessKey: "GITHUB-DOCKER-CI",
    request: {
      name: "Authoritative CAD Agent Runtime Mounting Block",
      mountingBlock: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
      sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
    },
  });
  await mkdir(inputRoot, { recursive: true });
  await writeFile(join(inputRoot, "cad-artifact.step"), composition.stepBytes);
  await writeFile(join(inputRoot, "generic-user-job-manifest.json"), `${JSON.stringify(composition.manifest, null, 2)}\n`, "utf8");
  await writeFile(join(inputRoot, "cad-agent-provenance.json"), `${JSON.stringify({
    sourceKind: "CAD_AGENT",
    requirementSetId: composition.requirementSet.id,
    configurationId: composition.configuration.id,
    revision: composition.configuration.revision,
    cadRevisionHash: composition.manifest.cadRevisionHash,
    cadArtifactHash: composition.manifest.cadArtifactHash,
    caeConfigurationHash: composition.caeConfiguration.caeConfigurationHash,
    manifestHash: composition.manifest.manifestHash,
    validationStatus: composition.configuration.artifact?.validationStatus,
  }, null, 2)}\n`, "utf8");
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
