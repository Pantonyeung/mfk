# MFK SMM 產品 Brief V1
日期：2026-09-26
狀態：CURRENT PRODUCT BRIEF
產品：磨飯流動店務（SMM）
形態：PWA / Web 前線輔助終端

## 1. 一句話定位
SMM 係畀磨飯前線店員用手機快速點單、堂食掛枱／輪候、查看待處理與訂單狀態嘅流動店務工具；SMM 負責收集可信操作意圖同展示門店投影，正式交易仍由 SMT / Store Kernel 建立及裁決。

## 2. 產品角色
SMM = TRUSTED STAFF ASSISTIVE TERMINAL。

SMM 要做到：
- 手機上快速瀏覽餐單、選商品、客製、建立購物草稿。
- 支援外賣／堂食情境。
- 將同一個穩定 submission identity 安全送入 SMT。
- 睇到正式訂單、待處理、渠道、堂食、打印／設備等門店投影。
- 網絡異常或結果未明時保留草稿／Pending Intent，先 readback，禁止盲目重送。

SMM 唔係：
- 第二部 POS 核心。
- 第二 Order / Pricing / Payment / Print Engine。
- Formal Order writer。
- Display Number allocator。
- Store Kernel authority。
- Admin 設定中心。
- Keeta / Provider authority。

## 3. 主要用戶
- 前線店員
- 外場／流動點單員
- 店內需要離開主 SMT 操作嘅員工

主要裝置：
- iPhone / Safari 為首要使用情境
- 其他現代手機瀏覽器可作兼容入口
- 不以 APK 作產品前提

## 4. 核心產品目標
1. 減少店員來回主收銀機先可以落單。
2. 手機上用最少步驟完成商品配置同購物草稿。
3. 保證 SMM 唔會因重複點擊、Timeout、斷線而製造重單。
4. 堂食單可清楚指定正式餐枱或輪候。
5. SMM 所見餐單、價格、枱號、訂單狀態跟隨同一套 MFK canonical truth。
6. 即使 SMM 或網絡有問題，SMT 本地交易仍然可以正常運作。

## 5. 主要資訊架構
### A. 點單
- 分類
- 商品
- 搜尋
- 零結果回退
- Variation
- Modifier / Option
- Combo 配置
- Required / Min / Max 驗證
- 商品售罄／不可選狀態
- 加入購物草稿

### B. 購物草稿 / Checkout
- 數量修改
- 刪除／修復單一商品
- 外賣／堂食切換
- 付款方式記錄
- 已發布價格預覽
- 餐單 revision
- 穩定 submissionId / idempotencyKey
- 提交後 PENDING / UNKNOWN / CONFIRMED / REJECTED
- UNKNOWN 必須 readback-first，禁止 blind resend

### C. 待處理
- 前線工作佇列
- 延誤／ETA
- Action Required
- 例外／Pending Action
- 只顯示真正需要店員留意嘅事情

### D. 訂單
- 進行中 / 歷史
- 搜尋
- 來源篩選
- Display Code
- Source
- Lifecycle
- 金額摘要
- Readback 狀態
- Timeline

### E. 堂食
- 使用 Admin 已發布餐枱資料
- 揀餐枱或輪候
- 人數
- 堂食 Session 投影
- 已停用但仍佔用嘅餐枱要保留可見，直至真正清枱

### F. 更多
- 員工帳戶
- 連線狀態
- Channel Health
- Business Day（只作記錄／投影）
- Print / Device Health
- Diagnostics
- Sellability
- Capacity
- Reporting
- Refund Request 等營運投影

## 6. 核心交易流程
Admin 發布餐單／枱號／規則
→ SMT 接收並保存本地可用版本
→ SMM 讀取門店 snapshot
→ 店員揀商品／客製
→ SMM 建立 LOCAL_NON_AUTHORITATIVE 購物草稿
→ SMM 帶 menu revision + published price facts + stable submission identity 提交
→ SMT 重新驗證
→ SMT / Store Kernel 只建立一次 Formal Order
→ SMM 讀回 CONFIRMED / REJECTED / UNKNOWN
→ SMM 更新 UI

核心原則：
SMM 可以準備交易，但唔可以自己成為正式交易真相。

## 7. 堂食流程
店員切換「堂食」
→ 必須揀 Admin 已發布餐枱，或者加入輪候
→ SMM 保存 dining target
→ 提交同一個 staff order intent
→ SMT 沿現有 Dining authority 處理
→ SMM 只顯示 SMT 投影後嘅堂食狀態

禁止：
- 自由文字自創餐枱 identity
- SMM 自己維護第二份枱號 authority
- 堂食 hold 混入一般正式訂單列表而失去語義

