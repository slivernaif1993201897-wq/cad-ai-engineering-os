# Corpus CAD Extraction Gate — 2026-08-24

The governed corpus project `PROJECT-de352bd4-d55e-4885-bd52-20ce7a932ccc` contains 22 source records. No source meets `CAD_READY`. No source-derived CAD artifact hash was created.

| Source | Page / anchor | Engineering object | Readiness | Exact blocker |
|---|---|---|---|---|
| `2011-26-0047_260823_061236.pdf` | pp. 2–3, *THE SEAT FE MODELING DETAILS* / Table 1 | Automotive seat skeleton modal FE subject | `CAD_PARTIALLY_READY` | Exact component geometry, dimensions, interfaces, mount geometry, coordinate system, material assignment |
| `CarSeatBackrestStaticStrength.pdf` | pp. 2–4, *Seats Static Strength Analysis Model* / Fig. 1 / Table 1 | Car seat backrest structural frame | `CAD_PARTIALLY_READY` | Dimensioned tube/plate geometry, section sizes, thicknesses, weld locations, mounting points, coordinate system, CAD interfaces |
| `CarSeatBackrestStaticStrengthExperiment.pdf` | pp. 2–4, *Seats Static Strength Analysis Model* / Fig. 1 / Table 1 | Car seat backrest structural frame | `CAD_PARTIALLY_READY` | Dimensioned tube/plate geometry, section sizes, thicknesses, weld locations, mounting points, coordinate system, CAD interfaces |
| `CarSeatBackrestStaticStrengthExperimentandSimulation.pdf` | pp. 2–4, *Seats Static Strength Analysis Model* / Fig. 1 / Table 1 | Car seat backrest structural frame | `CAD_PARTIALLY_READY` | Dimensioned geometry, topology, section sizes, thicknesses, weld locations, mounting points, coordinate system |
| `DesigningforSustainability.pdf` | Published quasi-static pull-study analysis sections | Seat pull-test structural configuration | `CAD_PARTIALLY_READY` | Complete geometry, component interfaces, thickness mapping, load coordinates, fixture geometry, coordinate system |

All five candidate records are persisted as `GEOMETRY` records with `REQUIRED_INPUT`, `GEOMETRY_UNDEFINED` for unsupported regions, and parent provenance to their single source. The remaining corpus sources are `CAD_BLOCKED` or `KNOWLEDGE_ONLY`. `Gmsh`, mesh verification, CalculiX, and validation were not dispatched.
