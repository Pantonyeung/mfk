# MFK SMT｜Owner 要求 × Current Implementation｜UI 重畫 Product Brief R1

版本：R1  
日期：2026-09-27  
Repo：Pantonyeung/mfk  
基準 main：c2d5b016fe3dd08d276e915ae0f0fb2301e964cf  
目的：重新畫 SMT UI 前，先把「Owner 最終要求」同「目前已實作能力」合併成一份可直接用的產品 Brief。  

## 0. 最重要使用原則

呢份 Brief 唔係用 Owner 文件推翻現有 SMT。

正式使用優先次序：

1. current main 已經實作、已接受、已落地的交易／runtime 行為：保留，不因重畫 UI 而推翻。
2. Owner FINAL V1.0 / Working V2.5：用來檢查個人要求有冇做齊，找出缺口。
3. 已實作功能如果比 Owner 舊要求更完整：保留 current superset。
4. Owner 要求有、current main 冇：標 MISSING，UI 可以預留，但唔可以假裝 runtime 已有。
5. 已有 backend/runtime，但 UI 未完全符合 Owner：標 PARTIAL / UI REWORK。
6. Source 已有但實機／真 printer／power-cycle 未完整驗收：標 PHYSICAL_PENDING。
7. UI 重畫只改 presentation / IA / interaction；Order / Pricing / Payment / Print / Store Kernel 不重建。

## 1. 狀態定義

- KEEP_DONE：current main 已有，重畫 UI 必須保留。
- KEEP_SUPERSET：current main 比 Owner 原要求更完整，保留現況。
- PARTIAL_UI：核心已存在，但 UI／交互未做到 Owner 最終形態。
- PARTIAL_LOGIC：部分能力存在，但 Owner 行為未完整。
- MISSING：current main 未找到完整實作。
- PHYSICAL_PENDING：source 已有，但實體裝置／打印／power-cycle 驗收未完整收口。
- CURRENT_WINS_CONFLICT：Owner 文件同 current implementation 有衝突；按今次原則保留 current implementation，不在 UI 重畫時倒退。

---

# 2. Executive Summary

## 已經成熟、UI 重畫不可推翻的核心

- Local-first SMT transaction execution
- Customer / Keeta Pending handling
- Payment Evidence 人工核對
- WhatsApp payment follow-up QR
- Keeta auto/manual intake + defer 2 次
- Quick / Normal ordering
- Required Gate
- Canonical Combo / Riceball pairing
- SAME Cart Line edit
- 暫存／堂食 contextual entry
- Formal Checkout / local Order creation
- Orders 3-source lanes
- Payment Correction
- Same-business-day Full / Partial Refund
- Cancel + cancellation notice
- Dining formal order / table / waiting / add-order
- Dining split settlement / split tender
- Dining seatedAt / overdue warning
- Dining first print / payment receipt / selective reprint
- Dining price override
- Sold-out individual operation
- Capacity Pool deduction / restore / business-day reset / manual adjustment / channel threshold
- Printer physical binding / routing / per-job diagnostics
- Day Close basic cash count / retain / remove
- Basic Report / Top Products / CSV
- Backup / Restore
- Admin Sync / LKG
- Staff PIN / session / permission checks
- Local offline runtime

## 最值得今次 UI 重畫直接處理的缺口

- More 仍然喺左 Rail，未變頂部 Hamburger
- Display Settings 未做到 Owner 要求的連續密度／字體／行列調整
- Ordering 主 Modal 未全面統一成約 75%
- ETA 仍未做到「活躍單量門檻 → 動態 ETA → 自動可取餐」
- Customer 今日截單／即時停新單控制未完整落 SMT UI
- Cart「整理」未真正按 Admin Product Category 重排
- Combine equality guard 未完整包含 structured option / pairing identity
- Checkout 缺 $20 快捷金額
- 學生優惠未實作
- Final Payment Review 未做成獨立 75% 最終確認層
- Fulfillment 缺「可取餐 → 未完成」及清楚「已取餐」人工流程
- 正式 Order 修改後通知 Customer + Customer Confirm 未完整
- Sold-out 缺 Category filter / Bulk operation / 一鍵紫米售罄恢復
- Capacity Override 未做成獨立 bounded override flow
- Cash In / Cash Out ledger 未完整
- Channel Summary / Tender Summary / Electronic Unclassified 未完整
- Immutable Daily Report + later linked adjustment 未完整
- Printer Failure 全局 Attention / 亮燈未完整
- 真機 power-cycle / print / offline acceptance 仲有未收口項

