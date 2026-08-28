import { createHash } from "node:crypto";

export type Unit2D = "mm";
export type Line2D = { id: string; type: "LINE"; x1: number; y1: number; x2: number; y2: number; unit: Unit2D };
export type Circle2D = { id: string; type: "CIRCLE"; cx: number; cy: number; radius: number; unit: Unit2D };
export type Entity2D = Line2D | Circle2D;
export type Design2D = { designId: string; unit: Unit2D; entities: Entity2D[]; designHash: string };
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const n = (value: number) => Number(value.toFixed(9));

export function createCncTestPlate(firstHoleX = 25): Design2D {
  const unit: Unit2D = "mm";
  const entities: Entity2D[] = [
    { id: "outer-1", type: "LINE", x1: 0, y1: 0, x2: 300, y2: 0, unit },
    { id: "outer-2", type: "LINE", x1: 300, y1: 0, x2: 300, y2: 200, unit },
    { id: "outer-3", type: "LINE", x1: 300, y1: 200, x2: 0, y2: 200, unit },
    { id: "outer-4", type: "LINE", x1: 0, y1: 200, x2: 0, y2: 0, unit },
    { id: "hole-1", type: "CIRCLE", cx: firstHoleX, cy: 25, radius: 6, unit },
    { id: "hole-2", type: "CIRCLE", cx: 275, cy: 25, radius: 6, unit },
    { id: "hole-3", type: "CIRCLE", cx: 275, cy: 175, radius: 6, unit },
    { id: "hole-4", type: "CIRCLE", cx: 25, cy: 175, radius: 6, unit },
  ];
  return { designId: `CNC-TEST-PLATE-${sha(JSON.stringify(entities)).slice(0, 16)}`, unit, entities, designHash: sha(JSON.stringify(entities)) };
}

export function validateDesign2D(design: Design2D) {
  const lines = design.entities.filter((entity): entity is Line2D => entity.type === "LINE");
  const circles = design.entities.filter((entity): entity is Circle2D => entity.type === "CIRCLE");
  const failures: string[] = [];
  if (design.unit !== "mm" || design.entities.some((entity) => entity.unit !== "mm")) failures.push("UNIT_INCONSISTENT");
  if (lines.length !== 4 || circles.length !== 4 || design.entities.length !== 8) failures.push("ENTITY_COUNTS_INVALID");
  if (lines.some((line) => line.x1 === line.x2 && line.y1 === line.y2)) failures.push("ZERO_LENGTH_LINE");
  if (circles.some((circle) => circle.radius <= 0)) failures.push("INVALID_CIRCLE_RADIUS");
  const closed = lines.length === 4 && lines.every((line, index) => { const next = lines[(index + 1) % 4]; return line.x2 === next.x1 && line.y2 === next.y1; });
  if (!closed) failures.push("OUTER_PROFILE_OPEN");
  const keys = design.entities.map((entity) => JSON.stringify(entity.type === "LINE" ? [entity.type, entity.x1, entity.y1, entity.x2, entity.y2] : [entity.type, entity.cx, entity.cy, entity.radius]));
  if (new Set(keys).size !== keys.length) failures.push("DUPLICATE_ENTITY");
  return { status: failures.length ? "FAIL" as const : "PASS" as const, closedOuterProfile: closed, entityCounts: { lines: lines.length, circles: circles.length, total: design.entities.length }, failures };
}

export function exportDxf(design: Design2D): Buffer {
  if (validateDesign2D(design).status !== "PASS") throw new Error("2D_DESIGN_VALIDATION_FAILED");
  const pairs = (code: number, value: string | number) => `${code}\n${value}\n`;
  let dxf = `${pairs(0, "SECTION")}${pairs(2, "HEADER")}${pairs(9, "$INSUNITS")}${pairs(70, 4)}${pairs(0, "ENDSEC")}${pairs(0, "SECTION")}${pairs(2, "ENTITIES")}`;
  for (const entity of design.entities) {
    if (entity.type === "LINE") dxf += `${pairs(0, "LINE")}${pairs(8, "CAD_AGENT_2D")}${pairs(10, entity.x1)}${pairs(20, entity.y1)}${pairs(30, 0)}${pairs(11, entity.x2)}${pairs(21, entity.y2)}${pairs(31, 0)}`;
    else dxf += `${pairs(0, "CIRCLE")}${pairs(8, "CAD_AGENT_2D")}${pairs(10, entity.cx)}${pairs(20, entity.cy)}${pairs(30, 0)}${pairs(40, entity.radius)}`;
  }
  dxf += `${pairs(0, "ENDSEC")}${pairs(0, "EOF")}`;
  return Buffer.from(dxf, "utf8");
}

export function importDxf(bytes: Buffer): Design2D {
  const tokens = bytes.toString("utf8").trim().split(/\r?\n/); const entities: Entity2D[] = []; let index = 0; let current: Record<string, string> | undefined; let type = "";
  const flush = () => { if (!current || !type) return; if (type === "LINE") entities.push({ id: `line-${entities.length + 1}`, type, x1: Number(current["10"]), y1: Number(current["20"]), x2: Number(current["11"]), y2: Number(current["21"]), unit: "mm" }); if (type === "CIRCLE") entities.push({ id: `circle-${entities.length + 1}`, type, cx: Number(current["10"]), cy: Number(current["20"]), radius: Number(current["40"]), unit: "mm" }); };
  while (index + 1 < tokens.length) { const code = tokens[index++]; const value = tokens[index++]; if (code === "0") { flush(); type = value; current = value === "LINE" || value === "CIRCLE" ? {} : undefined; } else if (current) current[code] = value; }
  flush(); const canonical = entities.map((entity) => entity.type === "LINE" ? { ...entity, x1: n(entity.x1), y1: n(entity.y1), x2: n(entity.x2), y2: n(entity.y2) } : { ...entity, cx: n(entity.cx), cy: n(entity.cy), radius: n(entity.radius) });
  return { designId: `DXF-IMPORT-${sha(JSON.stringify(canonical)).slice(0, 16)}`, unit: "mm", entities: canonical, designHash: sha(JSON.stringify(canonical)) };
}

export function compareDesign2D(original: Design2D, imported: Design2D, tolerance = 1e-9) {
  const normalize = (design: Design2D) => design.entities.map((entity) => entity.type === "LINE" ? ["LINE", entity.x1, entity.y1, entity.x2, entity.y2] : ["CIRCLE", entity.cx, entity.cy, entity.radius]);
  const left = normalize(original), right = normalize(imported); const equal = left.length === right.length && left.every((entity, index) => entity.length === right[index].length && entity.every((value, axis) => typeof value === "string" ? value === right[index][axis] : Math.abs(value - Number(right[index][axis])) <= tolerance));
  return { status: equal && original.unit === imported.unit ? "PASS" as const : "FAIL" as const, tolerance, originalEntityCount: left.length, importedEntityCount: right.length };
}
