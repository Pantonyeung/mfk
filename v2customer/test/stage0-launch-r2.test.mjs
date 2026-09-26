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
const css=fs.readFileSync(path.join(srcRoot,'launch/launch.css'),'utf8');

test('Stage 0 stays isolated from order/payment/fulfillment authority',()=>{
  for(const forbidden of['submitOrder(','quoteCart(','createFormalOrder','allocateDisplayNumber','paymentEvidence','fulfillment']){
    assert.ok(!launch.includes(forbidden),forbidden+' must not exist in launch overlay');
    assert.ok(!config.includes(forbidden),forbidden+' must not exist in launch config');
  }
});

test('Stage 0 supports male female hybrid variant slots but fails closed to available hybrid asset',()=>{
  for(const variant of["'male'","'female'","'hybrid'"])assert.ok(config.includes(variant));
  assert.ok(config.includes('resolveLaunchVariant'));
  assert.ok(config.includes('enabledVariants'));
  assert.ok(config.includes('STAGE0_HYBRID_CANDIDATE_A'));
  assert.ok(config.includes('e788f78a-6345-45fa-8d87-467699aa5795.mp4'));
});

test('Stage 0 mounts over the existing App while product runtime can preload underneath',()=>{
  assert.ok(app.includes('LaunchOverlay'));
  assert.ok(app.includes('<LaunchOverlay'));
  assert.ok(app.includes('onEnterHome'));
  assert.ok(app.includes('onEnterMember'));
  assert.ok(app.includes("changeView('home')"));
  assert.ok(app.includes("changeView('more')"));
});

test('Stage 0 only exposes the locked two final actions',()=>{
  assert.ok(launch.includes('進入主頁'));
  assert.ok(launch.includes('進入會員頁'));
  assert.ok(!launch.includes('開始點餐'));
});

test('Stage 0 has returning-session and reduced-motion behavior with static fallback',()=>{
  assert.ok(launch.includes('prefers-reduced-motion: reduce'));
  assert.ok(launch.includes('mfk.customer.launch.seen.v1'));
  assert.ok(launch.includes('sessionStorage'));
  assert.ok(launch.includes('onError'));
  assert.ok(launch.includes('poster'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('Stage 0 video is muted inline autoplay and leaves CTA text outside the generated video',()=>{
  for(const marker of['autoPlay','muted','playsInline'])assert.ok(launch.includes(marker));
  assert.ok(launch.includes('launch-actions'));
  assert.ok(launch.includes('美味，從這裡開始。'));
});
