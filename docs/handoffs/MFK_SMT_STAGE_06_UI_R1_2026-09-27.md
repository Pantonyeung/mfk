# MFK SMT｜Stage 6 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 6｜堂食／輪候

## 0. Stage 定位
Stage 6 負責堂食客由「未有位／已有位」開始，到落單、加單、轉枱、分項付款、全數付款、釋枱完成嘅完整前線旅程。

核心原則：
- 堂食係正式 Order lifecycle 嘅另一種服務情境，唔係第二套 Order Engine
- 輪候單可先點餐、先正式落單、先出製作
- 有位後將 SAME Order 移入桌台
- 真正付款統一回 Stage 2 Checkout
- 付款完成即可結束，唔增加「已上餐」「清枱」等多餘狀態
- 全程保留 SAME Order identity、付款歷史、桌台歷史

## 1. Page 6A｜堂食主畫面

### 固定三欄
左：輪候／叫號
中：3×3 桌台
右：選中桌台／堂食單詳情

### 中央 3×3
- 1 號枱
- 2 號枱
- 3 號枱
- 4 號枱
- 5 號枱
- 6 號枱
- 7 號枱
- 8 號枱
- 戶外桌

### 每格最少顯示
- 桌號
- 空閒／使用中
- 人數
- 開始用餐時間
- 已用分鐘
- 未付款／部分付款／已付款摘要
- 超時警示（如有）

## 2. 左欄 6B｜輪候列表

每張輪候卡：
- 輪候號／識別
- 人數
- 建立時間
- 已等待分鐘
- 是否已點餐
- 商品件數
- 金額
- 是否已有正式 Order
- 備註

主要 Action：
- 查看
- 安排入座
- 繼續點餐／加單
- 取消輪候（受正式 Order／Production 狀態限制）

### Empty
「目前冇輪候客人」

## 3. Scenario 6C｜有位直接入座

流程：
選空枱
→ 輸入／確認人數
→ 進點單
→ 落單
→ 出製作
→ 可繼續加單
→ 可直接付款

唔需要：
- 已上餐狀態
- 清枱狀態
- 等待中間狀態先付款

付款完成：
→ 結束堂食
→ 釋放桌台

## 4. Scenario 6D｜無位先輪候

流程：
新增輪候
→ 人數
→ 備註
→ 保存

之後可以：
A. 只等位
B. 先點餐

### 先點餐
輪候
→ 點餐
→ 正式落單
→ Production
→ Order 繼續掛喺輪候位置

有位後：
→ 指定桌台
→ SAME Order 移入桌台
→ 唔建立第二張 Order

## 5. Surface 6E｜新增輪候 Modal

顯示：
- 人數
- 備註
- 建立輪候

可選：
- 建立後立即點餐
- 只建立輪候

主要 Action：
「加入輪候」

### 守門
人數最少 1。
空值／非法值唔可保存。

## 6. Scenario 6F｜安排輪候入座

點輪候卡
→「安排入座」
→ 顯示 3×3 桌台

可選：
只顯示可用桌台為主要候選，
已佔用桌台不可直接覆蓋。

選桌：
→ Confirm
→ SAME Order／同一輪候身份連到指定 Table Session

結果：
- 從輪候區移除
- 中央桌台變使用中
- 右側 Detail 顯示完整堂食資料

## 7. 右欄 6G｜桌台詳情

Header：
- 桌號
- 人數
- 開始用餐時間
- 已用分鐘
- 堂食 Order 號
- 付款狀態

商品區：
- Product
- Qty
- Option／Modifier
- Combo
- 備註
- 金額
- 已付／未付狀態

Summary：
- 總件數
- 原總額
- 已付
- 未付
- Payment History

主要 Actions：
- 加單
- 付款
- 轉枱
- 併枱／拆枱
- 修改人數
- 打印／重印

次級：
- 取消堂食單（按狀態守門）

## 8. Scenario 6H｜加單

