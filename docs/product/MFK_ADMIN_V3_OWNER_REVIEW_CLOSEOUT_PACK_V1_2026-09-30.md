# MFK Admin V3｜Owner Review 收口包 V1

日期：2026-09-30  
狀態：READY FOR OWNER REVIEW  
適用：Admin V3 Product Brief R1 審批  
產品 Issue：#601  
Draft PR：#602  
Production baseline：v2 繼續運行  
Implementation：NOT STARTED / NOT AUTHORIZED

---

# 0. 一頁結論

Admin V3 Product Brief R1 已完成產品層定義。

現時已鎖：

- 12 個大 Menu
- 54 個第二步頁面
- 54 / 54 第一屏
- 跨頁返回 / Filter / Draft / Context
- 高風險操作
- Bulk / Multi-select
- 全局搜尋 / 已儲存檢視 / 收藏 / 最近使用
- 共用元件
- Desktop / Tablet / Mobile
- Keyboard / Focus / Loading / Selection / Drag
- 正式中文字典
- 54 頁 CTA / Empty / Error / Confirm 文案
- Implementation Copy Dictionary

目前：
- RED：0
- 唯一 YELLOW：1
- 唯一 YELLOW = Admin 日結後「付款方式修正」缺正式 Backend Contract

因此：
**產品架構已完成 Owner Review 所需收口，但未獲 PROMOTE，Implementation 不可開始。**

---

# 1. Owner 今次實際要批乜

今次唔係批 code。

今次要批：
**Admin V3 產品應該點樣存在。**

包括：

1. 功能擺邊
2. 點搵功能
3. 第一屏見乜
4. List / Detail / Edit 點行
5. 高風險操作點確認
6. Save / Publish / Applied 點分
7. Desktop / Mobile 點轉
8. 狀態點講
9. 使用者點知道下一步
10. 邊啲功能因 backend 未有正式 contract 而必須先鎖住

---

# 2. Product Map｜12 大 Menu / 54 第二步頁面

## 2.1 今日
- 營運總覽
- 待處理事項

## 2.2 訂單管理
- 進行中訂單
- 訂單歷史
- 售後／退款／取消／修正
- 訂單異常

## 2.3 菜單管理
- 分類管理
- 產品管理
- 選項／口味管理
- 套餐管理
- 價格管理
- 顯示與排序

## 2.4 營運管理
- 售罄／供應
- 營業日
- 現金／收舖
- 產能／原料額度

## 2.5 平台／渠道管理
- 平台總覽
- 接單規則
- 供應同步
- 門店綁定
- 商品映射
- 匹配失敗
- 實收估算
- 平台對帳

## 2.6 打印管理
- 打印總覽
- 邏輯打印機
- 打印模板
- 打印規則
- 打印狀態／異常

## 2.7 裝置管理
- 裝置狀態
- OTA／版本

## 2.8 人員與權限
- 員工管理
- 角色管理
- 權限管理
- 登入／工作階段／受信任裝置

## 2.9 報表
- 銷售
- 產品
- 渠道
- 退款
- 營運
- 匯出

## 2.10 發佈與版本
- 未發佈變更
- 發佈中心
- 版本／回讀確認
- 回復版本

## 2.11 門店設定
- 門店資料
- 營業時間
- 營業日分界
- 營運時間／提醒設定
- 快捷原因

## 2.12 系統管理
- 操作記錄
- 系統診斷
- 系統整合
- 進階／實際生效設定

硬規則：
**大 Menu → 細 Menu → 已見到目標 List / Workspace → Detail / Edit**

Detail / Edit 唔算第三層導航。

---

# 3. 今日首頁｜Sales-first

首頁唔係功能目錄。

首頁只回答：

1. 今日做咗幾多生意
2. 目前可唔可以正常營業
3. 有咩要處理
4. 今日訂單流點樣
5. 現金 / 收舖準備如何
6. 有冇未發佈變更

Desktop 第一屏優先次序：

