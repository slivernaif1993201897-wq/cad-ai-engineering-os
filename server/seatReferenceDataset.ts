import { createHash } from "node:crypto";

import { BACKREST_STATIC_STRENGTH_STUDY, INTEGRATED_BELT_STUDY, type ReferenceStudy } from "./seatReferenceStudy";

export type ReferenceEvidenceType = "EXPLICIT" | "DERIVED" | "MISSING";
export type ReferenceStudyStatus = "REPRODUCIBLE" | "PARTIALLY_REPRODUCIBLE" | "NOT_REPRODUCIBLE";
export type CalculixCompatibility = "COMPATIBLE" | "REQUIRES_ENGINEERING_REVIEW" | "NOT_APPLICABLE";
export type BenchmarkLevel = "LEVEL_0_DOCUMENT_ONLY" | "LEVEL_1_DATASET_RECONSTRUCTED" | "LEVEL_2_GEOMETRY_RECONSTRUCTED" | "LEVEL_3_FE_MODEL_RECONSTRUCTED" | "LEVEL_4_SOLVER_EXECUTED" | "LEVEL_5_EXPERIMENTALLY_CORRELATED" | "LEVEL_6_INDEPENDENTLY_VALIDATED";

export type SeatReferenceDatasetItem = {
  sourceDocument: string;
  page: number;
  section: string;
  figure?: string;
  table?: string;
  equation?: string;
  requirementId: string;
  category: "GEOMETRY" | "MATERIALS" | "ELEMENTS" | "FIXTURES" | "LOADS" | "BOUNDARY_CONDITIONS" | "TEST_CONDITIONS" | "MEASUREMENTS" | "REFERENCE_RESULTS" | "TOLERANCES" | "FE_MODEL_INFORMATION";
  value: string;
  unit: string;
  applicability: string;
  evidenceType: ReferenceEvidenceType;
};

export type SeatReferenceStudyDataset = {
  id: string;
  title: string;
  analysisType: "STATIC" | "MODAL" | "DYNAMIC_CRASH" | "NON_CAE";
  originalSolver?: string;
  status: ReferenceStudyStatus;
  calculixCompatibility: CalculixCompatibility;
  benchmarkLevel: BenchmarkLevel;
  items: SeatReferenceDatasetItem[];
  requiredInputs: string[];
  sourceHash: string;
};

export type SeatReferenceDataset = {
  datasetVersion: "1.0";
  studies: SeatReferenceStudyDataset[];
  sourceHash: string;
  datasetHash: string;
};

export type ReferenceBenchmarkAdmission = {
  status: "ADMITTED" | "REQUIRED_INPUT" | "REQUIRES_ENGINEERING_REVIEW" | "NOT_APPLICABLE";
  studyId: string;
  benchmarkLevel: BenchmarkLevel;
  requiredInputs: string[];
  reason?: string;
};

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const item = (sourceDocument: string, page: number, section: string, requirementId: string, category: SeatReferenceDatasetItem["category"], value: string, unit: string, applicability: string, evidenceType: ReferenceEvidenceType, extra: Partial<Pick<SeatReferenceDatasetItem, "figure" | "table" | "equation">> = {}): SeatReferenceDatasetItem => ({ sourceDocument, page, section, requirementId, category, value, unit, applicability, evidenceType, ...extra });

const createStudy = (study: Omit<SeatReferenceStudyDataset, "sourceHash">): SeatReferenceStudyDataset => ({ ...study, sourceHash: hash({ id: study.id, items: study.items, requiredInputs: study.requiredInputs }) });

