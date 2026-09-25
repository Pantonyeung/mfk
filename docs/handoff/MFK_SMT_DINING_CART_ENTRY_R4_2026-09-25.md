# SMT 暫存／堂食單一入口 R4｜2026-09-25

## 狀態
DINING_CART_ENTRY_R4_RENDERED_GREEN / OWNER_ACCEPTANCE_PENDING

## Owner 已鎖 mindset
- 「暫存」同「堂食」係同一個入口入面兩個 concept。
- 購物車有任何堂食 line（包括 mixed 堂食＋外賣）：
  - 撳「暫存／堂食」後，Modal 預設直接開堂食頁。
  - 仍然可以手動切返「暫存」，例如做到一半想 Hold。
- 購物車全部外賣：
  - 同一個「暫存／堂食」入口預設開「暫存」。
  - 仍然可以手動切去「堂食」。
- 清除訂單縮成低干擾垃圾桶 icon，唔同主要操作爭注意力。
- 呢個改動只改入口／預設頁，不改 line-level 堂／外 truth、不拆 Order、不改 Payment。

## 實作
- v2local/src/features/ordering/OrderingWorkspace.tsx
  - 大按鈕：暫存／堂食
  - 清除訂單：細垃圾桶 icon
- v2local/src/features/ordering/OrderingCenterWorkspaces.tsx
  - 新增 initialHoldModeForLines()
  - any dine-in => dining；all takeaway => cart
  - Modal 保留「暫存」「堂食」兩個 tab，可隨時互切
  - 暫存頁有「確認暫存」
- v2local/src/App.tsx
  - 現有 HoldCartWorkspace 接入 cart-derived initialMode
- CSS：主次操作層級調整

## TDD / 驗證
RED:
- run 36142397982：新 R4 contract 先失敗。

中途 regression root cause:
- 舊 donor tests 鎖死「取消」「掛入堂食」舊 copy。
- 呢兩個 expectation 與 Owner 新明確要求衝突，更新為「清除訂單」及雙 mode tab，無產品 semantic rollback。

GREEN:
- run 36143162885 / job 108097666843
- 39 / 39 Test Files PASS
- 192 / 192 Tests PASS
- Build PASS
- Rendered Playwright：9 / 9 PASS
  - 全外賣預設暫存
  - 手動切堂食成功
  - 九宮格 9 位＋輪候可見
  - Mixed Cart 預設堂食
  - Mixed Cart 可手動切返暫存
  - 確認暫存可見
  - console/page error = 0
- Artifact 10868840411
- SHA256 c8409ff24fec8ef4f1904074d7d3b429a4f75128972ce5e00ea7c5c494e0f144

## Exact tested candidate
175749edb29a2079651c659fea80762f725b51f3

## Current main at final fresh-read
ba50a107505a9b4583bad5b36b7c337abcc54373

## 邊界
- PR #301 draft / unmerged。
- Main 未合併。
- Production 未部署。
- 呢刀唔處理 formal Dining Order link / Dining print / drawer；沿用 R3 邊界。
