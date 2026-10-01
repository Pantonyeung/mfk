# MFK Admin V3｜Catalog Actual Function Correction Lock V1

日期：2026-10-01  
狀態：OWNER CORRECTION LOCKED / IMPLEMENTED IN NON-PRODUCTION PREVIEW  
Implementation branch：feat/MFK-V3ADMIN-ONE-SHOT-R1  
Public preview：https://mfk-admin-v3-ui-preview.pages.dev/

## 1. Owner Correction

菜單管理唔可以只得效果畫面。

以下能力全部必須係實際可操作 Preview implementation：

1. 商品圖片
2. 選項／口味
3. 套餐
4. 餐桌管理

## 2. Product Image Authority

所有 Product image binary：
**R2 ONLY**

禁止：
- 外部 URL 做正式 image authority
- Browser 持有 R2 credential
- 圖片 binary 放 localStorage / IndexedDB
- Customer image 同第三方平台 image 混做同一張不可分辨 truth

每件商品支援至少兩個 image surface：

### 自家／Customer 顯示圖
用途：
- MFK Customer
- SMM / own presentation
- 自家介面

### Keeta 平台圖
用途：
- Keeta / third-party platform specific presentation
- 可同 Customer 圖不同

兩者 binary 全部存 R2，
Canonical / Draft 只保存 R2-backed reference。

Non-production preview bucket：
`mfk-admin-v3-product-media-preview`

Object key：
`product-media/{storeId}/{productId}/{surface}/{sha256}.{ext}`

surface：
- customer
- keeta

## 3. Product Editor

商品 Edit / Create modal 必須有：

- 商品名稱
- 系統生成商品編號
- 分類
- 基本價格
- 啟用狀態
- 商品描述
- 自家／Customer R2 圖片
- Keeta R2 圖片
- 套用 Option Set
- Combo relationship summary
- 打印摘要

Create：
必填未完成前不可儲存；
唔會先建立空白商品。

## 4. Options

`/admin/catalog/modifiers`

唔再只係效果卡。

實際可：
- 新增選項組
- 改名
- required / optional
- single / multi
- min / max
- 新增子選項
- 子選項 code
- 子選項名稱
- +/- price adjustment
- active
- 商品映射

Preview state 改動會即時反映 Product Editor。

## 5. Combo

`/admin/catalog/combos`

實際可：
- 新增套餐
- 套餐名稱
- 基本價格
- active
- 新增 group
- group required / min / max
- 加入正式 Product
- 加入套餐專用文字選擇
- adjustment
- remove choice

Product Editor 會顯示被邊個 Combo 引用。

## 6. Dining Tables

恢復正式入口：

`/admin/store/tables` — 餐桌管理

實際可：
- 新增餐桌
- 餐桌名稱
- 系統 table identity
- 座位數
- 區域
- 顯示次序
- active / inactive
- 刪除 Preview table

此功能原本唔應該因 53-route matrix 漏列而消失。
由 Owner correction 起，Admin V3 current route count = 54。

## 7. Preview / Production Boundary

以上全部：
- 只喺 persistent Cloudflare Preview Lab
- 唔改 admin.morefunos.com
- 唔 merge Production route
- 唔執行 transaction mutation

R2 upload：
- Preview 使用 dedicated non-production R2 binding
- Production R2 binding 要到正式 cutover/promotion先處理

MILESTONE:
MFK_ADMIN_V3_CATALOG_ACTUAL_FUNCTION_CORRECTION_R2_TABLES_V1_LOCKED
