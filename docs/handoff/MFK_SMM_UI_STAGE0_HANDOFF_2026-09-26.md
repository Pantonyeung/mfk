# MFK SMM Final UI｜Stage 0 Re-Acceptance Handoff R2｜2026-09-26

## STATUS
STAGE0_BLOCKERS_FIXED
SMOKE_GREEN
BUILD_GREEN
FRESH_MAIN_SYNCED
READY_FOR_COMMANDER_RE_ACCEPTANCE
STAGE1_HOLD
CLOUDFLARE_SMM_ACCEPTANCE_NOT_DEPLOYED

## BRANCH
`work/MFK/SMM-FINAL-UI-IMPLEMENTATION-R1`

## PR
#345｜SMM UI Stage 0｜Launch / Login / Connection｜Final UI R1

Main 未 merge Stage 0，未部署 SMM Cloudflare Preview。

## Supersedes
本文件取代上一版 Stage 0 Handoff 嘅「READY_FOR_COMMANDER_ACCEPTANCE」內容。
Commander 驗收 comment：#345 `5846459069`。

## 5 個 blocker 修正

### 1. Connection Recovery
已補完整：
- Internet 狀態
- LAN 狀態
- 最後觀察時間
- 重新連線
- LAN 設定／重新配對
- 主機／Port／裝置 ID／配對碼
- LAN probe / pair 後重新嘗試 canonical runtime read

最後成功 observedAt 會以 local non-authoritative timestamp 保存，只用於 Recovery 顯示。

### 2. Engineering error 隔離
正式前線 UI 不再直接顯示：
- `SMM_STAGE0_PROBE_TIMEOUT`
- staff verify code
- HTTP status
- raw Error.message

工程錯誤只寫入 console diagnostics。
前線只顯示 human-safe 文案。

### 3. Offline auth bypass
已移除無條件 bypass。

現行：
`offlineBypass && staffSession`

無 trusted staff session：
- Offline CTA disabled
- 明確提示先恢復連線登入
- 不會直接進完整 App shell

### 4. Brand / IP
已改用 Owner 提供嘅 approved assets：
- `v2smm/public/brand/morefun-logo.webp`
- `v2smm/public/brand/ip-male.webp`
- `v2smm/public/brand/ip-female.webp`

規則：
- 不再用 CSS 文字重畫 Logo
- 不再用 embedded AI 雙 IP 圖作正式品牌資產
- Splash：男 IP 一個
- Login：女 IP 一個
- Connection / Recovery：無 IP
- 每畫面最多一個主 IP

### 5. Fresh main
最終修正後已同步 fresh main：
`87ebc5a4dbfff06368dcbd13b807fffdf4ed7d2a`

同步 candidate：
`7c37428600ecf1830ef80c0763e1fef271ee5dc9`

同步時 compare：
- behind = 0
- branch只保留 SMM Stage 0 UI / assets / tests / branch smoke / handoff delta

## Executable proof
Workflow：
`smm-final-ui-smoke`

Run：
`36244868754`

Result：
- Install PASS
- npm test：32 / 32 PASS
- fail：0
- TypeScript build PASS
- Vite production build PASS
- Vite build：139ms

## Authority proof
Stage 0 修正冇新增：
- Formal Order writer
- Pricing authority
- Payment authority
- Print authority
- Store Kernel writer
- Dining canonical mutation
- Customer / Admin / Keeta authority

現有 SMM→SMT submit / idempotency / readback semantics 保持原樣。

## Cloudflare
未部署 SMM acceptance / preview。

PR 上 Cloudflare bot 指向 `mfk-customer` 嘅 build 不屬於 SMM acceptance proof，唔計驗收證據。

下一步只可以：
Commander re-acceptance PASS
→ 才推 `mfk-smm-web` Cloudflare Preview
→ Owner 手機實機驗收

## NEXT
等待 Commander 重驗 Stage 0。
未 PASS 前：
- Stage 1 HOLD
- 不 merge main
- 不推 Cloudflare SMM acceptance

MILESTONE:
`MFK_SMM_FINAL_UI_STAGE0_R2_READY_FOR_COMMANDER_RE_ACCEPTANCE`
