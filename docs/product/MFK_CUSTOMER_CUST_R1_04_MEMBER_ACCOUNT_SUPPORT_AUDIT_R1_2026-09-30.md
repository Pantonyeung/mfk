# MFK Customer｜CUST-R1-04 Member / Account / Support Audit R1

日期：2026-09-30  
範圍：UI9 Member-Memory / UI10 Account-Support  
控制 Issue：#603  
Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
狀態：PRODUCT / UX AUDIT ONLY — NO RUNTIME CHANGE

---

# 1. 今批目標

將「會員」同「帳戶／支援」分清 Primary Home。

UI9：
**我有咩會員資料 / 獎賞 / 記憶**

UI10：
**我點管理帳戶 / 通知 / 裝置 / 搵人幫手**

禁止：
- 將未連接功能畫成 disabled form
- 將 backend / implementation limitation 寫成一大段畀 Customer 睇
- 將訂單 recovery 塞入 Member page
- 將所有功能堆喺同一頁

---

# 2. UI9｜Member / Memory

## Current Reality

目前 Member page 包含：
- Member hero
- member activation preview（disabled phone/password）
- memory summary
- seeds
- coupons
- badges
- tastes / preferences
- recent order / reorder
- pending order intents / recovery
- PWA / notification disabled cards
- support card

即係：
**Member + Loyalty + History + Order Recovery + Device + Support**
全部混喺同一頁。

## Primary Home Contract

UI9 只負責：

1. Member Identity
2. Memory / Loyalty summary
3. Coupons
4. Badges
5. Confirmed taste / preference data
6. optional recent memory shortcut

唔負責：
- Pending order recovery
- account authentication form
- PWA install
- Notification permission
- Account recovery
- General support workflow

## First Viewport

Member READY：

```
[IP]  Panton
      會員 / Level（如正式資料有）

記憶種子   120
回憶券     2
勳章       5
```

下面先進：
- 回憶券
- 記憶種子
- 勳章
- 常購 / 偏好

唔需要 Hero paragraph：
- “正式會員資料已更新…”
- “會員身份同優惠狀態以店舖會員資料為準”

呢啲係 system contract，不係 daily customer copy。

## Member NOT READY / NOT CONNECTED

Current UI：
disabled phone + disabled password + paragraph explaining service not connected。

Target：
**唔顯示假 activation form。**

如果 activation backend 未 ready：
- 不顯示 phone/password fields
- 不顯示 disabled CTA
- 不用 implementation wording

Member tab 可顯示已可用內容：
- order-independent brand memory content if factual
- or compact unavailable state：
  `會員服務稍後開放`

但最好由正式 rollout gate 決定 feature visibility。

Status：
BACKEND / PRODUCT YELLOW。

## Projection States

Current `ProjectionState` 對 NOT_CONNECTED / EMPTY / ERROR / STALE 都常有 paragraph。

Target：
- Loading → skeleton
- Empty → literal empty label
- Error → short label + Retry
- Stale → small status
- Not Connected → feature hide / rollout placeholder，唔係長篇 implementation explanation

## Coupons

Card：
- state
- coupon name
- expiry
- actual condition if provided

Remove generic：
“詳情由正式會員資料提供。”

如果 detail 無資料：
唔顯示假 detail。

## Badges

Card：
- name
- earned / locked
- progress if factual
- earned date if factual

Remove：
“畫面唔會自己頒發”
呢個係 implementation rule，不係 Customer copy。

## Seeds

Show：
- actual value
- progress
- next benefit if factual

Remove：
- motivational heading duplicated with summary
- generic “下一個小心意會按實際會員進度更新。”

## Taste / Preferences

Only show confirmed Member projection data。

No data：
可以 simply hide section 或 `未有偏好`。

唔需要 explain：
“落單時你仍然可以逐次調整。”

## Pending Intents

Current Member page：
“等待確認嘅落單”

Primary Home 錯位。

Move：
- UI5 / UI6 / UI8 Orders domain

Member page 不應成為 submission recovery dashboard。

## PWA / Notification

Move UI10 Account / Device。

Current disabled “稍後開放” cards：
remove from UI9。

## Support

Move UI10。

UI9 可以有 small Account entry / gear，
但唔需要一張 support marketing card。

## UI9 Gate

Product direction：LOCKED  
Current implementation：RED  
Member activation backend：YELLOW

---

# 3. UI10｜Account / Support

## Current Reality

Account surface 有：
- member/account hero
- phone/password fields
- disabled login/activation button
- paragraph explaining missing credential backend
- recovery link
- PWA instructions
- notification permission
- privacy copy

