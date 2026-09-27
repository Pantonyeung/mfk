# MFK Commander Seamless Handoff Template

Copy this structure into `COMMANDER_CURRENT.md` and replace every placeholder with current observed reality.

---

# MFK COMMANDER CURRENT｜MANDATORY ENTRY POINT

Status: CURRENT / CONTROLLING
Protocol: #39
Control: #22
Updated: <YYYY-MM-DD HH:MM Asia/Hong_Kong>
System: MFK ONLY

## 0. Mandatory read order

1. `COMMANDER_CURRENT.md`
2. #22 latest controlling comment
3. Current navigation listed below
4. `HANDOFF_CURRENT.md`
5. Exact active work issue(s)

## 1. Current navigation

`<CURRENT_NAVIGATION_PATH>`

## 2. One-line current reality

<ONE SHORT PARAGRAPH: what is current, what is banked, what is still pending>

## 3. Current authority / role boundary

- Owner decision authority: <...>
- Admin: <...>
- SMT: <...>
- Other role(s) involved: <...>
- Explicit non-authorities: <...>

## 4. Exact work just completed

WORK_ID:
`<WORK_ID>`

Issue:
`#<ISSUE>`

Branch:
`<BRANCH>`

Base:
`<BASE_SHA>`

Source commit:
`<SOURCE_SHA>`

Clean landing:
`<LANDING_SHA>`

Main after landing:
`<MAIN_SHA>`

## 5. Test / evidence

Source test:
`<RUN_ID>`
Result:
`<GREEN / RED>`

Landing test:
`<RUN_ID>`
Result:
`<GREEN / RED>`

Provider/manual evidence:
- <EXACT OBSERVED EVIDENCE>
- <SCREEN / URL / READBACK / DEVICE RESULT>

State:
`<GREEN / RED / UNKNOWN>`

Never call GREEN without observed proof.

## 6. Current exact state

BANKED:
- <...>

IMPLEMENTED BUT OWNER WALKTHROUGH PENDING:
- <...>

NOT_WIRED:
- <...>

BLOCKED:
- <...>

UNKNOWN:
- <...>

## 7. Exact first break / blocker

`<NONE or exact first break>`

Do not list speculative blockers.

## 8. Current exact NEXT

ONE next action only:

`<EXACT NEXT ACTION>`

Acceptance:

`<EXACT OBSERVED GREEN CONDITION>`

STOP condition:

`<WHEN TO STOP AND WAIT OWNER>`

## 9. DO NOT / NOT AUTHORIZED

- NO <...>
- NO <...>
- NO <...>

Never infer next seam permission.

## 10. Files / seams

Contract:
`<PATH>`

Source:
`<PATH>`

Target:
`<PATH>`

Readback:
`<PATH>`

Governance:
`<PATH>`

## 11. External/manual provider state

Cloudflare:
<...>

Canonical domain:
<...>

Keeta:
<...>

OTA:
<...>

Other:
<...>

## 12. Permanent rules that still apply

- MFK only
- six roles only
- one business authority per fact/action
- CONNECT ONE → TEST SAME PIECE → BANK → STOP
- NO TARGET READBACK = NOT GREEN
- UNKNOWN != FAILED
- event-driven cloud first
- cloud never blocks SMT local transaction
- old Morefun-v2 is reference/oracle only unless explicitly handling retirement

## 13. Owner decisions required

`<NONE or exact decision(s)>`

## 14. Resume command for next Commander

> 接手 MFK Commander。
> 先 fresh-read `COMMANDER_CURRENT.md`、#22 最新 controlling comment、COMMANDER_CURRENT 指定嘅 current navigation、`HANDOFF_CURRENT.md` 同 active issue。
> 唔准用舊 Morefun-v2 / 舊航海圖當 current authority。
> 只執行 COMMANDER_CURRENT 入面嘅 exact NEXT。
> 完成／交功課／context 接近滿之前，必須更新 `COMMANDER_CURRENT.md`，並將同一份 return 貼到 #22。
> 未經 Owner 明確批准，唔准推斷下一條 seam。

## 15. Return checklist

Before sending the final return:

- [ ] fresh-read current main
- [ ] fresh-read #22 latest controlling comment
- [ ] exact current reality verified
- [ ] commits/runs/evidence recorded
- [ ] stale NEXT removed
- [ ] one exact NEXT written
- [ ] NOT_AUTHORIZED written
- [ ] `COMMANDER_CURRENT.md` updated
- [ ] same return posted to #22
- [ ] navigation advanced if material state changed
- [ ] no secret values included
