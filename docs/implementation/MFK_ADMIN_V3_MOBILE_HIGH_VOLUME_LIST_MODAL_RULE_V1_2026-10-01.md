# MFK Admin V3｜Mobile High-Volume List + Modal Edit Rule V1

日期：2026-10-01  
狀態：OWNER LOCKED / IMPLEMENTED  
適用：手機版 בלבד（Desktop / Tablet 既有 layout 不受此規則取代）

## 1. 適用範圍

適用於手機版大量物件列表，例如：

- 產品管理
- 售罄／供應
- 其他同類大量商品／物件列表

Desktop 仍可使用完整 table / workspace。

## 2. 手機列表規則

手機唔直接一次過鋪晒大量商品。

固定語法：

1. 先顯示分類
2. 撳分類先展開該分類商品
3. 同一時間只需要展開目前工作分類
4. 每一頁最多 10 件
5. 多過 10 件必須分頁
6. 顯示：
   - 上一頁
   - 第 X / Y 頁
   - 下一頁

分類本身顯示商品數量。

## 3. 點商品

手機版：

撳任何商品
→ 即刻開 full-screen modal / sheet
→ 直接睇／改該商品資料

禁止：

撳商品
→ 去另一個長列表
→ 再搵同一件商品
→ 再入 Edit

## 4. 新增商品

手機版 Primary CTA：

新增商品
→ 即刻開空白 Create Modal
→ 填資料
→ validation 通過
→ 先可以「儲存草稿」

禁止：

新增商品
→ 先生成一件空白／未知商品放入 List
→ 使用者之後再搵返佢
→ 再補資料

未填好必要資料：
「儲存草稿」必須 disabled。

## 5. Create Required Fields

依照目前 Owner 決定：

- 商品名稱 *
- 分類 *
- 基本價格 *
- 啟用狀態 *

商品編號：
- 系統自動生成
- Create 時唔要求人手輸入
- 儲存後先產生
- Edit 顯示但不可 inline 修改

## 6. Preview Safety

目前 Cloudflare Preview：

- fixture / preview edit 只係 UI 驗收
- 明確標示非 Canonical
- reload 可清除 preview modification
- 不寫 Production
- 不冒充正式 Saved Draft

正式 V3 接 canonical mutation 時仍要跟：
Draft → Validate → Impact → Publish → Readback。

## 7. Reusable Component

高容量手機列表採共用：
`MobileGroupedPager`

預設：
`pageSize = 10`

後續 Product / Availability / 類似商品列表必須重用同一 interaction grammar，唔每頁自行再發明。

MILESTONE:
MFK_ADMIN_V3_MOBILE_HIGH_VOLUME_LIST_MODAL_RULE_V1_LOCKED
