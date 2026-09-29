# Customer FINAL Acceptance R2

Base main: 58d233e9280aafcd428cca2b894206cca76ce795
Source: MFK_Customer_UI_完整設計包_2026-09-26

Acceptance finding:
UI0 GREEN
UI1 GREEN
UI2 GREEN
UI3 GREEN
UI4 GREEN
UI5 REPAIR_REQUIRED -> formal Stage5 male front-view source IP crop applied
UI6 REPAIR_REQUIRED -> formal Stage6 female front-view source IP crop applied
UI7 REPAIR_REQUIRED -> male/female source IP front-view crop follows formal variant
UI8 REPAIR_REQUIRED -> male/female source IP front-view crop follows formal variant
UI9 REPAIR_REQUIRED -> formal Stage9 female front-view source IP crop applied
UI10 REPAIR_REQUIRED -> recovery female / account male source IP crop applied

Important correction:
First wave used the whole three-view source sheet inside a small art slot. That was not render-faithful. R2 crops the approved source sheet to the formal front-view composition used by the effect boards. No invented mascot.

BACKEND_SEAM_MISSING:
- UI7 arrival notification mutation seam remains SAFE_UNAVAILABLE in current main; no fake success.
- UI9 formal member credential creation/verification is not proven; UI stays disabled/fail-closed.
- UI10 automatic credential reset/change is not proven; manual support remains explicit.

EXACT_ASSET_MISSING:
- standalone FINAL five-navigation icon export files are not present in the source package.
- source package has flattened Stage effect boards and approved IP sheets, but not isolated per-stage pose exports. R2 uses the approved source front-view crop rather than inventing new art.

390/360:
Existing source-fidelity contract explicitly validates 390 baseline + 360 minimum; R2 keeps the same responsive CSS and adds presentation-only crop CSS.

Candidate: a476fb0342f8efefbccec9333bd4d4bb52aa39b2
CI:
- customer-stage2-main-landing-r1 36521066497 SUCCESS
- UI4/UI5 workflows still running/queued at this receipt.
No landing until all required CI is GREEN.
