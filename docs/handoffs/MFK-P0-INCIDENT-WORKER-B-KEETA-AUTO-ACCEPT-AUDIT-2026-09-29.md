# MFK P0 Incident Worker B｜Keeta Auto-Accept Audit｜2026-09-29

MODE: READ-ONLY
ROLE: Principal Keeta Integration / Order Lifecycle Auditor

## 結論
EXPECTED_ACCEPTANCE_MODE: MANUAL
CURRENT_ACCEPTANCE_MODE: AUTO（current SMT LKG channelPolicy.autoAccept === true 時）
AUTO_ACCEPT_AUTHORITY: Admin canonical published config → snapshot.channelPolicy.autoAccept
LAST_KNOWN_GOOD: Manual contract；repo default autoAccept=false。昨晚 exact published revision/value 尚未取得 live canonical revision evidence。
FIRST_BAD_CHANGE: 尚未能以現有 read-only evidence 鎖定 exact revision/commit；高疑點為 2026-09-29 rollback/config convergence 後舊 published policy/LKG 被重新帶回。
EXACT_TRIGGER: reconcileKeetaOrderIntake() 建立 Order → ack() → autoAcceptEnabled() === true + fulfillmentLabel==='待處理' → localRuntime.acceptOrder(order.id)
CONFIG_VALUE_EVIDENCE: Admin UI default false；collectAdminSnapshot 直接收 channel-policy.keeta.v1；runtime 只接受 strict === true，missing/false 都不自動接。
SMT_LKG_EVIDENCE: autoAcceptEnabled() 直接讀 readSmtAdminConfigLkg().snapshot.channelPolicy.autoAccept。
ACCEPT_CALL_PATH: ORDER RECEIVED → ORDER CREATED(待處理) → ORDER ACKED INTO MFK → AUTO ACCEPTED。
PROVIDER_CONFIRM_PATH: acceptOrder() → mirrorKeetaOrderCommand(order,'CONFIRM')；即自動接受會觸發 Keeta CONFIRM mirror。
ROOT_CAUSE: 行為唔係 default=true；係有效 SMT LKG 內 autoAccept=true。尚欠 live canonical revision / Admin browser stored value / SMT LKG revision 三方 readback，故 exact first bad revision 不可假證。
CONFIDENCE: HIGH（call path/default/missing/CONFIRM）；MEDIUM（stale LKG/rollback revival hypothesis）；LOW（exact first bad revision，未有 live config evidence）。
SMALLEST_SAFE_FIX: 暫不修。正式修復時只應將 canonical Keeta acceptance policy 發布為 autoAccept=false，確認 cloud canonical readback + SMT LKG revision/value 一致；禁止改 acceptOrder code、禁止 provider command、禁止用真單試錯。

## 關鍵區分
ORDER RECEIVED = Keeta webhook/order intent 到達。
ORDER CREATED = SMT localRuntime.createOrder 建 canonical Order，初始待處理。
ORDER ACKED INTO MFK = ack() 回寫 canonicalOrderId/display/committedAt。
STAFF ACCEPTED = Staff 明確操作 acceptOrder。
AUTO ACCEPTED = policy true 時 intake loop 自動呼叫 acceptOrder。
PROVIDER CONFIRMED = acceptOrder 內 mirrorKeetaOrderCommand(...,'CONFIRM') 對 Keeta 做確認 mirror。

## 已證
- Admin ChannelConfig default：autoAccept:false。
- missing channelPolicy / missing autoAccept / false：autoAcceptEnabled() 均 false。
- true 只可由 snapshot.channelPolicy.autoAccept === true 生效。
- collectAdminSnapshot 將 channel-policy.keeta.v1 原值放入 canonical snapshot。
- acceptOrder 會執行 Keeta CONFIRM mirror。
- 2026-09-27 A3B contract 明確存在 pending Summary Review Accept / manual defer；因此預期人工接單有 repo lineage。
- 2026-09-29 有 rollback「restore last accepted system tree」及之後 Admin/SMT config convergence；但現有證據未證明邊個 revision 把 true 寫入，唔可亂指 commit。

## 下一手只讀證據
1. 讀 live Cloud canonical active revision + channelPolicy。
2. 讀 Admin browser channel-policy.keeta.v1 stored value。
3. 讀 SMT readSmtAdminConfigLkg revision/fingerprint/channelPolicy。
4. 對昨晚最後正常 revision 做同欄位 readback。
5. 找第一個 false→true revision transition，先可正式填 FIRST_BAD_CHANGE。
