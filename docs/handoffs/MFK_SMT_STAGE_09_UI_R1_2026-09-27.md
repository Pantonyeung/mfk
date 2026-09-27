# MFK SMT｜Stage 9 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 9｜日結／留櫃

## 0. Stage 定位
Stage 9 負責一個 Business Day 完結時嘅現金核對、差額、取走、留櫃、正式日結確認同日結單輸出。

入口：
更多／工具中心
→「收銀與日結」

核心原則：
- 日結係記錄／核對／報表收口，唔係第二套交易 Authority
- Business Day 唔可以因 stale／sync failure 變成新交易 blocker
- 系統預計現金同實際點算必須分開
- 「取走」同「留櫃」必須明確記錄
- 完成後形成正式日結記錄／日報
- 已完成日結不可靜默覆寫；之後修正走 linked adjustment
- 今日留櫃可以成為下一個 Business Day Opening Cash 基礎

## 1. Page 9A｜日結主頁

### Header
顯示：
- Business Date
- 今日營業狀態
- Opening Cash
- 日結狀態：未完成／已完成
- 最近更新時間

### 主內容分四區
A. 系統預計
B. 實際點算
C. 差額／取走／留櫃
D. Final Review／確認日結

### 次要入口
- 查看今日交易摘要
- 查看 Cash Movement
- 打印日結單
- 返回工具中心

## 2. Section 9B｜系統預計現金

顯示：
- 今日 Opening Cash
- 現金銷售
- Cash In
- 現金退款／現金調整
- Cash Out
- 系統預計櫃桶現金

公式：
Opening Cash
+ Cash Sales
+ Cash In
- Cash Refund / Cash Adjustment
- Cash Out
=
Expected Drawer Cash

### 原則
全部係正式已知事實投影。
唔可以人手直接改 Expected Total。

如來源有問題：
→ Deep-link 去對應來源
例如 Cash Movement → Stage 8。

## 3. Section 9C｜實際點算模式

支援兩種模式：

A. 按面額點算
B. 直接輸入總額

兩者最後只產生一個：
Actual Counted Cash

切換模式：
唔應清除已經輸入嘅合理資料，除非員工明確 Reset。

## 4. Surface 9D｜按面額點算

至少支援：
- $1
- $2
- $5
- $10
- $20
- $50
- $100
- $500

每一行：
- 面額
- 張／個數
- 換算小計

底部：
- 實際點算合計

### 使用場景
1. 全部用張／個數輸入
2. 部分面額為 0
3. 修正某一面額數量
4. 點算到一半返回
5. App Reload 後恢復未提交點算草稿（如已有本地草稿能力）

### 守門
- 數量不可負數
- 非整數張／個數不可接受
- 計算結果即時更新

## 5. Surface 9E｜直接輸入總額

輸入：
「實際櫃桶現金」

### UI
- 大字金額
- 數字 Keypad
- 清除
- 即時差額

### 用途
員工已經自行點算完，
只想直接輸入總額。

## 6. Section 9F｜差額

公式：
Actual Counted Cash
-
Expected Drawer Cash
=
Difference

### UI
必須顯示：
- 差額數值
- 正／負方向

例如：
+$20
＝ 實點比系統多 $20

-$50
＝ 實點比系統少 $50

### 備註
可輸入：
- 差異原因
- 現場備註

### 原則
Owner Final 未鎖「有差額就禁止日結」呢條硬規則。
Stage 9 R1：
- 差額必須清楚顯示
- 可以要求備註作營運記錄
- 不自行加入 Manager-only／硬性阻塞 Gate

## 7. Section 9G｜取走現金

輸入：
「今次取走現金」

例：
實點 $5,000
取走 $4,000

### UI
顯示：
- 實點現金
- 取走
- 留櫃

### 守門
- 取走金額不可負數
- 取走金額不可大過實際點算現金

## 8. Section 9H｜留櫃現金

