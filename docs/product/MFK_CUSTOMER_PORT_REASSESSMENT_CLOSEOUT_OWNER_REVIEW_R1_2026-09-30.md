# MFK Customer｜Port Reassessment Closeout / Owner Review Pack R1

日期：2026-09-30  
控制 Issue：#603  
Draft PR：#604  
Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
狀態：OWNER APPROVED / PRODUCT LOCKED  
Implementation：ENTRY READY — BLOCKED UNTIL PRODUCT SPEC MERGE

---

# 1. Port Archetype｜LOCKED

Customer = 消費者交易介面。

核心工作：
**揀餐 → 設定 → 購物車 → 結帳 → 落單 → 知道結果 → 取餐 → 再來一單**

核心 UI 語法：
**選擇 → 值 → Action → Result**

禁止：
**教學句 → 下一步提示 → 再確認提示 → 再解釋狀態 → Action**

---

# 2. Owner Hard Rules｜LOCKED

1. Human logic first.
2. UI 本身要令人一眼知道可唔可以撳、撳完發生乜。
3. Default helper paragraph = 0.
4. Button / field / selected state / completion 必須靠 affordance + hierarchy 表達。
5. Unknown != Failed.
6. Request Accepted != Store Accepted != Completed.
7. Payment Evidence != Payment Confirmed.
8. Ready != Arrived != Verified != Handed Over != Completed.
9. UI 不可補 Backend Contract.
10. Unsupported capability 不可畫成似可用的 disabled final product.
11. Product photo 必須係正式 runtime/Admin truth；禁止 generic food artwork 冒充。
12. Browser local state 不可冒充 durable Favorite / Member / Order truth.

---

# 3. Final Product Map R1

| UI | Primary Job | First Viewport | Primary Action |
|---|---|---|---|
| UI0 Launch | Brand entry | Logo / IP / animation | Auto Home |
| UI1 Home | Resume order / start discovery | Store + Active Order if any + Search | Browse / Active Order |
| UI2 Browse | Find food | Search + Categories + Products | Open Product |
| UI3 Configure | Configure one product | Product + Price + Choices | Add to Cart |
| UI4 Checkout | Confirm transaction inputs | Pickup/contact + Payment + Summary | Confirm Order |
| UI5 Submit | Show one submission result | Processing / Result | View Order / Recovery |
| UI6 Fulfilment | Know current order state | State + ETA/code | Relevant order action |
| UI7 Pickup | Complete handover | Pickup Code + State | Help only when needed |
| UI8 Orders | Current + completed orders | Current / Completed | Open / Reorder |
| UI9 Member | Loyalty / memory | Identity + member metrics | Reward / memory detail |
| UI10 Account | Device / privacy / recovery / support | Account actions | Relevant account action |

---

# 4. Final Transaction Flow R1

```
Launch
→ Home
→ Browse
→ Product
→ Cart
→ Checkout
→ Confirm Order
→ Processing
→ Result
→ Order Status
→ Ready
→ Pickup
→ Completed
→ History
→ Reorder
```

Reorder：

```
History
→ Reorder
→ current revalidation
→ if valid: Cart
→ if affected: Repair affected items only
→ Cart
→ normal Checkout
```

禁止額外：
- COPY teaching page
- redundant reorder review page
- checkout confirm-before-submit-confirm page

---

# 5. Cross-page Contract

## Search / Browse
Search → Product → close/back：
- preserve query
- preserve category
- preserve scroll position

## Product
Product → Add：
- close sheet
- preserve Browse context
- Cart badge updates

## Cart / Checkout
Cart → Checkout → Back：
- preserve cart
- preserve selections
- payment evidence only remains valid if order fingerprint unchanged

## Submit
Confirm Order：
- button locks while same submission is pending
- no duplicate request
- result routes by canonical state

UNKNOWN：
- remain same submission
- `更新狀態`
- no blind retry

## Order / Pickup
Order state route：
- preserve canonical order ID
- READY shows pickup identity
- Completion requires canonical handover/completion truth

