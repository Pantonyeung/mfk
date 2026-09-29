# MFK Customer UI FINAL Source Fidelity R1

日期：2026-09-29
WORK_ID：MFK-CUSTOMER-FINAL-SOURCE-FIDELITY-R1
BASE_MAIN：d38603e12c582e6522f015a688876e82b6248524
SOURCE：MFK_Customer_UI_完整設計包_2026-09-26

UI0 LAUNCH：SOURCE_FAITHFUL，保留。
UI1 HOME：SOURCE_FAITHFUL，保留。
UI2 BROWSE：SOURCE_FAITHFUL，保留。
UI3 CONFIGURE：SOURCE_FAITHFUL，保留。
UI4 CART_CHECKOUT：SOURCE_FAITHFUL，保留。
UI5 SUBMIT_WAIT：FIXED，空白品牌圖槽改用來源包正式女 IP。
UI6 STORE_FULFILLMENT：FIXED，空白品牌圖槽改用來源包正式男 IP。
UI7 PICKUP_COMPLETE：FIXED，按男女版本使用來源包正式 IP。
UI8 HISTORY_REORDER：FIXED，按男女版本使用來源包正式 IP。
UI9 MEMBER_MEMORY：FIXED，空白品牌圖槽改用來源包正式女 IP。
UI10 ACCOUNT_SUPPORT：FIXED，帳戶男 IP／支援女 IP。

ASSET_GAP：
來源包有正式 Logo、男／女 IP 原始素材、產品素材及 Stage 正式效果圖，但 UI5–UI10 未提供逐 Stage 獨立切出的動作／裝飾 asset 檔。標記 EXACT_ASSET_MISSING；禁止自行重畫。現版本使用正式來源 IP，無空白 slot、無新畫 generic mascot。

CAPABILITY_ENTRY_GAP：
本輪未證明有新缺口。既有入口涵蓋首頁、點單、商品客製、記憶罐、結帳、提交、訂單追蹤、取餐、歷史再來一單、會員、帳戶支援。

NO_TOUCH：
Pricing / Cart / Quote / Order / Payment / Submit / Idempotency / Store Kernel / Fulfillment authority 全部不變。

SCREENSHOT_EVIDENCE：
沿用 v2customer/evidence/r2 現有 01–18；390 baseline；CSS 保留 <=370 minimum；UI10 明確有 <=390 及 <=360/780。

REMAINING：
只剩來源包未提供獨立輸出的 Stage-specific artwork / final nav icon assets。收到正式 asset 後只做 asset-only replacement。
