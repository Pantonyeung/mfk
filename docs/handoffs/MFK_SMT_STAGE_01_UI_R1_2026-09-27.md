# MFK SMT｜Stage 1 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 1｜現場建單／草稿

## 0. Stage 定位
Stage 1 係 SMT 日常最高頻工作區。
目標係用最少中斷完成：
找商品 → 加入 Cart → 必要配置 → 整理／修改 → 暫存／堂食／Checkout。

Stage 1 仍然只係「交易意圖／Cart」。
除非進入 Stage 2 並完成最終付款確認，否則：
- 不建立正式 Order
- 不鎖正式 Display Number
- 不產生首次正式 Print Admission
- 不送正式 Production side-effect

## 1. Page 1A｜點單工作台主畫面

### 固定版面
A. 左側高頻導航
- 點單
- 訂單
- 堂食
- 售罄／產能

B. 頂部 Incoming Strip
- 自家客戶端待處理
- Keeta
- 只顯摘要／件數／Attention
- 點卡先進 Stage 3 Review
- Stage 1 唔直接喺 Strip 內完成接受

C. 中央上方 Category
- 橫向排列
- 可按顯示設定調行／列／密度
- Admin 正式 Category 排序
- 當前選中清楚

D. 中央 Product Grid
- 4 欄為主要 Desktop baseline
- Product Card 大字產品名
- 價格
- 可選圖片
- 售罄／暫停狀態
- 三點「更多配置」

E. 中央底部三個 Fast Lane
- 快速組合
- 必選／補選
- 紫米套餐

F. 右側 Cart / Live Check
- 流水號預覽
- 原單／整理
- 堂食／外賣
- Combine
- 商品行
- 小計／總額
- 暫存／堂食
- 清除
- Checkout

### 目的
正常店內點單時，員工主要視線只需：
Product → Cart → 下一個 Product。

## 2. Page 1B｜商品快速加入

### Scenario A｜冇 Required
點 Product Card
→ 直接加入 Cart
→ Cart 即時出現
→ Product Grid 保持原位置

### Scenario B｜Quick Mode + 有 Required
點 Product Card
→ 先加入 Cart
→ 顯示「未完成必選」狀態
→ 必選／補選 Fast Lane count +1
→ 可以繼續點下一件商品

核心：
Quick Mode 只延後 Required，
唔取消 Required。

### Scenario C｜Normal Mode + 有 Required
點 Product Card
→ 開 Product Config 75% Modal
→ 完成 Required
→ 加入 Cart

### Scenario D｜點產品卡三點
無論 Quick／Normal：
→ 主動開 Product Config Modal

## 3. Surface 1C｜Product Config 75% Modal

### 上方
- Product 名稱
- 當前價格
- 狀態／售罄（如需要）

### 左側
可滾動：
- Variation
- Required
- Optional
- Modifier
- Combo content
- 備註

### 右側固定摘要
- 已選內容
- 數量
- 價格變化
- 最終單件價

### 底部固定
- 數量
- 價格結果
- 主要 Action

新增商品：
「加入購物車」

編輯既有 Cart Line：
「完成修改」

### 使用場景
1. Required Single Select
2. Required Multi Select
3. Optional
4. Min／Max
5. Modifier 加價
6. Modifier 減價
7. 售罄 Option
8. Combo Child
9. 數量
10. 備註
11. Dirty Close

### Dirty Close
無修改：
X／Backdrop → 即時離開

有未保存修改：
→ Confirm「放棄修改？」

## 4. Page 1D｜Cart 商品行

### 每行固定內容
左：
- 行序號
- 堂／外 Badge

中：
- 大字 Product Name
- Option／Modifier
- Combo Detail
- 備註

右：
- 價格
- Delete
- Combine 狀態時顯示 - / Qty / +

### 操作
點商品行：
→ 打開 SAME Line Product Config
→ 修改完成更新原 Line

禁止：
Edit → Add second line

### 堂／外
每一行可獨立 Override。

## 5. Cart Top Controls

### 5.1 流水號預覽
顯示：
目前大概下一個流水號。

語義：
Preview only。

禁止：
開 Cart 就正式佔號。

### 5.2 原單／整理

原單：
客戶講單實際輸入次序。

整理：
按 Admin Category 正式排序重新排列。

重要：
整理只改 View Ordering，
唔改商品內容，
唔合併數量。

### 5.3 堂食／外賣
一鍵改整張 Cart。

每個 Line 仍可再獨立 Override。

### 5.4 Combine
OFF：
每件商品獨立一行。

ON：
只合併「完全相同 configuration」嘅 Line。

不同：
- Option
- Combo
- Remark
- Service Mode

不可盲合併。

## 6. Fast Lane 1E｜快速組合

### 目的
快速將多個飯團同多個小食配成正式組合。

### 顯示
左：
可配飯團 Pool

中：
A / B / C / D / …
動態 Slot

右：
可配小食 Pool

### Auto Pair
只按目前順序：
第1飯團 ↔ 第1小食
第2 ↔ 第2
……

禁止：
- 推薦
- AI 配搭
- 自動改排序
- 自動補商品

### 數量不相等
3 飯團 + 2 小食
→ 2 組
→ 1 飯團保持單點

2 飯團 + 3 小食
→ 2 組
→ 1 小食保持單點

### Swap
A 想用已屬 C 嘅小食：
→ A / C 交換
→ 不複製
→ 不刪除
→ 總商品數保持一致

### 返回
退出後可再次進入修改。

## 7. Fast Lane 1F｜必選／補選