## 8. 價格與 Cart 邊界
SMM 可以用已發布餐單資料做即時顯示及購物草稿重算，但正式價格仍由 SMT 驗證。

當餐單 revision、商品價格、Option adjustment 或售罄狀態改變：
- SMM 要更新草稿顯示
- 有問題嘅 line 要局部提示修復
- 提交時 SMT 必須再次驗證
- 價格／revision 不一致要 REJECT + refresh
- 禁止 SMM 靜默建立第二 Pricing Engine

## 9. 防重單與 Recovery
必須保留：
- stable submissionId
- stable idempotencyKey
- rapid multi-tap lock
- Pending Intent 本機持久化
- browser refresh 後仍可恢復草稿／未確認提交
- UNKNOWN = 結果未明，不等於失敗
- UNKNOWN 先 readSubmission
- 未確認前禁止建立新 submission 盲目重送

本機 localStorage 只可以保存：
- Cart 草稿
- Pending Intent
- UI preferences
- 員工可信 session / LAN 配對資料

全部屬 LOCAL_NON_AUTHORITATIVE，唔可變成正式 Order truth。

## 10. 連線模型
SMM 支援門店 runtime port，UI 唔直接擁有 transaction networking。

可存在：
- INTERNET path
- LAN path

LAN 只係加速／局域網能力，唔應成為唯一落單前提。
連線狀態必須清楚區分：
NOT_CONNECTED / LOADING / READY / STALE / PARTIAL / UNKNOWN / ERROR。

網絡恢復後先 fresh read / readback，唔可以因重新連線就假設所有 pending 已成功。

## 11. 員工身份
Internet 員工落單要有可信員工 session。
產品層要求：
- 員工身份清楚
- PIN 驗證
- session 可延續
- 臨時網絡失敗唔應即時清掉最後可信 session
- 正式提交帶 staff provenance

SMM 唔可以用共用匿名身份建立正式員工操作。

## 12. Current Main 已確認能力
- 五大主頁：點單 / 待處理 / 訂單 / 堂食 / 更多
- Traditional Chinese 手機 UI
- Menu / Category / Search
- Variation / Modifier / Combo shape
- Required / Min / Max 驗證
- Cart persistence
- Published menu revision / price facts
- 外賣 / 堂食
- Cash / Alipay / WeChat / FPS / PayMe 記錄選擇
- Stable submission identity
- Submit multi-tap protection
- UNKNOWN / readback-first
- 正式落單 intent 已接 SMT
- SMM / Customer / SMT 共享 read model 已建立
- Admin published dining table projection
- Order / Dining / Channel / Print / Capacity / Reporting 等 read projection
- iPhone / Web 產品方向

## 13. 未應視為 SMM 自有權限嘅能力
以下即使 UI 有入口／contract，都唔代表 SMM 擁有 authority：
- 完成／交收
- Cancel
- Refund
- Sellability mutation
- Reprint / Print
- 開枱／關枱 mutation
- Pricing
- Payment execution

所有呢類 mutation 必須：
SMM request
→ canonical owner
→ authoritative result
→ readback
→ UI projection。

## 14. 產品體驗原則
- 一次只突出一個主要任務。
- 手機版唔係縮細桌面 POS。
- Cart 唔應長期遮住商品。
- 主要操作單手可完成。
- 唔顯 raw UUID / 工程碼。
- 錯誤要講「發生咩、下一步做咩」。
- PENDING / UNKNOWN / PARTIAL / STALE 必須有獨立語義。
- 唔可以用「成功」掩蓋未有 canonical readback。
- UI redesign 不得重建 business rule。

## 15. 成功標準
SMM 成功唔係「功能最多」，而係：
- 店員可以快過走返 SMT 完成點單。
- 同一單只正式建立一次。
- 餐單／價格／枱號唔會同 SMT 漂移。
- 斷線／Timeout／refresh 後可以安全恢復。
- 店員知道目前係已提交、未確認、已拒絕定已完成。
- SMM 壞咗唔會拖死 SMT 本地交易。
- 所有正式交易最後都可以由 SMT / Store Kernel readback 證明。

## 16. Current Product Boundary
Current canonical baseline 已將 Admin / SMT / SMM / Customer / Keeta 五個 port 鎖為 E2E 完整基線；SMM 係其中一個前線流動入口，而唔係獨立交易核心。

產品 Brief 後續所有 UI / Frontend / Backend / Acceptance 工作，都應以呢個邊界為準：
「SMM 收集前線意圖 + 顯示 canonical projection；SMT / Store Kernel 保留正式交易 authority。」
