import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage2.css',import.meta.url),'utf8');

test('Stage 2 product configuration sheet is implemented without moving order authority',()=>{
  assert.match(app,/import '\.\/stage2\.css'/);
  assert.match(app,/function ProductSheet/);
  assert.match(app,/stage2-product-sheet/);
  assert.match(app,/stage2-sticky-footer/);
  assert.doesNotMatch(app,/function ProductSheet[\s\S]*submitOrder\s*\(/);
  assert.doesNotMatch(app,/function ProductSheet[\s\S]*setSellability\s*\(/);
  assert.doesNotMatch(app,/function ProductSheet[\s\S]*createDineSession\s*\(/);
});

test('Stage 2 preserves product image policy and uses square empty media geometry',()=>{
  assert.match(app,/className="stage2-product-media"/);
  assert.match(app,/正式產品圖片待補/);
  assert.match(css,/\.stage2-product-media\{[\s\S]*aspect-ratio:1\/1/);
  assert.doesNotMatch(app,/stage2-product-media[^\n]*<img/);
});

test('Stage 2 groups expose required optional min max and selected count',()=>{
  assert.match(app,/min=Math\.max\(group\.required\?1:0,group\.minSelections\)/);
  assert.match(app,/最少 \{min\} · 最多 \{group\.maxSelections\}/);
  assert.match(app,/已選 \{selected\.length\}\/\{group\.maxSelections\}/);
  assert.match(app,/product\.variationRequired\?'必選':'可選'/);
});

test('Stage 2 shows published price adjustments and draft unit total',()=>{
  assert.match(app,/selectedAdjustmentMinor/);
  assert.match(app,/deltaLabel/);
  assert.match(app,/選項調整/);
  assert.match(app,/draftUnitMinor/);
  assert.match(app,/草稿價格待同步/);
});

test('Stage 2 validation remains local to invalid section and add stays disabled until valid',()=>{
  assert.match(app,/stage2-inline-error/);
  assert.match(app,/groupError/);
  assert.match(app,/disabled=\{!validation\.ok\|\|!variationOk\}/);
  assert.match(app,/最少需要選擇/);
  assert.match(app,/最多只可以選擇/);
  assert.match(app,/暫停供應選項/);
});

test('Stage 2 max selection guard does not block radio-like replacement groups',()=>{
  assert.match(app,/const maxReached=group\.maxSelections>1&&selected\.length>=group\.maxSelections/);
  assert.match(app,/const disabled=!option\.available\|\|\(maxReached&&!active\)/);
});

test('Stage 2 sheet locks mobile interaction contract',()=>{
  assert.match(css,/max-height:88dvh/);
  assert.match(css,/border-radius:24px 24px 0 0/);
  assert.match(css,/\.stage2-option-grid button\{[\s\S]*min-height:48px/);
  assert.match(css,/\.stage2-close\{[\s\S]*width:44px!important;[\s\S]*height:44px!important/);
  assert.match(css,/\.stage2-sticky-footer\{[\s\S]*position:sticky!important/);
  assert.match(css,/@media\(max-width:389px\)[\s\S]*\.stage2-option-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Stage 2 IP and mascot production remains absent',()=>{
  assert.doesNotMatch(app,/stage2[^\n]*(ip-|mascot|character)/i);
  assert.doesNotMatch(css,/background-image|url\(/);
});
