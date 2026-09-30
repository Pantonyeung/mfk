# MFK｜成熟後台與快速操作工作台展示標準 V1

日期：2026-09-30  
適用：Admin V3、SMT、SMM，以及日後其他 Owner / Manager / Frontline 工作台  
狀態：研究整合稿 / 可作 Product Design Standard 候選

> 說明：本文將「Dell Store」按本次語境統一理解為 Dashboard／後台工作台／管理介面。如果日後要針對某個指定品牌產品再比較，可以另外開專項。

---

# 0. 結論先行

MFK Admin V3 現時「兩步搵到功能 + Primary Home + List → Detail → Edit + Readback / Unknown ≠ Failed」方向係正確，而且部分產品紀律比好多成熟後台更嚴謹。

但如果要由「架構正確」再進化到「成熟、高效率、長期每日用都舒服」，仲欠六件事：

1. 全局搜尋／功能搜尋
2. 已儲存檢視／常用篩選
3. 最近使用／收藏捷徑
4. 角色感知導航
5. 跨頁返回、篩選、Draft context continuity
6. 共用頁面元件與文字規則完全鎖定

因此下一步唔係再加 Menu，而係將現有 54 頁變成一套真正成熟嘅「工作系統」。

---

# 1. 下一步三個英文名詞，全部中文解釋

## 1.1 跨頁互動盤點
原名：Cross-page interaction audit

目的：
檢查「由 A 頁去 B 頁，再返轉頭」係咪自然。

要驗：
- 由訂單異常撳去某張訂單，返轉頭係咪仲保留原本 filter？
- 由產品頁去打印管理，返返產品時係咪仲係同一件產品？
- 由 Action Queue 去處理問題，完成後 Queue 係咪可以 refresh / resolve？
- 手機打開 navigation drawer 再返頁面，位置有冇亂？
- Draft 未發佈時跨頁，Draft Bar 係咪一路存在？
- Deep-link 有冇帶 Store、Order、Product、Platform 等 context？

簡單講：
**唔係驗一頁好唔好，而係驗成條工作路線順唔順。**

## 1.2 共用介面元件規格盤點
原名：Component contract audit

目的：
確保所有頁面用同一套「零件」，唔係每頁自己發明。

要鎖：
- 頁首
- 搜尋
- 篩選
- 表格
- 手機資料卡
- 狀態標籤
- Draft Bar
- 確認視窗
- Empty / Error / Stale
- Readback Panel
- Timeline
- Detail Header

每個元件要定：
- 幾時出現
- 顯示乜
- 有咩狀態
- Desktop / Mobile 點變
- Danger action 可以放邊
- Loading / Error 點表達

簡單講：
**同一類事情，全系統只准有一種主要表達方法。**

## 1.3 文字與術語一致性盤點
原名：Copy / terminology audit

目的：
將所有「工程語言」翻譯成人會用嘅語言，並確保同一件事全系統得一個叫法。

例如：
- 唔好一頁叫 Save、一頁叫 Apply、一頁叫 Confirm，如果其實都只係「儲存草稿」
- 「已發佈」唔可以用嚟代表「SMT 已套用」
- 「結果未明」唔可以另一頁寫成「失敗」
- Provider suspended / channel paused / store closed 唔可以全部叫「離線」

簡單講：
**使用者唔需要理解系統點寫，只需要理解而家發生咩事同下一步做乜。**

---

# 2. 外面成熟後台點做

今次主要參考：
- Shopify Admin
- Square Dashboard
- Lightspeed Restaurant Manager
- Stripe Dashboard

全部只取官方公開資料。

## 2.1 Shopify

成熟點：
- 全局 Sidebar 管核心業務 domain。
- 每頁都有 Search；全局 Search 可以快速搵後台資源。
- Home 唔係功能目錄，而係 Metrics + Order Tasks + Alerts + 下一步。
- Product / Orders 支援 filter、saved views、bulk actions。
- Apps / channels 可以 pin，令常用功能更快到。
- Desktop 功能最完整；Mobile 保留主要操作，但部分進階設定留 Desktop。

