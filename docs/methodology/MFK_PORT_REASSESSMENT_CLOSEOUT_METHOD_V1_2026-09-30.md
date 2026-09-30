# MFK｜端口重新盤點、重整、收口方法 V1

日期：2026-09-30  
來源：由 Admin V3 Product Brief R1 實際工作流程抽取  
適用：Admin、SMM、SMT、Owner、Customer，以及日後其他 MFK client / workspace  
目的：將「發現問題 → 查清事實 → 重整產品 → 逐層驗收 → 收口 → 交 Implementation」變成可重複、可審核、可接手嘅標準方法。

---

# 0. 呢套方法解決乜

適用於以下情況：

- 端口功能已亂
- Menu / Page 多但搵唔到功能
- 同一功能出現喺幾個地方
- 前端自己形成第二套 Authority
- 狀態語義混亂
- UI 看似齊，但實際工作流程斷裂
- Mobile / Desktop 行為不一致
- 功能有 UI 但無 backend contract
- 新舊版本並存，需要重新建立產品基準
- 想重建一個端口，但唔想一開始就寫 code

核心思想：

**先查清楚個產品「應該係乜」，再決定「點樣寫」。**

---

# 1. Skill 最終輸出

每次盤點最終必須產出：

1. Current Reality Report
2. Authority Map
3. Product Map
4. Gap Map
5. Collision Audit
6. Page Inventory
7. First Viewport Acceptance
8. Cross-page Workflow Audit
9. High-risk Workflow Contract
10. Bulk / Productivity Contract
11. Component Contract
12. Responsive / Interaction Contract
13. Copy Dictionary
14. Owner Review Closeout Pack
15. Implementation Entry Conditions
16. Handoff / Milestone Record

如果以上未齊，
唔應該話「產品盤點完成」。

---

# 2. Phase 0｜先鎖 Authority，同埋停止亂改

第一件事唔係睇 UI。

要先答：

- 邊個係 transaction authority？
- 邊個係 config authority？
- 邊個係 payment authority？
- 邊個係 pricing authority？
- 邊個係 sellability authority？
- 邊個係 print authority？
- 邊個係 device/runtime authority？
- Browser 有冇自己持有本來唔應該持有嘅 truth？
- 現時 production baseline 係邊個版本？
- 盤點期間可唔可以改 production？

輸出：
**Authority Map + Freeze Rule**

硬規則：
未鎖 authority 前，
禁止開始大規模 UI redesign。

---

# 3. Phase 1｜由「症狀」開始，但唔停喺症狀

收集真實問題：

例：
- 落唔到單
- 平台自動接單錯
- SMM / SMT 連唔到
- 打印結果唔知
- 發佈咗但現場未套用
- Menu 入面搵唔到功能
- 同一設定幾度都有

每條症狀要拆成：

1. 使用者見到乜
2. 實際受影響工作
3. 相關 domain
4. 目前 authority
5. 可信證據
6. 第一個可信 break point
7. 暫時未知乜

禁止：
一見 timeout 就判失敗；
一見 UI 顯綠就判系統正常。

輸出：
**Problem / Evidence Matrix**

---

# 4. Phase 2｜建立 Current Reality

唔先問「理想設計係乜」。

先盤：

- 現有頁面
- 現有 Menu
- 現有 Route
- 現有功能
- 現有操作
- 現有 backend seam
- 現有 read model
- 現有 mutation contract
- 現有 mobile 行為
- 現有 copy
- 現有 known gap

每項標：

- EXISTS
- PARTIAL
- BROKEN
- DUPLICATED
- UNKNOWN
- NO CONTRACT

輸出：
**Current Reality Inventory**

---

# 5. Phase 3｜先判斷端口係邊種工作面

每個端口先分類，唔好一套 UI 套晒。

## A. 管理型後台
例：Admin

主要工作：
搵、睇、配置、審核、發佈、分析

基本語法：
**導航 → 清單 → 詳情 → 編輯 / 正式流程**

## B. 營運工作台
例：SMM

主要工作：
知道而家有咩問題、影響邊度、下一步做乜

基本語法：
**狀態 → 影響 → 工作項目 → 安全操作 → 確認結果**

## C. 現場控制台
例：SMT

主要工作：
最快完成現場動作

基本語法：
**目前狀態 → 一個主要動作 → 即時確認**

## D. 消費者交易介面
例：Customer

主要工作：
理解選擇、完成交易、知道結果

基本語法：
**選擇 → 確認 → 付款 / 提交 → 訂單狀態 → 售後**

## E. Owner / Manager 摘要介面
主要工作：
看重點、判斷風險、快速 drill-down

基本語法：
**關鍵數字 → 注意事項 → 原因 → 前往責任頁**

輸出：
**Port Archetype**

---

# 6. Phase 4｜建立 Product Map

目的：
回答「功能應該放邊」。

步驟：

