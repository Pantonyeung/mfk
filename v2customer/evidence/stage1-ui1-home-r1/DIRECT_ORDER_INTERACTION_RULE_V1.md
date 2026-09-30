# MFK Customer UX — Direct Order Interaction Rule V1

Date: 2026-09-30
Scope: Customer App UI0–UI10
Status: OWNER HARD REQUIREMENT

## Product correction

Customer App is an ordering tool, not a tutorial.

The interface must not explain obvious controls with instructional prose.
Users should understand the action from layout, control shape, label, value, state and feedback.

## Human-logic rule

Use:
- nouns for fields
- verbs for actions
- values for current selections
- state labels for system/business state
- direct feedback after actions

Do not use paragraphs to explain what a button, quantity control, option selector, note field, checkout or next step does.

## Examples

Quantity:
- Show [-] 1 [+]
- Do not add explanatory copy such as "今日要幾多" / "今次數量幾多"

Notes:
- Use "備註（選填）"
- Do not add "今次備注要乜嘢" explanatory copy

Selected options:
- Show the selected value directly
- Do not add "目前設定係乜嘢"

Checkout:
- Show items, quantities, selected modifiers, price and total
- Remove generic helper text such as "結帳前會再確認菜單、價格與供應情報"

Primary actions:
- 加入購物車
- 結帳
- 確認落單
- 再試一次
- 聯絡店舖 / 人工協助 only when recovery is needed

## Order result

After submit, return direct state feedback.

Confirmed request accepted:
- 已送出
- 等店舖確認

Confirmed store accepted:
- 已接單

Confirmed failure:
- 未能送出
- Retry / recovery action

Unknown:
- 確認中

Never collapse these states:
Unknown != Failed
Request Accepted != Store Accepted
Store Accepted != Completed

## Screen model

HOME:
- store status
- search
- active order if present
- hero / campaign
- categories / quick access
- products
- bottom nav
No tutorial copy.

PRODUCT:
- image
- product name
- price
- required choices
- optional choices
- quantity stepper
- 備註（選填）
- 加入購物車

CART:
- item
- selected options
- quantity stepper
- edit
- price
- total
- 結帳

CHECKOUT:
- pickup / payment fields only if required
- order summary
- total
- 確認落單

SUBMIT:
- loading feedback only while actually processing
- then one direct result surface: sent / accepted / unknown / failed

ORDER STATUS:
- concise state
- ETA when available
- pickup code when applicable
- one relevant action only when needed
No three-line marketing/status prose by default.

## Copy budget

Default:
- component label: 1 short phrase
- value/state: 1 short phrase
- action: 1 verb phrase
- helper paragraph: none

Helper/explanatory copy is allowed only when:
- safety / irreversible action
- payment / legal / privacy requirement
- known error reason
- permission request
- recovery that cannot be understood from controls alone

## Review test

For every screen:
1. Remove all helper prose.
2. Keep only labels, values, states, prices and action names.
3. Ask whether the screen is still obvious.

If not, redesign the interaction instead of adding prose.

## Supersession note

The previous Stage 1 Active Order three-layer pattern
(Eyebrow + Title + Detail)
is no longer the default Customer UX pattern.

Active Order should prefer:
- state
- ETA / pickup information when available
- one required action if applicable

Detailed text appears only for exception/recovery states.
