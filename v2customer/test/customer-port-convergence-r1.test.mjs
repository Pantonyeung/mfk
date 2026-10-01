import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const launch=fs.readFileSync(path.join(srcRoot,'launch/LaunchOverlay.tsx'),'utf8');
const config=fs.readFileSync(path.join(srcRoot,'launch/launch-config.ts'),'utf8');
const launchCss=fs.readFileSync(path.join(srcRoot,'launch/launch.css'),'utf8');
const home=fs.readFileSync(path.join(srcRoot,'stage1/Stage1Home.tsx'),'utf8');
const homeCss=fs.readFileSync(path.join(srcRoot,'stage1/stage1.css'),'utf8');

test('UI0 final reconciliation uses male/female 50:50 and dedicated Stage0 source assets',()=>{
  assert.match(config,/export type LaunchVariant='male'\|'female'/);
  assert.ok(config.includes("<.5?'male':'female'"));
  assert.ok(config.includes('CUSTOMER_FINAL_SOURCE.maleIpSheet.url'));
  assert.ok(config.includes('CUSTOMER_FINAL_SOURCE.femaleIpSheet.url'));
  assert.ok(!config.includes('stage7-pickup'));
  assert.ok(!config.includes('stage0-character-male.svg'));
});

test('UI0 has first visit returning and reduced-motion timing without becoming a data gate',()=>{
  assert.ok(launch.includes("mode==='reduced'?120:mode==='returning'?700:2500"));
  assert.ok(launch.includes('prefers-reduced-motion: reduce'));
  assert.ok(launch.includes('sessionStorage'));
  assert.ok(launch.includes('localStorage'));
  assert.ok(launchCss.includes('@media(prefers-reduced-motion:reduce)'));
  for(const forbidden of['submitOrder(','quoteCart(','createFormalOrder','allocateDisplayNumber','paymentEvidence','fulfillment']){
    assert.ok(!launch.includes(forbidden),forbidden);
    assert.ok(!config.includes(forbidden),forbidden);
  }
});

test('UI0 auto-enters Home and preserves direct Member deep-link behaviour',()=>{
  assert.ok(!launch.includes('進入主頁'));
  assert.ok(!launch.includes('進入會員頁'));
  assert.ok(launch.includes('enterHomeRef.current()'));
  assert.ok(app.includes("onEnterHome={()=>{setLaunchVisible(false);changeView('home')}}"));
  assert.ok(!app.includes('onEnterMember='));
  assert.ok(app.includes("useState(()=>!initialRoute||initialRoute.view==='home')"));
});

test('UI1 uses the locked mobile-first large-image layout and fixed shortcut trio',()=>{
  assert.ok(app.includes("import {Stage1Home} from './stage1/Stage1Home'"));
  assert.ok(app.includes("view==='home'?<Stage1Home"));
  assert.ok(app.includes("onBrowse={()=>changeView('menu')}"));
  assert.ok(app.includes("onCategory={categoryId=>{changeCategory(categoryId);changeView('menu')}}"));
  for(const marker of['stage1-mobile-header','stage1-active-order','stage1-search','stage1-big-hero','stage1-quick-row','stage1-category-rail','stage1-product-section','我的收藏','回憶券','期間限定'])assert.ok(home.includes(marker),marker);
  assert.ok(home.includes('好好吃飯'));
  assert.ok(home.includes('讓日常更有趣'));
});

test('UI1 and UI2 share the locked five-item navigation with Memory Jar',()=>{
  assert.match(app,/view==='home'\|\|view==='menu'\s*\?\s*<Stage2BottomNavigation/);
  assert.ok(app.includes("active={view}"));
  assert.equal(fs.existsSync(path.join(srcRoot,'stage1/Stage1BottomNavigation.tsx')),false);
});

test('UI1 owns Home header/status and preserves runtime product truth',()=>{
  assert.ok(app.includes('return <main className="customer-shell"'));
  assert.equal(app.includes('<CustomerHeader'),false);
  assert.ok(home.includes('stage1-store-chip'));
  assert.ok(home.includes('product.imageUrl'));
  assert.ok(homeCss.includes('.stage1-mobile-home'));
  for(const forbidden of['/brand/p0-riceball.webp','/brand/mf-home-hero-salad.webp','/brand/mf-home-hero-bowl.webp'])assert.ok(!home.includes(forbidden),forbidden);
});

test('accepted UI2 to UI8 chain remains wired',()=>{
  for(const marker of['Stage2Menu','ProductSheet','CheckoutUi4View','SubmitUi5View','StoreFulfillmentUi6View','PickupCompleteUi7View','HistoryReorderUi8View'])assert.ok(app.includes(marker),marker);
});
