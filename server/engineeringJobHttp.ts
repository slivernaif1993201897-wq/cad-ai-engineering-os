import type { Express, Request, Response } from "express";
import { createHash } from "crypto";

import { getEngineeringJob, listEngineeringJobs, submitEngineeringJob } from "./engineeringJob";
import { openPersistentProject } from "./persistentMemory";
import { createSeatDesign, createSeatDesignVerification, createSeatEngineeringReport, createSeatRevision, getSeatDesign, getSeatDesignVerification, listSeatDesigns, releaseSeatRevision } from "./seatEngineering";
import { approveSeatInputPackage, attachSeatInputEvidence, createSeatInputPackage, getSeatInputPackage, listSeatInputPackages, releaseSeatInputPackage, updateSeatInputPackage, validateSeatInputPackage } from "./seatInputPackage";
import { getSeatEngineeringTraceability, searchSeatEngineeringKnowledge } from "./seatKnowledgeBase";
import { approveSeatKnowledgeEntity, attachSeatKnowledgeEvidence, createSeatKnowledgeEntity, getSeatKnowledgeAudit, getSeatKnowledgeEntity, invalidateSeatKnowledgeRevision, listSeatKnowledgeEntities, relateSeatKnowledgeEntities, releaseSeatKnowledgeEntity, reviseSeatKnowledgeEntity, searchSeatKnowledgeRecords } from "./seatKnowledgeRecords";
import { createConceptDesign, createConceptDesignSuccessor, generateConceptCad, getConceptDesign, listEngineeringDesignTemplates, setConceptDesignParameter } from "./seatDesignAuthoring";
import { getEngineeringViewerScene } from "./engineeringViewer";
import { approveBooleanCut, approveCylindricalHoleAdmitted, createCadValidation, exportOrthographicDrawing, getCadValidation, listCadValidations, listDrawings, previewBooleanCut, previewCylindricalHoleAdmitted } from "./cadArtifactOperations";
import { executeCadAgentCommand, getCadAgentContext, listCadAgentCommandHistory, listCadAgentSkills } from "./cadAgentSkills";
import { getCapabilityRegistrySnapshot } from "./capabilityRegistry";
import { addAssemblyComponentEngineeringReference, compareArtifactAssemblyRevisions, createArtifactAssembly, createArtifactAssemblyBom, getArtifactAssembly, listArtifactAssemblies, listArtifactAssemblyBoms, listArtifactAssemblyRevisions, listAssemblyComponentEngineeringReferenceCandidates, listEligibleAssemblyCadFiles, resolveAssemblyComponentEngineeringReferences, reviseArtifactAssembly } from "./artifactAssembly";
import { executeAuthorizedCncTestPlate } from "./sourceLessCadExecution";
import { storagePut } from "./storage";
import { createPhysicalEngineeringVerification, listPhysicalEngineeringVerifications } from "./physicalVerification";
import { comparePersistedCrashSafetyEvidence, createCrashSafetyEvidence, listCrashSafetyEvidence } from "./crashSafety";
import { captureCapreCheckpoint, discoverCapre, inspectCapreCheckpoint, listCapreCheckpoints, restoreCapreToStaging, runCapreRecoveryDrill, verifyCapreCheckpoint, verifyCapreStagingRestore } from "./capreProject";

type ProjectAccess = { projectId: string; accessKey: string };

function projectAccess(req: Request): ProjectAccess | null {
  const projectId = req.header("x-engineering-project-id")?.trim();
  const accessKey = req.header("x-engineering-access-key")?.trim();
  return projectId && accessKey ? { projectId, accessKey } : null;
}

function sendAccessRequired(res: Response) {
  return res.status(401).json({ error: "PROJECT_ACCESS_REQUIRED" });
}

function isAccessFailure(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("access") || normalized.includes("denied");
}

async function jobForRequest(req: Request, res: Response) {
  const access = projectAccess(req);
  if (!access) return { access: null, job: null, handled: sendAccessRequired(res) };
  try {
    const job = await getEngineeringJob({ ...access, jobId: req.params.jobId });
    if (!job) return { access, job: null, handled: res.status(404).json({ error: "ENGINEERING_JOB_NOT_FOUND" }) };
    return { access, job, handled: null };
  } catch {
    return { access, job: null, handled: res.status(403).json({ error: "PROJECT_ACCESS_DENIED" }) };
  }
}

