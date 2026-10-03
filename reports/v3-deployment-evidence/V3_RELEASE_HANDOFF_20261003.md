# MoreFun V3 發布接手紀錄｜2026-10-03

最後更新：2026-10-03 21:53（Asia/Taipei）

## 控制規則

- 正式目標：Admin `mfk-admin`、Customer `mfk-customer`、POS `mfk-smt-web`。
- 每端獨立修正、測試、部署及驗收；不等待三端齊備。
- 不以測試、文件或 push 代替正式網站部署。
- 不記錄或公開任何 API token、secret 或憑證值。
- 未經 Owner 驗收不 merge `main`；禁止 force push。

## Customer｜已部署、已外網驗證

- 網址：`https://order.morefunos.com`
- 來源 commit：`a8d8ab76896574dbf3f0ab09a15ec2c11154ff98`
- Cloudflare deployment：`47a2203b-9e7c-49ef-8a7a-7de0bfef73b7`
- Cloudflare version：`85cbfe1c-0109-4e08-b951-afbb9d7b0c96`，100% 流量
- Build identity：`eb7289da0f5c71c2d1c07ea314f48428bde16c57192635258258991f5adb9a3b`
- Source digest：`324b6d46ccda4080a9dba2ae7b0b0eedcf3e480fcdfe98e81f9336ebd0868603`
- `sourceDirty=false`
- 外網驗證 workflow：run `37127234071`，job `111214909602`，成功
- 原有 `ASSETS`、`CUSTOMER_ASSETS` 及正式域名保留。
- Customer Build trigger 已在驗證後重新鎖死，避免自動覆蓋。
- 回退 version：`e9e5aaef-b05f-4927-800b-32bc734d0f2e`

## Admin｜進行中

- 分支：`work/MFP-V3-ADMIN-DEPLOY-2026-10-03`
- 最新修正 commit：`cefc455f3a13d2f11b87d7353bc04d28256236a2`
- 完整 observability 設定已寫回並加入契約測試。
- 正式服務既有 Durable Objects、R2、secret bindings、正式域名及回退 version 已讀回確認。
- 免登入 preview 使用 `VITE_MFK_V3_PREVIEW_MODE=1`；設定寫入維持關閉。
- Cloudflare Build：`9a29c9ac-e1f1-4bad-a105-d1c09a6d676e`，待完成。
- 回退 version：`ee2ae47d-57a6-44a0-8ddd-cf3c74d4e7f4`

## 正式 POS｜進行中

- 分支：`work/MFP-V3-FORMAL-POS-DEPLOY-2026-10-03`
- 最新 patch commit：`2635a8b44794d9f736949fc2fe7c04c4d50ef594`
- 4 檔 patch：匿名 TEST_ACCEPTANCE Worker、正式 `mfk-smt-web` 設定、UI 真實狀態提示、邊界測試。
- 所有 `/api/*` 舊後端代理明確封鎖；不加入新 secret。
- UI 明示結帳、實體打印及舊後端未接通。
- Cloudflare Build：`b32eacea-503b-403e-bed1-6371f88b7ead`，待完成。
- 回退 version：`53e9b55e-9844-4423-a5e5-06160eee105d`

## 待做

1. Admin 全套測試、部署、Cloudflare readback、外網免登入驗證。
2. POS 全套測試、部署、Cloudflare readback、外網匿名驗證。
3. 每完成一端即交 Owner 驗收，再更新本紀錄。
4. Owner 驗證後先決定是否 merge `main`。
