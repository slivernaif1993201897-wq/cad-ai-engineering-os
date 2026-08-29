import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import { openPersistentProject } from "../server/persistentMemory";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
describe("local CAM status API", () => {
  it("requires project access and reveals bounded engine identity only", async () => {
    const project = await openPersistentProject({ name: "CAM status API" }); const caller = appRouter.createCaller(ctx);
    await expect(caller.cam.localStatus({ projectId: project.id, accessKey: "invalid-project-access-key" })).rejects.toThrow(/access was denied/i);
    const status = await caller.cam.localStatus({ projectId: project.id, accessKey: project.accessKey });
    expect(status).toMatchObject({ status: "ENGINE_AVAILABLE", engine: "CAD_AI_2P5D_CAM", supportedOperations: ["FACING", "POCKET", "CONTOUR"], supportedPostProcessors: ["GRBL_1_1"] });
    expect(JSON.stringify(status)).not.toMatch(/path|spawn|shell|command|gcode|toolpath/i);
    expect(Object.keys(caller.cam)).not.toEqual(expect.arrayContaining(["run", "execute", "postProcess", "runShell", "runProcess"]));
  });
});
