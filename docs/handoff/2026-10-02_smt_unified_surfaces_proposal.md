# MoreFunOS POS｜SMT 統一雙介面架構提案｜2026-10-02

狀態：PROPOSAL / NOT YET OWNER-LOCKED

## 討論結論
可考慮產品上廢除獨立手機 POS 身份（現文件稱 SMM；Owner 口述為 SMN），改為同一 SMT 產品的兩個 Surface：
- SMT Desktop
- SMT Handheld

## 不變的核心原則
- 同一 Store Kernel / Formal Transaction Authority。
- 同一 Pricing、Order、Fulfillment、Revision、Idempotency、Readback。
- Handheld 只係操作 Surface，不建立第二 Order / Pricing / Print authority。
- Desktop 與 Handheld 不做等比例縮放；共用 business logic，但各自有適合裝置的 interaction layout。

## 打印架構
任何 Surface 觸發需要打印的正式業務操作：
UI → Store Kernel → Durable PrintJob → Print Router → Hardware Host / Print Edge → Physical Printer

手機不直接持有實體 printer authority。
實體 IP / USB / driver 綁定留在座機／硬件 Host。

## 關鍵風險
如果唯一座機同時係唯一 Print Host，座機死機時手機仍可操作但無法保證打印。
正式落地前要決定：
A. 座機主 Print Host + fallback Host；或
B. 把 Print Edge Service 從 UI shell 分離，做常駐硬件代理。

## 待 Owner Lock
1. 產品命名是否正式取消 SMM/SMN，只保留 SMT Desktop / SMT Handheld。
2. 是否同一 App Package，或同一 Codebase 但分開 native shell/package。
3. Print Host failover 策略。
