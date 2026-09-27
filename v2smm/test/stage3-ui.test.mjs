import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage3.css',import.meta.url),'utf8');
const cartStart=app.indexOf('function CartSheet');
const cartEnd=app.indexOf('function DiningTargetSheet',cartStart);
assert.ok(cartStart>=0&&cartEnd>cartStart,'CartSheet source range must exist');
const cartSheet=app.slice(cartStart,cartEnd);

test('Stage 3 CartSheet is present and does not start Stage 4 checkout execution',()=>{
  assert.match(app,/import '\.\/stage3\.css'/);
  assert.match(cartSheet,/stage3-cart-sheet/);
  assert.match(cartSheet,/購物草稿/);
  assert.match(cartSheet,/服務方式/);
  assert.match(cartSheet,/堂食/);
  assert.match(cartSheet,/外賣/);
  assert.match(cartSheet,/前往結帳 →/);
  assert.doesNotMatch(cartSheet,/收款方式|提交訂單|重新確認結果/);
  assert.doesNotMatch(cartSheet,/onSubmit|onTender|diningTarget|submitCart|submitOrder|readSubmission/);
});

test('Stage 3 line workflow supports edit quantity remove unit line-total and optional note',()=>{
  for(const marker of[
    'onEdit','onQuantity','onRemove','stage3-line','stage3-qty','stage3-remove',
    '訂單備註','單價','行總額','validSubtotalMinor'
  ])assert.match(cartSheet,new RegExp(marker));
  assert.match(cartSheet,/smmLineTotalMinor\(line\.publishedUnitPriceMinor,line\.quantity\)/);
  assert.match(cartSheet,/maxLength=\{160\}/);
  assert.match(app,/onNote=\{changeCartNote\}/);
});

test('editing an existing line preserves stable cart line identity and creation identity',()=>{
  assert.match(app,/const existingLine=editingLineId\?cart\.find\(item=>item\.lineId===editingLineId\):undefined/);
  assert.match(app,/lineId:existingLine\?\.lineId\?\?crypto\.randomUUID\(\)/);
  assert.match(app,/createdAt:existingLine\?\.createdAt\?\?nowIso\(\)/);
  assert.match(app,/quantity:existingLine\?\.quantity\?\?1/);
  assert.match(app,/cart\.map\(item=>item\.lineId===existingLine\.lineId\?line:item\)/);
  assert.match(app,/原有項目身份保持不變/);
});

test('new same-product additions remain separate lines instead of implicit merge',()=>{
  assert.match(app,/lineId:existingLine\?\.lineId\?\?crypto\.randomUUID\(\)/);
  assert.match(app,/:\[\.\.\.cart,line\]/);
  assert.doesNotMatch(app,/find\([^\n]*productId===selectedProduct\.productId[^\n]*\)\?[^\n]*quantity/);
});

test('editing restores Stage 2 modifier variation and canonical Combo selections',()=>{
  assert.match(app,/setSelectedVariationId\(line\.selectedVariationId\?\?null\)/);
  assert.match(app,/setComboEnabled\(Boolean\(line\.combo\)\)/);
  assert.match(app,/comboSelectionStateFromIntent\(line\.combo\)/);
  assert.match(app,/restored\[selection\.optionGroupId\]/);
  assert.match(app,/setSelections\(Object\.freeze\(restored\)\)/);
});

test('menu refresh creates line-scoped PRICE_CHANGED or CONFIG_CHANGED repair and blocks checkout',()=>{
  assert.match(app,/未確認前唔會靜默接受新價格或套餐資料/);
  assert.match(app,/buildSmmCartRefreshAttention/);
  assert.match(cartSheet,/line\.refreshAttention\?\?null/);
  assert.match(cartSheet,/attention\.kind/);
  assert.match(app,/PRICE_CHANGED/);
  assert.match(app,/CONFIG_CHANGED/);
  assert.match(cartSheet,/舊價/);
  assert.match(cartSheet,/新價/);
  assert.match(cartSheet,/接受更新/);
  assert.match(cartSheet,/重新編輯/);
  assert.match(cartSheet,/只修正有問題嗰一行；其他購物草稿保持不變/);
  assert.match(cartSheet,/const checkoutReady=Boolean\(menu&&cart\.length&&affectedCount===0&&quote\)/);
  assert.match(cartSheet,/disabled=\{!checkoutReady\}/);
});

test('Stage 3 keeps published-price projection and explicitly retains SMT authoritative revalidation',()=>{
  assert.match(cartSheet,/publishedUnitPriceMinor/);
  assert.match(cartSheet,/SMT 提交時重新驗證/);
  assert.match(cartSheet,/SMT 仍會再驗證/);
  assert.match(app,/revalidateSmmCartComboIntent/);
  assert.match(app,/publishedSmmComboUnitMinor/);
  assert.doesNotMatch(cartSheet,/PricingEngine|ComboEngine|OrderEngine|createFormalOrder|StoreKernel/);
});

test('Stage 3 service mode stays inside CartSheet without opening Dining Target',()=>{
  assert.match(app,/const changeServiceMode=\(next:SmmServiceMode\)=>/);
  assert.match(app,/if\(next==='TAKEAWAY'\)setDiningTarget\(null\)/);
  assert.doesNotMatch(app,/if\(next==='DINE_IN'\)setDiningTargetOpen\(true\)/);
  assert.match(cartSheet,/枱號、付款同提交留待下一 Stage/);
});

test('Stage 3 mobile interaction and empty state contract is responsive and touch-safe',()=>{
  assert.match(css,/\.stage3-cart-sheet\{[\s\S]*max-height:94dvh/);
  assert.match(css,/\.stage3-line-media\{[\s\S]*aspect-ratio:1\/1/);
  assert.match(css,/\.stage3-edit\{[\s\S]*min-width:44px;[\s\S]*min-height:44px/);
  assert.match(css,/\.stage3-qty button\{[\s\S]*width:44px;[\s\S]*height:44px/);
  assert.match(css,/\.stage3-checkout\{[\s\S]*min-height:52px/);
  assert.match(css,/@media\(max-width:389px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(cartSheet,/購物草稿係空嘅/);
  assert.match(cartSheet,/去點單/);
  assert.doesNotMatch(css,/background-image|url\(/);
});



test('Stage 3 optional cart note persists only as local non-authoritative workspace data',()=>{
  const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/readonly cartNote:string/);
  assert.match(persistence,/cartNote:typeof parsed\.cartNote==='string'\?parsed\.cartNote\.slice\(0,160\):''/);
  assert.match(app,/const \[cartNote,setCartNote\]=useState\(initial\.cartNote\)/);
  assert.match(app,/persist\(\{cartNote:next\}\)/);
  assert.doesNotMatch(persistence,/Formal Order|Store Kernel|Pricing engine/i);
});

test('Stage 0-2 surfaces remain present while Stage 3 reuses ProductSheet for line editing',()=>{
  assert.match(app,/stage1-order/);
  assert.match(app,/stage2-product-sheet/);
  assert.match(app,/editing\?'編輯商品':'商品設定'/);
  assert.match(app,/editing\?'完成'/);
});
