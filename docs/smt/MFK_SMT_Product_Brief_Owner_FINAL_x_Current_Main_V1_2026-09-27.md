# MFK SMT Product Brief｜Owner FINAL × Current Implementation

版本：V1.0  
日期：2026-09-27  
產品：MFK SMT  
狀態：COMBINED PRODUCT + IMPLEMENTATION REALITY  
Owner Product Requirements：COMPLETE  
Current Source Main：c2d5b016fe3dd08d276e915ae0f0fb2301e964cf  
Physical Acceptance：NOT FULLY CLOSED

## 0. 文件目的

呢份 Brief 將兩樣嘢疊埋：

1. Owner FINAL V1.0／Working V2.5 定義「SMT 應該做到乜」。
2. current mfk main 定義「而家實際做到乜」。

狀態：
- DONE_MAIN：current main 已有正式 source / runtime path。
- PARTIAL：只完成部分 Owner requirement。
- NOT_DONE：current main 未找到足夠實作證據。
- CONFLICT：current main 行為同 Owner FINAL 有直接衝突。
- PHYSICAL_PENDING：source 已有，但舖頭真機／printer／cold boot acceptance 未完整封章。
- NOT_VERIFIED：未有足夠證據宣稱完成。

Source DONE 不等於 Physical GREEN。

## 1. 產品一句話

SMT 係磨飯店內前線主 POS：用最快、最清楚、最少多餘步驟完成點單、收銀、接單、堂食、打印、售罄／產能同本地離線營運；所有畫面同快捷操作只操作同一份正式 Order / Pricing / Payment / Print truth。

## 2. 整體狀態摘要

已經相當完整：
- Local-first transaction core
- 點單／Cart／Quick-Normal
- Required / Combo / 飯團配對
- SAME-line edit
- 暫存／堂食入口
- Customer Payment Evidence review
- Keeta 手動待處理／最多兩次 defer
- Checkout 基本收款
- Orders 三來源 Lane
- Payment Correction
- Same-day Refund
- Cancel + cancellation notice
- Dining Formal Order / Table / Waiting / Add-order
- Dining Partial Payment / Split Tender
- Dining Print / Receipt / Cash drawer boundary
- Real SeatedAt + Dining warning
- Capacity Pool / threshold / deduct / cancel restore
- Day Close 基本現金點算
- Printer binding / reprint / diagnostics
- Backup / Restore

明顯產品缺口：
- 「更多」仍喺左 Rail，未收成頂部漢堡
- SMT 本機完整 UI density / font / category layout 連續調校未完成
- Keeta Auto / Manual mode switch 未完整
- ETA「活躍未 Ready 訂單數 → 動態分鐘 → 自動 Ready」未完成
- Customer 特別截單／即時停止新單 SMT 控制未完成
- Student Discount 未完成
- Payment 前 75% Final Review 未完成
- 普通 Order「可取餐 → 未完成」回退未完成
- 普通 Order「可取餐 → 已取餐」本地 action 未完成
- 正式 Order 修改後 Customer confirmation flow 未完成
- Cash In / Cash Out ledger 未完成
- Channel Summary / Tender Summary 未完成
- Immutable Daily Report + linked cross-day adjustment 未完成
- 售罄頁完整 canonical Catalog / Category / Search / Bulk UI 未完成
- Capacity Override 未有獨立「額外 N 份」語義
- Exact current-main physical acceptance 未封章

直接衝突：
Owner FINAL 說「有權登入 SMT → 可以操作 SMT 本文件功能，不另外設 Manager-only Gate」。
Current main 仍對 Payment Correction / Refund 使用 ORDER_CORRECTION permission，Dining Price Override 使用 PRICE_OVERRIDE permission。
PERMISSION MODEL = CONFLICT。

## 3. 主導航／整體 UI

Owner Target：
高頻主導航為點單、訂單、堂食、售罄／產能；「更多」放頂部漢堡。
主要 Modal 約 75%。
介面可連續調 Category rows / columns、Product rows / columns、Image、Font、Density / Scale，並保存。

Current Main：
- 1920×1080 ProductionViewport：已做
- 點餐／訂單／堂食／售罄／更多 Rail：已做
- Product columns projection：已做
- showImages / showDescriptions：已做
- 「更多」頂部 hamburger：未做
- 本機完整 continuous UI setting surface：未做

