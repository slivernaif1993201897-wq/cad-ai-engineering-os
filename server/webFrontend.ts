import express, { type Express, type Request } from "express";
import { existsSync } from "fs";
import { resolve } from "path";

const PROTECTED_PREFIXES = ["/api/", "/manus-storage/"];

export function productionWebRoot(cwd = process.cwd()) {
  return resolve(cwd, "dist", "client");
}

export function canServeWebFallback(request: Pick<Request, "method" | "path" | "headers">) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (PROTECTED_PREFIXES.some((prefix) => request.path.startsWith(prefix))) return false;
  const accept = request.headers.accept ?? "";
  return accept.includes("text/html") || request.path === "/";
}

/**
 * Serves the already-built Expo Web export only when it exists. API and storage
 * routes remain registered first and are never rewritten to the SPA document.
 */
export function registerProductionWebFrontend(app: Express, cwd = process.cwd()) {
  const root = productionWebRoot(cwd);
  const indexFile = resolve(root, "index.html");
  if (!existsSync(indexFile)) return { enabled: false as const, root };
  app.use(express.static(root, { index: false, fallthrough: true, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (!canServeWebFallback(req)) return next();
    res.sendFile(indexFile, (error) => { if (error) next(error); });
  });
  return { enabled: true as const, root };
}
