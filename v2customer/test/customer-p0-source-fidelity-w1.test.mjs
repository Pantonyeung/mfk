import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('UI0 uses FINAL Stage0 source assets, 50:50 selection and exact CTA copy',()=>{
  const config=read('src/launch/launch-config.ts');
  const overlay=read('src/launch/LaunchOverlay.tsx');
  assert.match(config,/\/brand\/stage0-male\.webp/);
  assert.match(config,/\/brand\/stage0-female\.webp/);
  assert.match(config,/\/brand\/p0-riceball\.webp/);
  assert.doesNotMatch(config,/stage7-pickup|stage0-character-.*\.svg/);
  assert.match(config,/<\.5\?'male':'female'/);
  for(const mode of ["'reduced'","'returning'","'first'"])assert.match(overlay,new RegExp(mode));
  for(const copy of['肚餓啦？','用心手作，','每一口都更幸福。','美味，從這裡開始。','進入主頁','進入會員頁'])assert.match(overlay,new RegExp(copy));
  assert.match(overlay,/mode==='reduced'\?700:mode==='returning'\?1150:3300/);
  assert.match(overlay,/onEnterHome/);
  assert.match(overlay,/onEnterMember/);
});

test('UI1 follows FINAL home hierarchy and never leaves blank product-media slots',()=>{
  const home=read('src/stage1/Stage1Home.tsx');
  for(const marker of['stage1-fixed-header','stage1-welcome','stage1-search-entry','stage1-hero-banner','stage1-announcement-strip','stage1-quick-entry-grid','stage1-top6'])assert.match(home,new RegExp(marker));
  assert.match(home,/const HERO_IP='\/brand\/stage0-male\.webp'/);
  assert.match(home,/const HERO_FOOD='\/brand\/p0-riceball\.webp'/);
  assert.match(home,/if\(product\.imageUrl\)return product\.imageUrl/);
  assert.match(home,/mediaFor\(item\.product\)/);
  assert.doesNotMatch(home,/stage1-product-placeholder|商品圖片暫未提供|Browse \/ Build Cart|正式 Commit|正式投影|Coupon 狀態|Reorder 會/);
  for(const label of['我的訂單','我的收藏','回憶券'])assert.match(home,new RegExp(label));
});

test('UI2 uses real product media, source search/category/sold-out/favorite/cart anatomy and zero-result IP',()=>{
  const menu=read('src/stage2/Stage2Menu.tsx');
  const nav=read('src/stage2/Stage2BottomNavigation.tsx');
  for(const marker of['product.imageUrl','mediaFor(product)','stage2-sold-out','stage2-favorite','stage2-search-field','stage2-category-rail','onCart','ZERO_RESULT_IP'])assert.ok(menu.includes(marker),marker);
  assert.match(menu,/\/brand\/stage0-female\.webp/);
  assert.doesNotMatch(menu,/<span className="stage2-product-media" aria-hidden="true"\/>|商品圖片暫未提供/);
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.match(nav,new RegExp(label));
  assert.match(nav,/stage2-nav-icon/);
  assert.match(nav,/data-center=\{item\.id==='cart'\|\|undefined\}/);
});

test('UI1 and UI2 share FINAL fixed navigation while UI3-UI9 navigation semantics stay untouched',()=>{
  const app=read('src/App.tsx');
  assert.match(app,/view==='home'\|\|view==='menu'\?<Stage2BottomNavigation active=\{view\}/);
  assert.match(app,/<BottomNavigation active=\{view==='pickup'\|\|view==='orders'\?'orders'/);
});

test('390 baseline and 360 minimum remain explicitly responsive with 44px touch targets',()=>{
  const stage1=read('src/stage1/stage1.css');
  const stage2=read('src/stage2/stage2.css');
  for(const css of[stage1,stage2]){
    assert.match(css,/max-width:480px/);
    assert.match(css,/@media\(max-width:360px\)/);
  }
  assert.match(stage2,/min-height:44px/);
  assert.match(stage2,/@media\(prefers-reduced-motion:reduce\)/);
});
