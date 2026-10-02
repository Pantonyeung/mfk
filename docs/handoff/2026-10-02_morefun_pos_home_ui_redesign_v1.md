# MFK MoreFun POS｜首頁 UI 重設｜設計方向交接 V1
日期：2026-10-02
狀態：MILESTONE｜VISUAL_DIRECTION_READY｜OWNER_SELECTION_PENDING

## 目標
重做 MoreFun POS 首頁／主點單工作區視覺，不重建交易邏輯。保留既有 POS 操作骨架：導航／新單提示／分類／商品區／右側 Live Check／底部主要操作；視覺改成更大圖、更吸引、更有品牌感。

## 本輪參考來源
- Component Gallery：成熟設計系統的元件處理方法
- Minimal Gallery：高端網站的大圖、留白、排版、品牌敘事
- Appshot Gallery：現代 App 的 image-first cards、bold/minimal/3D 等方向
- Navbar Gallery：導航層級與低干擾導覽
- CTA Gallery：主要動作的視覺權重
- ui2v / Awesome Opus 5.5 Videos：後續 motion / micro-interaction 參考

## 四套視覺方向
A｜Editorial Hero：大幅餐點 Hero + 極簡商品卡 + 固定 Live Check
B｜Bento Gallery：大型 Bento 圖塊 + 快速分類 + 操作型卡片
C｜Immersive Layered：大圖場景 + 半透明功能層 + 快速動作 Dock
D｜Bold Command Deck：深色高對比 + 大圖商品 + 清晰 operational hierarchy

## 硬邊界
- 不建立第二 Pricing / Order / Sellability authority
- UI 只做 projection，不改 canonical workflow
- 大圖不可遮住高頻點單效率
- 右側 Live Check 必須常駐
- 所有主要 CTA 需適合觸控
- 後續 Owner 選 A/B/C/D 後，先深化單一方向，再拆 component spec

## 下一步
Owner 選一套方向或指定混合兩套；再產出第二輪精修首頁、商品卡、分類、Live Check、狀態/異常、主要 CTA。