Recovery surface 有：
- phone field
- WhatsApp recovery
- disabled temporary password form
- long explanation of unavailable automatic reset

## Core Rule

**Unavailable capability should not masquerade as a disabled product.**

如果 backend contract 未存在：
- hide the control
- rollout gate
- or show one bounded unavailable state only when user explicitly enters that function

唔應該：
把整套未完成 form 畫出嚟，再寫 paragraph 解釋點解撳唔到。

---

# 4. Account Product Map

UI10 Account：

```
帳戶

[會員資料]       >
[訂單通知]       >
[加入主畫面]     >
[私隱與通知]     >
[需要幫手]       >
```

只顯示真正存在 / 可處理嘅 action。

Authentication / credential management：
等正式 contract ready 先加入。

如果 account login backend 未 ready：
唔顯示 disabled Login Form。

---

# 5. Recovery

Current available path：
WhatsApp human support。

Target：

```
找回帳戶

電話
[____________]

[WhatsApp 聯絡磨飯]
```

如果必要，可以保留一句：
`由店舖人工核對`

唔需要：
- “唔會因為輸入電話就自動取得會員資料”
- disabled 臨時密碼 form
- disabled 新密碼 form
- “目前自動重設服務尚未連接”

當真正 Temporary Password / Reset backend ready：
先顯示嗰個 flow。

Recovery status：
WhatsApp fallback 可用時 PRODUCT LOCKED。
Automatic credential recovery：YELLOW / NO CONTRACT。

---

# 6. PWA Install

呢個係少數允許 instruction copy 嘅場景。

原因：
操作發生喺 browser / OS UI，
唔係 MFK 自己 control 可以靠 affordance 解決。

因此可以保留 short guide：

```
加入主畫面
[查看方法]

1. 分享
2. 加入主畫面
3. 加入
```

但：
- 按裝置 / browser capability 顯示
- 如果有 native install prompt，直接用 CTA
- 唔需要大段 marketing copy

---

# 7. Notification Permission

Permission 係另一個合理 copy exception。

Target：

```
訂單通知
[開啟]
```

必要短說明：
`只用於訂單狀態通知`
（前提係 product policy 真係如此）

Result：
- 已開啟
- 未允許
- 此裝置不支援

唔需要：
- “由你決定幾時開啟”
- 大段 permission education

Marketing consent / reward consent：
如實際有法律／私隱需要，
放入 Privacy / Consent detail，
唔塞入第一屏。

---

# 8. Support

General support target：

```
需要幫手

[WhatsApp 聯絡磨飯]
```

如果有電話：
`[致電店舖]`

No marketing copy。
No “我哋可以幫你處理” title + paragraph + CTA 三層重複。

---

# 9. Cross-domain Ownership

| Function | Primary Home |
|---|---|
| Member identity | UI9 |
| Seeds | UI9 |
| Coupons | UI9 |
| Badges | UI9 |
| Confirmed tastes/preferences | UI9 |
| Current order | UI6 / UI8 |
| Pending / unknown submission | UI5 / UI8 |
| Reorder | UI8 |
| Account | UI10 |
| Account recovery | UI10 |
| Notification permission | UI10 |
| PWA install | UI10 |
| General support | UI10 |

---

# 10. UI9 / UI10 Gate

UI9 Member / Memory：
PRODUCT LOCKED / CURRENT RED

UI10 Account / Support：
PRODUCT LOCKED / CURRENT RED

YELLOW：
- member activation / login credential contract
- automatic account recovery / password reset contract
- PWA availability depends on browser / OS
- notification capability depends on browser / service integration

Handling：
- unsupported actions hidden until capability exists
- browser/OS dependent action shown only when relevant
- no disabled mock functionality as customer-facing final UI

---

# 11. Customer Page Audit Coverage

完成首輪 Product / UX page audit：

- UI0 Launch
- UI1 Home
- UI2 Browse
- UI3 Configure
- UI4 Cart / Checkout
- UI5 Submit / Result
- UI6 Fulfilment
- UI7 Pickup / Complete
- UI8 Orders / History / Reorder
- UI9 Member / Memory
- UI10 Account / Support

下一步唔係 Implementation。

下一階段：
**CUST-R1-05 Consolidation**
- Product Map
- Collision closeout
- Cross-page flow
- Component contract
- Responsive / interaction
- Minimum Copy Dictionary
- RED / YELLOW closeout
- Owner Review Pack
