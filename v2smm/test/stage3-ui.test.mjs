import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage3.css',import.meta.url),'utf8');
const cartStart=app.indexOf('function CartSheet');
const stage4Start=app.indexOf('function Stage4CheckoutView',cartStart);
const stage3Start=app.indexOf('  const rows=cart.map',cartStart);
assert.ok(cartStart>=0&&stage3Start>cartStart&&stage4Start>stage3Start);
const cartSheet=app.slice(stage3Start,stage4Start);

test('Stage 3 contains final cart workflow only and hands off to checkout',()=>{
  for(const marker of['購物車','服務方式','堂食','外賣','stage3-line','stage3-qty','stage3-edit','stage3-remove','總額','去結帳']){
    assert.match(cartSheet,new RegExp(marker));
  }
  assert.doesNotMatch(cartSheet,/付款方式|確認落單|readSubmission|submitOrder/);
});

test('Stage 3 cart lines use product media and human option summary',()=>{
  assert.match(cartSheet,/menu\?\.products\.find\(item=>item\.productId===line\.productId\)/);
  assert.match(cartSheet,/<ProductMedia product=\{mediaProduct\} className="stage3-line-media"\/>/);
  assert.match(cartSheet,/line\.selectedVariationName/);
  assert.match(cartSheet,/line\.selections\.map\(item=>item\.optionName\)/);
  assert.match(cartSheet,/line\.combo\?\.selections\.map/);
  assert.match(css,/\.stage3-line-media img\{[\s\S]*object-fit:cover/);
});

test('Stage 3 edit preserves line identity, quantity and creation identity',()=>{
  assert.match(app,/const existingLine=editingLineId\?cart\.find\(item=>item\.lineId===editingLineId\):undefined/);
  assert.match(app,/lineId:existingLine\?\.lineId\?\?crypto\.randomUUID\(\)/);
  assert.match(app,/createdAt:existingLine\?\.createdAt\?\?nowIso\(\)/);
  assert.match(app,/quantity:existingLine\?\.quantity\?\?1/);
  assert.match(app,/cart\.map\(item=>item\.lineId===existingLine\.lineId\?line:item\)/);
});

test('Stage 3 menu refresh remains line-scoped and blocks checkout only for affected lines',()=>{
  assert.match(app,/buildSmmCartRefreshAttention/);
  assert.match(cartSheet,/line\.refreshAttention\?\?null/);
  assert.match(cartSheet,/attention\.kind==='PRICE_CHANGED'\?'價格有更新':'商品內容有更新'/);
  assert.match(cartSheet,/舊價/);
  assert.match(cartSheet,/新價/);
  assert.match(cartSheet,/接受更新/);
  assert.match(cartSheet,/重新編輯/);
  assert.match(cartSheet,/const checkoutReady=Boolean\(menu&&cart\.length&&affectedCount===0&&quote\)/);
  assert.match(cartSheet,/disabled=\{!checkoutReady\}/);
});

test('Stage 3 service mode stays in cart and does not invent dining target',()=>{
  assert.match(app,/const changeServiceMode=\(next:SmmServiceMode\)=>/);
  assert.match(app,/if\(next==='TAKEAWAY'\)setDiningTarget\(null\)/);
  assert.doesNotMatch(app,/if\(next==='DINE_IN'\)setDiningTargetOpen\(true\)/);
  assert.match(cartSheet,/堂食或外賣都可以喺結帳前再改/);
});

test('Stage 3 keeps quote projection without displaying engineering language',()=>{
  assert.match(cartSheet,/publishedUnitPriceMinor/);
  assert.match(app,/revalidateSmmCartComboIntent/);
  assert.match(app,/publishedSmmComboUnitMinor/);
  assert.doesNotMatch(cartSheet,/SMT|Store Kernel|PricingEngine|ComboEngine|OrderEngine/);
  assert.doesNotMatch(cartSheet,/>PRICE_CHANGED<|>CONFIG_CHANGED</);
});

test('Stage 3 cart note stays local non-authoritative workspace data',()=>{
  const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/readonly cartNote:string/);
  assert.match(app,/const \[cartNote,setCartNote\]=useState\(initial\.cartNote\)/);
  assert.match(app,/persist\(\{cartNote:next\}\)/);
});

test('Stage 3 responsive card hierarchy is touch safe at 440 and 360 widths',()=>{
  assert.match(css,/\.stage3-cart-sheet\{[\s\S]*max-height:94dvh/);
  assert.match(css,/\.stage3-line-media\{[\s\S]*aspect-ratio:1\/1/);
  assert.match(css,/\.stage3-edit\{[\s\S]*min-width:44px!important;[\s\S]*min-height:44px!important/);
  assert.match(css,/\.stage3-qty button\{[\s\S]*width:44px!important;[\s\S]*height:44px!important/);
  assert.match(css,/\.stage3-checkout\{[\s\S]*min-height:52px!important/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(cartSheet,/購物車仲係空嘅/);
  assert.match(cartSheet,/去點單/);
});

test('Stage 0-2 source surfaces remain present while Stage 3 reuses ProductSheet for edit',()=>{
  assert.match(app,/stage1-order/);
  assert.match(app,/stage2-product-sheet/);
  assert.match(app,/editing\?'編輯商品':'商品客製'/);
  assert.match(app,/editing\?'儲存修改':'加入購物車'/);
});
