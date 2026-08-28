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

describe("CAPRE project API", () => {
  it("requires project access, exposes only safe discovery metadata, and rejects capture from a dirty release worktree", async () => {
    const base = await startApi();
    const created = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "CAPRE HTTP" }) });
    const project = await created.json() as { projectId: string; accessKey: string };
    const path = `${base}/api/projects/${project.projectId}/capre`;
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };

    expect((await fetch(`${path}/discover`)).status).toBe(401);
    const discoveryResponse = await fetch(`${path}/discover`, { headers });
    expect(discoveryResponse.status).toBe(200);
    const discovery = await discoveryResponse.json() as { durabilityClass: string; durableBackupAvailable: boolean; protectionStatus: string; durableStorageStatus: string; resetSurvivalStatus: string; authoritativeRecoveryStatus: string; secretPrerequisites: Array<{ secretValue: string }> };
    expect(discovery.durabilityClass).toBe("LOCAL_EPHEMERAL");
    expect(discovery.durableBackupAvailable).toBe(false);
    expect(discovery.protectionStatus).toBe("UNPROTECTED");
    expect(discovery.durableStorageStatus).toBe("UNAVAILABLE");
    expect(discovery.resetSurvivalStatus).toBe("NOT_PROVEN");
    expect(discovery.authoritativeRecoveryStatus).toBe("UNAVAILABLE");
    expect(discovery.secretPrerequisites.every((item) => item.secretValue === "NEVER_EXPORTED")).toBe(true);

    const list = await fetch(`${path}/checkpoints`, { headers });
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual([]);

    const foreign = await fetch(`${path}/discover`, { headers: { "x-engineering-access-key": "wrong-access-key" } });
    expect(foreign.status).toBe(403);

    const capture = await fetch(`${path}/capture`, { method: "POST", headers });
    expect(capture.status).toBe(422);
    await expect(capture.json()).resolves.toEqual({ error: "CAPRE_DIRTY_WORKTREE_REJECTED" });
  }, 20_000);
});