1. 今日有效營業額
2. 訂單數 / 平均客單價 / 退款與調整
3. 營業準備狀態
4. 待處理事項
5. 訂單流
6. 現金 / 收舖
7. 未發佈變更

Mobile 第一屏都必須保留：
- 有效營業額
- 訂單數
- 平均客單價
- 退款 / 調整
- 高優先事項

禁止：
Error 變 $0。

---

# 4. 54 / 54 第一屏驗收

結果：

- 54 / 54 已完成
- 53 LOCKED
- 1 YELLOW
- 0 RED

唯一 YELLOW：
**訂單管理 → 售後／退款／取消／修正**

原因唔係 UI 未定，
而係：
**Admin 日結後付款方式修正缺正式 Backend Contract。**

除此之外：
Page position / First viewport / CTA hierarchy / Mobile / State / Authority 已全部鎖定。

---

# 5. 跨頁互動

已鎖：

- Deep-link 帶 context
- Back 返回原頁
- Filter / Sort / Search / Scroll 保留
- Saved View 保留
- Draft Bar 跨頁 continuity
- Mobile Drawer 返回正確位置
- Detail → Related Domain → Back
- Search → Detail → Back
- Action Queue → 責任頁 → 返回 Queue

原則：
**使用者處理完問題，唔可以返到一個完全唔知自己頭先喺邊嘅頁面。**

---

# 6. 高風險操作

所有高風險操作統一：

**目前事實 → 影響預覽 → 權限 / 規則 → 確認 → 執行 → 等待確認 → 回讀 → 正式結果 → 證據**

適用：
- 退款
- 取消訂單
- 付款方式修正
- 發佈
- 回復版本
- 撤銷登入工作階段
- OTA
- 售罄 / 恢復
- 收舖
- 平台暫停 / 恢復接單
- 打印復原

硬規則：

- Timeout ≠ Failed
- Unknown 禁 blind retry
- Cancel ≠ Refund
- Downloaded ≠ Installed
- Cloud Published ≠ Target Applied
- Rollback 建立新 release
- Printer Connected ≠ Print Success

---

# 7. Bulk / Multi-select

已鎖：

- Desktop checkbox + Bulk Action Bar
- Mobile 明確「選取」模式
- 「選目前頁」同「選全部篩選結果」分開
- Selection 綁 Store / Scope
- Bulk Price 必須 Before / After
- Partial Success 逐項顯示
- 無 generic Undo
- View permission ≠ Export permission

正式 Bulk Flow：

**選取 → 操作 → 影響預覽 → 驗證 → 權限 → 確認 → 草稿 / 執行 → 每項結果 → 返回原工作位置**

---

# 8. 熟手效率層

兩步 Product Map 係基本入口。

另外補：

1. 全局搜尋
2. 快速前往
3. 已儲存檢視
4. 收藏
5. 最近使用
6. 最近搜尋
7. Sidebar 視覺分組
8. 角色感知導航

重要：
呢啲全部係 Navigation / Presentation / Query Convenience。

唔係第二套 business authority。

---

# 9. 共用元件

已鎖：

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

Domain 可以換內容，
但唔可以各自發明第二套互動語法。

---

# 10. Desktop / Tablet / Mobile

Desktop：
- 大屏兩欄 Sidebar 可常駐
- 高密度 List / Table
- Search / Filter 同一工作列

Tablet：
- 大 Menu rail
- 細 Menu overlay
- Content 優先

Mobile：
- Drawer
- Table → Record Cards
- Filter → Sheet
- Form → 單欄
- 高風險 action 有清楚 bottom action
- 唔依賴 hover / drag / horizontal scroll

核心原則：
**同一 IA、同一名稱、同一 Authority；唔係 Desktop 畫面硬縮。**

---

# 11. 操作手感

已鎖：

- Button states
- Focus-visible
- Keyboard navigation
- Modal focus restore
- Selection
- Drag 替代操作
- Motion duration
- Route transition
- Loading modes
- Progress
- Optimistic UI 邊界
- Tooltip 邊界
- Inline edit
- Toggle 邊界
- Overflow menu
- Notification badge
- Scroll preservation
- Auto-refresh

