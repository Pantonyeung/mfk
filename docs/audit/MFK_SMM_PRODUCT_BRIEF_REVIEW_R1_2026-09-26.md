# MFK SMM Product Brief Review R1
日期：2026-09-26
狀態：REVIEW COMPLETE

## 結論
現有 Brief 方向正確，可以作產品共識文件，但未夠精準做 UI / Frontend / Backend / Acceptance 唯一執行規格。主要問題唔係缺功能，而係「產品定位、現況、技術實作、Authority、驗收」混在同一份文件。

## 必改 8 點
1. 將 Current State 同 Target Contract 分開。
2. 將「已具備」拆成 WIRED / READ_ONLY / UI_READY / CONTRACT_ONLY。
3. 「付款方式記錄」改名為「付款方式意圖」，避免誤解為 Payment Execution。
4. 價格分清「Published Display Price」與「SMT Authoritative Validation」。
5. Pending Intent 持久狀態與 transient CONFIRMED / REJECTED command result 分開寫。
6. localStorage 唔應成為產品層硬規則；Auth Session 亦唔應與 Cart 草稿歸入同一資料安全層。
7. LAN / INTERNET 要補優先次序、fallback、staff provenance、失敗語義。
8. 成功標準要改成可驗收測試，不只係原則描述。

## 建議新版結構
A. Product Positioning
B. Users / Jobs
C. Non-goals
D. Navigation / Surfaces
E. Canonical Authority Map
F. Core Journeys
G. State & Error Contract
H. Connectivity / Recovery
I. Security / Staff Identity
J. Current Capability Matrix
K. Acceptance Scenarios
L. UX Visual Rules
M. Open Decisions

## 建議新增 Acceptance
- Rapid multi-tap：只建立一次正式單
- Submit timeout：保持 UNKNOWN，readback 後回原結果
- Browser refresh：Pending Intent 可恢復
- Menu revision changed：局部修復，再確認
- Price changed：不得靜默改總額
- Product / option sold out：只修問題 line
- Dine-in 無 target：禁止提交
- Admin 停用但仍佔用枱：仍可顯示直至清枱
- LAN unavailable：不得令 SMM 無任何可用路徑
- Staff session stale / revoked：正式提交 fail-closed
- SMT unavailable：SMM 不可假成功
- SMM unavailable：SMT local trading 繼續

## 建議文案修正
「付款方式記錄」→「付款方式意圖」
「Current Main 已確認能力」→「Current Capability Matrix」
「本機 localStorage 只可以保存」→「Local non-authoritative workspace 可持久化；實際儲存方式由安全規格決定」
「SMM 可以用已發布餐單資料做即時顯示及購物草稿重算」→「SMM 可按已發布餐單 snapshot 計算顯示用草稿金額；SMT 提交時必須重新驗證，SMM 不取得 Pricing authority」

## 優先順序
P0：Current/Target 分層、Authority Matrix、付款/價格語義、Acceptance
P1：Connectivity / Staff Session / Local Data Security
P2：視覺規範、文案、效能指標

MILESTONE:
MFK_SMM_PRODUCT_BRIEF_REVIEW_R1_COMPLETE