入口：
桌台詳情 → 加單

行為：
→ 進 Stage 1 點單工作台嘅堂食加單模式

Header 要清楚顯示：
「X 號枱 · 加單」

新增商品：
→ 加入 SAME Dining Order
→ 只對新加入項目產生應有 Production／Print side-effect

完成：
→ 返回 Stage 6
→ 原桌台／用餐計時保持

禁止：
- 建第二張堂食 Order
- 重印舊有已出商品
- 清走原有付款歷史

## 9. Scenario 6I｜轉枱

入口：
桌台詳情 → 轉枱

流程：
選新桌
→ Confirm
→ 原桌釋放
→ 新桌接手 SAME Dining Order

顯示：
原桌
→ 新桌

保持：
- Order
- 商品
- 付款
- 開始用餐時間
- 已用分鐘

已佔用桌台：
不可直接覆蓋。

## 10. Scenario 6J｜併枱／拆枱

### 併枱
主桌台詳情
→ 併枱
→ 選另一可用桌

結果：
同一堂食單可同時佔用多個桌位，
但 Order identity 唔變。

### 拆枱
選已併入桌台
→ 拆除

結果：
- 該桌釋放
- 主桌 Order 保持
- 商品／付款唔受影響

### 原則
併枱係 Table Assignment，
唔係合併兩張 Order。

## 11. Scenario 6K｜修改人數

入口：
桌台詳情 → 人數

修改：
例如 2 → 4

結果：
只改 Party Size。

保持：
- Order
- 商品
- Payment
- Table
- 開始用餐時間

## 12. Scenario 6L｜用餐計時／超時警示

### 開始
正式入座後記錄 Seated At。

顯示：
- 開始時間
- 已用分鐘

### Admin 可設定
用餐警示分鐘。

到達門檻：
整張桌台格顯示警示狀態。

產品語義：
只係營運提醒。

唔可以：
- 自動趕客
- 自動結帳
- 自動取消

## 13. Scenario 6M｜堂食分項付款

### 核心
按商品分拆付款，
唔受人數限制。

例：
4 位客人
10 件商品
→ 最多可以按 10 件商品拆出付款部分

### UI
商品行加入 Select 狀態。

右側付款摘要：
- 已選商品
- 已選金額
- 未付款餘額

Action：
「去付款」

→ 交 Stage 2 Checkout

## 14. Scenario 6N｜Partial Payment

Stage 2 成功後返回 Stage 6。

右側更新：
- Payment History 新增一筆
- 已付商品鎖定為已付
- 未付商品繼續可選
- Remaining Amount 更新

桌台：
繼續保持使用中。

禁止：
Partial Payment 後釋枱。

## 15. Scenario 6O｜Full Payment

最後一部分付款成功：

結果：
- Remaining = 0
- Payment History 完整保留
- 商品保留
- Last Table 保留
- 堂食 Order 進完成
- 同一保存動作釋放桌台

UI：
顯示短暫「已完成結帳」
→ 桌台回空閒

Reload 後：
仍然可以喺 History 睇返完整付款歷史。

## 16. Surface 6P｜堂食付款 Recovery

### 入 Checkout 前保存 UI Intent
- submissionId
- expectedRevision
- selected items

只用作：
UI Recovery

唔係第二 Payment DB。

### 未付款 Reload
恢復原 selected items／Checkout Intent，
唔自動付款。

### 已付款 Reload
讀原付款：
- Tender
- Received
- Change
- Completion Review

唔再收第二次。

### Stale
如果 Dining Revision 已更新：
→ 阻舊 Checkout
→ 返回 Stage 6 Fresh Read

## 17. Surface 6Q｜堂食打印／重印

桌台詳情可直接：
- 廚房製作單
- 打包單
- 堂食枱單／未結帳即時小票
- 堂食相關 Label

### 堂食枱單
未結帳都可以打印。

