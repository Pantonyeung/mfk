# MFK Customer｜Port Reassessment Worksheet R1

日期：2026-09-30  
Owner：Panton  
目前 Production Baseline：main（本輪先以 main current reality 作盤點基準）  
盤點 Branch：`spec/MFK-CUSTOMER-PORT-REASSESSMENT-R1`  
控制 Issue：#603  
方法來源：`MFK_PORT_REASSESSMENT_CLOSEOUT_METHOD_V1_2026-09-30`（PR #602）  
狀態：AUDIT  
Overall Gate：RED — 盤點進行中，未准 Implementation

---

# 0. Owner Hard Requirements｜LOCKED

1. Customer App 係落單工具，唔係教學頁。
2. 所有主要操作必須符合人類直覺。
3. 唔准靠 explanatory copy 補救 unclear hierarchy / affordance / state / action。
4. 用戶一眼要知道：
   - 呢度係乜
   - 邊度可以撳
   - 撳完會發生乜
   - 呢個動作係完成，定係去下一步
5. Default helper paragraph = 0。
6. 文案只保留：
   - literal label
   - current value
   - factual state
   - price / total
   - ETA / pickup code / order number
   - required warning
   - payment / permission / privacy / safety
   - known error reason
   - recovery
7. 刪走非必要說明後，如果 UI 唔識用，要 redesign UI，唔係加返教學文案。
8. Unknown ≠ Failed。
9. Request Accepted ≠ Store Accepted ≠ Completed。
10. UI 唔可以補 Backend Contract。

Human Logic Gate：
- SELF_EVIDENT_NAVIGATION
- SELF_EVIDENT_ACTION
- SELF_EVIDENT_STATE
- SELF_EVIDENT_COMPLETION
- MINIMUM_NECESSARY_COPY

任何一項 Fail，該頁不得 LOCKED。

---

# A. Authority｜Phase 0

| Authority | Customer Port Rule | Status |
|---|---|---|
| Transaction | Browser 只可建立 intent / submit request；canonical order / store state 必須由正式 runtime readback | LOCKED |
| Config | Menu / payment channel / store config 來自正式已發布資料；Customer UI 不可自己形成 config truth | LOCKED |
| Pricing | Product / modifier / combo / final quote 以正式 published menu / quote 為準 | LOCKED |
| Payment | Customer 可選 payment method / 上傳 evidence；付款是否成立不可由 UI 自判 | LOCKED |
| Sellability | Product availability / store availability 由正式 published/runtime state 決定 | LOCKED |
| Print | Customer 無 print authority | LOCKED |
| Device / Runtime | Runtime port / canonical backend read model；browser 唔可以代替 | LOCKED |
| Browser allowed state | Cart draft、local preferences、pending intent、UI navigation state | LOCKED |
| Browser forbidden authority | Canonical order acceptance/completion、final payment truth、sellability truth、final price truth | LOCKED |

Freeze Rule：
- 本輪先盤 Product / UX。
- 未完成 Owner Review + Implementation Entry Gate，禁止將 reassessment 結果當 runtime implementation。
- 既有 candidate / mockup / generated visual 只係 evidence；唔自動變 Accepted Product。

Phase 0：LOCKED。

---

# B. Symptoms / Evidence｜Phase 1

| 症狀 | 影響 | Domain | Evidence | First Break | Unknown / 待驗 |
|---|---|---|---|---|---|
| 明顯操作仍用句子解釋 | 用戶要讀字先識操作，降低點單速度 | UI3 / UI4 / UI5 / UI6 / UI7 / UI8 / UI9 / UI10 | main current code | Interaction model / copy | 需逐頁 physical viewport |
| Quantity 出現「今次要幾多？／今次數量」 | Stepper 本身已足夠，資訊重複 | UI3 Configure | `product-sheet-ui3.tsx` | COPY / hierarchy | 視覺 spacing 待驗 |
| Product config 出現大量「已選／最少／最多／完成後先可加入／目前設定」 | 必選規則同進度教學過度外露 | UI3 Configure | main code | Component / copy | 哪些限制必須保留仍需逐項分類 |
| Checkout 有 Stepper +「下一步：付款」+「下一步：提交前確認」+ 再一次「確認以上資料」 | 交易流程多一層認知／確認 | UI4 Checkout | `customer-checkout-ui4.tsx` | Product flow | 安全提交與 review boundary 要保留但可瘦身 |
| Checkout 顯示「最後睇多次…」「一步一步完成…」等 generic helper | 直白 order summary 被教學文案蓋住 | UI4 | main code | COPY | physical hierarchy 待驗 |
| Submit 一頁反覆解釋「唔會重複落單」 | 正確 safety rule 被重複文案放大，第一眼唔夠直接 | UI5 | `customer-submit-ui5.tsx` | State presentation | 必要 unknown warning要保留一處 |
| Fulfilment 同一 state 同時有 eyebrow / title / detail / progress / readback / refresh explanation | Status 正確，但表達重複 | UI6 | `customer-fulfillment-ui6.tsx` | Component / copy | 哪啲資料要第一屏待逐狀態定 |
| Pickup 重複解釋 Ready ≠ Completed / code 用途 | 重要 boundary 需要保留，但現時重複過多 | UI7 | `customer-pickup-ui7.tsx` | State presentation | Exception / unknown 要獨立保留 |
| 「我到了」有 UI 但 backend seam 明確 missing | Disabled control 可能造成假 capability 感 | UI7 | `CUSTOMER_UI7_ARRIVAL_SEAM_CLASSIFICATION` | BACKEND_CONTRACT_GAP | Arrival feature V1 是否直接移除 UI |
| Orders / History 同時有 PageIntro、state detail、progress、pickup boundary、expand details | 每張訂單資訊密度高 | UI8 | `customer-history-ui8.tsx` | IA / copy | Current vs History final layout 待驗 |
| Member / Account 有大量「系統未連接／唔會自行…」產品內部說明 | 消費者見到 implementation language | UI9 / UI10 | main code | Product maturity / backend gaps | 未連接功能應 hide / disabled / recovery 哪種需逐項判 |
| Stage 1 candidate 有 Hero / quick entry / recommendation / memory strip 多層說明 | 首頁可能過密 | UI1 candidate | PR #592 candidate | First viewport hierarchy | 要以新 Human Logic Gate 重新盤 |

