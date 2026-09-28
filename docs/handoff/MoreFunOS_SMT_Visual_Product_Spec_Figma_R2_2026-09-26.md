# MoreFunOS SMT｜視覺產品規範 Figma R2

日期：2026-09-26  
狀態：VISUAL_SPEC_R2_REFERENCE_REFINEMENT_APPLIED

## Figma
https://www.figma.com/design/IXVdHuiKvg5FZpJePBaOHX

## 新參考圖收斂
本輪新參考圖主要語言：
- Premium consumer UI
- Soft glass surfaces
- Ambient gradient
- Capsule controls
- Floating cards
- Selective dark contrast

產品判斷：
只吸收「質感」，不照搬 mobile-first 低資訊密度。
SMT 仍以快速、清楚、固定肌肉記憶、高密度餐飲操作為核心。

## 已修改

### 00｜視覺系統
- 新增 R2「Soft Glass Operational」章節
- 背景改柔和藍紫＋暖杏環境漸變
- 卡片改 24–30px 圓角＋hairline＋soft shadow
- 漸變只准用於背景、Hero、非交易區
- 局部深色高對比只限 Attention / Diagnostics

### 01｜版面與元件
- 1920×1080 Shell 改成浮層式 Rail / Top / Content / Cart
- Product Card / Pending Card / Cart Line / Modal 加大圓角與 elevation
- Category / Chip 採 capsule 語言
- 固定右側交易欄、4 欄產品格、75% Modal 保留

### 02｜核心畫面
- Checkout
- Orders
- Dining
- Sold-out / Capacity

全部套用：
- Ambient backdrop
- Floating neutral transaction surfaces
- Larger radius
- Soft elevation

## 視覺守門
Money / Status / Checkout / Sold-out / Error：
- 必須文字顯示
- 必須用固定語義色
- 不得靠漸變、玻璃感、裝飾色表達 transaction truth

## Authority
本輪只改視覺、資訊層級與操作幾何。
不得改 Order / Pricing / Payment / Print truth。

## QA
Figma MCP Starter read tool quota 已達上限。
Write mutations 已成功；最新 screenshot visual QA 尚待 read quota 恢復後補做。

## NEXT
1. 恢復 Figma read quota 後做 screenshot QA
2. 如有 clipping / contrast / density 問題，只做 targeted fix
3. Owner 視覺驗收
4. 再升級正式 component / variant library