用途：
- 上餐
- 桌台核對
- 堂食中途查看

唔代表：
- 已付款
- 已完成

### Reprint
保持 Order 不變。
Printer Failure 深層處理交 Stage 11。

## 18. Scenario 6R｜堂食取消

### 未付款堂食
入口：
桌台詳情 → 取消

Confirm：
- Order
- 桌號
- 商品
- Production 狀態
- 取消原因

如果未付款：
取消唔等於退款。

如果已出 Production：
按 Stage 5 規則產生取消通知。

成功：
- SAME Order 取消
- 桌台釋放
- 唔自動退款
- 唔自動開 Drawer

### 已有付款
不可用簡單「取消堂食」掩蓋售後財務流程。
應轉 Stage 5 Refund／Correction。

## 19. Scenario 6S｜背景刷新／Concurrency

### 要求
背景資料更新時：
- 唔清除員工已選付款商品
- 唔令當前桌台 Detail 無故跳走

### 轉枱／併枱
舊 async response 唔可以覆蓋最新操作。

### Revision
堂食資料每次 mutation 都要基於最新 revision。

Stale：
→ Reject
→ Fresh Read
→ 人手重新確認

## 20. Scenario 6T｜App Restart

Restart 後恢復：
- 輪候列表
- 桌台佔用
- SAME Dining Order
- Party Size
- Seated At
- 商品
- Payment History
- Remaining Amount
- 併枱資料
- Attention

禁止：
- 桌台全部變空
- 已付款部分消失
- 已成功付款再收一次

## 21. Stage 6 Page States

### 空桌
顯示：
- 桌號
- 空閒
- 主要 Action「開枱／入座」

### 使用中
顯示：
- 人數
- 用餐時間
- Payment Status

### 超時
同一桌台資訊保留，
增加 Warning 視覺。

### Loading
只 Loading 受影響 Detail／Action。
唔遮全堂食頁。

### Error
例如轉枱失敗：
原桌／Order 保留，
顯示明確錯誤。

## 22. Stage 6 明確不屬於本 Stage

- 一般現場 Cart 建立 → Stage 1
- 真正付款執行 → Stage 2
- 正式售後 Refund／Payment Correction → Stage 5
- 售罄／產能 → Stage 7
- 日結 → Stage 9
- Printer Physical Recovery → Stage 11

## 23. Stage 6 UI 優先級

P0：
- 輪候
- 3×3 桌台
- 桌台 Detail
- 直接入座
- 輪候轉枱
- 加單
- 分項付款
- Partial／Full Payment
- 自動釋枱
- Restart Recovery

P1：
- 轉枱
- 併枱／拆枱
- 修改人數
- 超時警示
- 堂食打印／重印

P2：
- 動畫
- 額外視覺 polish

## 24. Stage 6 Definition of Done

1. 左輪候／中桌台／右 Detail 三欄清楚。
2. 3×3 固定為 1–8 號枱＋戶外桌。
3. 有位可直接入座。
4. 無位可先輪候。
5. 輪候可先正式落單／出製作。
6. 有位後 SAME Order 移入桌台。
7. 已佔用桌台不可被覆蓋。
8. 加單加入 SAME Dining Order。
9. 轉枱保持 Order／Payment／Seated At。
10. 併枱只改 Table Assignment，不合併 Order。
11. Party Size 可獨立修改。
12. 超時只做營運提醒。
13. 分項付款按商品，不受人數限制。
14. Partial Payment 不釋枱。
15. Full Payment 完成後自動釋枱。
16. Payment History 永久保留。
17. Reload／Restart 不重收款。
18. 堂食枱單未結帳都可打印，但唔代表已付款。
19. 未付款取消唔自動退款。
20. 已有付款嘅取消／退款交 Stage 5。
21. Stale Revision fail-closed。
22. 完成後桌台回空閒，歷史仍可追溯。

## 25. 下一個 Stage
Stage 7｜售罄／產能／接單控制
