# MoreFun V3 無縫接手紀錄｜R2｜2026-10-03

最後更新：2026-10-03（Asia/Hong_Kong）

## 最高優先結論

**STATUS：NOT COMPLETE**

Customer、Admin、正式 POS 三個網址已部署 V3 畫面，但只完成「介面上線」，未完成真正業務接駁。先前文件將三端描述為「完成」並不準確；正確狀態係：

- UI DEPLOYED
- BUSINESS LINKAGE NOT COMPLETE
- NO MAIN MERGE
- NO FORCE PUSH

只有以下閉環全部有真實證據，先可以稱為完成：

`Admin publish → Customer canonical read → Customer stable submission → POS intake → Store Kernel atomic commit → Order/Display/Payment/Fulfillment/Print Admission → 三端 readback → retry/restart/offline 不重單不失單`

## Owner 最新授權

- 全部業務資料視為測試資料。
- 可破壞性重建 V2 程式、Cloudflare 建置／部署命令及舊分支綁定；舊設定及舊 version 必須保留作回退。
- 測試 UI 暫時不要 Admin／員工登入門檻；驗收完成後才恢復。
- Cloudflare 帳戶、API 憑證及權限保留；不得公開任何憑證值。
- 可公開推送既有 release／work 分支；驗證完成後才可 merge `main`。
- 禁止 force push。
- 不可用「測試成功、文件完成、已 push、已部署」代替實際網站及完整交易閉環。

## Repo／目前來源

- Repo：`Pantonyeung/mfk`
- Release：`release/MFP-V3-ACCEPTANCE-2026-10-03`
- Release SHA：`fe88992ed91b25ed98cf79eb0db7d9708b507800`
- Release Tree：`af09db66513b739825e435425bc07d811e2bbdd6`
- main：`2e32fb87b2c84801b11a5ea6b2102a00f2a3104c`

工作分支：

- Customer：`work/MFP-V3-CUSTOMER-DEPLOY-2026-10-03` @ `a8d8ab76896574dbf3f0ab09a15ec2c11154ff98`
- Admin：`work/MFP-V3-ADMIN-DEPLOY-2026-10-03` @ `cefc455f3a13d2f11b87d7353bc04d28256236a2`
- POS：`work/MFP-V3-FORMAL-POS-DEPLOY-2026-10-03` @ `2635a8b44794d9f736949fc2fe7c04c4d50ef594`
- Handoff：`handoff/MFP-V3-2026-10-03`

接手前必讀：`AGENTS.md`、`COMMANDER_CURRENT.md`、`HANDOFF_CURRENT.md`、`docs/control/MFK_CHANGE_CONTROL.md`。

## Cloudflare 目前正式版本

Account：`314abfde9f49e752cf8f67c79d83dd7c`

### Customer

- URL：`https://order.morefunos.com`
- Service：`mfk-customer`
- Deployment：`47a2203b-9e7c-49ef-8a7a-7de0bfef73b7`
- Version：`85cbfe1c-0109-4e08-b951-afbb9d7b0c96`，100%
- Build identity：`eb7289da0f5c71c2d1c07ea314f48428bde16c57192635258258991f5adb9a3b`
- Rollback：`e9e5aaef-b05f-4927-800b-32bc734d0f2e`

### Admin

- URL：`https://admin.morefunos.com`
- Service：`mfk-admin`
- Deployment：`a8241e98-b56b-4dae-85d5-318bdfe034e1`
- Version：`5375ad85-a118-4612-907d-04b8bc89db9c`，100%
- Release identity：`v3admin-cefc455f3a13-preview`
- Rollback：`ee2ae47d-57a6-44a0-8ddd-cf3c74d4e7f4`

### 正式 POS

- URL：`https://smt.morefunos.com`
- Service：`mfk-smt-web`
- Deployment：`8a2b31c4-9c86-4fd2-8495-2dd5f460da53`
- Version：`31e9b26d-a013-40d9-bdb5-597dfd12969b`，100%
- Build identity：`mfp-v3-2635a8b44794-test-acceptance`
- Rollback：`53e9b55e-9844-4423-a5e5-06160eee105d`

三端自動發布入口目前已鎖死。重新啟用時只可指向正確工作分支及 root directory；部署後完成 version／domain／binding readback，再立即鎖死。

## 真實未完成狀態

### Customer

