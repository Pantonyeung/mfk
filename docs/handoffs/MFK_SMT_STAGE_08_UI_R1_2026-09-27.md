# MFK SMT｜Stage 8 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 8｜營業中錢箱

## 0. Stage 定位
Stage 8 負責營業途中「非銷售性現金流動」同錢箱現況管理。

核心原則：
- Cash In / Cash Out 唔係 Sales
- Cash In / Cash Out 唔係 Refund
- 每一筆都要獨立記錄
- 不可直接改餘額而冇 Movement
- Stage 8 唔做日結；日結屬 Stage 9
- 錢箱數字只投影正式已知現金事實，唔靠人手改總數掩蓋差異

## 1. Page 8A｜營業中錢箱主頁

入口：
更多／工具中心
→「現金／錢箱」

### 頂部摘要
顯示：
- 今日 Opening Cash
- 現金銷售
- 現金退款／現金調整
- Cash In
- Cash Out
- 系統預計櫃桶現金
- 最近更新時間

系統預計現金：
Opening Cash
+ 現金銷售
+ Cash In
- 現金退款／現金調整
- Cash Out

### 主要 Actions
- Cash In
- Cash Out
- 查看 Movement History

### 次要入口
- 返回工具中心
- 前往 Stage 9 日結

## 2. Surface 8B｜Cash In

用途：
將非銷售現金加入錢箱。

例子：
- 補找續金
- Owner 補現金
- 其他非銷售注入

### 75% Modal
顯示：
- 類型：Cash In
- 金額
- 用途
- 備註（可選）
- 操作員
- 當前預計錢箱
- 入數後預計錢箱

### Action
主要：
「確認入櫃」

次要：
「返回」

### 成功
建立一筆 Cash Movement IN。

禁止：
- 改 Sales
- 改 Order
- 假裝成付款
- 靜默改 Opening Cash

## 3. Surface 8C｜Cash Out

用途：
營業途中由錢箱取走非退款現金。

例子：
- 攞貨
- 雜費
- 臨時支付
- 其他攞走現金

### 75% Modal
顯示：
- 類型：Cash Out
- 金額
- 用途
- 備註（可選）
- 操作員
- 當前預計錢箱
- 取出後預計錢箱

### Action
主要：
「確認出櫃」

次要：
「返回」

### 成功
建立一筆 Cash Movement OUT。

禁止：
- 當成 Refund
- 當成 Sales Adjustment
- 靜默減錢箱總數

## 4. Surface 8D｜用途選擇

Cash In 可用：
- 補找續金
- Owner 補現金
- 其他

Cash Out 可用：
- 攞貨
- 雜費
- 臨時支付
- 其他

### UI
常用原因用 Quick Reason Buttons。
另外保留：
「其他」

### 原則
用途係操作記錄／Audit，
唔係新 Accounting Engine。

## 5. Surface 8E｜金額輸入

### UI
- 大字金額
- 數字 Keypad
- 清除
- 確認

### 守門
- 金額 > 0
- 禁止負數
- 禁止 NaN / 非數字
- Cash Out 金額若超出合理可操作範圍，要明確提示

### 注意
Owner FINAL 冇鎖「Cash Out 不可大過系統預計錢箱」呢條硬規則。
所以 Stage 8 R1：
- 可以顯示 Warning
- 不自行加死鎖
- 最終是否要硬性阻止，留後續 Addendum

## 6. Surface 8F｜Movement Final Review

提交前顯示：
- Cash In / Out
- 金額
- 用途
- 備註
- 操作員
- 原預計錢箱
- 新預計錢箱

主要 Action：
「確認」

次要：
「返回修改」

### 核心
Confirm 先建立 Movement。

## 7. Result States

### SUCCESS
顯示：
- 已記錄
- Movement Type
- 金額
- 新預計錢箱
- 時間

### KNOWN FAILURE
明確冇建立 Movement。

UI：
- 保留輸入
- 顯示原因
- 可修正再提交

### UNKNOWN
無法判斷有冇成功寫入。

UI：
「正在確認現金記錄」

先：
Readback

找到原 Movement：
→ 回原成功結果

確認冇建立：
→ 才可安全重試

禁止：
UNKNOWN → 直接再建一筆

## 8. Surface 8G｜Movement History

### List
每筆顯示：
- 時間
- IN / OUT
- 金額
- 用途
- 操作員
- 備註（有先顯示）

### Filter
- 全部
- Cash In
- Cash Out
- 今日

### 排序
最新在上。

### 點擊
→ Detail

## 9. Surface 8H｜Movement Detail

顯示：
- Movement ID（技術 ID 不放主列表）
- 類型
- 金額
- 用途
- 時間
- 操作員
- 備註
- 建立前預計錢箱
- 建立後預計錢箱

### 原則
Movement 記錄屬歷史證據。
唔提供「直接改金額」入口。

如真係輸入錯：
應走獨立 correction / linked adjustment，
Stage 8 R1 唔自行新增 delete / overwrite。

## 10. Scenario 8I｜補找續金

