import { beforeAll, describe, expect, it } from "vitest";

import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { DigitalThreadArtifactKind } from "../shared/digitalThread";

const ctx = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const base = (kind: DigitalThreadArtifactKind, title: string, revision: string, sourceArtifactIds: string[] = []) => ({ kind, title, revision, state: "DECLARED" as const, truthStatus: "UNVERIFIED" as const, sourceArtifactIds, externalSourceRecordIds: [], provenance: ["Deterministic digital-thread acceptance fixture."], limitations: ["No execution or engineering result is claimed."], declaredBy: "DigitalThreadFixture" });

describe("Phase 6.12 Unified Digital Thread", () => {
  const caller = appRouter.createCaller(ctx);
  let access: { projectId: string; accessKey: string };
  let other: { projectId: string; accessKey: string };
  let requirement: any; let concept: any; let cad: any; let cadFeature: any; let caePlan: any; let caeJob: any; let caeEvidence: any; let optimization: any; let drawing: any; let bom: any; let manufacturing: any; let verification: any; let review: any; let plm: any; let release: any;

  beforeAll(async () => {
    const project = await caller.persistentMemory.openProject({ name: "Phase 6.12 unified digital thread" });
    const isolated = await caller.persistentMemory.openProject({ name: "Phase 6.12 isolated digital thread" });
    access = { projectId: project.id, accessKey: project.accessKey }; other = { projectId: isolated.id, accessKey: isolated.accessKey };
    requirement = await caller.digitalThread.createArtifact({ ...access, input: base("REQUIREMENT_SET", "Rear passenger energy absorption requirements", "REQ-R1") });
    concept = await caller.digitalThread.createArtifact({ ...access, input: base("CONCEPT", "Energy absorption concept A", "CONCEPT-A1", [requirement.artifactId]) });
    cad = await caller.digitalThread.createArtifact({ ...access, input: base("CAD_MODEL", "Parametric concept A model", "CAD-A1", [concept.artifactId]) });
    cadFeature = await caller.digitalThread.createArtifact({ ...access, input: base("CAD_FEATURE", "Parametric energy absorber feature", "FEATURE-A1", [cad.artifactId]) });
    caePlan = await caller.digitalThread.createArtifact({ ...access, input: base("CAE_PLAN", "Static structural planning record", "PLAN-A1", [cad.artifactId, cadFeature.artifactId]) });
    caeJob = await caller.digitalThread.createArtifact({ ...access, input: base("CAE_JOB", "Canonical non-executable job", "JOB-A1", [caePlan.artifactId]) });
    caeEvidence = await caller.digitalThread.createArtifact({ ...access, input: base("CAE_EVIDENCE", "Input and verification evidence", "EVIDENCE-A1", [caeJob.artifactId]) });
    optimization = await caller.digitalThread.createArtifact({ ...access, input: base("OPTIMIZATION_STUDY", "Non-executable mass objective study", "OPT-A1", [cad.artifactId, caePlan.artifactId, caeEvidence.artifactId]) });
    drawing = await caller.digitalThread.createArtifact({ ...access, input: base("DRAWING_PACKAGE", "Declared concept drawing package", "DRAW-A1", [cad.artifactId, cadFeature.artifactId]) });
    bom = await caller.digitalThread.createArtifact({ ...access, input: base("BOM_ITEM", "Declared assembly BOM", "BOM-A1", [cad.artifactId, cadFeature.artifactId]) });
    manufacturing = await caller.digitalThread.createArtifact({ ...access, input: base("MANUFACTURING_PLAN", "Declared manufacturability plan", "MFG-A1", [cad.artifactId, bom.artifactId]) });
    verification = await caller.digitalThread.createArtifact({ ...access, input: base("VERIFICATION_TEST", "Verification planning record", "VERIFY-A1", [cad.artifactId, caePlan.artifactId, caeEvidence.artifactId]) });
    review = await caller.digitalThread.createArtifact({ ...access, input: base("REVIEW_GATE", "Human verification gate", "GATE-A1", [verification.artifactId, caeEvidence.artifactId]) });
    plm = await caller.digitalThread.createArtifact({ ...access, input: base("PLM_REVISION", "Declared engineering revision", "PLM-A1", [cad.artifactId, bom.artifactId, drawing.artifactId]) });
    release = await caller.digitalThread.createArtifact({ ...access, input: base("RELEASE_GATE", "Future release gate", "RELEASE-A1", [review.artifactId, plm.artifactId, drawing.artifactId, bom.artifactId, manufacturing.artifactId]) });
  }, 30_000);

  it("1. creates immutable requirement through release-gate artifacts with stable revisions", () => expect(release).toMatchObject({ kind: "RELEASE_GATE", revision: "RELEASE-A1", retention: { historicalRecordPreserved: true, deletionPolicy: "NO_SILENT_DELETION" }, executionEligible: false, executable: false }));
  it("2. requires immutable upstream records for downstream artifacts", async () => await expect(caller.digitalThread.createArtifact({ ...access, input: base("CAD_MODEL", "Unbound CAD", "CAD-UNBOUND") })).rejects.toThrow(/requires at least one immutable upstream/i));
  it("3. refuses a missing project-scoped upstream record", async () => await expect(caller.digitalThread.createArtifact({ ...access, input: base("CONCEPT", "Missing requirement source", "CONCEPT-MISSING", ["MISSING-ARTIFACT"]) })).rejects.toThrow(/unavailable in this authorized project/i));
  it("4. preserves all cross-domain artifact kinds without creating an engineering result", async () => { const items = await caller.digitalThread.listArtifacts(access); expect(items.map((item) => item.kind)).toEqual(expect.arrayContaining(["REQUIREMENT_SET", "CONCEPT", "CAD_MODEL", "CAE_PLAN", "CAE_JOB", "CAE_EVIDENCE", "OPTIMIZATION_STUDY", "DRAWING_PACKAGE", "BOM_ITEM", "PLM_REVISION", "MANUFACTURING_PLAN", "VERIFICATION_TEST", "REVIEW_GATE", "RELEASE_GATE"])); expect(items.every((item) => item.executable === false && item.executionEligible === false)).toBe(true); });
  it("5. appends a project-scoped immutable relationship", async () => { const relation = await caller.digitalThread.createRelation({ ...access, input: { fromArtifactId: requirement.artifactId, toArtifactId: concept.artifactId, kind: "DERIVES_FROM", evidenceRecordIds: [], state: "DECLARED", rationale: "Concept A was declared from the requirement set.", createdBy: "DigitalThreadFixture" } }); expect(relation).toMatchObject({ kind: "DERIVES_FROM", executionEligible: false, executable: false }); });
  it("6. refuses self relationships and duplicate historical relationships", async () => { await expect(caller.digitalThread.createRelation({ ...access, input: { fromArtifactId: cad.artifactId, toArtifactId: cad.artifactId, kind: "REALIZES", evidenceRecordIds: [], state: "DECLARED", rationale: "Invalid", createdBy: "Fixture" } })).rejects.toThrow(/cannot link an artifact to itself/i); await expect(caller.digitalThread.createRelation({ ...access, input: { fromArtifactId: requirement.artifactId, toArtifactId: concept.artifactId, kind: "DERIVES_FROM", evidenceRecordIds: [], state: "DECLARED", rationale: "Duplicate", createdBy: "Fixture" } })).rejects.toThrow(/already exists/i); });
  it("7. makes missing evidence and release authority explicit rather than silently releasing", async () => expect(await caller.digitalThread.assess(access)).toMatchObject({ state: "RESOLVED", releaseStatus: "BLOCKED", executionEligible: false, executable: false }));
  it("8. retains the immutable path from requirements through CAD, CAE, optimization, drawing, BOM/PLM, manufacturing, verification, and release", async () => { const assessment = await caller.digitalThread.assess(access); expect(assessment.artifacts).toHaveLength(15); expect(assessment.unresolvedRequirements).toEqual([]); expect(assessment.limitations.join(" ")).toMatch(/release gate is permanently blocked/i); });
  it("9. isolates artifacts and relationships by project", async () => { expect(await caller.digitalThread.listArtifacts(other)).toEqual([]); expect(await caller.digitalThread.listRelations(other)).toEqual([]); });
  it("10. exposes no release, optimization, drawing, BOM, manufacturing, solver, or process execution endpoint", () => expect(Object.keys(caller.digitalThread)).not.toEqual(expect.arrayContaining(["release", "executeOptimization", "renderDrawing", "generateBOM", "postProcessCAM", "executeSolver", "runProcess"])));
});
