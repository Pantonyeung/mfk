# MFK SMT Dining Production Admission R6｜2026-09-25

## 狀態
IMPLEMENTED / CI NOT YET PROVEN / DRAFT / UNMERGED

## Base
R5 handoff: a71af79997856ab0b23e92fcb0598d9ae49346ae

## Branch
work/MFK/SMT-DINING-PRODUCTION-ADMISSION-R6

## PR
#306

## 本輪只做第一條 seam
Dining Hold / Waiting Order
→ ONE formal Order identity
→ Production Admission
→ Production / Packing / Label dispatch

未做：
- 堂食枱單
- 付款後正式 Order tender convergence
- Drawer payment boundary
- Main merge
- Production deploy

## 實作
- LocalDiningHold 增加 formalOrderId / productionAdmittedAt。
- StoredOrder 增加 diningHoldId / production admission certainty。
- admitDiningProduction():
  - fresh-read durable Dining state
  - validate items / total
  - SAME Hold only one Formal Order
  - Formal Order + Dining link 同一個 localStorage durable write
  - source=堂食
  - paymentLabel=未結帳
  - fulfillment=進行中
  - stable checkoutSubmissionId=DINING-PRODUCTION:<holdId>
- Production dispatch 明確排除「顧客小票」。
- 因此 Production Admission 不會因 receipt kickDrawer 打開錢箱。
- 首次 Production Admission 有 attempted/state/summary；重複操作不重複首次 dispatch。
- UI 新增「正式落廚／出製作單」，成功後顯示正式單號與打印結果。

## Deterministic contracts
新增：
v2local/src/runtime/dining-production-admission-r6.test.ts

鎖：
1. Dining Hold ↔ Formal Order durable link。
2. repeated admission = same Order / no duplicate formal Order。
3. production admission excludes receipt / drawer。
4. restart 後 formal link 保留。

## 驗證狀態
GitHub connector 已完成 source mutation。
本輪新增 workflow file，但因 workflow 不存在於 PR base，GitHub 未自動起該新 proof workflow。
Container 無外網，不能用本地 clone 代跑。
因此目前不可宣稱 GREEN。

## 風險／下一刀
Formal Order 現時在 Production Admission 建立時 paymentLabel=未結帳。
Dining split payment 仍由既有 Dining payment history 擁有。
下一刀必須先定義「split tender → Formal Order current payment projection」如何收斂，禁止為方便而另建 Payment truth。

## DO NOT
- 不 merge main
- 不 deploy production
- 不重做 R1–R5
- 不將 Production Admission 當 Payment Commit
- 不在落廚時開 Drawer
