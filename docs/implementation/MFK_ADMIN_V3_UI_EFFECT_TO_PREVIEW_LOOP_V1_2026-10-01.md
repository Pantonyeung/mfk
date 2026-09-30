# MFK Admin V3｜UI Effect → Implementation → Public Preview Loop V1

日期：2026-10-01
狀態：CONTROLLING UI DELIVERY LOOP
Product Control：#601
Implementation PR：#605
Production：v2 remains live

## 0. Owner Rule

Admin V3 UI 唔再一次過出晒大量效果圖，再到最後先實作。

由而家開始，每一輪只處理一個明確 UI Slice：

**效果圖 → Owner確認 → 實作 → Test/CI → Public Preview → 實機驗收 → 記錄 → 下一張圖**

每一張效果圖都必須有對應 implementation 同 preview 證據。

## 1. 每輪固定流程

1. 選一個細而完整嘅 UI Slice。
2. 出一張效果圖，只表達呢個 Slice。
3. Owner指出修改。
4. 修圖直到 UI Lock。
5. 將已 Lock UI 寫入 implementation brief / acceptance。
6. Codex / implementation branch只實作該 Slice。
7. 跑 test / typecheck / build / CI。
8. 更新 isolated V3 public preview。
9. Desktop / Mobile / Safari實機驗收。
10. 記錄：
   - UI image/version
   - implementation commit SHA
   - preview URL
   - acceptance status
   - RED / YELLOW
11. GREEN後先進下一 Slice。

## 2. Public Preview Rule

「上公網」只代表：
**isolated V3 preview**

唔代表：
- production deploy
- canonical hostname switch
- v2 replacement

Production v2保持 live，
直到完整 V3 physical/browser acceptance GREEN + Owner cutover PROMOTE。

## 3. 一張圖對一個 Slice

禁止：
- 一次出 10 張圖
- 一次改 20 個 domain
- 視覺未鎖就開始做第二頁
- implementation落後效果圖幾輪
- preview同設計圖唔一致但照前進

每輪最多：
**一個 Primary Page / 一個主要 Workflow state。**

## 4. UI Slice Card

每輪要有：

- Slice ID
- Page / Route
- User Job
- Effect Image
- UI Decisions
- Data Source
- Write/Readback Contract
- Implementation Commit
- Preview URL
- Desktop status
- Mobile status
- Safari status
- Final verdict

## 5. Current Slice Order

UI-01｜產品管理 Default List
- Default 狀態只見完整 List
- Product editor唔長期固定

UI-02｜產品管理 Product Drawer
- 點產品後 temporary slide-over drawer
- close後恢復完整 List
- product code auto-generated
- takeaway surcharge configurable

UI-03｜新增產品
- 新增後先產生 system product code
- validation / unsaved state

UI-04｜分類管理
- List → temporary edit drawer / create flow

UI-05｜價格管理
- direct price management + impact visibility

UI-06｜未發佈變更
- changed objects / validation / impact

UI-07｜發佈中心
- Publish confirmation / Cloud Published

UI-08｜版本／回讀確認
- desired canonical vs each SMT observed identity

UI-09｜今日
- Effective Sales first
- Action Queue / Readiness / Draft / Cash

之後再逐 domain擴展。

## 6. Acceptance Rule

每輪 GREEN前：
- effect image approved
- implementation matches effect image
- no fake data authority
- no Product Brief authority violation
- responsive behavior verified
- copy follows Copy Dictionary
- CI GREEN
- preview reachable
- Safari current release identity verified where applicable

## 7. Handoff Rule

每輪結束記錄：

MILESTONE:
MFK_ADMIN_V3_UI_SLICE_<ID>_GREEN

下一輪開始前先讀上一輪：
- final image
- commit SHA
- preview URL
- acceptance verdict

MILESTONE:
MFK_ADMIN_V3_UI_EFFECT_TO_PREVIEW_LOOP_V1_LOCKED
