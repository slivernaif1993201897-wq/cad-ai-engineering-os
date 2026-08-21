# Phase 6.4 External Research Notes

## Solver candidates

| Source | Review-relevant finding |
|---|---|
| [CalculiX](https://www.calculix.de/) | The official site describes finite-element static, dynamic, and thermal solutions; says the solver uses Abaqus input format; and publishes the package under GPL v2 or later without warranty. This makes a bounded linear-static adapter technically plausible but requires an explicit licensing review and deterministic input-deck contract. |
| [code_aster](https://code-aster.org/en) | The official site identifies code_aster as an open-source finite-element solver for mechanics, thermal analysis, and dynamics. Its breadth is not a reason to adopt it first: the controlled-runtime review should reject a broad first scope. |
| [OpenFOAM Foundation](https://openfoam.org/) | The Foundation describes OpenFOAM as GPL v3 CFD software. It is a CFD option, not the recommended first path for the project’s minimum viable linear static structural capability. |

## Meshing candidates

| Source | Review-relevant finding |
|---|---|
| [Open CASCADE Mesh Guide](https://occt3d.com/dev/doc/overview/html/occt_user_guides__mesh.html) | OCCT provides tessellated shape representations and states that `BRepMesh_IncrementalMesh` adds triangulation used for shaded visualization. The review therefore treats the existing OCCT viewer triangulation as non-solver-grade evidence. |
| [Gmsh](https://gmsh.info/) | The official project calls Gmsh an open-source 3D finite-element mesh generator, documents API and file-driven control, and publishes it under GPL. A separately bounded mesher adapter is preferable to reusing viewer tessellation. |
| [SALOME SMESH](https://docs.salome-platform.org/latest/gui/SMESH/index.html) | Official documentation describes mesh creation, import/export, modification, and quality controls. Its broad feature surface makes it a higher-integration-complexity alternative rather than a first default. |

## Runtime security

| Source | Review-relevant finding |
|---|---|
| [NIST SP 800-190](https://csrc.nist.gov/pubs/sp/800/190/final) | NIST describes application containers as OS virtualization plus packaging and identifies container security concerns requiring controls. The review applies this to the future sandbox boundary rather than treating a container declaration as proof. |
| [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) | The guide recommends an unprivileged user, minimal capabilities, no privilege escalation, resource limits, read-only filesystems, controlled networking, image provenance and signing, and avoiding Docker socket exposure. These inform the minimum essential gate set. |
| [OCI Runtime Specification](https://github.com/opencontainers/runtime-spec) | OCI documents an application bundle and configuration covering executable, mounts, namespaces, and cgroups. The Phase 6.4 contract uses these as explicit immutable runtime-boundary dimensions, not as an enabled container runtime. |
