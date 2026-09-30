# MFK Admin V3｜A1 / A2 重新審核｜Against Current Product Brief V1

日期：2026-09-30  
狀態：RE-AUDIT COMPLETE / IMPLEMENTATION NOT AUTHORIZED  
控制：#596 / #601 / Draft PR #602  
被審核：A0 Main Foundation、A1 PR #599、A2 Issue #600、Issue #586 第三方 State Architecture / Storage Migration Map  
產品基準：目前 Admin V3 Product Brief R1 最新 Owner Authority Correction

---

# 0. 最終判斷

## A0
**可保留做 engineering foundation，但唔當產品 UI。**

可重用：
- React / Vite skeleton
- TanStack Query
- Zustand
- CI
- no-v2-import guard
- zero-production-routing discipline

需要收緊：
- Dexie 只可以喺產品明確批准 offline command 時先真正啟用。
- 目前 R1 未要求 offline publish，所以唔應預先建立「一定會用 outbox」嘅產品假設。

## A1 PR #599
**方向大致正確，但目前唔可信到可以 merge / 當正式 implementation。**

原因：
1. PR 仍係 Draft / unmerged。
2. CI GREEN 只證明 tests/typecheck/build/zero-routing；唔等於 product acceptance。
3. Codex review 仲有 1 個 unresolved P1：
   v3admin/src/canonical.ts 無直接使用 controlling shared validateMfkAdminConfigEnvelope，而係自己複製一套較鬆 validator。
4. A1 UI 只係 engineering proof，唔符合目前 Product Brief 12 大 Menu / 53 頁 IA。
5. A1 無 edit / pricing / publish，所以即使 A1 完全正確，都解決唔到 Keeta 驗收時「即時新增分類 → 商品 → 設價 → 發佈」工作。
6. A1 無 V3 serving-release freshness proof，未解決 Safari 可能仍然載入舊 frontend release 嘅問題。

正式狀態：
**REFERENCE_ONLY / REWORK_REQUIRED**

## A2 Issue #600
**唔係「A2 已做完」；按 repo 可見證據，A2 只有 Specification，冇 implementation branch / PR。**

#600 已 Closed / Not Planned，
並明確標：
SUPERSEDED AS IMPLEMENTATION ROADMAP by #601

因此 A2：
- 技術 read-model contract 有參考價值；
- IA / UI / delivery strategy 唔再控制產品；
- 必須服從目前 Product Brief。

正式狀態：
**DESIGN REFERENCE ONLY / NOT IMPLEMENTED**

---

# 1. 目前 Product Brief 最新 Authority

最新 Owner correction 已經改成：

- 12 個大 Menu
- 53 個第二步 destination
- 「訂單監察」只讀
- Admin 無 Refund / Cancel / 付款方式修正 transaction mutation
- 原 Admin post-close Tender Correction BACKEND_CONTRACT_GAP 取消
- 53 LOCKED
- 0 YELLOW
- 0 RED

因此任何舊 A1 / A2 / Copy Matrix / Closeout 內容如果仍然寫：
- 54 pages
- 訂單管理
- 售後／退款／取消／修正 Admin workspace
- Admin Tender Correction mutation
- 唯一 YELLOW = Tender Correction

全部視為：
**STALE PRODUCT TEXT**
必須清理，唔可交 implementation。

---

# 2. Issue #586 第三方架構｜重新判斷

舊決策：

- TanStack Query → Cloud / server state
- Dexie → durable pending command
- Zustand / React → draft / UI preference
- auth → separate security layer

呢個核心方向仍然正確。

Context7 再核對：
- TanStack Query v5 有 query staleness、mount/focus/reconnect refetch、invalidateQueries、mutation 後 refetch 模式；
- Dexie 有 IndexedDB version / transaction / live query / cross-tab reactive support；
- Zustand persist 有 version / migrate / partialize / rehydrate。

但：
**Library capability ≠ Product Authority。**

所以最終規則以 Product Brief 為準。

---

# 3. 舊 LocalStorage Migration Map｜邊度已經過時

