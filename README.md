# MFK

MFK 係目前唯一 current system。

## Current products

- `v2local/` — SMT frontline execution
- `v2admin/` — Admin control plane
- `v2smm/` — SMM（migration lane；未完成前唔視為 current product）

## Authority

Owner 決定規則。

Admin：
Draft → Validate → Publish → Active Revision。

SMT：
按已發布規則執行正式店舖交易。

## Current Admin state

`v2admin/` 已獨立隔離：
- 37 capability registry
- MFK-only routes / truth owners
- live domain wiring = NOT_WIRED
- live mutation = OFF
- SMT transaction execution = NO

跨 Port adapter 會喺 Admin 本身收整完成後逐項接入。

## Current SMT state

`v2local/` 係 current frontline execution surface。
禁止因 Admin/SMM migration 重做 SMT authority。

## Current control

GitHub issue：
`Pantonyeung/mfk#22`

Navigation：
`docs/navigation/MFK_航海圖_V1.0_Round001_2026-09-21.txt`
