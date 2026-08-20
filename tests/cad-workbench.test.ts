import { describe, expect, it } from "vitest";

import { attachWorkbenchFile, runWorkbenchMessage, updateProposal } from "../server/cadWorkbench";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 3.7 CAD Agent conversational workbench", () => {
  it("creates a selection-aware, transparent, reversible modification proposal instead of silently changing geometry", () => {
    const result = runWorkbenchMessage({
      projectId: "WORKBENCH-MODIFY",
      projectName: "Mounting Study",
      message: "Make this stronger by changing width to 70 mm.",
      mode: "DEEP_ENGINEERING",
      modelName: "Concept A",
      selectedGeometry: { kind: "FACE", id: "FACE-12", label: "Top mounting face", featureId: "FEATURE-005", viewerFaceId: "FACE-12", source: "VIEWER" },
      requirementSummary: "4 validated dimensions; no material verification",
      parameterSummary: "width 100 mm",
      validationStage: "GEOMETRICALLY_VALIDATED",
    });

    expect(result.context.selectedGeometry.label).toBe("Top mounting face");
    expect(result.proposal?.status).toBe("PENDING");
    expect(result.proposal?.reversible).toBe(true);
    expect(result.proposal?.parameters[0]).toEqual({ name: "width", after: "70", unit: "mm" });
    expect(result.proposal?.affectedGeometry[0].kind).toBe("FACE");
    expect(result.proposal?.expectedEffect).toContain("Physical strength");
    expect(result.agentMessage.text).toContain("PROPOSED CHANGE");
    expect(result.evidence.some((item) => item.detail.includes("NOT VERIFIED"))).toBe(true);
    expect(result.history.some((item) => item.reversible)).toBe(true);
  });

  it("tracks preview, apply, and revert status in reversible design history", () => {
    const result = runWorkbenchMessage({ projectId: "WORKBENCH-REVERT", message: "Modify this feature.", mode: "NORMAL", selectedGeometry: { kind: "FEATURE", id: "FEATURE-003", label: "Corner fillet", featureId: "FEATURE-003", source: "FEATURE_TREE" } });
    const proposalId = result.proposal?.id;
    expect(proposalId).toBeTruthy();

    expect(updateProposal("WORKBENCH-REVERT", proposalId!, "PREVIEWED").status).toBe("PREVIEWED");
    expect(updateProposal("WORKBENCH-REVERT", proposalId!, "APPLIED").status).toBe("APPLIED");
    expect(updateProposal("WORKBENCH-REVERT", proposalId!, "REVERTED").status).toBe("REVERTED");
  });

  it("generates distinct conceptual architecture cards using the existing Phase 3.5 intelligence core", () => {
    const result = runWorkbenchMessage({ projectId: "WORKBENCH-CONCEPT", message: "Generate five alternative architectures for a difficult occupant safety system.", mode: "DEEP_ENGINEERING" });

    expect(result.concepts).toHaveLength(5);
    expect(new Set(result.concepts.map((item) => item.architecture)).size).toBe(5);
    expect(result.concepts.every((item) => item.validationStage === "CONCEPTUAL")).toBe(true);
    expect(result.concepts.every((item) => item.manufacturingConsiderations[0].startsWith("NOT VERIFIED"))).toBe(true);
  });

  it("reports file metadata association honestly without claiming binary transfer or interpretation", () => {
    const step = attachWorkbenchFile({ projectId: "WORKBENCH-FILES", name: "mounting_block.step", sizeBytes: 2048, mimeType: "application/step" });
    const unsupported = attachWorkbenchFile({ projectId: "WORKBENCH-FILES", name: "unknown.exe", sizeBytes: 10 });
    const oversized = attachWorkbenchFile({ projectId: "WORKBENCH-FILES", name: "large_model.stl", sizeBytes: 101 * 1024 * 1024 });

    expect(step.fileKind).toBe("STEP");
    expect(step.parseStatus).toBe("METADATA_ONLY");
    expect(step.metadata.binaryTransferred).toBe(false);
    expect(step.metadata.contentInterpreted).toBe(false);
    expect(step.failureReason).toContain("not implemented");
    expect(unsupported.parseStatus).toBe("UNSUPPORTED");
    expect(oversized.parseStatus).toBe("PARSE_FAILED");
  });

  it("returns an explicit guarded rectangular-pattern plan or targeted questions without inventing a source, direction, count, spacing, or unit", () => {
    const incomplete = runWorkbenchMessage({ projectId: "WORKBENCH-RECTANGULAR-INCOMPLETE", message: "Create a rectangular pattern of these bosses.", mode: "NORMAL" });
    expect(incomplete.agentMessage.text).toContain("Rectangular Pattern is blocked pending explicit evidence");
    expect(incomplete.agentMessage.text).toContain("source revision");
    const ready = runWorkbenchMessage({ projectId: "WORKBENCH-RECTANGULAR-READY", message: "Create a rectangular pattern: source: CIRCLE-REVISION-abcdef; feature: EXTRUDE-CIRCLE-001; direction x: GLOBAL_X_POSITIVE; direction y: GLOBAL_Y_POSITIVE; 3 x 2 bosses; spacing x: 20mm; spacing y: 25mm", mode: "NORMAL" });
    expect(ready.agentMessage.text).toContain("RECTANGULAR_PATTERN plan is ready for review");
    expect(ready.agentMessage.text).toContain("3 × 2");
    expect(ready.agentMessage.text).toContain("FILLET_READY remains FALSE");
  });

  it("exposes contextual conversation and attachment procedures through the mobile-facing API", async () => {
    const caller = appRouter.createCaller(ctx);
    const chat = await caller.workbench.message({ projectId: "WORKBENCH-API", message: "Challenge this design and find weaknesses.", mode: "CHALLENGE", selectedGeometry: { kind: "BODY", label: "Main body", source: "WORKBENCH" } });
    const file = await caller.workbench.attach({ projectId: "WORKBENCH-API", name: "requirements.pdf", sizeBytes: 500, mimeType: "application/pdf" });
    const project = await caller.workbench.project({ projectId: "WORKBENCH-API" });

    expect(chat.agentMessage.context.selectedGeometry.kind).toBe("BODY");
    expect(chat.agentMessage.actionKind).toBe("ANALYZE");
    expect(file.fileKind).toBe("PDF");
    expect(project.messages.length).toBeGreaterThanOrEqual(2);
    expect(project.attachments.length).toBe(1);
  });
});
