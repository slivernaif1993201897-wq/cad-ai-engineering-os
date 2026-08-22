import { beforeAll, describe, expect, it } from "vitest";

import { createMountingBlockConfiguration, getValidatedStepExport } from "../server/cadAgent";
import {
  admitCadAgentRuntimeJob,
  buildCadAgentRuntimeManifest,
  calculateCadRevisionHash,
  type CadAgentRuntimeSource,
} from "../shared/authoritativeCadAgentRuntime";
import { admitControlledUserJob, calculateControlledUserJobManifestHash } from "../shared/controlledUserJob";

let source: CadAgentRuntimeSource;
let manifest: ReturnType<typeof buildCadAgentRuntimeManifest>;

beforeAll(async () => {
  const result = await createMountingBlockConfiguration({
    name: "Authoritative Runtime Regression CAD Agent Block",
    input: { width: 100, depth: 50, height: 20, holeDiameter: 10, holeEdgeOffset: 10, filletRadius: 3, approveAssumption: true },
    sourceText: "Create a 100 mm × 50 mm × 20 mm mounting block with four 10 mm holes, a 10 mm edge offset, and a 3 mm fillet.",
  });
  if (result.error || !result.configuration.artifact) throw new Error(result.error ?? "CAD_AGENT_ARTIFACT_MISSING");
  const stepExport = getValidatedStepExport(result.configuration.id);
  source = { configuration: result.configuration, stepExport, stepBytes: Buffer.from(stepExport.stepBase64, "base64") };
  manifest = buildCadAgentRuntimeManifest(source);
}, 30_000);

describe("authoritative CAD Agent Docker runtime contract", () => {
  it("binds a genuine validated CAD Agent revision and artifact to an internally admitted immutable manifest", () => {
    expect(source.configuration.modelStatus).toBe("VALIDATED");
    expect(source.stepBytes.toString("utf8")).toContain("ISO-10303-21");
    expect(manifest.cadProvenance.sourceKind).toBe("CAD_AGENT");
    expect(manifest.cadRevision).toBe(source.configuration.id);
    expect(manifest.cadArtifactHash).toBe(manifest.cadHash);
    expect(admitControlledUserJob(manifest)).toMatchObject({ state: "INTERNAL_TEST_ADMITTED", executionStarted: false, genericSolverExecutionStarted: false });
    expect(admitCadAgentRuntimeJob(manifest, {
      jobId: manifest.jobId,
      cadRevision: source.configuration.id,
      cadRevisionHash: calculateCadRevisionHash(source.configuration),
      cadArtifactHash: manifest.cadArtifactHash,
    }).manifestHash).toBe(manifest.manifestHash);
  });

  it("rejects a stale job identity before any runtime dispatch", () => {
    expect(() => admitCadAgentRuntimeJob(manifest, {
      jobId: "STALE-CAD-AGENT-JOB",
      cadRevision: source.configuration.id,
      cadRevisionHash: calculateCadRevisionHash(source.configuration),
      cadArtifactHash: manifest.cadArtifactHash,
    })).toThrow("STALE_JOB_REJECTED");
  });

  it("rejects a stale CAD revision hash before any runtime dispatch", () => {
    expect(() => admitCadAgentRuntimeJob(manifest, {
      jobId: manifest.jobId,
      cadRevision: source.configuration.id,
      cadRevisionHash: "0".repeat(64),
      cadArtifactHash: manifest.cadArtifactHash,
    })).toThrow("STALE_CAD_REJECTED");
  });

  it("rejects a non-agent provenance source even when the manifest remains otherwise valid", () => {
    const fixtureSource = { ...manifest, cadProvenance: { ...manifest.cadProvenance, sourceKind: "FIXTURE_BASELINE" as const } };
    fixtureSource.manifestHash = calculateControlledUserJobManifestHash(fixtureSource);
    expect(() => admitCadAgentRuntimeJob(fixtureSource, {
      jobId: fixtureSource.jobId,
      cadRevision: source.configuration.id,
      cadRevisionHash: calculateCadRevisionHash(source.configuration),
      cadArtifactHash: fixtureSource.cadArtifactHash,
    })).toThrow("CAD_SOURCE_NOT_AGENT");
  });
});
