# 04｜Customer Commercial and Release Freshness

## P0 Rule

Customer 唔接受：
畫面 $48 -> Checkout 先話 $52。

目標：
What You See Is What You Can Pay。

## Commercial Freshness Fence

Customer 可交易前必須持有 Server 發出嘅 current Customer HEAD confirmation：

- customerHeadSeq
- projectionHash
- confirmedAt
- freshnessToken
- expiresAt

Freshness token：
- 跟 tiny HEAD 一齊取得，唔需要每件 Product 再打 Quote request
- bound to store + portSeq + projectionHash + expiry
- token TTL / carry-forward window 係 business policy，未喺 R1寫死

## UI

Stable content：
圖片、名稱、描述可由 local cache即時 render。

Commercial content：
Price、sellability、Add-to-cart 只有喺 current/unexpired freshness fence 下先係正式可交易 state。

Safari / BFCache 一個月後恢復：
- page structure 可即時出
- commercial fence視為需要重新確認
- tiny HEAD check
- same seq -> 即時 unlock
- behind -> delta/checkpoint catch-up
- unlock current commercial UI

禁止全屏等整份 Catalog reload。

## Transaction Submit

Customer Submit帶：
- customerPortSeq
- freshnessToken
- Product / Option / Combo IDs
- material commercial facts used by UI
- submissionId

Store Kernel：
1. verify freshness token
2. verify material facts existed in server projection history at that seq
3. verify transaction-time legality，例如 runtime availability
4. commit or fail-closed

Browser 自己改 $52 -> $1 必須失敗，因為 Server history無嗰個 fact。

## Admin Price Change Race

新 Price Delta即時出。

已經有有效 Server freshness fence，而且 UI 真係合法顯示過舊價嘅 transaction，應由 Owner-approved bounded commercial policy處理，避免 Checkout 靜默改價。

token TTL / carry-forward window 需要獨立 Owner Lock。

## Client Release Freshness

之前 Safari P0證明：
Release number一樣，唔代表實際 Loaded HTML/JS一定一樣。

因此 Code Release 同 Business Data必須分開驗：

### Client Code
- HTML / release head：must-revalidate / no-store
- compiled JS/CSS：content-hashed immutable
- bundle內嵌 sourceSha/buildTime
- serving release endpoint返回 expected sourceSha/buildTime
- mismatch -> cache-busting reload
- legacy Service Worker / CacheStorage要有 migration gate

### Business Data
- sync HEAD：tiny + fresh
- Checkpoint：content-addressed immutable，可 aggressive cache
- Delta segment：content-addressed immutable，可 aggressive cache
- HEAD只引用 hash-addressed object

安全同速度唔衝突。

Release Label != Loaded Client Proof。
要比較 actual bundle identity。