MFK 應吸收：
- 全局搜尋
- 已儲存檢視
- 常用／收藏捷徑
- Home 只服務今日業務同待處理
- Desktop / Mobile 功能密度可以唔完全一樣，但 IA 必須一致

MFK 唔應照抄：
- Home 推薦卡／成長建議太多，餐飲營運首頁容易被非關鍵內容污染。

## 2.2 Square

成熟點：
- Dashboard 集中報表、交易、商品、Team、設定。
- 報表同權限緊密相連。
- 高階自訂報表放 Dashboard，而唔係逼 POS frontline 做。
- Mobile Dashboard 提供主要營運數據；唔代表所有 Web 管理能力都要塞入 POS。

MFK 應吸收：
- Admin 做完整治理；SMT / SMM 做快速執行
- 報表 read-only 同 transaction action 分開
- 權限控制到 page / action

MFK 唔應照抄：
- R1 暫時唔做自由報表 Builder，避免變 BI project。

## 2.3 Lightspeed Restaurant Manager

成熟點：
- 明確將 Restaurant Manager 同 Restaurant POS 分開。
- Manager 用左側 navigation 按 domain 搵 Menu、Users、Hardware、Reports、Settings。
- Menu 管理按 Categories / Products / Modifiers / Combos 等物件拆開。
- Settings 再按 Company / Report / Print / App 等類別分。
- POS 偏向現場工作；Manager 偏向配置同監控。

MFK 應吸收：
- Admin / SMT / SMM 唔可以只係同一套頁面縮細
- 每個介面按角色同工作速度設計
- Menu / Hardware / Reports / Settings 邊界清楚

MFK 可以比佢再好：
- 唔將大量不同 domain 重新塞返一個「Settings」大桶。
- 用 Primary Home 將設定放返最符合人類心智模型嘅地方。

## 2.4 Stripe Dashboard

成熟點：
- Search 唔只搵頁面，仲可以跨 resource 搵 Customer、Payment、Payout、Product 等。
- 搜到 object 後直接進 object detail。
- 對資料量大、物件類型多嘅後台，Global Search 係極重要第二入口。

MFK 應吸收：
- 全局搜尋唔只搵 Menu 名。
- 應可以直接搵：
  - 訂單號
  - Product
  - Staff
  - Printer
  - Device
  - Platform mapping
  - Version / Release

---

# 3. MFK 現時同成熟後台相比

## 3.1 我哋已經做得更嚴謹嘅地方

### A. 最多兩步搵到功能
成熟產品好多時因功能歷史包袱會出現三、四層 navigation。

MFK 硬規則：
**大 Menu → 細 Menu → 已見到目標內容**

呢點係優勢。

### B. Primary Home
MFK 明確規定每件正式功能有唯一主要管理位置。

例如：
- Product print flag → Product
- Logical printer → Print Management
- Physical binding → SMT
- Channel business config → Platform / Channel
- Integration health → System Integration

呢點可以大幅減少「究竟要去邊度改」問題。

### C. 狀態語義
MFK 對：
- UNKNOWN
- PARTIAL
- STALE
- PENDING
- FAILED
- READBACK

分得比一般 CRUD admin 更嚴格。

尤其：
**Timeout ≠ Failed**
**Connected ≠ Ready**
**Published ≠ Applied**

呢點對餐飲現場極重要。

### D. Authority 邊界
MFK 唔容許 browser / Dashboard / SMM 自己變第二套 Order / Pricing / Sellability / Print truth。

呢個係長期穩定性優勢。

---

# 4. 我哋而家未夠成熟嘅地方

## 4.1 12 個大 Menu + 54 個入口，無全局搜尋會慢

兩步 navigation 雖然清楚，
但熟手每日使用會開始覺得「掃 Menu」慢。

必須新增：
**全局搜尋／快速前往**

例如輸入：
- 0088
- 紫米飯團
- Keeta
- 廚房打印機
- 阿明
- v2026.09.30