STATUS：PARTIAL

## 4. Customer 待處理訂單

Owner Target：
到店支付／電子支付；Screenshot 只係 Evidence；可放大；VERIFIED / REJECTED；WhatsApp QR；未核對不得 Accept；Accept 後先正式進製作／打印。

Current Main：
- Customer order 待處理：已做
- paymentEvidenceRef：已做
- PENDING / VERIFIED / REJECTED：已做
- Screenshot read / preview：已做
- Evidence 未 VERIFIED 時 Accept disabled：已做
- WhatsApp QR + 預填模板：已做
- Accept 後正式處理：已做

Gap：
- 正式 Order 修改後 Customer re-confirm / money repair：未完整

STATUS：
DONE_MAIN（待處理／付款 Evidence）
PARTIAL（修改後 Customer confirmation）

## 5. Keeta

Owner Target：
獨立來源；Auto / Manual accept；Manual 即刻／稍後；最多 defer 2 次；出錯置頂亮燈。

Current Main：
- Keeta 獨立 source：已做
- 全局 alert + 聲音：已做
- Pending banner：已做
- Accept：已做
- defer 最大 2 次：已做
- Keeta attention / reconcile：已做
- Provider confirm / READY readback：已做
- Auto / Manual setting：未完整
- Auto Accept mode：未證明

STATUS：PARTIAL

## 6. ETA／預計取餐時間

Owner Target：
只計當刻未到可取餐的活躍 Order；Admin 負荷門檻 → ETA 分鐘；正式 Order 成立後倒數，到時間可自動 Ready。

Current Main：
- Admin fulfillmentMinutes：已做
- Orders UI 顯示出餐計時分鐘：已做
- 多段負荷 threshold：未做
- active-not-ready count 計算 ETA：未做
- 每張 Order 鎖定 ETA：未做
- countdown / timer auto Ready：未做

STATUS：PARTIAL

## 7. Customer 截單／即時停止新單

Owner Target：
SMT 可設今日特別截單時間、即時停止 Customer 新單；不影響本地交易／existing orders；Customer 顯示原因 + WhatsApp fallback。

Current Main：
未找到獨立 Customer cutoff / pause SMT control。
Capacity FIRST_PARTY threshold 唔等於營運截單。

STATUS：NOT_DONE

## 8. Cart

Owner Target：
流水號 Preview、原單／整理、Admin Category order、整單堂／外、line-level堂／外、Combine exact config、independent units、SAME-line edit。

Current Main：
- Display preview：已做
- original / organized：已做
- serviceMode：已做
- line identity：已做
- combineSimilar default false：已做
- SAME line edit：已做
- structured option / freeNote / pairing：已做
- Hold restore：已做

STATUS：DONE_MAIN
備註：整理按 Admin Category exact order仍應保留 acceptance test。

## 9. 暫存／堂食入口

Owner Target：
同一入口；All Takeaway → 暫存；Any Dine-in → 堂食；人可以 override。

Current Main：
initialHoldModeForLines、HoldCartWorkspace、普通 Hold、Waiting、Dining、取回 Cart 已有。

STATUS：DONE_MAIN

## 10. Quick Mode／Required／Fast Lane／Combo

Owner Target：
Quick 可先入 Cart，但 Checkout 前補 Required；快速組合／必選區／紫米套餐；position pairing / swap / no duplicate / 殘餘單點。

Current Main：
Quick / Normal、Required Fast Lane、ComboWorkspace、RiceballPairingWorkspace、Required blocker、Quick Drink、structured Combo 已有。

STATUS：DONE_MAIN

## 11. Product Detail

Owner Target：
約75% Modal；左 options、右 summary、底 CTA；Add vs Edit；Edit SAME line。

Current Main：
ProductConfigWorkspace + SAME-line update 已有。

STATUS：DONE_MAIN
視覺 75% exact geometry仍屬 UI acceptance。

## 12. Checkout 基本結構

Owner Target：
固定 Source / Payment / Keypad。
Cash quick：$20 / $50 / $100 / $200 / $500 / Exact。

Current Main：
- Source：已做
- Tender：已做
- Fixed keypad：已做
- Exact：已做
- $50 / $100 / $200 / $500：已做
- $20：未做
- Due / Received / Change：已做
- COMBO split tender：已做

STATUS：PARTIAL

## 13. Student Discount