---

# 3. Owner Requirement × Current Main Matrix

| # | Owner 要求 / 產品域 | Current 實作 | 狀態 | UI 重畫指令 |
|---|---|---|---|---|
| 1 | 1920×1080 前線 POS、Local First | ProductionViewport + local runtime 已有 | KEEP_DONE | 保留固定工作台，不轉 mobile-style POS |
| 2 | 高頻導航：點單／訂單／堂食／售罄產能 | 現有 Rail 有點餐／訂單／堂食／售罄 | KEEP_DONE | 四個高頻入口保留 |
| 3 | More 改頂部 Hamburger | current nav 仍有「更多」Rail item | PARTIAL_UI | 新 UI 改 Hamburger；功能內容不刪 |
| 4 | 介面設定：行列／圖片／字體／密度連續調 | current 有 showImages / showDescriptions / product columns，但無完整 continuous font/density/rows UI | PARTIAL_UI | 重畫要預留完整 Display Settings |
| 5 | 主要 Modal 約 75%，底部 CTA 固定 | Dining Price Override / Reprint 已有 75%；Ordering center panel 未全面統一 | PARTIAL_UI | 所有 Product / Required / Combo / Hold / Pending 收斂統一 Modal geometry |
| 6 | Customer 待處理區 | Ordering Top Strip + Pending Review 已有 | KEEP_DONE | 保留，重畫資訊層級 |
| 7 | Customer Payment Screenshot 只係 Evidence | PENDING / VERIFIED / REJECTED + Accept Gate 已有 | KEEP_DONE | 禁止 UI 寫成「付款已成功」 |
| 8 | Payment Evidence WhatsApp QR | current Orders 已有對客 WhatsApp QR + template | KEEP_DONE | 保留 |
| 9 | Keeta Auto / Manual 接單 | Admin policy autoAccept + 手動 Accept 已有 | KEEP_DONE | UI 顯示目前模式 |
| 10 | Keeta 稍後處理最多 2 次 | deferKeetaOrder max 2 已有 | KEEP_DONE | 保留次數／Attention |
| 11 | Keeta Error 置頂／亮燈 | Intake attention + banner + global arrival 已有 | KEEP_DONE | 視覺可重畫，但 Attention 唔可消失 |
| 12 | ETA 按「未到可取餐」活躍單計算 | current 只讀 fulfillmentMinutes；未見完整負荷 threshold engine | PARTIAL_LOGIC | UI 可畫 ETA 區，但標為未完整接線 |
| 13 | ETA 倒數自動進可取餐 | current 有 markOrderReady，但未見 countdown auto-ready | MISSING | 不可畫成已自動運作 |
| 14 | 今日特別截單／即時停止 Customer 新單 | current SMT 未見完整控制 surface | MISSING | UI 可設計入口，runtime 後補 |
| 15 | 流水號 Preview 不提前佔號 | current 有 next display preview | KEEP_DONE | 保留 Preview 語義 |
| 16 | 原單 | current 有 original view | KEEP_DONE | 保留 |
| 17 | 整理＝按 Admin Product Category 排序 | current Organized view 主要按 group；另有 OrganizeWorkspace，不等於 Category reorder | PARTIAL_LOGIC | 新 UI 唔好假設已完成；需要真 category sort seam |
| 18 | 整單堂／外切換 | current 已有 | KEEP_DONE | 保留 |
| 19 | 每行堂／外切換 | current 已有 | KEEP_DONE | 保留 |
| 20 | Combine 預設 OFF | current 預設 false | KEEP_DONE | 保留 |
| 21 | Combine 只合併完全相同配置 | current key 主要係 productId/serviceMode/unitMinor/detail，未完整納入 structured option/pairing identity | PARTIAL_LOGIC | UI 可保留 Combine，但 backend equality 要再收緊 |
| 22 | 暫存／堂食同一入口 | current 已有「暫存／堂食」 | KEEP_DONE | 重畫直接沿用 |
| 23 | All takeaway 預設暫存；Any dine-in 預設堂食；可 override | initialHoldModeForLines 已有 | KEEP_DONE | 保留 |
| 24 | 空 Cart → 取單 | current 已有 | KEEP_DONE | 保留 |
| 25 | Quick / Normal | current 已有 | KEEP_DONE | 保留 |
| 26 | Quick 可先入未完成 Required | current 已有 | KEEP_DONE | 保留 |
| 27 | Required 未完成禁止 Checkout | current checkoutEnabled gate 已有 | KEEP_DONE | 保留 |
| 28 | 快速組合 positional pairing | current Riceball Pairing 已有 | KEEP_DONE | 保留 |
| 29 | 已配小食再指定＝Swap，不 duplicate | current swapPairingSnack 已有 | KEEP_DONE | 保留 |
| 30 | 數量不等，剩餘保持單點 | current pairing draft / leftover semantics 已有 | KEEP_DONE | 保留 |
| 31 | 紫米套餐讀 Admin canonical Combo | current ComboWorkspace 讀 Admin Combo/Pool | KEEP_DONE | 保留，不寫死第二套 A/B/C/D engine |
| 32 | Quick Drink / 飲品補選 | current Drink Supplement workspace 已有 | KEEP_DONE | 保留 |
| 33 | Product Detail Same-line Edit | current lineId edit path 已有 | KEEP_DONE | 保留 |
| 34 | Product Detail 約 75% | current Ordering center panel 未全面跟 75% modal contract | PARTIAL_UI | 重畫時統一 |
| 35 | Checkout 固定 Source / Payment / Keypad | current Checkout 固定 step layout 已有 | KEEP_DONE | 保留固定肌肉記憶 |
| 36 | Cash $20/$50/$100/$200/$500/Exact | current 有 $50/$100/$200/$500/Exact，缺 $20 | PARTIAL_UI | 新 UI 加 $20，runtime handler可沿現有 quick cash |
| 37 | Payment methods 由 Admin 可增減 | current checkout methods 仍硬列 CASH/FPS/PAYME/ALIPAY/WECHAT/COMBO | PARTIAL_LOGIC | 新 UI 唔好鎖死，但 runtime 尚要接 canonical config |
| 38 | 學生優惠 | current Checkout「學生優惠」按鈕 disabled，未見正式 discount logic | MISSING | 今次 UI 可完整畫，但標「待接線」 |
| 39 | Final 75% Payment Review | current confirm 直接進 transaction；無獨立 final review modal | MISSING_UI | 新 UI 應加入 final review layer |
| 40 | Payment Confirm = Formal boundary | current confirm → createOrder / dining settle | KEEP_DONE | 絕對不可因重畫改早 commit |
| 41 | Completion Review，Done 只離開 | current success completion state + Done 已有 | KEEP_DONE | 保留 |
| 42 | Orders 3 Lane | current sourceLane 三欄已做 | KEEP_DONE | 保留 |
| 43 | Source → Tender Filter | current Orders 有 source lane / filtering；需 UI 重畫時保留兩層語義 | KEEP_DONE | 保留 |
| 44 | Pickup Code 只作人工核對 | current providerPickupCode 為 display data，無 hard gate | KEEP_DONE | 保留 |
| 45 | 未完成 → 可取餐 | current markOrderReady 已有 | KEEP_DONE | 保留 |
| 46 | 可取餐 → 未完成 | current 未見 reopen/revert action | MISSING | UI 可設計，runtime 後補 |
| 47 | 已取餐人工完成 | current source主要用「已完成」；Orders UI 未見清晰人工 pickup-complete action | PARTIAL_LOGIC | UI 要預留，但先確認 runtime seam |
| 48 | 正式 Order 修改 | current updateOrderItems 已有 | KEEP_DONE | 保留 SAME Order |
| 49 | 修改後通知 Customer + Customer Confirm | current 本地 edit 有，但未見完整 Customer confirm round-trip | MISSING | 新 UI 可標「通知客戶／待確認」但需後端接線 |
| 50 | Payment Correction | current correctOrderPayment + audit 已有 | KEEP_DONE | 保留 |
| 51 | Full / Partial Refund + alternative method | current refundOrder + UI 已有；第三方走 Provider after-sale，跨日／日結後轉 Admin | KEEP_DONE | 保留 current boundary |
| 52 | Cancel 不自動 Refund | current 已分離 | KEEP_DONE | 保留 |
| 53 | 已出 Production 後 Cancel → Cancel Notice | current productionIssuedAt guard + cancellation notice 已有 | KEEP_DONE | 保留 |
| 54 | 一般 Order 修改後不自動重印 | current updateOrderItems 不 auto print | KEEP_DONE | 保留 |
| 55 | Dining line 修改後不自動 correction print（Owner 舊要求） | current Dining post-production correction 會印「商品更正通知」 | CURRENT_WINS_CONFLICT | 已實作現況比 Owner FINAL 不同；今次 UI 重畫保留 current behavior，不倒退 |
| 56 | Dining Table 1–8 + Outdoor fixed 3×3 | current 已升級為 Admin Table Registry；無 registry 才 fallback 9 枱 | KEEP_SUPERSET | UI 不應再寫死 9 枱；用動態 table workspace |
| 57 | Waiting | current createDiningWait 已有 | KEEP_DONE | 保留 |
| 58 | Waiting 可先落單／Production，再入枱 | current admitDiningHold + initial print + assign table 已有 | KEEP_DONE | 保留 |
| 59 | Real SeatedAt | current assignDiningTable 設 seatedAt | KEEP_DONE | 保留 |
| 60 | Dining overdue warning from Admin | current diningOverdueMinutes + visual overdue 已有 | KEEP_DONE | 保留 |
| 61 | Transfer Table | current assign transfer flow 已有 | KEEP_DONE | 保留 |
| 62 | Join / Unjoin Table | current join/unjoin 已有，屬超出 Owner FINAL 的 superset | KEEP_SUPERSET | 重畫 UI 要保留 |
| 63 | Add Order SAME Formal Order | current appendDiningItems 已有 | KEEP_DONE | 保留 |
| 64 | Add Order delta print | current ensureDiningAdditionPrint 已有 | KEEP_DONE | 保留 |
| 65 | Item split / partial payment | current settleDiningHold selections 已有 | KEEP_DONE | 保留 |
| 66 | COMBO Split Tender exact detail | current splitTenders 持久化已做 | KEEP_DONE | 保留 |
| 67 | Dining Payment Receipt | current ensureDiningPaymentReceipt 已有 | KEEP_DONE | 保留 |
| 68 | Cash-only drawer / Reprint no drawer | print plan current 有 cash drawer，reprint force kickDrawer=false | KEEP_DONE | 保留 |
| 69 | Dining First Print certainty | current attemptedAt + DONE/FAILED/UNKNOWN 已有 | KEEP_DONE | 保留 |
| 70 | Dining selective reprint | current readDiningReprintOptions / reprintDiningJobs 已有 | KEEP_DONE | 保留 |
| 71 | Dining Price Override | current 有 permission/stale/audit/paid lock | KEEP_SUPERSET | 保留 current safer behavior |
| 72 | Cross-device Dining serialization | current Web Locks + local queue，只係同 browser/device scope；未證真正跨裝置 | PARTIAL_LOGIC | UI 無需表達；工程仍需補 |
| 73 | Native power-loss / cold-boot recovery | source 有 recovery，但最新 physical acceptance 未完全收口 | PHYSICAL_PENDING | UI 重畫不影響；驗收另跟 |
| 74 | Sold-out Search | current 有 Search | KEEP_DONE | 保留 |
| 75 | Sold-out individual Soldout/Pause/Restore | current 有 | KEEP_DONE | 保留 |
| 76 | Sold-out Category Filter | current 未見 category filter | MISSING_UI | 新 UI 加 |
| 77 | Bulk Soldout / Pause / Restore | current 未見 bulk selection | MISSING | 新 UI 可畫，runtime 後補 |
| 78 | 一鍵紫米售罄／恢復 | current 未見專用 action | MISSING | 新 UI 可畫，需綁 Pool target |
| 79 | Capacity Pool display | current 有 | KEEP_DONE | 保留 |
| 80 | Formal Order deduct Capacity | current deduction event 已有 | KEEP_DONE | 保留 |
| 81 | Cancel restore Capacity once | current RESTORE event idempotence 已有 | KEEP_DONE | 保留 |
| 82 | Business Day Reset | current capacityBusinessDate 用 business cutoff | KEEP_DONE | 保留 |
| 83 | Manual Capacity correction + audit | current applyManualCapacityCorrection 已有 | KEEP_DONE | 保留 |
| 84 | First/Third Party threshold | current firstPartyStopAt / thirdPartyStopAt 已有 | KEEP_DONE | 保留 |
| 85 | Capacity admission block remote intake | current customer/other channel admission seam 已有 | KEEP_DONE | 保留 |
| 86 | Bounded Override「額外 X 份／scope」 | current 只有直接 manual remaining correction，未見獨立 bounded override object | PARTIAL_LOGIC | 新 UI 要分「改數」同「Override」 |
| 87 | More / Tools Center | current More page 有 Day Close/Report/Print/Backup/Diagnostics/Admin Sync | KEEP_DONE | 內容保留，入口重畫 |
| 88 | Day Close basic cash count | current 已有 | KEEP_DONE | 保留 |
| 89 | Denomination count + direct total | current 已有，甚至包含 $1000 | KEEP_SUPERSET | 保留 current |
| 90 | Withdrawal / Retained Cash | current 已有 | KEEP_DONE | 保留 |
| 91 | Cash In / Cash Out Ledger | current 未見一般 Cash Movement surface/store | MISSING | UI 可畫但標待接線 |
| 92 | Expected Cash 包含 Cash In/Out | current expected = opening + cash sales - cash refunds；未含 general Cash In/Out | MISSING | 需 ledger 後先完成 |
| 93 | Channel Summary | current local report 未見完整 per-channel count/amount | MISSING | 新 UI 可畫，projection 後補 |
| 94 | Tender Summary | current report主要計 Cash / Refund，未見完整 tender breakdown UI | PARTIAL_LOGIC | 新 UI可畫，report model要擴 |
| 95 | Electronic Unclassified | current 未見正式 reporting category | MISSING | 後補 |
| 96 | Top Products | current 有 | KEEP_DONE | 保留 |
| 97 | Low / Zero Seller | current report只排序已賣產品，未見 zero-seller catalog join | MISSING | 新 UI 可畫，report model後補 |
| 98 | Daily Report history | current Day Close history / report screen 已有基礎 | PARTIAL_LOGIC | 保留現有，補 immutable snapshot contract |
| 99 | Daily Report physical print | current printDailyClose 已有 | KEEP_DONE | 保留 |
| 100 | Immutable old report + append-only later adjustment | current SMT 跨日 refund直接要求去 Admin；未見 SMT linked adjustment view | PARTIAL_LOGIC | UI 可顯「跨日調整由 Admin」；唔好假裝 SMT 已完成 |
| 101 | Print Authority Admin logical / SMT physical | current 已有 | KEEP_DONE | 保留 |
| 102 | Physical Printer IP / Binding | current 已有 | KEEP_DONE | 保留 |
| 103 | 80mm Whole Ticket Reprint | current 已有 selectable ticket job | KEEP_DONE | 保留 |
| 104 | Label per-label / partial reprint | current label job 可多選／部分 | KEEP_DONE | 保留 |
| 105 | Printer failure per-route detail | current dispatch summary / diagnostics 已有 | KEEP_DONE | 保留 |
| 106 | Printer failure global attention / light | current有錯誤文字與診斷，但未見完整全局 Attention closure | PARTIAL_UI | 新 UI 加統一 Attention |
| 107 | Admin Sync status | current 有 | KEEP_DONE | 保留 |
| 108 | Backup / Restore | current create/validate/restore 已有 | KEEP_DONE | 保留 |
| 109 | Offline local trading | current local runtime / print path 已有 | KEEP_DONE | UI 重畫不可引入 cloud dependency |
| 110 | Full physical offline / restart / printer acceptance | 最新控制仍有 P3/P4/P5/P6 未完全閉環 | PHYSICAL_PENDING | 與 UI 重畫分開處理 |
| 111 | Owner 要求「登入 SMT 即可做全部設定」 | current Payment Correction / Price Override 等仍有 permission gate | CURRENT_WINS_CONFLICT | 今次按「已實作不推翻」保留 current stricter permission model |
| 112 | Staff PIN / Session | current 已有 | KEEP_DONE | 保留 |
| 113 | 不顯 raw UUID | current frontline主要用 display code | KEEP_DONE | 重畫繼續禁止 UUID |

