# MFP V3｜Codex Implementation Handoff｜A2 Device + Staff Security｜2026-10-02

Status: READY_FOR_CODEX_IMPLEMENTATION
Product: MoreFun POS
Short name: MFP
Surfaces:
- MFP Pad
- MFP Mobile

Execution branch:
`feat/MFP-V3-A2-DEVICE-STAFF-SECURITY-2026-10-02`

Parent:
- PR #633 — MFP V3 A1｜Store Kernel Seam｜2026-10-02
- Parent exact head: `256e130ae4f7292beadbcbbe847433c769066a7e`
- A1 status: SOURCE_VERIFIED

Controlling plan:
`docs/plan/MFP_V3_SMM_Migration_Plan_2026-10-02.txt`

Controlling authority:
`docs/governance/MFK_V3_SMT_REBUILD_AUTHORITY_2026-10-02.md`

## 0. Owner lock

External product:
`MoreFun POS`

Short name:
`MFP`

Final surfaces:
- MFP Pad
- MFP Mobile

SMM product identity remains cancelled.

A2 must build one shared Device + Staff Security contract for both MFP surfaces.

Do not create:
- independent Mobile auth
- independent Pad auth
- SMM session authority
- browser PIN verifier authority
- second staff/permission truth
- second device registry
- long-lived anonymous mutation capability

## 1. Fresh-read before edits

Read:
1. PR #633 exact head
2. `v3smt/src/store-kernel-port.ts`
3. `v3smt/src/state-authority.ts`
4. `v3smt/src/App.tsx`
5. `contracts/staff-auth-v1.ts`
6. existing device authorization seams
7. existing staff identity / RBAC contracts
8. existing Store Kernel command admission rules
9. legacy v2 staff auth only as behavioral/contract donor
10. Admin canonical staff projection
11. public/browser security boundaries

Important:
Legacy `v2local/src/runtime/staff-auth.ts` verifies a PIN from a projected verifier in the client.
Do not automatically copy that model into MFP V3 public/browser surfaces.

If no safe server/Store-Kernel-issued staff session seam exists:
do not invent a second cloud auth engine.
Implement the bounded A2 contract + test adapter and report the missing production binding as BLOCKED for A2 production binding, while still finishing source-level authority contracts where possible.

## 2. A2 objective

Build a single MFP security seam:

Device Identity
→ Device Authorization
→ Staff Authentication
→ Opaque Staff Session
→ Action-time Permission Check
→ Store Kernel Command Admission
→ Session Readback / Revocation

Pad and Mobile use the same contract.

## 3. Device identity contract

MFP must have a stable device identity.

Required fields:
- deviceId
- storeId
- deviceClass: PAD | MOBILE
- installationId
- createdAt
- lastSeenAt
- status: AUTHORIZED | REVOKED | UNKNOWN
- capability set if formally required

Rules:
- deviceId is not business authority
- device identity alone never authorizes a formal mutation
- revoked device fails closed
- unknown device cannot mutate
- device ID must not be regenerated on every reload
- do not treat browser fingerprinting as device authority

Durability:
- local installation identity may be durable
- authorization truth must come from formal authority/readback

## 4. Staff authentication contract

A2 must expose a shared auth port, for example:

- beginStaffLogin(...)
- completeStaffLogin(...)
- readStaffSession(...)
- logoutStaff(...)
- revoke/readback handling

Required session facts:
- staffSessionRef
- staffId
- displayName
- role
- scope
- permissions
- issuedAt
- expiresAt
- deviceId
- storeId
- sessionRevision or equivalent readback identity if available

Rules:
- client never manufactures an authenticated session
- PIN / proof result must be verified by formal auth authority
- browser/public surfaces must not receive staff PIN hashes/verifiers
- no PIN/hash output to logs
- no staff PIN persisted
- no session token in URL
- no shared acceptance token as staff identity
- logout invalidates local session immediately
- server/store-kernel session invalidation wins over local cache

## 5. Session expiry + revocation

Required states:
- AUTHENTICATED
- EXPIRED
- REVOKED
- UNAUTHORIZED
- UNKNOWN

Action-time rule:
Before Store Kernel mutation, MFP must fail closed when:
- no session
- expired session
- revoked session
- wrong device
- wrong store
- missing permission

But:
client-side precheck is UX/security defense only.
Store Kernel/formal command admission must still validate the session/permission.

A2 must not assume that a locally cached permission proves authority.

## 6. Permission contract

Permission checks are action-time.

Required:
- explicit requiredPermission on formal command path or command registry
- role alone is not enough when a permission is defined
- permission changes/revocation take effect without requiring app reinstall
- stale session must be rejected/read back

