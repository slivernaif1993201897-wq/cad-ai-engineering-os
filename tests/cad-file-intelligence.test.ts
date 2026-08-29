import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { formatFromName, parseCadFileBytes } from "../server/cadFileIntelligence";
import { getCadFileContext, ingestCadFile, listCadFiles, removeCadFile } from "../server/cadFileIntelligence";
import { createPersistentConversation, openPersistentProject } from "../server/persistentMemory";
import { runPersistentWorkbenchMessage } from "../server/persistentWorkbench";

const fixture = (name: string) => readFile(join(process.cwd(), "tests", "fixtures", name));

describe("Phase 3.9 real CAD file intelligence", () => {
  it("detects canonical CAD formats case-insensitively through the authoritative filename dispatcher", () => {
    expect(formatFromName("plate.dxf")).toBe("DXF");
    expect(formatFromName("PLATE.DXF")).toBe("DXF");
    expect(formatFromName("Plate.Dxf")).toBe("DXF");
    expect(formatFromName("plate.step")).toBe("STEP");
    expect(formatFromName("plate.stp")).toBe("STEP");
    expect(formatFromName("plate.stl")).toBe("STL");
    expect(formatFromName("unknown.xyz")).toBe("UNSUPPORTED");
  });

  it("persists a DXF-classified file through the authoritative project CAD ingestion path", async () => {
    const project = await openPersistentProject({ name: "DXF format persistence project" });
    const persisted = await ingestCadFile({
      projectId: project.id,
      accessKey: project.accessKey,
      fileName: "plate.dxf",
      mimeType: "application/dxf",
      base64: Buffer.from("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n").toString("base64"),
    });

    expect(persisted.file.format).toBe("DXF");
    expect((await getCadFileContext({ projectId: project.id, accessKey: project.accessKey, fileId: persisted.file.fileId })).format).toBe("DXF");
  });

  it("imports a real OpenCascade-generated STEP file through OpenCascade with truthful topology and extents", async () => {
    const result = await parseCadFileBytes("minimal-box.step", await fixture("minimal-box.step"));

    expect(result.format).toBe("STEP");
    expect(result.parser).toBe("OpenCascade.js");
    expect(result.parseStatus).toBe("PARSED");
    expect(result.validationStatus).toBe("VALID");
    expect(result.step?.solids).toMatchObject({ value: 1, provenance: "PARSED" });
    expect(result.step?.faces).toMatchObject({ value: 6, provenance: "PARSED" });
    expect(result.boundingBox?.size[0]).toBeCloseTo(100, 1);
    expect(result.boundingBox?.size[1]).toBeCloseTo(50, 1);
    expect(result.boundingBox?.size[2]).toBeCloseTo(20, 1);
    expect(result.boundingBox?.provenance).toBe("CALCULATED");
  });

  it("parses a real watertight STL mesh and derives, rather than invents, mesh statistics", async () => {
    const result = await parseCadFileBytes("minimal-tetrahedron.stl", await fixture("minimal-tetrahedron.stl"));

    expect(result.format).toBe("STL");
    expect(result.parseStatus).toBe("PARSED");
    expect(result.units).toMatchObject({ status: "UNKNOWN", provenance: "UNKNOWN" });
    expect(result.stl?.triangles).toMatchObject({ value: 4, provenance: "PARSED" });
    expect(result.stl?.watertight).toMatchObject({ value: true, provenance: "CALCULATED" });
    expect(result.stl?.surfaceArea.value).toBeCloseTo(2.366, 3);
    expect(result.stl?.signedVolume).toMatchObject({ value: 1 / 6, provenance: "CALCULATED" });
    expect(result.boundingBox?.size).toEqual([1, 1, 1]);
  });

  it("never fabricates geometry for an invalid STL", async () => {
    const result = await parseCadFileBytes("invalid.stl", await fixture("invalid.stl"));

    expect(result.parseStatus).toBe("CORRUPTED");
    expect(result.validationStatus).toBe("INVALID");
    expect(result.stl).toBeUndefined();
    expect(result.boundingBox).toBeUndefined();
    expect(result.parserError?.reason).toMatch(/incomplete/i);
    expect(result.parserError?.recommendedAction).toBeTruthy();
  });

  it("labels unsupported types honestly instead of attempting to parse them", async () => {
    const result = await parseCadFileBytes("assembly.iges", Buffer.from("not a STEP or STL payload"));

    expect(result.format).toBe("UNSUPPORTED");
    expect(result.parseStatus).toBe("UNSUPPORTED");
    expect(result.validationStatus).toBe("UNKNOWN");
    expect(result.parser).toBe("NONE");
    expect(result.boundingBox).toBeUndefined();
  });

  it("uses managed storage and durable project records without cross-project file access or silent overwrites", async () => {
    const project = await openPersistentProject({ name: "CAD file acceptance project" });
    const bytes = await fixture("minimal-tetrahedron.stl");
    const first = await ingestCadFile({ projectId: project.id, accessKey: project.accessKey, fileName: "bracket.stl", mimeType: "model/stl", base64: bytes.toString("base64") });
    const duplicate = await ingestCadFile({ projectId: project.id, accessKey: project.accessKey, fileName: "bracket.stl", mimeType: "model/stl", base64: bytes.toString("base64") });
    const successor = await ingestCadFile({ projectId: project.id, accessKey: project.accessKey, fileName: "bracket.stl", mimeType: "model/stl", base64: Buffer.concat([bytes, Buffer.from("\n")]).toString("base64") });

    expect(first.file.storage).toMatchObject({ key: expect.stringContaining(`engineering-projects/${project.id}`), url: expect.stringContaining("/manus-storage/") });
    expect(first.file.version).toBe(1);
    expect(duplicate.duplicateOfFileId).toBe(first.file.fileId);
    expect(duplicate.file.version).toBe(1);
    expect(successor.file.version).toBe(2);
    expect(successor.file.parentFileId).toBe(first.file.fileId);
    expect(await listCadFiles({ projectId: project.id, accessKey: project.accessKey })).toHaveLength(2);

    const otherProject = await openPersistentProject({ name: "Separate CAD project" });
    await expect(getCadFileContext({ projectId: otherProject.id, accessKey: otherProject.accessKey, fileId: first.file.fileId })).rejects.toThrow(/not available in the authorized project/i);

    const removed = await removeCadFile({ projectId: project.id, accessKey: project.accessKey, fileId: first.file.fileId });
    expect(removed.parseStatus).toBe("REMOVED");
    expect(await listCadFiles({ projectId: project.id, accessKey: project.accessKey })).toHaveLength(1);
  }, 30_000);

  it("rejects file payloads over 10 MiB before parsing or storage", async () => {
    const project = await openPersistentProject({ name: "CAD file size boundary project" });
    const oversize = Buffer.alloc(10 * 1024 * 1024 + 1, 1).toString("base64");

    await expect(ingestCadFile({ projectId: project.id, accessKey: project.accessKey, fileName: "oversize.stl", base64: oversize })).rejects.toThrow(/10 MiB CAD file limit|bounded upload envelope/i);
  });

  it("supplies same-project parser context to the durable CAD Agent workbench without claiming more than the parser established", async () => {
    const project = await openPersistentProject({ name: "CAD Agent file context project" });
    const conversation = await createPersistentConversation({ projectId: project.id, accessKey: project.accessKey, title: "File inspection", reason: "Acceptance test" });
    const upload = await ingestCadFile({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, fileName: "inspection.stl", base64: (await fixture("minimal-tetrahedron.stl")).toString("base64") });

    const result = await runPersistentWorkbenchMessage({ projectId: project.id, accessKey: project.accessKey, conversationId: conversation.id, message: "Inspect the attached file and identify what is unknown.", mode: "NORMAL", attachedFileIds: [upload.file.fileId] });

    expect(result.context.attachedFileIds).toEqual([upload.file.fileId]);
    expect(result.context.memorySummary).toContain("inspection.stl");
    expect(result.context.memorySummary).toContain("PARSED");
    expect(result.agentMessage.text).toMatch(/unknown|engineering action|selection/i);
  }, 30_000);
});
