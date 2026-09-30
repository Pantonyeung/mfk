# MFK Port Reassessment & Closeout Skill

## 目的

當任何 MFK 端口出現功能混亂、Authority 不清、頁面架構失衡、工作流程斷裂，或者準備重建時，用此 Skill 做完整盤點、重整同收口。

適用：
Admin / SMM / SMT / Owner / Customer / future client。

## 觸發條件

見到以下任何情況就啟動：

- 「成個端口亂晒」
- 「功能搵唔到」
- 「同一設定幾度都有」
- 「UI 顯成功但實際未完成」
- 「想重新設計 / 重建」
- 「想盤點仲欠乜」
- 「想出 Owner Review / implementation brief」

## 執行模式

唔直接開始 coding。

依次執行：

1. Authority Lock
2. Problem / Evidence Matrix
3. Current Reality Inventory
4. Port Archetype
5. Product Map
6. Gap Map
7. Collision Audit
8. Page Inventory
9. First Viewport 100%
10. Cross-page Audit
11. High-risk Workflow Audit
12. Bulk / Productivity Audit
13. Component Contract
14. Responsive Contract
15. Interaction Contract
16. Copy Dictionary
17. Owner Review Closeout
18. Implementation Entry Gate
19. Implementation Acceptance
20. Cutover Acceptance

## 核心判斷規則

- Unknown ≠ Failed
- Request Accepted ≠ Completed
- Published ≠ Applied
- Connected ≠ Business Ready
- UI ≠ Authority
- Browser cache ≠ canonical truth
- Summary / shortcut ≠ Primary Home
- Detail / Edit ≠ 第三層導航
- Backend contract gap 唔可以由 frontend workaround 補

## 每個問題必答

1. 使用者見到乜？
2. 真正影響乜工作？
3. 邊個 domain？
4. 邊個 authority？
5. 有咩 evidence？
6. 第一個可信 break point？
7. 有咩仍然 unknown？
8. 正確 Primary Home 喺邊？
9. 第一屏應該見乜？
10. 下一步應該係乜？
11. 做完點證明？
12. 係 LOCKED / YELLOW / RED？

## 每頁驗收

Desktop：
- Title
- Current state
- Primary CTA
- Core list/workspace
- Filter density
- Danger placement

Mobile：
- 核心資訊第一屏
- 無 desktop table 硬縮
- CTA 清楚
- 無 hover / drag dependency
- technical detail 後置

## 高風險操作模板

目前事實
→ 影響預覽
→ 權限 / 規則
→ 確認
→ 執行
→ Pending / Unknown
→ Authoritative Readback
→ Confirmed / Failed / Conflict / Partial
→ Audit / Evidence

## 工作狀態

LOCKED：
產品定義完整。

YELLOW：
產品定義完整，但有外部 dependency。

RED：
產品本身仍有矛盾 / authority / safety 問題。

## 每輪 Batch 完成動作

必須：

- 更新 canonical doc
- 記錄 milestone
- GitHub handoff
- Google Drive handoff
- Jade Note handoff
- 明確下一步

## 收口條件

只有以下全部成立先可以話盤點完成：

- Product Map 完成
- First Viewport 100%
- Cross-page 完成
- High-risk 完成
- Component / Responsive / Interaction 完成
- Copy 完成
- RED = 0
- 每個 YELLOW 有 owner / dependency / handling rule
- Owner Review Pack 完成
- Implementation Entry Conditions 完成

## 詳細標準

參考：
docs/methodology/MFK_PORT_REASSESSMENT_CLOSEOUT_METHOD_V1_2026-09-30.md

MILESTONE:
MFK_PORT_REASSESSMENT_CLOSEOUT_SKILL_V1_READY
