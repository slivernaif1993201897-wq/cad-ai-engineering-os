import { and, eq } from "drizzle-orm";
import { engineeringProjects, seatKnowledgeEntities } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createSeatKnowledgeEntity } from "../server/seatKnowledgeRecords";

const PROJECT_ID = "PROJECT-de352bd4-d55e-4885-bd52-20ce7a932ccc";
type Concept = { id: string; source: string; page: string; name: string; mechanism: string; intent: string; parameters: string[] };
const concepts: Concept[] = [
  { id: "CONCEPT_OCCUPANT_MOTION_CONTROL", source: "1-EngineeringProblem.pdf", page: "Engineering problem / physical mechanism sections", name: "Controlled occupant–seat interaction architecture", mechanism: "Temporal phase mismatch between occupant motion and restraint response", intent: "Provide a user-refinable architecture for controlled interaction and measurable occupant–seat relative motion", parameters: ["INTERACTION_ZONE_LOCATION", "CONTROLLED_TRAVEL", "RESTRAINT_INTERFACE_LOCATION", "ENERGY_MANAGEMENT_TRAVEL"] },
  { id: "CONCEPT_REAR_SEAT_RESTRAINT_INTERFACE", source: "OccupantRestraintintheRearSeatATD.pdf", page: "Rear-seat ATD restraint interaction sections", name: "Rear-seat restraint interaction architecture", mechanism: "Occupant, restraint, and rear-seat interface force transfer", intent: "Provide an editable interface architecture for later user-defined restraint and seat interaction inputs", parameters: ["RESTRAINT_ANCHOR_LOCATION", "SEAT_INTERFACE_LOCATION", "OCCUPANT_REFERENCE_LOCATION", "LOAD_TRANSFER_PATH"] },
  { id: "CONCEPT_CUSHION_STIFFNESS_DISTRIBUTION", source: "VariationsinRearSeatCushionProperties.pdf", page: "Cushion property variation sections", name: "Rear-seat cushion stiffness-distribution architecture", mechanism: "Cushion property variation influences occupant-support interaction", intent: "Provide a parameterized concept for stiffness-zone layout without claiming material or geometry values", parameters: ["CUSHION_WIDTH", "CUSHION_DEPTH", "CUSHION_THICKNESS", "STIFFNESS_ZONE_LAYOUT", "MATERIAL_THICKNESS"] },
  { id: "CONCEPT_BACKREST_LOAD_PATH", source: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: "pp. 2–4, Seats Static Strength Analysis Model / Fig. 1 / Table 1", name: "Backrest structural load-path architecture", mechanism: "Tube/plate frame transfers rearward loading through welded structural members", intent: "Provide an editable backrest-frame architecture for a new design, not a reconstruction of the study geometry", parameters: ["BACKREST_WIDTH", "BACKREST_HEIGHT", "TUBE_SECTION", "PLATE_THICKNESS", "WELD_LAYOUT", "MOUNT_SPACING"] },
  { id: "CONCEPT_ENERGY_MANAGEMENT", source: "4-5-ConceptExpansionEngineeringInfeasibilityAcceptance.pdf", page: "Concept acceptance and infeasibility sections", name: "Seat energy-management architecture", mechanism: "Energy absorption and controlled deformation concepts are filtered by physical feasibility", intent: "Provide a user-refinable architecture for later validated energy-management design", parameters: ["DEFORMATION_TRAVEL", "ABSORBER_LOCATION", "FORCE_TRANSFER_PATH", "CLEARANCE", "MATERIAL_THICKNESS"] },
];

async function main() {
  const db = await getDb(); if (!db) throw new Error("PERSISTENT_DATABASE_REQUIRED");
  const project = (await db.select().from(engineeringProjects).where(eq(engineeringProjects.id, PROJECT_ID)).limit(1))[0];
  if (!project) throw new Error("CORPUS_PROJECT_NOT_FOUND");
  const roots = await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, PROJECT_ID), eq(seatKnowledgeEntities.entityType, "PROVENANCE")));
  let created = 0;
  for (const concept of concepts) {
    const source = roots.find((record) => record.name === concept.source && record.parentEntityId === null);
    if (!source) continue;
    const exists = (await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, PROJECT_ID), eq(seatKnowledgeEntities.externalKey, concept.id))).limit(1))[0];
    const architecture = exists ?? await createSeatKnowledgeEntity({ projectId: PROJECT_ID, accessKey: project.accessKey, input: {
      entityType: "GEOMETRY", parentEntityId: source.id, externalKey: concept.id, name: concept.name,
      description: `MODEL_TYPE=ENGINEERING_CONCEPT_MODEL. VALIDATION_STATUS=NOT_VALIDATED. SOURCE_BASIS=DOCUMENTED_ENGINEERING_EVIDENCE. Engineering mechanism: ${concept.mechanism}. Design intent: ${concept.intent}. GEOMETRY_STATUS=GEOMETRY_UNDEFINED because the verified CAD engine requires positive numeric dimensions and does not safely accept undefined user parameters. FE_STATUS=FE_BLOCKED.`,
      sourceType: "REFERENCE", sourceReference: `${concept.source}; ${concept.page}`, evidenceReference: source.evidenceReference ?? `corpus://${concept.source}`, createdBy: "EngineeringConceptModelGenerator", status: "REQUIRED_INPUT",
    } });
    if (!exists) created += 1;
    for (const parameter of concept.parameters) {
      const key = `${concept.id}_PARAM_${parameter}`;
      const parameterExists = (await db.select().from(seatKnowledgeEntities).where(and(eq(seatKnowledgeEntities.projectId, PROJECT_ID), eq(seatKnowledgeEntities.externalKey, key))).limit(1))[0];
      if (parameterExists) continue;
      await createSeatKnowledgeEntity({ projectId: PROJECT_ID, accessKey: project.accessKey, input: {
        entityType: "CONSTRAINT", parentEntityId: architecture.id, externalKey: key, name: `USER_DEFINED_PARAMETER: ${parameter}`,
        description: `VALUE=UNDEFINED. UNIT=USER_INPUT_REQUIRED. SOURCE=USER_INPUT_REQUIRED. PARAMETER_STATE=REQUIRED_INPUT. This parameter cannot enter CAE admission until supplied and approved.`,
        sourceType: "USER_PROVIDED", sourceReference: `${concept.source}; ${concept.page}`, evidenceReference: source.evidenceReference ?? `corpus://${concept.source}`, createdBy: "EngineeringConceptModelGenerator", status: "REQUIRED_INPUT",
      } });
    }
  }
  process.stdout.write(JSON.stringify({ projectId: PROJECT_ID, conceptsCreated: created, conceptCount: concepts.length, cadArtifactsCreated: 0, feStatus: "FE_BLOCKED" }) + "\n");
  process.exit(0);
}
void main();
