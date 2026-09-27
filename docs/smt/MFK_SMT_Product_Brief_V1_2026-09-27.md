# MFK SMT Product Brief V1

版本：V1  
日期：2026-09-27  
狀態：REPO-DERIVED PRODUCT BRIEF  
產品：MFK SMT｜店舖主前線 POS  
Repo：Pantonyeung/mfk  
基準 main：c2d5b016fe3dd08d276e915ae0f0fb2301e964cf  
控制：GitHub #22 最新控制記錄

## 1. 產品一句話

SMT 係磨飯店內唯一正式前線交易終端：以 Local-First 方式完成點單、客製、結帳、正式落單、付款、履約、打印、堂食、售罄與現場恢復；即使 Cloud、Admin、Owner、Provider 或外部渠道異常，店內核心交易仍必須可以安全繼續。

## 2. 產品目的

SMT 唔係一般收銀畫面，核心價值有五個：

1. 快：高頻操作固定位置，少跳頁，少等待，形成肌肉記憶。
2. 穩：本機交易優先，網絡斷線唔可以令店舖停收銀。
3. 準：一張正式 Order 只由同一 Store Kernel / Pricing / Payment / Print authority 處理。
4. 清楚：訂單、付款、履約、打印、渠道、錯誤各自有真實狀態，唔用一粒總狀態掩蓋問題。
5. 可救：任何 UNKNOWN / 部分失敗都要有 Readback、Reconcile、人工安全操作，而唔係盲目重試。

## 3. 主要使用者

### 前線店員
- 快速點單
- 客製商品
- 暫存／堂食
- 收款
- 查單
- 標記可取餐／已取餐
- 售罄／恢復
- 處理打印與一般異常

### 店長／有權限員工
- Payment Correction
- Refund / Cancel
- 價格例外或敏感操作（只限已批准權限）
- 日結、現金、打印設備、診斷
- 需要 Audit / reason / readback 的操作

## 4. SMT 在 MFK 的產品角色

SMT = LOCAL POS + FRONTLINE EXECUTION + LOCAL TRANSACTION AUTHORITY。

SMT 擁有／執行：
- 本地點單
- Cart / Checkout
- Payment execution
- Formal Order
- Fulfillment
- Local Print / Hardware
- Offline local execution
- 現場操作 Readback

SMT 不建立第二套：
- Order Engine
- Pricing Engine
- Payment Engine
- Print Engine
- Store Kernel
- Auth Engine
- Sync Engine

Admin 只 Author / Configure / Publish；SMM、Customer、Keeta 只係 Order Source／Edge；Owner 只 Watch / Alert / Review / Bounded Act。正式交易最後仍收斂到 SMT。

## 5. 核心產品原則

### Local-First
Admin / Cloud / Owner / Provider / Reporting / Diagnostics 失效，不得阻：
- Order
- Checkout
- Payment
- Local Commit

### 單一權威
UI 只做 Projection。
價格、Order、Payment、Print、Fulfillment 不得在 UI 或外部 Port 重算第二套。

### UNKNOWN 是正式狀態
付款、打印、平台 callback、外部 side-effect timeout：
UNKNOWN ≠ FAILED。
第一步永遠係 readback / reconcile。

### 不破壞歷史
Refund、Payment Correction、Reprint、Cancel、Reopen 都係新操作／linked record。
唔可以改寫舊交易歷史。

## 6. 主導航與工作區

產品目標高頻區：
- 點單
- 訂單
- 堂食
- 售罄／產能

低頻工具收入口：
- 更多

current main 仍可見「點餐／訂單／堂食／售罄／更多」五入口；最終視覺收斂只可以改 IA / presentation，不得改交易 Authority。

## 7. 點單 Golden Flow

員工登入
→ Cash Opening（如政策要求）
→ 選堂食／外賣
→ 分類／商品
→ Required / Modifier / Combo
→ Cart
→ Checkout
→ Tender
→ 第一次付款確認
→ Atomic Formal Commit
→ Completion Review
→ Print Admission
→ 各票種獨立打印
→ Fulfillment
→ 可取餐
→ 已取餐

