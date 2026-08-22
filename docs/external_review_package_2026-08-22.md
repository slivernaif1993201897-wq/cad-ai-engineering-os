# External Review Package

## Scope and Non-Claim

This package prepares evidence for an **independent reviewer**. It is not an external review decision, security approval, engineering approval, or production admission record.

## Canonical Repository References

| Item | Reference | Status |
|---|---|---|
| Canonical evidence-store implementation | Commit `f25b71760fcbfc64d6d147721a68b6f2ef0b9758` | Internally compiled and regression tested. |
| Preserved generic regression baseline | Run `32542564434`; tag `docker-generic-baseline-32542564434` | Verified internal baseline. |
| Latest CAD-to-CAE runtime attempt | Run `32600456065` | CAD-to-CAE Docker stage completed; signed-evidence stage blocked by user-managed secret format. |
| Authoritative runtime workflow | `.github/workflows/cad-agent-authoritative-runtime.yml` | Static CI evidence path. |
| Independent security package | `docs/independent_security_assessment_package_2026-08-22.md` | Prepared for review; not approval. |

## Evidence and Binding Inventory

The authoritative runtime retains immutable manifest, CAD provenance, CAE configuration, mesh verification, solver input, raw and canonical CalculiX results, numerical validation, result binding, execution logs, sandbox probes, Docker inspection records, package inventory/SBOM evidence, controlled failure evidence, and artifact hashes.

The canonical envelope design binds `JOB_ID`, CAD revision/artifact, CAE configuration, manifest, environment, Gmsh, mesh, CalculiX, input, output, result, and execution-log identifiers. Server-side validation rejects missing, malformed, stale, foreign, replayed, incomplete, or tampered evidence.

## Reviewer Checklist

1. Verify the workflow and artifact hashes against the cited repository revision.
2. Independently assess the Docker host/kernel, tenant, escape-resistance, and resource-isolation assumptions.
3. Verify the signed-envelope key-management procedure in the approved secret-management environment without disclosing the key.
4. Review the immutable manifest, CAD-to-CAE binding, mesh verification, solver provenance, numerical acceptance scope, and result binding.
5. Review controlled failure receipts, replay/tamper rejection, canonical-output treatment, SBOM, and known limits.
6. Issue a documented decision that is separately recorded; absence of such a decision must remain non-approval.

## Known Limitations and External Requirements

The `RUNTIME_EVIDENCE_HMAC_KEY` is an opaque user-managed GitHub Actions secret. The latest no-value CI diagnostic reported that it is present with length 64 but fails hexadecimal and canonical-format validation. Therefore the workflow correctly rejected HMAC signing and did not persist a production-equivalent canonical envelope. The project remains blocked only on this secret configuration for HMAC acceptance, plus independent review, approved environment attestation, and production numerical acceptance.