Owner Target：
Staff 輸入 Student Count；合資格特飲半價；最多 N 杯；手動；Auto 最貴優先；快捷人數。

Current Main：
Checkout 有「學生優惠」按鈕，但 disabled。
未找到 student pricing / selection / audit logic。

STATUS：NOT_DONE

## 14. Final Payment Review / Formal Commit Boundary

Owner Target：
Payment Confirm 前 75% Final Review；仍可改 Tender；最後 Confirm 先正式成交／Production／First Print。

Current Main：
- Confirm 才 createOrder / settleDiningHold：已做
- 成功後 Completion Review：已做
- Done 只離開：已做
- Payment 前獨立 75% Final Review modal：未做

STATUS：
Formal Commit Boundary = DONE_MAIN
Pre-commit Final Review UI = NOT_DONE
整體 = PARTIAL

## 15. Orders Workspace

Owner Target：
三 Lane；Source → Tender filter；Card 顯示 source/order/status/customer/tender/count/total/external ref/pickup code。

Current Main：
- 三 Source Lanes：已做
- Tender filter：已做
- Active / History：已做
- Order Detail：已做
- Evidence / Refund / Correction / Cancel / Reprint：已做
- Pickup Code 第一層 card：未見
- explicit source filter row：未完全同 Owner 描述一致

STATUS：PARTIAL（主體已做）

## 16. Fulfillment

Owner Target：
未完成 → 可取餐 → 已取餐；可取餐可退回未完成。

Current Main：
- 進行中：已做
- markOrderReady → 可取餐：已做
- Keeta READY mirror：已做
- 一般本地 Order 可取餐 → 未完成：未找到
- 一般本地 Order 可取餐 → 已取餐：未找到

STATUS：PARTIAL

## 17. 正式 Order 修改

Owner Target：
SMT 修改 → 通知 Customer → Customer 確認；金額改變走補款／退款。

Current Main：
- updateOrderItems SAME Order：已做
- total recalculation：已做
- Customer confirmation handshake：未完整
- add-money / refund repair choreography：未完整
- Capacity-linked Order 普通 edit 會要求 correction path

STATUS：PARTIAL

## 18. Payment Method Correction

Owner Target：
SAME Order、old Tender audit、current effective Tender、no new Order、no reprint、no drawer、Reporting只計 current。

Current Main：
correctOrderPayment、PaymentCorrectionRecord、from/to/staff、same Order update、UI 已有。

STATUS：DONE_MAIN

CONFLICT：
Current main仍要求 ORDER_CORRECTION permission，Owner FINAL話 SMT login-authorized 即可操作。

## 19. Refund

Owner Target：
Full / Partial、原路或另一方式、Original Order retained、linked refund、Cash refund進 Cash Movement、cross-day append-only adjustment。

Current Main：
- Full / Partial：已做
- line / qty / amount：已做
- actual refund method：已做
- linked OrderRefundRecord：已做
- Original Order 保留：已做
- Same-day / unclosed Business Day：已做
- Provider refund 分 after-sale：已做
- General Cash Movement ledger：未做
- cross-day linked adjustment doc：未做
- immutable report addendum：未做

STATUS：PARTIAL

## 20. Cancel / Cancellation Notice

Owner Target：
Production已出後 Cancel → ONE cancellation notice；一般 Modify 不自動 correction print。

Current Main：
cancelOrder、Capacity restore、productionIssuedAt check、dispatchCancellationNotice、DONE/FAILED/UNKNOWN 已有。

STATUS：DONE_MAIN / PHYSICAL_PENDING

注意：
Dining line correction current main有獨立商品更正通知；需要同「一般 Order 修改不自動印通知」分開語義。

## 21. Dining：Waiting／Table／Formal Order

Owner Target：
Waiting、3×3、real seated time、warning、Formal Order、Waiting可先落單／Production、SAME Order assign table、transfer/join。

Current Main：
- Waiting：已做
- Formal Dining Order：已做
- assign / unassign：已做
- transfer：已做
- join / unjoin：已做
- Admin table registry：已做
- fallback 9 tables：已做
- real seatedAt：已做
- diningOverdueMinutes：已做
- overdue red UI：已做
- history protection：已做

Difference：
Owner FINAL literal固定3×3 / 1–8 +戶外；current main已係 Admin table registry，無 registry先 fallback九格。
呢個係產品 wording alignment，而唔係 implementation missing。

