import { afterEach, describe, expect, it } from "vitest";
import { inspectExternalTextToCadRuntime, TEXT_TO_CAD_SOURCE_COMMIT } from "../server/externalTextToCadAdapter";

const prior = { root: process.env.TEXT_TO_CAD_RUNTIME_ROOT, source: process.env.TEXT_TO_CAD_SOURCE_ROOT, python: process.env.TEXT_TO_CAD_PYTHON };
function restore() { if (prior.root === undefined) delete process.env.TEXT_TO_CAD_RUNTIME_ROOT; else process.env.TEXT_TO_CAD_RUNTIME_ROOT = prior.root; if (prior.source === undefined) delete process.env.TEXT_TO_CAD_SOURCE_ROOT; else process.env.TEXT_TO_CAD_SOURCE_ROOT = prior.source; if (prior.python === undefined) delete process.env.TEXT_TO_CAD_PYTHON; else process.env.TEXT_TO_CAD_PYTHON = prior.python; }
afterEach(restore);

describe("pinned external text-to-CAD runtime discovery", () => {
  it("fails closed for a reset or non-allowlisted configuration", () => { delete process.env.TEXT_TO_CAD_RUNTIME_ROOT; delete process.env.TEXT_TO_CAD_SOURCE_ROOT; delete process.env.TEXT_TO_CAD_PYTHON; expect(inspectExternalTextToCadRuntime()).toMatchObject({ status: "DEPENDENCY_MISSING" }); process.env.TEXT_TO_CAD_RUNTIME_ROOT = "/tmp/not-an-adapter-runtime"; process.env.TEXT_TO_CAD_SOURCE_ROOT = "/tmp/not-an-adapter-source"; process.env.TEXT_TO_CAD_PYTHON = "python3"; expect(inspectExternalTextToCadRuntime()).toMatchObject({ status: "DEPENDENCY_MISSING" }); });
  it("accepts only the installed source commit and immutable runtime manifest", () => { process.env.TEXT_TO_CAD_RUNTIME_ROOT = "/home/ubuntu/external-runtimes/text-to-cad-b97ff01"; process.env.TEXT_TO_CAD_SOURCE_ROOT = "/home/ubuntu/external-audits/text-to-cad-current"; process.env.TEXT_TO_CAD_PYTHON = "python3"; expect(inspectExternalTextToCadRuntime()).toMatchObject({ status: "AVAILABLE", sourceCommit: TEXT_TO_CAD_SOURCE_COMMIT }); });
});
