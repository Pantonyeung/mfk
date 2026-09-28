import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage1.css',import.meta.url),'utf8');
const slots=JSON.parse(readFileSync(new URL('../public/brand/stage1/asset-slots.json',import.meta.url),'utf8'));

const orderStart=app.indexOf('function OrderView');
const orderEnd=app.indexOf('function StaffLogin',orderStart);
assert.ok(orderStart>=0&&orderEnd>orderStart);
const orderView=app.slice(orderStart,orderEnd);

test('Stage 1 implements final Search Category Product Grid Sold Out Cart Bar flow',()=>{
  for(const marker of['stage1-search','stage1-category-rail','stage1-product-grid','stage1-soldout','stage1-cart-bar','查看購物車']){
    assert.match(orderView,new RegExp(marker));
  }
  assert.doesNotMatch(orderView,/submitOrder\s*\(/);
});

test('Stage 1 uses canonical product imageRef first and approved brand media fallback',()=>{
  assert.match(app,/function productMediaSrc/);
  assert.match(app,/product\.imageRef/);
  assert.match(app,/function ProductMedia/);
  assert.match(orderView,/<ProductMedia product=\{product\} className="product-media"\/>/);
  assert.equal(slots.ownerLock.productMedia,'CANONICAL_IMAGE_REF_FIRST');
  assert.equal(slots.stage1.productCards.imageStatus,'CANONICAL_OR_APPROVED_BRAND_FALLBACK');
  assert.equal(slots.stage1.productCards.fakeFoodImages,false);
  for(const file of['product-feature.webp','product-bowl.webp','product-salad.webp']){
    assert.ok(existsSync(new URL('../public/brand/stage1/'+file,import.meta.url)));
  }
});

test('Stage 1 has five-tab icon navigation in fixed source order',()=>{
  for(const label of['點單','待處理','訂單','堂食','更多'])assert.match(app,new RegExp('label="'+label+'"'));
  assert.match(app,/function NavGlyph/);
  assert.match(app,/className="nav-glyph"/);
  assert.match(app,/<svg/);
});

test('Stage 1 sold-out products stay in the grid and are disabled',()=>{
  assert.match(orderView,/disabled=\{!product\.available\}/);
  assert.match(orderView,/!product\.available\?<span className="stage1-soldout">暫停供應<\/span>:null/);
  assert.match(css,/\.stage1-product-card\.disabled/);
  assert.match(css,/\.stage1-product-card\.disabled \.stage1-product-add/);
});

test('Stage 1 geometry keeps two columns above 360 and one column at 360',()=>{
  assert.match(css,/\.stage1-product-grid\{[\s\S]*grid-template-columns:repeat\(2/);
  assert.match(css,/@media\(max-width:360px\)[\s\S]*\.stage1-product-grid\{grid-template-columns:1fr/);
  assert.match(css,/\.stage1-category-rail button\{[\s\S]*min-height:44px/);
  assert.match(css,/\.stage1-product-card \.product-media\{[\s\S]*aspect-ratio/);
});

test('Stage 1 zero-result recovery is human-facing and keeps source mascot presentation',()=>{
  assert.match(orderView,/stage1-zero-result/);
  assert.match(orderView,/搵唔到呢款商品/);
  assert.match(orderView,/清除搜尋/);
  assert.match(orderView,/stage0\/stage0-female\.webp/);
});

test('Stage 1 normal UI removes engineering placeholder copy',()=>{
  assert.doesNotMatch(orderView,/正式產品圖片待補|本機介面|餐單版本/);
  assert.doesNotMatch(orderView,/Store Kernel|Pricing Engine|Order Engine/i);
});

test('Stage 1 can render unavailable data with human recovery copy',()=>{
  assert.match(orderView,/餐單暫時未能載入/);
  assert.match(orderView,/請稍後重新整理/);
  assert.doesNotMatch(orderView,/Stage 1|假商品|假價格/);
  assert.match(app,/SMM_APP_REFRESH_DIAGNOSTIC/);
});