Phase 1：ACTIVE。

---

# C. Current Reality｜Phase 2 First Pass

Status Vocabulary：
EXISTS / PARTIAL / BROKEN / DUPLICATED / UNKNOWN / NO CONTRACT

| UI | Route / Surface | Current Reality | First Pass |
|---|---|---|---|
| UI0 Launch | LaunchOverlay | launch exists | EXISTS |
| UI1 Home | `/` | Stage1Home exists；另有未 merge UI1 candidate / skeleton work | PARTIAL |
| UI2 Browse | `/menu` | Stage2Menu + search/category/product entry | EXISTS |
| UI3 Configure | Product dialog/sheet | product / combo / modifier / qty / note / price | EXISTS + COPY_GAP |
| UI4 Cart / Checkout | `/memory-jar`, `/checkout/contact`, `/checkout/payment`, `/checkout/review` | cart + 3 checkout substeps + review confirmation | EXISTS + IA/COPY_GAP |
| UI5 Submit / Wait | `/submit/:id`, `/orders/:id/waiting` | pending/unknown/readback/fallback states | EXISTS + COPY_GAP |
| UI6 Fulfilment | order waiting/tracking surface | accepted / preparing / delayed / ready / rejected / canceled | EXISTS + COPY_GAP |
| UI7 Pickup / Complete | `/orders/:id` | ready / arrived / verified / handed over / complete / exception | PARTIAL — arrival mutation seam missing |
| UI8 History / Reorder | `/orders` | current/history/reorder/repair | EXISTS + DENSITY/COPY_GAP |
| UI9 Member / Memory | `/member` | member/memory/reward/preferences/pending intent/device action | PARTIAL + IA/COPY_GAP |
| UI10 Account / Support | `/member/account`, `/support/account-recovery` | account/recovery/PWA/notification/support | PARTIAL + COPY/BACKEND_GAP |

Important current collision candidates：
- Product configuration logic / presentation 有多套 component vocabulary，需確認 actual runtime only path vs leftover duplicate implementation。
- Order state presentation 分散 UI1 / UI5 / UI6 / UI7 / UI8，語義應共用同一 state dictionary，但 presentation 按 surface 瘦身。
- Member / Account / Device actions / Recovery 目前 scope 有重疊，需要 Primary Home。

Phase 2：ACTIVE。

---

# D. Port Archetype｜LOCKED

[x] 消費者交易介面

正式主要工作：
**揀餐 → 設定 → 購物車 → 結帳 → 落單 → 知道結果 → 取餐 → 再來一單**

產品語法：
**選擇 → 值 → Action → Result**

唔係：
**說明 → 說明 → 下一步提示 → 再確認說明 → Action**

---

# E. Product Map｜First Pass

| Domain | Route / Surface | Primary Home | Status |
|---|---|---|---|
| Home | `/` | 品牌 / 店舖狀態 / active order / discovery | RED — re-lock first viewport |
| Browse | `/menu` | menu discovery | RED |
| Configure | Product Sheet | product choice | RED |
| Cart | `/memory-jar` | selected order intent | RED |
| Checkout | `/checkout/*` | contact / payment / final summary | RED |
| Submit | `/submit/:id` | one submission attempt + result | RED |
| Order Status | waiting / order route | canonical order progress | RED |
| Pickup | order route | pickup identity / handover state | YELLOW — arrival seam |
| History / Reorder | `/orders` | past order + copy intent | RED |
| Member / Memory | `/member` | identity / reward / memory | RED |
| Account / Support | account / recovery | account + recovery | RED |