公式：
Actual Counted Cash
-
Cash Removed
=
Retained Cash

例：
實點 $5,000
取走 $4,000
留櫃 $1,000

### 用途
留櫃值成為：
下一 Business Day Opening Cash 建議／基礎。

### 原則
留櫃唔可以靠系統估。
必須由今次日結實際「實點－取走」得出。

## 9. Surface 9I｜Final Review 75% Modal

開啟條件：
- 已有實際點算
- 已有取走金額
- 所有輸入合法

### 顯示
- Business Date
- Opening Cash
- Cash Sales
- Cash In
- Cash Refund／Adjustment
- Cash Out
- Expected Drawer Cash
- Actual Counted Cash
- Difference
- Cash Removed
- Retained Cash
- 備註

### Actions
主要：
「確認日結」

次要：
「返回修改」

### 核心
Final Review 前：
未正式 Close。

## 10. Day Close Commit

確認後一次建立：
- 正式 Day Close Record
- Actual Counted Cash
- Difference
- Cash Removed
- Retained Cash
- Close Timestamp
- Actor
- 正式日報／報表基礎
- 下一 Business Day Opening Cash 建議來源

### 防重
同一 Business Date：
正常日結只可以完成一次。

Double Tap：
→ 返回原成功結果
→ 不建立第二份正常日結。

## 11. Result States

### SUCCESS
日結已完成。

### KNOWN FAILURE
確定未建立 Day Close。

UI：
- 保留輸入
- 顯示原因
- 可修正／安全重試

### UNKNOWN
無法判斷是否已成功 Close。

UI：
「正在確認日結結果」

先：
Readback

找到原 Day Close：
→ 返回原成功結果

確認冇建立：
→ 先可以安全重試

禁止：
UNKNOWN → 再建第二份 Day Close。

## 12. Page 9J｜日結完成畫面

完成後顯示：
- Business Date
- 「今日日結已完成」
- Opening Cash
- Cash Sales
- Cash Refund
- Actual Counted Cash
- Difference
- Cash Removed
- Retained Cash
- Close Time
- Actor

主要 Action：
- 打印日結單
- 返回工具中心

次要：
- 查看正式日報 → Stage 10
- 查看 Cash Movement → Stage 8

## 13. Surface 9K｜日結單打印

日結完成後：
可以打印正式日結單。

### 內容至少
- Business Date
- Opening Cash
- Cash Sales
- Cash In
- Cash Refund / Adjustment
- Cash Out
- Expected Cash
- Actual Cash
- Difference
- Cash Removed
- Retained Cash
- Order / Channel / Tender summary（按正式日報資料）

### Reprint
日後再次打印：
只重印同一份日結記錄。

禁止：
打印／重印建立第二份 Day Close truth。

Printer Failure 深層處理：
→ Stage 11。

## 14. Scenario 9L｜再次進入已完成日結

如果今日已完成：
唔再顯示普通「確認日結」流程。

直接顯示：
- 已完成狀態
- 原正式數值
- 打印／重印
- 查看報表

### 禁止
正常操作重新建立 V2／V3 Day Close。

如要修正：
→ 走獨立 Adjustment／Correction，
唔覆寫原日結。

## 15. Scenario 9M｜跨日修正

日結完成後，
之後發生：
- Refund
- Cancel
- Tender Correction
- Amount Adjustment

原日報／原 Day Close：
永久保留。

後續：
建立 linked adjustment。

### UI
Stage 9 只顯：
「此日結已有後續調整」

詳細：
→ Stage 10 Adjustment History。

## 16. Scenario 9N｜下一日 Opening Cash Handoff

今日：
Retained Cash = $1,000

下一 Business Day Stage 0：
顯示：
「上一營業日留櫃 $1,000」

作為今日 Opening Cash 建議值。

### 重要
建議值 ≠ 自動確認。
下一日仍由員工實際確認。

