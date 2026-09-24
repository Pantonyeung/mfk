import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'..');
const views=fs.readFileSync(path.join(root,'src/components/customer-views.tsx'),'utf8');
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const recommendation=fs.readFileSync(path.join(root,'src/recommendation.ts'),'utf8');
const styles=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const primitives=fs.readFileSync(path.join(root,'src/ui/primitives.tsx'),'utf8');

test('R4 keeps guided ordering visible across menu product jar and checkout',()=>{
  assert.match(views,/JourneyCoach/);
  assert.match(views,/active=\{1\}/);
  assert.match(views,/active=\{2\}/);
  assert.match(views,/active=\{3\}/);
  assert.match(views,/active=\{4\}/);
  assert.match(views,/step-coach/);
});

test('R4 recommendations are evidence-based and remain presentation-only',()=>{
  assert.match(app,/buildCustomerRecommendations/);
  assert.match(recommendation,/BUY_AGAIN/);
  assert.match(recommendation,/FEATURED/);
  assert.match(recommendation,/CURRENT_CATEGORY/);
  assert.match(recommendation,/appearedInHistory/);
  assert.match(recommendation,/product\.badge/);
  assert.match(recommendation,/cartIds/);
  assert.match(views,/reasonLabel/);
  assert.match(views,/reasonDetail/);
  assert.doesNotMatch(recommendation,/\bfetch\s*\(|WebSocket|XMLHttpRequest|discount|coupon/i);
});

test('R4 motion system covers route product cart checkout order and member feedback',()=>{
  for(const marker of[
    '--motion-tap',
    '--motion-select',
    '--motion-journey',
    '--motion-reveal',
    'r4-hero-drift',
    'r4-stage-forward',
    'r4-jar-nav',
    'r4-orbit-breathe',
    'r4-pickup-reveal',
    'r4-medallion-in',
    '::view-transition-old(root)'
  ])assert.ok(styles.includes(marker),marker);
  assert.match(primitives,/jar-pulse/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});

test('R4 does not introduce a new network or business authority path',()=>{
  const source=[app,views,recommendation,primitives].join('\n');
  assert.doesNotMatch(source,/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/);
  assert.doesNotMatch(source,/createFormalOrder|allocateDisplayNumber|applyDiscount|awardBadge|redeemCoupon/);
  assert.match(app,/port\?\.submitOrder/);
  assert.match(app,/port\?\.readSubmission/);
  assert.match(app,/port\?\.buildReorderCart/);
});
