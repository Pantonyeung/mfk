# MFK SMT Owner Requirement + Candidate Consolidation Audit R1

DATE: 2026-09-26
STATUS: AUDIT_ONLY / NO_PRODUCT_MUTATION / NO_MERGE
CONTROL: #321
GOVERNANCE_PRECEDENCE: docs/control/MFK_E2E_FREEZE_DATE_AUTHORITY_2026-09-26_0935_HKT.md

## 0. Hard guard

Five connected ports are BANKED_NO_TOUCH:
Admin / SMT / SMM / Customer / Keeta.

Owner is NOT_CONNECTED.

This audit does not downgrade E2E completion. It only finds:
- banked capability lineage gaps in current main,
- SMT product/UI optimization deltas,
- genuine new Owner requirements,
- unmerged candidate work that may be reused.

Historical MISSING/PARTIAL records do not override later accepted work.

## 1. Sources read with date precedence

Newest governing records:
1. 2026-09-26 dated E2E Freeze + Dated Authority.
2. 2026-09-26 Owner-approved PR #306 decisions, including PRICE_OVERRIDE.
3. 2026-09-26 SMT Visual Product Spec Figma R2.
4. 2026-09-25 smt優化ui complete process record / Owner FINAL V1.
5. current main source at product baseline parent c91eddf... plus dated governance-only commits.
6. PR #171 head c715d033... OPEN / UNMERGED.
7. PR #306 head 648eb2de... DRAFT / UNMERGED.

Older POS Master / Flow-First / Gap Map are requirement/oracle evidence only where not superseded.

## 2. Classification

- BANKED_NO_TOUCH
- BANKED_LINEAGE_GAP = capability already accepted historically but current main does not contain the accepted implementation; restore/converge, never redesign.
- IMPLEMENTED_MAIN
- OPTIMIZATION_ON_BANKED_BASELINE
- IMPLEMENTED_UNMERGED
- PARTIAL_NEW_REQUIREMENT
- REAL_NEW_MISSING
- CONFLICT_WITH_BANKED_BASELINE
- OWNER_DECISION_REQUIRED

## 3. Audit matrix

