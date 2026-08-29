import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { resolveEngineeringReference, type PersistedEngineeringReference } from "../server/engineeringReferences";
import { registerEngineeringJobHttp } from "../server/engineeringJobHttp";

let server: Server | undefined;

async function startApi() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerEngineeringJobHttp(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_HTTP_SERVER_UNAVAILABLE");
  return `http://127.0.0.1:${address.port}`;
}

async function stopApi() {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
}

async function realArtifact(base: string, project: { projectId: string; accessKey: string }) {
  const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
  const createdResponse = await fetch(`${base}/api/projects/${project.projectId}/concept-designs`, { method: "POST", headers, body: JSON.stringify({ templateId: "CONCEPT_BACKREST_LOAD_PATH", name: "Reference artifact", description: "Real STEP reference source" }) });
  expect(createdResponse.status).toBe(201);
  const created = await createdResponse.json() as { seat: { id: string }; revisionId: string };
  const modelUrl = `${base}/api/projects/${project.projectId}/seat-designs/${created.seat.id}/revisions/${created.revisionId}/concept-design`;
  for (const [field, value] of [["BACKREST_WIDTH", "420"], ["BACKREST_HEIGHT", "560"], ["PLATE_THICKNESS", "3"]]) {
    expect((await fetch(`${modelUrl}/parameters/${field}`, { method: "PUT", headers, body: JSON.stringify({ value, unit: "mm" }) })).status).toBe(200);
  }
  const generated = await fetch(`${modelUrl}/generate-cad`, { method: "POST", headers });
  expect(generated.status).toBe(201);
  return (await generated.json() as { artifact: { cadFileId: string; artifactHash: string } }).artifact;
}

afterEach(stopApi);

