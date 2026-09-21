# MFK｜磨飯 POS 重新實作

呢個 repository 由零開始做一個真正可以本地運行嘅餐飲 POS。

## 目前第一版

- 純前端、本地運行
- 無 D1
- 無 Cloud
- 無 WebSocket
- 無登入／認證依賴
- 商品 → Cart → 現金結帳 → 本地 Order History
- Order 以 localStorage 保存，重新整理頁面仍然存在

## 公開原始 Report

見 [REPORT.md](./REPORT.md)。

## 直接預覽

打開 `index.html` 即可。

呢個 repo 目前刻意保持簡單：先證明本地功能可以運行，再逐個加 Printer、SQLite/Room、Android bridge、外部連線。
