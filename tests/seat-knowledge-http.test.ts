import { createServer, type Server } from "http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

let server: Server | undefined;
async function startApi() {
  const app = express(); app.use(express.json()); registerEngineeringJobHttp(app);
  server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("SEKB_HTTP_SERVER_UNAVAILABLE");
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; });

describe("normalized SEKB HTTP API", () => {
  it("enforces project ownership and governed evidence-backed release lifecycle", async () => {
    const base = await startApi();
    const createProject = async (name: string) => (await (await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })).json()) as { projectId: string; accessKey: string };
    const project = await createProject("SEKB API lifecycle");
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const entityResponse = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities`, { method: "POST", headers, body: JSON.stringify({ entityType: "LOAD_CASE", externalKey: "REARWARD_STATIC", name: "Rearward static load", description: "Explicit user-provided static load case", valueText: "1058", unit: "N", sourceType: "USER_PROVIDED", sourceReference: "Authorized engineering input", evidenceReference: "evidence://load-case", createdBy: "Engineer" }) });
    expect(entityResponse.status).toBe(201);
    const entity = await entityResponse.json() as { id: string; status: string };
    expect(entity.status).toBe("DRAFT");
    const missingRelease = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities/${entity.id}/release`, { method: "POST", headers, body: JSON.stringify({ actor: "ReleaseAuthority", reason: "Cannot release without approval" }) });
    expect(missingRelease.status).toBe(422);
    const attachment = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities/${entity.id}/attachments`, { method: "POST", headers, body: JSON.stringify({ fileName: "load-source.pdf", mediaType: "application/pdf", storageReference: "managed-storage/load-source", sha256: "b".repeat(64), sourceReference: "Authorized engineering input", actor: "Engineer" }) });
    expect(attachment.status).toBe(201);
    const approved = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities/${entity.id}/approve`, { method: "POST", headers, body: JSON.stringify({ actor: "Reviewer", reason: "Evidence reviewed" }) });
    expect(approved.status).toBe(200);
    const released = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities/${entity.id}/release`, { method: "POST", headers, body: JSON.stringify({ actor: "ReleaseAuthority", reason: "Approved load case released" }) });
    expect(released.status).toBe(200);
    await expect(released.json()).resolves.toMatchObject({ status: "RELEASED" });
    const search = await fetch(`${base}/api/projects/${project.projectId}/sekb/search?q=Rearward`, { headers });
    expect(search.status).toBe(200); await expect(search.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: entity.id, entityType: "LOAD_CASE" })]));
    const audit = await fetch(`${base}/api/projects/${project.projectId}/sekb/entities/${entity.id}/audit`, { headers });
    expect(audit.status).toBe(200); await expect(audit.json()).resolves.toMatchObject({ attachments: [expect.objectContaining({ sha256: "b".repeat(64) })], auditEvents: expect.arrayContaining([expect.objectContaining({ action: "RELEASED" })]) });
    const foreign = await createProject("SEKB foreign API");
    const foreignRead = await fetch(`${base}/api/projects/${foreign.projectId}/sekb/entities/${entity.id}`, { headers: { "x-engineering-access-key": foreign.accessKey } });
    expect(foreignRead.status).toBe(404);
  }, 20_000);
});