export const SEAT_REFERENCE_DATASET: SeatReferenceDataset = (() => {
  const dot = createStudy({
    id: "DOT-FMVSS-207", title: "DEPARTMENT OF TRANSPORTATION", analysisType: "STATIC", originalSolver: undefined,
    status: "PARTIALLY_REPRODUCIBLE", calculixCompatibility: "REQUIRES_ENGINEERING_REVIEW", benchmarkLevel: "LEVEL_1_DATASET_RECONSTRUCTED",
    items: [
      item("DEPARTMENTOFTRANSPORTATION.pdf", 13, "12.1(a)", "DOT-207-LOAD-20X-001", "LOADS", "20", "times seat weight", "Static seat-back load prescription; current seat mass is not documented", "EXPLICIT"),
      item("DEPARTMENTOFTRANSPORTATION.pdf", 13, "12.1(c)", "DOT-207-MOMENT-001", "LOADS", "3300", "in-lb", "Static moment requirement; coordinate and application region require current-seat mapping", "EXPLICIT"),
      item("DEPARTMENTOFTRANSPORTATION.pdf", 20, "Figure 3A", "DOT-207-DURATION-001", "TEST_CONDITIONS", "5", "s", "Full-forward seat-back test configuration", "EXPLICIT", { figure: "Figure 3A" }),
      item("DEPARTMENTOFTRANSPORTATION.pdf", 21, "Figure 3B", "DOT-207-CONFIG-001", "TEST_CONDITIONS", "Mid-point", "N/A", "Seat configuration reference", "EXPLICIT", { figure: "Figure 3B" }),
      item("DEPARTMENTOFTRANSPORTATION.pdf", 22, "Figure 3C", "DOT-207-LOAD-5000-001", "LOADS", "5000", "lbf", "Documented separate test configuration; not mixed into backrest case", "EXPLICIT", { figure: "Figure 3C" }),
      item("DEPARTMENTOFTRANSPORTATION.pdf", 29, "Figure 7", "DOT-207-SRP-001", "GEOMETRY", "Seat reference point", "N/A", "A point concept; no current CAD coordinate supplied", "EXPLICIT", { figure: "Figure 7" }),
    ],
    requiredInputs: ["CURRENT_SEAT_WEIGHT", "CURRENT_SEAT_CG_COORDINATE", "CURRENT_SEAT_SRP_COORDINATE", "LOAD_APPLICATION_REGION", "FIXTURE_COORDINATES", "MATERIAL_CERTIFICATE", "ACCEPTANCE_CRITERION"],
  });

  const backrest = createStudy({
    id: BACKREST_STATIC_STRENGTH_STUDY.id, title: BACKREST_STATIC_STRENGTH_STUDY.title, analysisType: "STATIC", originalSolver: "NASTRAN",
    status: "NOT_REPRODUCIBLE", calculixCompatibility: "REQUIRES_ENGINEERING_REVIEW", benchmarkLevel: "LEVEL_1_DATASET_RECONSTRUCTED",
    items: [
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 2, "Seats Static Strength Analysis Model", "BACKREST-ELEMENT-001", "ELEMENTS", "Shell and beam elements", "N/A", "Published seat-frame model", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 2, "Seats Static Strength Analysis Model", "BACKREST-CONNECTION-001", "FE_MODEL_INFORMATION", "Rigid weld and beam-bolt representations", "N/A", "Published simplified model", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 3, "Experiment and Simulation Analysis", "BACKREST-LOAD-530NM-001", "LOADS", "530", "Nm", "Published R-point backrest case", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 3, "Experiment and Simulation Analysis", "BACKREST-LOAD-1058N-001", "LOADS", "1058", "N", "Published equivalent load at beam midpoint", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 3, "Experiment and Simulation Analysis", "BACKREST-LOAD-REGION-001", "LOADS", "Backrest-frame beam midpoint", "N/A", "Published model region without coordinate", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 4, "Experiment and Simulation Analysis", "BACKREST-STRESS-001", "REFERENCE_RESULTS", "254.9", "MPa", "Published maximum simulated stress", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 4, "Experiment and Simulation Analysis", "BACKREST-DISPLACEMENT-001", "REFERENCE_RESULTS", "17.68", "mm", "Published maximum simulated displacement", "EXPLICIT"),
      item("CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", 4, "Table 1", "BACKREST-OBSERVED-ERROR-001", "REFERENCE_RESULTS", "14.94 maximum; 8.83 average", "%", "Observed experiment/FE error; not an acceptance tolerance", "EXPLICIT", { table: "Table 1" }),
    ],
    requiredInputs: ["SOURCE_GEOMETRY_DIMENSIONS", "MATERIAL_GRADE_AND_CURVE", "FIXTURE_COORDINATES", "CONNECTION_PROPERTIES", "MEASUREMENT_POINT_COORDINATES", "PUBLISHED_ACCEPTANCE_TOLERANCE"],
  });

  const modal = createStudy({
    id: "SAE-2011-26-0047", title: "2011-26-0047", analysisType: "MODAL", originalSolver: "NASTRAN",
    status: "PARTIALLY_REPRODUCIBLE", calculixCompatibility: "REQUIRES_ENGINEERING_REVIEW", benchmarkLevel: "LEVEL_1_DATASET_RECONSTRUCTED",
    items: [
      item("2011-26-0047_260823_061236.pdf", 1, "Experimental Set-up", "MODAL-MEASUREMENT-POINTS-001", "MEASUREMENTS", "119", "points", "Published modal test measurement count", "EXPLICIT"),
      item("2011-26-0047_260823_061236.pdf", 2, "Seat FE Modeling Details", "MODAL-NODE-COUNT-001", "ELEMENTS", "212673", "nodes", "Published FE model", "EXPLICIT"),
      item("2011-26-0047_260823_061236.pdf", 2, "Seat FE Modeling Details", "MODAL-ELEMENT-COUNT-001", "ELEMENTS", "206473", "elements", "Published FE model", "EXPLICIT"),
      item("2011-26-0047_260823_061236.pdf", 3, "Table 1", "MODAL-EXPERIMENT-001", "REFERENCE_RESULTS", "20.76; 27.39; 38.48; 49.40", "Hz", "Published experimental modes", "EXPLICIT", { table: "Table 1" }),
      item("2011-26-0047_260823_061236.pdf", 3, "Table 1", "MODAL-FE-001", "REFERENCE_RESULTS", "18.04; 26.33; 40.19; 52.71", "Hz", "Published Nastran modes", "EXPLICIT", { table: "Table 1" }),
    ],
    requiredInputs: ["GEOMETRY_COORDINATES", "MATERIAL_PROPERTIES", "BUSH_STIFFNESS", "MEASUREMENT_TOLERANCE"],
  });

  const sustainability = createStudy({
    id: "DESIGNING-SUSTAINABILITY", title: "Designing for Sustainability", analysisType: "STATIC", originalSolver: "RADIOSS",
    status: "PARTIALLY_REPRODUCIBLE", calculixCompatibility: "REQUIRES_ENGINEERING_REVIEW", benchmarkLevel: "LEVEL_1_DATASET_RECONSTRUCTED",
    items: [
      item("DesigningforSustainability.pdf", 11, "Section 2", "SUSTAIN-BACKREST-THICKNESS-001", "GEOMETRY", "2", "mm", "Backrest pipe thickness", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 14, "Section 3", "SUSTAIN-CHASSIS-THICKNESS-001", "GEOMETRY", "1.5", "mm", "Chassis profile thickness", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 12, "Section 2", "SUSTAIN-MATERIAL-001", "MATERIALS", "S420MC yield strength 420", "MPa", "Published material property", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 13, "Section 2", "SUSTAIN-LOAD-SHOULDER-001", "LOADS", "4500", "N", "Shoulder-block force", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 13, "Section 2", "SUSTAIN-LOAD-LAP-001", "LOADS", "6766", "N", "Lap-block force", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 13, "Section 2", "SUSTAIN-LOAD-ANGLE-001", "LOADS", "10 ± 5", "degrees", "Tractive-force angle", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 13, "Section 2", "SUSTAIN-LOAD-DURATION-001", "LOADS", "0.2", "s", "Published load duration", "EXPLICIT"),
      item("DesigningforSustainability.pdf", 15, "Figure 7", "SUSTAIN-STRESS-001", "REFERENCE_RESULTS", "586", "MPa", "Published maximum von Mises stress for 1.5 mm case", "EXPLICIT", { figure: "Figure 7" }),
      item("DesigningforSustainability.pdf", 17, "Figure 11c", "SUSTAIN-DISPLACEMENT-001", "REFERENCE_RESULTS", "448", "mm", "Published backrest displacement for 1.5 mm case", "EXPLICIT", { figure: "Figure 11c" }),
    ],
    requiredInputs: ["DETAILED_GEOMETRY", "LOAD_APPLICATION_COORDINATES", "MATERIAL_CURVE", "FIXTURE_COORDINATES", "PUBLISHED_ACCEPTANCE_TOLERANCE"],
  });

  const dynamic = createStudy({
    id: "INTEGRATED-BELT-2010", title: INTEGRATED_BELT_STUDY.title, analysisType: "DYNAMIC_CRASH", originalSolver: "LS-DYNA",
    status: "NOT_REPRODUCIBLE", calculixCompatibility: "NOT_APPLICABLE", benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY",
    items: [
      item("Evaluationoffiniteelementmodelsofseatstruct.pdf", 3, "2.1", "DYNAMIC-GEOMETRY-001", "GEOMETRY", "400; 200; 665; 575", "mm", "Published frame dimensions; incomplete seat geometry", "EXPLICIT"),
      item("Evaluationoffiniteelementmodelsofseatstruct.pdf", 3, "Table 1", "DYNAMIC-TUBE-001", "GEOMETRY", "48 × 2; 30 × 2.5", "mm", "Published tube sections", "EXPLICIT", { table: "Table 1" }),
      item("Evaluationoffiniteelementmodelsofseatstruct.pdf", 8, "2.2", "DYNAMIC-MATERIAL-001", "MATERIALS", "Docol 22MnB5; density 7800; E 205; nu 0.3", "kg/m³; GPa; N/A", "Dynamic study material set", "EXPLICIT"),
      item("Evaluationoffiniteelementmodelsofseatstruct.pdf", 8, "3.1", "DYNAMIC-LOAD-001", "LOADS", "14; 176; 80; 0.65", "m/s; m/s²; ms; m", "Published crash pulse metrics", "EXPLICIT"),
      item("Evaluationoffiniteelementmodelsofseatstruct.pdf", 9, "3.2", "DYNAMIC-DISPLACEMENT-001", "REFERENCE_RESULTS", "21; 125", "mm", "Published dynamic displacement values", "EXPLICIT"),
    ],
    requiredInputs: ["COMPLETE_LOWER_SEAT_GEOMETRY", "BELT_ANCHOR_COORDINATES", "CONTACT_AND_FRICTION", "PADDING_PROPERTIES", "DYNAMIC_SOLVER_CAPABILITY"],
  });

  const nonCae = createStudy({ id: "DRIVER-BEHAVIOR-REVIEW", title: "Driver behavior recognition studies", analysisType: "NON_CAE", originalSolver: undefined, status: "NOT_REPRODUCIBLE", calculixCompatibility: "NOT_APPLICABLE", benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY", items: [], requiredInputs: ["STRUCTURAL_ENGINEERING_DATA_NOT_PRESENT"] });
  const unece = createStudy({ id: "UNECE-IWVTA-AMENDMENT", title: "UNECE Regulation Amendment", analysisType: "NON_CAE", originalSolver: undefined, status: "NOT_REPRODUCIBLE", calculixCompatibility: "NOT_APPLICABLE", benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY", items: [item("UNECERegulationNo.pdf", 2, "Annex 4 Part A", "UNECE-REG-17-001", "TEST_CONDITIONS", "UN Regulation 17 Series 10", "N/A", "Regulation reference only", "EXPLICIT")], requiredInputs: ["TECHNICAL_TEST_PROCEDURE_NOT_PRESENT"] });
  const ssrnAdas = createStudy({
    id: "SSRN-5624455-ADAS-SAFETY-REVIEW", title: "Safety Risks in Advanced Driver Assistance Systems (ADAS): A Systematic Review of Causation and Analysis Methodologies", analysisType: "NON_CAE", originalSolver: undefined,
    status: "NOT_REPRODUCIBLE", calculixCompatibility: "NOT_APPLICABLE", benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY",
    items: [
      item("ssrn-5624455.pdf", 2, "Abstract", "SSRN-ADAS-SCOPE-001", "TEST_CONDITIONS", "Systematic review of ADAS accident scenarios, risk factors, and analysis methodologies", "N/A", "ADAS safety-governance reference; not a seat structural study", "EXPLICIT"),
      item("ssrn-5624455.pdf", 2, "1. Introduction", "SSRN-ADAS-SENSOR-001", "FE_MODEL_INFORMATION", "Radar; lidar; cameras", "N/A", "ADAS sensing context only; not Seat CAE input", "EXPLICIT"),
      item("ssrn-5624455.pdf", 3, "1. Introduction", "SSRN-ADAS-HUMAN-001", "TEST_CONDITIONS", "L2 driver remains vigilant and prepared to take control", "N/A", "Human-factors context only; not a structural boundary condition", "EXPLICIT"),
    ],
    requiredInputs: ["STRUCTURAL_ENGINEERING_DATA_NOT_PRESENT"],
  });
  const studies = [dot, backrest, modal, sustainability, dynamic, nonCae, unece, ssrnAdas];
  const sourceHash = hash(studies.map((study) => study.sourceHash));
  return { datasetVersion: "1.0", studies, sourceHash, datasetHash: hash({ sourceHash, studies: studies.map(({ sourceHash: _sourceHash, ...study }) => study) }) };
})();

export function verifySeatReferenceDataset(dataset: SeatReferenceDataset): boolean {
  const sourceHash = hash(dataset.studies.map((study) => study.sourceHash));
  const datasetHash = hash({ sourceHash, studies: dataset.studies.map(({ sourceHash: _sourceHash, ...study }) => study) });
  return dataset.sourceHash === sourceHash && dataset.datasetHash === datasetHash;
}

export function admitReferenceBenchmark(dataset: SeatReferenceDataset, studyId: string): ReferenceBenchmarkAdmission {
  if (!verifySeatReferenceDataset(dataset)) return { status: "REQUIRED_INPUT", studyId, benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY", requiredInputs: ["DATASET_INTEGRITY"], reason: "DATASET_HASH_MISMATCH" };
  const study = dataset.studies.find((candidate) => candidate.id === studyId);
  if (!study) return { status: "REQUIRED_INPUT", studyId, benchmarkLevel: "LEVEL_0_DOCUMENT_ONLY", requiredInputs: ["STUDY_ID"], reason: "UNKNOWN_STUDY" };
  if (study.calculixCompatibility === "NOT_APPLICABLE") return { status: "NOT_APPLICABLE", studyId, benchmarkLevel: study.benchmarkLevel, requiredInputs: study.requiredInputs, reason: "DYNAMIC_OR_NON_CAE_STUDY" };
  if (study.requiredInputs.length) return { status: study.calculixCompatibility === "REQUIRES_ENGINEERING_REVIEW" ? "REQUIRES_ENGINEERING_REVIEW" : "REQUIRED_INPUT", studyId, benchmarkLevel: study.benchmarkLevel, requiredInputs: study.requiredInputs, reason: "INCOMPLETE_SINGLE_STUDY_REFERENCE" };
  return { status: "ADMITTED", studyId, benchmarkLevel: study.benchmarkLevel, requiredInputs: [] };
}
