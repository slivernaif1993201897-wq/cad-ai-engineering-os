import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  verifyRuntimeEvidence,
  type RuntimeEvidenceTrust,
  type RuntimeEvidenceVerification,
  type SignedRuntimeEvidenceEnvelope,
} from "./signedRuntimeEvidence";

const REQUIRED_BINDING_FIELDS = [
  "jobId",
  "cadRevisionHash",
  "cadArtifactHash",
  "caeConfigurationHash",
  "manifestHash",
  "environmentHash",
  "gmshHash",
  "meshHash",
  "calculixHash",
  "inputHash",
  "outputHash",
  "resultHash",
  "executionLogHash",
] as const;

type CanonicalStoreRecord = {
  envelope: SignedRuntimeEvidenceEnvelope;
  storedAt: string;
  bindingFields: readonly string[];
};

function hasCompleteBinding(envelope: SignedRuntimeEvidenceEnvelope): boolean {
  const hashes = envelope.payload.artifactHashes;
  return REQUIRED_BINDING_FIELDS.every((field) => field === "jobId" ? Boolean(hashes[field]) : /^[a-f0-9]{64}$/i.test(hashes[field] ?? ""));
}

/**
 * Persists only an already-verified CI envelope. This module has no client input
 * surface and writes a content-addressed history plus an atomically replaced active pointer.
 */
export async function storeCanonicalRuntimeEvidence(
  envelope: SignedRuntimeEvidenceEnvelope,
  trust: RuntimeEvidenceTrust,
  storeDirectory: string,
  now = new Date(),
): Promise<RuntimeEvidenceVerification> {
  const verification = verifyRuntimeEvidence(envelope, trust, { now, enforceReplayProtection: false });
  if (verification.status !== "VERIFIED") return verification;
  if (!hasCompleteBinding(envelope)) return { status: "BLOCKED", rejectionCode: "INCOMPLETE_RESULT_BINDING" };

  await mkdir(storeDirectory, { recursive: true, mode: 0o700 });
  const record: CanonicalStoreRecord = {
    envelope,
    storedAt: now.toISOString(),
    bindingFields: REQUIRED_BINDING_FIELDS,
  };
  const content = `${JSON.stringify(record)}\n`;
  const immutablePath = join(storeDirectory, `${envelope.payload.evidenceHash}.json`);
  const activePath = join(storeDirectory, "active.json");
  const temporaryPath = join(storeDirectory, `.active-${process.pid}-${Date.now()}.tmp`);
  await writeFile(immutablePath, content, { encoding: "utf8", mode: 0o600, flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, activePath);
  return verification;
}

/** Reads only the active server-side record; malformed storage fails closed. */
export async function readCanonicalRuntimeEvidence(
  storeDirectory: string,
  trust: RuntimeEvidenceTrust,
): Promise<RuntimeEvidenceVerification> {
  try {
    const record = JSON.parse(await readFile(join(storeDirectory, "active.json"), "utf8")) as CanonicalStoreRecord;
    if (!record?.envelope || !hasCompleteBinding(record.envelope)) return { status: "BLOCKED", rejectionCode: "INCOMPLETE_RESULT_BINDING" };
    return verifyRuntimeEvidence(record.envelope, trust, { enforceReplayProtection: false });
  } catch {
    return { status: "BLOCKED", rejectionCode: "INVALID_EVIDENCE_SOURCE" };
  }
}
