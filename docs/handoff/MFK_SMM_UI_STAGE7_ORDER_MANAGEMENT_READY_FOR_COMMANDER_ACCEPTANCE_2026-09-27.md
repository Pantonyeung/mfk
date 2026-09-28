# MFK SMM UI｜Stage 7 訂單管理 R1｜2026-09-27

STATUS:
READY_FOR_COMMANDER_REACCEPTANCE

CONTROL:
Pantonyeung/mfk #409 comment 5855577991

PR:
#410

FINAL_CODE_HEAD:
4d7c93b45779021764e379fe020d1ba3030cde73

FINAL_CODE_CI:
36317260182 = SUCCESS

FINAL_RECEIPT_BINDING:
The exact final branch head / final CI are bound by the latest #409 READY_FOR_COMMANDER_ACCEPTANCE receipt.
This handoff records the validated code head directly and avoids self-referential SHA drift.

FRESH_MAIN_AT_CODE_VALIDATION:
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

STAGE6_BASE:
8506ee4306821b2df7173fe2e2cc27879cea814e

BEHIND_MAIN_AT_CODE_VALIDATION:
0

## Source

- SMM Final Implementation UI Spec V1 / Stage 7
- Stage_7_訂單管理.png
- Stage 0–6 accepted/banked regression locks

## Stage 7 product contract

READ / SEARCH / FILTER / DETAIL / REFRESH ONLY

Visual family:
- 7.1 訂單列表（進行中）
- 7.2 訂單列表（歷史）
- 7.3 搜尋訂單
- 7.4 訂單詳情
- 7.5 更新狀態（read-only authority-safe presentation）

Tabs:
- 進行中
- 歷史

Source filters:
- 全部
- 現場
- SMM
- 自家平台
- 第三方

Canonical status filtering:
- active: 全部狀態 / 待確認 / 製作中 / 可取餐 / 狀態未明
- history: 全部狀態 / 已取餐 / 已取消 / 狀態未明

History date filtering:
- 全部
- 今天
- 昨天
- 自訂日期

## Human identity / list contract

Order cards render:
- Display Number
- Source
- canonical order/observed time
- canonical item count when available
- canonical effective/amount label when available
- human fulfillment status

Missing canonical field => 未有資料.

Internal Order ID / UUID are not rendered.

## Search contract

Search scopes:
- 全部
- 訂單編號
- 商品名稱
- 電話

SEARCH_PHONE_CLASSIFICATION:
CANONICAL_PERMITTED_ONLY

Phone rules:
- phone is searchable/displayable only when canonical customerPhone exists AND customerPhonePermitted === true
- no permitted phone => phone scope disabled
- internal Order ID is not included in search
- no fabricated match

## Detail contract

7.4 detail renders canonical fields only:
- Identity: Display Number / Source / order time
- customer/contact only when canonical + permitted
- Items / modifiers / remarks when structured canonical items exist
- otherwise canonical itemSummary
- Money: effective amount / amount label; tender when available
- Fulfillment status
- Source / external reference when available
- Timeline = row.timeline only
- no local timeline append
- missing field => 未有資料

## 7.5 authority override

FULFILLMENT_COMMAND = NOT_WIRED
Owner: SMT fulfillment authority

CANCEL_COMMAND = NOT_WIRED
Owner: SMT order authority

Visible state choices:
- 待確認
- 製作中
- 準備完成 / 可取餐
- 已取餐
- 已取消

All mutation controls:
- disabled
- delegated copy = 「此操作需由 SMT 處理」
- no fulfillment update call
- no cancel call
- no local fake timeline
- refresh/readback only

## Stage X

Distinct:
- Loading
- Empty
- Offline
- Stale
- Partial
- Unknown
- Error

Partial canonical rows remain visible.
Unknown does not become local failure/mutation.

## Shell / responsive / accessibility

- fixed 5-tab nav: 點單 / 待處理 / 訂單 / 堂食 / 更多
- 訂單 active
- 440×956 primary
- 360×780 operable
- touch >=44px
- safe-area inherited from fixed SMM shell
- focus-visible
- reduced-motion

## Preserved

- Stage 0–6
- Stage 5 submissionId / idempotency / UNKNOWN readback-first
- Stage 6 priority + read-only authority
- Pricing/Menu validation
- Staff auth/provenance
- LAN protocol
- Customer/Admin/Keeta protected seams
- NO Stage 8

## CI evidence for FINAL_CODE_HEAD

admin-identity-canonical-r1:
36316112421 = SUCCESS

SMM:
- 144 / 144 PASS
- build PASS
- Wrangler deploy --dry-run PASS
- production deploy = NONE

v2local:
- 87 test files PASS
- 386 / 386 tests PASS
- build PASS

Admin:
PASS

Owner:
PASS

## Stage 7 changed files relative to Stage 6 base

- v2smm/src/App.tsx
- v2smm/src/Stage7Orders.tsx
- v2smm/src/product-types.ts
- v2smm/src/stage7-orders.d.mts
- v2smm/src/stage7-orders.mjs
- v2smm/src/stage7.css
- v2smm/test/stage7-orders.test.mjs

LOCKS:
NO MAIN MERGE
NO DEPLOY
NO STAGE 8


## Final correction — filter empty vs page empty

- Page EMPTY is now gated by selected segment canonical rows:
  connection === READY && segmentRows.length === 0.
- If segmentRows > 0 but source / status / date filtering returns zero rows, UI shows:
  「目前篩選條件沒有符合訂單」
- canonical segment count remains visible in filter-empty copy.
- no fake rows are created.
- deterministic regressions cover source no-match, status no-match, and date no-match.

## Final correction — search scope

- 7.3 Search now receives current segmentRows.
- Search no longer silently inherits list source / status / date filters.
- A canonical order in the selected segment remains searchable even when the current list filter hides it.
- Example locked by regression: hidden-list filter has zero match, Display Number search still finds the canonical order.
- Phone search remains CANONICAL_PERMITTED_ONLY.
