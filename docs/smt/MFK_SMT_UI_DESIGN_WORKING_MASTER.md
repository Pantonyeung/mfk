# MFK SMT UI Design Working Master

Date: 2026-09-27
Status: WORKING
Purpose: Running handoff for SMT UI redesign. Each subsequent functional/UI design conversation appends a dated record. Current implementation is preserved; Owner requirements are used to identify gaps. Final deliverable will be exported as one FINAL TXT when the UI design cycle is complete.

## Locked recording rules
- Preserve current implementation and accepted runtime semantics.
- Owner requirements identify gaps; they do not automatically override implemented behavior.
- Superseded UI decisions remain in history and are marked SUPERSEDED.
- Use status tags: LIVE, LIVE_SUPERSET, UI_REWORK, FUTURE_WIRING, PHYSICAL_PENDING.
- Final TXT will consolidate the final product visual system, all stages/pages/scenarios/states, wiring status, superseded decisions, and acceptance rules.

## Record 001 — Product Visual System
Established the SMT visual system: 1920×1080 primary target; Japanese minimal / professional restaurant POS / operational soft glass; Primary Blue #1F5FBF; evidence-based status; UNKNOWN distinct from FAILED; 48px minimum touch targets; major operational modals ~75%; fixed muscle-memory layout; no raw UUID; no fake health badge; no visual change may alter transaction authority.

## Record 002 — Functional UI Stage Architecture
Stage 0: SMT Shell + Global System Layer
Stage 1: Ordering Main
Stage 2: Product Configuration + Fast Lane
Stage 3: Cart Workflow + Hold/Dining Entry
Stage 4: Customer / Keeta Pending
Stage 5: Checkout + Payment
Stage 6: Orders + After-sales
Stage 7: Dining
Stage 8: Sold-out / Capacity
Stage 9: More / Tools
Stage 10: Printing / Device / Diagnostics
Stage 11: Backup / Sync / Recovery
Stage 12: System States / Acceptance Screens

Execution order:
Batch 1: Stage 0 → 1 → 2 → 3
Batch 2: Stage 4 → 5 → 6
Batch 3: Stage 7
Batch 4: Stage 8 → 9 → 10 → 11
Final: Stage 12

## Current next step
Stage 0 — SMT Shell / Navigation / Global Alert
Text wireframe only first. No final mockup yet.

MILESTONE:
MFK_SMT_UI_DESIGN_WORKING_MASTER_STARTED
FINAL_TXT_PENDING
