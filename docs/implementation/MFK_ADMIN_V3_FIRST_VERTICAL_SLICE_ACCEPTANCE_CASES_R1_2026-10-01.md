# MFK Admin V3｜First Vertical Slice Acceptance Cases R1

日期：2026-10-01
狀態：PLANNING / IMPLEMENTATION ACCEPTANCE SPEC

Vertical Slice：
Login → Client Release Match → Canonical Read → Category → Product → Price → Draft → Validate → Impact → Publish → Cloud Readback → SMT Readback → Safari Reopen

# 1. Evidence Bundle Minimum
- caseId
- candidate SHA
- client releaseId
- serving releaseId
- browser/device
- storeId
- actor / permission / scope
- canonical before fingerprint/publishedAt
- input / expected / actual
- canonical after fingerprint/publishedAt
- SMT observed fingerprint/publishedAt
- ACK appliedAt
- evidence links
- verdict

# 2. Client Release / Safari

## VSL-01 Fresh Open Current Release
PASS：Client Release可見；Serving Release可讀；exact match；正式寫入先可解鎖。

## VSL-02 Safari Loaded Old Client
Precondition：Safari保持舊 bundle；Server已部署新 preview。
PASS：client != serving被發現；舊 Client禁止 publish；受控更新後 match；唔要求 clear cache / Private Mode。

## VSL-03 Second Tab Parity
PASS：兩個 tab最終都收斂 current serving release + current canonical。

# 3. Auth / Scope

## VSL-04 Login
PASS：raw PIN不直接傳送；session memory-only；canonical request帶正式 session header。

## VSL-05 Expired / Revoked Session
PASS：fail closed；authenticated Query data清除；要求重新登入；無 publisher-key fallback。

# 4. Canonical Freshness

## VSL-06 Initial Canonical Read
PASS：GET /api/admin-browser/active；shared validator通過先 render；human freshness = canonical publishedAt；revision只係 diagnostics。

## VSL-07 Corrupt Canonical
PASS：invalid fingerprint/schema/store直接 reject；唔 cache成正式資料。

# 5. Draft Editing

## VSL-08 Create Category Draft
PASS：canonical未變；draft顯示未發佈；唔顯已發佈。

## VSL-09 Create Product Draft
PASS：Product必填校驗；canonical未變；draft context保留 Category + Product。

## VSL-10 Set Price Draft
PASS：價錢只係 Admin canonical pricing input；未 publish前 transaction authority不受影響。

## VSL-11 Leave Guard
PASS：有 unsaved change離頁有 guard；唔靠 v2 localStorage暗中復活。

# 6. Validate / Impact

## VSL-12 Validation Blocker
PASS：Blocker阻 publish；指出 object + field；零 mutation。

## VSL-13 Impact Preview
PASS：顯 Added/Updated/Disabled objects、affected domains、channels、print/routing（如有）、target systems。

# 7. Publish

## VSL-14 Formal Publish
PASS：POST /api/admin-browser/publish；permission成立；server shared validation；canonical建立新 identity；publishedAt由 server authority決定。

## VSL-15 Publish Error / Timeout
PASS：唔顯雲端已發佈；previous canonical保留；timeout按 UNKNOWN；唔盲 retry。

## VSL-16 Exact Retry
PASS：server idempotent；零 duplicate business release effect。

# 8. Doorbell / SMT Pull

## VSL-17 Admin Doorbell
PASS：SMT收到 ADMIN_CONFIG_AVAILABLE；唔直接 apply event payload；主動 GET Current Canonical HEAD。

## VSL-18 Delayed Old Doorbell
Cloud Current = R20；遲到 R10 event。
PASS：SMT GET Current HEAD仍得 R20；zero downgrade。

## VSL-19 Local Revision Larger
PASS：本地 revision唔作拒收 authority；SMT仍讀 Current HEAD，以正式 identity決定。

# 9. Multi-SMT Convergence

## VSL-20 Two Online SMT
PASS：SMT1/SMT2最終 fingerprint + publishedAt都等於 Desired Canonical；所有 Required Target match先顯全部已套用。
FAIL：有網絡而長期一部舊、一部新。

## VSL-21 One SMT Misses Doorbell
PASS：SMT2 reconnect / foreground後 canonical reconcile；無需等下一次 publish；最終 match。

# 10. ACK / Admin Readback

## VSL-22 Exact ACK
PASS條件：ACK fingerprint == canonical fingerprint AND ACK publishedAt == canonical publishedAt；先可顯 SMT 已套用。

## VSL-23 Same Revision, Wrong Fingerprint
PASS：不可顯 Applied。

## VSL-24 Same Fingerprint, Wrong publishedAt
PASS：不可顯 Applied。

## VSL-25 No ACK Yet
PASS：顯 等待 SMT 回讀；唔係 Failed。

# 11. SMT → Admin Doorbell

## VSL-26 ACK Doorbell
PASS：Admin收到 event後 invalidate/refetch；正式 UI由 GET ACK產生；event payload唔直接變 Applied。

## VSL-27 Projection Doorbell
PASS：SMT projection commit後發 SMT_PROJECTION_AVAILABLE；Admin refetch read model；唔直接 render socket payload。

# 12. Browser Reopen

## VSL-28 Safari Reopen After Publish
PASS：current Client Release、current Canonical、current Target Readback；無舊 local state覆蓋新 Cloud；唔使清 cache。

# 13. Network Lifecycle

## VSL-29 Offline With Previous Data
PASS：顯 離線 · 顯示上次成功資料；freshness可見；唔冒充即時。

## VSL-30 Reconnect
PASS：bounded canonical/readback reconcile；最終 current。

## VSL-31 Foreground
PASS：background期間 canonical改變後，回前景 refetch/reconcile。

# 14. Failure / Safety

## VSL-32 Query Failure ≠ Zero
PASS：sales/order/count read error唔變 0。

## VSL-33 Doorbell Transport Down
PASS：transport顯 unavailable；existing data唔清；reconnect後 authoritative reconcile。

## VSL-34 Duplicate Doorbell
PASS：零 duplicate business side-effect；只造成 bounded refetch。

# 15. Rollback / Cutover Safety

## VSL-35 V3 Preview Failure
PASS：v2 Production完全不受影響。

## VSL-36 Future Route Rollback Proof
正式 cutover前先做。PASS：route可指返 v2；serving identity readback證明真係 v2；v2 login/core navigation正常。

# 16. Vertical Slice GREEN Definition

以下全部 GREEN先可以擴去其餘頁：Client release、Auth/scope、Canonical、Category/Product/Price draft、Validate/Impact、Publish、Doorbell pull、Multi-SMT convergence、ACK exact readback、Safari reopen、reconnect/foreground、v2 unaffected。

任何一項 RED：停止擴頁，先修 exact FIRST BREAK。

MILESTONE:
MFK_ADMIN_V3_FIRST_VERTICAL_SLICE_ACCEPTANCE_CASES_R1_READY
