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

describe("seat engineering product API", () => {
  it("persists a seat design, revision, BOM components, materials, requirements, bidirectional trace links, and an evidence-honest report", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Seat Product Acceptance" }) });
    expect(projectResponse.status).toBe(201);
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };

    const createResponse = await fetch(`${base}/api/projects/${project.projectId}/seat-designs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Front seat assembly",
        description: "Concept seat structure with foam, trim, and recliner components.",
        requirements: [{ requirementId: "SEAT-REQ-001", description: "The seat shall retain occupant support under the declared loading case.", constraint: { load: { value: 1200, unit: "N" } }, verificationMethod: "CAE structural analysis" }],
        materials: [{ name: "HSLA steel", specification: "EN 10268", properties: { yieldStrength: { value: 420, unit: "MPa" } }, validationStatus: "UNKNOWN" }],
        components: [{ name: "Seat frame", componentType: "STRUCTURE", materialName: "HSLA steel", quantity: 1 }, { name: "Cushion foam", componentType: "FOAM", quantity: 1 }],
      }),
    });
    expect(createResponse.status).toBe(201);
    const seat = await createResponse.json() as { id: string; revisions: Array<{ revisionNumber: number; designSnapshotHash: string }>; requirements: unknown[]; components: unknown[]; materials: unknown[]; traceLinks: unknown[] };
    expect(seat.revisions).toHaveLength(1);
    expect(seat.revisions[0].revisionNumber).toBe(1);
    expect(seat.revisions[0].designSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(seat.requirements).toHaveLength(1);
    expect(seat.components).toHaveLength(2);
    expect(seat.materials).toHaveLength(1);
    expect(seat.traceLinks.length).toBeGreaterThanOrEqual(4);

    const revisionResponse = await fetch(`${base}/api/projects/${project.projectId}/seat-designs/${seat.id}/revisions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        description: "Successor revision updates the recliner load-path requirement.",
        requirements: [{ requirementId: "SEAT-REQ-002", description: "The recliner bracket shall remain below the declared stress limit.", constraint: { stress: { value: 260, unit: "MPa" } }, verificationMethod: "CAE structural analysis" }],
        materials: [{ name: "HSLA steel", specification: "EN 10268", properties: { yieldStrength: { value: 420, unit: "MPa" } }, validationStatus: "UNKNOWN" }],
        components: [{ name: "Recliner bracket", componentType: "STRUCTURE", materialName: "HSLA steel", quantity: 1 }],
      }),
    });
    expect(revisionResponse.status).toBe(201);
    const revisedSeat = await revisionResponse.json() as { status: string; revisions: Array<{ id: string; revisionNumber: number }> };
    expect(revisedSeat.status).toBe("REVIEW");
    expect(revisedSeat.revisions).toHaveLength(2);
    expect(revisedSeat.revisions[0].revisionNumber).toBe(2);

    const blockedRelease = await fetch(`${base}/api/projects/${project.projectId}/seat-designs/${seat.id}/revisions/${revisedSeat.revisions[0].id}/release`, { method: "POST", headers });
    expect(blockedRelease.status).toBe(422);
    await expect(blockedRelease.json()).resolves.toMatchObject({ error: "SEAT_RELEASE_REQUIRES_APPROVED_MATERIALS" });

    const listResponse = await fetch(`${base}/api/projects/${project.projectId}/seat-designs`, { headers });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject([{ id: seat.id, name: "Front seat assembly", status: "REVIEW" }]);

    const reportResponse = await fetch(`${base}/api/projects/${project.projectId}/seat-designs/${seat.id}/report`, { headers });
    expect(reportResponse.status).toBe(200);
    await expect(reportResponse.json()).resolves.toMatchObject({ seat: { id: seat.id }, engineeringJob: null, disclaimer: expect.stringContaining("No solver") });

    const foreignResponse = await fetch(`${base}/api/projects/${project.projectId}/seat-designs/${seat.id}`, { headers: { "x-engineering-access-key": "wrong-access-key" } });
    expect(foreignResponse.status).toBe(403);
  });
});
