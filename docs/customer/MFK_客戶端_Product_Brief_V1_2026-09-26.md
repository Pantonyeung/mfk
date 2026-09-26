# MFK 客戶端 Product Brief V1
版本：V1
日期：2026-09-26
狀態：PRODUCT CANONICAL
產品：磨飯 Customer PWA / Web

## 1. 產品一句話
一個為磨飯到店自取而設的 Mobile First 客戶端：
由品牌門面開始，快速搵到想食嘅、完成客製、落一張可靠訂單、清楚知道店舖有冇接到，再將每一次幫襯變成下一次更快、更熟悉的體驗。

## 2. 產品目標
1. 品牌展示：一開頁已感受到磨飯，不是一個普通點餐表格。
2. 快速點餐：大圖、分類、Required、Combo、Recommendation、Cart 縮短選購時間。
3. 可靠落單：分清「已送到 SMT」與「店舖已接單」，弱網不製造重覆 Order。
4. 長期記憶：Favorite、常用訂單、Preference、Memory Seeds、Coupon、Memory Badges，令第二次比第一次更快。

## 3. 主要使用者
新客：
- 不要求先註冊
- 第一次交易只要稱呼 + 電話
- 背後建立 Ghost / Unactivated Customer Profile

回頭客：
- 用 History、Reorder、常用訂單、Preference、Recommendation 加快點餐

正式會員：
- Phone + Password
- 可管理 Profile / Preferences / Rewards
- 會員頁是「磨飯記得你」的中心

## 4. 核心體驗原則
快：少步、少重填、少重揀。
清楚：店舖開唔開、Required 仲差咩、幾錢、送到未、接單未、幾時可取。
有記憶：Favorite、常用訂單、偏好、Seeds、Coupon、Badges。
不偷步：價格、可售、Required、Coupon、Payment、Formal Order 在正確 Authority 確認。

## 5. 產品導航
固定五導航：
首頁｜點單｜記憶罐｜訂單｜會員

記憶罐固定中央。

## 6. 啟動頁
- Logo 組成動畫
- 磨飯 IP / Mascot
- 溫暖生活、日系極簡、不幼稚
- 動畫期間背景準備首頁資料
- Returning Session 比 First Visit 更快
- Reduced Motion 有簡化版

最後只出兩個 CTA：
- 進入主頁
- 進入會員頁

不設直接點餐。
Motion Storyboard 另行設計。

## 7. 首頁
首頁 = Storefront，不是功能表。

主要區塊：
1. Fixed Header：Logo + 營業狀態
2. Large Hero / Brand / Promotion
3. Announcement
4. Top 6：Admin Pool、Session-stable、Sold Out Exclusion
5. 三快捷：記憶券 / 常購清單 / 期間限定
6. Bottom Nav

關店仍可 Browse / Build Cart，只在 Commit 阻正式下單。

## 8. 點單
每個 Category：
1 Featured Large Card + 其餘 Small Cards。

Product Card：
- 圖片 / Name / Price / Tags / Sold Out
- 右上 Favorite Heart
- 圖片可用 Shared-element / Melt Expansion 感覺進 Detail

## 9. Product Detail
Hero
→ Combo Upgrade
→ Required
→ Optional
→ Qty
→ Recommendation
→ Summary
→ Add to 記憶罐

Required 未完成不可 Add。
飯團 A/B/C/D 來自 Catalog Metadata。
Combo Upgrade 保留原 Product、有效選項，再補缺少 Required、Live Re-quote。

## 10. Recommendation
目標是幫 Customer 完成一餐，不是無限 Upsell。

V1：
- Rules
- Semantic Tags
- Co-purchase
- Session
- Member History
- Context

Recommendation 不擁有 Pricing / Sellability / Order Truth；失效不阻 Checkout。

## 11. 記憶罐
4 Steps：
1 商品
2 聯絡與取餐
3 付款
4 提交

Cart：
- Edit
- +/- Qty
- Remove
- Line-level Repair

首次 Contact：
- 稱呼
- 電話

Pickup Code = 電話最後四位。

## 12. Payment
Cash / Electronic。

Electronic：
- Admin 設 QR
- Customer 付款
- Upload Screenshot

UI 用詞「已提交付款憑證」，不寫「已確認付款」。
最後由 SMT 待處理訂單人手核對。

## 13. Coupon
Coupon 可來自 Seed Reward / Campaign / Anniversary / 熟客活動。
Checkout 可按 Admin Rule 自動套用 Eligible Coupon。
Customer 清楚見到 Coupon / Discount / Expiry / Current Total。

Formal Transaction 成功先 Redeem。

## 14. Submit
最多 3 次送 SMT。

成功：
→ 訂單已成功送達
→ 等待店舖確認

三次失敗：
→ 鎖死原 Submit
→ WhatsApp 人工落單

不做 Background Retry / Reconnect Auto-submit / 第二 Queue / 第二 Order Engine。

## 15. WhatsApp
WhatsApp 是最後救援，不是第二系統。

