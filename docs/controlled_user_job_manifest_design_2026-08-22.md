# Controlled User-Job Manifest Design

## Purpose

This contract closes the gap between a reviewed CAE job record and an external execution request without adding an application process launcher, arbitrary command field, arbitrary path field, arbitrary environment field, or network destination field. The manifest is immutable and supports only allowlisted Gmsh and CalculiX identities.

## Immutable Manifest Fields

| Required field | Binding source or rule |
|---|---|
| `jobId`, `projectId` | Canonical authorized CAE job identity. |
| `cadRevision`, `cadHash` | Immutable CAD binding and SHA-256 geometry identity. |
| `caePlanRevision`, `caePlanHash` | Reviewed CAE plan revision and SHA-256 plan identity. |
| `materialRevision`, `materialHash` | Bound material evidence revision and SHA-256 identity. |
| `loadRevision`, `loadHash` | Bound load revision and SHA-256 identity. |
| `boundaryConditionRevision`, `boundaryConditionHash` | Bound boundary-condition revision and SHA-256 identity. |
| `meshConfiguration` | Allowlisted Gmsh version, configuration identifier, and SHA-256 configuration hash. |
| `solverConfiguration` | Allowlisted CalculiX version, configuration identifier, and SHA-256 configuration hash. |
| `environment` | Environment identifier, environment hash, approval-evidence hash, and explicit requested execution class. |
| `resourcePolicy` | Bounded policy identifier, SHA-256 policy hash, and eight declared resource categories. |
| `expectedArtifacts` | Allowlisted expected output labels only. |
| `validationPolicy` | Bounded validation-policy identity and SHA-256 policy hash. |
| `authorization` | Authorized approval identity, SHA-256 evidence hash, and bounded validity window. |
| `manifestHash` | SHA-256 over canonical serialization of all prior fields. Any change invalidates the manifest. |

## Admission Behavior

The validator rejects unknown fields, unbounded identifiers, paths, commands, URLs, non-SHA-256 hashes, unknown solver identities, expired authorization, future-dated authorization, malformed resource policies, and manifest-hash mismatch. It returns `BLOCKED` rather than `ADMITTED` when the environment, sandbox, or resource-control evidence is missing or not independently approved.

The GitHub-hosted path will only validate a checked-in contract fixture and issue a non-execution receipt showing `BLOCKED_GITHUB_HOSTED_SANDBOX_INSUFFICIENT`. It must never invoke Gmsh or CalculiX for a user manifest until a separately approved execution environment supplies the required evidence.

## Explicitly Prohibited Inputs

The manifest schema has no field for a shell command, executable path, filesystem path, environment-variable map, network destination, container image override, dynamic script, or arbitrary artifact path. Workflow dispatch has no user-supplied execution inputs.