---

# 4. UI 重畫應直接保留的 Screen / Component Contract

## A. 點單頁

必須保留：
- Top Pending / Keeta strips
- Category
- Product Grid
- Quick / Normal
- Product More（三點）
- Required / Combo / Riceball pairing / Drink supplement
- Right Cart
- Original / Organized / Combine
- Whole-order Dine-in / Takeaway
- Line-level Dine-in / Takeaway
- 暫存／堂食
- Trash clear
- Checkout
- New-order global alert

重畫可以改：
- spacing
- card proportion
- colour
- radius
- typography
- hierarchy
- modal geometry
- iconography
- information density

不可改：
- Required Gate
- Same-line edit
- Combo truth
- Pairing swap semantics
- Hold/Dining contextual default
- Formal commit boundary

## B. Checkout

必須保留：
- Source
- Tender
- Cash received / change
- Combo tender
- fixed keypad position
- Completion Review
- Dining Checkout Recovery

需要新增／重畫：
- $20 Quick Cash
- Student Discount
- Final 75% Review
- Admin-driven payment method presentation

## C. Orders

必須保留：
- 3 source lanes
- Pending payment evidence review
- WhatsApp QR
- Keeta attention/defer
- Payment Correction
- Refund
- Cancel
- Cancellation Notice state
- Reprint
- Provider after-sale
- Ready action