一般 WhatsApp Order：
- 不使用 Coupon
- Coupon 留下次

如果已按 Coupon 價完成 Electronic Payment才 fallback：
- 保留已付款 Quote
- Coupon 暫時 Hold
- Staff 後補 SMT / Admin Order 時 Redeem / Release

## 16. Waiting Store Confirmation
成功送到 SMT 後：
「訂單已成功送達」
→「等待店舖確認」

畫面有：
- 動畫
- 已等待時間
- Pickup Code
- Order Summary
- 可退出 / 查看詳情

狀態更新：
Realtime Doorbell → Canonical Readback
Fallback = Read-only Polling
Refresh / Reminder 秒數全部 Admin Config。

## 17. 訂單頁
Filter：
進行中｜已完成｜全部

Order Card：
Status / Time / Items / Total / Pickup Code / Display Number / Detail / 再來一單 / 常用訂單。

## 18. Reorder / 常購
再來一單：
Past Order → Copy Intent → New Cart → Current Validation → Repair → Final Review → New Order。

首頁「常購清單」：
- 喜愛商品
- 常用訂單

Favorite Product ≠ 常用訂單。

## 19. 會員：先交易，再建立關係
第一次：
稱呼 + 電話 → Ghost / Unactivated Member。

不做 SMS OTP / Email OTP / Social Login。

第 2 / 3 次或適當時機再引導：
「讓磨飯更容易記得你的喜好」
→ 設定 Password。

正式 Login：
Phone + Password。

## 20. Account Recovery
換手機 / 忘記密碼 / 換電話：
→ WhatsApp 聯絡
→ Admin 人工核對舊電話、姓名、DOB（如有）、最近 Order 等
→ 保留原 Customer ID
→ 改 Phone / Reset Credential
→ 保留 Seeds / Coupon / History / Favorite / Preference
→ 寫 Audit

可顯示處理約 1–2 個工作日。

Reset 使用每次唯一的一次性 Temporary Password，首次 Login 強制改 Password；不使用全店共用 Reset Password。

## 21. Memory Seeds
Seeds = Lifetime Accumulation，不是 Wallet。

- Reward Use 不扣
- 不歸零
- 不在 Order Complete 即時派

流程：
Business Day Close
→ Eligible Completed Orders
→ Append Seeds
→ Evaluate Milestone
→ Issue Reward

## 22. Reward / Campaign
Admin 可設定：
- 所有人週年券
- 幫襯 N 次熟客券
- Seed Milestone
- 指定 Grade / Segment Promotion

Admin 設 Audience / Rule / Benefit / Start / Expiry / Usage。

## 23. Preference
例如：不要青瓜 / 少飯 / 常飲奶茶。

有 Compatible Formal Option：
→ 自動預選。

無：
→ 不偷偷改 Product，只提示未能套用。

Preference 是 Default，不是強制規則。
Allergy 與普通偏好分開。

## 24. 記憶分章
例如：
- 奶茶章
- 飯團章
- 飯麵章
- 限定探索章
- 常客章

預設是品牌 / 收藏 / 成就體驗，不直接等於 Discount。
要派 Reward 必須由 Admin Rule 決定。

## 25. PWA / Notification
會員頁最後引導：
加入主畫面 → 開啟訂單通知。

高價值通知：
- 店舖已接單
- Delay / ETA
- 可取餐
- Reject / Cancel

Reward / Marketing 通知按 Consent。

## 26. 視覺方向
- 日系極簡
- 溫暖生活
- 專業
- 大圖
- 清楚層級
- 不小朋友風
- IP 有生命感但不過度卡通

Interaction 可用 Shared-element、Heart Burst、Waiting Animation、Launch Logo / IP Motion。
所有動畫不可阻核心操作，Reduced Motion 有替代。

## 27. Admin 是營運控制面
營業、Hero、Top 6、Featured、Limited、Payment QR、Waiting Timing、Reminder Timing、Seed、Coupon、Campaign、Audience、Grade / Segment 等都應 Config。
Frontend 不應為營運變更反覆發新版。

## 28. V1 不做
- Scheduled Order
- SMS / Email Verification
- Social Login
- Wallet / Gift Card / Subscription
- Complex Loyalty Economy
- Advanced CRM
- AI-heavy Recommendation
- Allergy Safety Engine
- WhatsApp 自助 Coupon
- 第二 Pricing / Payment / Order Engine

## 29. 產品完成標準
Customer 可完整走完：
Launch
→ Home
→ Browse
→ Configure
→ Cart
→ Pay
→ Submit
→ Store Confirm
→ Prepare
→ Ready
→ Pickup
→ Complete
→ History
→ Reorder
→ Loyalty / Preference / Reward

任何 Refresh / Retry / Weak Network / WhatsApp Fallback / Reorder / Coupon / Member Recovery 都不破壞同一個正式交易真相。

## PRODUCT CANONICAL STATUS
MFK_CUSTOMER_PRODUCT_BRIEF_V1_LOCKED
FINAL_PRODUCT_GAP = 0
