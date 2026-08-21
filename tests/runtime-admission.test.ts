import { beforeAll, describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Final Runtime Build · bounded admission boundary", () => {
  const caller = appRouter.createCaller(ctx);
  let access: { projectId: string; accessKey: string };
  let isolated: { projectId: string; accessKey: string };
  let decision: any;

  beforeAll(async () => {
    const project = await caller.persistentMemory.openProject({ name: "Runtime admission boundary" });
    const other = await caller.persistentMemory.openProject({ name: "Runtime admission boundary isolation" });
    access = { projectId: project.id, accessKey: project.accessKey };
    isolated = { projectId: other.id, accessKey: other.accessKey };
    decision = await caller.runtimeAdmission.evaluate({ ...access, input: { requestedAction: "GMSH_MESH", canonicalJobId: "MISSING-JOB", solverInputPackageId: "MISSING-PACKAGE", configurationId: "MISSING-CONFIGURATION", environmentId: "MISSING-ENVIRONMENT" } });
  });

  it("1. records an immutable rejected admission for missing project-scoped execution references", () => expect(decision).toMatchObject({ requestedAction: "GMSH_MESH", state: "REJECTED", recordOnly: true, executionStarted: false, executionEligible: false, executable: false, reasonCodes: expect.arrayContaining(["CANONICAL_JOB_MISSING", "SOLVER_INPUT_PACKAGE_MISSING", "SOLVER_CONFIGURATION_MISSING", "ENVIRONMENT_MISSING", "RUNTIME_ASSURANCE_GATES_NOT_PASS", "EXECUTION_ENGINE_NOT_IMPLEMENTED"]) }));
  it("2. hashes the complete decision and does not mistake a request for a started job", () => { expect(decision.decisionHash).toMatch(/^[a-f0-9]{64}$/); expect(decision.reasons.join(" ")).toMatch(/no execution engine|recorded only/i); });
  it("3. appends an immutable, project-scoped decision record", async () => expect(await caller.runtimeAdmission.listDecisions(access)).toEqual(expect.arrayContaining([expect.objectContaining({ admissionDecisionId: decision.admissionDecisionId, decisionHash: decision.decisionHash, executionStarted: false })])));
  it("4. isolates admission decisions by project", async () => expect(await caller.runtimeAdmission.listDecisions(isolated)).toEqual([]));
  it("5. rejects unbounded command or path fields instead of silently stripping them", async () => await expect(caller.runtimeAdmission.evaluate({ ...access, input: { requestedAction: "CALCULIX_SOLVE", canonicalJobId: "MISSING-JOB", solverInputPackageId: "MISSING-PACKAGE", configurationId: "MISSING-CONFIGURATION", environmentId: "MISSING-ENVIRONMENT", command: "ccx arbitrary.inp" } as any })).rejects.toThrow(/unrecognized key/i));
  it("6. exposes no execution, shell, process, filesystem, network, Gmsh, or CalculiX endpoint", () => expect(Object.keys(caller.runtimeAdmission)).not.toEqual(expect.arrayContaining(["execute", "run", "spawn", "shell", "filesystem", "network", "gmsh", "calculix", "ccx"])));
});
