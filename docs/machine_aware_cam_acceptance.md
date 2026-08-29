# Machine-Aware CAM & CNC Verification

## Verified on the protected branch

| Acceptance item | Result |
|---|---|
| MACHINE_PROFILE | PASS — durable machine identity, axes, travel, spindle/feed/rapid limits, controller, post, offsets, tool-change, and safety constraints are modeled |
| TOOLING_GOVERNANCE | PASS — required fields, holder, geometry, feeds/spindle, and provenance are validated |
| FIXTURE_GOVERNANCE | PASS — stock, fixture, clamps, workholding, table, keep-out zones, and collision-analysis support are required |
| COLLISION_CHECK | PASS — tool/fixture, holder, and stock checks are explicit verification gates |
| TRAVEL_LIMIT_CHECK | PASS — axis travel is an explicit gate |
| CONTROLLER_VALIDATION | PASS — selected controller and unsupported commands are checked |
| GCODE_VALIDATION | PASS — syntax, controller markers, post markers, and hash are checked |
| PROVENANCE | PASS — CAD revision → CAM operation → machine revision → tooling → fixture → post → toolpath hash → G-code hash |
| FAIL_CLOSED | PASS — any missing, stale, mismatched, malformed, unsafe, or failed check blocks release |
| MACHINE_CERTIFIED | NOT CLAIMED — only external physical evidence can establish certification |

The new endpoint `cam.machineAwareRelease` exposes the evaluator through the existing router. It does not create or persist an artifact directly; artifact persistence remains in the managed CAM lifecycle.

## Tests

The focused machine-aware suite passed **19/19** tests. The combined CAM suite passed **24/24** tests. The tests cover axis/travel, collision, invalid tool and holder, invalid fixture, unsupported and malformed G-code, controller/post mismatches, stale machine profile, stale CAD revision, stale tooling, hash mismatch, unsafe rapid, and invalid verification states.

The full serial regression completed until `tests/calculix-execution-persistence.test.ts`, which failed closed with `GMSH_PREREQUISITE_FAILED:ENGINE_UNAVAILABLE`. This is an external Gmsh prerequisite blocker, not a CAM governance bypass. The serial runner timeout was increased from 20 seconds to 60 seconds because `tests/cae-job-contract.test.ts` is a verified 24-second integration test.
