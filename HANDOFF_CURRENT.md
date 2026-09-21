# MFK SMT｜無縫接手文件｜2026-09-21 13:58 HKT

## 0. 接手一句話

由而家開始，`Pantonyeung/mfk` 係唯一 Active Product Source。

唔再救舊 MoreFunOS connected runtime。
唔再用 D1 / Cloud / WebSocket / Firebase / Remote Auth 做本地交易前置。
唔用 Codex。
每次只做一個真實 FIRST BREAK：
RED → FIX → SAME TEST GREEN → BUILD GREEN → OTA → 真機。

---

## 1. PRODUCT DIRECTION

產品：
MFK SMT Fusion

核心方向：
MoreFun V2 1920×1080 POS UI
+
舊 SMT report 入面真正有用嘅餐飲營運功能
+
Carrier 1.0.6 Native Bridge
+
完全 Local-First transaction path

唔係照搬其中一套。
係重新融合：
保留好處，刪走 connected runtime 雜線。

---

## 2. REPOSITORY / EXECUTION

Active product repo：
https://github.com/Pantonyeung/mfk

Active implementation：
`v2local/**`

Current executable product code baseline：
`7660f49cfcd97c0679697af07f5bc194f7807c03`

呢個 SHA 係目前最後一個會影響 Runtime 行為嘅 product commit：
`fix: invert TSC raster label polarity`

之後如 repo HEAD 只多咗 HANDOFF / docs commit，唔代表 executable product code 改變。

Product smoke：
GitHub Actions run `35566403875`
Result：SUCCESS

OTA publisher repo：
`Pantonyeung/morefunos-v1-builder`

禁止：
- Codex
- 舊 MoreFun-v2 作 Active product source
- D1 / Cloud / WebSocket / Firebase 進本地交易主路
- 第二 Order Engine
- 第二 Pricing Engine
- 第二 Print Engine
- 為文件／治理而停止實做

---

## 3. CURRENT DEPLOYED OTA

最後已真正發布 OTA 嘅 source：
`c939f139df01a0bb422f65f2cbc498c4f5d6bb47`

Release：
`runtime-candidate-mfk-c939f139df01`

Bundle：
`MoreFunOS-SMT-runtime-candidate-mfk-c939f139df01.mfos`

SHA-256：
`ad59de1c7d99a66517fd661fdd6378610a2254654aae9d8bd9ef901523cd4a37`

OTA run：
`35565828152`
Result：SUCCESS

重要：
Current main `7660f49...` 比已發布 OTA 再前一刀。
`7660f49...` 已 GREEN，但未見有新 OTA request / publish。
下一手禁止誤以為 current main 已經落機。

---

## 4. 真機已證狀態

已由 Owner 真機相片確認：

A. POS Runtime
- OTA 可正常載入 SMT
- 1920×1080 MoreFun V2 方向可運行
- Product / Cart 可操作
- CASH Checkout 可完成
- Local Order 可建立
- Orders 可讀
- Display number 正常，例如 P001 / P003 / P005

B. Receipt Printer
- 外置 receipt printer 真出紙
- 中文已正常
- 例：磨飯 MFK、原味飯團、TOTAL、CASH 可正常打印
- Receipt route = PHYSICAL GREEN

C. Checkout → Print
- 成交後自動 print fanout 已接
- Orders 手動 Print 已接同一 print fanout
- Order 成功唔等 printer 完成
- Print failure 不應推翻 Order

D. Label Printer
- 真機有出 Label
- 舊文字模式出現中文亂碼
- Big5 + TST24.BF2 仍不足以可靠解決
- 已轉策略：中文 Label 不再依賴 printer built-in Chinese font
- 改用 Browser Canvas → monochrome bitmap → TSC BITMAP bytes

---

## 5. CURRENT FIRST BREAK

CURRENT FIRST BREAK：

`LABEL_BITMAP_POLARITY_PHYSICAL_PENDING`

最新路徑：

Order
→ Label PrintJob
→ build RasterLabelSpec
→ Browser Canvas render
→ 50×40 / 203dpi monochrome bitmap
→ TSC BITMAP payload
→ Native LAN dispatch
→ Xprinter physical label

Current main `7660f49...` 最新改動：
bitmap polarity 由：

