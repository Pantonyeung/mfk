# SMT 堂食真正 Checkout 接線 R3｜2026-09-25

## 狀態
DINING_REAL_CHECKOUT_R3_BROWSER_AND_OFFLINE_PASS / OWNER_ACCEPTANCE_PENDING / NOT_FULL_DINING_ACCEPTANCE

- Control #22；work #249；draft PR #297。
- Branch：work/MFK/SMT-DINING-CHECKOUT-FLOW-R3。
- Parent：R2 / PR #293 / 2d27f93c5596b0ea6f3fc6a3341ab81aff5d57a9，未合併。
- Product commit：c5975e01d5a5501c6aaddb6d24186846fe9e45ae。
- Exact final tested candidate：d329e6ac47cc4e81407fe64277cf36ea4242137a。
- Main開始實讀 b52f4e69f907be58bce768f3b58eb72d49c6af89；最後實讀 edfa165fb567f3cfb63b90effc155c9ec703ef8b（其他工作推進，本輪未改main）。
- 未merge main或parent；無部署、無正式Customer/Keeta消費、無外部投影、無打印／開櫃。

## 本輪新增實裝
1. 堂食結帳鎖定原來源：顯示堂食，所有來源按鈕disabled，handler再守一次；不能切成Foodpanda/Keeta等而令畫面付款資訊與實际提交不一致。非堂食原來源規則保留。
2. 進Checkout前保存可恢復的UI intent：submissionId、expectedRevision、選中商品；只用於恢復畫面，不是第二份Order/Payment truth。現有R2 runtime仍是付款讀寫入口並驗證版本與金額。
3. 未付款重新整理：恢復原商品集合和同一提交身份，未自行收款。實收金額重新輸入。
4. 已付款、未撳完成就重新整理：讀取原持久付款紀錄，恢復原實付／找續／付款方式及Completion Review，零新付款。例：$82商品、實收$100、找續$18。
5. 付款已保存後立即出75%核對窗，最後完成只清理UI intent並返回堂食；原R2付清釋枱與歷史保留不變。
6. 過期版本明確要求返回重新核對；儲存失敗提示保存問題並保留同一身份重試，未保存不顯示付款成功。
7. 輪候與戶外桌地點顯示修正，不再出現空白「堂食 ·  號枱」。電子支付仍保留灰色disabled鍵盤。
8. 堂食核對窗改為「堂食付款已記錄」，明示正式Order/打印尚未接通；不冒稱實體打印／開櫃已執行。

## 實際流程／隔離方式
OperationalApp → RuntimeDiningWorkspace → CheckoutPage → CheckoutWorkspace → 既有settleDiningHold → Completion Review → 返回堂食／歷史。
測試只在臨時App副本export原OperationalApp並移除RuntimeReadyActivation啟動；没有重寫Checkout或付款函數。登入／開櫃金外層不在此測試範圍。HashRouter只用於離線示例。只seed合成資料；正式orders.length一直是0，無假Order。
Browser plugin未提供，使用既有Playwright1.55.1／Chromium。所有HTTP只准loopback；離線包禁止全部HTTP(S)，報告externalRequests=0、pageErrors=0。

## RED → GREEN 證據
- RED 36137522141 / job108079076909：原187單元及build通過；真正Checkout 4/10 PASS、6/10 FAIL，重現來源可切換、reload遺失、輪候名稱和錯誤訊息問題。
- 中間36137997406：patch套用後，一項既有靜態字串測試需加入明確堂食例外；保留非堂食／平台規則断言並補channel disabled與handler guard，未刪功能測試。
- 首個GREEN 36138200847 / job108081314930：187單元、10真正Checkout、R1 12、R2 5、build全PASS；CI驗證後只提交4個產品檔案到child branch。
- 最終exact-source GREEN 36138890959 / job108083554771：38/38 test files、187/187 unit tests、真正Checkout10/10、R1 browser12/12、R2 browser5/5、離線tablet+desktop2/2、build全PASS。
- 離線file://在1180×820、1920×1080驗：全付清→reload原收據→完成→空枱→付款歷史仍在；零HTTP及零page error。
- Artifact10866255779：SHA256 c5eaccec5ddb75203bd43a3841c9f0a898141085fba4cd066682e5050e0b9298；已下載逐項核對log/report/tested-sha與截圖。
- Evidence：https://github.com/Pantonyeung/mfk/actions/runs/36138890959/artifacts/10866255779
- 可交付：dining-checkout-preview.html；dining-r3-recovered-review-tablet.png；desktop及完成後畫面。
- 本地容器管理版Chromium阻擋file://（ERR_BLOCKED_BY_ADMINISTRATOR）；沒有繞過該限制，另由正常GitHub runner Chromium完成上述離線驗證。

## 產品allowlist
- v2local/src/App.tsx
- v2local/src/features/checkout/CheckoutWorkspace.tsx
- v2local/src/features/checkout/checkout-workspace-model.ts
- v2local/src/features/checkout/dining-checkout-ui-session.ts
R3不改local-runtime付款算法、不改R1桌台UI、不改StoreKernel／定價／打印引擎。apply-dining-checkout-r3.mjs為hash-pinned重現patch，遇已套用marker即no-op；CI只准驗證後push本child branch。

## 明確未完成
- 堂食正式Order link、未付款正式落廚／打印、付款小票／Label／cash drawer仍未接通；不能用本機Hold付款UI完成冒稱整條正式交易完成。
- 複合付款仍沿用既有COMBO形狀；未聲稱完整split tender明細。
- 跨分頁／跨裝置並行、原生StoreKernel斷電恢復、Safari/iPad真機、登入外層未由本輪證明。
- 真實入座時間、Admin用餐警示、空枱直接點單仍未處理。
- 既有bundle較大、iconv string_decoder browser externalization建置warning保留；本輪實測路徑零page error，非全系統性能封版。
- #22已接受的實機基線不重開；主線SMM/Owner公網驗收不受影響。

## 下一刀
先fresh-read main/#22，沿現有唯一正式Order與payment parts／Print authority接堂食未付訂單；不要付款時另造一张假已付Order，不重做已bank的R1/R2/R3。任何整合須fresh main reconcile及Owner驗收；舊公網網址不包含本輪未部署R3。
