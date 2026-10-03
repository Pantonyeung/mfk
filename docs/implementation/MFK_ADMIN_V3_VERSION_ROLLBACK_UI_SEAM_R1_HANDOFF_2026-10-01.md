# MFK Admin V3｜Version / Rollback Formal UI Seam R1｜Handoff

日期：2026-10-01  
狀態：IMPLEMENTED ON ONE-SHOT BRANCH / PREVIEW-ONLY / NO PRODUCTION CUTOVER

## Authority

- Repository：`Pantonyeung/mfk`
- Admin V3 line：PR #605
- Branch：`feat/MFK-V3ADMIN-ONE-SHOT-R1`
- Current head：`92daad92ca81d032f50867192cb94dd9fb26714d`
- Backend version-history + rollback seams 已落 main。
- Production hostname / v2 route / OTA：NO TOUCH

## 今輪 UI 改動

1. `formal-draft.tsx`
   - 新增 authenticated version-list read contract
   - 新增 rollback-as-new-version command client
   - rollback payload 只帶 target fingerprint + current canonical exact guards + reason + operationId
   - browser 絕不上傳 historical snapshot
2. `FormalVersionsReadbackPage`
   - 讀 server immutable version list
   - 顯示 ACTIVE / ARCHIVED
   - 顯示 `FORWARD_ONLY`
   - 保留 SMT ACK matching
   - Published 與 Applied 明確分開
3. `FormalRollbackPage`
   - 正式取代 Gap Page
   - 只列 verified archived versions
   - reason 必填
   - exact current canonical guard
   - operationId safe retry
   - 有 Formal Draft 時 UI 阻止 rollback，避免 draft base stale 後誤操作
   - Server rollback success 只顯示「等待 SMT Readback」，唔假裝 Applied
4. `admin-shell.tsx`
   - rollback route 已指向 Formal authority surface
5. 新增 `formal-version-api.test.ts`
   - version list auth/read
   - rollback exact guards
   - historical snapshot 不出 browser payload
   - stale conflict preserve
   - malformed history fail-closed

## Backend Landing

- Version history landed via PR #614
- Rollback command landed via PR #616
- Main merge SHA：`b52830172f82cdf5ea76ccc2dd15b5019a14ec6e`
- Production deploy / OTA：未做

## 驗收語義

- Cloud Published ≠ SMT Applied
- Rollback = new Canonical revision
- Archived snapshot 只可由 server authority 使用
- FORWARD_ONLY = seam 前歷史不可假裝完整
- HTTP 200 ≠ 門店已套用
- Applied 必須 fingerprint + publishedAt SMT ACK matching

## 下一步

1. 等 `v3admin-ui-preview` branch workflow 對最新 head 完成 test / typecheck / build / preview readback。
2. 如 RED，只修今輪最細 seam。
3. Preview green 後由 Owner 直接驗版本頁 / rollback 頁。
4. Production 仍保持 no-touch，直到 Admin V3 whole acceptance / explicit promote。

MILESTONE: MFK_ADMIN_V3_VERSION_ROLLBACK_UI_R1_IMPLEMENTED_PENDING_PREVIEW_READBACK
