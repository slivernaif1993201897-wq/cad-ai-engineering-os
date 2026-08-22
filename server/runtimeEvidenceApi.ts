import { readFile } from "node:fs/promises";

import { verifyRuntimeEvidence, type RuntimeEvidenceVerification, type SignedRuntimeEvidenceEnvelope } from "./signedRuntimeEvidence";

/** Reads only a server-configured trusted evidence location; clients cannot submit or modify envelopes. */
export async function readAuthoritativeRuntimeEvidence(): Promise<RuntimeEvidenceVerification> {
  const path = process.env.RUNTIME_EVIDENCE_ENVELOPE_PATH;
  const environmentIdentity = process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY;
  const commit = process.env.RUNTIME_EVIDENCE_COMMIT;
  const workflowRun = process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN;
  if (!path || !environmentIdentity || !commit || !workflowRun) return { status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" };
  try {
    const envelope = JSON.parse(await readFile(path, "utf8")) as SignedRuntimeEvidenceEnvelope;
    return verifyRuntimeEvidence(envelope, { environmentIdentity, commit, workflowRun });
  } catch {
    return { status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SOURCE" };
  }
}
