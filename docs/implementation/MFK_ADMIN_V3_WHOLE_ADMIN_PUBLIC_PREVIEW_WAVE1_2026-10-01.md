# MFK Admin V3｜Whole Admin Public Preview Implementation Wave 1

日期：2026-10-01  
狀態：IMPLEMENTATION IN PROGRESS / NON-PRODUCTION  
Owner direction：開始將整個 Admin 處理  
Implementation branch：feat/MFK-V3ADMIN-ONE-SHOT-R1  
Public preview：https://mfk-admin-v3-ui-preview.pages.dev/

## 1. Wave 1 Goal

先將已鎖嘅完整 Admin V3 Product Map 寫成可操作公網實作，
唔再留大量空白 placeholder。

53 個正式 routes：
- 全部有對應 workspace
- 全部保持正式 Page Title / Primary CTA / Empty / Status grammar
- Product / Availability 使用已鎖高容量手機 grammar
- Transaction monitoring 保持 read-only
- Config / Governance 顯示 Draft workflow
- Preview fixture 明確標示非 Canonical

## 2. Route Coverage

53 / 53 routes have a public-preview workspace.

特別已獨立實作：
- /admin/catalog/products
- /admin/availability

其餘 routes 由共用 AdminWorkspace system 實作，
按 domain 分為：
- 今日
- Action Queue
- 訂單
- 菜單
- 營運
- 渠道
- 打印
- 裝置
- 人員與權限
- 報表
- 發佈與版本
- 門店設定
- 系統管理

## 3. Mobile

已鎖 Mobile high-volume grammar：
- category accordion
- max 10 items / page
- previous / next pagination
- tap item → immediate modal
- Add → immediate create modal
- no blank object creation before required fields complete

Product / Availability 已直接使用。
後續商品映射／大量商品類 workspace沿用同一 grammar。

## 4. Authority Safety

Wave 1 public preview：
- 非 Production
- preview fixtures 非 Canonical
- 不執行交易 mutation
- 不改 admin.morefunos.com routing
- v2 Production 保持 live

正式 backend seam只會按現有 VERIFIED seam逐步接入。
GAP 唔會由 frontend自行發明 authority。

## 5. Core Files

- v3admin/src/admin-workspaces.tsx
- v3admin/src/admin-workspaces.test.tsx
- v3admin/src/product-list.tsx
- v3admin/src/availability-page.tsx
- v3admin/src/mobile-grouped-list.tsx
- v3admin/src/admin-shell.tsx
- v3admin/src/styles.css

## 6. Next Waves

Wave 2：
formal data/read seams：
- Overview
- Orders
- Reports
- Channels
- Publish / Readback

Wave 3：
formal Config Draft workflows：
- Category
- Product
- Modifier
- Combo
- Pricing
- Store
- Staff / Permission
- Print

Wave 4：
remaining GAP / governance seams，
每個缺失 seam fail-closed，唔造第二 authority。

MILESTONE:
MFK_ADMIN_V3_WHOLE_ADMIN_PUBLIC_PREVIEW_WAVE1_STARTED
