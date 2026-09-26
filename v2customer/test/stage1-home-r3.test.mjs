// Stage 1 R3 spec-driven RED contract
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');

const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const home=fs.readFileSync(path.join(srcRoot,'stage1/Stage1Home.tsx'),'utf8');
const nav=fs.readFileSync(path.join(srcRoot,'stage1/Stage1BottomNavigation.tsx'),'utf8');
const css=fs.readFileSync(path.join(srcRoot,'stage1/stage1.css'),'utf8');

test('Stage 1 is a new spec-driven surface, not the legacy HomeView',()=>{
  assert.ok(app.includes("import {Stage1Home} from './stage1/Stage1Home'"));
  assert.ok(app.includes("import {Stage1BottomNavigation} from './stage1/Stage1BottomNavigation'"));
  assert.ok(!app.includes("view==='home'?<HomeView"));
  assert.ok(app.includes("view==='home'?<Stage1Home"));
});

test('Stage 1 implements the locked storefront anatomy from UI spec',()=>{
  for(const marker of[
    'stage1-fixed-header',
    'stage1-store-status-badge',
    'stage1-hero-banner',
    'stage1-announcement-strip',
    'stage1-top6',
    '記憶券',
    '常購清單',
    '期間限定',
  ])assert.ok(home.includes(marker),marker);
});

test('Stage 1 navigation is exactly the locked five items with memory jar in the center',()=>{
  const labels=['首頁','點單','記憶罐','訂單','會員'];
  for(const label of labels)assert.ok(nav.includes(label));
  assert.ok(nav.includes("data-center={item.id==='cart'||undefined}"));
  assert.ok(nav.includes("id:'cart'"));
});

test('Stage 1 uses new design-system tokens and mobile-first 480px shell',()=>{
  for(const marker of[
    '--mf-brand-navy:#15396b',
    '--mf-brand-orange:#f07f24',
    '--mf-bg-warm:#f7f1e9',
    '--mf-surface:#fffdfa',
    '--mf-success:#3a9a68',
    '--mf-error:#d75d5d',
    'max-width:480px',
    'min-height:44px',
  ])assert.ok(css.includes(marker),marker);
});

test('Stage 1 hero and announcement use AI art while product photography stays blank',()=>{
  assert.ok(home.includes('AI_GENERATED_STAGE1_ART'));
  assert.ok(home.includes('57ce2f93-c8d0-491d-9bd0-23a2be364d14.png'));
  assert.ok(home.includes('stage1-product-placeholder'));
  assert.ok(!home.includes('product.imageUrl'));
  assert.ok(!home.includes('<ProductMedia'));
});

test('Stage 1 product and commerce truth remain projections only',()=>{
  for(const forbidden of[
    'submitOrder(',
    'quoteCart(',
    'createFormalOrder',
    'allocateDisplayNumber',
    'uploadPaymentEvidence',
    'redeemCoupon',
  ])assert.ok(!home.includes(forbidden),forbidden);
  assert.ok(home.includes("recommendations.filter(item=>item.product.available).slice(0,6)"));
});

test('closed store remains browsable and only later commit may block',()=>{
  assert.ok(home.includes('const canBrowse=Boolean(snapshot?.menu)'));
  assert.ok(home.includes('今日暫停正式落單'));
  assert.ok(home.includes('繼續瀏覽菜單'));
  assert.ok(!home.includes("store?.channelAvailable!==false"));
});

test('Stage 1 owns its header, state surfaces and nav instead of rendering legacy shell chrome',()=>{
  assert.ok(app.includes("view==='home'?null:<CustomerHeader"));
  assert.ok(app.includes(`view==='home'?null:<div className="global-status"`));
  assert.ok(app.includes("view==='home'?<Stage1BottomNavigation"));
});

test('Stage 1 recognizes loading error offline stale and empty presentation states',()=>{
  for(const marker of['LOADING','ERROR','STALE','NOT_CONNECTED','browserOnline','stage1-state-panel','stage1-top6-empty']){
    assert.ok(home.includes(marker),marker);
  }
});

test('Stage 1 is reduced-motion safe and does not color-code status alone',()=>{
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(home.includes('營業中'));
  assert.ok(home.includes('暫停正式落單'));
  assert.ok(home.includes('同步中'));
});