需要新增／補：
- Ready → Not Ready
- clear Pickup / 已取餐 action
- Customer modification confirmation flow
- stronger global exception visual

## D. Dining

Current implementation已經比最初 Owner fixed-nine-table 要求更進一步。

UI 重畫應以 current runtime 為準：
- dynamic Admin Table Registry
- waiting
- seatedAt
- overdue
- assign / transfer
- join / unjoin
- formal order
- first print
- add-order
- correction
- price override
- partial payment
- split tender
- payment receipt
- selective reprint
- payment history

禁止重畫時退回：
- 固定只得 9 張枱
- 第二 Checkout
- 第二 Payment Engine
- 無 seatedAt 的 createdAt 假代
- 無 UNKNOWN 的 blind retry

## E. Sold-out / Capacity

保留：
- Search
- Single-item state
- Capacity Pool
- Remaining
- First-party / Third-party threshold state
- Manual quantity correction

新增 UI：
- Category filter
- Bulk actions
- Purple one-click soldout/restore
- Dedicated bounded Override

## F. More / Tools

保留 current functions：
- Day Close
- Reports
- Print / Device
- Backup / Restore
- Diagnostics
- Admin Sync

入口改：
- Rail More → Top Hamburger

新增／補：
- Cash In / Cash Out
- Channel Summary
- Full Tender Summary
- Low / Zero Seller
- Immutable Daily Report + linked later adjustment view
- Printer Failure global attention