- 使用 `PREVIEW_PRODUCTS`、`PREVIEW_MENU_CATEGORIES` 及 preview fixture。
- 記憶罐只存在 React 記憶體，reload 後會消失。
- `orderSubmission=false`、`paymentProofUpload=false`、`paymentSuccess=false`。
- 未接 Admin Canonical 菜單／價格／選項／套餐／Availability。
- 未建立正式 `requestId`／`submissionId`／`idempotencyKey`。
- 未接正式提交、讀回、訂單列表及狀態。

### Admin

- `VITE_MFK_V3_PREVIEW_MODE=1`，進入 synthetic AdminShell。
- Server configuration writes 為 `false`，模式為 `PRESERVATION`。
- 未接真正 Canonical draft／publish／readback／Host ACK。
- generic `/api/admin-sync/` 及 `/api/projection/` provider 目前 fail-closed。

### POS

- 模式為 `TEST_ACCEPTANCE`。
- `backendProxy=false`、`checkoutConnected=false`、`physicalPrintConnected=false`、`cashDrawerConnected=false`。
- `/api/orders` 外網回 `503`。
- 未接 Customer Intent、Store Kernel atomic commit、Payment、Fulfillment、Print Admission、Print Queue 或跨端 readback。

## 不可改變嘅 Authority

- Admin：正式 configuration／policy 唯一 Canonical Authority。
- Store Kernel：Order／Pricing／Payment／Tender／Fulfillment／Print Admission 唯一交易 Authority。
- Customer：只提交 Intent，不可成為第二 Order／Pricing Engine。
- MFP Mobile／輔助端：不可建立第二 HeadSeq／Session／Transaction Authority。
- D1：Projection only，不可成為正式交易真相。
- Doorbell／WebSocket：invalidation only；靠 Canonical pull ＋ bounded reconnect／reconcile 收斂。
- Print：Local Atomic Commit 後建立 Print Admission／Queue，不可因 Cloud 慢而阻本地成交。
- Display Number：只可 Commit 後派發，不可預留、回收或因 retry 重派。

## 三個 Worker 並行

每完成一端或一條真實閉環，立即交 Owner；禁止等三端一齊完成。

### Worker 1｜Customer Actual Provider

目標：Customer 由 preview app 轉為正式 Canonical read、Intent submit 及 order readback。

必須完成：

1. 正式 Customer API Adapter。
2. 讀取 Store／Channel Health、Canonical menu、Categories、Products、Options、Combos、Availability、pickup policy。
3. 正式流程移除 preview fixture 依賴。
4. 記憶罐使用已批准持久化 seam，reload 後保留。
5. 落單前由 Host／Canonical Authority quote。
6. 產生 stable `requestId`、`submissionId`、`idempotencyKey`。
7. Customer Intent → 正式 ingress → Store Kernel。
8. Readback：Pending／Accepted／Rejected／Ready／Completed／Cancelled。
9. 同一 submission 重試只讀回同一單。
10. 訂單列表、詳情、最近訂單、再來一單使用正式 read model。
11. 離線只保存 Pending Intent；恢復後 bounded reconcile，禁止固定 polling。
12. 未接支付／憑證時必須阻止，禁止假成功。

驗收：Admin 改一個測試產品並 publish；Customer 見到；Customer 落單；POS 5 秒內只出現一張；reload／重按／斷線重試不重單。

### Worker 2｜Admin Canonical Read／Write／Publish

目標：測試 UI 保持免登入，但安全接入既有 Canonical draft／publish／readback，禁止前端假 session。

必須完成：

1. Server-side bounded `TEST_ACCEPTANCE` admission，只限指定 test mode／store／environment。
2. 關閉 TEST_ACCEPTANCE 後必須 fail-closed 並恢復正式登入。
3. UI 由 synthetic preview 切到真正 Canonical read。
4. 接入既有 draft、products、categories、options、combos、pricing、availability、print policy、logical printer、tender、publish、versions／rollback。
5. 保留 revision、CAS、validation、audit history。
6. Publish 後必須 Canonical active readback、fingerprint／revision、Customer projection、POS／Host apply、ACK／failure surface。
7. 不可只顯示「發布成功」而冇讀回。

驗收：匿名進入測試 Admin；讀到測試 Canonical；修改並 publish；Customer／POS 見到同一值；關閉 TEST_ACCEPTANCE 後匿名寫入失效。

### Worker 3｜POS Store Kernel／Checkout／Print

