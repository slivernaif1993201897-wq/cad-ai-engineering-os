import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PhysicalEngineeringVerificationRecord, PhysicalEngineeringVerificationInput } from "../shared/physicalVerification";
import type { CrashSafetyEvidenceInput, CrashSafetyEvidenceRecord, DesignComparison } from "../shared/crashSafety";
import type { CapreCheckpointManifest, CapreCheckpointSummary, CapreDiscovery, CapreRecoveryDrill, CapreRestoreVerification, CapreVerificationResult } from "../shared/capre";
export type { CapreCheckpointManifest, CapreCheckpointSummary, CapreDiscovery, CapreRecoveryDrill, CapreRestoreVerification, CapreVerificationResult } from "../shared/capre";

export { normalizeEngineeringApiBaseUrl } from "./engineering-api-url";
import { normalizeEngineeringApiBaseUrl } from "./engineering-api-url";

export type EngineeringConnection = {
  apiBaseUrl: string;
  projectId: string;
  projectName: string;
};

export type EngineeringJobSnapshot = {
  jobId: string;
  state: string;
  updatedAt: string;
  runtimeDispatch?: { status: string; reason: string };
  requirements?: { requirementsId?: string; status?: string };
  cad?: { revisionHash?: string; artifactHash?: string; artifactName?: string };
  cae?: { configurationHash?: string; status?: string };
  manifest?: { manifestHash?: string; admissionStatus?: string };
  runtimeEvidence?: {
    meshHash?: string;
    calculixHash?: string;
    resultHash?: string;
    evidenceHash?: string;
    environmentIdentity?: string;
  } | null;
  events?: Array<{ id: string; state: string; reason: string; createdAt: string }>;
};

export type SeatDesignSnapshot = {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  revisions?: Array<{ id: string; revisionNumber: number; status: string; designSnapshotHash: string }>;
  requirements?: Array<{ id: string; requirementId: string; description: string; verificationMethod: string; status: string }>;
  components?: Array<{ id: string; name: string; componentType: string; materialId?: string; quantity: number }>;
  materials?: Array<{ id: string; name: string; specification: string; validationStatus: string }>;
  traceLinks?: Array<{ id: string; sourceType: string; targetType: string; relationship: string; reason: string }>;
};

export type SeatVerificationSnapshot = {
  verificationId: string;
  seatRevisionId: string;
  state: "REQUIRED_INPUT" | "READY_FOR_EXECUTION" | "RUNNING" | "MESH_VALIDATED" | "SOLVER_COMPLETED" | "VALIDATED" | "COMPUTED_RESULT_NOT_REFERENCE_VALIDATED" | "FAILED" | "SECURITY_BLOCKED";
  requiredInputs: string[];
  cadArtifact: { cadRevisionHash: string; artifactHash: string; stepByteLength: number; kernel: string; validationStatus: string };
  caeConfiguration?: { caeConfigurationHash: string; status: string; reason?: string; requiredInputs: string[] };
  runtimeDispatch: { status: "NOT_DISPATCHED"; reason: string };
  reportStatus: "NO_SOLVER_RESULT" | "COMPUTED_RESULT_NOT_REFERENCE_VALIDATED" | "VALIDATED_RESULT";
};

export type SeatEngineeringReportSnapshot = {
  reportId: string;
  generatedAt: string;
  seatVerification: SeatVerificationSnapshot | null;
  engineeringInputPackage?: SeatInputPackageSnapshot | null;
  physicalVerification?: PhysicalEngineeringVerificationRecord | null;
  crashSafetyEvidence?: CrashSafetyEvidenceRecord | null;
  disclaimer: string;
};

export type SeatTraceabilitySnapshot = {
  projectId: string;
  seatDesignId: string;
  revisionId: string;
  stale: boolean;
  nodes: Array<{ id: string; type: string; title: string; status: "READY" | "REQUIRED_INPUT" | "STALE" | "BLOCKED" | "RUNNING" | "COMPLETED" | "VALIDATED" | "NOT_VALIDATED"; provenance: { projectId: string; revisionId?: string; artifactHash?: string; source?: string } }>;
  edges: Array<{ id: string; sourceId: string; targetId: string; relationship: string; reason: string }>;
};

export type EngineeringSearchResult = { entityType: string; id: string; title: string; status: SeatTraceabilitySnapshot["nodes"][number]["status"] };
export type SekbEntityType = "ASSEMBLY" | "GEOMETRY" | "DIMENSION" | "CONSTRAINT" | "LOAD_CASE" | "CAE_CONFIGURATION" | "MESH" | "SOLVER_RUN" | "RESULT" | "VALIDATION" | "TEST" | "REPORT" | "EVIDENCE" | "PROVENANCE";
export type SekbEntityStatus = "DRAFT" | "REVIEW" | "APPROVED" | "RELEASED" | "STALE" | "SUPERSEDED" | "REJECTED" | "REQUIRED_INPUT" | "COMPUTED" | "VALIDATED";
export type SekbEntitySnapshot = { id: string; projectId: string; seatDesignId?: string | null; seatRevisionId?: string | null; parentEntityId?: string | null; entityType: SekbEntityType; externalKey: string; name: string; description: string; valueText?: string | null; unit?: string | null; toleranceText?: string | null; coordinateReference?: string | null; sourceType: "USER_PROVIDED" | "TOOL_GENERATED" | "REFERENCE" | "CERTIFICATE" | "TEST" | "IMPORT"; sourceReference: string; evidenceReference?: string | null; artifactHash?: string | null; status: SekbEntityStatus; approvalStatus: "UNREVIEWED" | "PROPOSED" | "APPROVED" | "REJECTED"; revision: number; recordHash: string; createdBy: string; createdAt: string; updatedAt: string; releasedAt?: string };
export type SekbEntityInput = Omit<SekbEntitySnapshot, "id" | "projectId" | "revision" | "recordHash" | "createdAt" | "updatedAt" | "releasedAt" | "approvalStatus" | "status"> & { status?: SekbEntityStatus; approvalStatus?: SekbEntitySnapshot["approvalStatus"] };

