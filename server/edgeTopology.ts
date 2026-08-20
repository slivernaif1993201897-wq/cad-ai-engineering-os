import type { FeatureHistoryRevision } from "../shared/featureHistory";
import type { EdgeTopologyProof, EvidenceStatus } from "../shared/topologyNaming";

type EdgeEventStatus = "PERSISTED" | "REPLACED" | "DELETED" | "CREATED" | "AMBIGUOUS" | "INVALIDATED";
export type EdgeTopologyReport = { sourceRevisionId: string; targetRevisionId: string; events: Array<{ sourceReferenceId?: string; targetReferenceId?: string; role: string; status: EdgeEventStatus; evidence: string[] }>; summary: Record<EdgeEventStatus, number>; limitations: string[] };

const value = (revision: FeatureHistoryRevision, name: string) => revision.features.flatMap((feature) => feature.parameters).find((parameter) => parameter.name === name)?.normalizedValueMm;
const rounded = (value: number) => Number.isFinite(value) ? Number(value.toFixed(9)) : Number.NaN;
const key = (revision: FeatureHistoryRevision, role: string) => `EDGE-PROOF-${revision.projectId}-${revision.revisionId}-${role}`;

export function edgeTopologyProofs(revision: FeatureHistoryRevision): EdgeTopologyProof[] {
  const circle = revision.features.some((feature) => feature.featureType === "CIRCLE_SKETCH"); const extrude = revision.features.some((feature) => feature.featureId === "EXTRUDE-CIRCLE-001"); const edgeCount = revision.geometry.topology?.counts.edges ?? 0; const radius = value(revision, "radius") ?? Number.NaN; const height = value(revision, "extrudeDistance") ?? Number.NaN; const centerX = value(revision, "centerX") ?? Number.NaN; const centerY = value(revision, "centerY") ?? Number.NaN;
  if (!circle || !extrude || revision.status !== "KERNEL_VALIDATED" || revision.geometry.validation !== "VALID") return [];
  const available: EvidenceStatus = edgeCount >= 2 && Number.isFinite(radius) && Number.isFinite(height) && Number.isFinite(centerX) && Number.isFinite(centerY) ? "PASS" : "UNKNOWN";
  const evidence = [`OpenCascade BRep validation status is ${revision.geometry.validation}.`, `Kernel topology inspection recorded ${edgeCount} edge(s) for this immutable revision.`, "The edge proof uses declared feature role plus normalized geometric signature; it never uses a transient OpenCascade object handle."];
  const signatureBase = { geometryKind: "CIRCULAR" as const, radius: rounded(radius), centerX: rounded(centerX), centerY: rounded(centerY), adjacentFaces: 2 };
  return [{ referenceId: key(revision, "CIRCLE_BOTTOM_RIM"), role: "CIRCLE_BOTTOM_RIM", status: available, signature: { ...signatureBase, z: 0 }, evidence, uncertainty: available === "PASS" ? undefined : "Kernel topology did not expose enough bounded evidence to prove a unique bottom rim for this revision." }, { referenceId: key(revision, "CIRCLE_TOP_RIM"), role: "CIRCLE_TOP_RIM", status: available, signature: { ...signatureBase, z: rounded(height) }, evidence, uncertainty: available === "PASS" ? undefined : "Kernel topology did not expose enough bounded evidence to prove a unique top rim for this revision." }, { referenceId: key(revision, "CIRCLE_RIM_UNQUALIFIED"), role: "CIRCLE_RIM_UNQUALIFIED", status: "UNKNOWN", signature: { ...signatureBase, z: Number.NaN }, evidence: ["The two circular rims share an unqualified generic role.", "No unique edge is selected when only 'rim' is supplied."], uncertainty: "EDGE_IDENTITY_AMBIGUOUS: select CIRCLE_BOTTOM_RIM or CIRCLE_TOP_RIM explicitly." }];
}

const equal = (a: EdgeTopologyProof["signature"], b: EdgeTopologyProof["signature"]) => a.geometryKind === b.geometryKind && a.adjacentFaces === b.adjacentFaces && Math.abs(a.radius - b.radius) < 1e-9 && Math.abs(a.z - b.z) < 1e-9 && Math.abs(a.centerX - b.centerX) < 1e-9 && Math.abs(a.centerY - b.centerY) < 1e-9;
export function matchEdgeTopology(source: FeatureHistoryRevision, target: FeatureHistoryRevision): EdgeTopologyReport {
  const sourceProofs = edgeTopologyProofs(source); const targetProofs = edgeTopologyProofs(target); const events: EdgeTopologyReport["events"] = [];
  for (const previous of sourceProofs) {
    if (previous.status !== "PASS") { events.push({ sourceReferenceId: previous.referenceId, role: previous.role, status: previous.role === "CIRCLE_RIM_UNQUALIFIED" ? "AMBIGUOUS" : "INVALIDATED", evidence: previous.evidence.concat(previous.uncertainty ?? "No sufficient edge evidence.") }); continue; }
    const candidates = targetProofs.filter((candidate) => candidate.role === previous.role && candidate.status === "PASS");
    if (!candidates.length) { events.push({ sourceReferenceId: previous.referenceId, role: previous.role, status: "DELETED", evidence: ["No target edge has the same explicit controlled edge role and proof status."] }); continue; }
    if (candidates.length > 1) { events.push({ sourceReferenceId: previous.referenceId, role: previous.role, status: "AMBIGUOUS", evidence: ["Multiple target edges satisfy the available edge role evidence. The system refuses to select one."] }); continue; }
    const candidate = candidates[0]; events.push({ sourceReferenceId: previous.referenceId, targetReferenceId: candidate.referenceId, role: previous.role, status: equal(previous.signature, candidate.signature) ? "PERSISTED" : "REPLACED", evidence: equal(previous.signature, candidate.signature) ? ["The explicit edge role and immutable normalized signature survived regeneration.", "This is role-and-signature evidence, not transient kernel object identity."] : ["The explicit edge role remains unique, but its normalized signature changed; the target is reported as a replacement, not silently reused."] });
  }
  for (const candidate of targetProofs.filter((item) => item.status === "PASS" && !sourceProofs.some((previous) => previous.role === item.role && previous.status === "PASS"))) events.push({ targetReferenceId: candidate.referenceId, role: candidate.role, status: "CREATED", evidence: ["The target contains an explicit proven edge role absent from the source revision."] });
  const summary = Object.fromEntries((["PERSISTED", "REPLACED", "DELETED", "CREATED", "AMBIGUOUS", "INVALIDATED"] as EdgeEventStatus[]).map((status) => [status, events.filter((event) => event.status === status).length])) as Record<EdgeEventStatus, number>;
  return { sourceRevisionId: source.revisionId, targetRevisionId: target.revisionId, events, summary, limitations: ["Proofs are bounded to controlled CIRCLE_SKETCH → EXTRUDE rim roles and real-kernel topology inspection.", "Transient OpenCascade object identity is never used.", "An unqualified rim reference is explicitly ambiguous and cannot target a future fillet."] };
}
