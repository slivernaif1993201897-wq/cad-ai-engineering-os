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

## Additional Study: Car Seat Backrest Static Strength Experiment and Simulation

| Requirement ID | Source document | Section or page | Value | Unit | Applicability |
|---|---|---:|---|---|---|
| `BACKREST-FE-MODEL-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 2, *Seats Static Strength Analysis Model* | Seat-frame static model uses shell and beam elements; welded, bolted, and other connections are represented as rigid/beam connections. | N/A | Published study model; not the current OpenCascade compound seat geometry. |
| `BACKREST-TEST-FIXTURE-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 2, *Seat Backrest Static Strength Experiment* | Test is developed under cited Chinese standards; this page does not supply fixture coordinates or CAD geometry. | N/A | Physical experiment reference only. |
| `BACKREST-LOAD-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 3, *Experiment and Simulation Analysis* | A 530 Nm torque based on the R-point is imposed in a horizontal rearward direction; the published model converts it to a 1,058 N load at the backrest-frame beam midpoint. | Nm; N | Specific published Chinese-seat backrest model, not automatically applicable to the current seat geometry. |
| `BACKREST-STRESS-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 4, *Experiment and Simulation Analysis* | Reported maximum simulated stress is 254.9 MPa at the angle-transfer-device/backrest connection. | MPa | Specific detailed Nastran model and material/yield assumptions; cannot transfer to current geometry without material and connection equivalence. |
| `BACKREST-DISPLACEMENT-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 4, *Experiment and Simulation Analysis* | Reported maximum displacement is 17.68 mm at the strengthened board/upper backrest. | mm | Specific detailed Nastran model and fixture; no direct transfer to current geometry. |
| `BACKREST-CORRELATION-001` | `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | PDF p. 4, Table 1 | Table reports maximum experiment-versus-simulation error of 14.94% and average error of 8.83% for its measured stresses. | percent | Published correlation data, but the measurement-point geometry and detailed model are not supplied in a directly importable form. |

### Additional Required Inputs for Reuse of This Study

- `SOURCE_SEAT_GEOMETRY_AND_CONNECTION_MODEL_EQUIVALENCE` between the published backrest and the current Seat CAD artifact.
- `R_POINT_LOCATION_AND_BACKREST_BEAM_MIDPOINT_REGION` in the current Seat CAD coordinate system.
- `MATERIAL_YIELD_LIMIT_AND_CONSTITUTIVE_PROPERTIES` for every modeled current-seat component.
- `PUBLISHED_TEST_FIXTURE_COORDINATES_AND_BOUNDARY_REPRESENTATION`.
- `MEASUREMENT_POINT_MAPPING` required to reproduce the Table 1 correlation metric.
- `AUTHORITATIVE_ACCEPTANCE_DECISION` confirming that the published 530 Nm/1,058 N case is applicable to the current seat revision.

## Additional Study: Integrated Safety Belts with Full-Scale Experiments

| Requirement ID | Source document | Section or page | Value | Unit | Applicability |
|---|---|---:|---|---|---|
| `INTEGRATED-BELT-TEST-001` | `Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf` | PDF p. 2, abstract | FE models of simplified seats with integrated three-point belts are evaluated against full-scale experiments. | N/A | Dynamic integrated-belt/sled research; not a static current-seat reference. |
| `INTEGRATED-BELT-OCCUPANT-001` | `Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf` | PDF p. 2, abstract | A 50th-percentile Hybrid III dummy is used as occupant. | N/A | Requires complete dummy, restraint, and dynamic-model data. |
| `INTEGRATED-BELT-SLED-001` | `Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf` | PDF p. 3, Method | Study uses crash sled tests; sled support includes a foot plate and feet are fastened; no dashboard, steering wheel, or airbag is used. | N/A | Crash/sled scenario; unsupported by the existing static CalculiX seat path. |
| `INTEGRATED-BELT-MASS-001` | `Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf` | PDF p. 3, Method | Complete sled, seat, dummy, and measurement equipment mass is approximately 2,115 kg. | kg | Published complete test rig, not current Seat CAD mass or load input. |

### Applicability Decision

The integrated-belt paper is classified `EXPERIMENTAL_REFERENCE` and `FE_MODEL_REFERENCE`, but `NOT_APPLICABLE` to the current static Seat CAE reference case. It requires a crash-sled/dummy/restraint/contact model and dynamic material behavior that the existing static Gmsh → CalculiX path does not implement. No values from this paper are used to admit static seat solver execution.

### Classification of the New Studies

