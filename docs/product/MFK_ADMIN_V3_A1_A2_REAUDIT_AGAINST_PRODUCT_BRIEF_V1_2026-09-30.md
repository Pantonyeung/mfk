# MFK Admin V3｜舊 A1 / A2 重新審核 Against Current Product Brief V1

日期：2026-09-30  
狀態：RE-AUDIT COMPLETE / PRODUCT BRIEF CONTROLLING  
範圍：A0 foundation、PR #599 A1 candidate、Issue #600 A2 spec、Issue #586 third-party state architecture  
產品 Authority：#601 / PR #602 current Product Brief

---

# 0. 結論

舊方向唔係全部推倒。

但「A1 / A2 已完成」呢個講法唔準確。

真實狀態：

- **A0：已 merge，可作乾淨 V3 foundation。**
- **A1：有實作 Candidate，CI GREEN，但 PR #599 仍 Draft、未 merge，而且有 1 個未解 P1。只可 BANK 作 engineering reference，唔可原樣 promote。**
- **A2：冇實作。只有 Issue #600 UI / Behavior / Acceptance Spec；Issue 已 CLOSED / NOT PLANNED，正式被 #601 supersede。**
- **舊 localStorage → third-party migration map：概念部分正確，但「將 v2 browser storage 搬入 V3」已被 current Product Brief supersede。V3 唔讀 v2 localStorage，唔做 compatibility state machine。**

因此新 one-shot build 唔應：
merge A1 再接 A2。

正確：
**由 current Product Brief 出 one-shot implementation branch；A0/A1/A2 只作 selective reference。**

---

# 1. 第三方架構決策｜保留

以下方向同 current Product Brief 一致：

## TanStack Query
用途：
- canonical server state
- projection/read models
- ACK/readback
- query invalidation/refetch
- background refresh

保留。

## React / Zustand
用途：
- in-memory form state
- local UI state
- filter / view preference
- non-authoritative UI preference persistence（只限批准範圍）

保留。

## Auth
- separate security layer
- session 不放 localStorage/sessionStorage

保留。

## WebSocket
- doorbell only
- event → invalidate query → HTTP authoritative refetch

保留。

---

# 2. Dexie｜由「預設搬 outbox」改為「條件式啟用」

舊設計：
sync-outbox.v1 → Dexie / IndexedDB。

Current Product Brief 已收窄：

**Dexie / IndexedDB only where product explicitly approves offline command。**

所以 R1 default：

- 唔需要為「架構完整」而先建立 durable outbox workflow
- 唔由 v2 localStorage 搬舊 outbox 入 V3
- 唔因為 library 已裝就建立 command truth

只有產品明確批准：
「Admin offline 都可以建立未送出正式 command」
先進 A4 / Dexie。

否則：
Admin mutation online-only + explicit failure / unknown / retry contract。

---

# 3. Zustand Persist｜舊設計太闊，要收窄

舊 Issue #586 migration map 將大量 config localStorage keys歸入 Zustand persist。

Current Brief 唔接受將正式 Draft / canonical baseline 默認變成本機 persisted state。

新規則：

## 可以
- filter preference
- view preference
- sidebar preference
- non-sensitive local UI preference
- 明確批准嘅 bounded unsaved editor recovery

## 唔可以
- canonical config
- published state
- applied state
- formal pending changes
- authoritative draft state
- payment/order/print truth

正式 Draft：
優先 server/canonical draft contract。

未保存 form：
React/Zustand memory；
離頁 guard。
無正式 persistence contract 就唔暗中復活。

---

# 4. v2 LocalStorage Migration｜取消

舊 migration map 提出：
- sync-outbox.v1 搬 Dexie
- config drafts 搬 Zustand
- compatibility migration 後清 key

Current Product Brief 硬規則：
**V3 唔讀 v2 localStorage，不做 v2 compatibility state machine。**

因此：
- v3admin 不讀 v2 key
- 不 migrate v2 key
- 不 hydrate v2 cache
- 不用 v2 local pointer 做 bootstrap
- 舊 v2 storage 同 V3 隔離