直接出 resource / page 結果。

## 4.2 缺已儲存檢視

成熟後台唔要求使用者每日重設 filter。

MFK 應加：
- 我的待處理
- 今日 Keeta 異常
- 未映射商品
- 未發佈商品
- 停用產品
- 有打印異常嘅訂單

但：
**Saved View 唔係新 Menu 層級。**

只係同一 List 嘅快捷 filter。

## 4.3 缺收藏／最近使用

建議：
Topbar 提供：
- 最近使用
- 已收藏
- 最近搜尋

作用：
熟手可以唔經 Menu。

但仍然保留兩步 Product Map，
唔以收藏取代正式位置。

## 4.4 大 Menu 應該做「視覺分組」，但唔增加步數

12 個大 Menu 可以保留，
但左欄應加非點擊 section label：

### 每日營運
- 今日
- 訂單管理
- 營運管理

### 商品與渠道
- 菜單管理
- 平台／渠道管理
- 打印管理

### 組織與分析
- 裝置管理
- 人員與權限
- 報表

### 治理與設定
- 發佈與版本
- 門店設定
- 系統管理

呢啲 section label **唔係第三層 navigation**，
只係減低掃描成本。

## 4.5 兩欄 Sidebar 唔應永遠固定同一寬度

Desktop 大屏：
- 大 Menu + 細 Menu 可以同時常駐。

中尺寸：
- 大 Menu 收窄
- 細 Menu 可 overlay / adaptive

Mobile：
- Drawer
- 大 Menu → 細 Menu
- 揀完即關 drawer 進 Content

否則 1024–1280px 寬度會浪費太多工作區。

## 4.6 缺跨頁 continuity

成熟工作流唔可以：
處理完一件事返轉頭就 filter 全失。

必須鎖：
- 返回保留 filter / sort / scroll
- Deep-link 帶 object context
- Draft context 唔因跨頁消失
- Mobile drawer 返回原位置
- Action Queue 處理完可返原 Queue context

## 4.7 Bulk Action 仲未有完整產品規則

成熟後台例如 Shopify 會對 Orders / Products 做大量操作。

MFK 可以做，
但要分類：

安全大量操作：
- 批量啟用／停用
- 批量重新分類
- 批量加 tag / scope（如將來有）

高風險大量操作：
- 批量改價
- 批量停售
- 批量 route / mapping

必須：
**Select → Preview Impact → Confirm → Draft / Execute → Readback**

---

# 5. MFK 應該進化成咩形態

唔係一套 UI 套晒 Admin / SMT / SMM。

應該共用同一套「工作語法」，但有三種工作面。

## 5.1 Admin：管理型後台

目的：
- 搵
- 睇
- 配置
- 審核
- 發佈
- 分析

核心形式：
**導航 → List → Detail → Edit / Workflow**

特徵：
- 資料密度較高
- Search / Filter / Saved View
- 多 object 管理
- Draft / Publish
- Audit / Readback

## 5.2 SMM：營運工作台

目的：
快速知道：
- 而家有咩問題
- 邊張單／邊個平台受影響
- 下一步做乜

核心形式：
**狀態 → 影響 → 工作項目 → 安全操作 → 確認結果**

SMM 唔應以「設定頁」為中心，
而應以：
- Action Queue
- Exceptions
- Platform
- Order
- Print
- Device
為中心。

## 5.3 SMT：現場控制台

目的：
最短時間完成現場動作。

核心形式：
**目前狀態 → 一個主要動作 → 即時確認**

例如：
打印機未綁定：

唔應顯：
- technical device ID
- route graph
- provider adapter
- config revision

應顯：
「廚房打印機未連接到現場裝置」

下一步：
**選擇打印機**

完成後：
「已連接 · 最後確認 19:42」

如未確認：
「已送出 · 等待確認」

---

# 6. 所有工作台共用「五段工作語法」

任何 Admin / SMM / SMT 工作都應該依次回答：

