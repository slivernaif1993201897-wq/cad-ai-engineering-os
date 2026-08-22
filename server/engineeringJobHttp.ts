import type { Express, Request, Response } from "express";

import { getEngineeringJob, listEngineeringJobs, submitEngineeringJob } from "./engineeringJob";
import { openPersistentProject } from "./persistentMemory";
import { createSeatDesign, createSeatEngineeringReport, getSeatDesign, listSeatDesigns } from "./seatEngineering";

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