| Document | Classification | Current static Seat CAE applicability |
|---|---|---|
| `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | `EXPERIMENTAL_REFERENCE`, `FE_MODEL_REFERENCE`, `NUMERICAL_VALIDATION_REFERENCE` | Candidate published backrest reference only. Its detailed source geometry, fixture coordinates, material/yield data, and measurement-point mapping are absent for the current Seat CAD revision. |
| `Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf` | `EXPERIMENTAL_REFERENCE`, `FE_MODEL_REFERENCE`, `NOT_APPLICABLE` | Dynamic integrated-belt crash-sled/dummy study. The current static solver configuration does not represent the documented dynamic test system. |

## Complete Uploaded Corpus Classification

| Study | Analysis | Original solver | Reproducibility | Current CalculiX status | Maximum supported benchmark level |
|---|---|---|---|---|---|
| DOT / FMVSS 207 | Static prescription | Not documented | PARTIALLY_REPRODUCIBLE | Requires engineering review | LEVEL_1_DATASET_RECONSTRUCTED |
| Backrest static strength study | Static backrest | Nastran | NOT_REPRODUCIBLE | Requires engineering review | LEVEL_1_DATASET_RECONSTRUCTED |
| SAE 2011-26-0047 | Modal | Nastran | PARTIALLY_REPRODUCIBLE | Requires engineering review | LEVEL_1_DATASET_RECONSTRUCTED |
| Designing for Sustainability | Quasi-static pull | RADIOSS | PARTIALLY_REPRODUCIBLE | Requires engineering review | LEVEL_1_DATASET_RECONSTRUCTED |
| Integrated safety belt full-scale study | Dynamic crash sled | LS-DYNA | NOT_REPRODUCIBLE | Not applicable to static solver | LEVEL_0_DOCUMENT_ONLY |
| Driver behavior recognition studies | Non-CAE behavior research | N/A | NOT_REPRODUCIBLE | Not applicable | LEVEL_0_DOCUMENT_ONLY |
| UNECE amendment | Regulatory reference | N/A | NOT_REPRODUCIBLE | Not applicable | LEVEL_0_DOCUMENT_ONLY |

No uploaded document supplies a complete single-study combination of dimensioned geometry, material behavior, fixture coordinates, load application coordinates, connection/contact model, and documented acceptance tolerance. The dataset therefore does not admit a CalculiX reference benchmark and no cross-study combination is permitted.

## Additional Study: SSRN 5624455 — ADAS Safety Risks

| Requirement ID | Source document | Section or page | Value | Unit | Applicability |
|---|---|---:|---|---|---|
| `SSRN-ADAS-SCOPE-001` | `ssrn-5624455.pdf` | PDF p. 1–2, title and abstract | Systematic review of ADAS accident causation and analysis methods. | N/A | ADAS safety-governance reference; not a seat structural reference. |
| `SSRN-ADAS-SENSOR-001` | `ssrn-5624455.pdf` | PDF p. 2–3, Introduction | Radar, lidar, and cameras are described as ADAS sensing technologies. | N/A | Driver-assistance system context only. |
| `SSRN-ADAS-HUMAN-001` | `ssrn-5624455.pdf` | PDF p. 3, Introduction | L2 systems require a driver to remain vigilant and prepared to take control. | N/A | Human-factors/operational context only. |

### Applicability Decision

`ssrn-5624455.pdf` is classified `NON_CAE_REFERENCE`. It contains no seat CAD geometry, material property, FE mesh, fixture, structural load, boundary condition, published structural result, or tolerance that can enter the Seat CAE dataset. It therefore cannot raise a benchmark level or authorize CAD/FE reconstruction.

## Engineering Execution Gate — Strongest Single-Study Decision

### Selected Reference

The strongest single static Seat structural/FE source in the uploaded corpus is `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf`, *Car Seat Backrest Static Strength Experiment and Simulation*. It is the only directly applicable static backrest paper that supplies a documented FE idealization, a static load conversion, stress/displacement output, and paired experimental/FE stress results in one source. It is nevertheless **not a reconstructable reference model** because the publication does not disclose the source geometry, material card, coordinate-based fixtures, or measurement-point locations needed to reproduce the stated model.

| Engineering input | Explicit evidence retained | Source location | Execution status |
|---|---|---|---|
| Geometry | Seat-frame FE idealization is described as shell and beam elements; steel plate and pipe are named qualitatively. No dimensions, profile sections, drawing, point coordinates, or CAD/FE artifact is supplied. | PDF p. 2, *Seats Static Strength Analysis Model* | `REQUIRED_INPUT: SOURCE_GEOMETRY_DIMENSIONS` |
| Material | The paper requires material properties when building the model, but supplies no grade, modulus, Poisson ratio, density, yield value, or stress-strain curve for the analyzed frame. | PDF p. 2, *Seats Static Strength Analysis Model* | `REQUIRED_INPUT: MATERIAL_GRADE_AND_CURVE` |
| Fixtures / boundaries | Constraints are stated to be exerted with reference to the real vehicle. The experiment evaluates connections to the floor, but gives neither fixture coordinates nor constrained degrees of freedom. | PDF p. 2, *Seats Static Strength Analysis Model*; PDF p. 3, *Seat Backrest Static Strength Experiment* | `REQUIRED_INPUT: FIXTURE_COORDINATES`; `REQUIRED_INPUT: BOUNDARY_DOF_REPRESENTATION` |
| Load | 530 N·m torque based on the R-point in the horizontal rearward direction; converted by the paper to 1,058 N at the midpoint of the backrest-frame beam. R-point and beam-midpoint coordinates are not supplied. | PDF p. 3, *Experiment and Simulation Analysis*, Figure 3 | `REQUIRED_INPUT: R_POINT_COORDINATE`; `REQUIRED_INPUT: LOAD_APPLICATION_COORDINATE` |
| Mesh | Shell and beam element families are explicit; the paper does not disclose element size, element/node count, mesh-quality metrics, or a mesh/solver-input file. | PDF p. 2, *Seats Static Strength Analysis Model* | `REQUIRED_INPUT: MESH_SPECIFICATION` |
| Measurements | Figure 2 shows a measurement-point distribution and Table 1 gives stress values for points 1–16. Point locations, sensor orientation, and mapping to FE entities are absent. | PDF p. 3, Figure 2; PDF p. 4, Table 1 | `REQUIRED_INPUT: MEASUREMENT_POINT_COORDINATES`; `REQUIRED_INPUT: MEASUREMENT_MAPPING` |
| Reference results | Maximum simulated stress: 254.9 MPa; maximum displacement: 17.68 mm; Table 1 reports 16 experimental/FE stress pairs; maximum observed error: 14.94%; average observed error: 8.83%. | PDF p. 4, *Experiment and Simulation Analysis*, Figure 4, Table 1 | Published comparison data only; no reconstructed model may be compared yet. |
| Tolerance | The 14.94% and 8.83% values are reported observed errors, not a stated acceptance tolerance. | PDF p. 4, Table 1 and accompanying text | `REQUIRED_INPUT: PUBLISHED_ACCEPTANCE_TOLERANCE` |

### Archive and Supplementary-Artifact Check

`cad-ai-requirements-agent.zip` was inspected as an archive. It contains a prior mobile-project source tree and JSON/configuration files only; it contains **no** `.step`, `.stp`, `.iges`, `.igs`, `.stl`, `.obj`, `.msh`, `.inp`, `.k`, `.key`, `.bdf`, `.nas`, `.fem`, `.dat`, `.op2`, `.unv`, or other CAD/FE reconstruction artifact. `pasted_content.txt` is an instruction document, not engineering source data. No uploaded archive or PDF includes a separately importable CAD model, FE mesh, solver deck, material card, or supplemental geometry drawing.

### Binary Outcome

`REFERENCE_MODEL_EXECUTION = BLOCKED_BY_SOURCE_EVIDENCE`.

The attempted reconstruction path therefore stops before CAD/FE construction. `GMSH`, independent mesh verification, `CalculiX`, result extraction, and reference comparison are **not executed**. Execution would require all of the following from this same static-backrest study or a cryptographically validated reference package for that study: `SOURCE_GEOMETRY_DIMENSIONS`, `MATERIAL_GRADE_AND_CURVE`, `FIXTURE_COORDINATES`, `BOUNDARY_DOF_REPRESENTATION`, `R_POINT_COORDINATE`, `LOAD_APPLICATION_COORDINATE`, `MESH_SPECIFICATION`, `MEASUREMENT_POINT_COORDINATES`, `MEASUREMENT_MAPPING`, and `PUBLISHED_ACCEPTANCE_TOLERANCE`.

No values from DOT/FMVS 207, the modal Nastran study, the RADIOSS sustainability study, the dynamic integrated-belt study, regulations, ADAS research, or driver-behavior studies are combined with this reference. That would create a cross-study synthetic model rather than a defensible reference reconstruction.
