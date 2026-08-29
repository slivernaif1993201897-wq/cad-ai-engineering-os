# CAD-AGENT Execution Verification Report

## Result

The mobile application was started successfully in the managed Expo web preview and passed visual smoke verification on a 390×844 mobile viewport. A native Android or iOS emulator was not available in the sandbox: `adb`, `emulator`, and `xcrun` were not installed. Therefore, no claim is made that a native emulator session was completed. The available preview is evidence for the web-rendered Expo path only.

## Real CAD execution

A real CAD-kernel test was executed in the CAD-AGENT GitHub recovery repository, not a mock. The test file `tests/cad-kernel.test.ts` passed all four tests. It created valid STEP-backed solids, verified that changing width creates a different artifact, and preserved the open-question behavior for an unapproved geometric assumption.

This proves the repository’s local CAD-kernel vertical slice. It does not prove the pinned external Text-to-CAD adapter is executable because both adapter-owned prerequisites are absent from the sandbox:

| Prerequisite | Status |
|---|---|
| `/home/ubuntu/external-runtimes/text-to-cad-b97ff01` | Missing |
| `/home/ubuntu/external-audits/text-to-cad-current` | Missing |
| `adb` / Android emulator | Missing |
| `xcrun` / iOS Simulator | Missing |

The application therefore correctly remains `BLOCKED` for external Text-to-CAD execution and does not fabricate a STEP output or activate a fallback.

## App validation

| Check | Result |
|---|---|
| Expo dev server | Running |
| TypeScript | Pass |
| Lint | Pass, with a Node module-type warning only |
| Text-to-CAD contract tests | 3/3 pass |
| Production-oriented server build | Pass |
| Mobile visual smoke | Pass for Mission, Text-to-CAD, and Runtime Gate |
| Real CAD-kernel execution | 4/4 pass in the recovery repository |

## Root-cause conclusion

No reproducible application startup failure was observed in the available Expo environment. The two observed blockers are environmental, not UI crashes: the sandbox lacks a native emulator and lacks the pinned external runtime/source roots required by the adapter contract. The fail-closed behavior is the correct safety outcome until those prerequisites are restored through the explicit, pinned bootstrap procedure.