export const INPUT_PACKAGE_FIELD_TYPES = ["MATERIAL_CERTIFICATE", "MATERIAL_PROPERTIES", "MOUNT_FIXTURES", "FIXTURE_COORDINATES", "FIXTURE_DOF", "LOAD_REGIONS", "LOAD_MAGNITUDE", "LOAD_DIRECTION", "LOAD_APPLICATION_COORDINATES", "BOUNDARY_CONDITIONS", "COORDINATE_SYSTEM", "MESH_SETTINGS", "SOLVER_SETTINGS", "VALIDATION_METHOD", "REFERENCE_CRITERION"] as const;
export type InputPackageFieldType = (typeof INPUT_PACKAGE_FIELD_TYPES)[number];
export type EngineeringInputField = { fieldType: InputPackageFieldType; value?: unknown; unit?: string; source?: string; evidenceFileIds?: string[]; applicability?: string; approvalStatus: "UNREVIEWED" | "APPROVED" | "REJECTED" };
export type SeatInputPackageSnapshot = { packageId: string; seatDesignId: string; seatRevisionId: string; cadRevisionHash: string; cadArtifactHash: string; fields: EngineeringInputField[]; status: "DRAFT" | "REQUIRED_INPUT" | "REVIEW" | "APPROVED" | "RELEASED" | "SECURITY_BLOCKED"; requiredInputs: string[]; packageHash: string; releasedAt?: string };
export type SeatInputAttachmentSnapshot = { attachmentId: string; packageId: string; fileName: string; mimeType: string; byteLength: number; sha256: string };
export type EngineeringDesignTemplate = { id: string; name: string; source: string; intent: string; mechanism: string; modelType: "ENGINEERING_CONCEPT_MODEL"; validationStatus: "NOT_VALIDATED"; cadReadiness: string; parameters: Array<{ name: string; category: string; unit: string; cadRequired: boolean }> };
export type ConceptDesignSnapshot = { template: EngineeringDesignTemplate; templateEntityId: string; parameters: Array<{ name: string; category: string; unit: string; cadRequired: boolean; value: string | null; state: "USER_DEFINED" | "REQUIRED_INPUT"; entityId?: string }>; artifacts: Array<SekbEntitySnapshot & { cadFileId: string | null }>; cadReadiness: "CAD_READY" | "REQUIRED_INPUT"; feStatus: "FE_BLOCKED" };
export type ConceptCadSnapshot = { record: SekbEntitySnapshot; artifact: { artifactHash: string; cadRevisionHash: string; stepByteLength: number; geometryStatus: "PARTIAL_CAD"; undefinedFeatures: string[]; storageUrl: string; cadFileId: string }; feStatus: "FE_BLOCKED" };
export type CadViewerSceneSnapshot = { sceneId: string; status: string; statusReason: string; file: { fileId: string; fileName: string; sha256: string; version: number }; boundingBox?: { min: [number, number, number]; max: [number, number, number]; size: [number, number, number]; diagonal: number; provenance: string }; mesh?: { vertices: [number, number, number][]; triangles: [number, number, number][]; faceRanges: Array<{ faceId: string; featureId: string; triangleStart: number; triangleCount: number }>; representation: string; sourceHash: string; complete: boolean; performanceNote: string }; entities: Array<{ id: string; kind: string; displayLabel: string; faceId?: string; provenance: string }>; limitations: string[] };
export type CadValidationSnapshot = { validationId: string; persistedRecordId?: string; projectId: string; artifact: { fileId: string; fileName: string; format: string; revision: number; sha256: string; byteLength: number }; overallStatus: "PASS" | "FAIL" | "WARNING" | "NOT_AVAILABLE" | "REQUIRED_INPUT"; kernel: { status: string; engine: string; loadStatus: string }; topology: { status: string; shapeValidity: string; nullOrEmpty: string; selfIntersection: string; counts: { solids: number; shells: number; faces: number; edges: number; vertices: number } }; bounds: { status: string; min?: { x: number; y: number; z: number }; max?: { x: number; y: number; z: number }; size?: { x: number; y: number; z: number }; diagonal?: number; unit: string; unitStatus: string }; warnings: string[]; failures: string[]; reproducibility: { sourceSha256: string; parser: string; parserVersion: string; createdAt: string }; limitations: string[] };
export type BooleanCutPreviewSnapshot = { operationId: string; persistedRecordId?: string; projectId: string; operation: "CUT"; source: { fileId: string; fileName: string; revision: number; sha256: string; format: string }; cutter: { fileId: string; fileName: string; revision: number; sha256: string; format: string }; previewStatus: "PREVIEW_READY" | "BOOLEAN_OPERATION_FAILED" | "REQUIRED_INPUT"; approvalStatus: "REQUIRED" | "APPROVED"; proposedArtifactName: string; proposedRevision: string; warnings: string[]; failures: string[]; createdAt: string };
export type CylindricalHolePreviewSnapshot = { operationId: string; persistedRecordId?: string; projectId: string; operation: "CYLINDRICAL_HOLE"; source: { fileId: string; fileName: string; revision: number; sha256: string; format: string }; parameters: { diameter: number; depth: number; center: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; unit: "mm" }; previewStatus: "PREVIEW_READY" | "HOLE_OPERATION_FAILED" | "REQUIRED_INPUT"; approvalStatus: "REQUIRED" | "APPROVED"; proposedArtifactName: string; proposedRevision: string; warnings: string[]; failures: string[]; createdAt: string };
export type SourceLessCncExecutionSnapshot = { completion: { success: true; executionId: string; operationId: "CREATE_2D_CNC_PLATE"; projectId: string; format: "DXF"; generatedByteLength: number; artifact: { fileId: string; fileName: string; revision: number; sha256: string; format: string }; validation: { parseStatus: string; validationStatus: string }; provenance: { executorId: string; version: string; generatorId: string; approvalHash: string; executedAt: string } }; provenanceRecordId: string; revisionId: string };
export type CadDrawingSnapshot = { drawingId: string; persistedRecordId?: string; projectId: string; source: { fileId: string; fileName: string; revision: number; sha256: string; format: string }; validationId: string; view: "FRONT" | "REAR" | "LEFT" | "RIGHT" | "TOP" | "BOTTOM" | "ISOMETRIC"; format: "SVG"; status: "EXPORTED"; drawingRevision: string; sha256: string; storage: { key: string; url: string }; createdAt: string; limitations: string[] };
export type ArtifactAssemblyComponentInput = { componentId?: string; label: string; cadFileId: string; sourceHash: string; translationMm: { x: number; y: number; z: number }; rotationDeg: { x: number; y: number; z: number } };
export type EligibleAssemblyCadFile = { artifactId: string; artifactRevision: number; artifactSha256: string; fileName: string; format: string; projectId: string; createdAt: string; availability: "AVAILABLE"; verifiedIngestionState: "VERIFIED"; geometryRepresentation: "KERNEL_DERIVED_MESH"; bounds?: CadViewerSceneSnapshot["boundingBox"] };
export type EngineeringVertexReference = { referenceId: string; artifactId: string; artifactRevision: number; artifactSha256: string; referenceType: "VERTEX"; kernelEntityIdentity: string; sourceCoordinates: { x: number; y: number; z: number }; coordinateUnit: "mm" | "m" | "inch" | "UNKNOWN"; resolutionStatus: "RESOLVED"; identityMechanism: "OPEN_CASCADE_VERTEX_POINT_SIGNATURE"; limitations: string[]; componentId?: string; persistedAt?: string };
export type ArtifactAssemblyComponentSnapshot = { componentId: string; assemblyId: string; label: string; artifactId: string; artifactRevision: number; artifactSha256: string; verifiedIngestionState: "VERIFIED"; geometryRepresentation: "KERNEL_DERIVED_MESH"; transform: { translationMm: { x: number; y: number; z: number }; rotationDeg: { x: number; y: number; z: number } }; transformRevision: { transformRevisionId: string; previousTransform: { translationMm: { x: number; y: number; z: number }; rotationDeg: { x: number; y: number; z: number } } | null; newTransform: { translationMm: { x: number; y: number; z: number }; rotationDeg: { x: number; y: number; z: number } }; timestamp: string }; engineeringReferences: EngineeringVertexReference[]; status: "ACTIVE" };
export type ArtifactAssemblySnapshot = { record: SekbEntitySnapshot; assembly: { schema: "ASSEMBLY_AUTHORING_V2" | "ASSEMBLY_AUTHORING_V3"; assemblyId: string; assemblyRevisionId: string; transformMode: "USER_DEFINED_RIGID_TRANSFORM"; constraintState: "REQUIRED_INPUT" | "UNSUPPORTED"; components: ArtifactAssemblyComponentSnapshot[]; limitations: string[] }; assemblyRevisionHash: string };
export type ArtifactAssemblyListEntry = ArtifactAssemblySnapshot | { record: SekbEntitySnapshot; availability: "REQUIRED_INPUT"; reason: string };
export type ArtifactAssemblyComparison = { assemblyId: string; fromRevision: { entityId: string; revision: number }; toRevision: { entityId: string; revision: number }; addedComponents: string[]; removedComponents: string[]; changedTransforms: string[]; unchangedComponents: string[]; artifactBindingChanges: string[] };
export type ArtifactAssemblyBomSnapshot = {
  bomId: string;
  assemblyEntityId: string;
  assemblyId: string;
  assemblyRevisionId: string;
  assemblyRecordRevision: number;
  assemblyRevisionHash: string;
  generatedAt: string;
  status: "DERIVED_FROM_VERIFIED_ASSEMBLY";
  items: Array<{ bomItemId: string; quantity: number; componentIds: string[]; componentLabels: string[]; sourceCadFileId: string; sourceCadRevision: number; sourceCadSha256: string; sourceFileName: string; format: "STEP"; verification: "PARSED_VALID_KERNEL_MESH" }>;
  limitations: string[];
  bomHash: string;
};
export type EngineeringReferenceCandidatesSnapshot = { component: Pick<ArtifactAssemblyComponentSnapshot, "componentId" | "artifactId" | "artifactRevision" | "artifactSha256">; supportedReferenceTypes: ["VERTEX"]; unsupportedReferenceTypes: string[]; candidates: EngineeringVertexReference[]; limitations: string[] };
export type EngineeringReferenceResolutionSnapshot = {
  assemblyRevisionId: string;
  componentId: string;
  references: Array<{
    reference: EngineeringVertexReference;
    resolutionStatus: "RESOLVED" | "INVALID" | "ARTIFACT_HASH_MISMATCH" | "ARTIFACT_REVISION_MISMATCH" | "ENTITY_NOT_FOUND" | "UNSUPPORTED" | "REQUIRED_INPUT";
    reason: string;
    assemblySpace: { coordinateUnit: "mm"; coordinates: { x: number; y: number; z: number }; rotationOrder: string } | { status: "REQUIRED_INPUT"; reason: string };
  }>;
};
export type CadAgentSkillSnapshot = { skillId: string; name: string; description: string; domain: "CAD" | "CAE" | "CAM" | "ASSEMBLY" | "INTEROPERABILITY"; version: string; supportedInputs: string[]; requiredParameters: string[]; supportedOutputs: string[]; preconditions: string[]; postconditions: string[]; executionMethod: string; dependencies: string[]; securityPolicy: string; provenancePolicy: string; testStatus: "VERIFIED" | "NOT_EXECUTED" | "EXTERNAL_AUDIT_ONLY"; capabilityStatus: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "REQUIRES_DEPENDENCY" | "BLOCKED" | "UNSUPPORTED" };
export type CapabilitySnapshot = { capabilityId: string; domain: string; name: string; description: string; engine: string[]; inputSchema: Record<string, unknown>; outputSchema: Record<string, unknown>; requiredParameters: string[]; supportedFormats: string[]; validationRequirements: string[]; securityRequirements: string[]; artifactType: string[]; status: "VERIFIED" | "PARTIAL" | "BLOCKED" | "UNSUPPORTED"; version: string; testReference: string[]; knownLimitations: string[] };
export type CapabilityRegistrySnapshot = { registryId: "CAD-AGENT.CAPABILITY.REGISTRY"; registryVersion: string; registryHash: string; capabilities: CapabilitySnapshot[]; persistedRecordId?: string };
export type CadAgentContextSnapshot = { projectId: string; authorizedCadFileCount: number; parsedCadFileCount: number; verifiedCadFileCount: number; persistedAssemblyCount: number; evidenceRecordCount: number; capabilityRegistry: { registryVersion: string; registryHash: string; capabilityCount: number; persistedRecordId?: string }; controlledContext: string[]; limitations: string[] };
export type CadAgentCommandInterpretation = { normalizedCommand: string; intent: string; engineeringTerms: string[]; parameters: Array<{ name: string; value: number | string; unit?: string; normalizedValue?: number; normalizedUnit?: string; source: "USER_COMMAND"; confidence: "EXPLICIT" }>; references: string[]; missingInputs: string[]; ambiguity: string[] };
export type CadAgentOperationPlan = { planId: string; capabilityId: string; intent: string; prerequisites: Array<{ requirement: string; status: "SATISFIED" | "REQUIRED_INPUT" | "UNSUPPORTED"; evidence: string }>; steps: Array<{ order: number; stage: string; status: "READY" | "BLOCKED" | "PENDING"; detail: string }>; postconditions: string[]; errorRecovery: string[] };
export type CadAgentCommandSnapshot = { commandId: string; commandKind: string; safety: "SAFE_TO_EXECUTE" | "REQUIRES_PARAMETERS" | "REQUIRES_CONFIRMATION" | "UNSUPPORTED" | "BLOCKED"; capability: { capabilityId: string; status: string; version: string; engine: string[]; testReference: string[]; knownLimitations: string[] }; registry: { registryId: string; registryVersion: string; registryHash: string; persistedRecordId?: string }; selectedSkill: Pick<CadAgentSkillSnapshot, "skillId" | "name" | "domain" | "capabilityStatus" | "executionMethod">; normalizedIntent: string; interpretation: CadAgentCommandInterpretation; operationPlan: CadAgentOperationPlan; requiredInputs: string[]; context: { projectId: string; assemblyEntityId?: string; authorizedCadFileCount: number; persistedAssemblyCount: number; evidenceRecordCount: number }; execution: { status: "NOT_EXECUTED" | "EXECUTED" | "REJECTED"; reason: string; output?: { bomId?: string; bomHash?: string; assemblyRevisionId?: string; artifactId?: string; artifactHash?: string; validationId?: string; featureId?: string; featureRevision?: number } }; provenanceRecordId: string; explanation: string };
export type CadAgentHistoryRecord = { id: string; title: string; content: string; truthStatus: string; validationStage: string; createdAt: string };

