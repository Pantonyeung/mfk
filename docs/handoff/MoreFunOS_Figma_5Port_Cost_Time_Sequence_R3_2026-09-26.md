# MoreFunOS｜Figma 五端口成本／工作量／先後次序 R3

日期：2026-09-26
狀態：PLANNING_LOCKED_FOR_OWNER_REVIEW

## 結論
- Starter 不足：MCP read quota 只有約 20/月。
- 最低可行：Professional + 1 個 Full Seat。
- 五端口不需要五個 Seat；Seat 按使用者，不按產品端口。
- 一個月 Professional Full 在規格已鎖、重用 Design System、限制反覆改版前提下，足夠完成五端口視覺規範；連同第一輪 UI 落地則屬可行但需要嚴格節奏。

## 工作量估算
Shared Visual Constitution / Design System：1.5–2 日
五端口 Canonical Screens：約 27–37 張
每端口：
- 複雜桌面端：1.5–3 日
- 流動端：1–1.5 日
Cross-port QA / Handoff：2–3 日
總 Figma 視覺工作：約 10–14 個工作日
第一輪 UI 實作：約 7–12 個工作日
合計：約 17–26 個工作日

## MCP 保守估算
Design System：100–150
五端口：450–650
QA / Handoff：150–250
總計：約 700–1050 次互動
如 20 個工作日攤分：約 35–53 次／日，低於 Professional Full 200 次／日 read limit。

## 最慳流程
1. 先在 Figma 外完成五個 Product Brief。
2. 每份 Brief 至少鎖：
   - 角色／目的
   - IA
   - Golden Path
   - 核心 States
   - Actions
   - Error / Empty / Loading / Offline
   - Acceptance
3. Figma 只做一次 Shared Visual Constitution + Design System。
4. 先做每端口低成本 Screen Skeleton，Owner 一次過確認 hierarchy。
5. 再以 Components / Tokens 做 High-Fidelity。
6. 不等五端口全部 High-Fidelity 才開發；每端口 Approval 後立即接 Code，驗證 Design System。
7. 實作後用 Figma 做 Visual Diff / QA，只修視覺，不重新討論交易語義。

## Figma 應用邊界
應用：
- Tokens
- Components
- Layout
- Key screens
- Prototype of critical interactions
- Visual QA

不應用：
- Order / Pricing / Payment / Print authority
- Backend state machine design
- 每個稀有 edge case 都畫成獨立 full screen
- 未鎖產品流程時反覆做 high fidelity

## Quota 節省規則
- 一個 phase 一次 screenshot，不逐小改截圖。
- 批量 mutation，避免一粒按鈕一個 call。
- 共用一套 library，禁止五端口各自造 Button / Card / Chip。
- 每端口最多 1–2 輪視覺大改。
- 功能／流程改動先回 Brief，唔直接在 Figma 猜。
