# MFK Commander Handoff Protocol

## Stable GitHub entry point

`COMMANDER_CURRENT.md`

This path never changes. New chats, Commanders and workers start here.

## Template

`docs/commander/COMMANDER_HANDOFF_TEMPLATE.md`

## Copy/paste bootstrap prompt

`docs/commander/COMMANDER_BOOTSTRAP_PROMPT.txt`

## Mandatory rule

Every Commander must update `COMMANDER_CURRENT.md` before:

- saying the work is complete
- returning an assignment
- ending a conversation
- moving to another Commander/chat
- approaching context limits

Every Commander must also post the same handoff summary to #22.

## Why

The stable file prevents a new Commander from depending on stale chat context, stale navigation maps or old reports.

## Authority rule

`COMMANDER_CURRENT.md` is the mandatory coordination entry point.

It must always point to:
- current navigation
- active issue/work
- exact evidence
- exact NEXT
- explicit NOT_AUTHORIZED items

If it is stale, the current Commander must fresh-read repo/#22, correct it, and only then continue.