V3 係 clean start。

---

# 5. A1 PR #599｜可信部分

A1 candidate 有實際價值：

- existing challenge/verify auth contract
- raw PIN 不直接傳送
- session token memory-only
- TanStack Query canonical read
- cache:no-store
- no v2 localStorage
- no v2 state module import
- logout 清 canonical Query cache
- zero production routing
- CI：test / typecheck / build / zero-routing GREEN
- Regression Shadow GREEN

以上可以 selective reuse。

---

# 6. A1 PR #599｜不可直接 merge 嘅問題

## P1｜Shared canonical validator GOVERNANCE_DRIFT

PR #599 目前仍有 unresolved Codex P1：

A1 自己喺 v3admin/src/canonical.ts 重寫 validator，
而唔係使用 controlling shared：
contracts/admin-config-sync-v1.ts
→ validateMfkAdminConfigEnvelope。

已修咗 fingerprint recompute，
但仍然同 shared contract 有差異，例如：
- storeId max length
- adminFingerprint constraints
- exact fingerprint handling / trim semantics

Verdict：
**A1_NOT_PROMOTABLE_AS_IS**

One-shot build 必須：
直接 import shared validator / shared type，
禁止 V3 自己 fork canonical contract。

---

# 7. A1 UI｜全部視為 prototype，不作 Current Product UI

A1 UI 只係：
- Canonical
- Authority
- login
- metadata/counts

Current Product Brief 已經係：

- 12 大 Menu
- 53 第二步 destination
- Today Sales-first
- mature List → Detail → Edit
- human-first copy
- engineering evidence 後置

因此：
A1 App.tsx / styles.css 唔作 UI donor。

可以保留：
auth / query / authority technical pattern。

要重做：
Shell / IA / navigation / Today / workspace UI。

---

# 8. A1 固定 MF01｜要抽成正式 Scope Context

A1：
STORE_ID = MF01 hard-coded。

Current Product Brief 已有：
- Store / Scope
- Role / Permission / Scope
- multi-store future-safe semantics

R1 可以實際只有 MF01，
但 implementation 唔應將 store identity散落 hard-code喺每個 query module。

One-shot 應有：
**Authenticated Scope / Store Context**
→ query key / API request統一取 scope。

---

# 9. A1 未解決最初 Safari 事故嘅全部問題

TanStack Query解決：
**Business Data Freshness**

但唔解決：
**Loaded Client Bundle Freshness**

Keeta驗收事故有兩層：

1. Browser跑緊邊個 V3 client release？
2. Client入面讀緊邊份 canonical business data？

A1目前 health card讀 backend sourceSha，
但 backend SHA 唔等於：
「Safari而家載入緊邊個 JS bundle」。

所以 One-shot Shell 必須另外有：
- embedded client build/release identity
- preview serving release identity
- diagnostics 可比對
- physical acceptance證明 normal Safari / reopen / second tab 係 current release

TanStack Query唔可以當成解決 stale JS bundle 嘅工具。

---

# 10. A2｜實際狀態係「Spec only」

Issue #600：
**CLOSED / NOT PLANNED**

Repository：
冇 A2 implementation branch / PR。

所以：
A2 沒有完成 code。

之前可保留嘅係：
- exact ACK match
- canonical + projection query ownership
- WebSocket invalidate/refetch
- Unknown ≠ Failed
- stale previous data保留
- no mutation in read model
- no localStorage
- query key discipline

---

# 11. A2 UI / IA｜已過時

A2 Spec 原本 read-only destinations：
- 概覽
- 訂單
- 營業報表
- 退款記錄
- 主權 / 診斷

Current Product Brief：
- 12 大 Menu
- 53 第二步 destination
- 訂單監察只讀
- 今日首頁 Sales-first
- Audit / Diagnostics / Integrations / Effective Settings各有 Primary Home

因此：
A2 IA 唔可以直接實作。

A2只可當：
**read-model / state-semantics reference**。

---

# 12. A2 Diagnostic-first UI｜唔符合 Current Product Brief

