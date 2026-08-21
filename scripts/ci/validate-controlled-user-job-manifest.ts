import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { admitControlledUserJob } from "../../shared/controlledUserJob";

const fixturePath = resolve(process.cwd(), "fixtures/controlled-user-job-manifest.json");
const outputDirectory = resolve(process.cwd(), "artifacts/controlled-user-job-admission");
const manifest = JSON.parse(readFileSync(fixturePath, "utf8"));
const receipt = admitControlledUserJob(manifest);

if (receipt.state !== "BLOCKED" || !receipt.reasonCodes.includes("GITHUB_HOSTED_SANDBOX_INSUFFICIENT") || receipt.executionStarted || receipt.genericSolverExecutionStarted) {
  throw new Error("Controlled user-job admission fixture must fail closed for GitHub-hosted execution without launching a generic solver job.");
}

mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
writeFileSync(resolve(outputDirectory, "admission-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(receipt));
