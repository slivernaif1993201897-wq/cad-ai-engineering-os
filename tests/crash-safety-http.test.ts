import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";
import type { CrashSafetyEvidenceInput } from "../shared/crashSafety";

let server: Server | undefined;
const sha = "e".repeat(64);
const samples = (offset: number) => [{ timeS: 0, positionM: [offset, 0, 0] as [number, number, number], velocityMps: [2, 0, 0] as [number, number, number], angularVelocityRadps: [0, 0, 0] as [number, number, number] }, { timeS: 0.01, positionM: [offset + 0.01, 0, 0] as [number, number, number], velocityMps: [0, 0, 0] as [number, number, number], angularVelocityRadps: [0, 0, 0] as [number, number, number] }];

function crashFixture(): CrashSafetyEvidenceInput {
  return { designId: "HTTP-CRASH-DESIGN", seatRevisionHash: sha, requirement: { requirementId: "HTTP-CRASH-REQ", scenario: "Synthetic HTTP fixture", occupantCondition: "Synthetic", vehicleSeatConfiguration: "Synthetic", crashPulseDefinitionId: "HTTP-PULSE", initialCondition: "Declared test condition", occupantMassAndInertiaSource: "TEST_ONLY", restraintAssumptions: ["Test only"], responseMetric: "Test metric", acceptanceCriterion: { criterionId: "HTTP-CRITERION", definition: "Test only", source: "TEST_ONLY" }, source: "TEST_ONLY", provenanceReferences: ["HTTP-REQ-PROVENANCE"], verificationMethod: "Contract test", validationMethod: "No physical validation", certificationStatus: "NOT_CERTIFIED" }, crashPulse: { pulseId: "HTTP-PULSE", sourceKind: "SYNTHETIC", source: "TEST_ONLY", provenanceReferences: ["HTTP-PULSE-PROVENANCE"], samplingRateHz: 100, accelerationUnit: "m/s2", coordinateDirection: "X", filtering: { method: "NONE", parameters: "none", source: "TEST_ONLY" }, samples: [{ timeS: 0, acceleration: 0 }, { timeS: 0.01, acceleration: -10 }] }, occupantMotion: { modelId: "HTTP-OCCUPANT", source: "TEST_ONLY", coordinateFrameId: "HTTP-FRAME", seatInterfaceId: "HTTP-SEAT", restraintInterfaceIds: ["HTTP-RESTRAINT"], contactInterfaceIds: ["HTTP-CONTACT"], segments: [{ segment: "PELVIS", massKg: 10, inertiaKgM2: [1, 1, 1], samples: samples(0) }, { segment: "TORSO", massKg: 30, inertiaKgM2: [1, 1, 1], samples: samples(0.1) }, { segment: "HEAD", massKg: 5, inertiaKgM2: [1, 1, 1], samples: samples(0.2) }], assumptions: ["TEST_ONLY"], provenanceReferences: ["HTTP-MOTION-PROVENANCE"], biofidelityStatus: "NOT_VALIDATED" }, safetyMetrics: [{ metricId: "HTTP-METRIC", category: "HEAD_RESPONSE", segment: "HEAD", value: 1, unit: "1", definition: "Test metric", source: "TEST_ONLY", provenanceReferences: ["HTTP-METRIC-PROVENANCE"] }], validationArchitecture: { simulation: "RECORDED", referenceModel: "NOT_AVAILABLE", benchTest: "NOT_AVAILABLE", physicalTest: "NOT_AVAILABLE", correlation: "NOT_AVAILABLE" } };
}

async function startApi() {
  const app = express(); app.use(express.json()); registerEngineeringJobHttp(app);
  server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; });

describe("Crash safety evidence API", () => {
  it("persists, returns, and isolates bounded crash-safety evidence", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Crash safety API fixture" }) });
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const create = await fetch(`${base}/api/projects/${project.projectId}/crash-safety-evidence`, { method: "POST", headers, body: JSON.stringify({ input: crashFixture() }) });
    expect(create.status).toBe(201);
    const created = await create.json() as { recordId: string; immutable: boolean; certificationStatus: string; claimBoundary: string };
    expect(created).toMatchObject({ immutable: true, certificationStatus: "NOT_CERTIFIED", claimBoundary: "NO_CRASHWORTHINESS_OR_OCCUPANT_SAFETY_CLAIM" });
    const listed = await fetch(`${base}/api/projects/${project.projectId}/crash-safety-evidence`, { headers });
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ recordId: created.recordId })]));
    const missingInput = await fetch(`${base}/api/projects/${project.projectId}/crash-safety-evidence`, { method: "POST", headers, body: JSON.stringify({}) });
    expect(missingInput.status).toBe(422);
    await expect(missingInput.json()).resolves.toEqual({ error: "CRASH_SAFETY_INPUT_REQUIRED" });
    const foreign = await fetch(`${base}/api/projects/${project.projectId}/crash-safety-evidence`, { headers: { "content-type": "application/json", "x-engineering-access-key": "wrong-access-key" } });
    expect(foreign.status).toBe(403);
  }, 20_000);
});