---

# 5. Current Implementation Supersedes Owner Older Wording

以下唔應因重畫 UI 倒退：

1. 堂食桌台  
Owner FINAL 寫 3×3 / 1–8 + Outdoor；current runtime 已經讀 Admin Table Registry，9 格只係 fallback。  
=> 新 UI 畫「動態桌台工作台」，唔硬寫死 9 枱。

2. Dining join / unjoin  
Owner FINAL 未要求咁完整，但 current 已做。  
=> 保留。

3. Dining Price Override  
Owner FINAL V1.0 權限寫「登入 SMT 即可操作」，但 current 已有 PRICE_OVERRIDE permission + stale guard + audit。  
=> 保留 current safer model。

4. Payment Correction permission  
current 有 ORDER_CORRECTION permission。  
=> 保留，唔因 UI 重畫拆安全 gate。

5. Dining post-production correction notice  
Owner FINAL 說修改唔自動印通知，但 current Dining 已落地「商品更正通知」打印。  
=> 按今次原則保留 current implementation；新 UI 只反映真實現況。

6. Day Close denomination  
Owner FINAL 至少到 $500；current 已有 $1000。  
=> 保留 current superset。

---

# 6. 真正仍未做齊的 Owner Personal Requirements

最明確未完成：

1. Top Hamburger More
2. 完整連續 Display Settings
3. 全部主要 Modal 75% 一致化
4. Dynamic ETA load thresholds
5. ETA countdown auto-ready
6. Customer special cutoff / instant stop control
7. Category-based Cart organize
8. Full structured Combine equality
9. $20 Quick Cash
10. Student Discount
11. Final Payment Review modal
12. Admin-driven checkout payment-method expansion
13. Ready → Not Ready
14. 明確 Pickup / 已取餐 action
15. Order modification → Customer confirm
16. Sold-out category filter
17. Bulk Sold-out / Restore
18. Purple one-click Sold-out / Restore
19. Dedicated bounded Capacity Override
20. Cash In / Cash Out Ledger
21. Expected Cash include Cash In/Out
22. Channel Summary
23. Complete Tender Summary
24. Electronic Payment Unclassified
25. Low / Zero Seller
26. Immutable Daily Report snapshot + linked later adjustment view
27. Global Printer Failure Attention
28. 真機 restart / power-cycle / printer / offline acceptance 收口