const CONNECTION_KEY = "cad_ai_engineering_connection_v1";
const ACCESS_KEY = "cad_ai_engineering_project_access_v1";

function storage() {
  return {
    async get(key: string) {
      if (Platform.OS === "web") return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
      return SecureStore.getItemAsync(key);
    },
    async set(key: string, value: string) {
      if (Platform.OS === "web") {
        sessionStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    },
    async remove(key: string) {
      if (Platform.OS === "web") {
        sessionStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    },
  };
}

async function request<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({ error: "INVALID_API_RESPONSE" }));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `HTTP_${response.status}`);
  return body as T;
}

export async function healthCheckEngineeringApi(apiBaseUrl: string) {
  return request<{ ok: boolean }>(apiBaseUrl, "/api/health");
}

export async function createEngineeringProject(apiBaseUrl: string, name: string) {
  const project = await request<{ projectId: string; name: string; accessKey: string }>(apiBaseUrl, "/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const connection: EngineeringConnection = { apiBaseUrl, projectId: project.projectId, projectName: project.name };
  const store = storage();
  await store.set(CONNECTION_KEY, JSON.stringify(connection));
  await store.set(ACCESS_KEY, project.accessKey);
  return connection;
}

export async function loadEngineeringConnection(): Promise<EngineeringConnection | null> {
  const value = await storage().get(CONNECTION_KEY);
  if (!value) return null;
  try {
    const connection = JSON.parse(value) as EngineeringConnection;
    return normalizeEngineeringApiBaseUrl(connection.apiBaseUrl) && connection.projectId && connection.projectName ? connection : null;
  } catch {
    return null;
  }
}

export async function clearEngineeringConnection() {
  const store = storage();
  await Promise.all([store.remove(CONNECTION_KEY), store.remove(ACCESS_KEY)]);
}

async function authorizedHeaders(connection: EngineeringConnection) {
  const accessKey = await storage().get(ACCESS_KEY);
  if (!accessKey) throw new Error("PROJECT_ACCESS_REQUIRED");
  return { "x-engineering-access-key": accessKey, "x-engineering-project-id": connection.projectId };
}

export async function listEngineeringJobs(connection: EngineeringConnection): Promise<EngineeringJobSnapshot[]> {
  return request<EngineeringJobSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/jobs`, {
    headers: await authorizedHeaders(connection),
  });
}

export async function submitMountingBlockRequest(connection: EngineeringConnection, input: { name: string; width: number; depth: number; height: number; holeDiameter: number; holeEdgeOffset: number; filletRadius: number }) {
  const headers = await authorizedHeaders(connection);
  const sourceText = `Create a ${input.width} mm × ${input.depth} mm × ${input.height} mm mounting block. Add four ${input.holeDiameter} mm holes near the corners using a ${input.holeEdgeOffset} mm edge offset. Add a ${input.filletRadius} mm fillet.`;
  return request<EngineeringJobSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/jobs`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ name: input.name, sourceText, mountingBlock: { ...input, approveAssumption: true } }),
  });
}

