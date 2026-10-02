# MFK POS UI Redesign｜Concept Round R1｜2026-10-02

## 狀態
MILESTONE: UI_CONCEPT_R1_GENERATED
範圍：SMT / MoreFun POS 1920×1080 Pad/Desktop ordering workspace
本輪只做視覺方向研究與概念圖，未改產品 code、未改 canonical workflow、未 deploy。

## Owner Request
- 參考 component.gallery / minimal.gallery / appshot.gallery / navbar.gallery / footer.design / cta.gallery / ui2v.com / yihui-dev/awesome-opus5-5-videos。
- 不限餐飲業。
- 方向要「大圖吸引」。
- 每輪四套方案。
- 1920×1080 Pad 版。
- 首頁／工作流骨架保持 POS 操作語義，不做成 marketing website。

## Canonical UI Boundary
沿用現有 SMT Desktop contract：
- 左 rail / navigation
- incoming / status top area
- categories
- large product grid
- contextual fast lanes
- right Live Check / Current Order
- bottom/primary actions
- UI 只 projection，不重造 pricing/order authority

## External Inspiration Findings
1. Component Gallery：抽 component consistency、hierarchy、states。
2. Minimal Gallery：抽 high-end editorial composition、large imagery、white space、bold typography。
3. AppShot Gallery：抽真實 mobile/app functional patterns、modern/bold/functional styles。
4. Navbar Gallery：抽 sidebar / static nav / search hierarchy。
5. CTA Gallery：抽 primary CTA contrast、button hierarchy。
6. Opus 5.5 prompt collection：可用「先定 visual system + reference + real assets + multiple variants」方法，不直接複製作品。

## Generated Concepts
A｜Warm Editorial / 大圖米白
- file: /mnt/data/a_wide_desktop_tablet_ui_screenshot_of_a_modern_po.png
- 特徵：米白、高端編輯感、大 hero 食物圖、清晰卡片、右側 Current Order。

B｜Immersive Dark / 深色沉浸
- file: /mnt/data/wide_high_resolution_ui_mockup_of_a_modern_point.png
- 特徵：深藍黑底、紫藍發光、圖片高對比、夜間/高端科技感。

C｜Bold Graphic / 大字高對比
- file: /mnt/data/wide_screenshot_of_a_modern_restaurant_pos_orderin.png
- 特徵：大標題、深藍粗字、強層級、圖片與資訊對比清楚。

D｜Soft Spatial / 柔和空間
- file: /mnt/data/wide_clean_modern_ui_mockup_of_a_restaurant_food.png
- 特徵：淺色、圓角、紫色漸層、大 hero、較親和品牌感。

另外有一張 2×2 四方向總覽：
- /mnt/data/a_clean_high_resolution_ui_mockup_of_a_restaurant.png

## 下一步
等 Owner 揀 A/B/C/D 或指定混合，例如 A 版骨架 + B 版色彩 + D 版卡片。
下一輪只深化獲選方向：grid spacing、touch target、category density、Live Check、bottom actions、empty/error/selected states。
未經 Owner 選型，不進 code implementation。

## 風險
- 概念圖文字/Logo 只供方向判斷；正式落地需使用正式 Logo asset、真商品圖、實際字體與 design tokens。
- 不應因視覺重做而改 canonical pricing/order/fulfillment semantics。