例：
開工後發現散紙不足。

操作：
Cash In
→ 用途「補找續金」
→ 輸入 $500
→ Confirm

結果：
Cash Movement IN +$500

System Expected Cash：
即時 +$500

## 11. Scenario 8J｜Owner 補現金

用途：
非銷售、非客戶付款嘅額外資金。

操作：
Cash In
→ Owner 補現金
→ 金額
→ Confirm

結果：
唔增加 Sales。

## 12. Scenario 8K｜攞貨／雜費

例：
由錢箱拎 $120 買材料。

操作：
Cash Out
→ 攞貨
→ $120
→ 備註（可選）
→ Confirm

結果：
Cash Movement OUT -$120

Sales：
不變。

## 13. Scenario 8L｜臨時支付

操作：
Cash Out
→ 臨時支付
→ 金額
→ 備註
→ Confirm

用途：
保留現場責任追蹤。

## 14. Surface 8M｜System Expected Cash

主頁持續顯示：

Opening Cash
+ Cash Sales
+ Cash In
- Cash Refund / Cash Adjustment
- Cash Out
= Expected Drawer Cash

### UI
每一項可展開睇來源摘要。

### 原則
只係 read model。
唔可以直接點總數改 Balance。

## 15. Scenario 8N｜Cash Refund 關係

如果 Stage 5 做 Cash Refund：

Stage 8 History：
應見到一筆對應 Cash Movement OUT／退款來源。

但 Stage 8：
唔可以自己建立一筆叫「Refund」去改 Order 財務結果。

Refund Authority：
仍然係 Stage 5／Payment domain。

Stage 8 只投影現金 Movement。

## 16. Scenario 8O｜Opening Cash 關係

Stage 0 已確認 Opening Cash。

Stage 8：
只讀今日 Opening Cash。

禁止：
營業途中直接改 Opening Cash。

如果之後再加現金：
→ Cash In

再取現金：
→ Cash Out

## 17. Scenario 8P｜日結關係

Stage 8：
只處理營業中 Movement。

Stage 9：
先做：
- 實點
- 差額
- 取走
- 留櫃
- 日結確認

Stage 8 頂部可以有：
「前往日結」

但唔喺 Stage 8 完成 Close Day。

## 18. Restart / Recovery

App Restart 後：
重新讀：
- Opening Cash
- Cash Sales
- Cash Refund
- Cash In
- Cash Out
- Expected Drawer Cash
- Movement History

禁止：
靠 UI Cache 自己累加。

### Duplicate Submission
同一 Movement submission identity：
只可以建立一次。

## 19. Offline

SMT Offline：
Cash In／Out 仍要可本地記錄。

要求：
- 本地 durable
- Restart 後保留
- Cloud 恢復後再投影／同步
- Cloud failure 唔阻現場錢箱記錄

## 20. Audit

每筆 Cash Movement 最少保留：
- 金額
- 用途
- 時間
- 操作員
- 備註（可選）
- 類型 IN / OUT

UI 前線只顯人類可理解資料。
工程 IDs 收入 Detail／Diagnostics。

## 21. Stage 8 Page States

### Normal
顯示 Summary + Actions + History。

### Empty History
「今日未有額外 Cash In／Out」

### Loading
只 Loading Movement 區。
唔遮 SMT 其他營運頁。

### Error
讀取 History 失敗：
保留最後已確認 Summary，
標示資料未更新。

### Stale
顯示：
「錢箱資料已更新，請重新核對後再操作。」

## 22. Stage 8 明確不屬於本 Stage

- Opening Cash 首次確認 → Stage 0
- Customer Payment → Stage 2
- Refund Decision → Stage 5
- Capacity → Stage 7
- 實點／日結／留櫃 → Stage 9
- Reporting → Stage 10
- Printer → Stage 11

## 23. Stage 8 UI 優先級

P0：
- Cash In
- Cash Out
- Expected Drawer Cash
- Final Review
- Movement History
- Duplicate / UNKNOWN 防重
- Restart / Offline

P1：
- Quick Reasons
- Detail
- Source breakdown
- 日結快捷入口

P2：
- 動畫
- 圖表

## 24. Stage 8 Definition of Done

1. Cash In / Out 有獨立入口。
2. Cash In / Out 唔混入 Sales。
3. Cash Out 唔混入 Refund。
4. 每筆記錄有金額、用途、時間、操作員、備註。
5. 補找續金／Owner 補現金可記錄。
6. 攞貨／雜費／臨時支付可記錄。
7. Expected Cash 按正式公式投影。
8. Opening Cash 不可營業途中直接改。
9. Cash Refund 由 Stage 5 產生，Stage 8 只反映 Movement。
10. Confirm 前唔建立 Movement。
11. UNKNOWN 先 Readback，唔重複建立。
12. Movement History 不可直接覆寫。
13. Restart 後記錄仍在。
14. Offline 仍可本地記錄。
15. Stage 8 唔做日結。
16. 完成後可返回營運頁或進 Stage 9。

## 25. 下一個 Stage
Stage 9｜日結／留櫃