STATUS：DONE_MAIN / PRODUCT WORDING ALIGNMENT REQUIRED

## 22. Dining Partial Payment / Split Tender

Current Main：
lineIndex+qty selection、stable submissionId、expectedRevision、partial settlement、COMBO splitTenders、exact total、idempotent replay、same Checkout、full paid archive 已有。

STATUS：DONE_MAIN

## 23. Dining Print / Receipt / Drawer / Reprint

Current Main：
- ensureDiningInitialPrint：已做
- table / production / packing / labels：已做
- ensureDiningPaymentReceipt：已做
- dining-payment receipt only：已做
- CASH receipt drawer：已做
- reprint drawer=false：已做
- per-job manual reprint：已做
- UNKNOWN no blind replay：已做

STATUS：DONE_MAIN / PHYSICAL_PENDING

## 24. Dining Price Override

Current Main：
Price override、stale protection、audit、after-payment forbidden、permission gate 已有。

功能：DONE_MAIN
權限：CONFLICT WITH OWNER FINAL LOGIN-AUTHORIZED RULE

## 25. Sold-out / Restore

Owner Target：
Category、Search、current sold-out list、Bulk、紫米一鍵、canonical Product target。

Current Main：
RuntimeSoldoutWorkspace、available/soldout/paused、per-node mutate、capacity view、manual capacity adjust 已有。

但 current UI 本身表明完整 catalog target projection仍未完成。
Category/search/bulk/紫米一鍵亦未完整。

STATUS：PARTIAL

## 26. Capacity Pool

Owner Target：
Initial Qty、Product binding、consume、First-party threshold、Third-party threshold、deduct、cancel restore once、Business Day reset、manual correction。

Current Main：
capacity-pool-v1、Business Day state、DEDUCT、RESTORE、idempotent cancel restore、manual adjustment、Customer FIRST_PARTY guard、Keeta THIRD_PARTY guard 已有。

STATUS：DONE_MAIN

## 27. Capacity Override

Owner Target：
Pool=0可批准額外N份／指定範圍，用完再停，保留Actor/Time/Pool/Scope/ExtraQty。

Current Main：
已有 manual remainingQty correction，但未有獨立 Override identity / allowance / scope / consume-until-exhausted semantics。

STATUS：PARTIAL

## 28. 更多／工具中心

Current Main：
LocalMoreWorkspace 有 Overview、Day Close、Reports、Printing、Diagnostics、Backup、Admin Sync。

Gap：
入口仍係左 Rail「更多」，未係頂部 hamburger。

STATUS：PARTIAL

## 29. Day Close 基礎

Current Main：
- Business Day cutoff：已做
- Opening Cash：已做
- Cash Sales / Refund：已做
- Expected / Counted / Difference：已做
- Cash Removed / Retained：已做
- Denomination mode：已做
- Direct total mode：已做
- $1/2/5/10/20/50/100/500/1000：已做
- once per Business Date：已做
- Day Close print：已做

STATUS：DONE_MAIN
但未計 Cash In / Out，因此完整現金日結仍 PARTIAL。

## 30. Cash In / Cash Out Ledger

Owner Target：
每筆 Amount / Reason / Time / Actor / Note。
Expected Cash = Opening + Cash Sales + Cash In - Cash Refund - Cash Out。

Current Main：
未找到通用 Cash In / Cash Out ledger。
Current expected = Opening + Cash Sales - Cash Refund。

STATUS：NOT_DONE

## 31. Channel Summary / Tender Summary

Owner Target：
Channel count + amount；Tender按 current effective tender；Electronic Unclassified；Cash reconciliation inference。

Current Main LocalReport有：
gross/net、refund、cash sales/refund/net、average、item units、refund rows、top products。

未有：
完整 Channel Summary、all Tender Summary、Electronic Unclassified、cash-vs-electronic inference。

STATUS：NOT_DONE

## 32. Daily Report / Product Analysis

Owner Target：
正式 immutable Daily Report、history、print/reprint、channels/tenders/cash、Top/Low/Zero、Owner projection。

Current Main：
- Local live report：已做
- sales/refund/net：已做
- cash stats：已做
- item units / average：已做
- refund rows：已做
- Top Products：已做
- CSV export：已做
- Day Close print：已做
- sealed immutable Daily Report snapshot：未做
- full history object：未做
- Channel/Tender sections：未做
- Low/Zero sellers：未做

