# MFK SMT PRD V2.0｜接手文件

日期：2026-10-03  
里程碑：PRD_REBUILT_V2_READY  
範圍：只根據《MFK SMT PRD V1.0》與《02_POS 完整報告》重新收口。

## 本輪完成
- 重新建立一份可直接交 AI / Vibe Coding 開發的 SMT PRD V2.0。
- 將「產品要求」與「目前實作證據」分開，停止沿用舊 LIVE / DONE 標籤。
- 將付款時序改為服務方式分流：
  - 外賣：先付款，再正式放行製作。
  - 堂食：可先建立正式未付款 Order，製作／上餐後，再在原 Order 結算。
- 持久掛單升為 P0：多筆 Draft、穩定 ID、主機持久、重啟恢復、競爭處理。
- Customer / Keeta / Print / Day Close / Aftersales 等，按 02_POS 指定 SHA 實作證據重新分類。
- 保留單一 Order / Pricing / Payment / Print Authority；禁止因 UI 未接通而重建核心。
- 加入 A01-A29 核心驗收、E0-E3 證據層級、AI 開發工作包次序。

## 關鍵未決產品決策
1. 直接反結帳是否包含真實資金退款／撤銷。
2. 部分履約／部分退款時，反結帳可操作範圍。
3. 反結帳／作廢權限與 reason 是否硬必填。
4. 取消廚房／製作通知單的最小內容。

## 交付檔
MFK_SMT_PRD_V2.0_AI開發版_2026-10-03.docx

## 下一步
先做 Design Brief / Design System，再由 Ordering → Cart → Hold → Dining → Checkout → Orders 逐頁落地。
每頁開工前 fresh-read current main，先分：
- 已有正式 handler
- 只有 contract
- 只有 UI
- 未接線
- PHYSICAL_PENDING

不得用 mock success / fake fallback 冒充已完成。
