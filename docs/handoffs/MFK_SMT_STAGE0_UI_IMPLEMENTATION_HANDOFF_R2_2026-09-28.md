# MFK SMT｜Stage 0 UI Implementation Handoff R2
日期：2026-09-28
狀態：READY_FOR_COMMANDER_REVIEW

## Authority
Owner confirmed Stage 0 effect reference:
- 1920×1080 fixed SMT terminal
- Boot/Login → First Login branch if required → previous retained cash readback → Opening Cash confirmation → direct Ordering
- No Home Page
- Stage 0 visual reference: Owner-confirmed login/opening effect image
- Production asset pack: Google Drive Stage 00｜Production Assets Pack R1

## Git
Branch: work/MFK/SMT-STAGE0-UI-FINAL-R2
Base main: a02ab8e9256806c9c5611a469ecda4fee97e21ef
Head: e0d949718250ed3c13a6fc420ea41cd5f02d5f47
Ahead: 3
Behind: 0
NO MAIN MERGE

## Changed files
1. v2local/src/presentation/StaffAuthGate.tsx
2. v2local/src/presentation/CashOpeningGate.tsx
3. v2local/src/styles.css

## Implemented
### Login
- 1920×1080 Stage 0 branded composition
- Welcome/date/time
- Employee login / QR visual option
- Existing staff selector preserved
- Existing PIN authentication preserved
- On-screen numeric keypad
- Existing Admin Config state shown
- Right-side opening status / goal / brand / support surfaces
- No Home Page added

### Opening Cash
- Existing cashOpeningRequired authority preserved
- Existing previous retention suggestion/readback preserved
- Previous counted / removed / retained values exposed
- Actual opening cash remains editable
- Existing note preserved
- Existing confirmCashOpening commit preserved
- Confirmation returns through existing gate directly to ordering runtime
- No second cash authority or transaction engine

## Explicit non-goals
- No Stage 1 mutation
- No Order/Pricing/Payment/Print authority mutation
- No schema migration
- No Builder/OTA trigger
- No main merge
- QR login is visual/disabled only; no invented QR auth authority

## Asset handling
Owner formal Logo/IP remain brand authority. Generated backgrounds are recorded in Google Drive Production Assets Pack. Current code does not invent replacement runtime authority from image assets; visual shell is CSS/SVG-like composition until binary asset landing path is approved.

## Validation
Git compare: ahead 3 / behind 0.
GitHub combined status: no status checks reported for head at handoff time.

## Commander acceptance
Compare:
1. Owner Stage 0 effect reference
2. StaffAuthGate implementation
3. CashOpeningGate implementation
4. Stage 0 CSS block
5. Existing login/cash runtime authority unchanged

GREEN -> Commander may approve landing.
RED -> return exact visual/functional mismatch; do not merge.