## 1. 我而家睇緊乜
例：
- 訂單 0088
- Keeta
- 廚房打印機
- 紫米飯團
- 今日營業日

## 2. 而家係咩狀態
例：
- 接單中
- 暫停售罄
- 等待付款確認
- 打印結果未明
- 有未發佈變更

## 3. 有咩影響
例：
- 新 Keeta 訂單暫時收唔到
- 只影響廚房製作單
- 已成立訂單唔受影響
- 3 件商品未同步

## 4. 下一步可以做乜
只突出一個最主要安全動作。

例：
- 處理映射
- 重新確認
- 查看訂單
- 恢復供應
- 檢查並發佈

## 5. 做完有冇證據
例：
- 最後確認時間
- Readback
- MATCH
- 已套用版本
- 已完成 / 結果未明

---

# 7. 文字應該點顯示

## 7.1 先講人話，技術資料後置

第一層：
「Keeta 暫時未能接單」

第二層：
「最近一次成功連線：19:41」

Detail / Diagnostics：
provider code / operation ID / transport error

唔可以倒轉。

## 7.2 狀態字眼統一

建議正式字庫：

正常類：
- 正常
- 接單中
- 可售
- 已套用
- 已確認
- 已完成

過程類：
- 處理中
- 等待確認
- 發佈中
- 同步中

注意類：
- 要留意
- 部分完成
- 資料過期
- 未完成設定

不確定：
- 結果未明
- 正在重新確認

失敗：
- 操作失敗
- 連線失敗
- 驗證失敗

禁止：
將「結果未明」改寫成「失敗」。

## 7.3 Button 一定用動詞 + 明確物件

好：
- 查看訂單
- 處理映射
- 暫停接單
- 恢復供應
- 檢查並發佈
- 重新讀取狀態

差：
- OK
- Apply
- Go
- Action
- Fix
- More

## 7.4 危險操作要講影響

唔只：
「確定？」

應該：
「暫停 Keeta 接單？」
「新訂單將暫停接收；已成立訂單不受影響。」

然後：
**確認暫停**

---

# 8. 系統點判斷「下一步做乜」

UI 唔應自己發明 AI 決策。

下一步應由：
**Current State + Permission + Contract + Risk + Evidence**
共同決定。

## 正常
顯主要工作 CTA。

## 有注意事項
顯：
- 原因
- 影響
- 安全處理 CTA

## UNKNOWN
顯：
「結果未明 · 正在重新確認」

Primary CTA：
- 重新確認
- 查看證據

禁止：
直接再執行一次高風險 command。

## STALE
保留舊資料：
「資料過期 · 上次成功 19:32」

可以：
- 重新整理
- 查看診斷

## CONFLICT
顯：
「資料已更新，請重新讀取後再修改」

禁止 overwrite。

## FAILED
要有明確 failure evidence 才顯。
並提供：
- 重試（只限安全／冪等）
- 返回
- 系統診斷

---

# 9. 點樣搵功能

正式標準應係四條路並存：

## 路 1：兩步 Product Map
大 Menu → 細 Menu

最可靠、最易學。

## 路 2：全局搜尋
輸入物件／功能。

適合熟手。

## 路 3：Contextual Deep-link
由訂單直接去打印異常；
由 Product 去售罄；
由 Version 去 Diagnostics。

適合處理實際問題。

## 路 4：收藏／最近使用
減少重複導航。

但任何快捷入口都唔可以變第二 Authority。

---

# 10. 一個成熟工作頁應該點排

## Desktop

### 第一層：位置
- Page title
- Store / scope
- freshness

### 第二層：核心狀態
- current state
- important count / value
- attention

### 第三層：主要工作
- Search / Filter
- Primary CTA
- List / Workspace

### 第四層：Detail
撳 object 先入。

### 第五層：證據／歷史
Timeline / Audit / Readback。

## Mobile

次序：
1. Page title
2. Current state / key number
3. Primary CTA
4. Main list/cards
5. Filter sheet
6. Detail
7. Advanced evidence

手機唔可以將 Desktop table 強行縮細。

