# Customer Stage 1 — Content + Asset Plan R3

WORK_ID: MFK-CUSTOMER-UI1-HOME-R1
STATUS: Asset production starts from measured skeleton
RULE: image assets and runtime copy are separate. Text is never baked into generated art.

## 1. Active Order module

The Stage 1 Active Order card now has:
- ACTIVE_ORDER_IP_SLOT
- runtime eyebrow
- runtime title
- runtime detail
- runtime item summary
- runtime display code / ETA

Measured slot:
- 360 viewport: 80×80 CSS px
- 390 viewport: 88×88 CSS px
- 412 viewport: 88×88 CSS px

Master production canvas:
- 384×384 px transparent WebP
- same canvas and anchor for every pose
- no text, Logo, price, order number or fake product data inside the image

### Canonical stage → copy → visual pose

| Canonical stage | Eyebrow | Title | Detail | Asset key |
|---|---|---|---|---|
| RECEIVED | 訂單已收到 | 店舖收到喇 | 我哋而家確認緊，最新結果會喺呢度更新。 | WAITING |
| ACCEPTED | 店舖已接單 | 今餐已經排入製作 | 我哋會照住最新預計時間準備。 | ACCEPTED |
| PREPARING | 製作中 | 你嘅一餐，準備緊。 | 好好食飯，等多一陣就得。 | PREPARING |
| DELAYED | 稍有延誤 | 我哋需要多少少時間。 | 最新預計時間會跟店舖正式更新。 | DELAYED |
| READY | 可以取餐 | 好喇，可以過嚟拎喇。 | 到店後請按正式取餐資料交收。 | READY |
| ARRIVED | 已到店 | 差最後一步就拎得。 | 等店員核對今次取餐資料。 | PICKUP |
| VERIFIED / PICKUP_VERIFICATION | 取餐核對中 | 資料核對緊。 | 核對完成後先正式交餐。 | PICKUP |
| PICKUP_EXCEPTION | 需要幫手 | 呢張單要店員幫你確認。 | 問題處理好之前，唔會當成已完成。 | ATTENTION |
| HANDED_OVER | 已交收 | 餐點已經交畀你。 | 多謝等候，記得好好食飯。 | COMPLETE |
| COMPLETED | 已完成 | 今餐完成喇。 | 下次返嚟，可以再由熟悉味道開始。 | COMPLETE |
| REJECTED | 未能接單 | 今次店舖未能接受訂單。 | 請查看正式原因，再決定下一步。 | ATTENTION |
| CANCELED | 訂單已取消 | 今次訂單已停止。 | 如有退款或後續安排，以正式記錄為準。 | ATTENTION |
| UNKNOWN | 正在確認 | 最新結果仲確認緊。 | 暫時唔會將未確認結果當成成功。 | UNKNOWN |

Copy rule:
- exact canonical stage drives copy;
- ETA / display code / item summary remain canonical runtime data;
- no visual asset may invent a state;
- UNKNOWN remains explicit;
- Ready never equals Completed.

## 2. Active Order visual pose family

To avoid one image per exact state, exact states share a small controlled pose family.

### WAITING
Use for RECEIVED.
- friendly male/female IP
- holding a small blank ticket / looking attentive
- calm, waiting expression
- no text inside ticket

### ACCEPTED
Use for ACCEPTED.
- cheerful acknowledgement pose
- small thumbs-up / order accepted gesture
- no food yet

### PREPARING
Use for PREPARING.
- character with apron / preparing gesture
- may hold a neutral bowl or utensil silhouette only if it does not imply a specific real product
- preferred first production asset

### DELAYED
Use for DELAYED.
- apologetic but calm
- small clock gesture allowed
- no panic / red-alert expression

### READY
Use for READY.
- character presenting a takeaway bag / meal tray
- bag must be generic, no fake Logo/text
- warm positive expression

### PICKUP
Use for ARRIVED / VERIFIED / PICKUP_VERIFICATION.
- character gesturing “this way” / handoff readiness
- no QR / code printed into art

### ATTENTION
Use for PICKUP_EXCEPTION / REJECTED / CANCELED.
- calm assistance pose
- no alarming error graphic
- copy carries the exact reason semantics

### COMPLETE
Use for HANDED_OVER / COMPLETED.
- happy thank-you / small heart or wave
- no loyalty promise baked into art

### UNKNOWN
Use for UNKNOWN.
- neutral checking / magnifier or gentle loading cue
- not “success” and not “failed”

## 3. Product card rules

Top 6 and Frequent Preview are data-driven.

Visual:
- product image = Admin/runtime product media only
- missing product image = neutral brand placeholder
- do not generate a fake food photo and treat it as product truth

Copy:
- recommendation reason = existing `item.reasonLabel`
- product name = existing `product.name`
- price = existing `product.displayPriceLabel`
- optional future short description may use existing product description only
- UI must not invent taste claims, ingredients, health claims or price

## 4. Hero copy rules

Hero artwork remains split from copy.

Image layers:
- HERO_BG
- HERO_IP
- HERO_FOOD

HTML copy:
- eyebrow
- headline
- CTA

No generated Hero asset contains wording.

Current default brand copy:
- Eyebrow: 磨飯日常
- Headline: 好好吃飯，日子慢慢有味。
- CTA: 睇睇今日餐牌 →

Closed / loading states may change CTA text through runtime UI, not through the image.

## 5. Quick-entry copy

Fixed canonical labels:
- 記憶券
- 常購清單
- 期間限定

Icons are separate SVG assets.
No wording inside icon artwork.

## 6. Asset production order

One-by-one only:

1. ACTIVE_ORDER_IP_PREPARING_MALE
2. ACTIVE_ORDER_IP_PREPARING_FEMALE
3. ACTIVE_ORDER_IP_READY_MALE
4. ACTIVE_ORDER_IP_READY_FEMALE
5. remaining Active Order pose family
6. HERO_BG
7. HERO_IP male
8. HERO_IP female
9. HERO_FOOD
10. quick-entry icons
11. remaining small icons

Each asset must be reviewed in its own slot before moving to the next family.

## 7. First asset specification

Asset ID:
ACTIVE_ORDER_IP_PREPARING_MALE_R3

Canvas:
- 384×384 px
- transparent WebP

Character:
- official male MFK IP identity
- preserve face, blue hair shape, round glasses, brand proportions and clothing identity
- waist-up / compact square composition
- preparing-food gesture
- warm cheerful expression
- must read clearly at 88×88 CSS px

Forbidden:
- background
- text
- Logo
- price
- order number
- real product name
- fake UI
- full-page card

Target path after approval:
`v2customer/public/brand/stage1/order/stage1-order-preparing-male-r3.webp`

## 8. Gate

Next step is to generate only ACTIVE_ORDER_IP_PREPARING_MALE_R3 and review it at 88×88 / 80×80.
Do not generate the other assets in the same operation.