## History / Reorder
History → Reorder：
- old order immutable
- new cart created
- only affected lines repaired

## Member / Account
Member → Account → Back：
- return Member context
- no loss of customer order/cart state

---

# 6. High-risk Contract

## Place Order

```
Current Cart
→ Current Quote
→ Required Contact
→ Payment Requirement
→ Confirm Order
→ One Submission ID
→ Pending / Delivered / Unknown / Failed
→ Readback
```

No optimistic success.

## Payment

- payment selection != payment success
- uploaded screenshot != payment confirmed
- UI only displays factual evidence state / confirmed payment state if available

## Pickup

- pickup code is identity aid
- Ready != Completed
- no local browser action may self-promote order state

## Recovery

- only supported channel shown
- current account recovery = WhatsApp human fallback where available
- no disabled fake password reset form

---

# 7. Component Contract R1

Standard semantic components：

1. AppHeader
2. SearchField
3. CategoryRail
4. ProductCard
5. ProductSheet
6. ChoiceCard / Radio / Checkbox
7. QuantityStepper
8. NoteField
9. StickyActionBar
10. CartLine
11. PaymentChoice
12. PaymentEvidence
13. OrderResult
14. OrderStatusCard
15. OrderProgress
16. PickupCodeBlock
17. CompactStateBanner
18. EmptyState
19. RepairCard
20. MemberMetric
21. CouponCard
22. BadgeCard
23. BottomNavigation
24. Modal / Sheet
25. LoadingSkeleton

Rule：
同一 semantic action 全 App 用同一 component language。

---

# 8. Icon Strategy R1

Common actions 不再逐粒生成 custom icon：

Use one mature, consistent system icon family for:
- Home
- Search
- Back
- Close
- Plus / Minus
- Edit
- Trash
- Chevron
- Cart / Bag
- Orders / Receipt
- Account
- Bell
- Refresh
- Check
- Warning
- Info
- Phone
- Chat
- Upload
- Clock
- Filter

Custom Brand Icons only for brand-specific semantics:
- Memory Jar
- Memory Seed
- Memory Badges
- Coupon / Memory Ticket
- other MFK-only concepts

Reason：
common icons should exploit existing human conventions;
brand-specific concepts need MFK identity.

---

# 9. Responsive Contract R1

Primary acceptance widths：
- 360
- 390
- 412

Also verify tablet / desktop wrapper behaviour。

Rules：
- minimum touch target 44px
- no body horizontal scrolling
- bottom nav safe-area aware
- sticky action above safe area
- product sheet usable one-handed
- primary CTA reachable without hunting
- input keyboard must not cover active CTA / field
- product images crop consistently
- order code remains legible at minimum width
- dialogs/sheets support reduced motion
- no hover-only information

---

# 10. Interaction Contract R1

- selected state visually obvious without “已選” copy
- disabled only when user understands why from immediate context
- unsupported feature hidden instead of permanently disabled
- loading state blocks duplicate mutation
- destructive action requires explicit confirmation where needed
- errors identify affected object / action
- recovery action sits next to error
- success is shown only after confirmed state
- skeletons preserve layout
- animation explains continuity; never blocks transaction

---

# 11. Minimum Copy Dictionary R1

## Core actions
- 點單
- 加入購物車
- 更新
- 結帳
- 確認落單
- 修改
- 刪除
- 再來一單
- 再試一次
- 更新狀態
- 聯絡磨飯
- 返回

## Fields
- 電話
- 稱呼（選填）
- 備註（選填）
- 數量
- 付款
- 付款截圖

## Order states
- 等店舖確認
- 已接單
- 製作中
- 稍有延誤
- 可以取餐
- 已到店
- 核對中
- 已核對
- 需要協助
- 已交收
- 已完成
- 未能接單
- 已取消
- 確認中
- 未能送出