export async function getEngineeringJob(connection: EngineeringConnection, jobId: string): Promise<EngineeringJobSnapshot> {
  return request<EngineeringJobSnapshot>(connection.apiBaseUrl, `/api/jobs/${jobId}`, { headers: await authorizedHeaders(connection) });
}

export async function getEngineeringJobStatus(connection: EngineeringConnection, jobId: string) {
  return request<{ jobId: string; state: string; updatedAt: string; runtimeDispatch: { status: string; reason: string }; events: EngineeringJobSnapshot["events"] }>(connection.apiBaseUrl, `/api/jobs/${jobId}/status`, { headers: await authorizedHeaders(connection) });
}

export async function getEngineeringMesh(connection: EngineeringConnection, jobId: string) {
  return request<{ jobId: string; available: true; gmshHash: string; meshHash: string; executionLogHash: string }>(connection.apiBaseUrl, `/api/jobs/${jobId}/mesh`, { headers: await authorizedHeaders(connection) });
}

export async function getEngineeringEvidence(connection: EngineeringConnection, jobId: string) {
  return request<{ jobId: string; manifestHash?: string; runtimeEvidence: EngineeringJobSnapshot["runtimeEvidence"]; events: EngineeringJobSnapshot["events"] }>(connection.apiBaseUrl, `/api/jobs/${jobId}/evidence`, { headers: await authorizedHeaders(connection) });
}

