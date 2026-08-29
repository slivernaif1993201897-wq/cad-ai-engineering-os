import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CapreEngine } from "../server/capre";

const roots: string[] = [];
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

async function fixtureProject() {
  const root = await mkdtemp(join(tmpdir(), "capre-project-"));
  roots.push(root);
  await mkdir(join(root, "server"), { recursive: true });
  await mkdir(join(root, "drizzle"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"name":"capre-fixture"}\n');
  await writeFile(join(root, "server", "main.ts"), "export const operational = true;\n");
  await writeFile(join(root, "drizzle", "0000_schema.sql"), "CREATE TABLE capre_fixture (id INTEGER);\n");
  await writeFile(join(root, "tests", "sample.test.ts"), "export {};\n");
  await writeFile(join(root, ".gitignore"), ".env\n");
  await writeFile(join(root, ".env"), "SECRET_VALUE_SHOULD_NEVER_BE_CAPTURED\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "capre@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "CAPRE test"], { cwd: root });
  execFileSync("git", ["add", "package.json", "server", "drizzle", "tests", ".gitignore"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const snapshotRoot = join(dirname(root), `${root.split("/").at(-1)}-snapshots`);
  return { root, snapshotRoot, engine: new CapreEngine({ projectRoot: root, snapshotRoot, now: () => new Date("2026-08-28T01:00:00.000Z") }) };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CAD-AGENT Protected Recovery Engine (CAPRE)", () => {
  it("discovers a safe project inventory without treating local storage or secrets as durable evidence", async () => {
    const { engine } = await fixtureProject();
    const discovery = await engine.discover();
    expect(discovery.durabilityClass).toBe("LOCAL_EPHEMERAL");
    expect(discovery.durableBackupAvailable).toBe(false);
    expect(discovery.protectionStatus).toBe("UNPROTECTED");
    expect(discovery.durableStorageStatus).toBe("UNAVAILABLE");
    expect(discovery.resetSurvivalStatus).toBe("NOT_PROVEN");
    expect(discovery.authoritativeRecoveryStatus).toBe("UNAVAILABLE");
    expect(discovery.testedStateEqualsCommittedStateEqualsCheckpointState).toBe("NOT_PROVEN");
    expect(discovery.inventory.find((entry) => entry.classification === "PERSISTENT_APPLICATION_DATA")?.state).toBe("NOT_CAPTURED");
    expect(discovery.inventory.find((entry) => entry.classification === "MANAGED_ARTIFACTS")?.state).toBe("NOT_CAPTURED");
    expect(discovery.secretPrerequisites.every((secret) => secret.secretValue === "NEVER_EXPORTED")).toBe(true);
  });

  it("captures, seals, lists, and independently verifies a local ephemeral snapshot", async () => {
    const { engine, snapshotRoot } = await fixtureProject();
    const created = await engine.capture();
    expect(created.checkpointClass).toBe("UNPROTECTED_LOCAL_SNAPSHOT");
    expect(created.durabilityClass).toBe("LOCAL_EPHEMERAL");
    expect(created.protectionStatus).toBe("UNPROTECTED");
    expect(created.durableStorageStatus).toBe("UNAVAILABLE");
    expect(created.resetSurvivalStatus).toBe("NOT_PROVEN");
    expect(created.authoritativeRecoveryStatus).toBe("UNAVAILABLE");
    expect(created.testedStateEqualsCommittedStateEqualsCheckpointState).toBe("NOT_PROVEN");
    expect(created.immutableStatus).toBe("SEALED_READ_ONLY");
    expect((await engine.list()).map((item) => item.checkpointId)).toEqual([created.checkpointId]);
    const verification = await engine.verify(created.checkpointId);
    expect(verification.status).toBe("PASS");
    const capturedEnv = join(snapshotRoot, created.checkpointId, "source", ".env");
    await expect(readFile(capturedEnv, "utf8")).rejects.toThrow();
    const manifestText = await readFile(join(snapshotRoot, created.checkpointId, "manifest.json"), "utf8");
    expect(manifestText).not.toContain("SECRET_VALUE_SHOULD_NEVER_BE_CAPTURED");
    expect(manifestText).toContain("DURABLE_STORAGE=UNAVAILABLE");
    expect(manifestText).toContain("PROTECTION_STATUS=UNPROTECTED");
  });

  it("fails closed for a modified checkpoint member, corrupted manifest checksum, and unexpected member", async () => {
    const { engine, snapshotRoot } = await fixtureProject();
    const created = await engine.capture();
    const checkpoint = join(snapshotRoot, created.checkpointId);
    const source = join(checkpoint, "source", "server", "main.ts");
    await chmod(checkpoint, 0o755);
    await chmod(join(checkpoint, "source"), 0o755);
    await chmod(join(checkpoint, "source", "server"), 0o755);
    await chmod(source, 0o644);
    await chmod(join(checkpoint, "manifest.sha256"), 0o644);
    await writeFile(source, "export const operational = false;\n");
    let verification = await engine.verify(created.checkpointId);
    expect(verification.status).toBe("FAIL");
    expect(verification.failures.some((failure) => failure.startsWith("file hash mismatch:source/server/main.ts"))).toBe(true);
    await writeFile(join(checkpoint, "manifest.sha256"), `${hash("wrong")}  manifest.json\n`);
    verification = await engine.verify(created.checkpointId);
    expect(verification.failures).toContain("manifest checksum record mismatch");
    await writeFile(join(checkpoint, "unexpected.txt"), "unexpected");
    verification = await engine.verify(created.checkpointId);
    expect(verification.failures.some((failure) => failure.startsWith("unexpected checkpoint member:"))).toBe(true);
  });

  it("rejects traversal, concurrent capture, and an authority class whose durable prerequisites do not exist", async () => {
    const { engine, snapshotRoot } = await fixtureProject();
    await expect(engine.verify("../escape")).rejects.toThrow("CAPRE_INVALID_CHECKPOINT_ID");
    await mkdir(snapshotRoot, { recursive: true });
    await writeFile(join(snapshotRoot, ".capture.lock"), "held");
    await expect(engine.capture()).rejects.toThrow("CAPRE_CAPTURE_IN_PROGRESS");
    await rm(join(snapshotRoot, ".capture.lock"));
    await expect(engine.capture({ checkpointClass: "VERIFIED_CHECKPOINT" })).rejects.toThrow("CAPRE_DURABLE_BACKUP_UNAVAILABLE");
  });

  it("leaves a sealed prior snapshot intact when a subsequent capture fails before sealing", async () => {
    const { engine, root } = await fixtureProject();
    const previous = await engine.capture();
    await writeFile(join(root, "uncommitted-capture-blocker.txt"), "must not enter a protected snapshot\n");
    await expect(engine.capture()).rejects.toThrow("CAPRE_DIRTY_WORKTREE_REJECTED");
    const priorIntegrity = await engine.verify(previous.checkpointId);
    expect(priorIntegrity.status).toBe("PASS");
    expect((await engine.list()).map((item) => item.checkpointId)).toEqual([previous.checkpointId]);
  });

  it("restores only verified source and metadata to isolated staging and blocks promotion and a partial recovery drill", async () => {
    const { engine, root } = await fixtureProject();
    const created = await engine.capture();
    const staging = await engine.restoreToStaging(created.checkpointId);
    expect(staging.status).toBe("STAGING_RESTORED");
    expect(staging.stagingPath).not.toBe(root);
    const restored = await engine.verifyRestore(staging);
    expect(restored.status).toBe("BLOCKED");
    expect(restored.checks.some((check) => check.name === "Database consistency" && check.status === "BLOCKED")).toBe(true);
    await expect(engine.promoteRestore()).rejects.toThrow("CAPRE_PROMOTION_BLOCKED_PARTIAL_RESTORE");
    await expect(engine.rollback()).rejects.toThrow("CAPRE_ROLLBACK_BLOCKED_NO_VERIFIED_DURABLE_CHECKPOINT");
    const drill = await engine.recoveryDrill();
    expect(drill.status).toBe("BLOCKED");
    expect(drill.reason).toContain("database and managed artifact recovery are unavailable");
  });
});
