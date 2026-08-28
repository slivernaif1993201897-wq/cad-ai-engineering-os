import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

let server: Server | undefined;
async function startApi() { const app = express(); app.use(express.json({ limit: "2mb" })); registerEngineeringJobHttp(app); server = createServer(app); await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE"); return `http://127.0.0.1:${address.port}`; }
afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); server = undefined; });

describe("concept design authoring API", () => {
  it("persists source-backed required parameters, gates CAD, creates successor revision, and rejects foreign access", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Concept API regression" }) });
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const templates = await fetch(`${base}/api/design-templates`, { headers }); expect(templates.status).toBe(200); await expect(templates.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "CONCEPT_BACKREST_LOAD_PATH" })]));
    const createdResponse = await fetch(`${base}/api/projects/${project.projectId}/concept-designs`, { method: "POST", headers, body: JSON.stringify({ templateId: "CONCEPT_BACKREST_LOAD_PATH", name: "User backrest", description: "Editable backrest envelope" }) });
    expect(createdResponse.status).toBe(201); const created = await createdResponse.json() as { seat: { id: string }; revisionId: string };
    const modelUrl = `${base}/api/projects/${project.projectId}/seat-designs/${created.seat.id}/revisions/${created.revisionId}/concept-design`;
    const initial = await fetch(modelUrl, { headers }); await expect(initial.json()).resolves.toMatchObject({ cadReadiness: "REQUIRED_INPUT", feStatus: "FE_BLOCKED" });
    const blockedCad = await fetch(`${modelUrl}/generate-cad`, { method: "POST", headers }); expect(blockedCad.status).toBe(422);
    for (const [name, value] of [["BACKREST_WIDTH", "420"], ["BACKREST_HEIGHT", "560"], ["PLATE_THICKNESS", "3"]]) {
      const response = await fetch(`${modelUrl}/parameters/${name}`, { method: "PUT", headers, body: JSON.stringify({ value, unit: "mm" }) }); expect(response.status).toBe(200);
    }
    const ready = await fetch(modelUrl, { headers }); await expect(ready.json()).resolves.toMatchObject({ cadReadiness: "CAD_READY" });
    const successor = await fetch(`${modelUrl}/successor`, { method: "POST", headers }); expect(successor.status).toBe(201); const successorBody = await successor.json() as { revisionId: string };
    expect(successorBody.revisionId).not.toBe(created.revisionId);
    const foreign = await fetch(modelUrl, { headers: { "x-engineering-access-key": "wrong-key" } }); expect(foreign.status).toBe(403);
  }, 20_000);

  it("registers generated STEP as a project-owned CAD file and serves only its verified viewer scene", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Concept CAD viewer regression" }) });
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const createdResponse = await fetch(`${base}/api/projects/${project.projectId}/concept-designs`, { method: "POST", headers, body: JSON.stringify({ templateId: "CONCEPT_BACKREST_LOAD_PATH", name: "Viewer backrest", description: "Verified viewer artifact" }) });
    const created = await createdResponse.json() as { seat: { id: string }; revisionId: string };
    const modelUrl = `${base}/api/projects/${project.projectId}/seat-designs/${created.seat.id}/revisions/${created.revisionId}/concept-design`;
    for (const [name, value] of [["BACKREST_WIDTH", "420"], ["BACKREST_HEIGHT", "560"], ["PLATE_THICKNESS", "3"]]) await fetch(`${modelUrl}/parameters/${name}`, { method: "PUT", headers, body: JSON.stringify({ value, unit: "mm" }) });
    const generated = await fetch(`${modelUrl}/generate-cad`, { method: "POST", headers }); expect(generated.status).toBe(201);
    const generatedBody = await generated.json() as { artifact: { cadFileId: string; artifactHash: string } };
    expect(generatedBody.artifact.cadFileId).toMatch(/\S/);
    const sceneUrl = `${base}/api/projects/${project.projectId}/cad-files/${generatedBody.artifact.cadFileId}/viewer-scene`;
    const sceneResponse = await fetch(sceneUrl, { headers }); expect(sceneResponse.status).toBe(200);
    await expect(sceneResponse.json()).resolves.toMatchObject({ file: { fileId: generatedBody.artifact.cadFileId, sha256: generatedBody.artifact.artifactHash }, mesh: { sourceHash: generatedBody.artifact.artifactHash } });
    expect((await fetch(sceneUrl, { headers: { "x-engineering-access-key": "wrong-key" } })).status).toBe(403);
    const foreignProject = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Foreign viewer regression" }) });
    const foreign = await foreignProject.json() as { projectId: string; accessKey: string };
    expect((await fetch(`${base}/api/projects/${foreign.projectId}/cad-files/${generatedBody.artifact.cadFileId}/viewer-scene`, { headers: { "x-engineering-access-key": foreign.accessKey } })).status).not.toBe(200);
  }, 35_000);

  it("persists only user-defined transforms for verified CAD components and keeps constraints fail closed", async () => {
    const base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Assembly transform regression" }) });
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const createdResponse = await fetch(`${base}/api/projects/${project.projectId}/concept-designs`, { method: "POST", headers, body: JSON.stringify({ templateId: "CONCEPT_BACKREST_LOAD_PATH", name: "Assembly source", description: "Verified component source" }) });
    const created = await createdResponse.json() as { seat: { id: string }; revisionId: string };
    const modelUrl = `${base}/api/projects/${project.projectId}/seat-designs/${created.seat.id}/revisions/${created.revisionId}/concept-design`;
    for (const [name, value] of [["BACKREST_WIDTH", "420"], ["BACKREST_HEIGHT", "560"], ["PLATE_THICKNESS", "3"]]) await fetch(`${modelUrl}/parameters/${name}`, { method: "PUT", headers, body: JSON.stringify({ value, unit: "mm" }) });
    const generated = await fetch(`${modelUrl}/generate-cad`, { method: "POST", headers }); const artifact = (await generated.json() as { artifact: { cadFileId: string; artifactHash: string } }).artifact;
    const component = { label: "Backrest instance A", cadFileId: artifact.cadFileId, sourceHash: artifact.artifactHash, translationMm: { x: 0, y: 0, z: 0 }, rotationDeg: { x: 0, y: 0, z: 0 } };
    const assemblyResponse = await fetch(`${base}/api/projects/${project.projectId}/assemblies`, { method: "POST", headers, body: JSON.stringify({ name: "User transform assembly", components: [component] }) }); expect(assemblyResponse.status).toBe(201);
    const assembly = await assemblyResponse.json() as { record: { id: string; status: string }; assembly: { transformMode: string; constraintState: string; components: Array<{ componentId: string }> } };
    expect(assembly).toMatchObject({ record: { status: "DRAFT" }, assembly: { transformMode: "USER_DEFINED_RIGID_TRANSFORM", constraintState: "REQUIRED_INPUT", components: [{ artifactId: artifact.cadFileId, artifactRevision: 1, artifactSha256: artifact.artifactHash, verifiedIngestionState: "VERIFIED", geometryRepresentation: "KERNEL_DERIVED_MESH" }] } });
    const revised = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${assembly.record.id}/revise`, { method: "POST", headers, body: JSON.stringify({ name: "User transform assembly", reason: "Move instance", components: [{ ...component, componentId: assembly.assembly.components[0].componentId, translationMm: { x: 25, y: 0, z: 0 } }] }) }); expect(revised.status).toBe(201); const revisedBody = await revised.json() as any;
    expect(revisedBody.record.id).not.toBe(assembly.record.id); expect(revisedBody.assembly.components[0].transform.translationMm.x).toBe(25);
    const constrained = await fetch(`${base}/api/projects/${project.projectId}/assemblies`, { method: "POST", headers, body: JSON.stringify({ name: "Constraint-gated assembly", components: [component], constraints: [{ kind: "COINCIDENT", componentIds: ["COMPONENT-1"], referencedFaceIds: ["FACE-00001"] }] }) }); await expect(constrained.json()).resolves.toMatchObject({ record: { status: "REQUIRED_INPUT" }, assembly: { constraintState: "UNSUPPORTED" } });
    expect((await fetch(`${base}/api/projects/${project.projectId}/assemblies`, { headers: { "x-engineering-access-key": "wrong-key" } })).status).toBe(403);
  }, 40_000);
});