`black pixel = 1`

改成：

`black pixel = 0`

原因：
上一個 bitmap candidate 已完整打包／OTA，但最新 source 再修正 raster polarity。

下一步只准：
1. 將 exact `7660f49...` 推 OTA
2. 真機打印一張產品 Label
3. 睇中文／黑白方向／位置
4. GREEN 就 BANK
5. RED 就只修 Label bitmap physical output

禁止因 Label 問題重開 Receipt / Checkout / Order。

---

## 6. LABEL CURRENT IMPLEMENTATION

File：
`v2local/src/runtime/label-bitmap.ts`

Profile：
- Protocol：TSC
- Label size：50×40 mm
- DPI：203
- REFERENCE：0,0
- DENSITY：8
- GAP：2 mm
- Output：TSC BITMAP
- 中文由 browser font rasterize
- 不再依靠 TST24.BF2 / TSS24.BF2 成為主要解法

主要字體 fallback：
- Noto Sans TC
- Noto Sans CJK TC
- PingFang TC
- Microsoft JhengHei
- sans-serif

Product Label：
- Order code
- Product name
- piece index，例如 1/3

Bag Label：
- Order code
- 袋標籤
- 總件數
- 1/1

Current Product / Bag Label 都走：
`renderMode = tsc-bitmap`

---

## 7. PRINT ARCHITECTURE CURRENT

全部係外置 Printer。

禁止再預設：
`SUNMI T2S internal printer`

Current logical roles：

1. 顧客小票
2. 製作單
3. 打包單
4. 產品標籤
5. 袋標籤

Binding：
logical role
→ user selected physical printer
→ host / IP
→ port 9100
→ capability
→ Native Carrier LAN bridge

Receipt / Production / Packing：
text ESC/POS
中文預設 GB18030

Label：
TSC bitmap bytes

Native commands：
- `print.lan.endpoint.apply`
- `print.lan.endpoint.test`
- `print.lan.dispatch`

打印設定 storage：
`mfk.v2local.printers.v3`

---

## 8. AUTO PRINT CURRENT CONTRACT

CASH 成交成功後：

Local Order commit
→ UI transaction SUCCESS
→ background print fanout

已綁定 route 先打印。

Route：
Receipt ×1
Production ×1
Packing ×1
Product Label × item quantity
Bag Label ×1

未綁定 route：
- 不阻 Order
- 不阻下一張 Order
- 不應亂印

Orders page 手動打印：
同樣走 configured fanout。

任何 route 失敗：
其他 route 繼續。

---

## 9. ACTIVE LOCAL POS FUNCTIONS

目前 MFK 已有：

- MoreFun V2 1920×1080 shell
- 點餐
- Categories
- Product tiles
- Cart
- Quantity
- 堂食 / 外賣 context 基礎
- CASH checkout
- Received / Change
- Local Order persistence
- Orders workspace
- Order Ready action
- Dining workspace
- Sold-out workspace
- Printer Registry / Binding
- Printer connection test
- Test print
- Auto print fanout
- Manual print
- Local Day Close
- Local Report
- Product ranking
- CSV export
- Local Backup
- Backup validation
- Restore

全部第一階段以 Local-First 為準。

---

## 10. CURRENT KNOWN DEBT / NOT DONE

以下唔可以假稱完成：

1. Label bitmap physical acceptance
   - Current main 7660f49 未 OTA / 未真機確認

2. Diagnostics / 檢測中心 latency
   - Owner 已觀察有延遲
   - 未正式修
   - Label physical GREEN 後先單獨打

3. Production / Packing physical print
   - software route 已有
   - 未有 Owner 真機逐張確認

4. Bag Label physical print
   - bitmap route 已有
   - 未有 Owner 真機確認

5. Modifier / Combo
   - 目前 Fusion baseline 未完整回復舊 SMT 全功能

6. 真 SQLite / Room
   - 目前 Local persistence 主要仍係 browser local storage
   - 未做 final durable Android DB migration

7. External / Cloud
   - 故意未接
   - 本地 POS 未穩定前禁止接

---

## 11. LOCAL-FIRST HARD RULE

本地 POS 必須唔靠 Internet：

