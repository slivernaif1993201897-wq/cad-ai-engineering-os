import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";

import { executeExternalTextToCadPlate, getExternalTextToCadSkills } from "../server/externalTextToCadAdapter";
import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

const runtimeRoot = "/home/ubuntu/external-runtimes/text-to-cad-b97ff01";
const sourceRoot = "/home/ubuntu/external-audits/text-to-cad-current";
let server: Server | undefined;
const priorRuntime = process.env.TEXT_TO_CAD_RUNTIME_ROOT;
const priorSource = process.env.TEXT_TO_CAD_SOURCE_ROOT;
const priorPython = process.env.TEXT_TO_CAD_PYTHON;

async function startApi() { const app = express(); app.use(express.json({ limit: "2mb" })); registerEngineeringJobHttp(app); server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE"); return `http://127.0.0.1:${address.port}`; }
async function stopApi() { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; }
function restoreEnv() { if (priorRuntime === undefined) delete process.env.TEXT_TO_CAD_RUNTIME_ROOT; else process.env.TEXT_TO_CAD_RUNTIME_ROOT = priorRuntime; if (priorSource === undefined) delete process.env.TEXT_TO_CAD_SOURCE_ROOT; else process.env.TEXT_TO_CAD_SOURCE_ROOT = priorSource; if (priorPython === undefined) delete process.env.TEXT_TO_CAD_PYTHON; else process.env.TEXT_TO_CAD_PYTHON = priorPython; }
afterEach(async () => { await stopApi(); restoreEnv(); });

describe("pinned permissioned text-to-cad adapter", () => {
  it("fails closed while unconfigured, rejects arbitrary input, then executes only the adapter-owned pinned plate workflow through CAD-Agent ingestion", async () => {
    delete process.env.TEXT_TO_CAD_RUNTIME_ROOT; delete process.env.TEXT_TO_CAD_SOURCE_ROOT;
    expect(getExternalTextToCadSkills()[0]?.status).toBe("DEPENDENCY_MISSING");
    await expect(executeExternalTextToCadPlate({ widthMm: 100, heightMm: 50, thicknessMm: 10, unit: "mm", python: "import os" })).resolves.toMatchObject({ status: "VALIDATION_FAILED" });
    process.env.TEXT_TO_CAD_RUNTIME_ROOT = runtimeRoot; process.env.TEXT_TO_CAD_SOURCE_ROOT = sourceRoot; process.env.TEXT_TO_CAD_PYTHON = "python3";
    const direct = await executeExternalTextToCadPlate({ widthMm: 100, heightMm: 50, thicknessMm: 10, unit: "mm" });
    expect(direct).toMatchObject({ status: "EXECUTABLE", skill: { sourceCommit: "b97ff01f3f34ff0c87c84d1e9a6bd42d3cec21ed", securityStatus: "PARTIAL" }, stepSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(direct.stepBytes?.subarray(0, 32).toString("utf8")).toContain("ISO-10303-21");
    const base = await startApi(); const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Pinned external CAD adapter proof" }) }); const project = await projectResponse.json() as { projectId: string; accessKey: string }; const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const plannedResponse = await fetch(`${base}/api/projects/${project.projectId}/cad-agent/commands`, { method: "POST", headers, body: JSON.stringify({ message: "Generate a text-to-cad rectangular plate", externalParameters: { widthMm: 100, heightMm: 50, thicknessMm: 10, unit: "mm" } }) }); expect(plannedResponse.status).toBe(200); await expect(plannedResponse.json()).resolves.toMatchObject({ safety: "REQUIRES_CONFIRMATION", selectedSkill: { skillId: "external.text_to_cad.cad.rectangular_plate.v1" }, capability: { capabilityId: "CAD.EXTERNAL.TEXT_TO_CAD.RECTANGULAR_PLATE", status: "PARTIAL" }, execution: { status: "NOT_EXECUTED" } });
    const executedResponse = await fetch(`${base}/api/projects/${project.projectId}/cad-agent/commands`, { method: "POST", headers, body: JSON.stringify({ message: "Generate a text-to-cad rectangular plate", externalParameters: { widthMm: 100, heightMm: 50, thicknessMm: 10, unit: "mm" }, confirmed: true }) }); expect(executedResponse.status).toBe(200); const executed = await executedResponse.json() as { execution: { status: string; output: { artifactId: string; artifactHash: string; featureId: string; featureRevision: number } }; provenanceRecordId: string }; expect(executed).toMatchObject({ execution: { status: "EXECUTED", output: { artifactId: expect.any(String), artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/), featureId: expect.any(String), featureRevision: expect.any(Number) } }, provenanceRecordId: expect.any(String) });
    const foreignResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Foreign external adapter project" }) }); const foreign = await foreignResponse.json() as { projectId: string; accessKey: string };
    const foreignCommand = await fetch(`${base}/api/projects/${project.projectId}/cad-agent/commands`, { method: "POST", headers: { "content-type": "application/json", "x-engineering-access-key": foreign.accessKey }, body: JSON.stringify({ message: "Generate a text-to-cad rectangular plate", externalParameters: { widthMm: 100, heightMm: 50, thicknessMm: 10, unit: "mm" }, confirmed: true }) }); expect(foreignCommand.status).toBe(403);
  }, 120_000);
});
