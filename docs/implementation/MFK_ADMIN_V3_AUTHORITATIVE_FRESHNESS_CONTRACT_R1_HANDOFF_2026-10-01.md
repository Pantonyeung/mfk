# MFK Admin V3｜Authoritative Freshness Contract R1｜Handoff

日期：2026-10-01
狀態：IMPLEMENTED ON V3 BRANCH / PREVIEW READBACK PENDING / NO PRODUCTION CUTOVER

## Owner Concern

舊 Admin 曾經出現：
- 第一次 login 後 browser 長期沿用舊資料
- 新版本號已更新，但實際畫面資料仍然係舊 snapshot
- 用戶無法知道目前資料係咪重新向 Cloudflare / server 確認過

V3 Freshness Contract 目標係：Browser 永遠唔可以將舊 local/cache state 當正式 truth。

## Existing V3 Protections (re-audited)

1. Canonical GET：
   - `cache:'no-store'`
   - shared Canonical envelope validation
   - Store ID guard
2. Query authority：
   - TanStack Query only
   - V2 LocalStorage read = false
   - auth persistence = memory only
3. Formal Draft GET：
   - `cache:'no-store'`
   - refetchOnMount='always'
   - refetchOnWindowFocus=true
   - refetchOnReconnect=true
4. Operational read models：
   - API GETs use `cache:'no-store'`
   - WebSocket server doorbells already exist
5. Release manifest：
   - `/release.json?ts=<now>`
   - `cache:'no-store'`
   - 60-second release verification

## Gaps found during double-confirm

Before this R1 hardening:
- Canonical relied on mount/focus/reconnect but had no explicit periodic fallback.
- Read models relied on WebSocket/focus/reconnect but had no periodic fallback.
- `ADMIN_CONFIG_AVAILABLE` WebSocket doorbell was not invalidating Canonical + Formal Draft queries.
- Public Pages client asset caching had no explicit V3 `_headers` no-store rule.
- UI did not show last successful server-confirmation time.
- No one-click in-memory cache reset + server repull action.

## R1 Hardening Implemented

### Automatic
- Canonical revalidate:
  - login / mount
  - app returns to foreground
  - network reconnect
  - every 60 seconds while active
- Orders / reports / refunds / Keeta status / Keeta commercial / SMT ACK:
  - mount
  - foreground
  - reconnect
  - WebSocket invalidate
  - every 60 seconds fallback
- `ADMIN_CONFIG_AVAILABLE` now invalidates:
  - Canonical
  - Formal Server Draft
  - operational read models
- Cloudflare Pages static client:
  - `v3admin/public/_headers`
  - all static responses set `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
  - `Pragma: no-cache`
  - `Expires: 0`

### Visible freshness evidence
Authenticated Admin UI now displays:
- 正式設定最後確認
- 營運資料全量確認
- 正在重新同步 / 已向伺服器重新確認 / 部分同步失敗
- automatic fallback interval = 60 seconds

UI intentionally says「已向伺服器確認」rather than permanently claiming「永遠最新」because a server can change immediately after any completed read.

### Manual fallback
New action：
`清除暫存並重新同步`

Behavior:
- resets only `['mfk','admin-v3']` in-memory TanStack Query cache
- active queries immediately repull from server
- does not resurrect V2 LocalStorage
- does not create browser data authority
- session remains in current memory

### Client version mismatch
- Serving release continues to re-check every 60 seconds.
- Version mismatch prompts「載入最新版本」.
- reload uses a cache-busting URL parameter instead of plain `window.location.reload()`.

## Cloudflare Confirmation

Cloudflare Pages official documentation confirms:
- `public/_headers` is copied into build output by frameworks such as Vite.
- `_headers` rules override static asset response headers.
- Pages normally uses ETag / browser cache revalidation and data-center asset caching; V3 now explicitly overrides client cache behavior with no-store.

## Tests / Contracts Added

- Canonical fetch must use `cache:'no-store'`.
- Auto data revalidation interval locked to 60 seconds.
- Manual query-cache reset verified to remove stale in-memory data.
- V3 Pages `_headers` must contain no-store/no-cache policy.
- Formal read models must have periodic fallback.
- `ADMIN_CONFIG_AVAILABLE` must invalidate Canonical + Formal Draft.

## Important Boundary

This contract prevents persistent browser/cache truth from silently surviving as authority.

It does NOT claim a mathematical guarantee that data cannot change one millisecond after a successful server read. The UI therefore exposes the exact last successful confirmation time and refresh state.

Production / v2 / hostname / OTA：NO TOUCH。

MILESTONE: MFK_ADMIN_V3_AUTHORITATIVE_FRESHNESS_CONTRACT_R1_IMPLEMENTED_PREVIEW_PENDING
