import { randomUUID } from "node:crypto";

import { createArtifactAssemblyBom, getArtifactAssembly, listArtifactAssemblies } from "./artifactAssembly";
import { approveCylindricalHoleAdmitted, previewCylindricalHoleAdmitted } from "./cadArtifactOperations";
import { findCapability, getCapabilityRegistrySnapshot } from "./capabilityRegistry";
import { buildEngineeringOperationPlan, interpretEngineeringCommand, type EngineeringCommandInterpretation, type EngineeringOperationPlan } from "./cadAgentInterpreter";
import { createCadValidation } from "./cadArtifactOperations";
import { listCadFiles } from "./cadFileIntelligence";
import { executeExternalTextToCadPlate, getExternalTextToCadSkills } from "./externalTextToCadAdapter";
import { appendPersistentMemory, projectMemorySnapshot } from "./persistentMemory";
import { executeAuthorizedExternalTextToCadPlate } from "./sourceLessCadExecution";

type Access = { projectId: string; accessKey: string };

export type CadAgentSkill = {
  skillId: string;
  name: string;
  description: string;
  domain: "CAD" | "CAE" | "CAM" | "ASSEMBLY" | "INTEROPERABILITY";
  version: string;
  supportedInputs: string[];
  requiredParameters: string[];
  supportedOutputs: string[];
  preconditions: string[];
  postconditions: string[];
  executionMethod: string;
  dependencies: string[];
  securityPolicy: string;
  provenancePolicy: string;
  testStatus: "VERIFIED" | "NOT_EXECUTED" | "EXTERNAL_AUDIT_ONLY";
  capabilityStatus: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "REQUIRES_DEPENDENCY" | "BLOCKED" | "UNSUPPORTED";
};

export type CadAgentCommandKind = "QUESTION" | "COMMAND" | "MODIFICATION" | "ANALYSIS" | "VALIDATION" | "SEARCH" | "IMPORT" | "EXPORT" | "SIMULATION" | "MANUFACTURING" | "REQUIRES_INPUT";
export type CadAgentSafety = "SAFE_TO_EXECUTE" | "REQUIRES_PARAMETERS" | "REQUIRES_CONFIRMATION" | "UNSUPPORTED" | "BLOCKED";

export type CadAgentCommandResult = {
  commandId: string;
  commandKind: CadAgentCommandKind;
  safety: CadAgentSafety;
  capability: { capabilityId: string; status: string; version: string; engine: string[]; testReference: string[]; knownLimitations: string[] };
  registry: { registryId: string; registryVersion: string; registryHash: string; persistedRecordId?: string };
  selectedSkill: Pick<CadAgentSkill, "skillId" | "name" | "domain" | "capabilityStatus" | "executionMethod">;
  normalizedIntent: string;
  interpretation: EngineeringCommandInterpretation;
  operationPlan: EngineeringOperationPlan;
  requiredInputs: string[];
  context: {
    projectId: string;
    assemblyEntityId?: string;
    authorizedCadFileCount: number;
    persistedAssemblyCount: number;
    evidenceRecordCount: number;
  };
  execution: { status: "NOT_EXECUTED" | "EXECUTED" | "REJECTED"; reason: string; output?: { bomId?: string; bomHash?: string; assemblyRevisionId?: string; artifactId?: string; artifactHash?: string; validationId?: string; featureId?: string; featureRevision?: number } };
  provenanceRecordId: string;
  explanation: string;
};