#586 曾經盤到 47 個 browser storage keys，
並提出：
- 部分搬 Query
- 部分搬 Zustand
- sync-outbox 搬 Dexie
- compatibility migration 後刪舊 key

呢份清單而家仍然有價值，
但只可以做：

**FORENSIC INVENTORY / CAPABILITY LOSS CHECKLIST**

唔可以做：
**V3 migration execution plan**

原因：
目前 controlling V3 rule 已經鎖：
- V3 唔讀 v2 localStorage
- V3 唔做 v2 compatibility state machine
- V3 唔 import v2 client-state modules
- v2 production 係 baseline，但唔係 donor architecture

因此：

## 禁止
v2 47 keys → 一次過 migrate 入 V3

## 正確
對每一個舊 key 問：
「佢代表嘅正式 capability / fact，V3 應該由邊個 canonical query / draft contract / approved command 重新取得？」

如果無 server/read/write contract：
標：
BACKEND_CONTRACT_GAP
而唔係偷搬舊 localStorage。

---

# 4. A1 可以直接保留嘅設計

## 4.1 Auth challenge / proof
可以保留概念：
- Login ID
- PIN browser-side PBKDF2/HMAC proof
- raw PIN 不離開 browser
- existing backend challenge/verify contract

符合 Product Brief §34。

## 4.2 Session
可以保留：
- session token 唔放 localStorage / sessionStorage
- memory/security layer
- logout 清 authenticated Query cache

需要補：
- 全局 401 / expiry handling
- authenticated query registry cleanup
- focus / route return after re-login
- session scope / permission projection

## 4.3 Canonical Query
可以保留：
- TanStack Query
- cache: no-store
- staleTime 0 / refetch mount/focus/reconnect
- manual refetch
- canonical publishedAt 作 human freshness