高風險 mutation：
**禁止 optimistic success。**

---

# 12. 正式中文字典

獨立文件：

**docs/product/MFK_ADMIN_V3_COPY_DICTIONARY_V1_2026-09-30.md**

核心正式用詞：

- Save Draft → 儲存草稿
- Pending Changes → 未發佈變更
- Impact Preview → 影響預覽
- Cloud Published → 雲端已發佈
- Target Applied → 目標已套用
- Readback → 回讀確認
- Rollback → 回復版本
- Business Day → 營業日
- Tender Correction → 付款方式修正
- Session → 登入工作階段
- Trusted Device → 受信任裝置
- Effective Settings → 實際生效設定
- Effective Sales → 有效營業額

普通 UI 禁止主要 Button：
- OK
- Apply
- Fix
- Action
- More
- Yes

---

# 13. 唯一 YELLOW

## Admin 日結後付款方式修正

產品規格已經定：

- 同一張 Order
- 原付款歷史保留
- 新增 correction record
- zero new Order
- zero auto reprint
- zero auto drawer action
- permission
- reason
- version guard
- readback
- audit

但：
**目前正式 Backend Admin mutation seam 未證明存在。**

所以 implementation 規則：

- 可以 build read / route / form / preview UI
- 正式 Execute action 要等 bounded backend contract
- 無 contract 唔顯假成功
- 唔用 browser / direct DB / workaround 造第二 Authority

此項係：
**BACKEND_CONTRACT_GAP**

唔係：
UI RED。

---

# 14. Product Brief 審批後，Implementation Entry Conditions

只有以下全部成立先可以正式進 one-shot build：

1. Owner 明確 PROMOTE Product Brief #601 / PR #602
2. Product-spec-only PR merge
3. v2 production 保持 live
4. One-shot implementation packet 由已批准 Product Brief 產生
5. 只改 approved V3 paths / bounded seams
6. 唔改 transaction / pricing / payment / fulfillment / provider / SMT canonical authority
7. R2 A0→A6 只作 implementation 內部 gate
8. 完成完整 Admin V3 R1 preview
9. 自動測試 + browser / physical acceptance
10. 驗證可 rollback 至 v2
11. 之後先提出 production cutover
12. Merge / deploy / route switch 仍要適用 Owner PROMOTE

---

# 15. Owner Review Checklist

Owner 只需逐項判斷：

- [ ] 12 大 Menu / 54 頁位置接受
- [ ] 兩步導航規則接受
- [ ] 今日首頁 Sales-first 接受
- [ ] 54 頁 First Viewport 接受
- [ ] List → Detail → Edit 基本工作法接受
- [ ] 高風險工作流接受
- [ ] Search / Saved View / Favorites / Recent 接受
- [ ] Desktop / Tablet / Mobile 轉換接受
- [ ] 共用元件 / 操作手感接受
- [ ] 正式中文字典接受
- [ ] 日結後付款方式修正維持 BACKEND_CONTRACT_GAP，Implementation 唔造假
- [ ] 接受後先發出明確 PROMOTE

---

# 16. Owner 未 PROMOTE 前

嚴禁：

- merge PR #602
- 開始 one-shot implementation
- deploy V3
- route production
- 切 canonical hostname
- 以呢份文件當作已經批准

目前正式狀態：

**READY FOR OWNER REVIEW**

唔係：

**APPROVED**

---

# 17. 收口判斷

Product Brief R1 已經由：

「功能清單」

進化到：

**Product Map + First Viewport + Cross-page Workflow + Component Contract + Responsive + Interaction + Copy Contract**

目前產品層冇 RED。

唯一未閉環：
**日結後付款方式修正 Backend Contract。**

因此本階段完成定義係：

**產品審批包已準備完成，等待 Owner Review / PROMOTE。**

MILESTONE:
MFK_ADMIN_V3_OWNER_REVIEW_CLOSEOUT_PACK_READY
