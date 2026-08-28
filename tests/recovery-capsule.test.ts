import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RecoveryCapsuleEngine } from "../server/recoveryCapsule";

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "capre-capsule-project-"));
  const output = await mkdtemp(join(tmpdir(), "capre-capsule-output-"));
  roots.push(root, output);
  await mkdir(join(root, "server"), { recursive: true });
  await mkdir(join(root, "drizzle"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"name":"capsule-fixture"}\n');
  await writeFile(join(root, "server", "main.ts"), "export const capsule = true;\n");
  await writeFile(join(root, "drizzle", "0000.sql"), "CREATE TABLE capsule_fixture (id INTEGER);\n");
  await writeFile(join(root, "tests", "sample.test.ts"), "export {};\n");
  await writeFile(join(root, ".gitignore"), ".env\n");
  await writeFile(join(root, ".env"), "DO_NOT_EXPORT=this-is-not-a-real-secret\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "capsule@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "CAPRE capsule test"], { cwd: root });
  execFileSync("git", ["add", "package.json", "server", "drizzle", "tests", ".gitignore"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "capsule fixture"], { cwd: root });
  return { root, output, engine: new RecoveryCapsuleEngine({ projectRoot: root, outputDirectory: output, now: () => new Date("2026-08-28T03:00:00.000Z") }) };
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("CAPRE full Markdown recovery capsule", () => {
  it("exports, independently verifies, and restores included source into isolated staging while declaring database and artifacts external-required", async () => {
    const { engine, root } = await fixture();
    const exported = await engine.exportFullMarkdown();
    expect(exported.manifest.selfContainedCompleteness).toBe("PARTIAL");
    expect(exported.manifest.sourceIncluded).toBe(true);
    expect(exported.manifest.databaseIncluded).toBe(false);
    expect(exported.manifest.managedArtifactsIncluded).toBe(false);
    expect(exported.manifest.secretsIncluded).toBe(false);
    expect(exported.manifest.memoryRepeat).toBe("NOT_PROVEN");
    const capsuleText = await readFile(exported.capsulePath, "utf8");
    expect(capsuleText).not.toContain("DO_NOT_EXPORT=this-is-not-a-real-secret");
    expect((await engine.verifyCapsule(exported.capsulePath)).status).toBe("PASS");
    const restored = await engine.restoreToStaging(exported.capsulePath);
    expect(restored.stagingPath).not.toBe(root);
    expect(restored.sourceRestore).toBe("PASS");
    expect(restored.databaseRestore).toBe("BLOCKED");
    expect(restored.artifactRestore).toBe("BLOCKED");
    expect(restored.status).toBe("PARTIAL");
    expect(await readFile(join(restored.stagingPath, "source", "server", "main.ts"), "utf8")).toBe("export const capsule = true;\n");
  });

  it("fails closed for a tracked secret path, a dirty worktree, a collision, and tampered capsule payloads", async () => {
    const { engine, root, output } = await fixture();
    await writeFile(join(root, "secrets.json"), '{"value":"test-only"}\n');
    execFileSync("git", ["add", "secrets.json"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "tracked secret path"], { cwd: root });
    await expect(engine.exportFullMarkdown()).rejects.toThrow("CAPSULE_SECRET_PATH_REJECTED:secrets.json");
    execFileSync("git", ["rm", "-q", "secrets.json"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "remove tracked secret path"], { cwd: root });
    await writeFile(join(root, "uncommitted.txt"), "dirty\n");
    await expect(engine.exportFullMarkdown()).rejects.toThrow("CAPSULE_DIRTY_WORKTREE_REJECTED");
    await rm(join(root, "uncommitted.txt"));
    const exported = await engine.exportFullMarkdown();
    await expect(engine.exportFullMarkdown()).rejects.toThrow("CAPSULE_OVERWRITE_REJECTED");
    const text = await readFile(exported.capsulePath, "utf8");
    const originalPayload = Buffer.from("export const capsule = true;\n", "utf8").toString("base64");
    const tamperedPayload = Buffer.from("export const capsule = false;\n", "utf8").toString("base64");
    await writeFile(exported.capsulePath, text.replace(originalPayload, tamperedPayload));
    expect((await engine.verifyCapsule(exported.capsulePath)).status).toBe("FAIL");
    await expect(engine.restoreToStaging(exported.capsulePath)).rejects.toThrow("CAPSULE_RESTORE_BLOCKED_INTEGRITY_FAILURE");
    expect(await readFile(join(output, "CAD-AGENT-FULL-RECOVERY-CAPSULE.md"), "utf8")).toContain(tamperedPayload);
  });

  it("rejects traversal paths before a capsule can be restored", async () => {
    const { engine } = await fixture();
    const exported = await engine.exportFullMarkdown();
    const text = await readFile(exported.capsulePath, "utf8");
    await writeFile(exported.capsulePath, text.replace("PATH=source/server/main.ts", "PATH=../../outside"));
    const verified = await engine.verifyCapsule(exported.capsulePath);
    expect(verified.status).toBe("FAIL");
    expect(verified.failures).toContain("CAPSULE_PATH_REJECTED");
    await expect(engine.restoreToStaging(exported.capsulePath)).rejects.toThrow("CAPSULE_RESTORE_BLOCKED_INTEGRITY_FAILURE");
  });
});
