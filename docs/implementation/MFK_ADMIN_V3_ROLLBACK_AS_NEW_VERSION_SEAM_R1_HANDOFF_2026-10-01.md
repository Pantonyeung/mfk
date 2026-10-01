# MFK Admin V3｜Rollback As New Version Seam R1｜Handoff

日期：2026-10-01  
狀態：IMPLEMENTED / STACKED DRAFT PR / NO PROMOTE / NO DEPLOY

## Dependency

- Base branch：`feat/MFK-V3ADMIN-VERSION-HISTORY-SEAM-R1`
- Depends on：PR #614
- This seam：PR #615
- Production / hostname / OTA：NO TOUCH

## 已實作

1. 新增正式 rollback command：
   - `POST /api/admin-browser/versions/rollback?storeId=...`
2. Rollback 唔會倒帶 active Canonical，亦唔會改舊歷史。
3. Server 只由 immutable version storage 讀 archived target snapshot，再建立一個全新 Canonical revision。
4. Browser 唔會提交 historical snapshot。
5. 必填 guard：
   - operationId
   - targetFingerprint
   - expectedActiveFingerprint
   - expectedActivePublishedAt
   - expectedActiveRevision
   - reason
6. Permission：
   - OWNER 或 PUBLISH_CONFIG
7. Operation identity：
   - 同一 operationId + 同一 intent = idempotent
   - 同一 operationId + 不同 intent = fail-closed
8. Crash window：
   - command 先保存 PENDING
   - publish 成功但 final operation result 未寫到時，retry 會先用 activeMeta / immutable history readback 判斷
   - 未證實就唔會 blind republish
9. Later unrelated publish：
   - 若 rollback effect 已成 archived version，仍可由 publishRequestFingerprint 證明舊 operation 已完成
   - 不會重新 rollback

## Version-history enhancement

Immutable archived record 額外保存 `publishRequestFingerprint`，只留 server evidence，方便 rollback operation crash recovery；version-list UI 不會曝光呢個欄位。

## Test Evidence

新增：`v2admin/src/admin-version-rollback.test.ts`

覆蓋：
- auth fail-closed
- OWNER / PUBLISH_CONFIG permission
- archived target → new canonical revision
- exact active stale guard
- operation idempotency
- operationId intent collision
- publish landed / operation-result write failed → authoritative readback recovery
- target not found
- reason required

GitHub Actions evidence：
- rollback suite：8 / 8 PASS
- version history suite：6 / 6 PASS
- v2admin full suite：39 files / 271 tests PASS
- Vite production build：PASS
- Wrangler deploy dry-run：PASS
- CI admin job：`110256116580`
- workflow runs：admin-identity-canonical / customer-ui5 / owner-runtime / admin-canonical-readback 全部 SUCCESS

## 未做

- V3 UI `FormalVersionsReadbackPage` 未接 versions API
- V3 `FormalRollbackGapPage` 未改成正式 authority surface
- SMT ACK readback 未綁 rollback UI completion
- PR #614 / #615 未 PROMOTE / 未 merge / 未 deploy

## 下一刀

等 #614 + #615 Owner PROMOTE 並落地後：

1. V3 read model 加 versions endpoint。
2. Versions Page 顯示 Active / Archived + FORWARD_ONLY。
3. Rollback Page：
   - 揀 archived version
   - 輸入 reason
   - 帶 exact active guards + operationId
   - submit server rollback command
   - publish result 之後等 Canonical refresh + SMT ACK
4. UI 只可在 ACK / authoritative readback 成立後顯示 Applied；唔可以 server 200 就當門店已套用。

MILESTONE: MFK_ADMIN_V3_ROLLBACK_AS_NEW_VERSION_SEAM_R1_IMPLEMENTED_GREEN_PENDING_PROMOTE
