import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { openPersistentProject } from "../server/persistentMemory";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("local Gmsh status API", () => {
  it("requires project authorization and exposes bounded engine identity without process controls", async () => {
    const project = await openPersistentProject({ name: "Gmsh status API" });
    const caller = appRouter.createCaller(ctx);
    const status = await caller.cae.localGmshStatus({ projectId: project.id, accessKey: project.accessKey });
    expect(status).toMatchObject({ status: "READY", identity: { kind: "GMSH", version: "4.12.1", environmentHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(JSON.stringify(status)).not.toMatch(/executablePath|spawn|shell|command/i);
    await expect(caller.cae.localGmshStatus({ projectId: project.id, accessKey: "invalid-project-access-key" })).rejects.toThrow(/access was denied/i);
    expect(Object.keys(caller.cae)).not.toEqual(expect.arrayContaining(["runShell", "runProcess", "executeGmshCommand", "executeCalculiXCommand"]));
  });
});
