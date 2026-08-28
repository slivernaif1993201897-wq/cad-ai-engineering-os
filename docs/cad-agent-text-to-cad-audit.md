# CAD-Agent External Skill Audit: `earthtojake/text-to-cad`

**Audit date:** 2026-08-25  
**Official source:** <https://github.com/earthtojake/text-to-cad>  
**Audited commit:** `b97ff01f3f34ff0c87c84d1e9a6bd42d3cec21ed`  
**Audit method:** Static repository, license, dependency, and documentation review. No external code, installer, CLI, browser server, CAD generator, slicer, upload workflow, or machine command was executed.

## Findings

| Audit area | Evidence | CAD-Agent decision |
|---|---|---|
| License | Repository metadata and `LICENSE` identify MIT. | **Compatible for evaluation**, subject to dependency and security review. |
| Declared scope | README describes a library of agent skills for CAD, CAE, CAM, robot-description formats, fabrication, and viewers. | **No capability is assumed** from repository scope alone. |
| CAD skill runtime | `skills/cad/SKILL.md` describes Python command launchers for generation, export, inspection, snapshots, and STEP-first workflows. | **Not activated.** CAD-Agent continues to use its verified server-side OpenCascade path. |
| Declared external dependency | `skills/cad/requirements.txt` declares `playwright`; the CAD documentation also expects Python 3.11+. | **Requires dependency review and a sandboxed adapter** before any installation. |
| Default assumptions | External CAD skill documents defaults such as millimetres, XY plane, positive Z, and default clearances/wall/fillet values. | **Not adopted.** CAD-Agent must preserve `REQUIRED_INPUT` rather than infer engineering dimensions or manufacturing assumptions. |
| CLI safety | External instructions rely on local command-line tools and project-relative file resolution. | **Blocked from chat.** CAD-Agent does not permit agent-generated shell execution. |
| Artifact authority | External STEP/STP output is not automatically project-authorized, parsed, SHA-256-bound, revision-linked, or evidence-governed by CAD-Agent. | **Requires adapter.** Any future output must pass existing managed ingestion, authorization, parsing, hashing, revision, and provenance gates. |
| CAD viewer / STEP parts / DXF / G-code / implicit CAD / URDF / SRDF / SDF / SendCutSend | Listed by the external repository as distinct skills. | **Not enabled.** Each needs independent behavior, license, dependency, security, and compatibility review. |

## Registry Status

The in-product skills registry exposes the external CAD skill only as `external.text_to_cad.cad.v1` with **`REQUIRES_DEPENDENCY`** and **`EXTERNAL_AUDIT_ONLY`** status. It has no executable endpoint and cannot bypass project authorization, artifact ingestion, revision binding, CAE admission, or evidence controls.

> **Security boundary:** An external skill audit is not installation, execution, output validation, or engineering evidence. No external repository artifact is trusted by CAD-Agent until a separately approved, sandboxed adapter has completed the existing artifact governance path.