| # | SMT domain / Owner requirement | Current main | #171 | #306 | Classification | Integration decision |
|---|---|---|---|---|---|---|
| 1 | Five-port E2E authority + Admin/Customer/SMM/Keeta→SMT | accepted and frozen | must consume | must consume | BANKED_NO_TOUCH | no redesign |
| 2 | Store Kernel / Order / Pricing / Payment / Fulfillment / Print authority | current authority exists | no runtime changes | touches runtime | BANKED_NO_TOUCH | runtime changes require targeted extraction + regression |
| 3 | 1920×1080 frontline/local-first/fixed muscle-memory POS | present but product geometry still evolving | UI candidate | stronger Owner FINAL candidate | OPTIMIZATION_ON_BANKED_BASELINE | UI only unless exact runtime gap |
| 4 | High-frequency nav = 點單 / 訂單 / 堂食 / 售罄／產能; More in hamburger | current main has 點餐/訂單/堂食/售罄/更多 rail | #171 changes to 點單/工作/訂單/狀態/更多 = conflicts with later Owner FINAL | #306 uses four high-frequency entries | IMPLEMENTED_UNMERGED | #306 presentation is preferred donor; reject #171 nav |
| 5 | Latest visual direction = 2026-09-26 Figma R2 Soft Glass Operational, without altering transaction truth | not fully reflected | older visual candidate | older blue Owner FINAL implementation | PARTIAL_NEW_REQUIREMENT | visual-only layer after functional consolidation |
| 6 | Horizontal categories / stable ordering surface | present | present | present | IMPLEMENTED_MAIN | preserve |
| 7 | Product-grid density/columns + persistent display settings | main CSS defaults 6 columns; no full Owner FINAL adjustable preference set | partial | #306 has SmtFrontlineUiPreferences / dynamic columns | IMPLEMENTED_UNMERGED | port UI preference layer only |
| 8 | Independent cart-unit identity; Combine default OFF | current add() auto-increments same product/service-mode | #171 still auto-combines exact default config | #306 always creates new line; Combine false by default | IMPLEMENTED_UNMERGED | high-priority #306 donor; no Order-authority change |
| 9 | Edit ≠ Add; edit SAME cart line | current onEdit opens product but addConfigured() creates a new line | #171 updates by lineId | #306 updates configured line | IMPLEMENTED_UNMERGED | port targeted same-line edit |
| 10 | Quick / Normal mode + Silent Guided Flow | current main lacks full Owner FINAL guidance controls | #171 quick/standard partial | #306 quick/normal + guidance target | IMPLEMENTED_UNMERGED | use #306 behavior, regression against pricing/menu truth |
| 11 | Quick Drink + contextual Fast Lanes / Required / Combo | current workItems are mostly static counters/entry points | partial | #306 implements true fast-lane state and Quick Drink | IMPLEMENTED_UNMERGED | targeted presentation/model port |
| 12 | 75% product/required/combo/hold/pending modal + dirty-close | current main partial | partial | #306 implements dirty-close and product modal flow | IMPLEMENTED_UNMERGED | presentation-only port |
| 13 | 暫存／堂食 is one primary entry; system picks first page from cart but staff can override | current main uses hold panel but does not contain full R4 Owner semantics | not R4-complete | #306 cumulative R4 implements single entry + override | BANKED_LINEAGE_GAP | restore accepted R4 behavior; do not invent new dining engine |
| 14 | Dining table choices must use Admin-published table registry | Dining surface consumes Admin config, but OrderingPage holdTables hardcodes T01–T09 | still hardcoded | #306 uses storeSettings.diningTables | BANKED_LINEAGE_GAP | targeted fix from #306; protect Admin authority |
| 15 | Checkout fixed geometry 01 Source / 02 Payment info / 03 Keypad; keypad never jumps | transaction semantics are banked; current presentation is older | continuous checkout candidate | Owner FINAL candidate | OPTIMIZATION_ON_BANKED_BASELINE | port visual/interaction only |
| 16 | First payment confirmation = formal commit; Completion Review after; Done only navigates | core transaction path exists | must preserve | must preserve | BANKED_NO_TOUCH | regression guard |
| 17 | Payment Correction = SAME Order / old tender audit / current effective tender / no new order / no auto-reprint / no drawer | Owner FINAL records this as mature | not in #171 runtime | #306 has correctOrderPayment + audit/UI | BANKED_LINEAGE_GAP | critical restore from accepted lineage, not redesign |
| 18 | Full/Partial Refund linked to original Order; cash refund→cash movement; cancel notice only when production really emitted | Owner FINAL records this as mature; current main lacks local refund runtime API and local correction lineage | not present | #306 has refundOrder/paymentCorrections/refunds/cancellationNoticeState | BANKED_LINEAGE_GAP | critical restore; exact money regression required |
| 19 | Customer electronic screenshot = evidence, not payment truth; VERIFIED/REJECTED; WhatsApp resend | implemented in current SMT Orders flow and Customer | no need | donor also contains | BANKED_NO_TOUCH | preserve current main |
| 20 | Global Customer/Keeta new-order alert on every SMT screen; sound; 30s/1m snooze | current OperationalApp implements top-level global alert and snooze | older candidate may differ | cumulative candidate includes related flows | IMPLEMENTED_MAIN / BANKED_NO_TOUCH | preserve current main |
| 21 | Orders 3 lanes: 現場 / 自家平台 / 第三方平台; source first, payment second | current main implements sourceLane + three lanes | candidate UI differs | cumulative candidate contains | IMPLEMENTED_MAIN / BANKED_NO_TOUCH | preserve |
| 22 | Fulfillment SAME Order: 未完成 → 可取餐 → 可退回未完成 → 已取餐; ETA only after accepted | current main contains Ready/provider mirror and accepted ETA lineage | not authority | cumulative candidate | BANKED_NO_TOUCH | preserve |
| 23 | SMM/Customer/Keeta order-source semantics | connected E2E | no authority | no authority | BANKED_NO_TOUCH | any candidate regression = RED |
| 24 | Dining waiting/table/detail/item split/partial settlement/reload recovery | current main has basic Dining + settleDiningHold but lacks later R2/R3 command identity hardening | no | #306 contains stable submissionId/expectedRevision/receivedMinor and R1–R4 cumulative work | BANKED_LINEAGE_GAP | restore accepted dining payment safety before new features |
| 25 | Formal Dining Order Link + unpaid Production Admission | absent from current main runtime | no | #306 has admitDiningProduction / durable hold↔formal link | IMPLEMENTED_UNMERGED | new product capability; do not merge until donor tests GREEN |
| 26 | Dining initial print: table/production/packing/labels exactly once | not in current main Dining path | no | #306 implements production admission print set | IMPLEMENTED_UNMERGED | targeted runtime slice after tests |
| 27 | Dining payment receipt + CASH-only drawer + reprint drawer=false | not in current main Dining path | no | #306 has printDiningPaymentReceipt/reprint and drawer boundary | IMPLEMENTED_UNMERGED | targeted slice; physical print later |
| 28 | Exact COMBO tender breakdown in Dining | current main passes COMBO label without persisted split breakdown | no | #306 persists splitTenders | IMPLEMENTED_UNMERGED | targeted money slice + report regression |
| 29 | Manual deal price / PRICE_OVERRIDE: Admin permission only; role no bypass; signed price incl negative; optional reason; append-only audit; paid order no override; negative balance cannot auto-payout | not in current main | no | #306 implements Owner-approved contract | IMPLEMENTED_UNMERGED | NEW Owner feature, separate bounded integration after baseline restorations |
| 30 | PRICE_OVERRIDE stale-write / immutable sequence / same-price no-op | not in main | no | #306 candidate implements | IMPLEMENTED_UNMERGED | retain only after proof GREEN |
| 31 | Cross-device/multi-tab Dining mutation serialization | main partial | no | #306 attempts Web Locks/local fallback; full proof not banked | PARTIAL_NEW_REQUIREMENT | needs clean-current-main deterministic proof |
| 32 | Visible table identity must not reuse W/H code after deletion | current accepted baseline must not be weakened | no | latest #306 proof is RED on W002/H002 reuse | CONFLICT_WITH_BANKED_BASELINE | blocker: no integration until fixed |
| 33 | Paid Dining history protection / price override error semantics | main history protection exists | no | #306 latest proof expects newer code but gets DINING_HISTORY_PROTECTED | PARTIAL_NEW_REQUIREMENT | reconcile contract, do not weaken history safety |
| 34 | SeatedAt must represent real seating time, not generic createdAt | current UI uses createdAt elapsed | no | no verified seatedAt at latest head | REAL_NEW_MISSING | bounded new fact required |
| 35 | Admin Dining Warning | current warningMinutes/config path exists but real seated-time semantics incomplete | no | partial | PARTIAL_NEW_REQUIREMENT | depends on SeatedAt |
| 36 | Sold-out / recovery | current RuntimeSoldoutWorkspace exists | UI candidate | cumulative donor | IMPLEMENTED_MAIN | optimize only |
| 37 | Capacity warning | current Admin capacity notice exists; hard-stop is explicitly display-only | UI candidate | donor | IMPLEMENTED_MAIN / OPTIMIZATION | do not turn capacity into transaction blocker |
| 38 | Capacity Pool / Channel Threshold / Override | no complete current implementation proven | no | not complete | REAL_NEW_MISSING | new bounded product requirements; must not block local Order |
| 39 | More / Tools Center | current More includes printing, diagnostics, day close, reports, backup/Admin-menu | #171 changes hierarchy | donor cumulative | IMPLEMENTED_MAIN / OPTIMIZATION | restructure UI only |
| 40 | Day Close | current local day close + print exists | no authority | donor | IMPLEMENTED_MAIN / BANKED_NO_TOUCH | preserve |
| 41 | Cash In / Cash Out beyond closing retained/removed cash | current main has close cash removal but no complete general cash-movement surface proven | no | #306 imports cash movement for refunds | PARTIAL_NEW_REQUIREMENT | separate cash ledger surface, reuse one authority |
| 42 | Reporting / immutable daily report + later adjustment | current local report exists but full adjustment/effective-tender closure not proven in current main | no | candidate contains more money lineage | PARTIAL_NEW_REQUIREMENT | projection-only; never rebuild transaction engine |
| 43 | Printer failure attention / Pending Action | current diagnostics/reprint exists; frontline attention closure not fully proven | no | candidate has more receipt/reprint states | PARTIAL_NEW_REQUIREMENT | connect existing print certainty only |
| 44 | Diagnostics | current More diagnostics exists | UI hierarchy candidate | donor | IMPLEMENTED_MAIN | optimize |
| 45 | Backup / Restore | current local backup checksum/restore exists | no | donor | IMPLEMENTED_MAIN | preserve |
| 46 | Offline / restart / power-loss / UNKNOWN readback | E2E baseline is banked; full new Dining native power-loss proof not in candidate | no | partial | BANKED_NO_TOUCH + PARTIAL_NEW_REQUIREMENT for new Dining features | test only the new slice |
| 47 | Staff session persistence | accepted main lineage; no PIN persistence; revoke/logout semantics | no authority | donor must preserve | BANKED_NO_TOUCH | protect |
| 48 | Physical SMT / OTA baseline | physical SMT baseline already accepted; Web SMT is surrogate only | not relevant | not ready | BANKED_NO_TOUCH | future OTA validates only new integrated delta |
| 49 | Owner port | not connected | n/a | n/a | OWNER_DECISION_REQUIRED later | DEFER until SMT consolidation closes |

