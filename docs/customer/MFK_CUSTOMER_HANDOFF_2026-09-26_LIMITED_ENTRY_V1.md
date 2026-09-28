# MFK Customer Handoff｜2026-09-26｜Limited Entry

## Decision
首頁第三快捷入口由「磨飯日曆」改為「期間限定」。

## Product Logic
固定導航名：期間限定
動態內容可寫：本週限定 / 今期限定飲品 / 季節限定 / 節日限定。

## Why
店舖屬定期更新，不保證每週更新，因此不把「本週」寫死在永久入口名稱。

## Boundary
Top 6 = rotating discovery/recommendation.
期間限定 = stable access to currently time-bounded products.

## Architecture
限定只是一個商品標記／供應期 projection。
不得建立第二 Product / Pricing / Sellability authority。

## Deferred
磨飯日曆不再佔首頁三快捷入口；日後有足夠內容再獨立評估。

## Milestone
CUSTOMER_HOME_LIMITED_ENTRY_V1_LOCKED
