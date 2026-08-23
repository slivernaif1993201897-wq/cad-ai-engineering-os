# Official Seat CAE Reference Extraction

## Source Documents

| Source document | Explicit scope retained | Applicability decision |
|---|---|---|
| `DEPARTMENTOFTRANSPORTATION.pdf`, NHTSA OVSC TP-207-09, *Laboratory Test Procedure for FMVSS 207 Seating Systems*, June 18, 1992 | Seating systems, attachment assemblies, and installation; laboratory compliance procedure | May supply test-direction and reporting requirements, but not unreferenced seat material properties or a finite-element acceptance criterion. |
| `UNECERegulationNo.pdf`, E/ECE/TRANS/505/Rev.3/Add.0/Rev.6/Amend.1, UN Regulation No. 0 | IWVTA topic list and applicability notes | Does **not** contain a seat test method, fixture geometry, load magnitude, material property, or CAE validation criterion. It only lists UN Regulation No. 17 as an IWVTA topic. |

## Explicitly Extracted Requirements

| Requirement ID | Source document | Section or page | Value | Unit | Applicability |
|---|---|---:|---|---|---|
| `FMVSS207-APPLICABILITY-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2 | FMVSS No. 207 applies to passenger cars, MPVs, trucks, and buses; it covers seats, their attachment assemblies, and installation. | N/A | Vehicle and seat configuration must be supplied before use. |
| `FMVSS207-FORCE-FWD-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2(A) | 20 times the weight of the seat in a forward longitudinal direction, in any adjustable position. | seat-weight multiplier | Requires an authoritative seat mass and coordinate-direction mapping. |
| `FMVSS207-FORCE-REAR-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2(B) | 20 times the weight of the seat in a rearward longitudinal direction, in any adjustable position. | seat-weight multiplier | Requires an authoritative seat mass and coordinate-direction mapping. |
| `FMVSS207-BELT-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2(C) | For a seat-belt assembly attached to the seat, the applicable force is simultaneous with loads imposed by S4.2 of FMVSS 210. | N/A | Requires belt-assembly applicability and the referenced FMVSS 210 data; not present in supplied documents. |
| `FMVSS207-MOMENT-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2(D) | In rearmost position, a force producing 3,300 in-lb about the seating reference point per designated seating position, applied to the upper crossmember/seat back in the stated longitudinal direction. | in-lb | Requires seating-reference point, designated-position count, upper-crossmember region, and applicable facing direction. |
| `FMVSS207-ADJUSTMENT-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 4, §2 | Seat should remain in adjusted position during each force application. | N/A | Requires adjustment/lock mechanism model; not present in current Seat CAD artifact. |
| `FMVSS207-CALIBRATION-001` | `DEPARTMENTOFTRANSPORTATION.pdf` | PDF p. 7, §8(B) | Measuring instruments and standards calibrated against a higher-order standard at intervals not exceeding six months, with NIST traceability records. | months | Physical-test/instrumentation requirement; no solver substitution claimed. |
| `UNR0-SEATS-001` | `UNECERegulationNo.pdf` | PDF p. 2, Annex 4 Part A Section I | Lists UN Regulation No. 17, series 10, for vehicles regarding seats, their anchorages and head restraints. | regulation series | Topic reference only; detailed UN R17 test clauses are absent. |

## Required Inputs Not Present in Supplied Documents

- `SEAT_MASS` for the 20-times-seat-weight loads.
- `VEHICLE_LONGITUDINAL_AXIS_MAPPING` from the vehicle coordinate system to the Seat CAD coordinate system.
- `SEATING_REFERENCE_POINT` and `DESIGNATED_SEATING_POSITION_COUNT` for the 3,300 in-lb moment application.
- `UPPER_CROSSMEMBER_OR_SEAT_BACK_LOAD_REGION` geometry mapping.
- `MOUNT_FIXTURE_STIFFNESS_OR_TEST_RIG_REPRESENTATION` and physical anchorage geometry.
- `SEAT_MATERIAL_CERTIFICATES` and applicable constitutive properties for every modeled component.
- `FMVSS_210_S4_2_LOAD_DATA` if a seat-mounted belt assembly is applicable.
- `MODEL_SPECIFIC_REFERENCE_SOLUTION_OR_APPROVED_CAE_ACCEPTANCE_CRITERION` suitable for a finite-element comparison.
- Detailed UN Regulation No. 17 test clauses, if UN R17 compliance applicability is intended.

> The extracted values are stored as source requirements only. They do not constitute a regulatory-compliance claim or authorize CalculiX execution until all listed required inputs are supplied and traceably bound.
