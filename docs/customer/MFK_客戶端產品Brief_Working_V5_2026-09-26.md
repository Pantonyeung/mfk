# MFK 客戶端產品 Brief｜Working V5
日期：2026-09-26
狀態：需求收集中

## 第二頁：點單
核心流程：
分類 → Hero → Product Card → Detail → 套餐升級 → Required → Optional → 智能推薦 → 即時計價 → 加入記憶罐。

## 核心決定
- 每分類保留 Hero，但採 lazy-load／按目前分類呈現。
- 飯團可升級套餐時，套餐升級先於細項推薦。
- Required 與 Recommendation 完全分開；Required 未完成不得加入記憶罐。
- A/B/C/D 必須由 Catalog metadata 定義，不靠價格反推。
- 推薦引擎第一版採規則 + 商品語義 + 共購 + Session + 會員歷史，不先做大型黑盒 AI。
- 推薦最多 2–3 件；記憶罐只放一個推薦模組。
- 推薦系統不擁有 Product / Pricing / Sellability / Combo / Order authority。
- Cart 重新驗證只修受影響商品，不無必要清空整個記憶罐。

## 推薦 V1 初始排序
35% Cart 完整度
25% 共購
15% 個人偏好
10% Session
10% 時段／期間限定
5% Admin boost
另加拒絕／移除／疲勞 penalty。

## 外部對照
- 美團：套餐搭配要兼顧共購與菜品語義。
- Uber Eats：Modifier 規則 + Suggested Combos + 售罄排除。
- Keeta：SPU/SKU/ChoiceGroup 與 Required semantics。
- foodpanda：高質圖片、Combo、少量有意義 Add-on。
- 微信小程序：單店短路徑、低跳轉、原生感。
- 大眾點評：推薦菜／視覺發現，但不作交易 authority 參考。

## 下一步
鎖 Category navigation、Hero 尺寸、Product Detail 版面、記憶罐優惠／節省／狀態語義。