const skills: CadAgentSkill[] = [
  {
    skillId: "cad.inspect_artifact.v1", name: "Inspect verified CAD artifact", description: "Retrieves parser and kernel-derived inspection context for project-owned STEP artifacts.", domain: "CAD", version: "1.0.0", supportedInputs: ["Project-owned CAD file ID"], requiredParameters: ["CAD file ID"], supportedOutputs: ["Parser status", "bounds", "kernel-derived viewer scene"], preconditions: ["Project authorization", "managed artifact bytes"], postconditions: ["No source CAD mutation"], executionMethod: "AUTHORITATIVE_CAD_FILE_INGESTION_AND_VIEWER", dependencies: ["OpenCascade", "managed storage"], securityPolicy: "Project-scoped authorization and source SHA-256 binding are mandatory.", provenancePolicy: "Use persisted CAD file identity, revision, and SHA-256 only.", testStatus: "VERIFIED", capabilityStatus: "SUPPORTED",
  },
  {
    skillId: "assembly.derive_bom.v1", name: "Derive verified assembly BOM", description: "Persists an immutable bill of materials from verified component-to-STEP bindings in a saved assembly revision.", domain: "ASSEMBLY", version: "1.0.0", supportedInputs: ["Assembly entity ID"], requiredParameters: ["Assembly entity ID", "explicit user confirmation"], supportedOutputs: ["Component quantities", "CAD file identities", "CAD revision", "SHA-256 bindings"], preconditions: ["Project authorization", "Saved assembly", "Verified STEP components"], postconditions: ["Persisted governed BOM revision", "No CAD source mutation"], executionMethod: "AUTHORITATIVE_ASSEMBLY_BOM_DERIVATION", dependencies: ["Assembly persistence", "CAD file ingestion"], securityPolicy: "Only project-owned validated STEP artifacts are accepted.", provenancePolicy: "Every BOM item retains assembly revision and source CAD identity/hash.", testStatus: "VERIFIED", capabilityStatus: "SUPPORTED",
  },
  {
    skillId: "cae.inspect_readiness.v1", name: "Inspect CAE readiness", description: "Reports whether explicit input-package evidence exists; it never manufactures missing material, load, fixture, mesh, solver, or validation inputs.", domain: "CAE", version: "1.0.0", supportedInputs: ["Project context", "seat revision context"], requiredParameters: [], supportedOutputs: ["REQUIRED_INPUT or readiness explanation"], preconditions: ["Project authorization"], postconditions: ["No solver dispatch"], executionMethod: "FAIL_CLOSED_INPUT_PACKAGE_GATE", dependencies: ["Seat input package", "runtime admission"], securityPolicy: "No CAE execution without approved exact inputs and evidence.", provenancePolicy: "Reports only persisted package/evidence state.", testStatus: "VERIFIED", capabilityStatus: "SUPPORTED",
  },
  {
    skillId: "cae.dispatch_solver.v1", name: "Dispatch verified CAE solve", description: "Reserved controlled gateway to the existing runtime admission path.", domain: "CAE", version: "1.0.0", supportedInputs: ["Released CAD revision", "approved CAE package", "validated runtime admission"], requiredParameters: ["material", "fixtures", "loads", "boundary conditions", "mesh settings", "solver settings", "validation criterion"], supportedOutputs: ["Authoritative evidence only after runtime completion"], preconditions: ["All admission gates pass"], postconditions: ["Hash-bound result or fail-closed rejection"], executionMethod: "EXISTING_RUNTIME_ADMISSION_ONLY", dependencies: ["Gmsh", "CalculiX", "HMAC evidence"], securityPolicy: "No chat command bypasses runtime admission.", provenancePolicy: "Runtime evidence remains server-verified and job-bound.", testStatus: "VERIFIED", capabilityStatus: "BLOCKED",
  },
  {
    skillId: "cam.generate_gcode.v1", name: "Generate machine G-code", description: "Not enabled because no validated machine-specific post processor and production machining inputs are registered.", domain: "CAM", version: "1.0.0", supportedInputs: ["Manufacturing-ready CAD", "validated post processor"], requiredParameters: ["machine", "tooling", "stock", "feeds", "speeds", "post processor"], supportedOutputs: ["Machine-specific G-code"], preconditions: ["Validated post processor"], postconditions: ["None until controlled manufacturing validation exists"], executionMethod: "NOT_ENABLED", dependencies: ["Validated CAM stack"], securityPolicy: "Never emit machine commands without a validated post processor.", provenancePolicy: "No artifact is created while blocked.", testStatus: "NOT_EXECUTED", capabilityStatus: "BLOCKED",
  },
  {
    skillId: "external.text_to_cad.cad.v1", name: "text-to-cad CAD skill candidate", description: "External MIT-licensed skill candidate audited statically; it is not installed or executable inside CAD-AGENT.", domain: "INTEROPERABILITY", version: "external-main-audit", supportedInputs: ["External skill source"], requiredParameters: ["Approved dependency review", "adapter design", "sandboxed execution policy"], supportedOutputs: ["Audit evidence only"], preconditions: ["License, dependency, security, compatibility, and integration review"], postconditions: ["No runtime activation from audit alone"], executionMethod: "EXTERNAL_AUDIT_ONLY", dependencies: ["Python 3.11+", "Playwright declared by external CAD skill"], securityPolicy: "No arbitrary external CLI is exposed to chat or production runtime.", provenancePolicy: "External repository metadata is retained as review evidence, not as CAD authority.", testStatus: "EXTERNAL_AUDIT_ONLY", capabilityStatus: "REQUIRES_DEPENDENCY",
  },
  {
    skillId: "external.text_to_cad.cad.rectangular_plate.v1", name: "text-to-cad controlled rectangular plate", description: "Permissioned adapter for one pinned upstream CAD CLI workflow. It writes only adapter-owned source for explicit millimetre plate dimensions and re-ingests the returned STEP through CAD-AGENT.", domain: "CAD", version: "b97ff01/cadgen-0.4.26", supportedInputs: ["widthMm", "heightMm", "thicknessMm", "unit mm"], requiredParameters: ["Explicit positive width/height/thickness in mm", "explicit confirmation", "configured pinned runtime"], supportedOutputs: ["Validated STEP artifact", "SHA-256", "external execution provenance"], preconditions: ["Project authorization", "adapter-owned source only", "pinned runtime", "explicit confirmation"], postconditions: ["Managed STEP ingestion", "OpenCascade validation", "immutable provenance"], executionMethod: "PINNED_PERMISSIONED_EXTERNAL_ADAPTER", dependencies: ["Python 3.12+", "cadgen==0.4.26", "build123d==0.11.1"], securityPolicy: "No user Python, arbitrary path, arbitrary arguments, viewer server, or CAE/CAM dispatch is admitted.", provenancePolicy: "Records source repository/commit, adapter-owned generator hash, external CLI output, ingested artifact hash, and validation.", testStatus: "NOT_EXECUTED", capabilityStatus: "PARTIALLY_SUPPORTED",
  },
  {
    skillId: "cad.create_cylindrical_hole.v1", name: "Create controlled cylindrical hole", description: "Previews and, only after confirmation, executes a project-authorized OpenCascade cylindrical subtraction using explicit millimetre parameters.", domain: "CAD", version: "1.0.0", supportedInputs: ["Verified STEP source file ID", "explicit diameter/depth/center/direction in mm"], requiredParameters: ["sourceFileId", "diameter", "depth", "center", "direction", "unit", "explicit confirmation"], supportedOutputs: ["Preview record", "new validated STEP artifact", "validation record", "feature provenance"], preconditions: ["Project authorization", "explicit millimetre source/parameters", "kernel preview success"], postconditions: ["New immutable STEP artifact", "source unchanged", "SHA-256 binding", "kernel validation"], executionMethod: "OPEN_CASCADE_PREVIEW_APPROVAL_INGESTION", dependencies: ["OpenCascade", "managed CAD storage", "CAD validation"], securityPolicy: "No inferred target, depth, unit conversion, or silent execution.", provenancePolicy: "Feature identity, revision, parent artifact, parameters, output artifact, and validation are persisted.", testStatus: "VERIFIED", capabilityStatus: "SUPPORTED",
  },
];

