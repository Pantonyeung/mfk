# MFK Admin V3｜正式實作前規劃方案 V1

日期：2026-09-30  
狀態：PLANNING ONLY / NO CODE  
控制：#596 / #601 / PR #602  
目前 Production：v2 繼續運行  
目前授權：未 PROMOTE，禁止開始 one-shot implementation

---

# 0. 先講結論

下一步唔應該直接「先畫晒 53 頁 UI」。

亦唔應該先寫 backend。

正確優先次序係：

**先鎖實作底座同資料契約**
→ **再建立 UI Shell / Design System**
→ **先完成一條真實高價值 Vertical Slice**
→ **再批量擴到 53 頁**
→ **最後做 Safari / Browser / Readback / Rollback 全驗收**

第一條 Vertical Slice 應直接對準今次 Admin V3 真正觸發事故：

**登入 → 最新 Admin serving identity → 分類 → 商品 → 價格 → 儲存草稿 → 發佈 → Cloud 回讀 → SMT / target 回讀**

如果呢條線未證明，
就算 53 頁畫得齊都唔代表 V3 解決咗原本問題。

---

# 1. 點解唔係 UI First

UI Product Brief 已經足夠完整：
- 12 大 Menu
- 53 第二步 destination
- 53 / 53 First Viewport
- 共用元件
- Responsive
- Interaction
- Copy Dictionary

所以現時最大風險唔係「唔知畫面點畫」。

最大風險係：

1. Safari 真係載入最新 V3 release 未？
2. Canonical data 真係每次可以重新收斂未？
3. Store / Scope / Permission context 有冇正式一致來源？
4. Publish 後係咪真係 invalidate / refetch？
5. Cloud Published 同 Target Applied 有冇分開？
6. 舊 A1 technical primitives有邊啲可重用、邊啲要剷走？
7. 53 頁每頁對應邊個 query / mutation / readback contract？

因此：
**Architecture / Data Contract Mapping 先過 full visual production。**

---

# 2. Pre-PROMOTE 規劃階段｜而家可以做

未 PROMOTE 前，只做規劃文件。

## P0.1｜Implementation Scope Matrix

逐個 53 頁列：

- Route
- Primary Home
- Read / Write / Mixed
- Canonical source
- Query key
- Mutation contract
- Permission
- Scope
- Freshness
- Readback
- Empty / Error / Unknown
- Backend seam
- Implementation status

輸出：
**53-Page Implementation Matrix**

---

## P0.2｜A0 / A1 / A2 Carry-forward Matrix

逐件舊資產判：

- REUSE
- REWRITE
- DELETE
- REFERENCE ONLY

例如：

REUSE：
- TanStack Query foundation
- QueryClient baseline
- auth proof flow
- zero-routing CI
- no-v2-state tests

REWRITE：
- canonical validator → shared contract
- hard-coded MF01 → Scope Context
- App shell
- UI / IA

DELETE / DO NOT PORT：
- v2 localStorage compatibility
- local sync-status
- canonical-hydrated markers
- old A1 prototype UI

REFERENCE ONLY：
- A2 read-model state semantics
- ACK exact-match rules

---

## P0.3｜Serving Identity / Freshness Contract

呢個係今次事故最核心。

正式定：

### Client build identity
V3 bundle build-time embedded：
- source SHA
- build ID
- release ID
- build time

### Serving identity
Preview / production response可讀：
- deployed release ID
- source SHA

### Canonical identity
Business config：
- publishedAt
- fingerprint
- canonical version

### Target identity
例如 SMT：
- observed fingerprint
- observed publishedAt
- appliedAt

UI / Diagnostics 必須分四層，
唔可以一粒「最新」代表全部。

---

## P0.4｜Store / Scope Context Contract

A1 hard-code MF01唔應擴大。

正式建立：
**Authenticated Store / Scope Context**

由：
Identity + Permission + Scope
決定可見 / 可操作 Store。

所有 Query Key / API Request 都由同一 Context取 Store，
唔散落 hard-code。

---

## P0.5｜Backend Seam Register

逐頁只列真正需要嘅 seam：

- Existing
- Needs read endpoint
- Needs mutation endpoint
- Needs readback
- Out of Admin scope

任何 gap：
先標記，
唔偷偷加 workaround。

---

# 3. PROMOTE 後正式實作順序

以下先可以開 code。

---

# Gate 1｜乾淨技術底座

目標：
V3 喺技術上已經唔會重犯 v2 stale-browser authority。

完成：

1. 新 one-shot implementation branch
2. 保留 A0 foundation
3. selective port A1 auth / Query primitives
4. shared canonical validator
5. Store / Scope Context
6. client build identity
7. serving release identity
8. no-v2-localStorage guard
9. no v2 state import
10. V3 CI

驗收：
- normal Safari
- second tab
- in-app browser
全部可以知道自己載入緊邊個 client release。

---

# Gate 2｜UI Shell / Design System

到呢步先正式開始做 UI foundation。

完成：

- 12 大 Menu
- 53 route skeleton
- Desktop / Tablet / Mobile Shell
- Sidebar / Drawer
- PageHeader
- Search
- Filter
- Table / Mobile Card
- Status
- Empty / Error / Stale
- DraftBar
- ConfirmDialog
- ReadbackPanel
- Form
- Timeline
- Copy Dictionary