---

# 11. Admin / SMM / SMT 實例

## 11.1 Admin｜產品管理

第一屏：
「產品管理」

[搜尋] [分類] [狀態] [新增產品]

紫米飯團｜$42｜飯團｜啟用  
雞胸沙律｜$48｜沙律｜啟用

撳紫米飯團：
- 基本資料
- 價格
- 選項
- 打印
- 圖片
- 可售摘要

真正停售：
捷徑去「售罄／供應」。

## 11.2 SMM｜平台異常

第一屏：
「平台／渠道」

Keeta  
接單：要留意  
連線：正常  
商品映射：3 件待處理  
最後同步：19:41

Primary CTA：
**處理 3 件映射**

唔顯：
raw API status / adapter code。

## 11.3 SMT｜打印現場

第一屏：
「廚房打印」

狀態：
「未連接現場打印機」

影響：
「新製作單暫時無法送到廚房打印」

Primary CTA：
**選擇打印機**

選完：
「已送出 · 等待確認」

Readback：
「已連接 Epson TM-T88 · 19:43」

---

# 12. 建議新增七個成熟後台能力

優先順序：

## P0
1. 全局搜尋／快速前往
2. 視覺分組 Sidebar
3. 跨頁 context preservation
4. 共用元件 Contract
5. 全系統文字字典

## P0.5
6. Saved Views
7. Recent / Favorites

呢七樣唔改 Authority，
但會將「架構正確」推到「每日真係快」。

---

# 13. 下一步正式工作

下一階段應改名做全中文：

## 第一工序：跨頁互動盤點
驗 Deep-link / Back / Filter / Draft / Mobile navigation continuity。

## 第二工序：共用介面元件規格盤點
鎖 PageHeader / List / Card / Status / Draft / Confirm / Readback。

## 第三工序：文字與術語一致性盤點
建立正式字庫、Button 規則、狀態文案。

## 第四工序：快速操作工作台標準
將同一套原則正式落到：
- SMT
- SMM

重點唔係複製 Admin，
而係共用：
**狀態 → 影響 → 下一步 → 確認證據**

---

# 14. 最終產品原則

MFK 後台／工作台應遵守：

1. 最多兩步搵到正式功能。
2. 熟手可以用搜尋直接跳。
3. 每件事只得一個 Primary Home。
4. 首頁唔係功能目錄，而係今日生意 + 待處理。
5. List 第一屏直接開始工作。
6. Detail 先顯真正 object。
7. 高風險操作先 Preview / Confirm。
8. Save / Publish / Applied 分開。
9. Unknown / Stale / Partial 不冒充 Success / Failure。
10. 普通使用者先睇 business meaning，工程 evidence 後置。
11. Mobile 重新排版，唔係 Desktop 縮細。
12. Admin / SMM / SMT 共用工作語法，但唔共用同一頁面密度。

---

# 15. 外部官方參考

1. Shopify Admin - Navigation  
   https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview

2. Shopify Home  
   https://help.shopify.com/zh-TW/manual/shopify-admin/shopify-home

3. Shopify list views / filters  
   https://help.shopify.com/en/manual/shopify-admin/productivity-tools/searching-filtering-views

4. Shopify product saved views / bulk actions  
   https://help.shopify.com/en/manual/products/searching-filtering

5. Square Dashboard reports  
   https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard

6. Square Dashboard navigation  
   https://squareup.com/us/en/square-university/getting-started/navigate-your-square-dashboard-and-locate-reports

7. Lightspeed Restaurant Manager  
   https://resto-support.lightspeedhq.com/hc/en-us/articles/115005105873-About-Restaurant-Manager

8. Lightspeed Settings  
   https://resto-support.lightspeedhq.com/hc/en-us/articles/115002244207-About-your-settings

9. Stripe Dashboard Search  
   https://docs.stripe.com/dashboard/search

---

MILESTONE:
MFK_BACKOFFICE_WORKSPACE_DISPLAY_INTERACTION_STANDARD_V1_READY
