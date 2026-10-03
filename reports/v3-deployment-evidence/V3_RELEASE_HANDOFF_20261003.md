# MoreFun V3 發布接手紀錄｜2026-10-03

最後更新：2026-10-03 21:58（Asia/Taipei）

## 最終狀態

Customer、Admin、正式 POS 三端均已真正部署到指定 Cloudflare 正式服務，完成服務設定讀回、正式域名讀回、build identity／release identity 核對及獨立外網瀏覽器驗證。

三端自動發布入口已在驗證後重新鎖死，避免驗收期間被舊分支或其他提交覆蓋。`main` 尚未 merge；等待 Owner 畫面驗收。

## 控制規則

- 正式目標：Admin `mfk-admin`、Customer `mfk-customer`、POS `mfk-smt-web`。
- 不以測試、文件或 push 代替正式網站部署。
- 不記錄或公開任何 API token、secret 或憑證值。
- 未經 Owner 驗收不 merge `main`；禁止 force push。
- 程式版本回退不等於資料回復。

## Customer｜已部署、已外網驗證

- 網址：`https://order.morefunos.com`
- 來源 commit：`a8d8ab76896574dbf3f0ab09a15ec2c11154ff98`
- Cloudflare deployment：`47a2203b-9e7c-49ef-8a7a-7de0bfef73b7`
- Cloudflare version：`85cbfe1c-0109-4e08-b951-afbb9d7b0c96`，100% 流量
- Build identity：`eb7289da0f5c71c2d1c07ea314f48428bde16c57192635258258991f5adb9a3b`
- Source digest：`324b6d46ccda4080a9dba2ae7b0b0eedcf3e480fcdfe98e81f9336ebd0868603`
- `sourceDirty=false`
- 外網驗證：run `37127234071`，job `111214909602`，成功
- 原有 `ASSETS`、`CUSTOMER_ASSETS` 及正式域名保留。
- Build trigger 已鎖：`V3_CUSTOMER_CONTROLLED_DEPLOY_DISABLED_AFTER_VERIFICATION`
- 回退 version：`e9e5aaef-b05f-4927-800b-32bc734d0f2e`

## Admin｜已部署、已外網驗證

- 網址：`https://admin.morefunos.com`
- 部署分支：`work/MFP-V3-ADMIN-DEPLOY-2026-10-03`
- 來源 commit：`cefc455f3a13d2f11b87d7353bc04d28256236a2`
- Cloudflare deployment：`a8241e98-b56b-4dae-85d5-318bdfe034e1`
- Cloudflare version：`5375ad85-a118-4612-907d-04b8bc89db9c`，100% 流量
- Release identity：`v3admin-cefc455f3a13-preview`
- 模式：`PRESERVATION`
- 設定寫入：`false`
- 測試：`559/559` 通過
- 外網驗證：run `37127827506`，job `111216670213`，成功
- Playwright 已核實匿名直接進入，並顯示「只供介面驗收」。
- 完整 observability、三個 Durable Object、R2、原有 secrets 及正式域名保留。
- Build trigger 已鎖：`V3_ADMIN_CONTROLLED_DEPLOY_DISABLED_AFTER_VERIFICATION`
- 回退 version：`ee2ae47d-57a6-44a0-8ddd-cf3c74d4e7f4`

## 正式 POS｜已部署、已外網驗證

- 網址：`https://smt.morefunos.com`
- 部署分支：`work/MFP-V3-FORMAL-POS-DEPLOY-2026-10-03`
- 來源 commit：`2635a8b44794d9f736949fc2fe7c04c4d50ef594`
- Cloudflare deployment：`8a2b31c4-9c86-4fd2-8495-2dd5f460da53`
- Cloudflare version：`31e9b26d-a013-40d9-bdb5-597dfd12969b`，100% 流量
- Build identity：`mfp-v3-2635a8b44794-test-acceptance`
- 模式：`TEST_ACCEPTANCE`
- 登入門檻：`false`
- 測試：`1335/1335` 通過
- 外網驗證：run `37127878038`，job `111216819896`，成功
- Playwright 已核實匿名頁面及四項真實狀態提示。
- `backendProxy=false`、`checkoutConnected=false`、`physicalPrintConnected=false`、`cashDrawerConnected=false`。
- `/api/orders` 外網實測回 `503`，舊後端不代理。
- 正式 custom domain 及 `ASSETS` binding 經部署後再次讀回確認。
- Build trigger 已鎖：`V3_FORMAL_POS_CONTROLLED_DEPLOY_DISABLED_AFTER_VERIFICATION`
- 回退 version：`53e9b55e-9844-4423-a5e5-06160eee105d`

## 待 Owner 驗收

1. 逐一打開三個正式網址，核對畫面、字體、排版及互動方向。
2. 回報任何畫面問題時，只修該端並重新完成部署及外網驗證。
3. Owner 明確確認後，先處理 release 分支整合及 `main` merge；目前未 merge。