---

# F. Collision Audit｜First Pass

- [ ] Product configuration presentation duplication — verify runtime/dead paths.
- [ ] UI5 / UI6 / UI7 / UI8 order status copy duplication.
- [ ] UI9 Member vs UI10 Account / device / support responsibility.
- [ ] Home quick access vs Bottom Navigation duplicated destinations.
- [ ] Payment evidence instructions vs actual required payment workflow.
- [ ] Recommendation reason copy vs direct product discovery.
- [ ] Current order vs order history information duplication.

---

# G. Gap Map｜First Pass

| Gap | Type | Impact | Handling | Status |
|---|---|---|---|---|
| Obvious controls explained with prose | COPY_GAP | High | remove helper copy; redesign unclear control | RED |
| Product configure step coaching / repeated summaries | IA_GAP / COPY_GAP | High | reduce to choices + qty + note + sticky CTA | RED |
| Checkout extra instructional/review layers | IA_GAP / COPY_GAP | High | preserve factual review, remove tutorial layer | RED |
| Order status repeated across multiple panels | COMPONENT_GAP / COPY_GAP | High | one canonical state component contract | RED |
| Arrival notification seam missing | BACKEND_CONTRACT_GAP | Medium | UI cannot pretend available; product decision needed | YELLOW |
| Member/account unconnected capabilities visibly explained | BACKEND_CONTRACT_GAP / UX_GAP | Medium | hide, defer, or explicit recovery only | RED |
| Physical 360/390/412 acceptance not complete across all pages | ACCEPTANCE_GAP | High | mandatory viewport review | RED |
| Accepted IP assets not yet normalized/wired | UI_GAP | Medium | after Product/UI lock only | YELLOW |

---

# H. First Viewport｜Initial Gate

| Page | Mobile First Requirement | Status |
|---|---|---|
| UI0 Launch | Logo / brand entry clear, no tutorial | YELLOW |
| UI1 Home | store state + active order when present + direct browse/discovery | RED |
| UI2 Browse | search/categories/products immediately usable | RED |
| UI3 Configure | product + price + required choices + qty + note + add CTA | RED |
| UI4 Checkout | factual fields / payment / order summary / total / submit CTA | RED |
| UI5 Submit | processing then one direct result | RED |
| UI6 Fulfilment | state + ETA/pickup info only; detail below fold | RED |
| UI7 Pickup | pickup code / identity + actual state + exception action | YELLOW |
| UI8 Orders | current order first; history secondary | RED |
| UI9 Member | member truth / rewards / memory without marketing/tutorial overload | RED |
| UI10 Account | account/support actions only; no implementation explanation | RED |

---

# I. Direct Order Copy Budget｜LOCKED

Default component copy budget：
- Label：1 short phrase
- Value：1 value
- State：1 state
- Action：1 verb phrase
- Helper paragraph：0

Examples：

Quantity：
`[-] 1 [+]`

Notes：
`備註（選填）`

CTA：
`加入購物車`
`結帳`
`確認落單`
`再試一次`

Submit result：
`已送出`
`已接單`
`確認中`
`未能送出`

Normal Active Order：
`製作中` + ETA（如有）

Exception / Recovery 才可以增加原因及 recovery action。

---

# J. Next Audit Batch｜START NOW

Batch CUST-R1-01：
**Core transaction friction first**

1. UI3 Configure
2. UI4 Cart / Checkout
3. UI5 Submit / Result

每頁固定做：
- current first viewport
- remove-nonessential-copy test
- interaction / affordance test
- state truth test
- final minimum-copy contract
- LOCKED / YELLOW / RED

未完成 CUST-R1-01 前：
- 暫停 custom icon production
- 暫停重新發明 homepage decoration
- 暫停將 generated assets wire 入 runtime

---

# K. Implementation Gate

目前：BLOCKED

解鎖條件：
1. Authority 已鎖。
2. UI0–UI10 Product Map 收口。
3. First Viewport 100% 有結論。
4. Human Logic Gate 全頁 PASS。
5. RED = 0。
6. YELLOW 有 bounded handling。
7. Owner 明確批准。
8. Product spec merge 後，才開 implementation candidate。

---

# L. Milestone

MILESTONE: MFK_CUSTOMER_PORT_REASSESSMENT_R1_STARTED
PHASE_0_AUTHORITY: LOCKED
PHASE_1_SYMPTOMS: ACTIVE
PHASE_2_CURRENT_REALITY: ACTIVE
NEXT_BATCH: CUST-R1-01_UI3_UI4_UI5