### 目的
集中處理 Quick Mode 留低嘅 Required。

### List
每張 Task 顯示：
- Cart Line
- Product
- 欠邊個 Required Group
- 已選／未選

### 操作
點 Task
→ 直接打開對應 Required Group

完成：
→ Task 消失

全部完成：
→ 顯示「必選已齊」

### Checkout Guard
Required 未完成時：
Checkout 不可正式進 Stage 2。

UI 可以：
- Checkout disabled
或
- 點擊後直接帶回第一個未完成 Required

唔可以：
靜默放行。

## 8. Fast Lane 1G｜紫米套餐

### 入口
A／B／C／D 套餐。

### Flow
揀套餐
→ 飯團
→ 小食
→ 飲品
→ Review
→ 加入 Cart

### 原則
套餐規則完全讀正式 Admin Combo 定義。

Fast Lane 唔自己維護：
- 價錢
- 可選內容
- Required
- 禁配
- 售罄

### 單點守門
只有飯團／小食／飲品：
→ 保持單點

只有員工明確執行套餐操作：
→ 先建立 Combo identity。

## 9. Surface 1H｜暫存／堂食

Cart 有商品：
底部主 Action：
「暫存／堂食」

旁邊：
細垃圾桶＝清除 Cart

### 打開後
75% Modal
Tab A：暫存
Tab B：堂食

### 預設
Cart 有任何 dine-in Line
→ 預設堂食 Tab

全部 takeaway
→ 預設暫存 Tab

但永遠可以手動切換。

### 暫存
顯示：
- Cart Summary
- 備註
- 確認暫存

成功：
→ Cart 清空
→ 返回 Stage 1 空白工作台
→ 可服務下一客

### 堂食
Stage 1 只處理「放入輪候／直接掛枱」入口：
- 人數
- 備註
- 加入輪候
- 1–8 號枱
- 戶外桌

完成後：
→ 交 Stage 6 堂食 lifecycle

## 10. Surface 1I｜空 Cart／取回訂單

Cart 為空時：
原本「暫存／堂食 + 清除」
→ 變成長按鈕「取回訂單」

點擊：
→ 暫存單列表

每張顯示：
- 暫存碼
- 類型
- 商品摘要
- 件數
- 金額
- 建立時間

操作：
「取回購物車」

取回後：
→ 回 Stage 1
→ 原 Cart data 完整恢復

## 11. Surface 1J｜清除 Cart

入口：
Cart 底部細垃圾桶。

### 第一次點
→ Confirm Modal

內容：
- 「清除目前未完成訂單？」
- 件數
- 金額

Actions：
- 返回
- 確認清除

### 規則
只清目前 Draft Cart。

如果已經有 Formal Order／Payment／Print side-effect：
唔可以用呢個入口當 Cancel。

## 12. Stage 1 Empty / Loading / Error

### Empty
Category 有資料但冇 Product：
→ 「此分類暫無可售商品」

Search / Filter 無結果：
→ 清楚 Reset path

Cart Empty：
→ 顯示取回訂單入口

### Loading
首次 Menu Local LKG：
只可以短 loading。

如果已有 LKG：
先顯可操作舊有效版本，
背景更新唔可以遮住整個 Stage 1。

### Error
Product Add Validation：
局部提示。

Menu update fail：
保留上一份 LKG。

Cloud fail：
唔清 Cart。

## 13. Stage 1 Silent Guided Flow

唔做 Wizard。

視覺優先次序：
1. Required 未完成
2. Quick Drink／補選
3. Combo blocker
4. 快速組合
5. Checkout
6. Product Grid

只用：
- focus
- badge
- border
- highlight
- count

禁止：
「下一步」
「上一步」
自動成交。

## 14. Stage 1 UI 優先級

P0：
- Product Select
- Cart
- Required
- SAME Line Edit
- Checkout Guard
- 暫存／取回
- 堂／外
- Combine

P1：
- 快速組合
- 紫米套餐
- Silent Guidance
- Display Settings integration

P2：
- 視覺 polish
- 動畫
- 非必要微互動

## 15. Stage 1 明確不屬於本 Stage

以下唔喺 Stage 1 完成：
- Customer Pending 接受／拒絕 → Stage 3
- Keeta 接單決定 → Stage 3
- 正式付款 → Stage 2
- 正式 Order → Stage 2 Commit 後
- 出餐狀態 → Stage 4
- Refund／Payment Correction → Stage 5
- 堂食管理 → Stage 6
- 售罄管理 → Stage 7
- Cash／Day Close → Stage 8／9

## 16. Stage 1 Definition of Done

1. 店員可由 Category / Product 快速建立 Cart。
2. Quick / Normal 行為清楚。
3. Required 不會被 Quick Mode 取消。
4. 未完成 Required 唔可進正式 Checkout。
5. Edit Cart Line 只更新 SAME Line。
6. 原單／整理只影響顯示排序。
7. Combine 只合完全相同配置。
8. 堂／外支援整單＋Line Override。
9. 快速組合不新增／丟失商品。
10. 紫米單點唔會被自動升級套餐。
11. 暫存後可以完整取回。
12. 「暫存／堂食」自動預設但可 Override。
13. 清除 Draft 有二次確認。
14. Cloud／Admin 更新失敗唔清 Cart。
15. Stage 1 全程不提前建立 Formal Order／Payment／首次 Print。
16. Checkout 成功交 Stage 2。

## 17. 下一個 Stage
Stage 2｜Checkout／付款／正式成交
