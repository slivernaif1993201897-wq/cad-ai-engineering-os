import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { admitControlledUserJob, calculateControlledUserJobManifestHash, validateControlledUserJobManifest } from "../shared/controlledUserJob";

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "fixtures/controlled-user-job-manifest.json"), "utf8"));

describe("controlled user-job manifest", () => {
  it("preserves a hash-bound manifest and blocks GitHub-hosted generic execution", () => {
    const githubFixture = {
      ...fixture,
      environment: { ...fixture.environment, executionClass: "GITHUB_HOSTED_CI" as const },
    };
    githubFixture.manifestHash = calculateControlledUserJobManifestHash(githubFixture);
    expect(githubFixture.manifestHash).toBe(calculateControlledUserJobManifestHash(githubFixture));
    expect(validateControlledUserJobManifest(githubFixture).jobId).toBe("GENERIC-CANTILEVER-USER-JOB-001");
    expect(admitControlledUserJob(githubFixture)).toMatchObject({
      state: "BLOCKED",
      reasonCodes: expect.arrayContaining(["GITHUB_HOSTED_SANDBOX_INSUFFICIENT", "APPROVED_EXECUTION_ENVIRONMENT_REQUIRED"]),
      executionStarted: false,
      genericSolverExecutionStarted: false,
    });
  });

  it("rejects arbitrary command injection through an unknown field", () => {
    const candidate = { ...fixture, command: "ccx arbitrary.inp" };
    expect(admitControlledUserJob(candidate)).toMatchObject({ state: "REJECTED", reasonCodes: ["MANIFEST_SCHEMA_INVALID"] });
  });

  it("rejects a stale or tampered manifest", () => {
    const stale = { ...fixture, authorization: { ...fixture.authorization, validUntil: "2026-01-02T00:00:00.000Z" } };
    stale.manifestHash = calculateControlledUserJobManifestHash(stale);
    const tampered = { ...fixture, resourcePolicy: { ...fixture.resourcePolicy, limits: { ...fixture.resourcePolicy.limits, processCount: 65 } } };
    expect(admitControlledUserJob(stale)).toMatchObject({ state: "REJECTED", reasonCodes: ["MANIFEST_AUTHORIZATION_INVALID"] });
    expect(admitControlledUserJob(tampered)).toMatchObject({ state: "REJECTED", reasonCodes: ["MANIFEST_HASH_MISMATCH"] });
  });

  it("rejects a hash-valid manifest with a non-allowlisted solver version", () => {
    const unsupported = { ...fixture, meshConfiguration: { ...fixture.meshConfiguration, solverVersion: "4.12.2" } };
    unsupported.manifestHash = calculateControlledUserJobManifestHash(unsupported);
    expect(admitControlledUserJob(unsupported)).toMatchObject({ state: "REJECTED", reasonCodes: ["UNKNOWN_SOLVER_CONFIGURATION"] });
  });

  it("allows only an internal-test admission state for a hash-valid Docker fixture", () => {
    const internalFixture = {
      ...fixture,
      environment: { ...fixture.environment, executionClass: "INTERNAL_DOCKER_TEST" as const },
    };
    internalFixture.manifestHash = calculateControlledUserJobManifestHash(internalFixture);
    expect(admitControlledUserJob(internalFixture)).toMatchObject({
      state: "INTERNAL_TEST_ADMITTED",
      executionStarted: false,
      genericSolverExecutionStarted: false,
      reasonCodes: ["INTERNAL_DOCKER_PREFLIGHT_REQUIRED"],
    });
  });
});
