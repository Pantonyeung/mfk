# MFK

公開嘅磨飯 POS 實作 repo。

Active implementation 只有：

`v2local/`

呢一版直接以 MoreFun V2 SMT 嘅 1920×1080 UI 做基礎，重新接成本地 POS。

目前：

- MoreFun V2 1920×1080 production viewport
- 點餐
- Cart
- 現金結帳
- 本機 Order persistence
- 訂單
- 堂食畫面
- 售罄
- 打印與設備
- Carrier 1.0.6 Native Print Bridge
- Sunmi 內置打印機測試
- LAN printer apply / connect test / test print

Active runtime 禁止：

- D1
- Cloud
- WebSocket
- Firebase
- 外部訂單入口
- 遠端身份／登入依賴

舊 static POS 已由 active repo 移除。

原始研究入口：`REPORT.md`
