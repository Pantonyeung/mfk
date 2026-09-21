# MFK

磨飯新架構實作 repo。

Active products：

- `v2local/` — SMT 本地執行面
- `v2admin/` — MFK Admin 獨立控制面

## SMT｜v2local

以 MoreFun V2 SMT 嘅 1920×1080 UI 做基礎，重新接成本地 POS。

目前：
- 點餐
- Cart
- 現金結帳
- 本機 Order persistence
- 訂單
- 堂食
- 售罄
- 打印與設備
- Carrier 1.0.6 Native Print Bridge
- LAN / Sunmi print execution

SMT 原則：
- 只執行已發布規則
- local-first
- Order / Checkout / Payment / Print / Fulfillment execution 留喺 store execution authority
- 不成為 Product / Modifier / Combo authoring authority

## Admin｜v2admin

由舊 Morefun V2 `apps/admin-web` 乾淨抽出完整 Admin capability tree。

Donor 只提供：
- UI / Workflow / IA
- route / page / capability inventory

舊 authority 不繼承：
- legacy DB canonical truth：OFF
- legacy API authority：OFF
- legacy mutation writers：OFF

MFK 重新定義：
Owner Decision
→ Admin Draft
→ Validate
→ Publish
→ Active Config Revision
→ SMT Local LKG
→ SMT 執行

Admin 現時已保留完整 37 項 capability inventory；每項都有 MFK truth owner 同接駁狀態，之後逐 domain 由 `NEEDS_ADAPTER` 收斂到 current MFK authority。

原始研究入口：`REPORT.md`
