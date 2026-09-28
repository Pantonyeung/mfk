# MFK SMT Product Brief V1

版本：V1  
日期：2026-09-27  
狀態：DRAFT / OWNER REVIEW  
Repo：Pantonyeung/mfk  
基準 main：bac52c2de64f0061c04faf2fe8d0084d1c40c8aa  
控制：#22

## 0. 文件定位

呢份文件係由「目前 mfk main 真實程式」反推產品定義，目的係畀產品、UI、前端、後端、驗收可以用同一個 SMT 定義工作。

佢唔取代交易 Authority、唔改 Order / Pricing / Payment / Print / Store Kernel 語義，亦唔因舊研究文件同目前 main 有差異而倒退現行產品。

主要讀取：
- v2local/src/App.tsx
- v2local/src/features/ordering/**
- v2local/src/features/checkout/**
- v2local/src/presentation/RuntimeOrdersWorkspace.tsx
- v2local/src/presentation/RuntimeDiningWorkspace.tsx
- v2local/src/presentation/RuntimeSoldoutWorkspace.tsx
- v2local/src/presentation/LocalMoreWorkspace.tsx
- v2local/src/presentation/StaffAuthGate.tsx
- v2local/src/runtime/local-runtime.ts
- docs/handoff/MoreFunOS_SMT_Visual_Product_Spec_Figma_R2_2026-09-26.md
- #22 最新控制紀錄

## 1. 產品一句話

SMT 係磨飯店內唯一正式前線交易終端：

用一個 1920×1080、固定肌肉記憶、本地優先嘅餐飲工作台，令員工可以由點餐、客製、結帳、正式成交、打印、接單、堂食、售罄到營運恢復一路完成；即使 Cloud、Owner、外部平台或網絡部分失效，本機正常交易仍然可以繼續。

## 2. SMT 真正定位

SMT 係：
- 店內主 POS
- Local Transaction Execution Surface
- Formal Order 落地入口
- Payment 執行面
- Print / Hardware 執行面
- Fulfillment 前線工作台
- 外部／自家訂單進店後嘅最終本地驗證與操作面
- 本地弱網／離線持續營運核心

SMT 唔係：
- 第二 Admin
- 第二 Owner App
- Cloud Dashboard
- 第二 Order Engine
- 第二 Pricing Engine
- 第二 Payment Engine
- 第二 Print Engine
- 第二 Store Kernel
- Inventory ERP
- Provider-owned transaction truth

## 3. 主要使用者

### 前線員工
最高頻使用者。工作重點：
- 快速點單
- 補齊 Required / Combo / Option
- 結帳收款
- 接收與處理新單
- 標記可取餐
- 堂食輪候／掛枱／加單／結帳
- 售罄／恢復
- 例外恢復

### 經理／有權限員工
處理：
- 付款方式修正
- 退款
- 取消
- 人工成交價
- 重印
- 產能修正
- 日結
- 診斷與恢復

### 老闆／工程支援
主要經 Owner / Admin / Diagnostics 觀察或治理；唔應將 SMT 變成老闆後台。

## 4. 產品核心原則

1. 本地交易優先  
正常門店交易唔應依賴 Cloud round-trip。

2. 單一 Authority  
每個 business fact 只可以有一個正式 writer。

3. Admin 配置，SMT 執行  
Menu、Product、Option、Combo、Price、Table、Printer Logical Rule 由 Admin 發布；SMT 使用已發布版本／LKG 執行，交易時唔返 Admin 問准。

4. 外部來源只送 Intent / Provider Evidence  
SMM、Customer、Keeta 進入 SMT 後，仍要按 SMT 當刻 Menu / Pricing / Sellability / Permission 重新驗證。

5. UNKNOWN 係正式狀態  
Payment、Print、Provider side-effect timeout 後，UNKNOWN 唔等於 FAILED，亦唔等於 SUCCESS；先 Readback / Reconcile，再決定 Retry。

6. Reverse 唔刪歷史  
付款修正、退款、取消、重印、堂食更正都保留原紀錄，再建立 linked correction / event。

7. UI 只顯示可證明真相  
唔可以靠一粒假綠燈、背景同步中、或者 raw engineering code 代替狀態。

## 5. 主導航

目前產品主導航：

點餐｜訂單｜堂食｜售罄｜更多

「售罄」頁同時承載產能狀態；「更多」承載低頻營運工具。

## 6. 點餐工作台

目標：員工最少思考、最少切頁完成一張合法 Cart。

必須包含：
- 待處理訂單 Strip
- Keeta／第三方新單 Strip
- 橫向分類
- Product Grid
- 快速／普通點選模式
- 商品圖片、名稱、價格、停售狀態
- Required / Optional / Single / Multi Select
- Combo / Pool / Child Item
- 飲品補選
- Required Fast Lane
- 飯團配對／套餐工作區
- Free Note
- Qty
- 同一 Cart Line 修改
- 每件商品獨立 identity
- Combine 預設關閉，只係檢視／操作輔助，唔改交易 identity
- 全單外賣／堂食
- Line-level 外賣／堂食
- 原單／整理
- 暫存／堂食
- 右側常駐 Cart + Total + 結帳

規則：
- Required 未完成唔可以結帳。
- 顯示價可用已發布 snapshot 即時回應，但正式提交前由同一 Pricing authority 再驗證。
- 被動 Menu revision 如果令價錢／配置有重大改變，必須標示受影響 line，唔可以靜默接受。
- 售罄／Option／Combo 失效只修問題 line，唔清空全張 Cart。

## 7. 結帳與正式成交

結帳工作區要固定幾何，避免付款高峰時按鈕走位。

核心順序：
1. 核對餐點
2. 選擇來源／必要來源資料
3. 選付款方式
4. 金額結算
5. 現金輸入／找續或非現金確認
6. 備註
7. 確認結帳
8. Formal Commit + Readback
9. Completion Review

支援：
- Cash
- FPS／轉數快
- PayMe
- Alipay
- WeChat Pay
- Combo / Split Tender

交易原則：
- 一次正式確認只可以形成一次 Formal Order。
- Rapid multi-tap / retry 不可重覆成交。
- Formal Order、Display Number、Payment、Fulfillment、Print Admission 必須沿既有 Store Kernel / canonical transaction path。
- Cash 先有實收／找續。
- 非 Cash 唔應假裝有現金找續。
- 成功畫面只可喺 canonical result 已確認後出現。

## 8. 訂單工作台

訂單第一層分三條來源：
- 現場訂單
- 自家平台
- 第三方平台

再分：
- 進行中
- 歷史

Order Detail 要顯示：
- Display Number
- Source
- 時間
- Items / Qty / Config
- Current Effective Amount
- Current Effective Tender
- Fulfillment
- Customer / Pickup 資料（如適用）
- Payment Evidence（如適用）
- Provider reference（如適用）
- Refund / Payment Correction / Cancel history
- Print / Provider exception

核心操作：
- Accept pending order
- 人工核對電子付款截圖：PENDING / VERIFIED / REJECTED
- 標記可取餐
- 指定票據重印
- 修改同一 Order
- Payment Correction
- Refund
- Cancel
- Provider after-sale decision

Money 邊界：
- Payment Correction = SAME Order；保留舊 tender audit；不建立新 Order；不自動重印；不自動開錢箱。
- Refund ≠ Cancel。
- SMT 本地退款只做同 Business Day、未日結範圍。
- Refund 必須綁 exact Order line／qty reference／amount／actual refund method。
- 跨日／已日結退款走 Admin。
- 第三方平台退款走 Provider after-sale seam，SMT 唔自己製造 Provider refund truth。
- Cancel 本身唔自動退款。
- 如果製作單之前真係成功出過，Cancel 可按既定規則送 ONE cancellation notice；結果保存 DONE / FAILED / UNKNOWN。

## 9. 堂食工作台

核心流程：
輪候
→ 安排枱位
→ 正式入座
→ SAME Formal Order
→ 首次製作／打包／標籤打印
→ 加單
→ 分項／分次付款
→ 完成結帳
→ 清枱

必須能力：
- 輪候
- Party Size
- Admin-published Table Registry
- 掛枱／退回輪候
- 轉枱
- 併枱／拆枱
- 真實 Seated Time
- 加單加入 SAME Formal Order
- 分項付款
- Split / Combo Tender 明細
- 已付／未付視圖
- Line Correction
- 有權限人工成交價
- 首次打印 certainty
- 指定票據重印
- 完成後清枱

堂食安全：
- 已有付款後禁止用人工成交價覆寫歷史。
- Price Override 只改呢張交易有效成交價，唔改 Admin 商品價格。
- Stale revision 要 fail-closed。
- Print UNKNOWN 禁止盲目重播成套首次打印。
- Reprint 唔可以再次開錢箱。
- 未收清唔可以清枱。

## 10. 售罄與產能

Availability、Inventory、Visibility、Capacity 必須分開。

售罄頁：
- Search
- 可售 / 售罄 / 暫停
- Sold-out
- Pause
- Restore
- Revision guard
- Catalog target 必須來自正式 projection

產能：
- Pool remaining / configured initial
- 自家渠道 threshold
- 第三方 threshold
- 目前是否接受新單
- 有權限人工修正 + note

規則：
- Inventory quantity 只係統計／提示，唔自動取得交易阻斷 Authority。
- Online-only stop 唔可以誤傷 SMT 現場點單。
- 後來停售唔改寫已成立 Orders。
- Capacity / Provider 問題只 block 相關來源或新 intake，唔 block 正常本地交易。

## 11. 更多／本地營運中心

低頻能力收入口：
1. 收銀與日結
2. 報表與分析
3. 打印與設備
4. 備份與恢復
5. 顯示與操作／診斷
6. Admin 同步

### 打印與設備
- Admin 定義 Logical Printer / Product Print Rule
- SMT 綁 Physical IP / Port / Device
- Receipt / Production / Packing / Product Label / Bag Label
- Connect test
- Test print
- Save binding
- Per-route / per-device diagnostics
- 不同 physical printers 可並行
- 同一 physical endpoint 保持可控順序
- Reprint 建新 side-effect，唔覆寫舊 job

### 日結
- Opening Cash
- Cash Sales
- Cash Refund
- Expected Drawer
- Counted Cash
- Cash Removed
- Retained Cash
- Difference
- 每個 Business Date 正常日結只建立一次
- 後續跨日更正用 linked addendum，唔改寫 sealed close

### 報表
至少：
- 完成訂單
- 原始成交
- 退款
- 有效營業額
- Cash Sales / Refund / Net
- Average Order
- Item Units
- Refund rows
- Top Products
- CSV Export

### 備份／恢復
- 本機交易資料可備份
- 恢復前驗證
- 只恢復 MFK 自己資料
- 唔用 Cloud 成為備份必需依賴

## 12. Authority Map

Admin：
配置、作者、發布。

SMT：
本地正式交易執行、Formal Order、Payment execution、Fulfillment、Physical Print / Hardware、Local Continuity。

SMM：
Trusted Staff Order Intent；唔擁有 Formal Order / Pricing / Payment。

Customer：
Customer Order Intent；唔擁有 Formal Order / Pricing / Payment Execution。

Keeta：
Provider Auth / Translation / Evidence / Request / Readback；Provider ID 唔係 MFK primary truth。

Owner：
Watch / Alert / Review / Bounded Act；唔係第二 POS。

## 13. 弱網、離線與恢復

必須做到：
- Admin 暫時不可達：SMT 用最後有效發布版本。
- Cloud 不可達：現場正常交易繼續。
- Provider 壞：只影響該 Provider seam。
- Owner App 壞：SMT 交易繼續。
- Print 一條 Route 壞：唔拖死其他已成功 Route。
- App restart：已確認交易／待恢復操作不可消失。
- UNKNOWN：先 Readback。
- Retry：沿同一 identity / idempotency。
- Reconnect：唔可以一連線就顯示全綠，要完成 reconcile / readback。

## 14. Staff / Permission

- 員工編號 + PIN
- Admin-published Staff / Role / Permission
- Offline 可使用最後有效 Staff Authority Snapshot
- 敏感 mutation 要 fail-closed
- UI 隱藏按鈕唔等於 Security
- Audit 保存 actor / time / target / before-after / reason / result
- Manager／Owner 權限只授權 action，唔建立第二 transaction engine

## 15. 視覺與交互

基準：
- 1920×1080
- 高密度餐飲前線
- 固定區域
- 右側交易欄常駐
- 快速、清楚、可形成肌肉記憶
- 大 touch target
- 唔顯 raw UUID
- 日系簡潔 + Soft Glass Operational 質感

Soft Glass 只用作質感：
- Ambient backdrop
- Floating neutral surfaces
- Larger radius
- Soft elevation

Money / Status / Checkout / Sold-out / Error：
- 必須有文字
- 必須用穩定語義
- 唔可以靠漸變／玻璃／裝飾色表達 transaction truth

## 16. 明確不做

SMT V1 唔應：
- 在 SMT 重做 Admin Catalog Editor
- 建第二 Pricing / Order / Payment / Print / Auth / Sync Engine
- 將 Inventory 變自動交易阻斷
- 將 Provider 狀態當 MFK canonical truth
- Cloud-only 才可落單
- Cancel 自動變 Refund
- UNKNOWN 自動 Retry Payment / Print
- 把所有工程診斷塞入前線主畫面
- 用 global order_status 壓平 Payment / Fulfillment / Print / Provider 多條生命週期
- 因 UI 改版改交易 Authority

## 17. 上線驗收主場景

A01｜普通外賣現金單  
登入 → 點餐 → Required/Combo → Cart → Checkout → Cash → Formal Order → Print → Order Workspace。

A02｜快速重撳  
同一次 Submit 多次 click / replay，只能一張 Formal Order、一個 Display。

A03｜Menu / Price / Sellability 更新  
被動更新造成 material change，只標 affected line，要求確認／修正，不靜默改總額。

A04｜Customer / SMM / Keeta 新單  
來源 Intent → SMT revalidate → Formal Order once → source readback；無第二 Order Engine。

A05｜電子付款證據  
Screenshot 只係 Evidence；未經 Staff VERIFIED 不當成正式付款成功。

A06｜Print Partial / UNKNOWN  
成功 Route 保留；失敗／未知 Route 清楚可見；不可盲目重印；人工可選指定票據重印。

A07｜Payment Correction / Refund / Cancel  
三條操作獨立；SAME Order；Audit 完整；Cash / Report 只計一次；Cancel 不自動 Refund。

A08｜堂食  
輪候 → 入座 → Formal Order → 首次打印 → 加單 → 分項付款 → 全數結清 → 清枱；Restart 後仍可恢復同一交易。

A09｜堂食改價  
只有正式權限可做；stale reject；已付款後鎖定；不改 Admin Price。

A10｜售罄／產能  
只影響指定 Target / Channel；Existing Orders 不被重寫；Inventory 0 不偷做 Authority。

A11｜離線／外部故障  
Cloud / Owner / Provider failure 不阻本地現場交易；恢復後先 reconcile/readback。

A12｜Staff 權限  
Stale / revoked staff 對敏感 mutation fail-closed；一般 UI 不用 raw security primitive 嚇前線。

## 18. Current Repo Reality｜2026-09-27

目前 main 已有大量 SMT 主體能力，唔應再由零設計 POS：
- 點餐／Cart／Quick-Normal／Required／Combo／Fast Lane
- SAME-line edit、獨立 Cart unit、Combine 預設關
- 暫存／堂食
- Checkout / Payment / Formal local transaction
- Orders 三來源
- Payment Correction
- Same-day item-linked Refund
- Cancel + Production Cancellation Notice
- Electronic Payment Evidence Review
- Dining waiting/table/transfer/join/add-order/partial payment
- Dining Price Override
- Dining Print certainty / selective reprint
- Sold-out / Capacity Pool
- Printer binding / diagnostics
- Day Close / Report / Backup
- Staff PIN / Session

因此下一步應係：
「用呢份 Product Brief 收斂產品語義 → 對照 current main 做 Gap / UI 收口 → 只修真 gap」，唔係重寫 SMT。

## 19. 兩個目前值得修正嘅產品表達風險

1. Orders 畫面目前有「系統正常／打印機在線」類固定 badge。Product Contract 應要求呢類健康狀態一定由真 Readback / Health projection 驅動，唔可以只做裝飾性綠燈。

2. 堂食 UI 目前仍有「九宮格堂食」字樣，但底層已可讀 Admin-published Table Registry。產品語義應該係「堂食枱位工作台」，唔應把 9 枱寫死成長期產品規則。

## 20. Product Definition of Done

SMT 算完成，唔係「畫面齊」就算。

必須同時成立：
- 前線完整交易走得通
- Formal Order 只產生一次
- Pricing / Payment / Print Authority 唯一
- 外部來源全部返同一 SMT / Store Kernel formalization
- Offline / Restart / Duplicate / UNKNOWN 有 Recovery
- Money reverse 有 Audit
- Print 有 per-route certainty
- Dining 可以完整由入座到結清
- Staff Permission fail-closed
- UI 只投影可證明真相
- 實體 Printer / Drawer / LAN / Device 需要嘅項目有真機 Evidence

## 21. Handoff

呢份 Brief 係產品共識候選，未經 Owner 明確批准前：
- STATUS = DRAFT / OWNER REVIEW
- AUTHORITY_CHANGE = NONE
- PRODUCT_CODE_CHANGE = NONE
- TRANSACTION_SEMANTIC_CHANGE = NONE

下一手：
1. Owner 審核產品定位／導航／核心流程／Non-goals。
2. 批准後升格做 SMT Product Canonical。
3. 再用 current main 做 Current-vs-Brief Gap Matrix。
4. UI / Frontend / Backend 只按 Gap Matrix 開 bounded work。
5. 任何新 money / order / print semantic 另開 Owner Decision Gate。

MILESTONE_CANDIDATE：
MFK_SMT_PRODUCT_BRIEF_V1_DRAFT_READY_FOR_OWNER_REVIEW
