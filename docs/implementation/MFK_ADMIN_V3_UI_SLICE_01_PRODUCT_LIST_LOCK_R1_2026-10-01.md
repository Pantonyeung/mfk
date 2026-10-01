# MFK Admin V3｜UI-01 產品管理 Default List｜UI Lock + Implementation Spec R1

日期：2026-10-01
狀態：OWNER CONFIRMED / READY FOR IMPLEMENTATION
UI Slice：UI-01
Route：/admin/catalog/products
Planning Branch：https://github.com/Pantonyeung/mfk/tree/plan/MFK-V3ADMIN-UI-SHELL-R1
Implementation PR：https://github.com/Pantonyeung/mfk/pull/605
Current implementation head at lock time：41dcb7cc5265fe63d5d35058bcf35d2fd69d0cd5

---

# 0. Owner Decision

UI-01 正式確認。

產品管理預設畫面：
**只顯示完整 Product List。**

產品設定 / 編輯面板：
**唔可以長期固定喺右邊。**

只有：
**點擊某件產品**
先開：
**temporary slide-over drawer / overlay editor**。

關閉 Drawer：
**完整 Product List 恢復。**

呢個互動規則由 UI-02 負責詳細定義。

---

# 1. UI-01 User Job

使用者入「菜單管理 → 產品管理」時，
第一件事應該係：

1. 快速搵產品
2. 快速判斷產品狀態
3. 快速篩選 / 排序
4. 快速新增產品
5. 點入某件產品再編輯

唔應該：
一入頁就被固定右欄佔去大量工作空間。

---

# 2. First Viewport Lock

Desktop 第一屏必須包含：

- Page Title：產品管理
- 搜尋
- 分類快捷 Filter
- 狀態 Filter
- 排序
- List / Grid 切換（如保留）
- 產品總數
- Primary CTA：新增產品
- Product Table / List 立即開始
- Draft / Pending Changes 提示（如存在）
- 無固定 Product Editor

---

# 3. Desktop Layout

## Left
沿用正式 Admin V3 navigation：

菜單管理
- 分類管理
- 產品管理 ← selected
- 選項／口味管理
- 套餐管理
- 價格管理
- 顯示與排序

## Main Workspace
完整使用內容寬度。

推薦欄位：

- Selection
- 商品圖片
- 商品名稱
- 商品編號
- 分類
- 基本價格
- 狀態
- 打印規則
- 最近更新
- Row Actions

## Product Row
Row click：
開 UI-02 Product Drawer。

Checkbox click：
只做 Selection，
唔打開 Drawer。

Overflow menu：
Secondary actions only。

---

# 4. Product Code Rule

商品編號：
**系統自動生成。**

UI-01 List：
可顯示 code，例如：
MF001 / PRD000123。

但：
- 唔提供 inline edit
- 唔當 primary identity
- 商品名稱仍係人類主要 identity

UI-02 / UI-03：
顯示：
「系統自動生成，建立後不可手動修改」

---

# 5. Takeaway Surcharge Rule

舊概念：
「外賣加 $1」

正式改為：
**外賣附加費**

金額：
**可自訂。**

UI-01 List：
唔需要將呢個 setting變成主要欄位。

UI-02 Product Drawer：
- toggle enabled/disabled
- configurable amount
- HK$ currency
- amount validation

---

# 6. Search / Filter

Search：
搜尋：
- 商品名稱
- 商品編號
- 關鍵字

Category chips / filter：
- 全部
- 飯類 / 飯糰 / 便當 / 茶飲 / 小食 / 湯品 / 甜品
實際 options由 canonical data。

Status filter：
- 全部
- 已發佈
- 草稿
- 待回讀
- 已停用 / 不可售（按 domain contract）

禁止：
用 UI filter產生第二 truth。

---

# 7. Table State

必須支援：

INITIAL_LOADING
→ Skeleton