重要邊界：
- Checkout 前唔可以偷建 Formal Order。
- 第一次付款確認先係正式 Commit 邊界。
- Done 只係離開 Completion Review，唔可以再建第二張 Order。
- Ready ≠ Completed。
- Print fail 唔可以改 Order truth。

## 8. 點單工作區

### 商品區
- 1920×1080 固定操作畫布
- 水平分類
- 高密度產品格
- Product image / name / price / sellability
- Quick / Normal 模式
- Quick Drink
- Required Fast Lane
- Combo / 飯團配對流程
- Silent Guided Flow 只做提示，不可自動 Commit

### Cart
- 每個 cart unit 有獨立 identity
- Combine 預設 OFF
- Edit = 修改 SAME line，唔係再 Add 一條
- Qty / Remove / Free note / Option / Combo
- Price / config stale 只標 affected line
- 不清空無關商品

### 暫存／堂食入口
- 同一主要入口
- 根據 Cart context 建議第一頁
- 員工可以 override
- Table 必須讀 Admin-published table registry，禁止前端自造第二張枱表

## 9. Checkout / Money

Checkout 幾何固定：
1. 來源／訂單資訊
2. 付款資訊
3. 固定數字鍵盤／確認區

核心要求：
- 快速現金
- Exact amount
- 找續清楚
- Payment certainty 清楚
- Completion Review 唔跳位

### Payment Correction
- SAME Order
- 保留原付款方式歷史
- 更新 current effective tender
- 零新 Order
- 零新 Display Number
- 零自動 Reprint
- 零自動 Drawer Action

### Refund
- Full / Partial
- linked original Order
- Cash refund 才產生對應 Cash Movement
- 原交易不可刪除
- Cancel + Refund 不可 double deduction

## 10. 訂單工作區

Order Workspace 以「現場／自家平台／第三方平台」來源分流。

每張卡最少顯示：
- Display Number
- Source
- Time / elapsed
- Items summary
- Payment summary
- Fulfillment
- Exception badge

禁止前線顯示 raw UUID。

Customer / Keeta 新單：
- 全 SMT 畫面都應有明顯提示
- 聲音 + 視覺
- 來源先於付款資訊
- 新單不能因員工身處其他頁面而無聲消失

## 11. Fulfillment

同一正式 Order：
未完成
→ 可取餐
→ 已取餐

並支援安全退回未完成（按現行 contract）。

ETA 只可以在正式 Accepted 後有承諾語義。
外部平台 callback 與本地 Fulfillment 分開，callback failure 不得改寫本地真相。

## 12. 堂食

堂食唔係第二 POS engine，而係同一 Store Kernel 的另一個 service context。

核心能力：
- Waiting
- Table
- 正式 Order Link
- 加單
- Partial / Full settlement
- 首次 production admission
- 首次打印
- 付款後 receipt
- Cash-only drawer boundary
- Table transfer
- Cancel / history protection
- Reload / restart recovery

堂食新能力必須逐條證明 identity、revision、restart、打印及 payment safety。

## 13. 售罄／產能

Availability ≠ Inventory ≠ Visibility。

SMT 要支援：
- Product sold-out / restore
- Option / Modifier availability
- Combo child availability
- 暫停
- Channel-specific sellability
- Capacity Pool / channel threshold 顯示與操作（只有已批准 seam 才可真正 mutation）

Inventory quantity 只作統計／提示，不可自動成為交易阻斷 authority。

後續售罄不得修改已成立 Order。

## 14. 打印與設備

Admin 定義：
- Logical Printer
- Template
- Route
- Product print rules

SMT 負責：
- Logical Printer → Physical IP / USB / Device binding
- 真機連線
- Test Print
- Print Job execution
- Retry / Reprint / Diagnostics