目標：`smt.morefunos.com` 接入真正 Store Kernel、Customer ingress、atomic checkout、readback 及 Print software path。

必須完成：

1. 使用已批准 service binding／existing ingress；禁止重新代理整個舊 backend。
2. Customer Intent validation／dedupe／canonical quote／Store Kernel admission。
3. POS 現場單 product／option／cart quote／checkout draft／payment。
4. 第一次確認先 Atomic Commit：Display Number、Order、Payment、Fulfillment、Print Admission、Outbox。
5. 重試保持 SAME Order；第二次 Done 只離開畫面。
6. Customer／Keeta／現場單使用同一 Store Kernel authority。
7. Restart 後可讀回 Order／Payment／Fulfillment。
8. Print software path：Receipt、Production、Packing、Product Label、Bag Label、Meal Voucher Label。
9. 每台 Printer 獨立 Job／Router；同單可分流；同一 Printer 保持 Order queue。
10. 實體 Printer 未驗收時只可標 `PHYSICAL_PENDING`，禁止假稱已打印。

驗收：Customer 單 5 秒內到 POS；retry 不重單；確認後只有 1 Order／Display／Payment／Fulfillment／Print Admission set；restart 後仍可讀回。

## Gate 次序

0. Fresh-read GitHub／Cloudflare／versions／bindings／domains／rollback。
1. 鎖定共享 contracts：Canonical Menu Snapshot、Customer Intent、Submission Readback、Order Status Projection、Host ACK、Print Admission。
2. Admin Canonical read／publish／readback。
3. Customer Canonical menu read。
4. Customer submit／readback。
5. POS ingress／dedupe／Store Kernel admission。
6. POS atomic checkout／payment／fulfillment。
7. Print Admission／Queue／routing software path。
8. 三端 E2E acceptance。
9. Owner 逐端驗收。
10. Owner 明確 `PROMOTE` 後先 merge main。

## 完整 E2E 必須證明

- Admin 修改並 publish 測試產品。
- Customer 讀到新資料並完成選擇。
- 產生固定 submissionId／idempotencyKey。
- POS 5 秒內收到同一 submission。
- 同一 request 送 3 次只建立 1 Intent／1 Order。
- 第一次確認先 atomic commit。
- 只建立 1 Order、1 Display Number、1 effective Payment、1 Fulfillment、1 組應有 PrintJob。
- POS refresh／restart 後仍讀到同一結果。
- Customer 見到 Accepted／Ready／Completed。
- 斷線、Cloud offline、Printer offline 均有明確狀態，禁止假成功。

## Worker 必交證據

- Worker／Work ID／Status。
- Branch、base SHA、head SHA。
- Changed files exact paths。
- Test command、pass／fail 數、未執行測試。
- Service、deployment ID、version ID、traffic、domain／binding readback。
- Source SHA、build ID、sourceDirty、builtAt。
- Canonical revision／fingerprint、submissionId、orderId、displayNumber、paymentId、fulfillmentId、printJobIds、timestamps。
- Rollback version／method／readback。
- Remaining gaps。
- Owner acceptance URL 及 exact flow。

## 禁止事項

- 禁止 force push、未驗收 merge main、公開任何 secret。
- 禁止 V2 成為新 runtime authority。
- 禁止第二資料庫／Store Kernel／Order／Pricing／Payment／Print Engine。
- 禁止 React 自行計正式價格。
- 禁止 Customer 直接建立正式 Order。
- 禁止 D1 成為交易真相。
- 禁止固定 business polling。
- 禁止未 readback 就顯示 publish／order／payment／print 成功。
- 禁止 mock／fixture／synthetic ACK 冒充 E2E。
- 禁止一次盲目 deploy 三端。
- `mfk-mfp-v3-acceptance` 不等於正式 `mfk-smt-web`。
- Software Print Queue 不等於實體打印 PASS。
- 程式回退不等於資料回復。

## 最終成功定義

只有以下全部成立，先可回覆「完成」：

- Admin 真正讀寫並 publish Canonical。
- Customer 真正讀 Canonical 菜單並提交 Intent。
- POS 真正接收並由 Store Kernel atomic commit。
- Payment／Fulfillment／Print software path 真正建立。
- 三端 readback 一致。
- retry／restart／offline 不重單、不失單。
- Owner 已逐端驗收。
- main merge 只在 Owner 明確 `PROMOTE` 後執行。

在此之前一律回覆：`STATUS：未完成`。