重要：
**呢一步係共用 UI 系統，唔係一次過填晒 53 頁業務內容。**

---

# Gate 3｜第一條 Vertical Slice｜Keeta 驗收原始任務

呢條最優先。

Flow：

**登入**
→ **確認 Client Release**
→ **讀 Canonical**
→ **分類管理：新增分類**
→ **產品管理：新增商品**
→ **價格管理：設定價錢**
→ **儲存草稿**
→ **未發佈變更**
→ **檢查完整性**
→ **影響預覽**
→ **確認發佈**
→ **Cloud 已發佈**
→ **目標回讀確認**
→ **重新開 Safari仍見最新結果**

呢條完成先證明：
Admin V3 真正解決今日驗收阻斷。

Acceptance：
- 無 localStorage server truth
- refresh / reopen 收斂
- published ≠ applied
- stale 不冒充 current
- query error不變 zero
- Safari / second tab結果一致

---

# Gate 4｜核心營運 Read Surfaces

完成：

- 今日
- 訂單監察
- 平台總覽
- 打印總覽
- 裝置狀態
- 發佈與版本
- 系統診斷

目的：
先建立「睇得準」能力。

---

# Gate 5｜完整 Config / Governance Workspaces

逐 domain補：

- 菜單其餘功能
- 售罄 / 供應
- Business Day / Cash
- Capacity
- Platform / Channel
- Print config
- Staff / Role / Permission
- Store Settings
- Quick Reasons
- Integrations
- Effective Settings

規則：
每一個 write都：
**Draft → Validate → Impact → Publish → Readback**

---

# Gate 6｜Reports / Productivity / Bulk

完成：

- 5 張固定 trusted reports
- Export governance
- Global Search
- Saved Views
- Favorites / Recent
- Bulk / Multi-select

呢啲唔應阻住最核心 config / freshness flow先完成。

---

# Gate 7｜全 53 頁收口

逐頁跑：

- Desktop
- Tablet
- Mobile
- Permission
- Loading
- Empty
- Error
- Stale
- Unknown
- Deep-link
- Back
- Search / Filter preservation
- Accessibility

53 / 53 Implementation Acceptance。

---

# Gate 8｜Physical Browser Acceptance

必測：

1. iPhone normal Safari
2. ChatGPT / in-app browser
3. desktop Safari
4. Chrome
5. second tab
6. reopen after deploy
7. focus / reconnect
8. stale existing browser state
9. new canonical publish
10. target readback
11. rollback v2

最重要：
唔准清 cache / Private mode先算 pass。

---

# 4. UI 到底排第幾

答案：

## 唔係第一
第一係：
**Implementation contracts + freshness / identity / scope foundations**

## 但亦唔係最後
第二就開始：
**UI Shell + Design System**

## 真正第一個要完整做嘅 UI
唔係首頁全套，
而係：
**Keeta驗收嗰條實際 config → publish → readback Vertical Slice**

原因：
佢可以最快證明新 V3係真解決問題，
唔係只換咗一層靚畫面。

---

# 5. 建議工作比例

正式 Implementation開始後：

第一階段：
- 40% foundation / contracts
- 35% UI system
- 25% vertical slice

第二階段：
- 20% shared engineering
- 60% domain UI / workflows
- 20% tests / acceptance

最後階段：
- 20% polish
- 80% acceptance / browser / physical / rollback

---

# 6. 唔應該做嘅順序

禁止：

### 錯誤方法 A
先畫 53 頁靚 UI
→ 最後先發現 backend/readback唔配合

### 錯誤方法 B
先將舊 A1/A2逐步 merge
→ 再慢慢改成新 Product Brief

### 錯誤方法 C
先搬 v2 localStorage data去 Zustand/Dexie
→ 將舊問題搬入 V3

### 錯誤方法 D
先做 Reports / Search / Favorites
→ 核心分類/商品/價格/發佈仍未證明

---

# 7. 依賴順序

最重要 dependency：

**Client Release Identity**
→ **Auth / Scope**
→ **Canonical Query**
→ **Draft**
→ **Publish Mutation**
→ **Canonical Refetch**
→ **Target Readback**
→ **Domain Expansion**
→ **Full Acceptance**

---

# 8. Owner 決策點

正式 code開始前只需要一個決策：

**是否 PROMOTE Current Product Brief，進 one-shot implementation。**

PROMOTE 後：
先做 Gate 1，
唔會直接跳去畫 53 頁。

---

# 9. Current Status

Product：
- 12 大 Menu
- 53 第二步 destination
- 53 / 53 First Viewport
- 53 LOCKED
- 0 YELLOW
- 0 RED

A1：
- BANK / SELECTIVE REUSE
- 不可原樣 merge

A2：
- SPEC / REFERENCE ONLY
- 無 implementation

Implementation：
**NOT STARTED**

Production：
**v2 LIVE**

---

MILESTONE:
MFK_ADMIN_V3_PRE_IMPLEMENTATION_PLAN_V1_READY