## 4.4 Isolation
可以保留：
- v3admin/**
- no v2 state import
- no production route
- CI guard

---

# 5. A1 必須廢棄 / 重寫嘅部分

## 5.1 Local duplicated canonical validator｜BLOCKER

A1 canonical.ts 自己重寫：
- schema shape
- fingerprint calculation
- validation

但 controlling repo 已有：
contracts/admin-config-sync-v1.ts
→ validateMfkAdminConfigEnvelope

Codex review 已指出：
A1 local validator 同 shared validator 有實際差異，例如：
- shared storeId max length
- exact fingerprint semantics
- trim / validation behavior

因此：
**A1 canonical validator 不可直接重用。**

One-shot implementation 必須：
**import / call shared validator**
而唔係再 copy。

## 5.2 A1 UI
A1 UI：
- Canonical
- 主權
- fingerprint
- revision
- Snapshot sections

只適合 engineering proof。

目前 Product Brief：
- 12 大 Menu
- 53 workspace
- 今日 Sales-first
- technical evidence 後置
- human-first copy

因此：
**A1 UI 全部視為 throwaway prototype。**

## 5.3 Backend health = 已連接
A1 用 /api/health 後顯「已連接」。

目前 Product Brief 已鎖：
Connected ≠ Healthy ≠ Synced ≠ Business Ready。

所以：
health OK → 已連接
唔可以做全局產品成功語義。

## 5.4 Fixed MF01
A1 query / API 寫死 MF01。

R1 現時可以只運行 MF01，
但新架構 Query Key / API seam 應接受：
storeId / scope
參數，
唔將單店假設焊死喺所有 hooks。

## 5.5 Serving Release Identity
A1 顯 backend health sourceSha，
但 Safari 事故要證明嘅係：
**目前 browser 真係載入邊個 V3 frontend release。**

呢兩件事唔同。

V3 Preview 必須有：
- frontend build/release identity
- deployed serving identity
- no-cache release metadata / equivalent evidence
- physical browser proof

---

# 6. A2 技術內容｜可以重用

以下仍符合目前 Brief：

## Canonical / ACK
- canonical query 同 ACK 分開
- exact apply proof 需要正式 identity match
- revision number 唔係 freshness authority
- publishedAt 係 Cloud publish time

## Projection
- Orders / Reports / Refund projection 只讀
- Query error 唔變成 zero / empty
- background refresh 保留舊成功資料

## Doorbell
- WebSocket 只係 notification
- event → invalidate query → HTTP refetch
- event payload 唔直接成 canonical truth

## Auth
- authenticated read 帶 session
- 401 應 clear session + authenticated Query cache

## State semantics
- Empty ≠ Error
- Waiting ≠ Failed
- Offline ≠ Failed
- Unknown ≠ Failed

以上可以變成 one-shot data layer contract。

---

# 7. A2 已經過時 / 唔可直接用嘅內容

## 7.1 舊 IA
A2 定：
- 概覽
- 訂單
- 營業報表
- 退款記錄
- 主權／診斷

目前 Brief 定：
**12 大 Menu / 53 第二步頁面**

所以 A2 IA：
**全部 superseded。**

## 7.2 A2 係 read-only slice
目前 one-shot R1 要完整：
- Menu Draft
- Category / Product
- Pricing
- Publish
- Readback
- Platform config
- Printer config
- Staff / RBAC
- Store settings
- Reports
- Diagnostics
等等。

所以 A2 只覆蓋少量 read model，
唔係 Admin V3 product。

## 7.3 A2 Refund UI
目前 Admin Order domain 已 read-only。
Refund 可以：
- report
- order linked transaction record
- audit / evidence

但唔係 Admin 售後 mutation workspace。

## 7.4 A2 staged delivery
A2 原本係 A1 merge 後先做下一 slice。

目前 controlling rule：
**ONE-SHOT PRODUCT DELIVERY + A0→A6 INTERNAL ENGINEERING GATES**

所以 A1/A2 可以係內部 technical gate，
唔係逐階段產品交付。

---

# 8. 現在真正應該點做｜One-shot Build Contract

## Gate 0｜Foundation Rebase / Cleanup

由 Main A0 foundation 起。

做：
- 保留 React / Vite / TanStack / CI
- Query key factory
- authenticated API client
- shared contract validators
- frontend release identity
- Store / Scope context
- no v2 state import

唔做：
- v2 localStorage migration
- Dexie outbox
- product UI prototype reuse

Dexie：
**保持未啟用**
直到產品明確批准 offline command。

---

## Gate 1｜Auth + Global Shell + Canonical

實作：
- Login ID / PIN proof
- memory session
- 401 expiry flow
- 12 大 Menu
- 53 route skeleton
- responsive navigation
- global search shell
- canonical Query
- publish freshness
- frontend serving release identity

驗：
- normal Safari
- in-app browser
- second tab
- same canonical result
- no old local truth

---

## Gate 2｜Read Model Coverage

唔照舊 A2「5 頁」。

要先建立：
**53-Page Backend Contract Coverage Matrix**

每頁列：

- Page
- Query / endpoint
- canonical authority
- store/scope
- freshness field
- Empty / Error / Stale semantics
- mutation allowed?
- mutation endpoint
- readback endpoint
- audit evidence
- backend gap

先知道邊啲 UI 真係有正式資料可接。

A2 舊 endpoints：
- canonical active
- ACK
- orders
- reports
- refunds

只係其中一部分。

---

## Gate 3｜Config Draft / Edit / Publish

呢個先係今日 Keeta 驗收最重要嘅能力。

最低閉環：

**分類 List**
→ 新增分類
→ 儲存草稿

**產品 List**
→ 新增商品
→ 設基本價格
→ 儲存草稿

**未發佈變更**
→ 檢查完整性
→ 影響預覽

**發佈中心**
→ 確認發佈
→ Cloud published
→ Target readback

正式實作：
- useMutation
- version guard
- server validation
- invalidate canonical
- canonical refetch
- readback

禁止：
- browser persist PUBLISHED
- browser persist QUEUED
- Save Draft 顯成已生效

---

## Gate 4｜Offline Command Decision

目前 Product Brief 無明確要求 offline Admin publish。

因此 default：
**NO DEXIE OUTBOX IN R1**

只有 Owner / Product 明確批准：
「Admin 離線都要可以建立 durable unsent publish command」
先開 Dexie。

否則：
offline 時 config 可以：
- 保留已讀資料
- local unsaved editor state（bounded）
- 禁止假裝可正式 publish

---

## Gate 5｜完整 53 頁 Product Implementation

按 Product Brief：
- List → Detail → Create/Edit
- First Viewport
- Cross-page context
- Components
- Responsive
- Copy Dictionary
- Orders read-only
- Primary Home

唔逐頁發明 UX。

---

## Gate 6｜Preview Physical Acceptance

必驗：

### Browser / Release
- iPhone Safari
- in-app browser
- desktop Chrome / Safari
- second tab
- reopen
- frontend release identity
- canonical identity

### Keeta 驗收核心
- 新增分類
- 新增商品
- 設價
- 發佈
- Cloud readback
- SMT / target readback
- reopen Safari
- 同一正式結果

### Freshness
- Admin canonical 更新
- client refetch 收斂
- stale 顯明示
- local state 不覆蓋較新 HTTP truth

### Rollback
- V3 → v2 rollback
- serving identity 證明
- v2 core navigation / auth 正常

---

# 9. 53-Page Backend Contract Coverage Matrix｜Implementation 前必做

產品 UI 已收口，
但 implementation 仍然需要一張「真 API / Contract Map」。

原因：
舊 #586 已經指出部分能力當時冇正式 read seam，例如：
- release history
- audit
- exceptions
- operations report
- settlement facts
- store binding canonical schema
等。

呢啲舊 findings 唔可以直接當今日仍然缺，
亦唔可以直接當已經有。

Implementation 前要 fresh-read repo/backend，
逐頁證實。

狀態只可以：
- EXISTING_CONTRACT
- BOUNDED_NEW_SEAM_REQUIRED
- OUT_OF_SCOPE
- BLOCKED

禁止：
「UI 先畫住個 button，backend 之後再算」。

---

# 10. A1 / A2 最終資產處理

| 資產 | 處理 |
|---|---|
| Main A0 skeleton | REUSE / CLEANUP |
| TanStack Query dependency | REUSE |
| Zustand dependency | REUSE |
| Dexie dependency | KEEP DORMANT / OPTIONAL |
| A1 auth proof code | REUSE AFTER REVIEW |
| A1 memory session idea | REUSE |
| A1 canonical local validator | DELETE / REPLACE WITH SHARED |
| A1 UI | DO NOT REUSE |
| A1 tests | PORT / EXPAND |
| A1 CI | REUSE |
| A2 query semantics | REUSE |
| A2 ACK exact-match semantics | REUSE |
| A2 doorbell invalidation | REUSE |
| A2 old IA | DELETE / SUPERSEDED |
| A2 5-page UI spec | SUPERSEDED |
| #586 47-key list | FORENSIC CHECKLIST ONLY |
| #586 v2→V3 storage migration plan | DO NOT EXECUTE |

---

# 11. 信任結論

唔可以講：
**「A1 A2 已經做好，可以接住寫。」**

正確講法：

**A0 已落 Main，可作乾淨 foundation。**

**A1 有一個有價值嘅 candidate，但有 unresolved P1 同產品 UI 已過時，所以只可拆件重用，唔可 merge。**

**A2 冇 implementation；只係一份已 superseded 嘅 read-model spec，技術 contract 部分可以抽返入 one-shot。**

真正 implementation source of truth：

1. Current Product Brief
2. Current Governance R2
3. Current shared contracts
4. Fresh backend contract survey
5. A1/A2 只作 reference

---

# 12. Immediate Next

未開始 code 前：

1. 清理 Product Brief / Closeout stale 54-page / Tender-Correction text
2. 建立 53-Page Backend Contract Coverage Matrix
3. 將 A1 reusable pieces 寫成 one-shot implementation packet
4. 將 A2 reusable query/readback rules寫入 data-layer contract
5. 列 exact no-touch paths
6. Owner 明確 PROMOTE
7. 先開始 one-shot implementation

MILESTONE:
MFK_ADMIN_V3_A1_A2_REAUDIT_COMPLETE
