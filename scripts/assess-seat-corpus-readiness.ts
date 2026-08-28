import { desc, eq, like } from "drizzle-orm";
import { engineeringProjects, seatKnowledgeEntities } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createSeatKnowledgeEntity } from "../server/seatKnowledgeRecords";

const PROJECT_ID = "PROJECT-de352bd4-d55e-4885-bd52-20ce7a932ccc";
const readiness: Record<string, { classification: string; stage: string; missing: string }> = {
  "2011-26-0047_260823_061236.pdf": { classification: "PARTIALLY_REPRODUCIBLE_MODAL_STUDY", stage: "FE_BLOCKED", missing: "Exact geometry, material properties, bush stiffness, fixture configuration, measurement mapping, and solver compatibility review" },
  "CarSeatBackrestStaticStrength.pdf": { classification: "PARTIALLY_REPRODUCIBLE_STATIC_STUDY", stage: "FE_BLOCKED", missing: "Dimensioned geometry, material grade/curve, fixture coordinates and DOFs, load point coordinates, mesh specification, measurement mapping, and acceptance tolerance" },
  "CarSeatBackrestStaticStrengthExperiment.pdf": { classification: "PARTIALLY_REPRODUCIBLE_STATIC_STUDY", stage: "FE_BLOCKED", missing: "Dimensioned geometry, material grade/curve, fixture coordinates and DOFs, load point coordinates, mesh specification, measurement mapping, and acceptance tolerance" },
  "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf": { classification: "PARTIALLY_REPRODUCIBLE_STATIC_STUDY", stage: "FE_BLOCKED", missing: "Dimensioned geometry, material grade/curve, fixture coordinates and DOFs, load point coordinates, mesh specification, measurement mapping, and acceptance tolerance" },
  "DesigningforSustainability.pdf": { classification: "PARTIALLY_REPRODUCIBLE_QUASISTATIC_STUDY", stage: "FE_BLOCKED", missing: "Complete geometry, load coordinates, fixture details, material stress-strain curve, solver-physics equivalence review, and validation tolerance" },
  "Evaluationoffiniteelementmodelsofseatstruct.pdf": { classification: "DYNAMIC_INTEGRATED_BELT_STUDY", stage: "FE_BLOCKED", missing: "Static CalculiX applicability is not established; dynamic contact, dummy, belt, rate-dependent material, exact model, and correlation inputs are not transferable" },
  "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf": { classification: "DYNAMIC_INTEGRATED_BELT_STUDY", stage: "FE_BLOCKED", missing: "Static CalculiX applicability is not established; dynamic contact, dummy, belt, rate-dependent material, exact model, and correlation inputs are not transferable" },
  "DEPARTMENTOFTRANSPORTATION.pdf": { classification: "REGULATORY_REFERENCE", stage: "ENGINEERING_DEFINED", missing: "Seat mass/CG/SRP coordinates, seat-specific geometry, material certificate, fixture realization, measurement mapping, and model-specific acceptance criterion" },
  "FMVSS207—SeatStructuralStrength.pdf": { classification: "REGULATORY_REFERENCE", stage: "ENGINEERING_DEFINED", missing: "Seat mass/CG/SRP coordinates, seat-specific geometry, material certificate, fixture realization, measurement mapping, and model-specific acceptance criterion" },
  "UNECERegulationNo.pdf": { classification: "REGULATORY_REFERENCE", stage: "KNOWLEDGE_ONLY", missing: "Study-specific geometry, material, fixtures, loads, test mapping, and acceptance model data" },
  "ssrn-5624455.pdf": { classification: "NON_CAE_REFERENCE", stage: "KNOWLEDGE_ONLY", missing: "Structural geometry, material, fixture, load, boundary, mesh, result, and acceptance data are not present" },
};
const fallback = { classification: "KNOWLEDGE_OR_CONCEPT_SOURCE", stage: "KNOWLEDGE_ONLY", missing: "Model-specific geometry, material, fixture, load, boundary, mesh, measurement mapping, and validation criterion are not documented" };

async function main() {
  const db = await getDb(); if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  const roots = await db.select().from(seatKnowledgeEntities).where(eq(seatKnowledgeEntities.projectId, PROJECT_ID)).orderBy(desc(seatKnowledgeEntities.createdAt));
  const project = (await db.select().from(engineeringProjects).where(eq(engineeringProjects.id, PROJECT_ID)).limit(1))[0];
  if (!project) throw new Error("CORPUS_PROJECT_NOT_FOUND");
  const sources = roots.filter((row) => row.entityType === "PROVENANCE" && row.externalKey.startsWith("SOURCE_"));
  for (const source of sources) {
    const sourceName = source.name;
    const assessment = readiness[sourceName] ?? fallback;
    const existing = (await db.select().from(seatKnowledgeEntities).where(eq(seatKnowledgeEntities.projectId, PROJECT_ID))).some((row) => row.externalKey === `READINESS_${source.externalKey}`);
    if (existing) continue;
    await createSeatKnowledgeEntity({ projectId: PROJECT_ID, accessKey: project.accessKey, input: {
      entityType: "VALIDATION", parentEntityId: source.id, externalKey: `READINESS_${source.externalKey}`, name: `Readiness: ${sourceName}`,
      description: `Classification: ${assessment.classification}. Stage: ${assessment.stage}. Exact blockers: ${assessment.missing}. This assessment is not a certification or solver result.`,
      sourceType: "REFERENCE", sourceReference: sourceName, evidenceReference: source.evidenceReference ?? `corpus://${sourceName}`, createdBy: "CorpusReadinessAssessment", status: assessment.stage === "ENGINEERING_DEFINED" ? "DRAFT" : "REQUIRED_INPUT",
    } });
  }
  process.stdout.write(JSON.stringify({ assessedSources: sources.length, projectId: PROJECT_ID }) + "\n");
  process.exit(0);
}
void main();