1. 列晒所有功能
2. 按人類第一直覺分 domain
3. 每個功能指定唯一 Primary Home
4. Summary / shortcut 可以跨 domain，但唔複製 Authority
5. 正式功能最多兩步搵到
6. Detail / Edit 唔當第三層導航

同時做 Collision Audit：

- Sales vs Payment
- Product vs Sellability
- Product vs Pricing
- Product vs Print
- Print vs Device
- Platform vs Integration
- Business Day workflow vs boundary setting
- Queue vs Diagnostics vs Audit
- Runtime version vs Config version

輸出：
**Product Map + Primary Home Matrix + Collision Audit**

---

# 7. Phase 5｜做 Gap Map

每個問題分清楚係邊類：

- UI_GAP
- IA_GAP
- COPY_GAP
- READ_MODEL_GAP
- BACKEND_CONTRACT_GAP
- AUTHORITY_GAP
- STATE_SEMANTIC_GAP
- MOBILE_GAP
- ACCEPTANCE_GAP

最重要：
**唔可以用 UI 補 backend contract。**

例如：
畫到一個「成功」掣，
唔代表 backend 有正式 execute contract。

輸出：
**Gap Map**

---

# 8. Phase 6｜逐頁 First Viewport Acceptance

對 Product Map 每個第二步頁面逐頁驗。

Desktop 第一屏要問：

- Page title 有冇？
- Current state 有冇？
- Primary CTA 有冇？
- 核心 List / Workspace 有冇開始？
- Filter 有冇食晒第一屏？
- Danger action 有冇搶主位？

Mobile 第一屏要問：

- 最重要資訊仲喺唔喺上面？
- 有冇被 table 橫向 scroll 綁死？
- Primary action 容唔容易搵？
- 有冇將進階工程資料推上第一屏？

每頁狀態：

- LOCKED
- YELLOW
- RED

YELLOW：
產品方向已定，但有外部 dependency。

RED：
產品本身仍未定。

輸出：
**Page Acceptance Inventory**

---

# 9. Phase 7｜跨頁互動盤點

唔再只睇單頁。

要驗：

- Deep-link 帶唔帶 context
- Back 返唔返原位
- Search / Filter / Sort / Scroll 保唔保留
- Draft 跨頁後仲喺唔喺
- Detail → Related Domain → Back
- Mobile drawer 會唔會重置
- Search → Detail → Back
- Queue → 責任頁 → 返回 Queue

核心：
**做完一件事返轉頭，使用者唔可以迷路。**

輸出：
**Cross-page Workflow Matrix**

---

# 10. Phase 8｜高風險操作盤點

所有高風險操作統一：

**目前事實 → 影響預覽 → 權限 / 規則 → 確認 → 執行 → 等待 → 回讀 → 結果 → 證據**

驗：

- Refund
- Cancel
- Correction
- Publish
- Rollback
- Revoke
- OTA
- Pause / Resume
- Sellability
- Close Day
- Print recovery

硬規則：

- Timeout ≠ Failed
- Unknown 禁 blind retry
- Request accepted ≠ Completed
- Published ≠ Applied
- Connected ≠ Business Ready

輸出：
**High-risk Workflow Contract**

---

# 11. Phase 9｜Bulk / Multi-select

驗：

- 多選模式
- 全選語義
- Scope 綁定
- Impact Preview
- Partial Success
- Per-item Result
- Undo / reversal semantics
- Return Context
- Export permission

正式流程：

**選取 → 操作 → 影響預覽 → 驗證 → 權限 → 確認 → 執行 → 每項結果 → 返回原位置**

輸出：
**Bulk Interaction Contract**

---

# 12. Phase 10｜熟手效率層

成熟產品唔只靠 Menu。

要考慮：

- 全局搜尋
- 快速前往
- 已儲存檢視
- 收藏
- 最近使用
- 最近搜尋
- 角色感知導航
- 非點擊視覺分組

但：
以上全部只係 Navigation / Presentation / Query Convenience。

唔係 business authority。

輸出：
**Productivity Navigation Contract**

---

# 13. Phase 11｜共用元件 Contract

全產品鎖同一套：

- PageHeader
- SearchField
- FilterBar
- DataTable
- Mobile Record Card
- StatusBadge
- EmptyState
- ErrorState
- StaleBanner
- DraftBar
- ConfirmDialog
- ReadbackPanel
- Timeline
- Form
- Tabs
- Toast
- Loading Skeleton

核心：
同一類事情唔准每個 domain 自己發明另一套。

輸出：
**Component Contract**

---

# 14. Phase 12｜Responsive / Density

驗：

- Desktop
- Laptop
- Tablet
- Mobile

唔係硬縮。

要鎖：

- Sidebar
- Content width
- Row density
- Mobile cards
- Sticky zones
- Modal / Drawer / Sheet
- Form grid
- Danger placement
- Touch target
- Accessibility

輸出：
**Responsive Contract**

