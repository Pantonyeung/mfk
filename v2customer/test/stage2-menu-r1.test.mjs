import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');

const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const menu=fs.readFileSync(path.join(srcRoot,'stage2/Stage2Menu.tsx'),'utf8');
const nav=fs.readFileSync(path.join(srcRoot,'stage2/Stage2BottomNavigation.tsx'),'utf8');
const css=fs.readFileSync(path.join(srcRoot,'stage2/stage2.css'),'utf8');

test('Stage 2 is a new effect-board-driven surface, not legacy MenuView',()=>{
  assert.ok(app.includes("import {Stage2Menu} from './stage2/Stage2Menu'"));
  assert.ok(app.includes("import {Stage2BottomNavigation} from './stage2/Stage2BottomNavigation'"));
  assert.ok(!app.includes("view==='menu'?<MenuView"));
  assert.ok(app.includes("view==='menu'?<Stage2Menu"));
});

test('Stage 2 locks our approved effect board as the primary visual reference',()=>{
  assert.ok(menu.includes('STAGE2_VISUAL_REFERENCE'));
  assert.ok(menu.includes('54252ae0-960b-4ba2-b45f-2e32cde0b221.png'));
  assert.ok(menu.includes('磨飯_more_fun_點單探索介面'));
});

test('Stage 2 matches effect-board browse anatomy',()=>{
  for(const marker of[
    'stage2-header',
    'stage2-category-rail',
    'stage2-filter-strip',
    'stage2-featured-card',
    'stage2-small-grid',
    'stage2-search-field',
    'stage2-search-results',
    'stage2-zero-repair',
    'stage2-sold-out',
    'stage2-favorite',
  ])assert.ok(menu.includes(marker),marker);
});

test('each normal category has one featured large card and the rest small cards',()=>{
  assert.ok(menu.includes('const featuredProduct=displayProducts.find(product=>product.available)??displayProducts[0]??null'));
  assert.ok(menu.includes('const smallProducts=featuredProduct?displayProducts.filter(product=>product.productId!==featuredProduct.productId):[]'));
  assert.equal((menu.match(/<FeaturedProductCard/g)||[]).length,1);
});

test('product media uses canonical imageUrl with FINAL real-media fallback and never a blank placeholder',()=>{
  assert.ok(menu.includes('product.imageUrl'));
  assert.ok(menu.includes('product.imageAlt??product.name'));
  assert.ok(menu.includes('mediaFor(product)'));
  assert.ok(menu.includes('/brand/p0-riceball.webp'));
  assert.ok(css.includes('.stage2-product-media img'));
  assert.ok(!menu.includes('<span className="stage2-product-media" aria-hidden="true"/>'));
  assert.ok(!menu.includes('商品圖片暫未提供'));
  assert.ok(menu.includes('displayPriceLabel'));
  assert.ok(menu.includes('已售罄'));
});

test('search supports normal results and zero-result repair without blocking ordering',()=>{
  assert.ok(menu.includes("const searchMode=Boolean(query.trim())"));
  assert.ok(menu.includes('stage2-search-results'));
  assert.ok(menu.includes('搵唔到'));
  assert.ok(menu.includes('試下其他分類'));
  assert.ok(menu.includes("recommendations.filter(item=>item.product.available).slice(0,2)"));
});

test('sold-out products remain visible but cannot open product detail',()=>{
  assert.ok(menu.includes('disabled={!product.available}'));
  assert.ok(menu.includes("product.available?'':' is-sold-out'"));
  assert.ok(menu.includes('stage2-sold-out'));
});

test('favorite is UI-local only and supports 已收藏 filter',()=>{
  assert.ok(menu.includes('useState<ReadonlySet<string>>(new Set())'));
  assert.ok(menu.includes("filter==='favorites'"));
  assert.ok(menu.includes('已收藏'));
  for(const forbidden of['saveFavorite(','updateMember(','writeFavorite(','redeemCoupon(']){
    assert.ok(!menu.includes(forbidden),forbidden);
  }
});

test('Stage 2 navigation is exact and memory jar is fixed center',()=>{
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.ok(nav.includes(label));
  assert.ok(nav.includes("data-center={item.id==='cart'||undefined}"));
  assert.ok(nav.includes("id:'cart'"));
});

test('Stage 2 owns its menu chrome and Wave2 does not reintroduce legacy CustomerHeader',()=>{
  assert.equal(app.includes('<CustomerHeader'),false);
  assert.ok(app.includes(`view==='home'?null:view==='menu'?null:<div className="global-status"`));
  assert.match(app,/view==='home'\|\|view==='menu'\s*\?\s*<Stage2BottomNavigation/);
});

test('Stage 2 keeps Loading Error Offline Stale Empty states human-safe',()=>{
  for(const marker of['LOADING','ERROR','STALE','NOT_CONNECTED','browserOnline','stage2-state-panel','stage2-empty']){
    assert.ok(menu.includes(marker),marker);
  }
  assert.ok(menu.includes('暫時未能更新餐牌'));
});

test('Stage 2 uses the new mobile visual system, not the old menu layout toggle',()=>{
  for(const marker of[
    '--mf-brand-navy:#15396b',
    '--mf-brand-orange:#f07f24',
    '--mf-bg-warm:#f7f1e9',
    '--mf-surface:#fffdfa',
    'max-width:480px',
    'min-height:44px',
    '@media(prefers-reduced-motion:reduce)',
  ])assert.ok(css.includes(marker),marker);
  assert.ok(!menu.includes('layout-toggle'));
  assert.ok(!menu.includes('格狀'));
  assert.ok(!menu.includes('列表'));
});


function cssRule(selector){
  const start=css.indexOf(selector);
  if(start<0)return '';
  const open=css.indexOf('{',start);
  const close=css.indexOf('}',open);
  return open>=0&&close>open?css.slice(open+1,close):'';
}

test('all high-frequency Stage 2 controls have at least 44px touch targets',()=>{
  const category=cssRule('.stage2-category-rail button,.stage2-filter-strip button');
  const filter=cssRule('.stage2-filter-strip button');
  const favorite=cssRule('.stage2-favorite');
  const repair=cssRule('.stage2-repair-categories button');

  assert.ok(category.includes('min-height:44px'),category);
  assert.ok(filter.includes('min-height:44px'),filter);
  assert.ok(favorite.includes('width:44px'),favorite);
  assert.ok(favorite.includes('height:44px'),favorite);
  assert.ok(favorite.includes('min-height:44px'),favorite);
  assert.ok(repair.includes('min-height:44px'),repair);
});