describe("artifact-bound engineering reference HTTP integration", () => {
  it("persists and reloads a real kernel vertex reference without converting mesh display IDs into CAD authority", async () => {
    let base = await startApi();
    const projectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Engineering reference acceptance" }) });
    const project = await projectResponse.json() as { projectId: string; accessKey: string };
    const headers = { "content-type": "application/json", "x-engineering-access-key": project.accessKey };
    const artifact = await realArtifact(base, project);
    const createdAssemblyResponse = await fetch(`${base}/api/projects/${project.projectId}/assemblies`, { method: "POST", headers, body: JSON.stringify({ name: "Reference assembly", components: [{ label: "Backrest", cadFileId: artifact.cadFileId, sourceHash: artifact.artifactHash, translationMm: { x: 10, y: 20, z: 30 }, rotationDeg: { x: 0, y: 0, z: 90 } }] }) });
    expect(createdAssemblyResponse.status).toBe(201);
    const createdAssembly = await createdAssemblyResponse.json() as { record: { id: string; revision: number }; assembly: { components: Array<{ componentId: string }> } };
    const componentId = createdAssembly.assembly.components[0].componentId;

    const candidatesResponse = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${createdAssembly.record.id}/components/${componentId}/engineering-references/candidates`, { headers });
    expect(candidatesResponse.status).toBe(200);
    const candidates = await candidatesResponse.json() as { supportedReferenceTypes: string[]; unsupportedReferenceTypes: string[]; candidates: Array<{ referenceId: string; artifactId: string; artifactRevision: number; artifactSha256: string; referenceType: string; kernelEntityIdentity: string; sourceCoordinates: { x: number; y: number; z: number } }> };
    expect(candidates.supportedReferenceTypes).toEqual(["VERTEX"]);
    expect(candidates.unsupportedReferenceTypes).toEqual(expect.arrayContaining(["EDGE", "FACE", "AXIS", "PLANE", "COORDINATE_SYSTEM"]));
    expect(candidates.candidates.length).toBeGreaterThan(0);
    const candidate = candidates.candidates[0];
    expect(candidate).toMatchObject({ artifactId: artifact.cadFileId, artifactRevision: 1, artifactSha256: artifact.artifactHash, referenceType: "VERTEX", referenceId: expect.stringMatching(/^ENG_REF-/), kernelEntityIdentity: expect.stringMatching(/^OCC_VERTEX_POINT-/) });

    const persistResponse = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${createdAssembly.record.id}/components/${componentId}/engineering-references`, { method: "POST", headers, body: JSON.stringify({ referenceId: candidate.referenceId, reason: "Persist tested OpenCascade vertex reference" }) });
    expect(persistResponse.status).toBe(201);
    const persisted = await persistResponse.json() as { record: { id: string; revision: number }; reference: PersistedEngineeringReference; assembly: { schema: string; components: Array<{ engineeringReferences: PersistedEngineeringReference[] }> } };
    expect(persisted.record.revision).toBe(2);
    expect(persisted.assembly.schema).toBe("ASSEMBLY_AUTHORING_V3");
    expect(persisted.reference).toMatchObject({ componentId, referenceId: candidate.referenceId, artifactId: artifact.cadFileId, artifactSha256: artifact.artifactHash, referenceType: "VERTEX" });
    expect(persisted.assembly.components[0].engineeringReferences).toHaveLength(1);

    const resolvedResponse = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${persisted.record.id}/components/${componentId}/engineering-references`, { headers });
    expect(resolvedResponse.status).toBe(200);
    const resolved = await resolvedResponse.json() as { references: Array<{ resolutionStatus: string; reference: PersistedEngineeringReference; assemblySpace: { coordinates?: { x: number; y: number; z: number } } }> };
    expect(resolved.references[0]).toMatchObject({ resolutionStatus: "RESOLVED", reference: { referenceId: candidate.referenceId, kernelEntityIdentity: candidate.kernelEntityIdentity } });
    expect(resolved.references[0].assemblySpace.coordinates).toEqual({ x: -candidate.sourceCoordinates.y + 10, y: candidate.sourceCoordinates.x + 20, z: candidate.sourceCoordinates.z + 30 });

    const hashMismatch = await resolveEngineeringReference({ projectId: project.projectId, accessKey: project.accessKey, reference: { ...persisted.reference, artifactSha256: "a".repeat(64) } });
    expect(hashMismatch.resolutionStatus).toBe("ARTIFACT_HASH_MISMATCH");
    const revisionMismatch = await resolveEngineeringReference({ projectId: project.projectId, accessKey: project.accessKey, reference: { ...persisted.reference, artifactRevision: 999 } });
    expect(revisionMismatch.resolutionStatus).toBe("ARTIFACT_REVISION_MISMATCH");
    const fakePersist = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${createdAssembly.record.id}/components/${componentId}/engineering-references`, { method: "POST", headers, body: JSON.stringify({ referenceId: "FACE-001", reason: "No mesh labels as CAD authority" }) });
    expect(fakePersist.status).toBe(422);
    const foreignProjectResponse = await fetch(`${base}/api/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Foreign reference project" }) });
    const foreignProject = await foreignProjectResponse.json() as { projectId: string; accessKey: string };
    const foreignCandidates = await fetch(`${base}/api/projects/${foreignProject.projectId}/assemblies/${persisted.record.id}/components/${componentId}/engineering-references/candidates`, { headers: { "x-engineering-access-key": foreignProject.accessKey } });
    expect(foreignCandidates.status).not.toBe(200);

    await stopApi();
    base = await startApi();
    const afterRestart = await fetch(`${base}/api/projects/${project.projectId}/assemblies/${persisted.record.id}/components/${componentId}/engineering-references`, { headers });
    expect(afterRestart.status).toBe(200);
    const reloaded = await afterRestart.json() as { references: Array<{ resolutionStatus: string; reference: PersistedEngineeringReference }> };
    expect(reloaded.references[0]).toMatchObject({ resolutionStatus: "RESOLVED", reference: { referenceId: candidate.referenceId, artifactId: artifact.cadFileId, artifactRevision: 1, artifactSha256: artifact.artifactHash, kernelEntityIdentity: candidate.kernelEntityIdentity } });
  }, 120_000);
});
