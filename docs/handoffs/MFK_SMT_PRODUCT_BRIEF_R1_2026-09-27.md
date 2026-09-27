# MFK SMT｜產品 Brief R1
日期：2026-09-27
狀態：DRAFT FOR OWNER REVIEW
Repo 基準：Pantonyeung/mfk main @ ee317a63ce392d54ad8818b3f57ef7bd73c4864c

## 1. 文件定位
本 Brief 將三份 SMT 文件同 current MFK SMT 實作收斂成一份「產品應該係乜、主要流程係乜、邊界係乜、目前做到邊」嘅接手文件。

來源優先次序：
1. Owner_SMT_Requirements_Working_V2.5：最新明確 Owner 決定作增量優先。
2. Owner_對_SMT_端口要求_FINAL_V1.0：已封版產品基線；未被 V2.5 更新嘅要求沿用。
3. SMT 優化 UI：用作 UX rationale、操作 mindset、驗收歷史。
4. Pantonyeung/mfk current main：只代表「目前實作真相」，唔反過來改寫產品要求。

## 2. 一句話產品定義
SMT 係磨飯門店嘅本地優先前線 POS／營運執行終端：店員由登入、開更、接單、點單、堂食、結帳、付款、打印、出餐、售後，到日結都喺同一操作面完成；Cloud、Admin、Owner 或 Provider 故障唔可以拖死本地交易。

## 3. 主要使用者
主要使用者：已獲授權登入 SMT 嘅前線員工／收銀／店內操作人員。

本輪產品要求唔另設 Manager-only Gate；安全由交易邊界、idempotency、revision、readback、audit 同 fail-closed 保護，而唔係靠 UI 隱藏。

## 4. 核心產品目標
- 快：高頻操作少一步，固定手指位置，減少視線跳動。
- 清楚：下一個最合理動作要明顯，但唔用 Wizard 強迫流程。
- 本地可運作：WAN／Cloud 出問題，現場點單、Checkout、本地付款記錄、正式交易、堂食、打印仍然可行。
- 同一真相：Order、Pricing、Payment、Print 各自只得一套正式 authority。
- 可恢復：UNKNOWN、stale、printer failure、restart 唔可以靠猜；先 readback，再決定安全下一步。
- 人可 Override：系統只做 contextual default，店員永遠可以合理改選。

## 5. 產品資訊架構
高頻第一層只應有：
1. 點單
2. 訂單
3. 堂食
4. 售罄／產能

低頻能力由上方漢堡進「更多／工具中心」：
- 收銀與日結
- 報表分析
- 打印與設備
- 檢查／診斷
- Backup／Restore
- Admin Sync

## 6. 核心 Journey

### A. 開始營業
員工登入 → 必要開更現金確認 → 直接進點單工作台。
重點：開更資料用於 Cash／Reporting；唔應演變成 Cloud gate 阻塞現場交易。

### B. 點單
點單頁同時承載：
- 自家客戶端「待處理訂單」
- Keeta 訂單
- Category
- Product Grid
- Quick／Normal mode
- 購物車
- 快速組合／必選／紫米套餐

Quick mode：
有 Required 嘅產品可以先入 Cart，但正式 Checkout 前所有 Required 必須完成。

產品修改：
從 Cart 打開現有商品，更新 SAME Cart Line；唔可以默認新增第二件。

### C. 暫存／堂食
Cart 底部用同一入口「暫存／堂食」。

預設：
- Cart 有任何堂食 Line → 先開堂食
- 全部外賣 → 先開暫存

但店員可以隨時切換，系統唔替人做死決定。

### D. Checkout／付款
Checkout 固定次序：
1. 來源／渠道
2. 付款方式／來源資料
3. 金額結算
4. 現金輸入／組合付款
5. Final Review／付款確認

正式交易邊界：
只有最後「付款確認」先可以正式 Commit。
返回、轉 Payment Method、重新打開 Checkout，都唔可以提前成交。

付款成功後：
Completion Review 只係結果確認／離開，唔可以再建立第二次交易。

### E. 訂單營運
訂單工作台分三 Lane：
- 現場／直接來源
- 自家平台
- 第三方平台

核心狀態：
未完成 → 可取餐 → 已取餐

「可取餐」可以退返「未完成」，但全程保持 SAME Order。

正式訂單後支援：
- 修改
- Payment Method Correction
- Full／Partial Refund
- Cancel
- Reprint

Payment Correction：
SAME Order；舊 Tender 保留 Audit，新 Tender 變 current effective tender；唔重做成交、唔重送廚房、唔自動重印、唔自動開櫃。

Refund：
原 Order 永久保留；另建 linked refund／adjustment record。

### F. 客戶端待處理／付款證據
目前冇 Payment API 時：
付款截圖只係 Evidence，唔係 Payment Truth。

店員人工核對日期、時間、金額、清晰度。
有問題可用訂單對應 WhatsApp QR + 預設訊息要求客戶補資料。

只有核對完成並正式接受，先進正式 Order／Print／Production 流程。

### G. Keeta
Keeta 同自家客戶端來源身份分開。

手動模式：
即刻處理／稍後處理。
稍後處理最多 2 次；唔等於 Reject／Cancel。

自動模式：
只有 mapping／售罄／內容等守門通過先正式入單。

Provider 出錯只影響 provider domain；SMT 本地交易必須繼續。

### H. 堂食
版面：
- 左：輪候
- 中：3×3 桌台，1–8 號枱 + 戶外桌
- 右：選中桌台詳情

能力：
- 有位直接入座
- 無位先輪候
- 輪候可先正式落單／出製作
- SAME Order 由輪候移入桌台
- 加單
- 轉枱／併枱／拆枱
- 按商品分項付款
- 真正付款統一回同一 Checkout
- 全數付款後釋枱
- 堂食相關打印／重印

