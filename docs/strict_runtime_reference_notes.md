# Strict Runtime Readiness — External Reference Notes

These sources inform future control design only. They are **not** evidence that CAD-AI has an approved isolated environment, an enforceable sandbox, Gmsh, CalculiX, a completed execution, a mesh, a solver result, numerical correctness, hostile-test coverage, or production approval.

| Source | Observed reference point | Relevance to future gate design |
|---|---|---|
| [NIST SP 800-190](https://csrc.nist.gov/pubs/sp/800/190/final) | NIST describes container technologies as OS virtualization plus application packaging and identifies container security concerns and controls across access, audit, configuration, identity, incident response, risk, communications protection, and integrity. | Supports the requirement for an independently assessed enforcement substrate rather than a policy-only sandbox declaration. |
| [Gmsh Reference Manual](https://gmsh.info/doc/texinfo/gmsh.html) | The official manual describes Gmsh as a 3D finite-element mesh generator with geometry, mesh, solver, and post-processing modules; it documents STEP/IGES import through OpenCASCADE and 3D element families. | Supports an eventual explicit Gmsh identity, pinned build, mesh artifact, physical-group, mesh-quality, thread-limit, and provenance verification contract. It does not substitute for actual Gmsh execution evidence. |
| [CalculiX](https://www.calculix.de/) | The official site describes a finite-element package with independent pre/post and solver components, linear/nonlinear static, dynamic, and thermal capability statements, and GPL licensing. | Supports an eventual narrowed solver adapter scope and license/SBOM review. It does not establish a CalculiX artifact, runtime installation, execution, result, or numerical-validation evidence. |

## Source Boundaries

No statement in these references promotes a proposed or future CAD-AI runtime control to `PASS`. Every such control remains `UNKNOWN`, `BLOCKED`, or `FAIL` until current, observed, hash-preserved evidence is independently reviewed inside an approved segregated test environment.
