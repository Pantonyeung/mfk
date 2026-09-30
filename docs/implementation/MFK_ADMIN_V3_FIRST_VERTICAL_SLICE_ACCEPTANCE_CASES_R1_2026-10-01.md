# MFK Admin V3｜First Vertical Slice Acceptance Cases R1

日期：2026-10-01
狀態：PLANNING / IMPLEMENTATION ACCEPTANCE SPEC

Vertical Slice：
Login → Client Release Match → Canonical Read → Category → Product → Price → Draft → Validate → Impact → Publish → Cloud Readback → SMT Readback → Safari Reopen

## 1. Release / Safari

VSL-01 Fresh Open
PASS：client release + serving release可驗證；match先解鎖未來正式寫入。

VSL-02 Old Safari Bundle
PASS：client != serving時 fail closed；禁止正式寫入；受控更新後先解鎖；不要求 clear cache / Private Mode。

VSL-03 Second Tab
PASS：兩 tab最終收斂同一 serving release + canonical。

## 2. Auth / Scope

VSL-04 Login
PASS：raw PIN不直接傳送；session token memory-only；canonical read帶 session header。

VSL-05 Expired/Revoked
PASS：fail closed；清 authenticated query；重新登入；無 publisher-key fallback。

## 3. Canonical

VSL-06 Initial Read
PASS：GET active；shared validator通過先 render；freshness = canonical publishedAt。

VSL-07 Wrong Store / Corrupt Envelope
PASS：schema/fingerprint/store scope mismatch全部 reject。

## 4. Draft

VSL-08 Create Category Draft
PASS：canonical未變；UI顯未發佈。

VSL-09 Create Product Draft
PASS：必填校驗；保留 Category + Product draft context。

VSL-10 Price Draft
PASS：未 publish前唔改正式 transaction authority。

VSL-11 Leave Guard
PASS：unsaved edit離頁明確 guard；唔靠 v2 localStorage。

## 5. Validate / Impact

VSL-12 Blocker
PASS：invalid product阻 publish；指出 object + field。

VSL-13 Impact Preview
PASS：顯 Added/Updated/Disabled、affected domains/channels/targets。

## 6. Publish

VSL-14 Formal Publish
PASS：POST admin-browser/publish；permission；shared validation；server canonical publishedAt。

VSL-15 Publish Error / Timeout
PASS：唔顯 Cloud Published；保留 previous canonical；UNKNOWN唔盲 retry。

VSL-16 Exact Retry
PASS：server idempotent；zero duplicate business release effect。

## 7. Doorbell / SMT Pull

VSL-17 Admin Config Doorbell
PASS：SMT收到通知後 GET Current Canonical HEAD；唔 apply event payload。

VSL-18 Delayed Old Doorbell
Cloud已R20、收到遲到R10。
PASS：GET HEAD仍取R20；zero downgrade。

VSL-19 Local Revision Larger
PASS：local R較大唔可拒絕 authoritative HEAD；以正式 identity判斷。

## 8. Multi-SMT

VSL-20 Two Online SMT
PASS：兩部最終 fingerprint + publishedAt = Desired Canonical；所有 required target match先顯全部套用。

VSL-21 Missed Doorbell
PASS：漏事件嘅 SMT喺 reconnect/foreground reconcile current HEAD；唔等下一次 publish。

## 9. ACK / Readback

VSL-22 Exact ACK
PASS：fingerprint + publishedAt exact match先顯 SMT 已套用。

VSL-23 Same Revision / Wrong Fingerprint
PASS：不可顯 Applied。

VSL-24 Same Fingerprint / Wrong publishedAt
PASS：不可顯 Applied。

VSL-25 No ACK
PASS：等待 SMT 回讀；唔係 Failed。

VSL-26 ACK Doorbell
PASS：Admin收到 doorbell後 refetch official ACK；event payload唔直接變 Applied。

VSL-27 Projection Doorbell
PASS：Admin refetch read model；唔 render socket payload。

## 10. Reopen / Network Lifecycle

VSL-28 Safari Reopen
PASS：current client release + current canonical + current target readback；唔使清 cache。

VSL-29 Offline With Data
PASS：顯上次成功資料 + freshness；唔冒充 current。

VSL-30 Reconnect
PASS：bounded canonical/readback reconcile。

VSL-31 Foreground
PASS：refetch/reconcile；唔永久食背景前資料。

## 11. Failure Safety

VSL-32 Query Failure ≠ Zero
PASS：read failure唔變 zero/empty。

VSL-33 Doorbell Transport Down
PASS：transport unavailable獨立顯示；舊 data保留；reconnect後 canonical reconcile。

VSL-34 Duplicate Doorbell
PASS：zero duplicate business side-effect；只 bounded refetch。

## 12. Production Safety

VSL-35 Preview Failure
PASS：v2 Production完全不受影響。

VSL-36 Future Rollback Proof
Cutover前：route可回v2；serving identity證明；v2 login/core navigation正常。

## 13. GREEN Definition

全部先叫 Vertical Slice GREEN：
- Release freshness
- Auth/scope
- Canonical validation
- Category/Product/Price draft
- Validate/Impact
- Publish
- Doorbell pull model
- Multi-SMT convergence
- ACK exact readback
- Safari reopen
- reconnect/foreground reconcile
- v2 unaffected

任何一項 RED：
唔擴其餘頁面，先修 exact FIRST BREAK。

MILESTONE:
MFK_ADMIN_V3_FIRST_VERTICAL_SLICE_ACCEPTANCE_CASES_R1_READY
