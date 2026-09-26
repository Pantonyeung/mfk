# MFK Admin Combo / Drink Cross-Port Projection R1

STATUS: IMPLEMENTED / CI GREEN / NO MERGE / NO DEPLOY

## Owner lock

Admin 更新以下 published config 時，相關 read model 必須映射到所有消費端：

- Combo 套餐 definition
- Combo Main Pool binding
- Combo Add-on Pool
- Drink Add-on choices
- Combo / drink published price adjustments
- 普通 Product option groups / drink product options

Canonical source:
Admin published config only.

Execution authority:
SMT / Store Kernel only.

SMM / Customer:
projection + local draft / staff or customer intent only.

禁止：
- Product name / category / 「套餐」字眼 heuristic
- 第二 Combo Engine
- 第二 Pricing Engine
- 第二 Order Engine
- client-side invented price facts

## Port mapping

### SMM Internet
Branch:
work/MFK/SMM-FINAL-UI-IMPLEMENTATION-R1

Head:
670dc7f3efdb91d8b0757a31319dfc5c63b69319

Path:
v2smm/worker.ts::mapPublishedSnapshot(raw)

Projection:
Admin active envelope
→ projectSyncedOrderingCatalog
→ projectSyncedCombos
→ SmmMenuSnapshot.products[].comboId
→ menu.combos
→ menu.comboPools

Drink choices:
comboPools[kind=ADDON, addonKind=DRINK]

### SMM LAN / SMT

Paths:
- v2local/src/runtime/smm-lan-ingress.ts::readSnapshot()
- v2local/src/runtime/smm-combo-revalidation.ts

Projection:
Admin LKG
→ projectSyncedOrderingCatalog
→ projectSyncedCombos
→ same Combo / Pool read model

Execution:
SMM Combo intent
→ SMT ingress
→ authoritative Combo binding / availability / published price revalidation
→ existing SMT pairing semantics
→ Store Kernel commit

### Customer

Branch:
work/MFK/CROSSPORT-ADMIN-COMBO-DRINK-PROJECTION-R1

Base:
20faf36221a65f6b75683c92f904b552aeb5e6a7

Head at implementation:
d6d852cefb89a06e3194ede9874918c401313d94

Paths:
- v2admin/worker.ts::customerPublicSnapshot(active,...)
- v2customer/src/product-types.ts

Projection:
Admin active snapshot.catalog
→ products[].comboId
→ menu.combos
→ menu.comboPools

Drink choices:
menu.comboPools[].addonKind === DRINK

Ordinary drink product options:
Admin optionCenter.sets + optionCenter.productLinks
→ CustomerProduct.optionGroups

Customer client refresh:
- initial readSnapshot
- visible polling every 3 seconds
- focus / visibility refresh

Therefore a newly published Admin revision is read on the next Customer snapshot refresh.

## SMP naming

Current repository / Drive / Jade has no SMP port or source surface.
No new SMP authority or port was invented.

For this R1, the executable counterpart is SMT, which is the existing formal execution/revalidation surface.

If a distinct SMP port is introduced later, it must consume this same Admin-published projection and must not become a new authority.

## Evidence

SMM / SMT Combo integration:
- Run 36280109985 SUCCESS
  - SMM: 55 / 55 PASS
  - SMT/v2local: 313 / 313 PASS
  - both build PASS
- Run 36280109994 SUCCESS
  - same cross-suite proof

Customer / Admin projection:
- Run 36280344111 SUCCESS
  - Customer: 34 / 34 PASS
  - Customer build PASS
  - Admin: 126 / 126 PASS
  - Admin build PASS
  - Wrangler worker bundle dry-run PASS

## Authority

AUTHORITY CHANGE = NONE

Admin = published configuration truth.
SMT / Store Kernel = execution and authoritative revalidation.
SMM / Customer = projection + intent only.

## Stop

NO MAIN MERGE.
NO PRODUCTION DEPLOY.
NO CUSTOMER STAGE 3.
NO SMM STAGE 3.
