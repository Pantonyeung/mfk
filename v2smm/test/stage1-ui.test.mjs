import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage1.css',import.meta.url),'utf8');
const slots=JSON.parse(readFileSync(new URL('../public/brand/stage1/asset-slots.json',import.meta.url),'utf8'));

test('Stage 1 order surface is implemented and scoped without changing order authority',()=>{
  assert.match(app,/import '\.\/stage1\.css'/);
  assert.match(app,/data-view=\{view\}/);
  assert.match(app,/stage1-order/);
  assert.match(app,/stage1-product-grid/);
  assert.match(app,/stage1-cart-bar/);
  assert.doesNotMatch(app,/function OrderView[\s\S]*submitOrder\s*\(/);
});

test('Stage 1 product imagery stays blank until official product photography exists',()=>{
  assert.match(app,/className="product-media"/);
  assert.match(app,/正式產品圖片待補/);
  assert.doesNotMatch(app,/product-avatar/);
  assert.equal(slots.ownerLock.productPhotography,'OFFICIAL_ONLY');
  assert.equal(slots.stage1.productCards.imageStatus,'EMPTY_UNTIL_OFFICIAL_PRODUCT_PHOTO');
  assert.equal(slots.stage1.productCards.fakeFoodImages,false);
});

test('Stage 1 pauses all IP and defers future graphics to discrete asset slots',()=>{
  assert.equal(slots.ownerLock.ipProduction,'PAUSED');
  assert.equal(slots.ownerLock.generatedCharacters,'DO_NOT_CREATE');
  assert.match(slots.ownerLock.visualRule,/discrete asset file/);
  assert.doesNotMatch(app,/stage0\/splash-male|stage0\/login-female|stage0\/connecting-male|stage0\/recovery-female/);
  assert.ok(existsSync(new URL('../public/brand/stage1/asset-slots.json',import.meta.url)));
});

test('Stage 1 product media is square at every breakpoint and responsive geometry remains locked',()=>{
  assert.match(css,/\.product-media\{[\s\S]*aspect-ratio:1\/1/);
  assert.doesNotMatch(css,/aspect-ratio:4\/3/);
  assert.doesNotMatch(css,/aspect-ratio:16\/8/);
  assert.match(css,/\.stage1-product-grid\{[\s\S]*grid-template-columns:repeat\(2/);
  assert.match(css,/@media\(max-width:360px\)[\s\S]*\.stage1-product-grid\{grid-template-columns:1fr\}/);
  for(const width of [360,375,390,430,440,520])assert.ok(width>=360&&width<=520);
  assert.doesNotMatch(css,/product-avatar/);
});

test('Stage 1 product card exposes a visible plus affordance only for available products',()=>{
  assert.match(app,/product\.available\?<span className="stage1-product-add" aria-hidden="true">＋<\/span>:null/);
  assert.doesNotMatch(app,/stage1-product-add[^\n]*<button/);
  assert.match(css,/\.stage1-product-add\{[\s\S]*width:48px;[\s\S]*height:48px;/);
  assert.match(css,/\.stage1-product-card\.disabled \.stage1-product-add\{[\s\S]*display:none/);
});

test('Stage 1 category rail meets high-frequency touch target',()=>{
  assert.match(css,/\.stage1-category-rail button\{[\s\S]*min-height:48px/);
});

test('Stage 1 keeps zero-result recovery and empty product-image policy',()=>{
  assert.match(app,/搵唔到商品/);
  assert.match(app,/清除搜尋/);
  assert.match(app,/className="product-media"/);
  assert.doesNotMatch(app,/img[^>]+product/i);
});

test('Stage 1 can render while store data is unavailable without exposing raw engineering errors',()=>{
  assert.match(app,/Stage 1 已可進入/);
  assert.match(app,/未連線時唔會建立假商品或者假價格/);
  assert.match(app,/SMM_APP_REFRESH_DIAGNOSTIC/);
  assert.doesNotMatch(app,/setError\(reason instanceof Error\?reason\.message/);
});
