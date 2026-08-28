import {
  verifyRuntimeEvidence,
  type SignedRuntimeEvidenceEnvelope,
  type EvidenceVerification,
  type RuntimeEvidenceTrust,
} from "./runtime-evidence";
import { readFileSync } from "node:fs";

function configuredTrust(): RuntimeEvidenceTrust | null {
  const environmentIdentity = process.env.RUNTIME_EVIDENCE_ENVIRONMENT_IDENTITY;
  const commit = process.env.RUNTIME_EVIDENCE_COMMIT;
  const workflowRun = process.env.RUNTIME_EVIDENCE_WORKFLOW_RUN;
  return environmentIdentity && commit && workflowRun
    ? { environmentIdentity, commit, workflowRun }
    : null;
}

/**
 * Reads only a server-configured canonical CI envelope. The mobile client cannot
 * supply a path, payload, signature, trust tuple, or key; absent source evidence
 * is deliberately BLOCKED rather than replaced by a locally generated snapshot.
 */
export function getAuthoritativeRuntimeEvidence(now = new Date()): EvidenceVerification {
  const sourcePath = process.env.RUNTIME_EVIDENCE_ENVELOPE_PATH;
  const trust = configuredTrust();
  if (!sourcePath || !trust) return { status: "BLOCKED", rejectionCode: "MISSING_EVIDENCE_SOURCE" };
  try {
    const envelope = JSON.parse(readFileSync(sourcePath, "utf8")) as SignedRuntimeEvidenceEnvelope;
    return verifyRuntimeEvidence(envelope, trust, { now });
  } catch {
    return { status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SOURCE" };
  }
}
