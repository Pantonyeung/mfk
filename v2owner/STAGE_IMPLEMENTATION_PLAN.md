# MFK Owner UI｜11-Stage Implementation Plan

STATUS: OWNER LOCKED / NO MERGE WITHOUT OWNER AUTHORIZATION

BASE_MAIN: 01ace1fd6ab057cb116781503bb64ca5e77972d3

## Merge Rule
任何 Stage：
- 只可喺獨立 work branch 製作。
- 禁止直接修改 main。
- 禁止自動 merge。
- Stage 完成後停低，交 Owner → 總指揮驗收。
- 只有 Owner 明確授權先可以 merge。

## 11 Stages
1. Stage01｜Today / Home
2. Stage02｜Action Queue
3. Stage03｜Order Oversight
4. Stage04｜Channel Health + Bounded Control
5. Stage05｜Sellability
6. Stage06｜Staff Overview
7. Stage07｜Device / Printer Health
8. Stage08｜Fixed Reports
9. Stage09｜Manager Log / Checklist / Handoff
10. Stage10｜Activity / Audit
11. Stage11｜More Hub

Global shell、Freshness、Offline Read-only、Permission state 係共用基礎，唔另計 Stage。

## Asset Rule
所有新圖片類資產：
- AI generated only。
- 商品圖／產品相片位置保持 EMPTY / PLACEHOLDER，不自行生成假產品照。
- Icon / animation / announcement / ad visual 必須 AI generated。
- AI asset 未完成前，UI 用文字或明確 AI_ASSET_PENDING placeholder。
- 禁止 stock、網上抄圖、第三方 icon pack 直接落正式 UI。

## Authority Rule
Owner App = WATCH + ALERT + REVIEW + BOUNDED ACT。
禁止第二 Order / Pricing / Payment / Print / Auth / Sync authority。