export function listCadAgentSkills() { return skills; }
function skillById(skillId: string) { const skill = skills.find((item) => item.skillId === skillId); if (!skill) throw new Error(`CAD_AGENT_SKILL_NOT_REGISTERED:${skillId}`); return skill; }

function contains(text: string, expression: RegExp) { return expression.test(text.toLowerCase()); }

function classify(message: string, assemblyEntityId?: string) {
  const text = message.trim().toLowerCase();
  if (/\b(text-to-cad|external)\b.*\b(plate|rectangular)\b|\b(rectangular|plate)\b.*\b(text-to-cad|external)\b/.test(text)) return { kind: "COMMAND" as const, safety: "REQUIRES_CONFIRMATION" as const, skill: skillById("external.text_to_cad.cad.rectangular_plate.v1"), capabilityId: "CAD.EXTERNAL.TEXT_TO_CAD.RECTANGULAR_PLATE", intent: "Generate an external text-to-cad rectangular plate", required: ["Explicit widthMm, heightMm, thicknessMm, unit mm", "Explicit confirmation", "Configured pinned adapter runtime"] };
  if (/\b(gcode|toolpath|post processor|cnc)\b/.test(text)) return { kind: "MANUFACTURING" as const, safety: "BLOCKED" as const, skill: skillById("cam.generate_gcode.v1"), capabilityId: "CAM.CREATE_TOOLPATH", intent: "Machine-specific manufacturing output", required: ["Validated machine post processor", "Tooling and manufacturing parameters"] };
  if (/\b(constraints?|degrees of freedom|dof)\b/.test(text)) return { kind: "MODIFICATION" as const, safety: "UNSUPPORTED" as const, skill: skillById("cad.inspect_artifact.v1"), capabilityId: "CAD.CREATE.CONSTRAINT", intent: "General parametric constraint solving", required: ["Constraint equations", "Supported sketch topology"] };
  if (/\b(interference|collision|clearance)\b/.test(text)) return { kind: "ANALYSIS" as const, safety: "UNSUPPORTED" as const, skill: skills[1], capabilityId: "CAD.ASSEMBLY.INTERFERENCE", intent: "Assembly interference or clearance analysis", required: ["Supported kernel collision operation and explicit component references"] };
  if (/\b(mate|joint|recline limit)\b/.test(text)) return { kind: "ANALYSIS" as const, safety: "UNSUPPORTED" as const, skill: skills[1], capabilityId: "CAD.ASSEMBLY.MATE", intent: "Assembly mate or joint solve", required: ["Stable geometry references", "Deterministic mate solver"] };
  if (/\b(generate|create|derive)\b.*\b(bom|bill of materials)\b|\b(bom|bill of materials)\b/.test(text)) return { kind: "COMMAND" as const, safety: assemblyEntityId ? "REQUIRES_CONFIRMATION" as const : "REQUIRES_PARAMETERS" as const, skill: skills[1], capabilityId: "CAD.ASSEMBLY.BOM.DERIVE", intent: "Derive assembly BOM", required: assemblyEntityId ? ["Explicit confirmation"] : ["Saved project assembly entity ID", "Explicit confirmation"] };
  if (/\b(prepare.*cae|why.*blocked|stale.*cae|required input|load case|fixture|mesh|solver)\b/.test(text)) return { kind: "VALIDATION" as const, safety: "SAFE_TO_EXECUTE" as const, skill: skills[2], capabilityId: "CAE.INPUT.READINESS", intent: "Inspect fail-closed CAE readiness", required: [] };
  if (/\b(simulat|calculix|gmsh|solve)\b/.test(text)) return { kind: "SIMULATION" as const, safety: "BLOCKED" as const, skill: skills[3], capabilityId: "CAE.RUN.CALCULIX", intent: "CAE runtime dispatch", required: skills[3].requiredParameters };
  if (/\b(import|upload)\b/.test(text)) return { kind: "IMPORT" as const, safety: "REQUIRES_PARAMETERS" as const, skill: skills[0], capabilityId: "CAD.IMPORT.STEP", intent: "Import managed engineering file", required: ["Supported file bytes", "Project authorization"] };
  if (/\b(export|step|stl|3mf|glb|dxf)\b/.test(text)) return { kind: "EXPORT" as const, safety: "REQUIRES_PARAMETERS" as const, skill: skills[0], capabilityId: "CAD.EXPORT.STEP", intent: "Export derived CAD artifact", required: ["Verified source artifact", "Supported exporter"] };
  if (/\b(create|add|modify|change|hole|backrest|cushion|frame)\b/.test(text)) return { kind: "MODIFICATION" as const, safety: "REQUIRES_PARAMETERS" as const, skill: /\bhole\b/.test(text) ? skillById("cad.create_cylindrical_hole.v1") : skillById("cad.inspect_artifact.v1"), capabilityId: "CAD.CREATE.HOLE", intent: "Controlled CAD modification or generation", required: ["Explicit supported feature", "Dimensions with units", "Authorized design/revision context"] };
  return { kind: "QUESTION" as const, safety: "SAFE_TO_EXECUTE" as const, skill: skills[0], capabilityId: "CAD.INSPECT.ARTIFACT", intent: "Inspect engineering context", required: [] };
}

