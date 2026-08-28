import { describe, expect, it } from "vitest";

import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";
import { createMountingBlockConfiguration } from "../server/cadAgent";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const mountingInput = { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true };
const prompt = "Create a 100 mm x 50 mm x 20 mm mounting block with four 10 mm holes near the corners using a 10 mm edge offset and a 3 mm fillet.";

describe("Phase 4.5 controlled CAD Execution Engine", () => {
  it("plans, previews, applies, validates, and persists an immutable real-kernel parameter revision only after approval", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "CAD execution real kernel" });
    const created = await createMountingBlockConfiguration({ name: `Execution ${Date.now()}`, input: mountingInput, sourceText: prompt });
    const plan = await caller.cadExecution.plan({ projectId: project.id, accessKey: project.accessKey, configurationId: created.configuration.id, requestedParameter: { name: "width", value: 120, unit: "mm" } });
    expect(plan).toMatchObject({ operationType: "SET_MOUNTING_BLOCK_PARAMETER", state: "DRAFT", provenance: "INFERRED" });
    expect(plan.parameters[0]).toMatchObject({ name: "width", priorValue: 100, value: 120, unit: "mm" });
    const beforePreview = await caller.cadAgent.listConfigurations(); const preview = await caller.cadExecution.preview({ projectId: project.id, accessKey: project.accessKey, operationId: plan.operationId }); const afterPreview = await caller.cadAgent.listConfigurations();
    expect(preview.plan.state).toBe("PREVIEW_READY"); expect(preview.preview).toMatchObject({ state: "PREVIEW_READY", validationStatus: "PASSED", viewerMeshAvailable: true });
    expect(afterPreview).toHaveLength(beforePreview.length);
    const executed = await caller.cadExecution.applyOperation({ projectId: project.id, accessKey: project.accessKey, operationId: plan.operationId });
    expect(executed.plan.state).toBe("OPERATION_EXECUTED"); expect(executed.history).toMatchObject({ executionStatus: "OPERATION_EXECUTED", validationStatus: "PASSED", truth: "KERNEL_VALIDATED" });
    expect(executed.resultConfigurationId).toBeDefined();
    const configurations = await caller.cadAgent.listConfigurations(); const source = configurations.find((configuration) => configuration.id === created.configuration.id); const result = configurations.find((configuration) => configuration.id === executed.resultConfigurationId);
    expect(source?.input.width).toBe(100); expect(result?.input.width).toBe(120); expect(result?.modelStatus).toBe("VALIDATED");
    const reverted = await caller.cadExecution.revert({ projectId: project.id, accessKey: project.accessKey, operationId: plan.operationId });
    const history = await caller.cadExecution.history({ projectId: project.id, accessKey: project.accessKey }); const snapshot = await caller.persistentMemory.snapshot({ projectId: project.id, accessKey: project.accessKey });
    expect(history.some((entry) => entry.operationId === plan.operationId && entry.resultRevision === executed.resultConfigurationId)).toBe(true);
    expect(reverted.targetConfigurationId).toBe(created.configuration.id);
    expect(history.some((entry) => entry.operationId === plan.operationId && entry.executionStatus === "REVERTED" && entry.resultRevision === created.configuration.id)).toBe(true);
    expect(snapshot.lineage.some((node) => node.title.includes(executed.resultConfigurationId!))).toBe(true);
  }, 45_000);

  it("blocks invalid parameters and imported opaque references before execution, preserves the source, exposes recovery, and records no false success", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "CAD execution invalids" });
    const created = await createMountingBlockConfiguration({ name: `Invalid ${Date.now()}`, input: mountingInput, sourceText: prompt }); const before = await caller.cadAgent.listConfigurations();
    const invalid = await caller.cadExecution.plan({ projectId: project.id, accessKey: project.accessKey, configurationId: created.configuration.id, requestedParameter: { name: "width", value: 0, unit: "mm" } });
    const invalidPreview = await caller.cadExecution.preview({ projectId: project.id, accessKey: project.accessKey, operationId: invalid.operationId });
    expect(invalid).toMatchObject({ state: "OPERATION_INVALID", issue: { code: "OPERATION_INVALID", invalidParameter: "width" } }); expect(invalidPreview.preview.state).toBe("OPERATION_INVALID");
    const invalidated = await caller.cadExecution.plan({ projectId: project.id, accessKey: project.accessKey, configurationId: created.configuration.id, selectedGeometry: { kind: "FACE", id: "FILE-opaque:FACE-00001", label: "Imported face", viewerFaceId: "FACE-00001", source: "VIEWER" }, requestedParameter: { name: "height", value: 25, unit: "mm" } });
    expect(invalidated).toMatchObject({ state: "REFERENCE_INVALIDATED", issue: { code: "REFERENCE_INVALIDATED" } });
    const invalidatedPreview = await caller.cadExecution.preview({ projectId: project.id, accessKey: project.accessKey, operationId: invalidated.operationId });
    expect(invalidatedPreview.preview.issue?.recommendedCorrection).toMatch(/Imported STEP\/STL|imported/i);
    const after = await caller.cadAgent.listConfigurations(); const history = await caller.cadExecution.history({ projectId: project.id, accessKey: project.accessKey });
    expect(after).toHaveLength(before.length); expect(after.find((configuration) => configuration.id === created.configuration.id)?.input.width).toBe(100);
    expect(history.some((entry) => entry.operationId === invalid.operationId && entry.executionStatus === "OPERATION_INVALID" && entry.recovery?.alternatives.length)).toBe(true);
    expect(history.some((entry) => entry.operationId === invalidated.operationId && entry.executionStatus === "REFERENCE_INVALIDATED")).toBe(true);
  }, 35_000);

  it("supports explicit reject, proposal-to-plan conversion, prevents applying without preview, and enforces project capability isolation", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "CAD execution control" }); const other = await caller.persistentMemory.openProject({ name: "CAD execution other" });
    const created = await createMountingBlockConfiguration({ name: `Control ${Date.now()}`, input: mountingInput, sourceText: prompt });
    const plan = await caller.cadExecution.plan({ projectId: project.id, accessKey: project.accessKey, configurationId: created.configuration.id, proposal: { id: "PROPOSAL-WIDTH", parameters: [{ name: "width", after: "125", unit: "mm" }] } });
    await expect(caller.cadExecution.applyOperation({ projectId: project.id, accessKey: project.accessKey, operationId: plan.operationId })).rejects.toThrow(/PREVIEW_READY/);
    const rejected = await caller.cadExecution.reject({ projectId: project.id, accessKey: project.accessKey, operationId: plan.operationId });
    expect(rejected.executionStatus).toBe("REJECTED");
    await expect(caller.cadExecution.preview({ projectId: other.id, accessKey: other.accessKey, operationId: plan.operationId })).rejects.toThrow(/unavailable|expired/i);
    const history = await caller.cadExecution.history({ projectId: project.id, accessKey: project.accessKey });
    expect(history.some((entry) => entry.operationId === plan.operationId && entry.executionStatus === "REJECTED")).toBe(true);
  }, 35_000);
});
