import { and, eq, like } from "drizzle-orm";
import { engineeringProjects, seatKnowledgeEntities } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createSeatKnowledgeEntity } from "../server/seatKnowledgeRecords";

const PROJECT_ID = "PROJECT-de352bd4-d55e-4885-bd52-20ce7a932ccc";
const candidates: Record<string, { readiness: "CAD_PARTIALLY_READY" | "CAD_BLOCKED"; object: string; sourcePage: string; geometryEvidence: string; missing: string }> = {
  "2011-26-0047_260823_061236.pdf": { readiness: "CAD_PARTIALLY_READY", object: "Automotive seat skeleton modal FE subject", sourcePage: "p.2–3, THE SEAT FE MODELING DETAILS / Table 1", geometryEvidence: "Seat assembly FE model is documented by node/element count and modal test context, but no reconstructable geometry is supplied.", missing: "Exact component geometry, dimensions, interfaces, mount geometry, coordinate system, and material assignment" },
  "CarSeatBackrestStaticStrength.pdf": { readiness: "CAD_PARTIALLY_READY", object: "Car seat backrest structural frame", sourcePage: "p.2–4, Seats Static Strength Analysis Model / Fig. 1 / Table 1", geometryEvidence: "Steel tube, stamped plate, shell/beam idealization, and 20 weld points are documented; dimensions and topology are not.", missing: "Dimensioned tube/plate geometry, section sizes, thicknesses, weld locations, mounting points, coordinate system, and CAD interfaces" },
  "CarSeatBackrestStaticStrengthExperiment.pdf": { readiness: "CAD_PARTIALLY_READY", object: "Car seat backrest structural frame", sourcePage: "p.2–4, Seats Static Strength Analysis Model / Fig. 1 / Table 1", geometryEvidence: "Steel tube and stamped plate construction with shell/beam idealization is documented; no dimensioned CAD definition is supplied.", missing: "Dimensioned tube/plate geometry, section sizes, thicknesses, weld locations, mounting points, coordinate system, and CAD interfaces" },
  "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf": { readiness: "CAD_PARTIALLY_READY", object: "Car seat backrest structural frame", sourcePage: "p.2–4, Seats Static Strength Analysis Model / Fig. 1 / Table 1", geometryEvidence: "Shell/beam backrest FE representation and static test arrangement are documented; geometry is not reconstructable.", missing: "Dimensioned geometry, topology, section sizes, thicknesses, weld locations, mounting points, and coordinate system" },
  "DesigningforSustainability.pdf": { readiness: "CAD_PARTIALLY_READY", object: "Seat pull-test structural configuration", sourcePage: "Published quasi-static pull-study analysis sections", geometryEvidence: "Some material and load context is documented, but full geometry and interface definition are absent.", missing: "Complete geometry, component interfaces, thickness mapping, load coordinates, fixture geometry, and coordinate system" },
};

async function main() {
  const db = await getDb(); if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  const project = (await db.select().from(engineeringProjects).where(eq(engineeringProjects.id, PROJECT_ID)).limit(1))[0];
  if (!project) throw new Error("CORPUS_PROJECT_NOT_FOUND");
  const roots = await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, PROJECT_ID), eq(seatKnowledgeEntities.entityType, "PROVENANCE")));
  let partial = 0;
  for (const source of roots.filter((row) => row.externalKey.startsWith("SOURCE_") && row.parentEntityId === null)) {
    const candidate = candidates[source.name];
    if (!candidate) continue;
    partial += 1;
    const key = `CAD_GATE_${source.externalKey}`;
    const exists = (await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, PROJECT_ID), eq(seatKnowledgeEntities.externalKey, key))).limit(1))[0];
    if (exists) continue;
    await createSeatKnowledgeEntity({ projectId: PROJECT_ID, accessKey: project.accessKey, input: {
      entityType: "GEOMETRY", parentEntityId: source.id, externalKey: key, name: `${candidate.object}: ${candidate.readiness}`,
      description: `CAD readiness: ${candidate.readiness}. Geometry evidence: ${candidate.geometryEvidence} Unsupported regions: GEOMETRY_UNDEFINED. No CAD artifact may be generated from this source alone. Exact missing fields: ${candidate.missing}.`,
      sourceType: "REFERENCE", sourceReference: `${source.name}; ${candidate.sourcePage}`, evidenceReference: source.evidenceReference ?? `corpus://${source.name}`, createdBy: "CorpusCadCandidateAssessment", status: "REQUIRED_INPUT",
    } });
  }
  process.stdout.write(JSON.stringify({ projectId: PROJECT_ID, cadReady: 0, cadPartiallyReady: partial, cadArtifactsCreated: 0 }) + "\n");
  process.exit(0);
}
void main();