export async function getCadAgentContext(args: Access) {
  const [files, assemblies, memory, registry] = await Promise.all([listCadFiles(args), listArtifactAssemblies(args), projectMemorySnapshot(args), getCapabilityRegistrySnapshot(args)]);
  return {
    projectId: args.projectId,
    authorizedCadFileCount: files.length,
    parsedCadFileCount: files.filter((file) => file.parseStatus === "PARSED").length,
    verifiedCadFileCount: files.filter((file) => file.parseStatus === "PARSED" && file.validationStatus === "VALID").length,
    persistedAssemblyCount: assemblies.filter((item) => "assembly" in item).length,
    evidenceRecordCount: memory.records.filter((record) => record.kind === "EVIDENCE" || record.kind === "CAE_EVIDENCE").length,
    capabilityRegistry: { registryVersion: registry.registryVersion, registryHash: registry.registryHash, capabilityCount: registry.capabilities.length, persistedRecordId: registry.persistedRecordId },
    controlledContext: ["Project-scoped authorization", "Persisted project memory", "Artifact hashes/revisions where available", "Fail-closed CAE gate state"],
    limitations: ["The command interface does not infer materials, loads, fixtures, boundary conditions, solver settings, tolerances, manufacturing parameters, topology semantics, mates, or physical results.", "Only registered server-side skills can execute; arbitrary generated shell commands are never accepted."],
  };
}

