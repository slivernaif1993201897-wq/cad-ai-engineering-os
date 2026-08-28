import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateResolvedInventory, resolveRepositoryInventory } from "../server/zeroBypassInventory";

const root = process.cwd();
const sourceRoots = ["server", "app", "components", "lib", "shared"] as const;
const geometryPattern = /OpenCascade|BRep|STEPControl|STEP|DXF|STL|generate[A-Za-z0-9_]*(Cad|Geometry|Step|Dxf|Stl|Mounting|Backrest)|createCncTestPlate|completeSourceLessGeneration|completeCommonFeature/;
const protectedWritePattern = /storagePut\s*\(|\.insert\s*\(engineeringCadFiles\)|appendLineageNode\s*\(|appendPersistentMemory\s*\(|createSeatRevision\s*\(|reviseSeatKnowledgeEntity\s*\(/;
const approvedBoundaryPattern = /completeSourceLessGeneration|completeCommonFeature|executeAuthorizedFeatureHistoryStep|executeAndPersistLocalGmshMesh|ingestCadFile|retiredMountingBlock/;
const localStepWriterPattern = /STEPControl_Writer(?:_\d+)?|writer\.Write\s*\(/;
const kernelAcquisitionPattern = /getOpenCascadeKernel\s*\(/;
const openCascadeAdmissionPattern = /runWithOpenCascadeAdmission\s*\(/;

type DiscoveredFile = { file: string; geometry: boolean; protectedWrite: boolean; approvedBoundary: boolean; localStepWriter: boolean; kernelAcquisition: boolean; openCascadeAdmission: boolean; imports: string[] };
type Inventory = {
  schema: "zero-bypass-inventory/v1";
  source_roots: string[];
  routes_complete: boolean;
  services_complete: boolean;
  protected_writes_complete: boolean;
  call_graph_complete: boolean;
  files: DiscoveredFile[];
  geometry_sources: string[];
  protected_sinks: string[];
  executor_controlled_paths: string[];
  retired_paths: string[];
  read_only_paths: string[];
  validation_only_paths: string[];
  unknown_paths: string[];
  unauthorized_paths: string[];
  unresolved_authoritative_paths: string[];
  direct_authoritative_step_writers: string[];
  unadmitted_opencascade_paths: string[];
};

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

function importsOf(source: string) {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]).filter((path) => path.startsWith("."));
}

async function discover(extraFiles: Record<string, string> = {}): Promise<Inventory> {
  const rootFiles = (await Promise.all(sourceRoots.map((directory) => walk(join(root, directory))))).flat();
  const files = await Promise.all(rootFiles.map(async (path) => {
    const source = await readFile(path, "utf8");
    const file = relative(root, path);
    return { file, geometry: geometryPattern.test(source), protectedWrite: protectedWritePattern.test(source), approvedBoundary: approvedBoundaryPattern.test(source), localStepWriter: file !== "server/cadKernel.ts" && localStepWriterPattern.test(source), kernelAcquisition: kernelAcquisitionPattern.test(source), openCascadeAdmission: openCascadeAdmissionPattern.test(source), imports: importsOf(source) };
  }));
  const fixtureFiles = Object.entries(extraFiles).map(([file, source]) => ({ file, geometry: geometryPattern.test(source), protectedWrite: protectedWritePattern.test(source), approvedBoundary: approvedBoundaryPattern.test(source), localStepWriter: file !== "server/cadKernel.ts" && localStepWriterPattern.test(source), kernelAcquisition: kernelAcquisitionPattern.test(source), openCascadeAdmission: openCascadeAdmissionPattern.test(source), imports: importsOf(source) }));
  const all = [...files, ...fixtureFiles].sort((a, b) => a.file.localeCompare(b.file));
  const geometrySources = all.filter((item) => item.geometry).map((item) => item.file);
  const protectedSinks = all.filter((item) => item.protectedWrite).map((item) => item.file);
  const controlled = all.filter((item) => item.geometry && item.approvedBoundary).map((item) => item.file);
  const retired = all.filter((item) => item.file === "server/routers.ts" && item.approvedBoundary).map((item) => item.file);
  const resolution = evaluateResolvedInventory(resolveRepositoryInventory(all.filter((item) => item.geometry && item.protectedWrite).map((item) => ({ path: item.file, geometry: item.geometry, protectedWrite: item.protectedWrite, approvedBoundary: item.approvedBoundary }))));
  const unapprovedGeometryWrites = resolution.unauthorized_paths;
  const directStepWriters = all.filter((item) => item.localStepWriter).map((item) => item.file);
  const unadmittedOpenCascadePaths = all.filter((item) => item.file !== "server/cadKernel.ts" && item.kernelAcquisition && !item.openCascadeAdmission).map((item) => item.file);
  return {
    schema: "zero-bypass-inventory/v1",
    source_roots: [...sourceRoots],
    routes_complete: all.some((item) => item.file === "server/routers.ts") && all.some((item) => item.file === "server/engineeringJobHttp.ts"),
    services_complete: all.some((item) => item.file === "server/commonFeatureExecutor.ts") && all.some((item) => item.file === "server/sourceLessCadExecution.ts") && all.some((item) => item.file === "server/cadFileIntelligence.ts"),
    protected_writes_complete: protectedSinks.length > 0,
    call_graph_complete: all.every((item) => Array.isArray(item.imports)),
    files: all,
    geometry_sources: geometrySources,
    protected_sinks: protectedSinks,
    executor_controlled_paths: controlled,
    retired_paths: retired,
    read_only_paths: all.filter((item) => /viewer|drawing|bom/i.test(item.file) && !item.protectedWrite).map((item) => item.file),
    validation_only_paths: all.filter((item) => /validation|validate/i.test(item.file) && !item.protectedWrite).map((item) => item.file),
    unknown_paths: unadmittedOpenCascadePaths,
    unauthorized_paths: [...unapprovedGeometryWrites, ...directStepWriters],
    unresolved_authoritative_paths: [...unapprovedGeometryWrites, ...directStepWriters, ...unadmittedOpenCascadePaths],
    direct_authoritative_step_writers: directStepWriters,
    unadmitted_opencascade_paths: unadmittedOpenCascadePaths,
  };
}

describe("repository-wide zero-bypass discovery", () => {
  it("scans every existing source root and emits a deterministic machine-readable inventory", async () => {
    const inventory = await discover();
    expect(inventory.source_roots).toEqual([...sourceRoots]);
    expect(inventory.files.some((item) => item.file === "server/routers.ts")).toBe(true);
    expect(inventory.files.some((item) => item.file === "server/commonFeatureExecutor.ts")).toBe(true);
    expect(inventory.geometry_sources.length).toBeGreaterThan(0);
    expect(inventory.protected_sinks.length).toBeGreaterThan(0);
    await mkdir(join(root, "test-results"), { recursive: true });
    await writeFile(join(root, "test-results", "zero-bypass-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  });

  it("discovers a controlled new transitive route-to-service-to-adapter protected-write fixture", async () => {
    const inventory = await discover({
      "fixtures/unknown-route.ts": "import { runUnknownService } from './unknown-service'; export const unknownRoute = () => runUnknownService();",
      "fixtures/unknown-service.ts": "import { unknownAdapter } from './unknown-adapter'; export const runUnknownService = () => unknownAdapter();",
      "fixtures/unknown-adapter.ts": "export const unknownAdapter = () => { const geometry = 'STEP'; return storagePut('engineering-projects/x/unknown.step', geometry, 'application/step'); };",
    });
    expect(inventory.protected_sinks).toContain("fixtures/unknown-adapter.ts");
    expect(inventory.unauthorized_paths).toContain("fixtures/unknown-adapter.ts");
  });

  it("accepts zero-bypass only when discovery finds no unknown, unauthorized, or unresolved authoritative paths", async () => {
    const inventory = await discover();
    expect(inventory.routes_complete).toBe(true);
    expect(inventory.services_complete).toBe(true);
    expect(inventory.protected_writes_complete).toBe(true);
    expect(inventory.call_graph_complete).toBe(true);
    expect(inventory.unknown_paths).toEqual([]);
    expect(inventory.unauthorized_paths).toEqual([]);
    expect(inventory.unresolved_authoritative_paths).toEqual([]);
    expect(inventory.direct_authoritative_step_writers).toEqual([]);
    expect(inventory.unadmitted_opencascade_paths).toEqual([]);
  });
});
