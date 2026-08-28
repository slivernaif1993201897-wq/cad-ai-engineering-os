import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { desc, eq } from "drizzle-orm";
import { engineeringProjects } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createSeatKnowledgeEntity } from "../server/seatKnowledgeRecords";
import { openPersistentProject } from "../server/persistentMemory";

type Extracted = { category: string; claim: string; value: string; unit: string; source_page: number | string; section_figure_table: string; applicability: string; evidence_status: string; exact_missing_fields: string };
type SourceResult = { input: string; output: { file_name: string; classification: string; summary: string; cad_readiness: string; fe_readiness: string; evidence_json: string } };
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 20).toUpperCase();
const entityType = (category: string) => ({ LOAD_CASE: "LOAD_CASE", REQUIREMENT: "CONSTRAINT", CAD_FE: "CAE_CONFIGURATION", RESULT: "RESULT", TEST: "TEST", FIXTURE: "TEST", MEASUREMENT: "EVIDENCE", MATERIAL: "EVIDENCE", PROBLEM: "PROVENANCE", MECHANISM: "PROVENANCE", HYPOTHESIS: "PROVENANCE" }[category] ?? "PROVENANCE") as any;
function parseEvidence(raw: string): Extracted[] { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { try { return JSON.parse(raw.replace(/\\"/g, '"')); } catch { return []; } } }

async function main() {
  const corpus = JSON.parse(await readFile("/home/ubuntu/extract_seat_corpus_evidence.json", "utf8")) as { results: SourceResult[] };
  const db = await getDb();
  if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  const existing = (await db.select().from(engineeringProjects).where(eq(engineeringProjects.name, "Seat Research Corpus Evidence 2026-08-24")).orderBy(desc(engineeringProjects.createdAt)).limit(1))[0];
  const project = existing
    ? { id: existing.id, accessKey: existing.accessKey }
    : await openPersistentProject({ name: "Seat Research Corpus Evidence 2026-08-24" });
  const access = { projectId: project.id, accessKey: project.accessKey };
  if (existing) {
    await mkdir("/home/ubuntu/cad-ai-engineering-os-mobile/docs", { recursive: true });
    await writeFile("/home/ubuntu/cad-ai-engineering-os-mobile/docs/seat_corpus_ingestion_manifest_2026-08-24.json", JSON.stringify({ projectId: project.id, createdAt: new Date().toISOString(), sources: corpus.results.map(({ output }) => ({ fileName: output.file_name, classification: output.classification, evidenceCount: parseEvidence(output.evidence_json).length })) }, null, 2));
    process.stdout.write(JSON.stringify({ projectId: project.id, sourceCount: corpus.results.length, state: "ALREADY_PERSISTED" }) + "\n");
    process.exit(0);
    return;
  }
  const manifest: Array<{ fileName: string; classification: string; evidenceCount: number; rootEntityId: string }> = [];
  for (const item of corpus.results) {
    const source = item.output;
    const provenance = await createSeatKnowledgeEntity({ ...access, input: {
      entityType: "PROVENANCE", externalKey: `SOURCE_${digest(source.file_name)}`, name: source.file_name,
      description: `${source.classification}. ${source.summary}\nCAD readiness: ${source.cad_readiness}. FE readiness: ${source.fe_readiness}.`,
      sourceType: "REFERENCE", sourceReference: source.file_name, evidenceReference: `corpus://${source.file_name}`, createdBy: "CorpusIngestion", status: "DRAFT",
    } });
    const records = parseEvidence(source.evidence_json);
    for (const [index, record] of records.entries()) {
      const page = record.source_page === undefined || record.source_page === null || record.source_page === "" ? "PAGE_REFERENCE_UNAVAILABLE" : `p.${record.source_page}`;
      const anchor = record.section_figure_table || "SECTION_REFERENCE_UNAVAILABLE";
      const readiness = record.exact_missing_fields && record.exact_missing_fields !== "N/A" && record.exact_missing_fields !== "None" ? `\nReadiness: INCOMPLETE / REQUIRED_INPUT: ${record.exact_missing_fields}` : "";
      await createSeatKnowledgeEntity({ ...access, input: {
        entityType: entityType(record.category), parentEntityId: provenance.id, externalKey: `${record.category}_${digest(`${source.file_name}|${index}|${record.claim}`)}`,
        name: record.claim.slice(0, 255), description: `Category: ${record.category}. Evidence status: ${record.evidence_status}. Applicability: ${record.applicability}.${readiness}`,
        valueText: record.value && record.value !== "N/A" ? record.value : undefined, unit: record.unit && record.unit !== "N/A" ? record.unit : undefined,
        sourceType: "REFERENCE", sourceReference: `${source.file_name}; ${page}; ${anchor}`, evidenceReference: `corpus://${source.file_name}#${page}`, createdBy: "CorpusIngestion", status: record.exact_missing_fields && record.exact_missing_fields !== "N/A" && record.exact_missing_fields !== "None" ? "REQUIRED_INPUT" : "DRAFT",
      } });
    }
    manifest.push({ fileName: source.file_name, classification: source.classification, evidenceCount: records.length, rootEntityId: provenance.id });
  }
  await mkdir("/home/ubuntu/cad-ai-engineering-os-mobile/docs", { recursive: true });
  await writeFile("/home/ubuntu/cad-ai-engineering-os-mobile/docs/seat_corpus_ingestion_manifest_2026-08-24.json", JSON.stringify({ projectId: project.id, createdAt: new Date().toISOString(), sources: manifest }, null, 2));
  process.stdout.write(JSON.stringify({ projectId: project.id, sourceCount: manifest.length, evidenceCount: manifest.reduce((total, item) => total + item.evidenceCount, 0) }) + "\n");
  process.exit(0);
}
void main();
