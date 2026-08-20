import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("cadFiles mobile API", () => {
  it("uploads, parses, retrieves, and analyzes an authorized STL through real server paths", async () => {
    const caller = appRouter.createCaller(ctx);
    const project = await caller.persistentMemory.openProject({ name: "CAD file router test" });
    const source = await readFile(join(process.cwd(), "tests", "fixtures", "minimal-tetrahedron.stl"));

    const upload = await caller.cadFiles.upload({ projectId: project.id, accessKey: project.accessKey, fileName: "router-tetrahedron.stl", mimeType: "model/stl", base64: source.toString("base64") });
    const found = await caller.cadFiles.get({ projectId: project.id, accessKey: project.accessKey, fileId: upload.file.fileId });
    const analysis = await caller.cadFiles.analyze({ projectId: project.id, accessKey: project.accessKey, fileId: upload.file.fileId, question: "What did the parser establish?" });

    expect(upload.file.parseStatus).toBe("PARSED");
    expect(found.stl?.triangles).toMatchObject({ value: 4, provenance: "PARSED" });
    expect(analysis.facts.join(" ")).toContain("Mesh: 4 triangles");
    expect(analysis.requiresCAE.join(" ")).toMatch(/stress|thermal|fatigue/i);
  }, 30_000);
});
