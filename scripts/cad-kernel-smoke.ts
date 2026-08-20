import { generateMountingBlock } from "../server/cadKernel";

async function main() {
  const result = await generateMountingBlock(
    {
      width: 100,
      depth: 50,
      height: 20,
      holeDiameter: 10,
      holeEdgeOffset: 10,
      filletRadius: 3,
      approveAssumption: true,
    },
    "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm diameter holes near the corners and a 3 mm external edge fillet.",
  );

  console.log(JSON.stringify({
    planId: result.plan.id,
    validationStatus: result.artifact?.validationStatus ?? "NO_ARTIFACT",
    featureStatuses: result.plan.features.map((item) => [item.type, item.status]),
    stepByteLength: result.artifact?.stepByteLength ?? 0,
    error: result.error ?? null,
  }, null, 2));

  if (!result.artifact || result.artifact.validationStatus !== "VALID") process.exit(2);
  if (!result.artifact.stepByteLength) process.exit(3);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