export async function getEngineeringResult(connection: EngineeringConnection, jobId: string) {
  return request<{ jobId: string; available: true; calculixHash: string; inputHash: string; outputHash: string; resultHash: string; evidenceHash: string }>(connection.apiBaseUrl, `/api/jobs/${jobId}/result`, { headers: await authorizedHeaders(connection) });
}

export async function createPhysicalEngineeringVerification(connection: EngineeringConnection, input: { jobId?: string; input: PhysicalEngineeringVerificationInput }): Promise<PhysicalEngineeringVerificationRecord> {
  return request<PhysicalEngineeringVerificationRecord>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/physical-verifications`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export async function listPhysicalEngineeringVerifications(connection: EngineeringConnection, jobId?: string): Promise<PhysicalEngineeringVerificationRecord[]> {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
  return request<PhysicalEngineeringVerificationRecord[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/physical-verifications${query}`, { headers: await authorizedHeaders(connection) });
}

export async function createCrashSafetyEvidence(connection: EngineeringConnection, input: CrashSafetyEvidenceInput): Promise<CrashSafetyEvidenceRecord> {
  return request<CrashSafetyEvidenceRecord>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/crash-safety-evidence`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ input }) });
}

export async function listCrashSafetyEvidence(connection: EngineeringConnection): Promise<CrashSafetyEvidenceRecord[]> {
  return request<CrashSafetyEvidenceRecord[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/crash-safety-evidence`, { headers: await authorizedHeaders(connection) });
}