export async function listCadAgentCommandHistory(args: Access) {
  const snapshot = await projectMemorySnapshot(args);
  return snapshot.records.filter((record) => record.kind === "CAD_OPERATION").slice(-60).reverse();
}

export async function executeCadAgentCommand(args: Access & { message: string; assemblyEntityId?: string; confirmed?: boolean; sourceFileId?: string; holeParameters?: unknown; externalParameters?: unknown }) : Promise<CadAgentCommandResult> {
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!message || message.length > 2_000) throw new Error("CAD_AGENT_COMMAND_INVALID");
  const context = await getCadAgentContext(args);
  const assessment = classify(message, args.assemblyEntityId);
  const registry = await getCapabilityRegistrySnapshot(args);
  const capability = findCapability(assessment.capabilityId);
  if (!capability) throw new Error("CAPABILITY_REGISTRY_MISMATCH");
  const interpretation = interpretEngineeringCommand(message);
  const commandId = `CAD-AGENT-CMD-${randomUUID()}`;
  let safety: CadAgentSafety = assessment.safety;
  const isExternalPlate = assessment.skill.skillId === "external.text_to_cad.cad.rectangular_plate.v1"; const hasExternalParameters = isExternalPlate && Boolean(args.externalParameters);
  if (isExternalPlate && !hasExternalParameters) safety = "REQUIRES_PARAMETERS";
  const isHole = assessment.skill.skillId === "cad.create_cylindrical_hole.v1"; const hasStructuredHoleInput = isHole && typeof args.sourceFileId === "string" && Boolean(args.holeParameters);
  if (hasStructuredHoleInput) interpretation.missingInputs = interpretation.missingInputs.filter((item) => !["Hole diameter with unit", "Hole depth or through-all definition", "Stable target reference or coordinates"].includes(item));
  if (hasStructuredHoleInput && !interpretation.missingInputs.length) safety = "REQUIRES_CONFIRMATION";
  else if (interpretation.missingInputs.length && safety === "SAFE_TO_EXECUTE") safety = "REQUIRES_PARAMETERS";
  const operationPlan = buildEngineeringOperationPlan({ commandId, capability, interpretation, safety, requiresConfirmation: safety === "REQUIRES_CONFIRMATION" && !args.confirmed, assemblyEntityId: args.assemblyEntityId });
  let execution: CadAgentCommandResult["execution"];
  if (assessment.skill.skillId === "assembly.derive_bom.v1" && safety === "REQUIRES_CONFIRMATION" && args.confirmed) {
    const bom = await createArtifactAssemblyBom({ ...args, entityId: args.assemblyEntityId! });
    execution = { status: "EXECUTED", reason: "The confirmed registered skill derived a BOM from verified immutable component-to-STEP bindings.", output: { bomId: bom.bomId, bomHash: bom.bomHash, assemblyRevisionId: bom.assemblyRevisionId } };
  } else if (isHole && safety === "REQUIRES_CONFIRMATION" && hasStructuredHoleInput) {
    const preview = await previewCylindricalHoleAdmitted({ projectId: args.projectId, accessKey: args.accessKey, sourceFileId: args.sourceFileId!, parameters: args.holeParameters });
    if (preview.previewStatus !== "PREVIEW_READY") execution = { status: "REJECTED", reason: preview.failures.join(" ") || "The registered OpenCascade hole preview did not reach a valid ready state." };
    else if (!args.confirmed) execution = { status: "NOT_EXECUTED", reason: `OpenCascade preview ${preview.operationId} is ready; explicit confirmation is required before creating a derived STEP artifact.`, output: { featureId: preview.feature.featureId, featureRevision: preview.feature.featureRevision } };
    else { const approved = await approveCylindricalHoleAdmitted({ projectId: args.projectId, accessKey: args.accessKey, operationId: preview.operationId }); execution = { status: "EXECUTED", reason: "The confirmed registered skill executed OpenCascade cylindrical subtraction, ingested a new STEP artifact, and persisted kernel validation/provenance.", output: { artifactId: approved.result.artifact.fileId, artifactHash: approved.result.artifact.sha256, validationId: approved.result.validationId, featureId: approved.feature.featureId, featureRevision: approved.feature.featureRevision } }; }
  } else if (isExternalPlate && safety === "REQUIRES_CONFIRMATION" && hasExternalParameters && args.confirmed) {
    const external = await executeExternalTextToCadPlate(args.externalParameters);
    if (external.status !== "EXECUTABLE" || !external.stepBytes) execution = { status: "REJECTED", reason: `The pinned external adapter returned ${external.status}; no CAD-AGENT artifact was created. ${external.limitations.join(" ")}` };
    else {
      const promoted = await executeAuthorizedExternalTextToCadPlate({ projectId: args.projectId, accessKey: args.accessKey, external, actor: "CAD_AGENT" });
      execution = { status: "EXECUTED", reason: "The confirmed pinned external CAD adapter returned untrusted STEP bytes; the Common Feature Executor authorized, managed-ingested, hash-bound, validated, provenance-recorded, and revision-linked the resulting artifact.", output: { artifactId: promoted.completion.artifact.fileId, artifactHash: promoted.completion.artifact.sha256, featureId: promoted.provenanceRecordId, featureRevision: promoted.completion.artifact.revision } };
    }
  } else if (safety === "SAFE_TO_EXECUTE") {
    execution = { status: "NOT_EXECUTED", reason: "The registered skill performed an evidence/context assessment only; no engineering artifact or solver state was changed." };
  } else if (safety === "REQUIRES_CONFIRMATION") {
    execution = { status: "NOT_EXECUTED", reason: "Explicit confirmation is required before the registered operation can persist a derived artifact." };
  } else {
    execution = { status: "REJECTED", reason: safety === "BLOCKED" ? "The requested operation is blocked by the registered security and engineering gate." : "The requested operation lacks required inputs or is unsupported by the registered skill boundary." };
  }
  const explanation = `${assessment.intent}. ${execution.reason}`;
  const record = await appendPersistentMemory({
    projectId: args.projectId,
    accessKey: args.accessKey,
    record: {
      kind: "CAD_OPERATION",
      title: `${assessment.skill.name} · ${safety}`,
      content: JSON.stringify({ commandId, message, commandKind: assessment.kind, safety, skillId: assessment.skill.skillId, capabilityId: capability.capabilityId, capabilityStatus: capability.status, registryHash: registry.registryHash, interpretation, operationPlan, requiredInputs: [...assessment.required, ...interpretation.missingInputs], assemblyEntityId: args.assemblyEntityId ?? null, execution }),
      truthStatus: execution.status === "EXECUTED" ? "DERIVED" : safety === "SAFE_TO_EXECUTE" ? "DERIVED" : "UNKNOWN",
      validationStage: "CONCEPTUAL",
      relatedConfigurationId: args.assemblyEntityId,
      authorSource: "CAD_AGENT",
    },
  });
  return { commandId, commandKind: assessment.kind, safety, capability: { capabilityId: capability.capabilityId, status: capability.status, version: capability.version, engine: capability.engine, testReference: capability.testReference, knownLimitations: capability.knownLimitations }, registry: { registryId: registry.registryId, registryVersion: registry.registryVersion, registryHash: registry.registryHash, persistedRecordId: registry.persistedRecordId }, selectedSkill: { skillId: assessment.skill.skillId, name: assessment.skill.name, domain: assessment.skill.domain, capabilityStatus: assessment.skill.capabilityStatus, executionMethod: assessment.skill.executionMethod }, normalizedIntent: assessment.intent, interpretation, operationPlan, requiredInputs: [...assessment.required, ...interpretation.missingInputs], context: { projectId: args.projectId, assemblyEntityId: args.assemblyEntityId, authorizedCadFileCount: context.authorizedCadFileCount, persistedAssemblyCount: context.persistedAssemblyCount, evidenceRecordCount: context.evidenceRecordCount }, execution, provenanceRecordId: record.id, explanation };
}
