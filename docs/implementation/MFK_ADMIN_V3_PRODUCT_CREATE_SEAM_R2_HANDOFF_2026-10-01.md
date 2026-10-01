# MFK Admin V3｜Server-owned Product Create Seam R2｜Handoff

日期：2026-10-01  
狀態：LANDED TO MAIN / NO DEPLOY / NO OTA

## 背景

舊 PR #613 係基於 version-history / rollback 落地前嘅 main，之後同 `v2admin/worker.ts` 發生 collision，已唔適合直接 merge。

今輪採用 fresh-main bounded reapply，冇做 broad conflict merge。

## Landing

- Replacement PR：#617
- Merge SHA：`9deb3d6e69e5263ba9568d3d963da56a5bfdbb8e`
- Superseded PR：#613（已關閉，未 merge）
- Production route / hostname / deploy / OTA：NO TOUCH

## 已落地能力

1. `POST /api/admin-browser/draft/products?storeId=...`
2. 只接受完整 Product 必填資料：
   - name
   - categoryId
   - basePrice
3. Category 必須已存在。
4. Product Code 由 server authority 分配：
   - `PRD000001` sequence
   - 會掃現有 code
   - 另保留 durable monotonic counter
   - 已分配過嘅 code 即使 Product 後來由 Draft 消失都唔會重用
5. 新 Product 直接寫入同一份 Formal Server Draft。
6. 有 Draft 時必須帶 exact `expectedDraftRevision`。
7. Canonical base 必須 fingerprint + publishedAt 一致。
8. Browser 唔生成正式 Product Code。
9. 保留已落 main 嘅 version-history / rollback authority seam。

## Safety

Durable Object storage input gates 令同一 object 嘅 read-modify-write sequence 不會由另一 request 插入；Product Code counter 先 persist，再寫 Draft。就算 Draft write 異常，最多只會跳號，唔會重用正式 Product Code。

## Test Evidence

- `admin-formal-server-draft.test.ts`：34 tests PASS
- v2admin full：39 files / 277 tests PASS
- Version history：6/6 PASS
- Rollback：8/8 PASS
- Vite build：PASS
- Wrangler deploy dry-run：PASS
- admin-canonical-readback：SUCCESS
- admin-crossport-integration-gate：SUCCESS
- admin-identity-canonical：SUCCESS
- owner-runtime-connection：SUCCESS
- customer-ui5-submit-wait：SUCCESS
- Regression Shadow：SUCCESS

## 下一刀

Admin V3 formal Product Create UI 已有 server-owned create client；下一個高價值 backend / evidence gap 應轉 Print Job evidence：
- 只投影真 SMT transport evidence
- UNKNOWN 保留 UNKNOWN
- 唔用 Preview 假異常
- 唔提供 blind retry
- physical paper truth 仍然唔由 network ACK 冒充

MILESTONE: MFK_ADMIN_V3_PRODUCT_CREATE_SEAM_R2_LANDED_MAIN
