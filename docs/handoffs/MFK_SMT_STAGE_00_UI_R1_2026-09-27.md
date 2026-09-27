# MFK SMT｜Stage 0 功能 UI 設計 R1
日期：2026-09-27
狀態：TEXT STRUCTURE ONLY / NO VISUAL PRODUCTION
依據：MFK SMT Product Brief R1 + MFK SMT UI Stage Map R1
範圍：Stage 0｜啟動／登入／開更

## 0. Stage 定位
Stage 0 係「由 App 啟動到正式進入點單」嘅完整前線旅程。
唔係首頁，亦唔係設定中心。
完成後直接進 Stage 1 點單工作台。

核心目標：
- 確認 Runtime 可用
- 確認操作員身份
- 必要時完成首次登入／裝置必要設定
- 讀取上一營業日可信留櫃現金
- 核對今日 Opening Cash
- 完成 Opening Confirm
- 直接進點單

## 1. Page 0A｜Boot / Loading

### 目的
啟動 SMT、初始化本地 Runtime、讀取本地 LKG／裝置狀態，同時提供品牌承載。

### 畫面分區
A. 中央品牌區
- 磨飯 Logo
- MoreFunOS SMT
- 簡短啟動狀態

B. 底部狀態區
- 本地資料
- 裝置
- Admin Config LKG
- Printer Bridge
- Network
- 只顯人類可理解摘要

### 使用場景
1. 正常啟動
2. WAN Offline 但本地可用
3. Admin 不可達但 Local LKG 可用
4. Printer Bridge 暫不可用
5. 本地 Runtime 初始化失敗
6. App Restart 後恢復

### UI 行為
- 正常：短暫 Loading 後自動進 Login
- 可降級：顯示「離線模式／部分功能暫不可用」，仍可進 Login
- 真正不可用：顯示 exact failure + 安全 Retry／Diagnostics 入口
- 禁止無限 Loading
- 禁止用「背景同步中」代替狀態

### Exit
成功／可降級 → Page 0B Login
不可安全繼續 → 停留並顯示 Recovery


## 2. Page 0B｜員工登入

### 目的
確認目前操作 SMT 嘅員工身份。

### 畫面分區
A. 品牌／門店識別
B. 員工選擇
C. PIN Keypad
D. 登入狀態／錯誤
E. 低權重輔助入口：切換員工／診斷

### 使用場景
1. 正常員工登入
2. PIN 錯誤
3. 員工停用／無效
4. 本機已有上次員工但仍需重新確認
5. 離線登入（使用本地有效身份資料）
6. 首次裝置／首次員工登入

### UI 行為
- 員工選擇後輸入 PIN
- 錯誤直接 inline 顯示
- 不清空整頁
- 不顯 UUID／工程 ID
- 登入成功後先判斷是否需要 First Login branch

### Exit
需要首次設定 → Page 0C
不需要 → Page 0D


## 3. Page 0C｜首次登入／必要設定

### 定位
只在真正需要時出現。
唔可以變成每次開機都要經過嘅 Setup Wizard。

### 可能內容
- 裝置名稱／工作站識別
- 必要本地 Printer／Device readback
- 必要 Admin Config 初次取得／LKG 建立
- 必要權限／信任狀態

### 使用場景
1. 新裝置
2. 首次成功下載有效 Config
3. 必要裝置未綁定
4. Config 有效但 Printer 未設定
5. 非必要設備故障

### 守門
只阻真正「無法安全開始本地交易」嘅必要項。
Printer／Cloud／Owner／Reporting 等非必要域唔應阻 Stage 0 完成。

### Exit
必要項完成 → Page 0D


## 4. Page 0D｜上一營業日留櫃現金 Readback

### 目的
讀取上一個已完成日結可信記錄，提供今日 Opening Cash 建議值。

### 畫面分區
A. 上一營業日
B. 昨日實點現金
C. 昨日取走現金
D. 昨日留櫃現金
E. 今日建議 Opening Cash

### 使用場景
1. 有完整可信留櫃記錄
2. 有日結但冇明確留櫃值
3. 冇上一日日結
4. 上一日記錄存在但 readback 異常
5. 跨日／05:00 Business Day boundary

### UI 行為
- 有可信數據：預填建議值
- 無可信數據：明確寫「系統唔會估數」
- 不可因 Business Day stale 阻交易
- 顯示「建議」同「今日實際」係兩回事

### Exit
→ Page 0E


## 5. Page 0E｜今日 Opening Cash 核對

### 目的
由員工確認今日真正放入錢箱嘅 Opening Cash。

### 畫面分區
A. 建議留櫃值
B. 今日實際 Opening Cash
C. 差異
D. 差異原因／備註
E. 確認按鈕

### 使用場景
1. 完全一致
2. 今日多咗現金
3. 今日少咗現金
4. 無建議值，完全人手輸入
5. 輸入錯誤／負數／空值

### UI 行為
- 預填 ≠ 自動確認
- 員工必須明確確認
- 差異要直接顯示正／負
- 差異可記錄原因
- 不可靜默修改昨日記錄
- 今日 Opening Cash 係新營業日事實

### Exit
→ Page 0F


## 6. Page 0F｜Opening Confirm

### 目的
最後一次確認今日開更資料，之後直接進點單。

### Final Review 顯示
- 員工
- 今日營業日
- Opening Cash
- 與昨日留櫃差異
- 備註（如有）
- Offline／Degraded 狀態提示（如有）

### 主要 Action
「確認開工」

### 次要 Action
「返回修改」

### 使用場景
1. 正常確認
2. Double Tap
3. 保存成功
4. 保存 Failure
5. 保存結果 UNKNOWN
6. App 在確認後重開

### 守門
- Confirm 只可以成功一次
- Double Tap 不得建立兩次 Opening record
- UNKNOWN 必須 readback
- Restart 後讀返同一份 Opening record
- 成功後唔再出任何 Home Page

### Exit
成功 → Stage 1 點單工作台


## 7. Stage 0 全局錯誤層

### 可降級但可繼續
- WAN Offline
- Admin 暫不可達但 LKG 存在
- Printer Offline
- Owner 不可達
- Reporting unavailable

### 必須停低
- Local Runtime 無法初始化
- 本地身份資料不可驗
- Opening Confirm 寫入結果無法判斷而又冇 readback path

### 呈現
錯誤要顯示：
- 發生邊一步
- 已成功咗乜
- 而家狀態
- 下一個安全動作

唔准：
- 總 FAIL
- 無限 Loading
- 自動 blind retry


## 8. Stage 0 UI 優先級

P0：
- Boot state clarity
- Login speed
- Opening Cash clarity
- Confirm once
- Restart recovery

P1：
- 品牌 polish
- 動畫
- 微互動
- 深層 diagnostics 展開

## 9. Stage 0 Definition of Done

1. App 啟動後可以清楚判斷 local ready / degraded / blocked。
2. 員工登入有明確成功／失敗。
3. First Login 只在必要時出現。
4. 上一日留櫃有可信數據先預填。
5. 冇可信數據時系統唔估。
6. 今日 Opening Cash 必須由人確認。
7. Confirm idempotent。
8. Restart 後可讀返同一 Opening record。
9. 非必要 Online Domain 故障唔阻開工。
10. 成功後直接進 Stage 1 點單，無 Home Page。

## 10. 下一個 Stage
Stage 1｜現場建單／草稿
