# MFK SMT｜堂食操作 R1｜2026-09-25

## 狀態及邊界
MILESTONE: DINING_INTERACTION_R1_BROWSER_PASS
OWNER_ACCEPTANCE_PENDING / NOT_FULL_DINING_ACCEPTANCE / NO_MAIN_MERGE

- Control: Pantonyeung/mfk #22；work: #249；draft PR #290。
- Branch: work/MFK/SMT-OWNER-FINAL-DINING-INTERACTION-R1。
- Parent: e691aa410bf400a620ff33a353a52c8d6fa003cd（既有未合併 SMT 累積分支）。
- Tested source: 01ac33337de919935726dd0932dc17e1c0235f51。
- Main fresh-read: 6fd211c38be448dbcb4e67deb8822d9490752fc2。
- 本輪無 Main merge、無部署、無 production Customer/Keeta/outbox/print/drawer 呼叫。
- 遵守 #22 controlling comment 5831422226：不得以舊累積分支重開正式消費／投影／實體副作用。
- 產品更改只限 RuntimeDiningWorkspace.tsx + dining-interaction-r1.css。Runtime、App、Contracts、Payment、Print truth 零修改。

## 要求來源
OWNER 對 SMT 端口要求 FINAL V1.0 第18–20章。
今輪只收斂堂食操作與 Checkout 交接安全，不代表整個堂食正式交易／打印已完成。

## 已實作及實際操作驗證
1. 左輪候、中3×3桌台、右詳情；第9格顯示「戶外桌」，仍沿用 T09 identity。
2. 撳輪候單可以開右側商品詳情及分項結帳；不必先掛枱才睇到商品。
3. 原有 SAME Hold 安排入座，已有客人桌台不能被覆蓋。
4. 按商品選本次付款數量；4人、10件商品可以選10件，不以人數限制份數。
5. 無關背景更新不清掉已選數量；商品改價／換行後不沿用舊選擇。
6. 快速轉枱：舊非同步回應不得覆蓋新選中桌台。
7. 前往 Checkout 前再讀最新單；已付／剩餘不足／商品或單價改變即停止交接，顯示「訂單已更新」。
8. 按鈕同步鎖防止 double click 交出兩次 Checkout request。
9. 已有商品、付款、桌台的輪候單不能由 queue × 直接刪除；空白輪候單需確認。
10. 藍色為主；明確警示門檻才用紅色整枱提醒。無門檻時不再假定35分鐘。

## 真正 RED → GREEN
- RED run 36130390130，source f15a37fc518238d9aee9e036e10f260b4a6d9a35：舊169個單元測試及 build 通過，但 browser 2/12 PASS。
- 10個 RED 包括9個產品行為差距及1個 fixture readback 渲染時點問題；fixture已修正，沒有降低驗收條件。
- GREEN run 36131257634，exact source 01ac33337de919935726dd0932dc17e1c0235f51：unit suite PASS、build PASS、browser 12/12 PASS、獨立 HTML 離線驗證 PASS。
- Browser: Playwright Chromium，1180×820 及1920×1080；頁面無例外／無Vite error overlay；所有production HTTP請求阻擋並驗證零呼叫。
- Fixture: v2local/acceptance/dining.html + dining.tsx，純示例、in-memory、import真實堂食元件。
- Regression: v2local/acceptance/dining-proof.mjs。
- Offline pack: package-dining-preview.mjs + verify-packaged-dining.mjs。
- Artifact 10861958795，SHA256 43ec02079122175d47fbc1fd9500b20c2ab816e80faab23ca052bbe969bcebc2。
- https://github.com/Pantonyeung/mfk/actions/runs/36131257634/artifacts/10861958795
- Artifact內 dining-preview.html 是可獨立打開的示例操作頁，不是正式SMT；不收款、不打印、不讀取正式資料。
- Screenshots、report.json、standalone-proof.json 同包保存。

## 未完成／不得假裝 GREEN
1. 現有堂食 runtime 仍以 Hold/payment parts運作，未有已驗證的正式 Order link。輪候移枱現時只證 SAME Hold，不可冒稱完整 SAME formal Order 交易鏈已封版。
2. paid hold現有 clearDiningHold會刪除資料；本輪沒有自動呼叫它。付款後保留完整紀錄並自動釋枱仍需做core archive/release；畫面暫保留舊手動清枱入口，尚未滿足Owner「付款完成即可結束」全要求。
3. 正式入座時間欄位未存在，本輪顯示「掛單時間」，不以輪候起算時間冒充開始用餐時間。
4. warningMinutes僅明確輸入的展示能力。示例固定30用於測試；正式 App尚未接 Admin發布的堂食警示設定。未接時顯示未設定，不借用製作ETA/遲到時間。
5. 堂食製作／打包／未結帳枱單／Label 尚未在此cut接通，沒有聲稱實體出紙／開箱成功。
6. Checkout前fresh-read屬UI防錯，不取代原子付款guard；付款時runtime仍要再次校驗。正式commit耐久／斷電／跨裝置競態需core驗收。
7. 現場空枱直接點單導航尚未補齊；現有空枱＋輪候安排功能保留。

## 下一個最小cut
先fresh-read current Main與#22/#249，再接 SAME正式Order的堂食link、付款parts原子提交、保留歷史的自動釋枱，最後將堂食打印接到既有唯一Print Queue/Router。不得為了讓按鈕可點而另建Order/Payment/Print引擎。
