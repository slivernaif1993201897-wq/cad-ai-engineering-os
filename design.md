# CAD-AI Mobile Interface Design

## Product stance

CAD-AI is a **conceptual engineering workspace**, not a general chatbot. The mobile client is a review-and-command surface for a deterministic CAD pipeline. Generated models are visibly labeled **CONCEPTUAL** until a separate engineering-validation workflow produces evidence.

## Screen list

| Screen | Primary content and functionality |
|---|---|
| CAD Workspace | A natural-language command field, requirements and open-question status, plan/validation state, feature list, and a rendered view of the latest kernel-generated artifact. |
| Model Detail | Read-only parameter values, feature history, validation report, provenance, and export availability for the active configuration. |
| Concept Compare | A later-phase comparison list for preserved alternative configurations. The first slice will show the architecture state only. |
| Project Library | Later-phase saved native project records. The first slice provides a generated native-project payload from the active model only. |

## Primary portrait layout

The first screen is designed for 9:16 portrait, one-handed use. The top region contains identity and the unambiguous engineering state. The center region contains the geometry viewport. The lower half contains an actionable evidence ledger: requirements, parametric values, feature history, and validation. A persistent command field and a single primary action sit above the safe-area bottom edge.

## Key user flows

1. The user enters the mounting-block prompt and taps **Generate verified CAD plan**.
2. The client sends the request to the server-side Requirements Agent and CAD Planner.
3. The Engineering Truth Layer validates units and required dimensions, then the CAD kernel adapter generates a model only if the plan is supported.
4. The client displays kernel-derived artifact metadata and a model-view representation. If any capability is missing, the UI displays `UNSUPPORTED` rather than a visual substitute.
5. The user enters **Change the width to 70 mm**. The parameter value changes through a deterministic modification path and the kernel regenerates the feature tree.

## Color choices

The application uses a restrained engineering palette: midnight graphite `#101820` for the shell, blueprint blue `#1167B1` for trusted actions, oxide orange `#DE6B35` for conceptual status, signal green `#1F8A70` for validated geometry, and warm neutral `#F3F1EA` for structured technical content. Validation failures use `#B3261E` and always include text, never color alone.

## Interaction principles

The product avoids decorative animation. A result changes state only when provenance, validation status, and the generated kernel artifact are present. Buttons are disabled while a CAD operation is running, and no command may silently resolve missing dimensions or units.
