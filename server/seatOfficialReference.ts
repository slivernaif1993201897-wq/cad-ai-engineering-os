export type OfficialSeatRequirement = {
  sourceDocument: string;
  sectionOrPage: string;
  requirementId: string;
  value: string;
  unit: string;
  applicability: string;
};

export type OfficialSeatCaeInputs = {
  seatWeightN?: number;
  vehicleLongitudinalAxisMapping?: string;
  fixtureCoordinateFrameId?: string;
  mountFixtureRepresentationId?: string;
  forwardLoadRegionId?: string;
  rearwardLoadRegionId?: string;
  seatingReferencePointId?: string;
  designatedSeatingPositionCount?: number;
  upperCrossmemberLoadRegionId?: string;
  seatFacingDirection?: "FORWARD" | "REARWARD";
  materialCertificateIds?: string[];
  modelSpecificReferenceCriterionId?: string;
  referenceSolutionId?: string;
};

export const FMVSS207_OFFICIAL_REQUIREMENTS: OfficialSeatRequirement[] = [
  { sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 4, §2(A)", requirementId: "FMVSS207-FORCE-FWD-001", value: "20 times the weight of the seat applied in a forward longitudinal direction", unit: "seat-weight multiplier", applicability: "Each applicable occupant seat, any adjustable position" },
  { sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 4, §2(B)", requirementId: "FMVSS207-FORCE-REAR-001", value: "20 times the weight of the seat applied in a rearward longitudinal direction", unit: "seat-weight multiplier", applicability: "Each applicable occupant seat, any adjustable position" },
  { sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 4, §2(D)", requirementId: "FMVSS207-MOMENT-001", value: "Force producing 3,300 in-lb moment about seating reference point per designated seating position", unit: "in-lb", applicability: "Rear-most position; requires applicable upper crossmember/seat-back region and facing direction" },
  { sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 35, Figure 13", requirementId: "FMVSS207-FIXTURE-001", value: "Secure test vehicle frame to fixture; position vehicle body at normal curb weight attitude", unit: "N/A", applicability: "Physical test-fixture representation required before an equivalent structural model can be admitted" },
  { sourceDocument: "DEPARTMENTOFTRANSPORTATION.pdf", sectionOrPage: "PDF p. 36, possible noncompliances", requirementId: "FMVSS207-OBSERVATION-001", value: "Observe release, detachment, separation, or disengagement under specified load", unit: "N/A", applicability: "Physical-test observation; no finite-element acceptance threshold stated" },
  { sourceDocument: "UNECERegulationNo.pdf", sectionOrPage: "PDF p. 2, Annex 4 Part A Section I", requirementId: "UNR0-SEATS-001", value: "UN Regulation No. 17, series 10, listed for vehicles regarding seats, their anchorages and any head restraints", unit: "regulation series", applicability: "Topic reference only; detailed UN R17 procedure is not included in supplied document" },
];

export type OfficialSeatCaeMapping = {
  status: "MAPPED" | "REQUIRED_INPUT";
  requirements: OfficialSeatRequirement[];
  requiredInputs: string[];
  documentedLoadCases: Array<{ requirementId: string; direction: "FORWARD_LONGITUDINAL" | "REARWARD_LONGITUDINAL"; multiplier: 20; loadRegionId?: string }>;
  documentedMomentCase?: { requirementId: string; momentInLb: 3300; loadRegionId?: string; seatingReferencePointId?: string };
};

/** Maps only the literal source requirements. It intentionally does not turn a physical compliance procedure into a CAE result criterion. */
export function mapOfficialSeatCaeInputs(inputs: OfficialSeatCaeInputs): OfficialSeatCaeMapping {
  const requiredInputs: string[] = [];
  if (!Number.isFinite(inputs.seatWeightN) || (inputs.seatWeightN ?? 0) <= 0) requiredInputs.push("SEAT_WEIGHT_N");
  if (!inputs.vehicleLongitudinalAxisMapping?.trim()) requiredInputs.push("VEHICLE_LONGITUDINAL_AXIS_MAPPING");
  if (!inputs.fixtureCoordinateFrameId?.trim()) requiredInputs.push("FIXTURE_COORDINATE_FRAME_ID");
  if (!inputs.mountFixtureRepresentationId?.trim()) requiredInputs.push("MOUNT_FIXTURE_REPRESENTATION_ID");
  if (!inputs.forwardLoadRegionId?.trim()) requiredInputs.push("FORWARD_LOAD_REGION_ID");
  if (!inputs.rearwardLoadRegionId?.trim()) requiredInputs.push("REARWARD_LOAD_REGION_ID");
  if (!inputs.seatingReferencePointId?.trim()) requiredInputs.push("SEATING_REFERENCE_POINT_ID");
  if (!Number.isInteger(inputs.designatedSeatingPositionCount) || (inputs.designatedSeatingPositionCount ?? 0) <= 0) requiredInputs.push("DESIGNATED_SEATING_POSITION_COUNT");
  if (!inputs.upperCrossmemberLoadRegionId?.trim()) requiredInputs.push("UPPER_CROSSMEMBER_LOAD_REGION_ID");
  if (!inputs.seatFacingDirection) requiredInputs.push("SEAT_FACING_DIRECTION");
  if (!inputs.materialCertificateIds?.length || inputs.materialCertificateIds.some((value) => !value.trim())) requiredInputs.push("SEAT_MATERIAL_CERTIFICATE_IDS");
  // The supplied documents give physical test requirements but no finite-element reference solution or CAE tolerance.
  if (!inputs.modelSpecificReferenceCriterionId?.trim()) requiredInputs.push("MODEL_SPECIFIC_REFERENCE_CRITERION_ID");
  if (!inputs.referenceSolutionId?.trim()) requiredInputs.push("REFERENCE_SOLUTION_ID");

  return {
    status: requiredInputs.length ? "REQUIRED_INPUT" : "MAPPED",
    requirements: FMVSS207_OFFICIAL_REQUIREMENTS,
    requiredInputs,
    documentedLoadCases: [
      { requirementId: "FMVSS207-FORCE-FWD-001", direction: "FORWARD_LONGITUDINAL", multiplier: 20, loadRegionId: inputs.forwardLoadRegionId },
      { requirementId: "FMVSS207-FORCE-REAR-001", direction: "REARWARD_LONGITUDINAL", multiplier: 20, loadRegionId: inputs.rearwardLoadRegionId },
    ],
    documentedMomentCase: { requirementId: "FMVSS207-MOMENT-001", momentInLb: 3300, loadRegionId: inputs.upperCrossmemberLoadRegionId, seatingReferencePointId: inputs.seatingReferencePointId },
  };
}
