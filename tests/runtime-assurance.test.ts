import { describe, expect, it, beforeAll } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const h = (value: string) => value.repeat(64);
const window = () => ({ validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 3_600_000).toISOString() });

describe("Phase 6.15 Runtime Assurance Governance", () => {
  const caller = appRouter.createCaller(ctx);
  let access: { projectId: string; accessKey: string };
  let other: { projectId: string; accessKey: string };
  let assessment: any;
  let failure: any;

  beforeAll(async () => {
    const project = await caller.persistentMemory.openProject({ name: "Phase 6.15 runtime assurance" });
    const isolated = await caller.persistentMemory.openProject({ name: "Phase 6.15 runtime assurance isolation" });
    access = { projectId: project.id, accessKey: project.accessKey };
    other = { projectId: isolated.id, accessKey: isolated.accessKey };
    await caller.runtimeAssurance.recordEnvironment({ ...access, input: { environmentId: "FUTURE-SEGREGATED-ENV", imageBaseline: "DECLARED-BASELINE", operatingSystem: "UNKNOWN", kernel: "UNKNOWN", cpuLimit: "UNKNOWN", memoryLimit: "UNKNOWN", storageLimit: "UNKNOWN", networkPolicy: "DECLARATION_ONLY", timeoutPolicy: "UNKNOWN", environmentHash: h("a"), provenance: ["No environment was provisioned by this test."], approvalState: "UNKNOWN", approvalScope: "EXTERNAL_REVIEW_REQUIRED", ...window(), observedEvidenceHash: h("b") } });
    await caller.runtimeAssurance.recordObservedTest({ ...access, input: { gateId: "G1_REAL_SANDBOX", testId: "FUTURE-SANDBOX-TEST", evidenceScope: "INTERNAL_VERIFIED", evidenceOrigin: "FUTURE_DEFINITION", environmentId: "FUTURE-SEGREGATED-ENV", performerIdentity: "CAD-AI", expectedBehavior: "Future approved sandbox denies disallowed actions.", observedBehavior: "No sandbox test was executed.", inputHash: h("c"), rawEvidenceHash: h("d"), result: "UNKNOWN", timestamp: new Date().toISOString(), limitations: ["This is a future-test declaration, not observed enforcement."] } });
    assessment = await caller.runtimeAssurance.assess(access);
    failure = await caller.runtimeAssurance.recordFailure({ ...access, input: { gateId: "G0_APPROVED_TEST_ENVIRONMENT", rootCauseId: "NO-APPROVED-ENVIRONMENT", classification: "EXTERNAL_DEPENDENCY", observedEvidenceIds: [], rootCauseSummary: "No independently approved segregated test environment is available.", remainingRisk: "No runtime, sandbox, mesher, solver, or hostile-test evidence can legitimately be created." } });
  });

  it("1. starts fail-closed with G0 BLOCKED and production readiness blocked", () => {
    expect(assessment).toMatchObject({ readiness: "BLOCKED", executionEligible: false, executable: false, internalVerificationDoesNotAuthorizeProduction: true });
    expect(assessment.gates.find((gate: any) => gate.gateId === "G0_APPROVED_TEST_ENVIRONMENT")).toMatchObject({ state: "BLOCKED", determination: "EXTERNAL_INFRASTRUCTURE_BLOCKED" });
    expect(assessment.gates.find((gate: any) => gate.gateId === "G13_PRODUCTION_READINESS")).toMatchObject({ state: "BLOCKED", determination: "DEPENDENCY_BLOCKED" });
  });

  it("2. keeps an internally declared test from promoting any dependent gate", () => {
    const gate = assessment.gates.find((item: any) => item.gateId === "G1_REAL_SANDBOX");
    expect(gate).toMatchObject({ state: "BLOCKED", internalEvidenceIds: expect.arrayContaining([expect.any(String)]), evidenceIds: [] });
  });

  it("3. rejects an approved environment without independent reviewer authorization", async () => {
    await expect(caller.runtimeAssurance.recordEnvironment({ ...access, input: { environmentId: "UNAUTHORIZED-ENV", imageBaseline: "BASE", operatingSystem: "OS", kernel: "KERNEL", cpuLimit: "1", memoryLimit: "1", storageLimit: "1", networkPolicy: "DENY", timeoutPolicy: "1", environmentHash: h("e"), provenance: ["p"], approvalState: "APPROVED", approvalScope: "INTERNAL_VERIFIED", ...window(), observedEvidenceHash: h("f") } })).rejects.toThrow(/independently verified reviewer authorization/i);
  });

  it("4. rejects a gate PASS without externally observed independently reviewed evidence", async () => {
    await expect(caller.runtimeAssurance.recordObservedTest({ ...access, input: { gateId: "G1_REAL_SANDBOX", testId: "UNAUTHORIZED-PASS", evidenceScope: "INTERNAL_VERIFIED", evidenceOrigin: "INTERNAL_TEST", environmentId: "FUTURE-SEGREGATED-ENV", performerIdentity: "CAD-AI", expectedBehavior: "deny", observedBehavior: "not executed", inputHash: h("1"), rawEvidenceHash: h("2"), result: "PASS", timestamp: new Date().toISOString(), limitations: [] } })).rejects.toThrow(/externally observed, independently verified/i);
  });

  it("5. preserves all G0–G13 dependencies without an upstream false pass", () => {
    for (let index = 1; index < assessment.gates.length; index += 1) {
      expect(assessment.gates[index].dependencies).toContain(assessment.gates[index - 1].gateId);
      expect(assessment.gates[index].state).toBe("BLOCKED");
    }
  });

  it("6. records immutable root-cause evidence without implying a repair", () => expect(failure).toMatchObject({ state: "OPEN", immutable: true, classification: "EXTERNAL_DEPENDENCY" }));

  it("7. preserves repair-attempt provenance and rejects a repeated strategy", async () => {
    const first = await caller.runtimeAssurance.recordRepairAttempt({ ...access, input: { failureId: failure.failureId, rootCauseId: failure.rootCauseId, repairStrategy: "Request independently approved test environment.", targetedTestReference: "G0-ENV-APPROVAL", regressionStatus: "NOT_RUN", result: "BLOCKED", evidence: ["External authorization remains absent."] } });
    expect(first).toMatchObject({ attemptCount: 1, escalationRequired: false, immutable: true });
    await expect(caller.runtimeAssurance.recordRepairAttempt({ ...access, input: { failureId: failure.failureId, rootCauseId: failure.rootCauseId, repairStrategy: "Request independently approved test environment.", targetedTestReference: "G0-ENV-APPROVAL", regressionStatus: "NOT_RUN", result: "BLOCKED", evidence: ["Still unavailable."] } })).rejects.toThrow(/cannot be repeated/i);
  });

  it("8. requires root-cause escalation after three distinct unsuccessful strategies", async () => {
    await caller.runtimeAssurance.recordRepairAttempt({ ...access, input: { failureId: failure.failureId, rootCauseId: failure.rootCauseId, repairStrategy: "Review environment-approval policy and required evidence schema.", targetedTestReference: "G0-POLICY-REVIEW", regressionStatus: "NOT_RUN", result: "BLOCKED", evidence: ["Policy cannot create external approval."] } });
    const third = await caller.runtimeAssurance.recordRepairAttempt({ ...access, input: { failureId: failure.failureId, rootCauseId: failure.rootCauseId, repairStrategy: "Escalate missing external infrastructure to governance review.", targetedTestReference: "G0-ROOT-CAUSE-ESCALATION", regressionStatus: "UNKNOWN", result: "BLOCKED", evidence: ["External dependency remains unresolved."] } });
    expect(third).toMatchObject({ attemptCount: 3, escalationRequired: true });
  });

  it("9. isolates assurance environments, observations, failures, and repairs by project", async () => {
    expect(await caller.runtimeAssurance.listEnvironments(other)).toEqual([]);
    expect(await caller.runtimeAssurance.listObservedTests(other)).toEqual([]);
    expect(await caller.runtimeAssurance.listFailures(other)).toEqual([]);
    expect(await caller.runtimeAssurance.listRepairAttempts(other)).toEqual([]);
  });

  it("10. builds a missing-evidence review package without production authorization", async () => {
    const reviewPackage = await caller.runtimeAssurance.buildReviewPackage({ ...access, assessmentId: assessment.assessmentId });
    expect(reviewPackage).toMatchObject({ independentReviewerRequired: true, selfApprovalProhibited: true, productionAuthorization: false });
    expect(reviewPackage.missingSections).toContain("G0_APPROVED_TEST_ENVIRONMENT");
  });

  it("11. exposes no provision, sandbox, hostile-test, mesher, solver, process, shell, network, filesystem, or production-authorization endpoint", () => expect(Object.keys(caller.runtimeAssurance)).not.toEqual(expect.arrayContaining(["provisionEnvironment", "runSandboxTest", "runHostileTest", "executeMesher", "executeSolver", "runProcess", "runShell", "runNetwork", "accessFilesystem", "authorizeProduction"])));
});
