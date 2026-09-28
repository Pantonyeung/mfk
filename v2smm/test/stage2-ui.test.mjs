import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage2.css',import.meta.url),'utf8');
const start=app.indexOf('function ProductSheet');
const end=app.indexOf('function CartSheet',start);
assert.ok(start>=0&&end>start);
const sheet=app.slice(start,end);

test('Stage 2 ProductConfigSheet keeps source sequence and does not move transaction authority',()=>{
  for(const marker of['stage2-product-media','規格','必選','可選','套餐','stage2-validation-summary','加入購物車']){
    assert.match(sheet,new RegExp(marker));
  }
  assert.doesNotMatch(sheet,/submitOrder\s*\(|setSellability\s*\(|createDineSession\s*\(/);
});

test('Stage 2 renders product media from the same canonical/fallback presentation helper',()=>{
  assert.match(sheet,/<ProductMedia product=\{product\} className="stage2-product-media"\/>/);
  assert.match(css,/\.stage2-product-media\{[\s\S]*aspect-ratio/);
  assert.match(css,/\.stage2-product-media img\{[\s\S]*object-fit:cover/);
});

test('Stage 2 preserves Variation Required Optional and min max validation semantics',()=>{
  assert.match(sheet,/product\.variationRequired/);
  assert.match(sheet,/const requiredGroups=product\.optionGroups\.filter/);
  assert.match(sheet,/const optionalGroups=product\.optionGroups\.filter/);
  assert.match(sheet,/const orderedGroups=\[\.\.\.requiredGroups,\.\.\.optionalGroups\]/);
  assert.match(sheet,/min=Math\.max\(group\.required\?1:0,group\.minSelections\)/);
  assert.match(sheet,/最少 \{min\} · 最多 \{group\.maxSelections\}/);
  assert.match(sheet,/已選 \{selected\.length\}\/\{group\.maxSelections\}/);
  assert.match(sheet,/disabled=\{!validation\.ok\|\|!variationOk\|\|!comboValidation\.ok\}/);
});

test('Stage 2 keeps Combo semantics and price projection without a second pricing engine',()=>{
  assert.match(sheet,/resolveSmmProductCombo/);
  assert.match(sheet,/validateSmmComboSelections/);
  assert.match(sheet,/publishedBasePriceMinor/);
  assert.match(sheet,/selectedAdjustmentMinor/);
  assert.match(sheet,/draftUnitMinor/);
  assert.doesNotMatch(sheet,/PricingEngine|OrderEngine|StoreKernel|second pricing/i);
});

test('Stage 2 inline repair never clears unrelated configuration',()=>{
  assert.match(sheet,/stage2-inline-error/);
  assert.match(sheet,/最少需要選擇/);
  assert.match(sheet,/最多只可以選擇/);
  assert.match(sheet,/暫停供應選項/);
  assert.match(sheet,/const disabled=!option\.available\|\|\(maxReached&&!active\)/);
});

test('Stage 2 normal copy removes engineering-stage language',()=>{
  assert.doesNotMatch(sheet,/正式產品圖片待補|只讀 Admin|正式提交由 SMT|加入草稿|加入套餐草稿/);
  assert.match(sheet,/商品客製/);
  assert.match(sheet,/加入購物車/);
});

test('Stage 2 mobile contract works at 440x956 and minimum 360x780',()=>{
  assert.match(css,/max-height:92dvh/);
  assert.match(css,/border-radius:26px 26px 0 0/);
  assert.match(css,/\.stage2-option-grid button\{[\s\S]*min-height:52px/);
  assert.match(css,/\.stage2-close\{[\s\S]*width:44px!important;[\s\S]*height:44px!important/);
  assert.match(css,/\.stage2-sticky-footer\{[\s\S]*position:sticky!important/);
  assert.match(css,/@media\(max-width:360px\)[\s\S]*\.stage2-option-grid\{grid-template-columns:1fr/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
