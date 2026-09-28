# MFK SMT A3c Optional Drink Supplement｜Handoff｜2026-09-26

## STATUS
LANDED / BANKED / MAIN SMOKE GREEN

## Owner-final semantics
A3c is intentionally simplified.

### Drink supplement is optional
- 飲品補選唔係 Required blocker。
- 留空 = 冇飲品操作、冇價格調整。
- Checkout 唔會因飲品留空而彈返選擇頁。
- 真正 Required 仍然由 A3b Required Fast Lane 負責及阻 Checkout。

### Explicit choice only changes money
- 只有員工明確揀「唔飲嘢／不要飲品」先套用 Admin published negative adjustment，例如 -$1。
- 熱飲／凍飲／特飲等價差全部沿用 Admin published DRINK Pool。
- 禁止因「未揀飲品」自動扣錢。

### Platform orders
- Keeta / Foodpanda / provider order 唔做「缺飲品」偵測。
- Provider 傳咩就收咩。
- 平台冇傳飲品，不建立 synthetic drink requirement。
- 平台另購飲品照原 provider/product mapping 入單。

### Local operation
- 飲品補選放入「必選／補選」工作區，但可完全跳過。
- 支援同一飲品設定用數量 + / -。
- 未指定配餐時以「未指定配餐（按落單次序）」保存，不使用 random。
- 客戶有指定先由員工選一個 Cart line 作明確配餐。
- PRODUCT 型飲品如有甜度／冰度等 Admin option，先開現有 Product Editor。
- 飲品 Product Editor 以「跟餐飲品價差」做 pricing base，再加 option adjustment；唔會誤收 standalone 飲品基本價。

## Authority / data source
- Drink choice source = Admin published Combo Pool with `kind=ADDON` + `addonKind=DRINK`.
- 唔用 product name / category text 去估飲品。
- Reuse existing Admin pricing facts.
- No second Pricing Engine.

## Cart representation
A3c 用獨立 supplement Cart line：
- productId prefix: `drink-supplement:`
- name: `飲品｜<choice>`
- unitMinor = Admin drink band/subPool adjustment + choice adjustment + configured product-option adjustment
- explicit no-drink can therefore be a negative line
- blank creates no line

This keeps the meal line unchanged and preserves optionality.

## Landed
Main:
`92874d22fdeb25d1aca839599f14dd19ee7ea207`

PR:
`#333`

Bank:
`bank/MFK/SMT-A3C-OPTIONAL-DRINK-SUPPLEMENT-2026-09-26`

Product/test files:
- v2local/src/App.tsx
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
- v2local/src/features/ordering/ordering-center-workspaces.css
- v2local/src/presentation/smt-optional-drink-supplement-a3c.test.ts
- v2local/src/presentation/smt-required-fast-lane-a3b.test.ts

## Proof
Bounded PR proof:
- run `36228614579` = SUCCESS
- 35 / 35 test files PASS
- 149 / 149 tests PASS
- build PASS
- local authority guard PASS
- static bundle proof PASS
- diff check PASS
- integrated-main E2E lock included in full unit suite

Post-merge:
- V2 Local POS Smoke run `36228706956` = SUCCESS

Initial run `36228522914` failed only because A3b's static presentation assertion still expected the old label 「必選區」. The protected A3b behavior itself remained intact; its static assertion was updated to the new 「必選／補選」 presentation and the next proof was GREEN.

## Protected
- Admin / SMT / SMM / Customer / Keeta accepted E2E remains frozen.
- No Order authority change.
- No Payment/Tender change.
- No Print authority change.
- No platform ingress change.
- No A3d Combo pairing model imported.

## Supersedes
This handoff supersedes the earlier A3c decision-gate assumption that Quick Drink must be Combo-target-only or checkout-required.

## Next
A3d Riceball / Combo pairing is the next bounded audit slice.

Rule:
fresh latest main → audit exact current seam and donor delta → implement only if no new Owner semantic branch appears.


## Follow-up R1.1 — Combo drink optional
After landing A3c, a current-main recheck found the existing basic ComboWorkspace still treated every Admin group marked required as mandatory, including DRINK pools. That conflicted with the Owner-final A3c rule.

Corrected:
- `addonKind=DRINK` no longer contributes to Combo `requiredMissing`.
- Combo DRINK UI is shown as 「飲品補選 / 可跳過」.
- Other required Combo groups remain unchanged.

Landed:
- main `4da40b04153c9b0a373204bb44258761bb75c4cd`
- PR `#334`
- same bank branch advanced to this final A3c head

Proof:
- bounded run `36228924116` SUCCESS
- 35 / 35 test files PASS
- 150 / 150 tests PASS
- build PASS
- diff check PASS
- post-merge V2 Local POS Smoke `36228978196` SUCCESS

A3c final functional head is therefore `4da40b04153c9b0a373204bb44258761bb75c4cd`.
