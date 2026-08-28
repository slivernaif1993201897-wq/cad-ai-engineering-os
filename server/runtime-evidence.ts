export {
  SIGNED_RUNTIME_EVIDENCE_MAX_AGE_MS as RUNTIME_EVIDENCE_MAX_AGE_MS,
  SIGNED_RUNTIME_EVIDENCE_VERSION as RUNTIME_EVIDENCE_VERSION,
  clearRuntimeEvidenceReplayCacheForTests,
  signRuntimeEvidence as signRuntimeEvidenceForServer,
  verifyRuntimeEvidence,
} from "./signedRuntimeEvidence";

export type {
  RuntimeEvidencePayload,
  RuntimeEvidenceTrust,
  RuntimeEvidenceVerification as EvidenceVerification,
  SignedRuntimeEvidenceEnvelope,
} from "./signedRuntimeEvidence";