---

# 7. UI 重畫工作模式

今次重新畫 SMT，設計檔應該每個功能標：

- LIVE：current main 已有，UI 可直接接。
- LIVE_SUPERSET：current 已比 Owner requirement 更完整，必須按 current 畫。
- UI_REWORK：backend/runtime 已有，只係重新排版／交互。
- FUTURE_WIRING：Owner 有要求，但 runtime 未有；畫 UI 但唔假裝已接線。
- PHYSICAL_PENDING：software 已有，但真機驗收未完整。

任何設計稿如果將 FUTURE_WIRING 畫成已經正式可交易，工程接手時會產生錯誤預期，所以必須清楚標。

---

# 8. 本次重畫的 Recommended Page Set

1. SMT Shell / Navigation
2. Ordering Main
3. Pending Customer
4. Pending Keeta
5. Product Detail
6. Required Fast Lane
7. Riceball Pairing
8. Combo
9. Hold / Dining Entry
10. Checkout
11. Final Payment Review
12. Completion Review
13. Orders
14. Order Detail
15. Payment Evidence
16. Payment Correction
17. Refund
18. Reprint
19. Dining Floor
20. Dining Detail
21. Dining Split Settlement
22. Dining Price Override
23. Dining Reprint
24. Sold-out
25. Capacity
26. Capacity Override
27. More / Tools
28. Day Close
29. Cash In / Out
30. Reports
31. Printing / Device
32. Diagnostics
33. Backup / Restore
34. Admin Sync
35. Global Alert / Exception States

---

# 9. Brief 結論

Owner Product Requirements：
COMPLETE。

Current SMT Implementation：
大量核心已完成，而且部分已超過 Owner 原先文件。

今次 UI 重畫目標唔係「按 Owner 文件重新做 SMT」；
而係：

CURRENT IMPLEMENTATION
+ OWNER PERSONAL REQUIREMENT GAP
= NEW UI PRODUCT BRIEF

原則：

已做 → 保留。  
做得更好 → 保留 superset。  
只係畫面未好 → 重畫 UI。  
Owner 有但未做 → 清楚標 Future Wiring。  
真機未驗 → 唔假稱完成。  
交易 Authority → 完全唔郁。

MILESTONE：
MFK_SMT_OWNER_REQUIREMENT_CURRENT_IMPLEMENTATION_COMBINED_UI_BRIEF_R1
