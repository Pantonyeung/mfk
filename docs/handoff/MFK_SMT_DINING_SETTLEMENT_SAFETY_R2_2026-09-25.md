# SMT 堂食分結帳安全 R2｜2026-09-25

## 狀態
DINING_SETTLEMENT_R2_LOCAL_AND_BROWSER_PASS / OWNER_ACCEPTANCE_PENDING / NOT_FULL_DINING_ACCEPTANCE

- Control #22；work #249；draft PR #293。
- Branch: work/MFK/SMT-DINING-SETTLEMENT-SAFETY-R2。
- Parent R1: 38c202740e0019e2c7ab88e9a484997ee6da6753（#290，未合併）。
- Product commit: 5b109349e12b219be542222dede850ecbe74aabb。
- Exact verified candidate: e4bee0a1fe8c9ec6e0eca866a1f4955d0bed802b。
- Main at start: 8195c755dd1bff8c64c9aefd3d81f224726a7779。
- Main at finish fresh-read: 27b3c8eadf36f820956e0d58dae604dfdae3cf5d（其他工作推進；本輪未改 main）。
- 本輪無合併、無部署、無正式 Customer/Keeta 消費、無投影傳送、無打印／開櫃。
- #22 5832017072 已確認 SMT 實機基線驗收完成；本輪不重開整套實機驗收。

## 已完成
1. 現有 settleDiningHold 接受 stable submissionId + expectedRevision + 實收金額。相同提交重試／重開後重試只保留一次付款；同 ID 改內容拒絕。
2. 付款時再讀持久資料，核對商品／數量／單價／已付部分。過期版本拒絕，不偷偷改價或再收一次。
3. 重複行索引、非整數／非法數量、超出剩餘數量、現金不足、總額不一致均拒絕。
4. 同一現有 runtime JSON envelope 先保存成功，再發布記憶體及畫面狀態。儲存失敗不顯示已付、不釋枱。
5. 部分付款保留桌台及剩餘商品。全部商品付清後，同一保存動作記 archivedAt、lastAssignedTable 並解除佔枱；原商品及所有付款紀錄保留，不刪 Hold。
6. 已點餐輪候單可經同一付款入口結算，不需要先佔桌台。
7. 已結帳紀錄入口可重新查看原商品、分項付款及原枱號；reload 後仍保留。
8. runtime 自身禁止覆蓋已有客人桌台；一般移除／queue × 不可刪除有付款或歷史的 Hold。
9. R1 已驗桌台、輪候、選項保持、快速轉枱、double-click 等操作未重做；12項瀏覽器回歸仍PASS。

## 真正 RED → GREEN
- RED run 36133453844，job 108065836562：舊169項PASS，新18項全FAIL。實際重現重試多收、重複選同一行超收、儲存失敗記憶體卻變已付、刪歷史、可覆蓋桌台等。
- 首次 GREEN 36133765497：先套用hash鎖定的最小patch，單元／build／R1 browser通過後，CI只向R2 child branch提交3個產品檔案。
- 最終 exact-source run 36134100635，job 108067915258：38/38 test files、187/187 tests PASS；build PASS。
- R1 browser: 12/12 PASS。
- 新增真runtime browser/standalone: 5/5 PASS（部分付款重試、付清釋枱＋歷史＋reload、現金不足、另一筆付款令snapshot過期、離線HTML付款釋枱）。
- 1180×820及1920×1080截圖已檢視。新測試阻擋外部HTTP，核對零外部HTTP及零page error。
- Artifact: 10862333451，SHA256 3d28a2e686e1360c85dcd07f7287ead1ef9ea69020075ec182bd7396ddfb42c7。
- Evidence: https://github.com/Pantonyeung/mfk/actions/runs/36134100635/artifacts/10862333451
- Artifact內：unit.log、build.log、tested-sha.txt、payment-browser-report.json、r1-regression/report.json、dining-payment-preview.html、付款歷史平板／桌面截圖。

## 實作位置
- v2local/src/runtime/local-runtime.ts
- v2local/src/presentation/RuntimeDiningWorkspace.tsx
- v2local/src/App.tsx（既有堂食Checkout傳遞提交身份／版本／實收，結果文案據實）
- 新測試 dining-settlement-r2.test.ts；acceptance/dining-payment*。
- apply-dining-r2.mjs 只作本輪hash-pinned重現patch；已套用源碼遇marker即no-op。CI只准驗證後push此child branch，不得改main或parent。

## 驗收邊界／未完成
- 正式 Order link 仍未完成；現時保存的是 SAME Hold + 現有付款parts，不能冒稱 SAME formal Order 全鏈封版。示例特別驗證 orders.length=0，沒有捏造新Order或重算另一套價格。
- 示例付款頁係明確標示的測試交接器，會呼叫真實runtime；不是完整正式Checkout UI的端到端驗收。App實際交接已有接線及build證據，仍需完整正式流程驗收。
- 持久性／一次保存證據範圍是單一browser runtime。跨分頁／跨裝置並行、實機斷電、原生Store Kernel原子交易仍未由本輪證明。
- 堂食打印／付款小票／Label／開櫃與正式Order連接未接通。Completion Review不再假稱打印／開櫃已送出；不重開已接受的整體硬件基線。
- 複合付款仍沿用既有COMBO記錄形狀，未宣稱完整split tender明細。
- 真實入座時間、Admin用餐警示發布、空枱直接點單、正式Order連接仍未完成。
- 已付舊資料只在明確保留歷史釋枱動作處理，未靜默批量遷移；任何總額不一致先阻擋。
- 尚有既有 build warning：iconv string_decoder瀏覽器外部化、bundle較大；本輪browser用到的路徑無page error，非全系統性能封版。

## 下一刀
先fresh-read main及#22，不能打斷SMM/Owner主連接驗收。正式Order連接需要對照現有唯一Order/payment parts/Print authority，禁止付款時另外造一張假已付Order。此R2只作可移植、未部署的已驗安全修正；未經Owner驗收不得merge。
