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
  assert.ok(config.includes('/brand/stage0-male.webp'));
  assert.ok(config.includes('/brand/stage0-female.webp'));
  assert.ok(!config.includes('/brand/stage7-pickup-'));
  assert.ok(!config.includes('stage0-character-male.svg'));
  assert.ok(!config.includes("'hybrid'"));
});

test('UI0 has first visit returning and reduced-motion timing without becoming a data gate',()=>{
  assert.match(launch,/mode==='reduced'\?\d+:mode==='returning'\?\d+:\d+/);
  assert.ok(launch.includes('prefers-reduced-motion: reduce'));
  assert.ok(launch.includes('sessionStorage'));
  assert.ok(launch.includes('localStorage'));
  assert.ok(launchCss.includes('@media(prefers-reduced-motion:reduce)'));
  for(const forbidden of['submitOrder(','quoteCart(','createFormalOrder','allocateDisplayNumber','paymentEvidence','fulfillment']){
    assert.ok(!launch.includes(forbidden),forbidden);
    assert.ok(!config.includes(forbidden),forbidden);
  }
});

test('UI0 exposes only the two FINAL launch CTAs and routes into current shell',()=>{
  assert.ok(launch.includes('進入主頁'));
  assert.ok(launch.includes('進入會員頁'));
  assert.ok(!launch.includes('開始點餐'));
  assert.ok(!launch.includes('我的記憶'));
  assert.ok(app.includes("onEnterHome={()=>{setLaunchVisible(false);changeView('home')}}"));
  assert.ok(app.includes("onEnterMember={()=>{setLaunchVisible(false);changeView('more')}}"));
});

test('UI1 is the FINAL storefront and cold launch continues to UI2 menu',()=>{
  assert.ok(app.includes("import {Stage1Home} from './stage1/Stage1Home'"));
  assert.ok(app.includes("view==='home'?<Stage1Home"));
  assert.ok(app.includes("onBrowse={()=>changeView('menu')}"));
  assert.ok(app.includes("view==='menu'?<Stage2Menu"));
  for(const marker of['stage1-fixed-header','stage1-welcome','stage1-search-entry','stage1-hero-banner','stage1-announcement-strip','stage1-top6','我的訂單','我的收藏','回憶券'])assert.ok(home.includes(marker),marker);
  assert.ok(app.includes('limit:6'));
  assert.ok(home.includes('const canBrowse=Boolean(snapshot?.menu)'));
});

test('UI1 and UI2 share the FINAL five-item navigation with Memory Jar in the center',()=>{
  assert.ok(app.includes("view==='home'||view==='menu'?<Stage2BottomNavigation"));
  assert.ok(app.includes("active={view}"));
  assert.equal(fs.existsSync(path.join(srcRoot,'stage1/Stage1BottomNavigation.tsx')),false);
});

test('UI1 owns FINAL home header/status while remaining inside current customer shell',()=>{
  assert.ok(app.includes('return <main className="customer-shell"'));
  assert.ok(app.includes("view==='home'?null:view==='menu'?null:<CustomerHeader"));
  assert.ok(app.includes("view==='home'?null:view==='menu'?null:<div className=\"global-status\""));
  assert.ok(home.includes('stage1-store-context'));
  assert.ok(homeCss.includes('.stage1-home'));
});

test('accepted UI2 to UI8 chain remains wired and no UI10 is introduced',()=>{
  for(const marker of['Stage2Menu','ProductSheet','CheckoutUi4View','SubmitUi5View','StoreFulfillmentUi6View','PickupCompleteUi7View','HistoryReorderUi8View'])assert.ok(app.includes(marker),marker);
  assert.ok(!app.includes('AccountRecoveryUi10'));
});
