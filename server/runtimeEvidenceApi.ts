import { readFile } from "node:fs/promises";

import { verifyRuntimeEvidence, type RuntimeEvidenceVerification, type SignedRuntimeEvidenceEnvelope } from "./signedRuntimeEvidence";
import { readCanonicalRuntimeEvidence } from "./runtimeEvidenceStore";

/** Reads only a server-configured trusted evidence location; clients cannot submit or modify envelopes. */
export async function readAuthoritativeRuntimeEvidence(): Promise<RuntimeEvidenceVerification> {
  const path = process.env.RUNTIME_EVIDENCE_ENVELOPE_PATH;
  const storeDirectory = process.env.RUNTIME_EVIDENCE_STORE_DIR;
  const environmentIdentity = process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY;
  const commit = process.env.RUNTIME_EVIDENCE_COMMIT;
  const workflowRun = process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN;
  if (!environmentIdentity || !commit || !workflowRun || (!path && !storeDirectory)) return { status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" };
  const trust = { environmentIdentity, commit, workflowRun };
  if (storeDirectory) return readCanonicalRuntimeEvidence(storeDirectory, trust);
  if (!path) return { status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE" };
  try {
    const envelope = JSON.parse(await readFile(path, "utf8")) as SignedRuntimeEvidenceEnvelope;
    return verifyRuntimeEvidence(envelope, trust);
  } catch {
    return { status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SOURCE" };
  }
}