export async function compareCrashSafetyEvidence(connection: EngineeringConnection, baselineRecordId: string, proposedRecordId: string): Promise<DesignComparison> {
  return request<DesignComparison>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/crash-safety-evidence/compare/${encodeURIComponent(baselineRecordId)}/${encodeURIComponent(proposedRecordId)}`, { headers: await authorizedHeaders(connection) });
}

export type CapreStagingRestoreSnapshot = { checkpointId: string; stagingId: string; status: "STAGING_RESTORED"; sourceManifestSha256: string; limitations: string[] };
export async function discoverCapre(connection: EngineeringConnection): Promise<CapreDiscovery> {
  return request<CapreDiscovery>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/discover`, { headers: await authorizedHeaders(connection) });
}
export async function listCapreCheckpoints(connection: EngineeringConnection): Promise<CapreCheckpointSummary[]> {
  return request<CapreCheckpointSummary[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/checkpoints`, { headers: await authorizedHeaders(connection) });
}
export async function captureCapreCheckpoint(connection: EngineeringConnection): Promise<CapreCheckpointSummary> {
  return request<CapreCheckpointSummary>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/capture`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function inspectCapreCheckpoint(connection: EngineeringConnection, checkpointId: string): Promise<CapreCheckpointManifest> {
  return request<CapreCheckpointManifest>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/checkpoints/${encodeURIComponent(checkpointId)}`, { headers: await authorizedHeaders(connection) });
}
export async function verifyCapreCheckpoint(connection: EngineeringConnection, checkpointId: string): Promise<CapreVerificationResult> {
  return request<CapreVerificationResult>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/checkpoints/${encodeURIComponent(checkpointId)}/verify`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function restoreCapreToStaging(connection: EngineeringConnection, checkpointId: string): Promise<CapreStagingRestoreSnapshot> {
  return request<CapreStagingRestoreSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/checkpoints/${encodeURIComponent(checkpointId)}/restore-staging`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function verifyCapreStagingRestore(connection: EngineeringConnection, stagingId: string): Promise<CapreRestoreVerification> {
  return request<CapreRestoreVerification>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/staging/${encodeURIComponent(stagingId)}/verify`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function runCapreRecoveryDrill(connection: EngineeringConnection): Promise<CapreRecoveryDrill> {
  return request<CapreRecoveryDrill>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capre/recovery-drill`, { method: "POST", headers: await authorizedHeaders(connection) });
}

export async function listSeatDesigns(connection: EngineeringConnection): Promise<SeatDesignSnapshot[]> {
  return request<SeatDesignSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs`, { headers: await authorizedHeaders(connection) });
}

export async function listEngineeringDesignTemplates(connection: EngineeringConnection): Promise<EngineeringDesignTemplate[]> {
  return request<EngineeringDesignTemplate[]>(connection.apiBaseUrl, "/api/design-templates", { headers: await authorizedHeaders(connection) });
}

export async function createConceptDesign(connection: EngineeringConnection, input: { templateId: string; name: string; description: string }) {
  return request<{ seat: SeatDesignSnapshot; template: EngineeringDesignTemplate; revisionId: string; templateEntityId: string }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/concept-designs`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export async function getConceptDesign(connection: EngineeringConnection, seatDesignId: string, revisionId: string): Promise<ConceptDesignSnapshot> {
  return request<ConceptDesignSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/concept-design`, { headers: await authorizedHeaders(connection) });
}

export async function setConceptDesignParameter(connection: EngineeringConnection, seatDesignId: string, revisionId: string, parameterName: string, value: string, unit: string) {
  return request<SekbEntitySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/concept-design/parameters/${encodeURIComponent(parameterName)}`, { method: "PUT", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ value, unit }) });
}

export async function generateConceptCad(connection: EngineeringConnection, seatDesignId: string, revisionId: string): Promise<ConceptCadSnapshot> {
  return request<ConceptCadSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/concept-design/generate-cad`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function getCadViewerScene(connection: EngineeringConnection, cadFileId: string): Promise<CadViewerSceneSnapshot> {
  return request<CadViewerSceneSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-files/${cadFileId}/viewer-scene`, { headers: await authorizedHeaders(connection) });
}
export async function createCadValidation(connection: EngineeringConnection, cadFileId: string): Promise<CadValidationSnapshot> {
  return request<CadValidationSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-files/${cadFileId}/validations`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function listCadValidations(connection: EngineeringConnection, cadFileId: string): Promise<CadValidationSnapshot[]> {
  return request<CadValidationSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-files/${cadFileId}/validations`, { headers: await authorizedHeaders(connection) });
}
export async function previewCadBooleanCut(connection: EngineeringConnection, sourceFileId: string, cutterFileId: string): Promise<BooleanCutPreviewSnapshot> {
  return request<BooleanCutPreviewSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-operations/boolean-cut/preview`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ sourceFileId, cutterFileId }) });
}
export async function approveCadBooleanCut(connection: EngineeringConnection, operationId: string) {
  return request<BooleanCutPreviewSnapshot & { result: { artifact: BooleanCutPreviewSnapshot["source"]; validationId: string; validationStatus: string }; provenance: unknown }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-operations/boolean-cut/${operationId}/approve`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function previewCadCylindricalHole(connection: EngineeringConnection, sourceFileId: string, parameters: CylindricalHolePreviewSnapshot["parameters"]): Promise<CylindricalHolePreviewSnapshot> {
  return request<CylindricalHolePreviewSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-operations/cylindrical-hole/preview`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ sourceFileId, parameters }) });
}
export async function approveCadCylindricalHole(connection: EngineeringConnection, operationId: string) {
  return request<CylindricalHolePreviewSnapshot & { result: { artifact: CylindricalHolePreviewSnapshot["source"]; validationId: string; validationStatus: string }; provenance: unknown }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-operations/cylindrical-hole/${operationId}/approve`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function createCncTestPlate(connection: EngineeringConnection): Promise<SourceLessCncExecutionSnapshot> {
  return request<SourceLessCncExecutionSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-operations/source-less/cnc-test-plate`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function exportCadDrawing(connection: EngineeringConnection, cadFileId: string, validationId: string, view: CadDrawingSnapshot["view"]): Promise<CadDrawingSnapshot> {
  return request<CadDrawingSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-files/${cadFileId}/drawings`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ validationId, view }) });
}
export async function listCadDrawings(connection: EngineeringConnection, cadFileId: string): Promise<CadDrawingSnapshot[]> {
  return request<CadDrawingSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-files/${cadFileId}/drawings`, { headers: await authorizedHeaders(connection) });
}
export async function getCadAgentContext(connection: EngineeringConnection): Promise<CadAgentContextSnapshot> {
  return request<CadAgentContextSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-agent/context`, { headers: await authorizedHeaders(connection) });
}
export async function getCapabilityRegistry(connection: EngineeringConnection): Promise<CapabilityRegistrySnapshot> {
  return request<CapabilityRegistrySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/capabilities`, { headers: await authorizedHeaders(connection) });
}
export async function listCadAgentSkills(connection: EngineeringConnection): Promise<CadAgentSkillSnapshot[]> {
  return request<CadAgentSkillSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-agent/skills`, { headers: await authorizedHeaders(connection) });
}
export async function listCadAgentHistory(connection: EngineeringConnection): Promise<CadAgentHistoryRecord[]> {
  return request<CadAgentHistoryRecord[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-agent/history`, { headers: await authorizedHeaders(connection) });
}
export async function runCadAgentCommand(connection: EngineeringConnection, input: { message: string; assemblyEntityId?: string; confirmed?: boolean; sourceFileId?: string; holeParameters?: unknown; externalParameters?: { widthMm: number; heightMm: number; thicknessMm: number; unit: "mm" } }): Promise<CadAgentCommandSnapshot> {
  return request<CadAgentCommandSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/cad-agent/commands`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}
export async function createArtifactAssembly(connection: EngineeringConnection, input: { name: string; components: ArtifactAssemblyComponentInput[]; seatDesignId?: string; seatRevisionId?: string }): Promise<ArtifactAssemblySnapshot> {
  return request<ArtifactAssemblySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}
export async function listEligibleAssemblyCadFiles(connection: EngineeringConnection): Promise<EligibleAssemblyCadFile[]> {
  return request<EligibleAssemblyCadFile[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/eligible-cad-files`, { headers: await authorizedHeaders(connection) });
}
export async function listArtifactAssemblies(connection: EngineeringConnection): Promise<ArtifactAssemblyListEntry[]> {
  return request<ArtifactAssemblyListEntry[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies`, { headers: await authorizedHeaders(connection) });
}
export async function getArtifactAssembly(connection: EngineeringConnection, entityId: string): Promise<ArtifactAssemblySnapshot> {
  return request<ArtifactAssemblySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}`, { headers: await authorizedHeaders(connection) });
}
export async function createArtifactAssemblyBom(connection: EngineeringConnection, entityId: string): Promise<ArtifactAssemblyBomSnapshot> {
  return request<ArtifactAssemblyBomSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/bom`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function listArtifactAssemblyBoms(connection: EngineeringConnection, entityId: string): Promise<ArtifactAssemblyBomSnapshot[]> {
  return request<ArtifactAssemblyBomSnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/bom`, { headers: await authorizedHeaders(connection) });
}
export async function reviseArtifactAssembly(connection: EngineeringConnection, entityId: string, input: { name: string; reason: string; components: ArtifactAssemblyComponentInput[] }): Promise<ArtifactAssemblySnapshot> {
  return request<ArtifactAssemblySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/revise`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}
export async function listArtifactAssemblyRevisions(connection: EngineeringConnection, entityId: string): Promise<ArtifactAssemblySnapshot[]> {
  return request<ArtifactAssemblySnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/revisions`, { headers: await authorizedHeaders(connection) });
}
export async function compareArtifactAssemblyRevisions(connection: EngineeringConnection, fromEntityId: string, toEntityId: string): Promise<ArtifactAssemblyComparison> {
  return request<ArtifactAssemblyComparison>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${fromEntityId}/compare/${toEntityId}`, { headers: await authorizedHeaders(connection) });
}
export async function listAssemblyEngineeringReferenceCandidates(connection: EngineeringConnection, entityId: string, componentId: string): Promise<EngineeringReferenceCandidatesSnapshot> {
  return request<EngineeringReferenceCandidatesSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/components/${componentId}/engineering-references/candidates`, { headers: await authorizedHeaders(connection) });
}
export async function resolveAssemblyEngineeringReferences(connection: EngineeringConnection, entityId: string, componentId: string): Promise<EngineeringReferenceResolutionSnapshot> {
  return request<EngineeringReferenceResolutionSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/components/${componentId}/engineering-references`, { headers: await authorizedHeaders(connection) });
}
export async function addAssemblyEngineeringReference(connection: EngineeringConnection, entityId: string, componentId: string, referenceId: string, reason: string): Promise<ArtifactAssemblySnapshot & { reference: EngineeringVertexReference }> {
  return request<ArtifactAssemblySnapshot & { reference: EngineeringVertexReference }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/assemblies/${entityId}/components/${componentId}/engineering-references`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ referenceId, reason }) });
}