## 17. Scenario 9O｜Business Day Boundary

Business Day 分界由正式設定提供。
例如：
05:00。

Stage 9 顯示：
- Business Date
- Cutoff / Start Boundary（如需要 Detail）

### 原則
唔用 00:00 calendar date 代替。

如果 Business Day data stale／sync 失敗：
- 顯示 Attention
- 唔應拖死本地新交易

## 18. Scenario 9P｜未解 Cash Movement

如果日結前發現：
- Cash In／Out 記錄錯漏
- Refund Cash Movement 未對上

日結頁可以：
→ Deep-link Stage 8／Stage 5 查來源

### 原則
Stage 9 唔自己改原始 Cash Movement。
只做聚合／核對。

## 19. Restart / Recovery

### 日結前
重新開 App：
恢復：
- 今日 Business Date
- 系統預計
- 已保存本地點算草稿（如有）
- 未提交狀態

### 日結提交中
Restart：
→ Readback Day Close identity

### 日結已完成
Restart：
→ 直接進已完成畫面
→ 不再建立第二份

## 20. Offline

本地日結資料要可工作。

如果 Cloud／Admin unavailable：
- 本地日結照可完成
- Sync 狀態另顯 Attention
- 之後再 Projection／Readback

Cloud Failure：
唔應變成 Close Day 永久 blocker，
更唔可以阻下一張本地交易。

## 21. Audit

正式 Day Close 至少保留：
- Business Date
- Opening Cash
- Expected Cash
- Actual Cash
- Difference
- Cash Removed
- Retained Cash
- Actor
- Timestamp
- Note
- Version／Original identity

日後 Adjustment：
獨立 linked record。

## 22. Stage 9 Page States

### 未日結
顯示正常點算流程。

### 已完成
顯示正式日結結果。

### Loading
只 Loading 日結資料。
唔遮其他營運頁。

### Stale
顯示：
「日結資料已更新，請重新核對。」

### Sync Degraded
顯示：
「本地日結已完成；雲端同步待完成。」

本地成功唔應顯示成整體 Failed。

## 23. Stage 9 明確不屬於本 Stage

- Opening Cash 首次確認 → Stage 0
- 正式付款 → Stage 2
- Refund / Tender Correction → Stage 5
- Cash In / Out → Stage 8
- 歷史日報／跨日分析 → Stage 10
- Printer Physical Recovery → Stage 11

## 24. Stage 9 UI 優先級

P0：
- Expected Cash
- Actual Count
- 面額點算
- Difference
- Removed
- Retained
- Final Review
- Day Close 防重
- Restart／UNKNOWN Recovery

P1：
- 日結單
- Cross-day Adjustment Attention
- Cash Movement Deep-link
- Sync 狀態

P2：
- 動畫
- 圖表

## 25. Stage 9 Definition of Done

1. 顯示今日 Opening／Sales／Cash In／Refund／Cash Out。
2. Expected Cash 不可直接手改。
3. 支援面額點算。
4. 支援直接輸入實際總額。
5. Difference 顯示正負方向。
6. 取走金額獨立輸入。
7. Retained Cash 自動由實點－取走計算。
8. 留櫃成為下一日 Opening 建議來源。
9. Final Review 前未正式日結。
10. 同一 Business Date 正常 Day Close 只成功一次。
11. Double Tap 不建立第二份。
12. UNKNOWN 先 Readback。
13. 完成後可打印／重印同一份日結。
14. 再次進入已完成日結唔重新 Close。
15. 舊日結不可被後續退款／修正覆寫。
16. Cross-day Adjustment append-only。
17. Business Day 用正式 boundary，唔用 00:00 偷代。
18. Cloud／Sync failure 唔阻本地交易。
19. Restart 後可恢復日結狀態。
20. 歷史／分析交 Stage 10。

## 26. 下一個 Stage
Stage 10｜報表／歷史／跨日追溯
