# MFK SMT Dining Full Chain R6｜大刀整合｜2026-09-25

## STATUS
IMPLEMENTED / SOURCE REVIEWED / CI NOT YET PROVEN / DRAFT / UNMERGED

## Owner-locked flow
點單
→ 掛入堂食枱
→ SAME Formal Order
→ 自動首次完整打印
→ 堂食持續操作
→ 分項／分次付款
→ 每次付款收據
→ 只有 CASH payment receipt 開 Drawer
→ 堂食專用重印

## 已完成核心
1. Admin Table Registry：名稱、排序、停用。
2. 掛枱即正式落單；無第二個落廚按鈕。
3. Dining Hold ↔ Formal Order durable identity。
4. 首次打印：枱單 / 製作單 / 打包單 / Label。
5. 枱單係未付款核對單，明確唔代表付款完成。
6. 重印逐 job：枱單 / 製作單 / 打包單 / Label。
7. 所有重印 drawer=false。
8. split payment history 保留原明細。
9. Formal Order current tender：單一 tender 或 COMBO projection。
10. 每次付款獨立付款收據；唔重播 production set。
11. CASH payment receipt 才 kickDrawer=true。
12. Table transfer：SAME Order、更新 table label、零首次打印 replay。
13. Custom Admin table name 在堂食詳情／歷史顯示。
14. restart / duplicate / stale / storage-failure / drawer deterministic contracts 持續保留。

## 仍未宣稱完成
- CI actual run
- physical printer real-device proof
- cross-device / multi-tab transaction serialization
- 真 Customer payment evidence E2E（另一支線）

## DO NOT
- 不建立第二 Order engine
- 不建立第二 Payment engine
- 不將枱單當付款收據
- 不因 reprint / transfer / reopen 開 Drawer
- 不 merge / deploy 未驗證 candidate

## CURRENT
Branch: work/MFK/SMT-DINING-PRODUCTION-ADMISSION-R6
PR: #306 Draft
Head: 7904252a2a1c95e11c13de9659ea01a317c78227
Base: R5 handoff a71af79997856ab0b23e92fcb0598d9ae49346ae
