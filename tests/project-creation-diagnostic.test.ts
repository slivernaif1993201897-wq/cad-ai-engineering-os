import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { openPersistentProject } from "../server/persistentMemory";
import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

async function startApi() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerEngineeringJobHttp(app);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("DIAGNOSTIC_SERVER_UNAVAILABLE");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("CAD-AGENT-DIAGNOSTIC-001 project creation lifecycle", () => {
  let first: { server: Server; baseUrl: string };
  let relaunched: { server: Server; baseUrl: string };

  beforeAll(async () => {
    first = await startApi();
  });

  afterAll(async () => {
    if (relaunched?.server.listening) {
      await new Promise<void>((resolve, reject) => relaunched.server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("creates, persists, closes, relaunches, and reopens an empty project without CAD runtimes", async () => {
    const createResponse = await fetch(`${first.baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CAD-AGENT-DIAGNOSTIC-001" }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { projectId: string; name: string; accessKey: string };
    expect(created.projectId).toMatch(/^PROJECT-/);
    expect(created.name).toBe("CAD-AGENT-DIAGNOSTIC-001");
    expect(created.accessKey.length).toBeGreaterThanOrEqual(16);

    await new Promise<void>((resolve, reject) => first.server.close((error) => (error ? reject(error) : resolve())));
    relaunched = await startApi();

    const reopened = await openPersistentProject({ projectId: created.projectId, accessKey: created.accessKey, name: "" });
    expect(reopened).toMatchObject({ id: created.projectId, name: created.name, accessKey: created.accessKey });

    const secondHealth = await fetch(`${relaunched.baseUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CAD-AGENT-DIAGNOSTIC-001-second" }),
    });
    expect(secondHealth.status).toBe(201);

    // The empty project path only exercised HTTP, persistence, and identity recovery.
    // It did not invoke OpenCascade, Gmsh, CalculiX, CAM, machine, or LLM execution.
  }, 20000);
});