---

# 15. Phase 13｜操作手感

驗：

- Button states
- Hover
- Focus
- Keyboard
- Selection
- Drag
- Animation
- Loading
- Progress
- Optimistic UI
- Tooltip
- Toggle
- Overflow
- Badge
- Scroll
- Auto-refresh

硬規則：
高風險 mutation 禁 optimistic success。

輸出：
**Interaction Contract**

---

# 16. Phase 14｜文字與術語

建立正式 Copy Dictionary。

要鎖：

- Page title
- Button
- Empty
- Error
- Stale
- Unknown
- Confirm
- Domain status
- Save / Draft / Publish / Applied
- Technical English exposure level

原則：

**普通使用者先睇人話。**

輸出：
**Copy Dictionary + 逐頁 Copy Matrix**

---

# 17. Phase 15｜Owner Review 收口

收口包最少包括：

1. Product Map
2. First Viewport
3. Cross-page
4. High-risk
5. Bulk
6. Productivity
7. Components
8. Responsive
9. Interaction
10. Copy
11. RED / YELLOW 清單
12. Backend Contract Gaps
13. Implementation Entry Conditions
14. Owner Checklist

狀態一定分：

- READY FOR OWNER REVIEW
- APPROVED
- IMPLEMENTATION AUTHORIZED

三者唔可以混埋。

輸出：
**Owner Review Closeout Pack**

---

# 18. Phase 16｜Implementation Entry Gate

只有以下成立先開始 build：

- Owner 明確批准
- Product spec 已 merge
- Production baseline 保持安全
- Allowed paths / bounded seams 已定
- Gap 有處理原則
- Acceptance criteria 已定
- Rollback plan 已定

禁止：
未收口就一邊寫 code 一邊發明產品。

---

# 19. Phase 17｜Implementation 後驗收

完成 build 後唔即等於完成。

要跑：

1. Automated tests
2. Route / permission tests
3. State semantic tests
4. Desktop physical/browser acceptance
5. Tablet acceptance
6. Mobile acceptance
7. High-risk workflow acceptance
8. Readback acceptance
9. Cross-page return acceptance
10. Rollback acceptance

再判：

- GREEN
- YELLOW
- RED

---

# 20. Phase 18｜Cutover 收口

Production cutover 前：

- Preview acceptance GREEN
- Critical YELLOW 已 bounded
- Rollback verified
- v2 fallback verified
- Observability ready
- Exact route switch documented
- Owner explicit promotion

Cutover 後：

- Smoke test
- business critical flow
- readback
- rollback trigger threshold
- final handoff

---

# 21. RED / YELLOW / LOCKED 定義

## LOCKED
產品定義完整，可以交 implementation。

## YELLOW
產品定義完整，但有外部 dependency / backend seam / evidence 未完成。

## RED
產品本身未定，或者存在 authority / safety contradiction。

硬規則：
**唔可以用「暫時照做」將 RED 扮成 YELLOW。**

---

# 22. 每輪工作固定節奏

每個 Batch 都跟：

1. 讀 controlling authority
2. 取 fresh source
3. 只盤一個清楚範圍
4. 寫規則
5. 判 LOCKED / YELLOW / RED
6. 更新 canonical doc
7. 留 milestone
8. GitHub handoff
9. Drive handoff
10. Jade Note handoff
11. 明確下一批

目的：
任何人中途接手都知道做到邊。

---

# 23. 端口盤點完成標準

一個端口只有以下全部完成，
先叫「產品盤點完成」：

- Authority 清楚
- Current Reality 清楚
- Product Map 完成
- Gap Map 完成
- Page Inventory 完成
- First Viewport 100%
- Cross-page 完成
- High-risk 完成
- Bulk / Productivity 完成（如適用）
- Components 完成
- Responsive 完成
- Interaction 完成
- Copy 完成
- RED = 0
- 所有 YELLOW 有明確 owner / dependency / handling rule
- Owner Review Pack 完成
- Implementation Entry Conditions 完成

---

# 24. 呢套方法唔做乜

唔會：

- 未查 authority 就 redesign
- 用 UI 假裝 backend capability 存在
- 用 browser local state 做正式 truth
- 為咗「少 Menu」收埋正式功能
- 為咗「手機化」將功能刪走
- 將 Unknown 顯成 Failed
- 將 Request accepted 顯成 Completed
- 一路 implementation 一路偷偷改 Product Map
- 將 Review Ready 當 Approved

---

# 25. 最終一句

每次重整端口都依次問：

**依家真實發生緊乜 → 邊個有權決定 → 功能應該擺邊 → 使用者第一眼應該見乜 → 工作流程點行 → 高風險點證明 → 全產品點一致 → 仲欠乜 → 點樣收口 → 幾時先准 implementation。**

MILESTONE:
MFK_PORT_REASSESSMENT_CLOSEOUT_METHOD_V1_READY
