# MFK Admin V3｜正式介面文字字典 V1

日期：2026-09-30  
適用：Admin V3 UI implementation / QA / Review  
Authority：MFK Admin V3 Product Brief §64–§66

---

# 1. 核心原則

1. 使用者可見 UI 以中文為主。
2. 工程英文 enum / schema 可以保留，但唔直接做普通 UI label。
3. 同一概念只用一個正式名稱。
4. Button 用「動詞 + 明確物件 / 結果」。
5. UNKNOWN / STALE / PARTIAL / PENDING 唔偽裝成成功或失敗。
6. Save / Publish / Applied 分開。

---

# 2. 設定生命週期

| Internal | 正式 UI |
|---|---|
| Save Draft | 儲存草稿 |
| Draft | 草稿 |
| Pending Changes | 未發佈變更 |
| Validate | 檢查完整性 |
| Impact Preview | 影響預覽 |
| Publish | 發佈 |
| Publishing | 發佈中 |
| Cloud Published | 雲端已發佈 |
| Target Applied | 目標已套用 |
| Readback | 回讀確認 |
| Rollback | 回復版本 |

硬規則：
**儲存草稿 ≠ 發佈 ≠ 雲端已發佈 ≠ 目標已套用**

---

# 3. 狀態字典

| Internal | 正式 UI |
|---|---|
| INITIAL_LOADING | 正在讀取… |
| REFRESHING | 更新中 |
| EMPTY | 目前未有資料 |
| STALE | 資料過期 |
| OFFLINE_WITH_DATA | 離線 · 顯示上次成功資料 |
| OFFLINE_EMPTY | 離線 · 未有可顯示資料 |
| SUBMITTING | 正在處理… |
| PENDING | 已送出 · 等待確認 |
| UNKNOWN | 結果未明 · 正在重新確認 |
| PARTIAL | 部分完成 · 需要處理 |
| CONFIRMED | 已確認 |
| FAILED | 操作失敗 |
| CONFLICT | 資料已更新 · 請重新讀取後再套用 |
| UNAUTHORIZED | 你目前沒有權限進行此操作 |
| FATAL | 暫時無法繼續此工作 |
| MATCH | 一致 |
| MISMATCH | 不一致 |

---

# 4. 核心業務名詞

| Internal / 舊稱 | 正式 UI |
|---|---|
| Effective Sales | 有效營業額 |
| Orders | 訂單數 |
| AOV | 平均客單價 |
| Adjustments | 調整 |
| Refund | 退款 |
| Business Day | 營業日 |
| Business Day Boundary | 營業日分界 |
| Order Detail | 訂單詳情 |
| Tender Correction | 付款方式修正 |
| Fulfillment | 履約狀態 |
| Product | 商品 |
| Product Code | 商品編號 |
| Category | 分類 |
| Base Price | 基本價格 |
| Display Order | 顯示次序 |
| Sellability | 可售狀態 |
| Sold Out | 售罄 |
| Logical Printer | 邏輯打印機 |
| Physical Printer | 實體打印機 |
| Print Template | 打印模板 |
| Print Rule | 打印規則 |
| Production Ticket | 製作單 |
| Packing Ticket | 打包單 |
| Session | 登入工作階段 |
| Trusted Device | 受信任裝置 |
| Role | 角色 |
| Permission | 權限 |
| Scope | 管理範圍 |
| Audit | 操作記錄 |
| Diagnostics | 系統診斷 |
| Integration | 系統整合 |
| Effective Settings | 實際生效設定 |
| First Break | 第一個異常點 |

---

# 5. 正式 Button 動詞

## 導航
- 查看
- 查看詳情
- 返回列表
- 前往產品管理
- 前往打印管理
- 前往系統診斷
- 前往原設定頁

## 新增 / 編輯
- 新增商品
- 新增分類
- 新增角色
- 編輯
- 儲存草稿
- 取消

## 工作流程
- 檢查完整性
- 查看影響
- 確認發佈
- 開始今日營業
- 準備收舖
- 確認暫停 Keeta 接單
- 恢復供應
- 撤銷登入工作階段
- 回復至此版本

## 讀取 / 復原
- 重新讀取
- 重新確認狀態
- 查看證據
- 查看回讀確認

禁止作主要 Button：
- OK
- Go
- Apply
- Fix
- Action
- More
- Yes
- Retry（除非正式 safe-retry contract，而且改用具體中文）

---

# 6. Freshness / 時間

| 技術概念 | 正式 UI |
|---|---|
| Freshness | 最後更新 / 最後確認 |
| publishedAt | 發佈時間 |
| stale data | 資料過期 |
| last successful read | 最後成功讀取 |
| last successful sync | 最後成功同步 |

---

# 7. Page Title 規則

Sidebar 細 Menu 名 = Page Title。

禁止：
Sidebar 叫中文，入頁後 Page Header 用另一個英文名稱。

Detail：
主標題用 object identity；
副標可以寫：
- 訂單詳情
- 商品詳情
- 員工詳情
- 裝置詳情
- 版本詳情

---

# 8. 高風險確認文案模板

結構：
1. 明確標題
2. Object
3. 影響
4. 不影響乜（有需要）
5. 明確確認 Button

例：

**暫停 Keeta 接收新訂單？**

新 Keeta 訂單會暫停接收；已成立訂單不受影響。

[取消] [確認暫停 Keeta 接單]

禁止：
- 你確定嗎？
- Yes / No
- OK / Cancel
作唯一訊息。

---

# 9. 空白 / 錯誤 / 過期

Empty：
**目前未有資料**

Error：
**暫時無法取得資料**

Stale：
**資料過期 · 顯示上次成功資料**

Unknown：
**結果未明 · 正在重新確認**

Offline with data：
**離線 · 顯示上次成功資料**

Offline no data：
**離線 · 未有可顯示資料**

---

# 10. Domain 狀態示例

訂單：
- 進行中
- 可取餐
- 已完成
- 已取消
- 結果未明

付款：
- 已付款
- 待付款
- 退款中
- 已退款
- 結果未明

平台：
- 接單中
- 已暫停接單
- 繁忙
- 平台異常
- 連線異常
- 未完成設定
- 結果未明

商品：
- 可售
- 暫停售罄
- 已停用
- 未到供應時間
- 結果未明

打印：
- 已確認打印
- 等待確認
- 部分完成
- 打印失敗
- 結果未明

裝置：
- 可用
- 要留意
- 資料過期
- 無法連線
- 結果未明

---

# 11. Implementation Review Checklist

每個畫面驗：

- [ ] Page Title 跟正式 Menu 名一致
- [ ] Primary CTA 係具體中文動詞
- [ ] 無 OK / Apply / Fix / More / Action / Yes
- [ ] Save / Publish / Applied 無混淆
- [ ] UNKNOWN 無顯成 FAILED
- [ ] Error 無顯成 0 / Empty
- [ ] Freshness 用最後更新 / 最後確認
- [ ] 高風險 confirm 有 object + impact
- [ ] Technical ID 唔做第一層主文字
- [ ] Admin 無退款／取消訂單／付款方式修正 execution CTA
- [ ] Domain-specific business state 清楚
- [ ] Mobile / Desktop 用同一正式名稱

MILESTONE:
MFK_ADMIN_V3_COPY_DICTIONARY_V1_READY
