# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: 2026-09-22 12:58 Asia/Hong_Kong
System: MFK ONLY

## 0. Mandatory read order

1. COMMANDER_CURRENT.md
2. #22 latest controlling comment
3. docs/navigation/MFK_航海圖_V1.19_Round020_2026-09-22.txt
4. HANDOFF_CURRENT.md
5. active issue(s)

## 1. One-line current reality

Admin complete-product R1 has been implemented, tested, clean-landed and deployed live.

Current state:

`MFK_ADMIN_PRODUCT_COMPLETE_DEPLOYED_OWNER_REVIEW_PENDING`

Active P0:
#45

Admin→SMT automatic connection:
#44 HOLD

SMT OTA:
#40 HOLD

## 2. Owner product-completeness lock

Admin is an operating product, not a demo shell.

Permanent product standard:
- no empty formal routes
- no demo-only data presented as production truth
- no session-only disposable operator settings
- operator-facing UI uses Traditional Chinese
- settings survive browser refresh
- high-risk Admin changes retain audit history
- no fake success / fake metrics / fake health
- old Morefun-v2 may be used only as donor/oracle, never as current authority

Cross-system connection must stay HOLD until Owner accepts the Admin product itself.

## 3. Exact work completed

WORK_ID:
`MFK-ADMIN-PRODUCT-COMPLETION-R1`

Issue:
#45

Branch:
`work/MFK/ADMIN-PRODUCT-COMPLETION-R1`

Base:
`f0882774a2e7372af32fa7f77d233fe80cad5003`

Verified source:
`c03a7a547e8ec6d1485d48053ae0a80e033c2d99`

Source verification:
`35688504352`
SUCCESS

Temporary verification workflow removed after verification.

Clean landing main product commit:
`d22b9bf1bfc059f1d0227cb758027b71c87af111`

Deploy trigger:
`13987b48181f7423eed01144eae76ebdbfb9dd4a`

Live deploy:
`35688802387`
SUCCESS

Deploy proof:
- npm install SUCCESS
- npm test SUCCESS
- npm run build SUCCESS
- Deploy mfk-admin SUCCESS

Canonical Admin:
`https://admin.morefunos.com`

## 4. Admin product capability now present

### Daily / governance
- 今日 / readiness
- pending changes
- real action queue
- immutable config release history
- restore historical release as new draft
- audit

### Menu
- Product detail
- Category
- Product Code
- SKU
- description
- image reference
- tags
- active / inactive
- ordering
- base price
- Product takeaway +$1 flag
- other positive / negative takeaway adjustment
- Modifier Group
- Option
- required / optional
- single / multi
- min / max
- positive / negative option price adjustment
- Combo identity
- Combo child relationships
- Combo section min / max
- Combo section price adjustment

### Print
- one Logical Printer Registry
- Receipt / Production / Packing / Label destinations
- print template configuration
- Product Receipt / Production / Packing / Label flags
- dine-in print flag
- one or many Label logical destinations

Physical printer IP / USB remains SMT physical responsibility later.

### Store / people
- store identity
- weekly business hours
- dine-in / takeaway service modes
- operational timings
- Pending Order reminder policy
- Business Day cutoff
- post-close correction role policy
- cash / close record
- Quick Reasons
- Staff / Role / PIN / Scope
- Admin login config

### Channel / reporting
- channel policy
- store binding
- product mapping
- mapping failure surface
- settlement / reconciliation surface
- Sales report
- Product report
- Channel report
- Refund report
- Operations report
- export governance

### System / P1-lite
- device desired-vs-observed surface
- OTA approval/readback governance
- diagnostics
- integrations governance
- effective settings
- Inventory Lite
- Customer 360
- Loyalty
- Coupons
- Announcements
- presentation settings
- RFM read surface

## 5. Current exact limitations

Admin is product-complete as an isolated Admin application, but cross-system read/write connections remain intentionally HOLD.

Therefore:
- order/report/provider/device read surfaces do not invent data when source connection is absent
- no SMT menu delivery is active
- no provider command is active
- no automatic Admin→SMT publish is active
- no manual A2 file shuttle is admitted as production design

These are connection states, not missing Admin UI responsibility.

## 6. Exact NEXT

ONE next action only:

Owner live Admin functional/visual walkthrough.

Start at:
`https://admin.morefunos.com`

Required walkthrough set:
1. 今日
2. 菜單 → 商品資料
3. 商品分類
4. 選項／加料
5. 價格管理
6. 套餐
7. 菜單／顯示排序
8. 待發布變更／版本
9. 打印中心
10. 打印模板中心
11. 商品／堂食打印規則
12. 門店設定
13. 營業日／交更
14. 快捷原因
15. 員工／權限
16. 平台管理 / 商品映射
17. 報表
18. 操作記錄
19. 系統狀態
20. 進階設定

Acceptance:
- no demo-shell route
- operator fields are editable where Admin owns config
- edits survive browser refresh
- no fake success / fake metrics
- no engineering transport workflow exposed as normal operation
- Owner accepts Admin product responsibility

Only after Owner acceptance:
BANK `MFK_ADMIN_PRODUCT_COMPLETE_GREEN`

Then and only then Owner may decide whether to resume #44.

## 7. STOP / HOLD

#44 Admin→SMT automatic publish:
HOLD

#40 SMT OTA:
HOLD

Keeta live:
NOT AUTHORIZED

SMM / Customer / Owner live connection:
NOT AUTHORIZED

Manual A2 JSON shuttle:
SUPERSEDED / NOT PRODUCTION

## 8. Permanent architecture rules

- Admin = control plane
- SMT = execution client + Local LKG
- Business Day never blocks local transaction
- Quick Reason optional / non-blocking
- no second Pricing / Print / Auth / Sync authority
- no high-frequency polling
- cloud work event-driven first
- NO TARGET READBACK = NOT GREEN
- UNKNOWN != FAILED