export async function createConceptDesignSuccessor(connection: EngineeringConnection, seatDesignId: string, revisionId: string) {
  return request<{ successor: SeatDesignSnapshot; revisionId: string }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/concept-design/successor`, { method: "POST", headers: await authorizedHeaders(connection) });
}

export async function createSeatDesign(connection: EngineeringConnection, input: { name: string; description: string; requirements: Array<{ requirementId: string; description: string; constraint: Record<string, unknown>; verificationMethod: string }>; materials: Array<{ name: string; specification: string; properties: Record<string, unknown>; validationStatus: "UNKNOWN" | "VALID" | "INVALID" }>; components: Array<{ name: string; componentType: string; materialName?: string; quantity: number }> }): Promise<SeatDesignSnapshot> {
  return request<SeatDesignSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export type SeatRevisionInput = Omit<Parameters<typeof createSeatDesign>[1], "name">;

export async function createSeatRevision(connection: EngineeringConnection, seatDesignId: string, input: SeatRevisionInput): Promise<SeatDesignSnapshot> {
  return request<SeatDesignSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export async function releaseSeatRevision(connection: EngineeringConnection, seatDesignId: string, revisionId: string): Promise<SeatDesignSnapshot> {
  return request<SeatDesignSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/release`, { method: "POST", headers: await authorizedHeaders(connection) });
}

