import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";
import { axialStressReferenceInput } from "../server/physicalVerification";

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

describe("physical engineering verification API", () => {
  it("persists and returns a distinct analytical numerical-verification record without elevating higher claims", async () => {
    const base = await startApi();
    const createProject = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Physical verification API" }) });
    const project = await createProject.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };

    const create = await fetch(`${base}/api/projects/${project.projectId}/physical-verifications`, { method: "POST", headers, body: JSON.stringify({ input: axialStressReferenceInput() }) });
    expect(create.status).toBe(201);
    const created = await create.json() as { verificationId: string; immutable: boolean; classification: string; levels: { numericalVerification: string; modelValidation: string; regulatoryCertification: string } };
    expect(created).toMatchObject({ immutable: true, classification: "VALIDATED_REFERENCE_CASE", levels: { numericalVerification: "ACHIEVED", modelValidation: "NOT_ACHIEVED", regulatoryCertification: "NOT_ACHIEVED" } });

    const listed = await fetch(`${base}/api/projects/${project.projectId}/physical-verifications`, { headers });
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ verificationId: created.verificationId })]));

    const missingInput = await fetch(`${base}/api/projects/${project.projectId}/physical-verifications`, { method: "POST", headers, body: JSON.stringify({}) });
    expect(missingInput.status).toBe(422);
    await expect(missingInput.json()).resolves.toEqual({ error: "PHYSICAL_VERIFICATION_INPUT_REQUIRED" });

    const foreign = await fetch(`${base}/api/projects/${project.projectId}/physical-verifications`, { headers: { "content-type": "application/json", "x-engineering-access-key": "wrong-access-key" } });
    expect(foreign.status).toBe(403);
  }, 20_000);
});
