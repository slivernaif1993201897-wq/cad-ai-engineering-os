# CAD-AGENT GitHub Synchronization

تمت مراجعة المستودع `slivernaif1993201897-wq/cad-ai-engineering-os` على فرع `recovery/capre-capsule-20260828` مقابل `main`، ثم عُكست العقود ذات الصلة داخل تطبيق CAD-AGENT الجوال.

## Facts

| المجال | الحالة |
|---|---|
| GitHub default branch | `main` عند commit `3c5ae38ad418` |
| Recovery branch | `recovery/capre-capsule-20260828` عند commit `d676cf50da21` |
| Text-to-CAD source | `https://github.com/earthtojake/text-to-cad.git` |
| Pinned source commit | `b97ff01f3f34ff0c87c84d1e9a6bd42d3cec21ed` |
| Adapter version | `1.1.0` |
| Skill ID | `external.text_to_cad.cad.rectangular_plate.v1` |
| Required packages | `cadgen==0.4.26`, `build123d==0.11.1` |
| Entry point | `skills/cad/scripts/gen/cli.py` |
| Runtime state in app | `BLOCKED` until manifest, allowlist, and CLI smoke evidence are present |

## Synchronized behavior

The Runtime Gate screen now displays the exact repository, commit, adapter version, skill ID, package contract, and adapter-owned path policy discovered from GitHub. The Text-to-CAD screen remains a Manus-assisted planning surface; it cannot accept Python, shell fragments, executable paths, URLs, or arbitrary CLI arguments, and it never creates a STEP artifact by itself.

## Verification

TypeScript, lint, the focused Text-to-CAD contract tests, and mobile preview verification passed after synchronization. A real external CLI smoke test was not claimed because the pinned runtime and manifest are external prerequisites and are not bundled with the mobile app.
