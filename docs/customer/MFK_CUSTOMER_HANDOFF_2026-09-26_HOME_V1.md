# MFK Customer Handoff｜2026-09-26｜Home Milestone

## Current
PWA / Web，Mobile First。
五導航：首頁 / 點單 / 記憶罐 / 訂單 / 會員。
記憶罐 = Cart，固定中央。

## Newly Locked
- 固定頂部：Logo + 營業狀態
- 固定底部：五導航
- 中間垂直滾動
- 大圖 Hero / 廣告 / 產品推薦
- 公告 / 售罄 / 推薦
- Admin 管理 Top 6 Pool
- 三快捷入口：記憶券 / 常購清單 / 第三入口待定
- 頂部 Pull-to-refresh
- 底部額外 overscroll threshold 觸發彩蛋

## Product Recommendation Banked
- Top 6 用 session-stable rotation
- 售罄自動剔除
- 第三入口優先研究「磨飯日曆」
- 「用力拉」用 distance / velocity / release threshold，不能依賴壓力感應

## Open Decisions
- Hero 單張 / 多張
- 是否自動輪播
- Top 6 卡片版式
- 第三入口
- 彩蛋內容
- PWA refresh gesture

## Milestone
CUSTOMER_HOME_STRUCTURE_V1_LOCKED