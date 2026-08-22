import { describe, expect, it } from "vitest";

import { getEngineeringJob, listEngineeringJobs, submitEngineeringJob } from "../server/engineeringJob";
import { openPersistentProject } from "../server/persistentMemory";

const validInput = {
  width: 100,
  depth: 50,
  height: 20,
  holeDiameter: 10,
  holeEdgeOffset: 10,
  filletRadius: 3,
  approveAssumption: true,
};

describe("persistent engineering job vertical slice", () => {
  it("persists a validated requirement -> real CAD -> bound CAE -> immutable runtime admission job without direct solver execution", async () => {
    const project = await openPersistentProject({ name: "Engineering job vertical slice" });
    const job = await submitEngineeringJob({
      projectId: project.id,
      accessKey: project.accessKey,
      request: {
        name: `Vertical Slice ${crypto.randomUUID()}`,
        mountingBlock: validInput,
        sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
      },
    });

    expect(job.state).toBe("ADMITTED");
    expect(job.requirementSet?.validation_status).toBe("VALIDATED");
    expect(job.cad).toMatchObject({ artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/), stepExport: { validationStatus: "VALID" } });
    expect(job.caeConfiguration).toMatchObject({ cadRevision: job.cad?.revisionId, cadRevisionHash: job.cad?.revisionHash, cadArtifactHash: job.cad?.artifactHash });
    expect(job.manifest).toMatchObject({ jobId: job.jobId, cadProvenance: { sourceKind: "CAD_AGENT" } });
    expect(job.runtimeDispatch).toMatchObject({ status: "ADMITTED_TO_CI_BOUNDARY" });
    expect(job.events.map((item) => item.state)).toEqual(["QUEUED", "VALIDATING", "CAD_GENERATING", "CAD_VALIDATED", "CAE_CONFIGURED", "ADMITTED"]);
    expect(job.events.some((item) => item.reason.includes("does not spawn processes"))).toBe(false);

    await expect(getEngineeringJob({ projectId: project.id, accessKey: project.accessKey, jobId: job.jobId })).resolves.toMatchObject({ jobId: job.jobId, state: "ADMITTED" });
    await expect(listEngineeringJobs({ projectId: project.id, accessKey: project.accessKey })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ jobId: job.jobId })]));
  }, 20_000);

  it("rejects unvalidated requirements before CAD generation and records no admitted runtime manifest", async () => {
    const project = await openPersistentProject({ name: "Engineering job rejection" });
    const job = await submitEngineeringJob({
      projectId: project.id,
      accessKey: project.accessKey,
      request: {
        name: `Rejected Slice ${crypto.randomUUID()}`,
        mountingBlock: validInput,
        sourceText: "Create a load-bearing bracket 100 mm long.",
      },
    });

    expect(job.state).toBe("REJECTED");
    expect(job.manifest).toBeUndefined();
    expect(job.runtimeDispatch.status).toBe("REJECTED");
    expect(job.events.at(-1)).toMatchObject({ state: "REJECTED" });
  });
});
