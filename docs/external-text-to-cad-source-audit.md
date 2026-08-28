# External text-to-cad Source Audit

| Field | Evidence |
|---|---|
| Source repository | `https://github.com/earthtojake/text-to-cad.git` |
| Pinned commit | `b97ff01f3f34ff0c87c84d1e9a6bd42d3cec21ed` |
| License | MIT, reported by the official GitHub metadata and repository `LICENSE`. |
| CAD entrypoint | `skills/cad/scripts/gen/cli.py`, which accepts explicit `gen_step()` Python generator targets and writes STEP only through `--write`. |
| Pinned direct dependencies | `cadgen==0.4.26` and `playwright`, from `skills/cad/requirements.txt`. |
| Activation evidence | A dedicated adapter runtime installed `cadgen==0.4.26` with `build123d==0.11.1`; the pinned `scripts/gen` entrypoint generated a deterministic `100 mm × 50 mm × 10 mm` STEP plate with SHA-256 `b3d2ec5447593bce7cb5158cd4d7526a3f934bc68be16c0b1669f77cba703e3b`. |
| Upstream security boundary | `SECURITY.md` states that its viewer is an unauthenticated loopback local-filesystem service. CAD-AGENT must not start or expose it. |
| Isolation limitation | Docker and Linux network namespaces are unavailable in this sandbox (`unshare -n` is not permitted). The adapter is therefore **security-partial** and may run only a fixed adapter-owned generator, never user-supplied Python, arbitrary CLI arguments, arbitrary paths, or the viewer server. |
| CAE and CAM | No upstream CAE solver skill is activated. Upstream G-code is a mesh-to-printer-profile slicing workflow, not generic validated CAM; it remains blocked in CAD-AGENT. |