### I. 售罄／產能
售罄頁支援：
- Category
- Search
- 售罄／暫停 Filter
- 多選售罄／恢復
- 紫米快捷售罄／恢復

Capacity Pool：
- 初始數量
- 綁定商品
- 每件消耗量
- 渠道停止門檻
- 正式可執行訂單先扣
- 正式取消只回補一次
- Business Day 開始時 Reset
- 人工調整保留 Audit
- Pool = 0 仍可由有權 SMT 員工做有限 Override

## 7. UX 原則
- 日系極簡、專業餐飲 POS。
- 藍色為主；紅色只用 destructive／error／真正 warning。
- 主要 Modal 約 75%，內容區滾動，底部主 Action 固定。
- Checkout Keypad／Modal Action／Rail 盡量固定位置。
- 大按鈕只畀高頻動作；清除等 destructive action 降低視覺權重。
- Silent Guided Flow：用 focus 提示下一個最合理位置，唔出「下一步／上一步」Wizard。
- 技術 UUID／工程碼唔進正常前線 UI。

## 8. Authority／產品邊界
Admin：
- Product／Option／Combo／Price／Sellability／Logical Printer／Template 等設定作者
- Publish config

SMT：
- 本地執行
- Formal Order／Checkout／Payment execution
- Physical printer binding
- 本地打印／堂食／Fulfillment／Cash／Day Close

Customer／Keeta：
- Order Source／Evidence／Provider Translation
- 唔係第二 Formal Order Writer

硬規則：
禁止第二 Order Engine、Pricing Engine、Payment Engine、Print Engine。
UI 只可以投影正式資料，唔可以為方便而自己計第二套價錢或狀態。

## 9. 失敗與恢復
以下狀態必須分開：
SUCCESS／KNOWN FAILURE／UNKNOWN。

特別係 Payment、Print、Provider side-effect：
Timeout／ACK loss 唔可以直接當 FAILED 再 blind retry。

先做 authoritative readback／reconcile，再決定 retry、人工處理或保持 Attention。

## 10. P0 驗收底線
- 最終付款確認只成功一次。
- Double Tap 不可重複 Order／Payment／首次 Print／Production。
- Restart 後正式交易、暫存、待打印資料唔可以無故消失。
- Required 未完成唔可以正式進 Checkout。
- Payment Correction 不可 double-count。
- Refund 不可刪原 Order。
- Print UNKNOWN 不可 blind resend。
- Cloud／Admin／Owner／Provider failure 不得阻塞本地交易。
- 同一 Order 修正、退款、堂食移動都保留 identity 同歷史。

## 11. Current MFK Repo Reality
基準：main @ ee317a63ce392d54ad8818b3f57ef7bd73c4864c

current SMT 位於 v2local/**，已見實作包括：
- StaffAuthGate／CashOpeningGate
- OrderingWorkspace
- Required／Combo／Riceball Pairing／Hold-Dining
- Customer Pending Review／付款 Evidence／WhatsApp QR
- Keeta Pending／Defer
- CheckoutWorkspace／Dining Checkout Recovery
- RuntimeOrdersWorkspace
- RuntimeDiningWorkspace
- RuntimeSoldoutWorkspace／Capacity Pool
- LocalMoreWorkspace
- Day Close／Reporting
- Logical Printer → Physical IP/Port binding
- Print Trace／Diagnostics
- Customer Cloud Bridge diagnostic
- Keeta／Customer／SMM／Admin 對應 runtime seam

所以 current repo 已經明顯超過 2026-09-25 UI 優化文件當時寫嘅「PARTIAL missing list」；唔應再按舊清單由零重做。

## 12. 已確認嘅產品對齊缺口
以下係「產品 Brief vs current main」已直接見到嘅差距，先修 seam，唔重寫 SMT：

1. 導航
Target：第一層只保留 4 個高頻入口，「更多」去上方漢堡。
Current：App.tsx 仍然將「更多」放左側第五個 nav。

2. 學生優惠
Target：按店員確認學生人數，合資格特飲半價；手動或自動揀最多 N 杯，自動優先最貴。
Current：CheckoutWorkspace「學生優惠」按鈕仍 disabled。

3. 現金快捷鍵
Target：$20／$50／$100／$200／$500／剛剛好。
Current：CheckoutWorkspace 現見「剛好 + $50／$100／$200／$500」，缺 $20。

4. 售罄／產能可見語義
Target：高頻入口叫「售罄／產能」。
Current：nav 顯示「售罄」，雖然頁內已有 Capacity Pool。
屬 IA／discoverability 差距，唔係缺 Capacity Engine。

## 13. 下一步建議
P1｜先做 4 個 exact alignment fix
只修導航、學生優惠接線、$20 快捷鍵、售罄／產能入口語義；每項一條 contract test。

P2｜再做 current repo 全流程驗收
登入／開更 → 點單 → Required／Combo → Checkout → Commit → Print → Orders → Dining → Soldout／Capacity → Day Close。

P3｜最後做真機 Acceptance
實體 Printer、LAN loss、WAN loss、App kill／restart、power interruption、duplicate／UNKNOWN recovery。

原則：
唔重做已存在 Core；只修最細 seam，RED → GREEN → bank。

## 14. Brief Definition of Done
- Owner 產品行為：已完整定義，無 Blocking Product Decision。
- Product Brief：本 R1 已收斂完成，等待 Owner Review。
- Implementation：current repo 已有大量實作；仍需做上述 exact alignment + E2E／physical acceptance。
- Owner 一旦確認本 Brief，可作 SMT 下一輪 UI／Acceptance／開發拆刀嘅單一產品摘要入口。
