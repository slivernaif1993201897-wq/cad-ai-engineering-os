import { describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("Phase 6.0 runtime architecture review", () => {
  it("persists a comprehensive review-only, deny-by-default, fail-closed future runtime specification with no execution capability", async () => {
    const caller = appRouter.createCaller(ctx); const project = await caller.persistentMemory.openProject({ name: "Phase 6.0 review" }); const access = { projectId: project.id, accessKey: project.accessKey };
    const review = await caller.cae.createRuntimeArchitectureReview(access);
    expect(review).toMatchObject({ contractVersion: "1.0.0", readinessDecision: "RUNTIME_NOT_APPROVED", executionEligible: false, executable: false });
    expect(review.architecture).toEqual(["CAD_AI", "CAE_AGENT", "SOLVER_ADAPTER", "EXECUTION_MANAGER", "SANDBOX", "SOLVER", "RESULT_COLLECTOR", "RESULT_VERIFICATION", "EVIDENCE_GRAPH"]);
    expect(review.boundaries).toHaveLength(8); expect(review.threats).toHaveLength(13); expect(review.permissions).toHaveLength(12); expect(review.resourceLimits).toHaveLength(8); expect(review.failures).toHaveLength(9); expect(review.humanGates).toHaveLength(5); expect(review.securityTests).toHaveLength(10);
    expect(review.permissions.every((item) => item.defaultDecision === "DENY")).toBe(true); expect(review.resourceLimits.every((item) => item.status === "NOT_CONFIGURED" && item.proposedLimit === undefined)).toBe(true); expect(review.threats.every((item) => item.residualRisk === "NOT_ACCEPTED")).toBe(true); expect(review.ioContract.parserTrustRule).toBe("PARSED_OUTPUT_IS_UNVERIFIED"); expect(review.verification.automaticVerificationProhibited).toBe(true); expect(review.failures.every((item) => item.historicalRecord === "IMMUTABLE")).toBe(true); expect(review.humanGates.every((item) => item.actor === "VERIFIED_HUMAN" && item.aiMayRecommend && !item.aiMayApprove)).toBe(true); expect(review.securityTests.every((item) => item.requiredBeforeExecution)).toBe(true);
    expect(review.resultTrustRequirements).toEqual(expect.arrayContaining(["solverIdentity", "solverVersion", "adapterIdentity", "adapterVersion", "inputHash", "cadRevisionHash", "caePlanRevision", "materialEvidenceReferences", "runtimeIdentity", "executionTimestamp", "resultHash"])); expect(review.decisionReason).toMatch(/architecture review only/i);
    const saved = await caller.cae.listRuntimeArchitectureReviews(access); expect(saved).toHaveLength(1); expect(saved[0]?.reviewId).toBe(review.reviewId);
    const graph = await caller.cae.runtimeArchitectureGraph({ ...access, reviewId: review.reviewId }); expect(graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: review.reviewId, type: "RUNTIME_ARCHITECTURE" }), expect.objectContaining({ id: `DECISION-${review.reviewId}`, type: "RUNTIME_DECISION", label: "RUNTIME_NOT_APPROVED" })])); expect(graph.limitations.join(" ")).toMatch(/No solver, mesher, executable adapter, shell/i);
    const audit = await caller.cae.securityAudit(access); expect(audit).toEqual(expect.arrayContaining([expect.objectContaining({ action: "RUNTIME_ARCHITECTURE_REVIEW", objectType: "RUNTIME_ARCHITECTURE", objectId: review.reviewId, newState: "RUNTIME_NOT_APPROVED" })]));
    const other = await caller.persistentMemory.openProject({ name: "Phase 6.0 isolation" }); await expect(caller.cae.listRuntimeArchitectureReviews({ projectId: other.id, accessKey: other.accessKey })).resolves.toEqual([]); expect(Object.keys(caller.cae)).not.toEqual(expect.arrayContaining(["executeSolver", "executeRuntime", "startExecution", "installSolver", "createMesher", "runShell"]));
  });
});
