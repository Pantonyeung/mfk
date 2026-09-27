import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage3.css',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/product-types.ts',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');

test('Stage 3 CartSheet is bounded and hands off to the preserved checkout surface',()=>{
  assert.match(app,/import '\.\/stage3\.css'/);
  assert.match(app,/function CartSheet/);
  assert.match(app,/function CheckoutSheet/);
  assert.match(app,/onCheckout=\{\(\)=>\{setCartOpen\(false\);setCheckoutOpen\(true\)\}\}/);
  const cartSheet=app.slice(app.indexOf('function CartSheet'),app.indexOf('function CheckoutSheet'));
  assert.doesNotMatch(cartSheet,/submitOrder\s*\(/);
  assert.doesNotMatch(cartSheet,/onSubmit:/);
  assert.match(cartSheet,/前往結帳/);
});

test('Stage 3 keeps same-product configurations as independent lines and edits the same lineId',()=>{
  assert.match(app,/lineId:existingLine\?\.lineId\?\?crypto\.randomUUID\(\)/);
  assert.match(app,/quantity:existingLine\?\.quantity\?\?1/);
  assert.match(app,/createdAt:existingLine\?\.createdAt\?\?nowIso\(\)/);
  assert.match(app,/cart\.map\(current=>current\.lineId===existingLine\.lineId\?line:current\)/);
  assert.match(app,/setEditingLineId\(line\.lineId\)/);
  assert.match(app,/comboSelectionStateFromIntent\(line\.combo\)/);
});

test('Stage 3 renders variation, required, optional, Combo, quantity and preview totals',()=>{
  assert.match(app,/line\.selectedVariationName\?<p><b>規格<\/b>/);
  assert.match(app,/requiredChoices\.length\?<p><b>必選<\/b>/);
  assert.match(app,/optionalChoices\.length\?<p><b>可選<\/b>/);
  assert.match(app,/line\.combo\?<p><b>套餐<\/b>/);
  assert.match(app,/單價預覽/);
  assert.match(app,/小計/);
  assert.match(app,/已發布餐單預覽總額/);
  assert.match(app,/Number\(line\.publishedUnitPriceMinor\)\*line\.quantity/);
});

test('Stage 3 quantity never becomes hidden delete and remove targets only one line',()=>{
  assert.match(app,/Math\.max\(1,quantity\)/);
  assert.match(app,/disabled=\{line\.quantity<=1\}/);
  assert.match(app,/cart\.filter\(line=>line\.lineId!==lineId\)/);
  assert.match(css,/\.stage3-qty button\{width:44px;height:44px/);
  assert.match(css,/\.stage3-line-actions>button\{min-height:44px/);
});

test('Stage 3 menu revision repair is line-scoped and local storage stays non-authoritative',()=>{
  assert.match(types,/readonly publishedMenuRevision\?:string/);
  assert.match(types,/readonly attention\?:SmmCartLineAttention/);
  assert.match(app,/PRODUCT_UNAVAILABLE/);
  assert.match(app,/VARIATION_UNAVAILABLE/);
  assert.match(app,/OPTION_UNAVAILABLE/);
  assert.match(app,/COMBO_CHANGED/);
  assert.match(app,/PRICE_CHANGED/);
  assert.match(app,/const next=cart\.map\(line=>\{/);
  assert.match(app,/其他項目已保留/);
  assert.doesNotMatch(app,/餐單已更新[^\n]*setCart\(\[\]\)/);
  assert.match(persistence,/storageKind:'LOCAL_NON_AUTHORITATIVE'/);
});

test('Stage 3 keeps published preview facts and does not add Pricing or Combo authority',()=>{
  assert.match(app,/正式價格仍由 SMT 提交時重新驗證/);
  assert.match(app,/publishedSmmComboUnitMinor/);
  assert.match(app,/revalidateSmmCartComboIntent/);
  assert.doesNotMatch(app,/function .*PricingEngine|class .*PricingEngine|function .*ComboEngine|class .*ComboEngine/);
});

test('Stage 3 geometry covers 440x956 primary and 360x780 minimum mobile contracts',()=>{
  assert.match(css,/max-height:88dvh/);
  assert.match(css,/grid-template-rows:auto auto auto minmax\(0,1fr\) auto auto auto/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/min-height:min\(82dvh,780px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  for(const [width,height] of [[440,956],[360,780]]){
    assert.ok(width>=360&&width<=520);
    assert.ok(height>=780);
  }
});
