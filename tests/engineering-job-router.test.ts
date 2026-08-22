import { describe, expect, it } from "vitest";

import { openPersistentProject } from "../server/persistentMemory";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("engineering job API", () => {
  it("submits and observes a durable admitted job through authorized project access without fabricating mesh or solver results", async () => {
    const project = await openPersistentProject({ name: "Engineering job API" });
    const caller = appRouter.createCaller(ctx);
    const access = { projectId: project.id, accessKey: project.accessKey };
    const job = await caller.engineeringJobs.submit({
      ...access,
      request: {
        name: `API Vertical Slice ${crypto.randomUUID()}`,
        sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
        mountingBlock: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
      },
    });

    expect(job.state).toBe("ADMITTED");
    await expect(caller.engineeringJobs.status({ ...access, jobId: job.jobId })).resolves.toMatchObject({ state: "ADMITTED", runtimeDispatch: { status: "ADMITTED_TO_CI_BOUNDARY" } });
    await expect(caller.engineeringJobs.requirements({ ...access, jobId: job.jobId })).resolves.toMatchObject({ validation_status: "VALIDATED" });
    await expect(caller.engineeringJobs.cad({ ...access, jobId: job.jobId })).resolves.toMatchObject({ artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await expect(caller.engineeringJobs.cae({ ...access, jobId: job.jobId })).resolves.toMatchObject({ cadArtifactHash: job.cad?.artifactHash });
    await expect(caller.engineeringJobs.manifest({ ...access, jobId: job.jobId })).resolves.toMatchObject({ jobId: job.jobId, cadProvenance: { sourceKind: "CAD_AGENT" } });
    await expect(caller.engineeringJobs.mesh({ ...access, jobId: job.jobId })).resolves.toMatchObject({ available: false });
    await expect(caller.engineeringJobs.result({ ...access, jobId: job.jobId })).resolves.toMatchObject({ available: false });
    await expect(caller.engineeringJobs.evidence({ ...access, jobId: job.jobId })).resolves.toMatchObject({ manifestHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await expect(caller.engineeringJobs.reconcileAuthoritativeRuntime({ ...access, jobId: job.jobId })).resolves.toEqual({ status: "BLOCKED", reason: "MISSING_EVIDENCE" });
  }, 25_000);
});
