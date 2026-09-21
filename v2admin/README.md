# MFK Admin — Clean V2 Donor Extraction

呢個目錄係獨立 MFK Admin control-plane surface。

Donor：
- repo: Pantonyeung/Morefun-v2
- app: apps/admin-web
- donor snapshot: cd63d7598df42edf8c43aaaf9f19e34c21932c48

原則：
1. 舊 V2 Admin 只提供完整功能樹、UI / workflow / IA 參考。
2. 舊 DB、舊 API、舊 writer、舊 authority 預設全部停用。
3. 所有 domain 由 MFK 重新指定 truth owner。
4. Owner 決策 → Admin Draft → Validate → Publish → Active Revision → SMT Local LKG → SMT 執行。
5. Admin 不做 Order / Payment / physical print execution。
6. SMT 不做 Product / Modifier / Combo authoring。

目前階段：
- COMPLETE CAPABILITY INVENTORY：已抽
- INDEPENDENT ADMIN SHELL：已抽
- LEGACY MUTATION：停用
- DOMAIN ADAPTERS：逐域接駁
