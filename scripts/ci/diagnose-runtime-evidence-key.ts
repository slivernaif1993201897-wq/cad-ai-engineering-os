import { runtimeEvidenceKeyDiagnostics } from "../../server/signedRuntimeEvidence";

const diagnostic = runtimeEvidenceKeyDiagnostics();
for (const [key, value] of Object.entries(diagnostic)) {
  process.stdout.write(`${key}=${String(value)}\n`);
}