A2 Overview將：
- canonical fingerprint
- revision
- ACK fingerprint
- projection technical facts

放得太前。

Current Brief：
普通使用者先見 business meaning；
UUID / fingerprint / operation ID / technical evidence 後置 Diagnostics / Advanced。

因此：
- fingerprint 不放 Today first viewport
- revision 不做 freshness
- publishedAt / business status先做人類 UI
- exact identity證據放 Readback / Diagnostics Detail

---

# 13. A2 Reports｜改為 Trusted Read Model First

A2可以做 display-only aggregate，
但 current Product Brief已明確要：
Trusted Reports / canonical metric semantics。

所以 One-shot build：
- report headline metrics優先使用正式 server read model
- client只做 presentation aggregation
- client aggregation唔可以變 metric authority
- query error唔變 zero

---

# 14. Current Product Brief｜重新審核後嘅真正基準

Current controlling product基準：

- 12 大 Menu
- **53** 第二步 destination
- **53 / 53 First Viewport**
- **53 LOCKED / 0 YELLOW / 0 RED**
- 訂單大 Menu = **訂單監察**
- Admin transaction operations：
  - Refund
  - Cancel Order
  - Payment Method Correction
  全部 **OUT OF ADMIN SCOPE**
- Admin只：
  - Watch
  - Configure
  - Govern
  - Publish
  - Readback
  - Reconcile
  - Audit
  - Diagnose

任何 Admin transaction mutation button：
**AUTHORITY RED**

---

# 15. One-shot Implementation 正確做法

## Step 0｜Owner PROMOTE Product Brief
未 PROMOTE：
唔開始 implementation。

## Step 1｜Branch from approved Main
唔由 PR #599 branch繼續堆。

建立一個新 one-shot Admin V3 implementation branch。

## Step 2｜Selective port A0/A1 technical assets
可帶：
- v3admin package/toolchain
- QueryClient policy
- auth proof flow
- canonical query pattern
- no-v2-state tests
- zero-production-routing guard
- CI

唔直接帶：
- A1 App UI
- A1 IA
- local canonical validator
- hard-coded store context
- Dexie outbox behavior

## Step 3｜先建立 Product Shell
- 12 big menus
- 53 routes
- responsive shell
- global search scaffold
- permission-aware nav
- Today Sales-first

## Step 4｜Canonical Read Layer
- shared validator
- Query ownership
- store/scope context
- freshness
- client build identity
- no v2 local state

## Step 5｜Projection / ACK Read Layer
重用 A2 state semantics，
但投影落 current 53-page Product Map。

## Step 6｜Draft / Edit / Publish
- List → Detail → Edit
- formal draft
- validate
- impact
- publish mutation
- invalidate/refetch
- target readback

## Step 7｜No Admin Transaction Mutation
Orders / refund / cancel / payment-correction：
read-only evidence / audit / reports only。

## Step 8｜Dexie Decision Gate
只有產品明確批准 offline command先加。

## Step 9｜Physical Acceptance
必測：
- normal iPhone Safari
- in-app browser
- second tab
- fresh deploy serving identity
- reopen
- focus/reconnect
- canonical update convergence
- publish/readback
- stale data behavior
- rollback to v2

---

# 16. 最終 Verdict

## Third-party architecture
**可信，可保留。**

但要跟 current Brief修正：
- Query = server state
- Zustand = local UI / bounded form state
- Dexie = conditional, not default
- no v2 localStorage migration

## A1
**有價值但唔可原樣 merge。**
Verdict：
**BANK / SELECTIVE REUSE**

Blocker：
unresolved shared validator P1。

## A2
**未實作。**
Verdict：
**SPEC / RESEARCH REFERENCE ONLY**

## Current next
唔再做 incremental A1 → A2。

正確：
**Approved Product Brief → New one-shot implementation branch → selective reuse technical primitives → build full current Admin V3 product.**

MILESTONE:
MFK_ADMIN_V3_A1_A2_REAUDIT_AGAINST_CURRENT_PRODUCT_BRIEF_COMPLETE
