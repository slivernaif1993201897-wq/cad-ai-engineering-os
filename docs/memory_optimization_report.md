# TypeScript Memory Optimization Report

## Change

The default TypeScript project graph now targets production application sources explicitly instead of recursively loading all test files. Strict source checking remains enabled. `skipLibCheck` reduces declaration-file memory pressure, and incremental metadata is stored under `.cache/`. Test files remain available for explicit Vitest execution and are not removed or silenced.

## Evidence

| Check | Result |
|---|---|
| TypeScript production-source check | PASS with `pnpm check` and a 1024 MB bounded Node heap |
| Targeted lint | PASS for machine-aware CAM files and router |
| Focused CAM regression | PASS — 24/24 tests |
| Memory repeat | NOT_PROVEN |
| Memory classification | ENVIRONMENT/PROCESS DIAGNOSTIC |

The previous full graph terminated with code 143/134 under sandbox memory pressure. The optimization allows the production-source TypeScript gate to complete, but it does not claim that every full serial integration suite is now proven stable. The existing Gmsh prerequisite blocker remains separate and must be resolved before a full acceptance claim.
