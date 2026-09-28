## Commander Mandatory Entry

Every Commander, new chat, takeover, context rollover and work return MUST start from:

`COMMANDER_CURRENT.md`

Template:
`docs/commander/COMMANDER_HANDOFF_TEMPLATE.md`

Bootstrap prompt:
`docs/commander/COMMANDER_BOOTSTRAP_PROMPT.txt`

Protocol:
`docs/commander/README.md`

Before any Commander returns work or ends a conversation, `COMMANDER_CURRENT.md` must be refreshed and the same return summary must be posted to #22.

# MFK

公開嘅磨飯 POS 實作 repo。

Active implementation 只有：

`v2local/`

呢一版直接以 MoreFun V2 SMT 嘅 1920×1080 UI 做基礎，重新接成本地 POS。

目前：

- MoreFun V2 1920×1080 production viewport
- 點餐
- Cart
- 現金結帳
- 本機 Order persistence
- 訂單
- 堂食畫面
- 售罄
- 打印與設備
- Carrier 1.0.6 Native Print Bridge
- Sunmi 內置打印機測試
- LAN printer apply / connect test / test print

Active runtime 禁止：

- D1
- Cloud
- WebSocket
- Firebase
- 外部訂單入口
- 遠端身份／登入依賴

舊 static POS 已由 active repo 移除。

原始研究入口：`REPORT.md`

## Current Control

- Navigation: `docs/navigation/MFK_航海圖_V1.4_Round005_2026-09-22.txt`
- Cloud runtime / legacy retirement lock: `docs/governance/MFK_CLOUD_RUNTIME_BUDGET_AND_LEGACY_RETIREMENT_LOCK_R1_2026-09-22.md`

Cloud runtime is event-driven first. Store operating window is 10:00–20:30 Asia/Hong_Kong; outside that window non-urgent cloud work is LOW_TRAFFIC_MODE. Old Morefun-v2 Keeta runtime is retired and must never be reconnected to MFK.