## 4. Candidate quality / admission

### PR #171
- OPEN / UNMERGED.
- Useful donors: quick/standard ordering, search, same-line edit, product editor, accessibility/ergonomics.
- Later Owner requirements supersede parts of it:
  - navigation is obsolete versus 2026-09-25 Owner FINAL.
  - its default identical-line combining conflicts with later independent-unit / Combine-OFF requirement.
- No wholesale merge.

### PR #306
- DRAFT / OPEN / UNMERGED.
- Most useful current donor because it includes later Owner FINAL and 2026-09-26 PRICE_OVERRIDE decisions.
- It modifies runtime + print + dining, therefore cannot be treated as UI-only.
- Latest head 648eb2de... is NOT integration-ready:
  - proof check failed;
  - 233/236 tests passed, 3 failed;
  - failures include W/H visible identity reuse and price-override/history-protection expectation mismatch.
- Cloudflare customer build check on this PR head also failed.
- No wholesale merge.

## 5. Critical findings

### F1 — Five-port E2E stays intact
No gap below authorizes reopening Admin/SMM/Customer/Keeta or rebuilding SMT core authority.

### F2 — Current main has lost or never landed some Owner-accepted SMT product lineage
Most important examples:
- payment correction,
- local full/partial refund,
- cancellation notice state,
- R4 暫存／堂食 mindset,
- Dining R2/R3 settlement identity hardening.

