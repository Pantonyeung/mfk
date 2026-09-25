# SMT Dining Control Reconcile R5｜2026-09-25

## 狀態
DINING_CONTROL_RECONCILE_R5_GREEN / OWNER_ACCEPTANCE_PENDING

## 背景
R4 已鎖「暫存／堂食」單一入口，但 current MFK main 之後新增：
- Admin-published Dining Table Registry
- current Order Source Lane semantics
- Dining Holds 不應出現在 active formal Order board

本輪只做 reconcile，唔重做 R1–R4。

## 實作
1. Admin Table Registry consumption
- readSmtStoreSettings() 新增 diningTables[]
- 只讀 active table
- 依 sortOrder 排序
- stable id + published display name

2. Cart「暫存／堂食」Modal
- hold selector 唔再 hard-code 1–9
- 直接用 storeSettings.diningTables
- legacy no-published-table 時保留 1–9 fallback
- R4 mindset 不變：
  any dine-in → dining first
  all takeaway → hold first
  manual switch 永遠保留

3. Dining Runtime
- readDining() 使用同一 Admin table registry
- occupied / available 狀態沿 stable table id
- 顯示 Admin-published name

4. Order Source Lanes
- direct: 現場 / SMM / 電話 / WhatsApp
- owned: 磨飯 App / 自家 App / Customer
- platform: Keeta / Foodpanda / other external

5. Dining authority boundary
- dine-in-only legacy formal Orders 不顯示喺 active formal Order board
- Dining truth 保持專用 Dining Hold/table/waiting surface
- 本輪無 formal Dining Order link

## TDD
RED:
- run 36147265423 / job 108111415904
- 新 4 項 contract 全部失敗：
  diningTables undefined
  sourceLane 未 export/未有 current semantics
  App 仍 hard-code 9 tables
  active Order board 未排除 dine-in-only legacy Orders

中途 regression:
- Owner FINAL 舊 test 鎖死舊 sourceLane 字串
- 更新為 current #22 semantics，無降低驗收條件

GREEN:
- run 36147577726 / job 108112467414
- 40 / 40 Test Files PASS
- 196 / 196 Tests PASS
- Build PASS

## Exact candidate
5fc6581431df15927a613b06a6e41090b621a88b

## Current main fresh-read at finish
5bcec0fda2776a1390a16fb8cf016955a1156e32

## 邊界
- PR #305 draft / unmerged
- Main 未合併
- Production 未部署
- Admin deployment existing R2 bucket blocker 不屬本輪修復
- Dining print / production admission / drawer 仍未完成