主要票種：
- 顧客小票
- 製作單
- 打包單
- 產品標籤
- 袋標籤

每條 route 必須獨立 Job。
一條 Printer 慢／失敗，不可以拖死其他 route。
Reprint = 新 PrintJob + 原 Job 關聯 + reason。
UNKNOWN 不可 blind reprint。

## 15. 更多／工具中心

低頻營運能力集中：
- 收銀與日結
- 報表
- 打印與設備
- 備份與恢復
- Diagnostics
- Admin 同步／LKG 狀態

呢啲工具唔可以反過來成為交易 gate。

## 16. Offline / Recovery

WAN Down：
- 本地點單繼續
- 本地 Checkout / Payment / Commit 繼續
- LAN printer 可達就照打印
- Cloud / Provider export 延後

App kill / restart：
- 已 commit truth 不可消失
- pending queue / operation identity 要可恢復
- reconnect 先 snapshot / readback，再 replay
- 未 reconcile 完不可假裝全綠

## 17. Diagnostics

SMT 診斷要答到：
- LAST_GREEN
- FIRST_BREAK
- Failure Code
- Expected / Actual
- Layer
- Timing
- Source identity
- Recovery / Readback result

禁止只顯：
「失敗」
「背景同步中」
「總綠燈」

前線只見人類可理解操作；工程細節放 Diagnostics。

## 18. 視覺與互動

最新方向：Soft Glass Operational。

可以用：
- 柔和環境漸變
- 浮層卡片
- Capsule controls
- Soft elevation
- 局部深色 Attention surface

但：
- Money
- Status
- Checkout
- Sold-out
- Error

必須靠固定文字／狀態／語義顏色表達，唔可以靠裝飾效果代表 transaction truth。

SMT 仍以：
高密度、固定位置、快速、清楚、專業餐飲 POS
為第一優先；唔做 mobile-first 低資訊密度版。

## 19. 性能與可靠性目標

- 1920×1080 為主操作基準
- 首開目標 < 1 秒
- 前線 tap 必須即時有 feedback
- Keeta / 外部新單目標 2–3 秒可見
- 新單置頂／清楚提示
- weak network 唔阻本地交易
- duplicate / stale / same-intent replay 不可建立第二張正式 Order
- raw UUID 不出前線

## 20. 明確不做

- 第二 Order / Pricing / Payment / Print / Store Kernel
- Cloud-only POS
- UI 自己算價
- Inventory 0 自動封單
- global order_status 包晒所有 domain
- UNKNOWN 當 FAILED 然後 blind retry
- 前線顯示工程 UUID
- Owner / Admin / SMM / Customer / Keeta 直接繞過 SMT 建 Formal Order
- 為視覺重寫 transaction truth
- 因 Reporting / Business Day / Diagnostics 壞而停止收銀

## 21. 產品完成標準

SMT 必須可以在真實店舖完成：

登入
→ 點單
→ Required / Combo
→ Cart
→ Checkout
→ Payment
→ Formal Commit
→ 多 route Print
→ Fulfillment
→ Ready
→ Complete

同時證明：
- duplicate 不重單
- stale write 不靜默覆蓋
- Payment UNKNOWN 不 double charge
- Print partial fail 不拖死其他票
- app restart / reboot 可恢復
- WAN Down 本地交易可繼續
- SMM / Customer / Keeta 最終都只進 ONE canonical intake
- Admin config 只 Publish；交易時 SMT 唔返 Admin 問准
- 所有 reverse / correction 有 Audit + Readback
- 真 printer / LAN / device 要有 Physical Evidence

## 22. Brief 邊界

本 Brief 係產品定義，唔取代 #22、航海圖、current main 或逐項 Acceptance。
工程狀態、FIRST BREAK、可唔可以落地，永遠以當刻 fresh-read repo + control record 為準。

## 產品狀態

MFK_SMT_PRODUCT_BRIEF_V1_GENERATED_FROM_CURRENT_REPO