These are not “new design jobs”.
They are BANKED_LINEAGE_GAP work: restore/converge the already accepted implementation onto current main.

### F3 — #306 contains both valuable banked restoration and genuinely new features
Must split it into small slices.
Do not merge the branch.

### F4 — #306 is currently RED
The candidate may be used as a donor only until exact failures are fixed on a clean branch from current main.

### F5 — latest visual spec is newer than older blue-only wording
The 2026-09-26 Figma R2 visual spec is the latest visual reference, but it is visual-only and cannot overwrite transaction semantics.

## 6. Next execution order

P0 — NO PRODUCT WRITE yet.
Bank this audit and let Owner review the classification.

P1 — RESTORE BANKED SMT LINEAGE on clean branches from current main:
1. payment correction / refund / cancel notice lineage;
2. R4 ordering/cart behavior: independent units, Combine OFF, same-line edit, 暫存／堂食;
3. Admin-published dining table registry in ordering hold/dining selector;
4. Dining R2/R3 settlement identity/reload safety.

Each slice:
clean current main → exact donor extraction → tests → five-port regression → small merge.

P2 — NEW SMT product features only after P1:
1. Dining formal-order production admission;
2. Dining print/receipt/label/drawer;
3. exact split-tender persistence;
4. PRICE_OVERRIDE;
5. SeatedAt + Admin Dining Warning;
6. capacity pool/channel threshold/override;
7. reporting/cash/print-attention refinements.

P3 — visual consolidation:
apply latest 2026-09-26 Figma R2 to the finally integrated functional tree.

P4 — Owner connection remains deferred until SMT consolidation is stable.

## 7. Current token

SMT_OWNER_REQUIREMENT_AND_CANDIDATE_CONSOLIDATION_R1_AUDIT_READY
NO_PRODUCT_MUTATION
NO_WHOLESALE_MERGE
FIVE_PORT_E2E_FROZEN
