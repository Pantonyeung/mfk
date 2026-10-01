# MFK｜Codex Kickoff Template V1

用途：
下次任何 Codex 任務，直接複製以下單一 code block。
必須填齊 GitHub 地址、branch、PR、exact task、no-touch、acceptance。

## 必填 GitHub 地址

Repo：
https://github.com/Pantonyeung/mfk

Implementation branch：
https://github.com/Pantonyeung/mfk/tree/feat/MFK-V3ADMIN-ONE-SHOT-R1

Current PR：
https://github.com/Pantonyeung/mfk/pull/605

Product issue：
https://github.com/Pantonyeung/mfk/issues/601

Root program：
https://github.com/Pantonyeung/mfk/issues/596

## Copy / Paste Rule

俾 Owner 嘅 Codex 開場白：
- 只用一個 code block
- code block 之外唔混入指示
- 唔用 Markdown nested quote
- GitHub URL 寫完整
- 第一行講 exact task
- 最後一行講「先 fresh-read，再回報 FIRST BREAK」
- Codex 未 fresh-read之前唔准開始改 code

## 標準格式

```text
你而家正式接手：[EXACT TASK]

GitHub：
Repo：https://github.com/Pantonyeung/mfk
Branch：[FULL BRANCH URL]
PR：[FULL PR URL]
Product Issue：https://github.com/Pantonyeung/mfk/issues/601
Root Program：https://github.com/Pantonyeung/mfk/issues/596

開工前 mandatory fresh-read：
1. COMMANDER_CURRENT.md
2. HANDOFF_CURRENT.md
3. [CONTROLLING PRODUCT / IMPLEMENTATION DOCS]
4. current PR diff
5. current CI
6. current review threads
7. live source relevant to this task

Current exact task：
[ONE BOUNDED TASK]

Allowed：
[ALLOWED PATHS]

No-touch：
[NO-TOUCH PATHS / AUTHORITIES]

Hard rules：
[AUTHORITY / FRESHNESS / STATE RULES]

Acceptance：
[TESTS / CI / REVIEW / PHYSICAL EVIDENCE]

完成後回報：
- exact head SHA
- files changed
- tests
- CI
- authority impact
- persistence impact
- remaining RED / YELLOW
- exact NEXT

禁止自行 merge / deploy / production route switch。

而家先 fresh-read以上 authority同 current repo，回報 FIRST BREAK；確認 scope後先開始改 code。
```

MILESTONE:
MFK_CODEX_KICKOFF_TEMPLATE_V1_READY