## Remove from default UX
- 今日要幾多
- 今次數量
- 目前設定
- 你的選擇
- 一步一步完成
- 下一步：付款
- 下一步：提交前確認
- 最後睇多次…
- 完成後先可加入
- 結帳前會再確認…
- “只會…唔會…” repeated system explanations
- internal readback / canonical / published / attempt count vocabulary

---

# 12. Collision Closeout

## RESOLVED BY PRODUCT RULE

### Generic product fallback
Resolution：
No fake generic food image.

### Local Favorite
Resolution：
Hide until durable Favorite authority exists.

### Featured / Popularity
Resolution：
Only use if official source supports it.

### Pending order recovery under Member
Resolution：
Move to Orders / Submit.

### PWA / Notification under Member
Resolution：
Move to Account.

### Disabled unavailable functions
Resolution：
Hide until capability exists.

### Order-state prose duplication
Resolution：
One primary visible state + necessary value/action.

### Reorder teaching phases
Resolution：
System revalidation internal; customer sees Repair only if needed.

---

# 13. YELLOW Dependencies

1. Customer Arrival Notification seam
   - Handling: hide “我到了”
   - Do not locally transition ARRIVED

2. Saved Order Template mutation seam
   - Handling: hide “設為常用訂單”

3. Member activation / login credential contract
   - Handling: hide activation/login form until ready

4. Automatic password reset / recovery contract
   - Handling: current WhatsApp human recovery only

5. PWA install
   - browser / OS dependent
   - show only relevant install flow

6. Notification
   - browser permission + service integration dependent
   - do not imply notification service active from permission alone

7. Accepted IP / Brand Assets
   - master packs exist
   - runtime wiring only after product/UI implementation gate

---

# 14. Owner Decisions｜RESOLVED / LOCKED

Owner 於 2026-09-30 明確確認全部剩餘 RED：

## RED-01｜Launch Navigation → RESOLVED

LOCKED：
**Brand animation → automatically enter Home**

- 不再顯示「進入主頁 / 進入會員頁」同級選擇。
- Member 保留 Bottom Navigation 正常入口。
- reduced-motion / returning flow 同樣以 Home 為預設落點。

## RED-02｜Checkout Structure → RESOLVED

LOCKED：
**One Checkout surface + one `確認落單` CTA**

Checkout 同一 surface 包含：
- contact / pickup
- payment
- order summary
- total
- one `確認落單`

移除：
- separate review-confirm page
- confirm-data-before-submit layer
- 「下一步：付款 / 下一步：提交前確認」教學式 flow

Safety validation 保留於 system contract：
quote / availability / payment / material change / duplicate submission protection。

RED COUNT：0

---

# 15. Owner Review Checklist

- [x] RED-01 Launch auto-Home — OWNER CONFIRMED
- [x] RED-02 Single-surface Checkout — OWNER CONFIRMED
- [x] Human Logic Gate
- [x] Direct Order UX
- [x] Product truth image rule
- [x] Favorite authority rule
- [x] UI0–UI10 Primary Home map
- [x] Order state semantics
- [x] Reorder simplification
- [x] Member / Account responsibility split
- [x] Unsupported capability visibility rule
- [x] Component contract
- [x] Responsive contract
- [x] Interaction contract
- [x] Minimum Copy Dictionary
- [x] YELLOW dependencies bounded

---

# 16. Gate

Current：
**OWNER APPROVED / PRODUCT LOCKED**

RED：0

YELLOW：
全部已有 bounded handling，不阻產品定義鎖定。

Implementation Entry：
**READY AFTER PRODUCT SPEC MERGE**

Sequence：
1. Product spec merge
2. Create isolated Customer implementation candidate
3. Implement locked UI0–UI10 product contract
4. Physical 360 / 390 / 412 acceptance
5. Owner visual confirmation per Stage
6. Only then consider runtime merge / deploy / OTA

No runtime code was changed by this product reassessment approval.

MILESTONE:
MFK_CUSTOMER_PORT_REASSESSMENT_R1_OWNER_APPROVED_PRODUCT_LOCKED