Minimum A2 test permissions:
- ORDER_CREATE
- ORDER_READ
- PRICE_OVERRIDE
- SOLD_OUT_WRITE

Names may reuse existing canonical permission identifiers if already defined.

Do not invent duplicate permission semantics when repository already has canonical names.

## 7. A1 integration

A1 command envelope currently carries:
- deviceId
- staffSessionRef

A2 must bind these to actual security state.

Before `submitFormalCommand`:
1. resolve active device identity
2. resolve active staff session
3. verify local expiry/revocation cache
4. verify required permission
5. submit exact deviceId + staffSessionRef
6. Store Kernel transport performs formal admission
7. auth rejection must remain REJECTED/UNAUTHORIZED, never UNKNOWN if definitive

Do not change idempotency semantics from A1.

## 8. Minimal visible UI harness

Per the locked UI strategy, A2 must include minimal visible MFP Pad/Mobile security UI sufficient to verify:

- device identity/status
- staff login
- logged-in staff identity
- session expiry state
- logout
- permission-denied feedback
- revoked/expired session fail-closed

Do NOT build final visual design.
Do NOT build full ordering UI yet.
Formal product UI begins at A4.

## 9. State rules

TanStack Query:
- auth/session readback state
- no periodic refetch

Zustand:
- UI state only
- selected login identity / form state allowed
- not session authority

Dexie:
- installation/device metadata only where necessary
- no PIN
- no PIN hash
- no canonical permission truth
- opaque session persistence only if security contract explicitly permits; otherwise memory/session storage
- if session is persisted, expiry/revocation readback must be mandatory before mutation

## 10. Public/browser security lock

A2 source must be compatible with future public MFP.

Forbidden:
- anonymous mutation
- browser-stored provider secret
- browser-stored Admin secret
- commercial HMAC secret
- staff PIN/hash verifier export
- session token in query string
- session token in logs
- permanent 10-year staff browser session

Session lifetime must be bounded.
If canonical lifetime is not yet defined, use a clearly documented bounded candidate value and report it for Owner/production gate.

## 11. Required RED-first tests

First test before implementation:
Expired or revoked `staffSessionRef` must fail closed before Store Kernel submit.

Then at minimum:

1. stable device identity survives reload/storage restore
2. revoked device cannot submit
3. unknown device cannot submit
4. login success returns opaque formal session
5. wrong PIN/proof returns unauthorized without session
6. PIN is never persisted
7. PIN/hash/verifier never appears in serializable client state
8. expired session fails before Store Kernel submit
9. revoked session fails before Store Kernel submit
10. missing permission fails before Store Kernel submit
11. Store Kernel auth rejection remains definitive REJECTED/UNAUTHORIZED
12. Pad and Mobile share same security port
13. logout clears active local session
14. session readback invalidation clears stale local session
15. retry/idempotency identity from A1 remains unchanged
16. no periodic auth polling
17. no v2 client-state import
18. no SMM session authority
19. no `x-mfk-smm-session` dependency
20. no `mfk-smm-web` dependency
21. no session token in URL/query
22. no client-side manufacture of authenticated session

## 12. CI

Extend existing dedicated MFP V3 workflow.

Required:
- install
- test
- typecheck
- build
- authority/security guard

Static security guard should reject:
- `setInterval` business/auth polling
- v2 client-state imports
- SMM session identifiers in production source
- obvious PIN/session logging
- session token query-string construction

No production deployment in A2.

## 13. Completion target

A2 completion:
`SOURCE_VERIFIED`

A2 does NOT mean:
- production auth endpoint deployed
- public MFP released
- physical acceptance complete
- SMM decommission
- final staff security production approval

If source contract is complete but formal production binding is unavailable:
report the exact binding blocker separately.

## 14. Completion report

Return exactly:

1. A2 implemented
2. Device identity contract
3. Device authorization contract
4. Staff login/session contract
5. Session expiry/revocation contract
6. Permission/action-time contract
7. A1 integration proof
8. Pad/Mobile shared-security proof
9. PIN/secret handling proof
10. Public/browser security proof
11. Minimal UI harness
12. Changed files
13. Exact SHA
14. Tests/results
15. CI
16. Production binding status
17. Remaining blockers
18. A3 next exact action

Status language only:
- SOURCE_VERIFIED
- DEPLOYED
- PHYSICAL_VERIFIED
- BLOCKED
- FAILED

MILESTONE:
`MFP_V3_A2_DEVICE_STAFF_SECURITY_2026_10_02`