BOOT
→ MENU
→ PRODUCT
→ CART
→ CHECKOUT
→ CASH
→ ORDER
→ LOCAL HISTORY
→ PRINT
→ NEXT ORDER

Cloud 永遠唔可以變成交前置。

第一階段禁止：

- D1
- Cloud bootstrap
- Cloud readback
- WebSocket
- Realtime
- Firebase
- Keeta
- Customer App
- SMM
- Owner Remote
- Remote Admin
- Remote Auth

之後先逐條 plugin 接。

---

## 12. UI HARD RULE

保留 MoreFun V2 UI 方向。

1920×1080。

唔再：
- 等比例縮成 1280×800
- 用 T2S preview frame
- 改成另一套陌生 POS
- 因功能修復順手重新設計全 UI

只可：
- 修 interaction
- 修功能
- 補需要 surface
- 保持原視覺方向

---

## 13. 開發方法

永久：

`ONE TRUE RED → FIX → SAME TEST GREEN → BUILD GREEN → OTA → PHYSICAL`

冇 executable diff：
未做。

冇 test：
未證。

冇 build：
未 build。

冇 OTA：
未部署。

冇真機出紙：
未 physical pass。

禁止：
- 寫長篇治理代替 code
- GREEN 後驗屍式無限加 test
- 將 pre-existing 問題冒充 candidate regression
- 一次打十個 FIRST BREAK
- 自動重試未知 physical print result

---

## 14. 下一手立即執行

WORK_ID：
`MFK-SMT-LABEL-BITMAP-PHYSICAL-R4`

ROLE：
LABEL BITMAP PHYSICAL ACCEPTANCE

MODE：
DIRECT TEST → OTA → PHYSICAL
NO CODEX

EXACT SOURCE：
`7660f49cfcd97c0679697af07f5bc194f7807c03`

CURRENT TEST：
`35566403875 = SUCCESS`

TASK：

1. Fresh-read exact source 7660f49
2. Confirm diff only affects bitmap polarity
3. Trigger OTA using exact 7660f49
4. Record:
   - releaseId
   - bundle filename
   - SHA-256
   - OTA run
5. Owner 真機印：
   - 原味飯團
   - Pxxx
   - 1/1
6. Verify：
   - 中文可讀
   - 黑字白底
   - 無反相黑底
   - 方向正確
   - 50×40 無越界
7. PASS：
   `LABEL_BITMAP_PHYSICAL_GREEN`
8. FAIL：
   只交 exact observed physical issue，禁止轉去其他功能

STOP CONDITIONS：
- 真機需要改 physical printer profile / protocol 而證據不足
- 會影響已 GREEN Receipt route
- 需要改 Carrier native protocol
- 需要改 Order / Payment semantics

---

## 15. 下一個排序

Label GREEN 後：

NEXT 1：
Diagnostics / 檢測中心 latency

NEXT 2：
Production ticket 真紙

NEXT 3：
Packing ticket 真紙

NEXT 4：
Bag Label 真紙

NEXT 5：
Modifier / Combo 本地功能融合

未輪到：
任何 Cloud / D1 / External integration。

---

## 16. SOURCE REFERENCE｜只作能力參考

歷史 Master Flow 可用嚟理解：
- Print 每個票種應該係獨立 job
- 不同 route 不應互相拖死
- Reprint 應係新 side-effect
- Physical proof 先算真正 Print acceptance

但唔可以用舊文件推翻 MFK current repo 真實狀態。

Admin 歷史規則可用嚟理解：
- logical printer identity
- SMT physical IP / USB / device binding
- Product Print flags
- Label routing

目前 MFK execution authority：
CURRENT REPO + OWNER CURRENT DECISION + REAL DEVICE RESULT。

---

## 17. HANDOFF RETURN FORMAT

完成後只交：

CURRENT_SOURCE =
OTA_RELEASE =
OTA_SHA256 =
OTA_RUN =
RECEIPT =
PRODUCTION =
PACKING =
PRODUCT_LABEL =
BAG_LABEL =
FIRST_BREAK =
NEXT =

第一行：

`MFK_SMT_SEAMLESS_HANDOFF_RETURN`

如果 Product Label 真機成功：

`LABEL_BITMAP_PHYSICAL_GREEN`
