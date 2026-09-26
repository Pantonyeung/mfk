# MFK Customer Handoff｜2026-09-26｜Member Loyalty Preference PWA V1

## Owner Requirements
Member page:
- human-readable member info only; no UUID
- name + Memory Seeds balance
- Memory Seeds never deducted
- seed milestones may issue expiring coupons
- coupon selected before formal submit is not consumed
- frequent purchases / favorites
- saved food preferences such as no cucumber
- future orders may apply preferences automatically
- Memory Badges such as milk-tea / rice-noodle achievements
- copy / promotion / collection statements
- guide customer to install PWA so notifications can be enabled

## Product Contracts
Memory Seeds:
lifetime cumulative ledger.
Never decrement on reward use.

Reward issuance:
track milestone issuance separately to avoid duplicate coupon issuance.

Coupon:
AVAILABLE → SELECTED → Formal Order Commit → REDEEMED.
No Formal Order = no redemption.

Preference:
default intent only.
Apply only through compatible formal modifier/option rules.
Visible and editable.

Favorite / Frequent:
reuse existing 喜愛商品 / 常用訂單 surfaces.

Memory Badges:
non-money achievement by default.
Any reward requires explicit Admin Reward Rule.

## PWA / Push
On iOS/iPadOS:
Home Screen web app supports Web Push.
Permission request must follow explicit user interaction.

Recommended member-page state:
NOT_INSTALLED
→ INSTALL_GUIDE
→ INSTALLED_NO_PUSH
→ ENABLE_PUSH
→ PUSH_ENABLED

## Privacy Boundary
Customer identity ≠ phone ≠ loyalty ≠ marketing consent.
Do not infer marketing consent from membership.

## Milestones
CUSTOMER_MEMBER_PROFILE_V1_DRAFT_LOCKED
CUSTOMER_MEMORY_SEEDS_LIFETIME_LEDGER_V1_DRAFT_LOCKED
CUSTOMER_REWARD_COUPON_COMMIT_REDEMPTION_V1_DRAFT_LOCKED
CUSTOMER_PREFERENCE_DEFAULT_INTENT_V1_DRAFT_LOCKED
CUSTOMER_MEMORY_BADGES_V1_DRAFT_LOCKED
CUSTOMER_PWA_PUSH_ONBOARDING_V1_DRAFT_LOCKED
