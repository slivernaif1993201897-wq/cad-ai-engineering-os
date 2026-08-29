import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

let server: Server | undefined;
async function startApi() { const app = express(); app.use(express.json({ limit: "1mb" })); registerEngineeringJobHttp(app); server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE"); return `http://127.0.0.1:${address.port}`; }
async function stopApi() { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; }
afterEach(stopApi);

describe("immutable project capability registry", () => {
  it("persists one hash-bound catalog snapshot across API restart and rejects a foreign project key", async () => {
    let base = await startApi();
    const created = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Capability registry persistence" }) }); expect(created.status).toBe(201); const project = await created.json() as { projectId: string; accessKey: string };
    const headers = { "x-engineering-access-key": project.accessKey };
    const firstResponse = await fetch(`${base}/api/projects/${project.projectId}/capabilities`, { headers }); expect(firstResponse.status).toBe(200); const first = await firstResponse.json() as { registryVersion: string; registryHash: string; persistedRecordId: string; capabilities: Array<{ capabilityId: string; status: string }> };
    expect(first).toMatchObject({ registryVersion: expect.any(String), registryHash: expect.stringMatching(/^[a-f0-9]{64}$/), persistedRecordId: expect.any(String) });
    expect(first.capabilities).toContainEqual(expect.objectContaining({ capabilityId: "CAD.CREATE.FILLET", status: "BLOCKED" }));
    expect(first.capabilities).toContainEqual(expect.objectContaining({ capabilityId: "CAE.RUN.GMSH.LOCAL", status: "VERIFIED" }));
    expect(first.capabilities).toContainEqual(expect.objectContaining({ capabilityId: "CAM.CREATE_TOOLPATH", status: "UNSUPPORTED" }));
    await stopApi(); base = await startApi();
    const restoredResponse = await fetch(`${base}/api/projects/${project.projectId}/capabilities`, { headers }); expect(restoredResponse.status).toBe(200); const restored = await restoredResponse.json() as { registryHash: string; persistedRecordId: string; capabilities: Array<{ capabilityId: string }> };
    expect(restored.registryHash).toBe(first.registryHash); expect(restored.persistedRecordId).toBe(first.persistedRecordId); expect(restored.capabilities.map((item) => item.capabilityId)).toEqual(first.capabilities.map((item) => item.capabilityId));
    const foreignCreated = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Foreign registry project" }) }); const foreign = await foreignCreated.json() as { accessKey: string };
    const foreignRead = await fetch(`${base}/api/projects/${project.projectId}/capabilities`, { headers: { "x-engineering-access-key": foreign.accessKey } }); expect(foreignRead.status).toBe(403);
  });
});
