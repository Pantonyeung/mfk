# MFK 客戶端產品 Brief｜Working V10

## Owner 決定
人工參考碼必須純數字，4–6 位，方便現場口述及搜尋。

## 建議預設
使用 6 位純數字。

原因：
- 取餐碼已固定為電話最後 4 位。
- 如果人工參考碼同樣固定 4 位，繁忙時容易與取餐碼混淆。

## Identity Separation
- pickupCode：4 位電話 last4
- displayNumber：SMT Formal Order 流水號
- fallbackReference：4–6 位純數字，預設 6 位

## Retry Rule
同一 submissionId 的所有 retry 必須沿用同一 fallbackReference。