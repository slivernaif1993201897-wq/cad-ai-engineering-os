import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

let server: Server | undefined;

async function startApi() {
  const app = express();
  app.use(express.json());
  registerEngineeringJobHttp(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("engineering job HTTP product API", () => {
  it("creates a project, submits a real CAD-backed job, retrieves its durable state, and fails closed for an unreconciled result", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "HTTP Product Acceptance" }) });
    expect(projectResponse.status).toBe(201);
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const jobResponse = await fetch(`${base}/api/projects/${project.projectId}/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "HTTP mounting block",
        sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block. Add four 10 mm holes near the corners using a 10 mm edge offset. Add a 3 mm fillet.",
        mountingBlock: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
      }),
    });
    expect(jobResponse.status).toBe(201);
    const job = await jobResponse.json() as { jobId: string; state: string; cad: { artifactHash: string }; manifest: { manifestHash: string } };
    expect(job.state).toBe("ADMITTED");
    expect(job.cad.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(job.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);

    const access = { "x-engineering-project-id": project.projectId, "x-engineering-access-key": project.accessKey };
    const statusResponse = await fetch(`${base}/api/jobs/${job.jobId}/status`, { headers: access });
    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({ jobId: job.jobId, state: "ADMITTED", runtimeDispatch: { status: "ADMITTED_TO_CI_BOUNDARY" } });

    const resultResponse = await fetch(`${base}/api/jobs/${job.jobId}/result`, { headers: access });
    expect(resultResponse.status).toBe(409);
    await expect(resultResponse.json()).resolves.toEqual({ jobId: job.jobId, available: false, error: "VERIFIED_RUNTIME_RESULT_UNAVAILABLE" });

    const foreignResponse = await fetch(`${base}/api/jobs/${job.jobId}`, { headers: { "x-engineering-project-id": project.projectId, "x-engineering-access-key": "wrong-access-key" } });
    expect(foreignResponse.status).toBe(403);

    const forgedResultResponse = await fetch(`${base}/api/jobs/${job.jobId}/result`, { method: "POST", headers, body: JSON.stringify({ resultHash: "a".repeat(64) }) });
    expect(forgedResultResponse.status).toBe(405);
    await expect(forgedResultResponse.json()).resolves.toEqual({ error: "CLIENT_RUNTIME_ARTIFACT_SUBMISSION_FORBIDDEN" });
  }, 25_000);
});