EMPTY
→ 目前未有商品

ERROR
→ 暫時無法取得商品資料

REFRESHING
→ 保留舊資料 + 更新中

STALE
→ 資料過期 · 顯示上次成功資料

OFFLINE_WITH_DATA
→ 離線 · 顯示上次成功資料

UNKNOWN
→ 唔用於普通 List read，除非 object status本身結果未明

---

# 8. Row Status

正式狀態只顯 business meaning。

例：
- 已發佈
- 草稿
- 待回讀
- 已停用
- 資料過期
- 結果未明

禁止：
- READY
- STALE
- PENDING
直接做普通 UI label。

---

# 9. Draft / Pending Changes

如果存在未發佈變更：

可在頁底 / sticky bar顯：

「2 項未發佈變更」

Actions：
- 查看草稿
- 檢查
- 發佈

但：
UI-01 本輪只做 presentation contract。
正式 Draft / Pending Changes backend seam仍跟 Backend Seam Register。

---

# 10. Responsive

## Tablet
- Sidebar可縮成 rail
- Product List保留
- 非核心 columns可收起
- 點 row後 UI-02 drawer / overlay

## Mobile
Default：
- Product List → Product Cards
- 每張 Card至少：
  - 商品名稱
  - 分類
  - 價格
  - 狀態
  - 圖片（如有）
- 點 Card → full-screen detail / sheet
- 唔使用 Desktop固定右欄
- 唔需要橫向 scroll先睇核心資料

---

# 11. Interaction Rules

- Row click ≠ checkbox click
- Row hover只係輔助
- Keyboard Enter可開 product detail
- Focus-visible
- Back / Close恢復：
  - Search
  - Filter
  - Sort
  - Scroll position
  - Selection（如合理）
- Drawer開啟唔改 route identity（除非 UI-02 final決定用 object subroute）
- unsaved edit由 UI-02處理

---

# 12. Visual Direction

已確認方向：

- warm off-white / cream
- premium enterprise
- high information clarity
- clean table density
- subtle shadows
- rounded surfaces
- restrained accent
- no entertainment dashboard feel
- no permanent right inspector

參考方向：
- user supplied admin/list references
- Component Gallery
- Minimal Gallery
- Appshot Gallery
- Navbar Gallery
- CTA Gallery
- ui2v reference as inspiration only

---

# 13. Implementation Boundaries

UI-01 實作只准：

- route / page shell
- Product List presentation
- search/filter/sort UI
- responsive record layout
- row selection behavior
- opening hook for UI-02
- draft indicator presentation contract

唔准：
- 假 product mutation
- refund/cancel/payment mutation
- frontend canonical persistence
- v2 localStorage
- backend workaround
- production route switch

---

# 14. Acceptance

UI-01 GREEN 必須：

- Default Product List full-width
- No permanent right editor
- Product row click有明確 open-detail affordance
- 產品編號顯示為 system identity，不可 inline edit
- Search/filter/sort usable
- Desktop/tablet/mobile responsive
- Empty/Error/Stale清楚
- no fake authority
- no horizontal core-data scroll on mobile
- Copy Dictionary一致
- tests/typecheck/build GREEN
- isolated V3 preview可打開
- Owner visual acceptance

---

# 15. Implementation Handoff

當 Codex Vertical Slice FIRST BREAK 回覆後：

如果佢會改：
- App.tsx
- admin-shell.tsx
- styles.css
- navigation.ts
- ui.tsx

就由同一 implementation branch直接整合 UI-01，
避免雙 branch collision。

如果佢唔碰 Product List：
可由 bounded UI commit實作，再 rebase / cherry-pick入 one-shot branch。

---

MILESTONE:
MFK_ADMIN_V3_UI_01_PRODUCT_LIST_OWNER_CONFIRMED
MFK_ADMIN_V3_UI_01_PRODUCT_LIST_IMPLEMENTATION_SPEC_READY