export async function getSeatDesignVerification(connection: EngineeringConnection, seatDesignId: string, revisionId: string): Promise<SeatVerificationSnapshot> {
  return request<SeatVerificationSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/verification`, { headers: await authorizedHeaders(connection) });
}

export async function createSeatDesignVerification(connection: EngineeringConnection, seatDesignId: string, revisionId: string, input: unknown): Promise<SeatVerificationSnapshot> {
  return request<SeatVerificationSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/revisions/${revisionId}/verification`, {
    method: "POST",
    headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getSeatEngineeringReport(connection: EngineeringConnection, seatDesignId: string): Promise<SeatEngineeringReportSnapshot> {
  return request<SeatEngineeringReportSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/report`, { headers: await authorizedHeaders(connection) });
}

export async function getSeatEngineeringTraceability(connection: EngineeringConnection, seatDesignId: string, revisionId?: string, jobId?: string): Promise<SeatTraceabilitySnapshot> {
  const query = new URLSearchParams();
  if (revisionId) query.set("revisionId", revisionId);
  if (jobId) query.set("jobId", jobId);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request<SeatTraceabilitySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-designs/${seatDesignId}/traceability${suffix}`, { headers: await authorizedHeaders(connection) });
}

export async function searchEngineeringKnowledge(connection: EngineeringConnection, query: string): Promise<EngineeringSearchResult[]> {
  return request<EngineeringSearchResult[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/engineering-search?q=${encodeURIComponent(query)}`, { headers: await authorizedHeaders(connection) });
}

export async function listSekbEntities(connection: EngineeringConnection, filters: { type?: SekbEntityType; status?: SekbEntityStatus; seatDesignId?: string; seatRevisionId?: string; limit?: number; offset?: number } = {}): Promise<SekbEntitySnapshot[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)); });
  return request<SekbEntitySnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities${query.size ? `?${query.toString()}` : ""}`, { headers: await authorizedHeaders(connection) });
}

export async function createSekbEntity(connection: EngineeringConnection, input: SekbEntityInput) {
  return request<SekbEntitySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export async function searchSekbEntities(connection: EngineeringConnection, queryText: string, filters: { type?: SekbEntityType; status?: SekbEntityStatus } = {}) {
  const query = new URLSearchParams({ q: queryText });
  if (filters.type) query.set("type", filters.type);
  if (filters.status) query.set("status", filters.status);
  return request<SekbEntitySnapshot[]>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/search?${query.toString()}`, { headers: await authorizedHeaders(connection) });
}

export async function approveSekbEntity(connection: EngineeringConnection, entityId: string, actor: string, reason: string) {
  return request<SekbEntitySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities/${entityId}/approve`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ actor, reason }) });
}

export async function releaseSekbEntity(connection: EngineeringConnection, entityId: string, actor: string, reason: string) {
  return request<SekbEntitySnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities/${entityId}/release`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ actor, reason }) });
}

export async function getSekbAudit(connection: EngineeringConnection, entityId: string) {
  return request<{ auditEvents: Array<{ action: string; actor: string; reason: string; createdAt: string }>; attachments: Array<{ id: string; fileName: string; sha256: string; sourceReference: string; createdAt: string }>; relations: Array<{ id: string; targetEntityId: string; relationship: string; reason: string; status: string; createdAt: string }> }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities/${entityId}/audit`, { headers: await authorizedHeaders(connection) });
}

export async function uploadSekbAttachment(connection: EngineeringConnection, entityId: string, input: { fileName: string; mediaType: string; base64: string; sourceReference: string; actor: string }) {
  return request<{ id: string; sha256: string; fileName: string; createdAt: string }>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/sekb/entities/${entityId}/attachments/upload`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}

export async function createSeatInputPackage(connection: EngineeringConnection, input: Pick<SeatInputPackageSnapshot, "seatDesignId" | "seatRevisionId" | "cadRevisionHash" | "cadArtifactHash"> & { fields?: EngineeringInputField[] }) {
  return request<SeatInputPackageSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}
export async function updateSeatInputPackage(connection: EngineeringConnection, packageId: string, fields: EngineeringInputField[]) {
  return request<SeatInputPackageSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages/${packageId}`, { method: "PUT", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify({ fields }) });
}
export async function validateSeatInputPackage(connection: EngineeringConnection, packageId: string) {
  return request<SeatInputPackageSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages/${packageId}/validate`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function approveSeatInputPackage(connection: EngineeringConnection, packageId: string) {
  return request<SeatInputPackageSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages/${packageId}/approve`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function releaseSeatInputPackage(connection: EngineeringConnection, packageId: string) {
  return request<SeatInputPackageSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages/${packageId}/release`, { method: "POST", headers: await authorizedHeaders(connection) });
}
export async function attachSeatInputEvidence(connection: EngineeringConnection, packageId: string, input: { fileName: string; mimeType?: string; base64: string }) {
  return request<SeatInputAttachmentSnapshot>(connection.apiBaseUrl, `/api/projects/${connection.projectId}/seat-input-packages/${packageId}/evidence`, { method: "POST", headers: { ...(await authorizedHeaders(connection)), "content-type": "application/json" }, body: JSON.stringify(input) });
}
