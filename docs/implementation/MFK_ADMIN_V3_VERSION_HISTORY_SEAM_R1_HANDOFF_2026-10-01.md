# MFK Admin V3｜Version History Seam R1｜Handoff

日期：2026-10-01  
狀態：LANDED TO MAIN / NO DEPLOY / NO OTA

## 目的

將 Admin V3「版本／回讀確認」由 active Canonical + SMT ACK 再向前推一格，補上 verified immutable version-list read seam，作為之後 rollback-as-new-version command 的前置證據。

## Authority / Base

- Repository：`Pantonyeung/mfk`
- Base：`main@5854c6684acdf33769095fed3ec2f383999843cf`
- Branch：`feat/MFK-V3ADMIN-VERSION-HISTORY-SEAM-R1`
- Draft PR：#614
- Production / hostname / OTA：NO TOUCH

## 已實作

1. 新增 authenticated read endpoint：
   - `GET /api/admin-browser/versions?storeId=...`
2. 每次 distinct publish 替換 active Canonical 前，先將目前 active snapshot 保存成 immutable version record。
3. Idempotent publish retry 不新增重複 version record。
4. Read model 只輸出 version metadata：
   - revision
   - publishedAt
   - fingerprint
   - adminFingerprint
   - ACTIVE / ARCHIVED
5. Browser version-list 不輸出 snapshot；完整 snapshot 只留 server storage，供日後 server-side rollback seam 使用。
6. 歷史完整度明確標為 `FORWARD_ONLY`：
   - seam 上線前的舊版本無法由現有 metadata 重建，所以不假裝完整。

## 安全理由

- Version record 可以在仍 active 時已存在；ACTIVE / ARCHIVED 由 read 時 fingerprint comparison 派生。
- 因此就算後續 canonical write 失敗，都不會錯誤宣稱舊版本已被 rollback / superseded。
- 無第二 Config Authority。
- 無 browser-side snapshot reconstruction。
- 無 rollback mutation。
- 無 Production deploy。

## Test Evidence

新增：`v2admin/src/admin-version-history.test.ts`

覆蓋：
- unauthorized fail-closed
- current-only list
- list 不洩漏 snapshot
- distinct publish 保存上一版本完整 snapshot
- multiple publish newest-first
- idempotent retry 無 duplicate
- wrong store scope fail-closed

GitHub Actions evidence：
- v2admin full suite：38 files / 263 tests PASS
- 新 version history suite：6 / 6 PASS
- Vite production build：PASS
- Wrangler deploy dry-run：PASS
- CI job：`110254241422`

## 仍未做

- V3 UI 尚未讀取 `/api/admin-browser/versions`
- rollback-as-new-version command 尚未做
- immutable version detail endpoint 尚未對 browser 開放（目前無需要）
- pre-seam historical versions 無法重建

## 下一刀

前提：PR #614 經 Owner PROMOTE 並落地後。

1. V3 `FormalVersionsReadbackPage` 接版本 list read model。
2. 保留 SMT ACK matching 作 Applied evidence。
3. 再開獨立 seam：
   - server-side rollback-as-new-version
   - exact target fingerprint
   - permission
   - validation
   - new revision
   - publish
   - SMT ACK / readback
4. 禁止直接將 browser 舊 snapshot PUT 回 active。

## Parallel PR Collision

PR #613（Product Create + Product Code seam）亦修改 `v2admin/worker.ts`。
兩者任何一個先 merge，另一個 merge 前必須 fresh main / conflict check / full v2admin suite rerun。

MILESTONE: MFK_ADMIN_V3_VERSION_HISTORY_SEAM_R1_LANDED_MAIN


## Landing Readback

- Main merge SHA: `b52830172f82cdf5ea76ccc2dd15b5019a14ec6e`
- Version-history PR #614 landed first; rollback landing PR #616 landed after all checks green.
- Production route / hostname / deploy / OTA remains untouched.