STATUS：PARTIAL

## 33. Cross-day Adjustment / Immutable Report

Owner Target：
Original Report immutable；later refund/correction append-only linked addendum。

Current Main：
Refund記錄可帶 originalBusinessDate，但 local refund對 closed/cross-day會轉 Admin。
未見 SMT Daily Report Addendum domain。

STATUS：NOT_DONE in SMT

## 34. Print Configuration Authority

Current Main：
Admin logical/config read、SMT physical IP/port binding、connect/test print、execution 已有。

STATUS：DONE_MAIN

## 35. Reprint

Current Main：
readOrderReprintOptions、reprintOrderJobs、Dining reprint、job selection、Label grouping、reason、reprint drawer=false 已有。

STATUS：DONE_MAIN / PHYSICAL_PENDING

## 36. Printer Failure / Diagnostics

Current Main：
native result codes、UNKNOWN、per-job result、route timing、diagnostic、test print、Admin sync surface 已有。

Physical closure仍未完成。

STATUS：DONE_MAIN / PHYSICAL_PENDING

## 37. Backup / Restore

Current Main：
snapshot、checksum、create、validate、restore 已有。

STATUS：DONE_MAIN

## 38. Offline / Restart / Recovery

Source：
Local-first paths已存在。

最近 physical acceptance：
- P1 = GREEN
- P2 = USER_REPORTED_PASS
- P3 = DEFERRED / OWNER_WAIVED daytime，fresh BOOT_COMPLETED 未 GREEN
- P4 = SOURCE_READY / PHYSICAL_PENDING
- P5 = SOURCE_READY / PHYSICAL_PENDING
- P6 = NOT STARTED

STATUS：DONE_MAIN / PHYSICAL_PENDING

## 39. Permission Model

Owner FINAL：
有權登入 SMT → 可以操作 SMT 本 Brief 功能；不另設 Manager-only Gate。

Current Main：
- ORDER_CORRECTION permission
- PRICE_OVERRIDE permission
- Staff auth guards

STATUS：CONFLICT

如果 FINAL V1.0 係最高產品行為，current runtime permission gating需要收斂。

## 40. Current Source vs Physical Production

Current repo source main：
c2d5b016fe3dd08d276e915ae0f0fb2301e964cf

舖頭 physical acceptance曾鎖定 Runtime baseline：
runtime-candidate-mfk-def143f1002a

之後 current main有更多 v2local source landing。

所以：
- DONE_MAIN = 程式碼存在於 current main
- PHYSICAL_PENDING = 未必已用同一 exact source / runtime喺舖頭真機封章
- 不可用 source有code直接宣稱production fully accepted

## 41. Gap Priority

P0｜直接產品衝突
1. Permission Model

P1｜前線最明顯未完成
2. Student Discount
3. Payment前 Final Review
4. Fulfillment Ready rollback + Pickup Complete
5. Customer cutoff / pause
6. Dynamic ETA

P2｜營運收口
7. Cash In / Cash Out ledger
8. Channel / Tender summaries
9. Immutable Daily Report + cross-day adjustment
10. Sold-out canonical catalog + search / bulk
11. Capacity explicit Override semantics

P3｜IA / Polish
12. More → hamburger
13. SMT本機完整 UI layout/density settings
14. Orders Pickup Code / filter refinement

P4｜Physical closure
15. current exact Runtime cold boot
16. printer physical recovery
17. rollback / re-activate
18. full current-main device acceptance

## 42. Definition of Done

SMT 完成要同時：
1. Owner FINAL每條 requirement = DONE_MAIN 或 Owner-approved DEFER，冇 CONFLICT / NOT_DONE。
2. Current main tests GREEN，duplicate/stale/UNKNOWN safety成立。
3. Exact release完成 app restart / cold boot / real printer / LAN-WAN loss / recovery / rollback evidence。

## 43. Combined Verdict

OWNER PRODUCT REQUIREMENTS：COMPLETE

CURRENT SMT SOURCE：SUBSTANTIALLY IMPLEMENTED

FULL OWNER FINAL MATCH：NOT COMPLETE

MFK_SMT_OWNER_FINAL_X_CURRENT_MAIN
= PARTIAL / ACTIONABLE GAP MAP READY