export function registerEngineeringJobHttp(app: Express) {
  app.post("/api/projects", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 160) return res.status(400).json({ error: "INVALID_PROJECT_NAME" });
    const project = await openPersistentProject({ name });
    // The access key is returned only to the project creator; subsequent requests send it in a header, never a URL.
    return res.status(201).json({ projectId: project.id, name: project.name, accessKey: project.accessKey });
  });
  app.get("/api/projects/:projectId/capre/discover", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await discoverCapre({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_DISCOVER_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/capre/checkpoints", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listCapreCheckpoints({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_LIST_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/capre/capture", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await captureCapreCheckpoint({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_CAPTURE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/capre/checkpoints/:checkpointId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await inspectCapreCheckpoint({ projectId: req.params.projectId, accessKey, checkpointId: req.params.checkpointId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_INSPECT_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/capre/checkpoints/:checkpointId/verify", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await verifyCapreCheckpoint({ projectId: req.params.projectId, accessKey, checkpointId: req.params.checkpointId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_VERIFY_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/capre/checkpoints/:checkpointId/restore-staging", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await restoreCapreToStaging({ projectId: req.params.projectId, accessKey, checkpointId: req.params.checkpointId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_RESTORE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/capre/staging/:stagingId/verify", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await verifyCapreStagingRestore({ projectId: req.params.projectId, accessKey, stagingId: req.params.stagingId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_VERIFY_RESTORE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/capre/recovery-drill", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await runCapreRecoveryDrill({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPRE_RECOVERY_DRILL_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-agent/context", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getCadAgentContext({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_AGENT_CONTEXT_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-agent/skills", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { await getCadAgentContext({ projectId: req.params.projectId, accessKey }); return res.json(listCadAgentSkills()); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_AGENT_SKILLS_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/capabilities", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getCapabilityRegistrySnapshot({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAPABILITY_REGISTRY_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-agent/history", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listCadAgentCommandHistory({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_AGENT_HISTORY_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-agent/commands", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await executeCadAgentCommand({ projectId: req.params.projectId, accessKey, message: req.body?.message, assemblyEntityId: req.body?.assemblyEntityId, confirmed: req.body?.confirmed === true, sourceFileId: req.body?.sourceFileId, holeParameters: req.body?.holeParameters, externalParameters: req.body?.externalParameters })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_AGENT_COMMAND_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-operations/source-less/cnc-test-plate", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    const requestedProjectId = req.header("x-engineering-project-id")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    if (requestedProjectId && requestedProjectId !== req.params.projectId) return res.status(403).json({ error: "PROJECT_ACCESS_DENIED" });
    try { return res.status(201).json(await executeAuthorizedCncTestPlate({ projectId: req.params.projectId, accessKey, actor: "USER" })); }
    catch (error) { const message = error instanceof Error ? error.message : "SOURCELESS_CNC_EXECUTION_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/jobs", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      const job = await submitEngineeringJob({ projectId: req.params.projectId, accessKey, request: req.body });
      return res.status(job.state === "REJECTED" ? 422 : 201).json(job);
    } catch {
      return res.status(403).json({ error: "PROJECT_ACCESS_DENIED" });
    }
  });

  app.get("/api/projects/:projectId/jobs", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await listEngineeringJobs({ projectId: req.params.projectId, accessKey }));
    } catch {
      return res.status(403).json({ error: "PROJECT_ACCESS_DENIED" });
    }
  });

  app.post("/api/projects/:projectId/seat-designs", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.status(201).json(await createSeatDesign({ projectId: req.params.projectId, accessKey, input: req.body }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_DESIGN_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/seat-designs", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await listSeatDesigns({ projectId: req.params.projectId, accessKey }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_DESIGN_READ_FAILED";
      return res.status(isAccessFailure(message) ? 403 : 503).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/seat-designs/:seatDesignId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await getSeatDesign({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_DESIGN_READ_FAILED";
      return res.status(isAccessFailure(message) ? 403 : message === "SEAT_DESIGN_NOT_FOUND" ? 404 : 503).json({ error: message });
    }
  });

  app.get("/api/design-templates", (_req, res) => res.json(listEngineeringDesignTemplates()));
  app.post("/api/projects/:projectId/concept-designs", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createConceptDesign({ projectId: req.params.projectId, accessKey, templateId: req.body?.templateId, name: req.body?.name, description: req.body?.description })); }
    catch (error) { const message = error instanceof Error ? error.message : "CONCEPT_DESIGN_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/concept-design", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getConceptDesign({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CONCEPT_DESIGN_READ_FAILED"; return res.status(isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 422).json({ error: message }); }
  });
  app.put("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/concept-design/parameters/:parameterName", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await setConceptDesignParameter({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId, parameterName: req.params.parameterName, value: req.body?.value, unit: req.body?.unit })); }
    catch (error) { const message = error instanceof Error ? error.message : "CONCEPT_PARAMETER_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/concept-design/generate-cad", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await generateConceptCad({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CONCEPT_CAD_REJECTED"; return res.status(isAccessFailure(message) ? 403 : message.includes("REQUIRED") ? 422 : 503).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-files/:fileId/viewer-scene", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getEngineeringViewerScene({ projectId: req.params.projectId, accessKey, fileId: req.params.fileId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_VIEWER_UNAVAILABLE"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-files/:fileId/validations", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createCadValidation({ projectId: req.params.projectId, accessKey, fileId: req.params.fileId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_VALIDATION_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-files/:fileId/validations", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    const revision = typeof req.query.revision === "string" && /^\d+$/.test(req.query.revision) ? Number(req.query.revision) : undefined;
    try { return res.json(await listCadValidations({ projectId: req.params.projectId, accessKey, fileId: req.params.fileId, revision })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_VALIDATION_LIST_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-validations/:validationId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getCadValidation({ projectId: req.params.projectId, accessKey, validationId: req.params.validationId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CAD_VALIDATION_READ_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 404).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-operations/boolean-cut/preview", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { const preview = await previewBooleanCut({ projectId: req.params.projectId, accessKey, sourceFileId: req.body?.sourceFileId, cutterFileId: req.body?.cutterFileId }); return res.status(preview.previewStatus === "PREVIEW_READY" ? 201 : 422).json(preview); }
    catch (error) { const message = error instanceof Error ? error.message : "BOOLEAN_PREVIEW_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-operations/boolean-cut/:operationId/approve", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await approveBooleanCut({ projectId: req.params.projectId, accessKey, operationId: req.params.operationId })); }
    catch (error) { const message = error instanceof Error ? error.message : "BOOLEAN_OPERATION_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-operations/cylindrical-hole/preview", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { const preview = await previewCylindricalHoleAdmitted({ projectId: req.params.projectId, accessKey, sourceFileId: req.body?.sourceFileId, parameters: req.body?.parameters, featureId: req.body?.featureId, featureRevision: req.body?.featureRevision }); return res.status(preview.previewStatus === "PREVIEW_READY" ? 201 : 422).json(preview); }
    catch (error) { const message = error instanceof Error ? error.message : "HOLE_PREVIEW_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-operations/cylindrical-hole/:operationId/approve", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await approveCylindricalHoleAdmitted({ projectId: req.params.projectId, accessKey, operationId: req.params.operationId })); }
    catch (error) { const message = error instanceof Error ? error.message : "HOLE_OPERATION_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/cad-files/:fileId/drawings", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await exportOrthographicDrawing({ projectId: req.params.projectId, accessKey, fileId: req.params.fileId, validationId: req.body?.validationId, view: req.body?.view })); }
    catch (error) { const message = error instanceof Error ? error.message : "DRAWING_EXPORT_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/cad-files/:fileId/drawings", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listDrawings({ projectId: req.params.projectId, accessKey, fileId: req.params.fileId })); }
    catch (error) { const message = error instanceof Error ? error.message : "DRAWING_LIST_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/assemblies", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createArtifactAssembly({ projectId: req.params.projectId, accessKey, name: req.body?.name, components: req.body?.components, constraints: req.body?.constraints, seatDesignId: req.body?.seatDesignId, seatRevisionId: req.body?.seatRevisionId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_CREATE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/eligible-cad-files", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listEligibleAssemblyCadFiles({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_CAD_PICKER_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listArtifactAssemblies({ projectId: req.params.projectId, accessKey })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_LIST_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getArtifactAssembly({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_READ_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/assemblies/:entityId/bom", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createArtifactAssemblyBom({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_BOM_CREATE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId/bom", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listArtifactAssemblyBoms({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_BOM_LIST_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId/revisions", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listArtifactAssemblyRevisions({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_HISTORY_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId/compare/:otherEntityId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await compareArtifactAssemblyRevisions({ projectId: req.params.projectId, accessKey, fromEntityId: req.params.entityId, toEntityId: req.params.otherEntityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_COMPARISON_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/assemblies/:entityId/revise", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await reviseArtifactAssembly({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, name: req.body?.name, components: req.body?.components, constraints: req.body?.constraints, reason: req.body?.reason })); }
    catch (error) { const message = error instanceof Error ? error.message : "ASSEMBLY_REVISION_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId/components/:componentId/engineering-references/candidates", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listAssemblyComponentEngineeringReferenceCandidates({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, componentId: req.params.componentId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ENGINEERING_REFERENCE_CANDIDATES_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/assemblies/:entityId/components/:componentId/engineering-references", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await resolveAssemblyComponentEngineeringReferences({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, componentId: req.params.componentId })); }
    catch (error) { const message = error instanceof Error ? error.message : "ENGINEERING_REFERENCE_RESOLUTION_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/assemblies/:entityId/components/:componentId/engineering-references", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await addAssemblyComponentEngineeringReference({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, componentId: req.params.componentId, referenceId: req.body?.referenceId, reason: req.body?.reason })); }
    catch (error) { const message = error instanceof Error ? error.message : "ENGINEERING_REFERENCE_PERSIST_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/concept-design/successor", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim(); if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createConceptDesignSuccessor({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId })); }
    catch (error) { const message = error instanceof Error ? error.message : "CONCEPT_SUCCESSOR_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/seat-designs/:seatDesignId/revisions", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.status(201).json(await createSeatRevision({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, input: req.body }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_REVISION_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : message === "SEAT_DESIGN_NOT_FOUND" ? 404 : 422).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/release", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await releaseSeatRevision({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_RELEASE_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 422).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/verification", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.status(201).json(await createSeatDesignVerification({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId, input: req.body }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_VERIFICATION_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/seat-designs/:seatDesignId/revisions/:revisionId/verification", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      const verification = await getSeatDesignVerification({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId: req.params.revisionId });
      return verification ? res.json(verification) : res.status(404).json({ error: "SEAT_VERIFICATION_NOT_FOUND" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_VERIFICATION_READ_FAILED";
      return res.status(isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 503).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/seat-input-packages", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      const seat = await getSeatDesign({ projectId: req.params.projectId, accessKey, seatDesignId: req.body?.seatDesignId });
      if (!seat.revisions.some((revision) => revision.id === req.body?.seatRevisionId)) throw new Error("SEAT_REVISION_NOT_FOUND");
      return res.status(201).json(await createSeatInputPackage({ projectId: req.params.projectId, accessKey, input: req.body }));
    }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/seat-designs/:seatDesignId/input-packages", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listSeatInputPackages({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, seatRevisionId: typeof req.query.revisionId === "string" ? req.query.revisionId : undefined })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_READ_FAILED"; return res.status(isAccessFailure(message) ? 403 : 503).json({ error: message }); }
  });
  app.get("/api/projects/:projectId/seat-input-packages/:packageId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getSeatInputPackage({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_READ_FAILED"; return res.status(isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 503).json({ error: message }); }
  });
  app.put("/api/projects/:projectId/seat-input-packages/:packageId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await updateSeatInputPackage({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId, fields: req.body?.fields })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_UPDATE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-input-packages/:packageId/evidence", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await attachSeatInputEvidence({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId, fileName: req.body?.fileName, mimeType: req.body?.mimeType, base64: req.body?.base64 })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_EVIDENCE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-input-packages/:packageId/validate", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await validateSeatInputPackage({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_VALIDATE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-input-packages/:packageId/approve", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await approveSeatInputPackage({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_APPROVE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });
  app.post("/api/projects/:projectId/seat-input-packages/:packageId/release", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await releaseSeatInputPackage({ projectId: req.params.projectId, accessKey, packageId: req.params.packageId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEAT_INPUT_PACKAGE_RELEASE_REJECTED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.get("/api/projects/:projectId/seat-designs/:seatDesignId/report", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId : undefined;
    try {
      return res.json(await createSeatEngineeringReport({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, jobId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_REPORT_READ_FAILED";
      return res.status(isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 503).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/physical-verifications", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    if (!req.body?.input || typeof req.body.input !== "object") return res.status(422).json({ error: "PHYSICAL_VERIFICATION_INPUT_REQUIRED" });
    try {
      return res.status(201).json(await createPhysicalEngineeringVerification({ projectId: req.params.projectId, accessKey, jobId: typeof req.body?.jobId === "string" ? req.body.jobId : undefined, input: req.body?.input }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "PHYSICAL_VERIFICATION_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/physical-verifications", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      const jobId = typeof req.query.jobId === "string" ? req.query.jobId : undefined;
      return res.json(await listPhysicalEngineeringVerifications({ projectId: req.params.projectId, accessKey, jobId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "PHYSICAL_VERIFICATION_READ_FAILED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : 422).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/crash-safety-evidence", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    if (!req.body?.input || typeof req.body.input !== "object") return res.status(422).json({ error: "CRASH_SAFETY_INPUT_REQUIRED" });
    try {
      return res.status(201).json(await createCrashSafetyEvidence({ projectId: req.params.projectId, accessKey, input: req.body.input }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRASH_SAFETY_EVIDENCE_REJECTED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/crash-safety-evidence", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await listCrashSafetyEvidence({ projectId: req.params.projectId, accessKey }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRASH_SAFETY_EVIDENCE_READ_FAILED";
      return res.status(message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : isAccessFailure(message) ? 403 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/crash-safety-evidence/compare/:baselineRecordId/:proposedRecordId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try {
      return res.json(await comparePersistedCrashSafetyEvidence({ projectId: req.params.projectId, accessKey, baselineRecordId: req.params.baselineRecordId, proposedRecordId: req.params.proposedRecordId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRASH_SAFETY_COMPARISON_REJECTED";
      return res.status(message.includes("NOT_FOUND") ? 404 : isAccessFailure(message) ? 403 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/seat-designs/:seatDesignId/traceability", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    const revisionId = typeof req.query.revisionId === "string" ? req.query.revisionId : undefined;
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId : undefined;
    try {
      return res.json(await getSeatEngineeringTraceability({ projectId: req.params.projectId, accessKey, seatDesignId: req.params.seatDesignId, revisionId, jobId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEAT_TRACEABILITY_READ_FAILED";
      return res.status(isAccessFailure(message) ? 403 : message.includes("NOT_FOUND") ? 404 : 422).json({ error: message });
    }
  });

  app.get("/api/projects/:projectId/engineering-search", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    const query = typeof req.query.q === "string" ? req.query.q : "";
    try {
      return res.json(await searchSeatEngineeringKnowledge({ projectId: req.params.projectId, accessKey, query }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "ENGINEERING_SEARCH_FAILED";
      return res.status(isAccessFailure(message) ? 403 : message === "INVALID_ENGINEERING_SEARCH_QUERY" ? 422 : 503).json({ error: message });
    }
  });

  app.post("/api/projects/:projectId/sekb/entities", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await createSeatKnowledgeEntity({ projectId: req.params.projectId, accessKey, input: req.body })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_CREATE_FAILED"; return res.status(isAccessFailure(message) ? 403 : message === "PERSISTENT_DATABASE_REQUIRED" ? 503 : 422).json({ error: message }); }
  });

  app.get("/api/projects/:projectId/sekb/entities", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await listSeatKnowledgeEntities({ projectId: req.params.projectId, accessKey, entityType: typeof req.query.type === "string" ? req.query.type as never : undefined, status: typeof req.query.status === "string" ? req.query.status as never : undefined, seatDesignId: typeof req.query.seatDesignId === "string" ? req.query.seatDesignId : undefined, seatRevisionId: typeof req.query.seatRevisionId === "string" ? req.query.seatRevisionId : undefined, limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined, offset: typeof req.query.offset === "string" ? Number(req.query.offset) : undefined })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_LIST_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.get("/api/projects/:projectId/sekb/entities/:entityId", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getSeatKnowledgeEntity({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_READ_FAILED"; return res.status(isAccessFailure(message) ? 403 : message === "SEKB_ENTITY_NOT_FOUND" ? 404 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/entities/:entityId/revise", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await reviseSeatKnowledgeEntity({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, input: req.body })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_REVISION_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/entities/:entityId/approve", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await approveSeatKnowledgeEntity({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, actor: req.body?.actor, reason: req.body?.reason })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_APPROVAL_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/entities/:entityId/release", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await releaseSeatKnowledgeEntity({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, actor: req.body?.actor, reason: req.body?.reason })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ENTITY_RELEASE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/relations", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await relateSeatKnowledgeEntities({ projectId: req.params.projectId, accessKey, ...req.body })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_RELATION_CREATE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/entities/:entityId/attachments", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.status(201).json(await attachSeatKnowledgeEvidence({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, ...req.body })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_ATTACHMENT_CREATE_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/entities/:entityId/attachments/upload", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
    const mediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType.trim() : "application/octet-stream";
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    const sourceReference = typeof req.body?.sourceReference === "string" ? req.body.sourceReference.trim() : "";
    const actor = typeof req.body?.actor === "string" ? req.body.actor.trim() : "";
    if (!fileName || !base64 || !sourceReference || !actor) return res.status(422).json({ error: "SEKB_ATTACHMENT_UPLOAD_FIELDS_REQUIRED" });
    try {
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) return res.status(422).json({ error: "SEKB_ATTACHMENT_SIZE_INVALID" });
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const stored = await storagePut(`sekb/${req.params.projectId}/${req.params.entityId}/${fileName}`, bytes, mediaType);
      return res.status(201).json(await attachSeatKnowledgeEvidence({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId, fileName, mediaType, storageReference: stored.url, sha256, sourceReference, actor }));
    } catch (error) { const message = error instanceof Error ? error.message : "SEKB_ATTACHMENT_UPLOAD_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.get("/api/projects/:projectId/sekb/entities/:entityId/audit", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await getSeatKnowledgeAudit({ projectId: req.params.projectId, accessKey, entityId: req.params.entityId })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_AUDIT_READ_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.get("/api/projects/:projectId/sekb/search", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await searchSeatKnowledgeRecords({ projectId: req.params.projectId, accessKey, query: typeof req.query.q === "string" ? req.query.q : "", entityType: typeof req.query.type === "string" ? req.query.type as never : undefined, status: typeof req.query.status === "string" ? req.query.status as never : undefined, limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_SEARCH_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.post("/api/projects/:projectId/sekb/revisions/invalidate", async (req, res) => {
    const accessKey = req.header("x-engineering-access-key")?.trim();
    if (!accessKey) return sendAccessRequired(res);
    try { return res.json(await invalidateSeatKnowledgeRevision({ projectId: req.params.projectId, accessKey, ...req.body })); }
    catch (error) { const message = error instanceof Error ? error.message : "SEKB_INVALIDATION_FAILED"; return res.status(isAccessFailure(message) ? 403 : 422).json({ error: message }); }
  });

  app.get("/api/jobs/:jobId", async (req, res) => {
    const resolved = await jobForRequest(req, res);
    return resolved.job ? res.json(resolved.job) : resolved.handled;
  });

  app.get("/api/jobs/:jobId/status", async (req, res) => {
    const resolved = await jobForRequest(req, res);
    return resolved.job ? res.json({ jobId: resolved.job.jobId, state: resolved.job.state, runtimeDispatch: resolved.job.runtimeDispatch, updatedAt: resolved.job.updatedAt, events: resolved.job.events }) : resolved.handled;
  });

  app.get("/api/jobs/:jobId/mesh", async (req, res) => {
    const resolved = await jobForRequest(req, res);
    if (!resolved.job) return resolved.handled;
    return resolved.job.runtimeEvidence
      ? res.json({ jobId: resolved.job.jobId, available: true, gmshHash: resolved.job.runtimeEvidence.gmshHash, meshHash: resolved.job.runtimeEvidence.meshHash, executionLogHash: resolved.job.runtimeEvidence.executionLogHash })
      : res.status(409).json({ jobId: resolved.job.jobId, available: false, error: "VERIFIED_RUNTIME_MESH_UNAVAILABLE" });
  });

  app.get("/api/jobs/:jobId/result", async (req, res) => {
    const resolved = await jobForRequest(req, res);
    if (!resolved.job) return resolved.handled;
    return resolved.job.runtimeEvidence
      ? res.json({ jobId: resolved.job.jobId, available: true, calculixHash: resolved.job.runtimeEvidence.calculixHash, inputHash: resolved.job.runtimeEvidence.inputHash, outputHash: resolved.job.runtimeEvidence.outputHash, resultHash: resolved.job.runtimeEvidence.resultHash, evidenceHash: resolved.job.runtimeEvidence.evidenceHash })
      : res.status(409).json({ jobId: resolved.job.jobId, available: false, error: "VERIFIED_RUNTIME_RESULT_UNAVAILABLE" });
  });

  app.get("/api/jobs/:jobId/evidence", async (req, res) => {
    const resolved = await jobForRequest(req, res);
    return resolved.job ? res.json({ jobId: resolved.job.jobId, manifestHash: resolved.job.manifest?.manifestHash, runtimeEvidence: resolved.job.runtimeEvidence ?? null, events: resolved.job.events }) : resolved.handled;
  });

  app.post("/api/jobs/:jobId/:artifact(mesh|result|evidence|reconcile)", (_req, res) => {
    return res.status(405).json({ error: "CLIENT_RUNTIME_ARTIFACT_SUBMISSION_FORBIDDEN" });
  });
}
