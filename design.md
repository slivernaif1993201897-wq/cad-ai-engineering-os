# CAD-AI Engineering OS — Mobile Interface Design

## Product Intent

CAD-AI Engineering OS is a **truth-preserving engineering command workspace** for checking the state of a CAD-to-CAE delivery chain on a phone. The mobile experience presents design, plan, evidence, and runtime gates in a deliberate order. It must never imply that a local interface has executed a solver or validated a result. When the app is not connected to an evidence service, it states **Not connected** rather than rendering invented project metrics.

The design assumes **portrait 9:16 use** and one-handed operation. Primary actions live in the lower half of each view, dense engineering detail is progressively disclosed, and all status labels use both color and clear text.

## Screen List

| Screen | Primary content and functionality |
|---|---|
| **Mission** | A project operating brief: connection state, engineering thread, a CTA to open the current workstream, and a concise integrity rule. This is the default landing tab. |
| **CAD** | A model-source card, requirement chips, an ordered feature ledger, and an operation inspection sheet. The UI distinguishes a source reference from an executable geometry operation. |
| **CAE** | A chain from plan snapshot to job contract, mesh artifact, solver input package, and evidence. The screen exposes read-only status cards and allows the operator to inspect a contract detail sheet. |
| **Gates** | Runtime admission gate categories with explicit states. Unknown and external-review statuses are visible as blockers; no control can override a non-pass gate. |
| **Recovery** | CAPRE operational overview with durability class, capture health gate, last known-good snapshot, external-secret prerequisites, and clear `DURABLE_BACKUP_UNAVAILABLE` status where no authorised durable target exists. |
| **Snapshot list** | Immutable snapshot cards showing checkpoint class, source commit, created time, parent relationship, manifest hash prefix, and independent verification result. |
| **Snapshot inspection** | Classified inventory counts, engine identities, safe secret-presence metadata, test evidence, manifest integrity, and restore prerequisites. Secret values are never rendered. |
| **Restore staging review** | Selected snapshot, isolated staging identifier, source/artifact/engine verification checklist, and an explicit prohibition on restoring over the live project. |
| **Recovery drill** | A non-destructive audit trail for capture, independent verification, staging restore, and comparison, reported as PASS, FAIL, or NOT_RUN. |
| **Engineering detail sheet** | A modal presentation for the selected CAD operation, CAE artifact, or gate. It includes provenance, classification, and a concise explanation of what would be required to establish PASS. |

## Key User Flows

| User objective | Flow |
|---|---|
| Understand the current operational posture | Mission tab → read the **Not connected** integrity banner → tap **Review delivery chain** → CAE tab. |
| Review a CAD-bound decision | CAD tab → select a feature row → Engineering detail sheet → inspect source and requirement binding → dismiss. |
| Inspect CAE traceability | CAE tab → select **Job contract** or **Solver input package** → Engineering detail sheet → read immutable-plan and verification requirements. |
| Determine whether execution can be admitted | Gates tab → scan grouped mandatory gates → open a non-pass card → review the specific external evidence required. |
| Capture a project recovery snapshot | Recovery → review durability and health-gate banner → tap **Discover** → inspect safe inventory → tap **Capture snapshot** → explicitly confirm the non-destructive capture. |
| Inspect snapshot integrity | Recovery → Snapshot list → select snapshot → Snapshot inspection → read recomputed manifest and file-hash status. |
| Run a safe recovery drill | Recovery → Snapshot inspection → tap **Restore to staging** → review isolated target → confirm → view Recovery drill result. Live promotion is deliberately not available from this surface. |

## Layout and Interaction Principles

The navigation bar uses five concise, high-legibility labels: **Mission**, **CAD**, **CAE**, **Gates**, and **Recovery**. The top of each screen contains one clear context label; the remaining content uses cards separated by generous 12–16 pt gutters. Each tap target is at least 44 pt high. The app uses sheets for supporting detail, preserving the operator’s location in the engineering thread.

Mission uses a deep navy header with an electric-cyan thread line, suggesting traceability without resorting to decorative mechanical imagery. CAD relies on a warm bronze accent for authored geometry; CAE uses cyan for controlled simulation artifacts; Gates uses muted amber for unresolved evidence and a distinct blue-grey for unknown. Red is reserved for an explicit failed condition, which is intentionally absent from the disconnected local experience.

Recovery uses the same midnight foundation, evidence mint for verified manifests, gate amber for local-ephemeral or prerequisite states, and a darker teal `#0F766E` for read-only integrity records. The primary safe action is placed in the lower third of the screen. Capture, restore-to-staging, and any future promotion action are visually and functionally distinct; the latter requires an intervening confirmation sheet and remains unavailable until all evidence checks pass.

## Brand Color Choices

| Token | Color | Purpose |
|---|---|---|
| **Midnight** | `#081827` | Primary app background and product identity. |
| **Graphite** | `#10263A` | Elevated cards and tab bar surfaces. |
| **Signal cyan** | `#2EC5E8` | Thread, CAE, active navigation, and primary actions. |
| **CAD bronze** | `#C68A4B` | CAD-source and geometry-related references. |
| **Evidence mint** | `#43C6A5` | Verified evidence only. |
| **Gate amber** | `#F1B861` | Unknown, pending, or external-evidence-required states. |
| **Cloud** | `#E7F0F6` | Primary text and high-contrast content. |
| **Slate** | `#8BA4B8` | Secondary copy and borders. |

## Truth and Safety Rules

The interface must visibly preserve the following distinctions:

1. A record is not execution.
2. A local or disconnected view is not evidence of a production runtime.
3. A mandatory gate can only be shown as **PASS** when a connected record provides evidence.
4. External review remains an explicit external dependency; the UI cannot grant it.
5. An `EPHEMERAL_SNAPSHOT` is not a durable backup.
6. Restoring to staging is not a live-project overwrite or a production promotion.
