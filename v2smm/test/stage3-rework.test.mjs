import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  acceptSmmCartRefresh,
  buildSmmCartRefreshAttention,
  smmLineTotalMinor,
} from '../src/stage3-cart.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('qty=2 line total equals unit times two',()=>{
  assert.equal(smmLineTotalMinor(4300,2),8600);
});

test('quantity change immediately changes line total projection',()=>{
  assert.equal(smmLineTotalMinor(4300,1),4300);
  assert.equal(smmLineTotalMinor(4300,3),12900);
});

test('passive price change produces PRICE_CHANGED attention instead of silent acceptance',()=>{
  const attention=buildSmmCartRefreshAttention({
    menuRevision:'R2',
    oldPublishedUnitPriceMinor:4100,
    proposedPublishedUnitPriceMinor:4300,
    proposedSelections:[],
    configChanged:false,
    canAccept:true,
    detectedAt:'2026-09-27T00:00:00.000Z',
  });
  assert.equal(attention?.kind,'PRICE_CHANGED');
  assert.equal(attention?.oldPublishedUnitPriceMinor,4100);
  assert.equal(attention?.proposedPublishedUnitPriceMinor,4300);
});

test('accept update changes only target line and clears its attention',()=>{
  const target=Object.freeze({
    lineId:'L1',productId:'P1',productName:'A',quantity:2,selections:Object.freeze([]),
    publishedUnitPriceMinor:4100,createdAt:'T0',
    refreshAttention:Object.freeze({
      kind:'PRICE_CHANGED',menuRevision:'R2',
      oldPublishedUnitPriceMinor:4100,proposedPublishedUnitPriceMinor:4300,
      proposedSelections:Object.freeze([]),canAccept:true,detectedAt:'T1',
    }),
  });
  const unaffected=Object.freeze({
    lineId:'L2',productId:'P2',productName:'B',quantity:1,selections:Object.freeze([]),
    publishedUnitPriceMinor:5000,createdAt:'T0',
  });
  const result=acceptSmmCartRefresh(Object.freeze([target,unaffected]),'L1');
  assert.equal(result.accepted,true);
  assert.equal(result.cart[0].lineId,'L1');
  assert.equal(result.cart[0].createdAt,'T0');
  assert.equal(result.cart[0].publishedUnitPriceMinor,4300);
  assert.equal(result.cart[0].refreshAttention,undefined);
  assert.strictEqual(result.cart[1],unaffected);
});

test('Combo published fact change is CONFIG_CHANGED',()=>{
  const attention=buildSmmCartRefreshAttention({
    menuRevision:'R3',
    oldPublishedUnitPriceMinor:4700,
    proposedPublishedUnitPriceMinor:4900,
    proposedSelections:[],
    proposedCombo:Object.freeze({
      comboId:'C1',comboName:'套餐',publishedBasePriceMinor:4900,selections:Object.freeze([]),
    }),
    configChanged:true,
    canAccept:true,
    detectedAt:'2026-09-27T00:00:00.000Z',
  });
  assert.equal(attention?.kind,'CONFIG_CHANGED');
});

test('Stage 3 renders old to new repair price and disables checkout while attention exists',()=>{
  assert.match(app,/舊價 {money\('HKD',unitMinor!\)} → 新價 {money\('HKD',proposedUnit!\)}/);
  assert.match(app,/const checkoutReady=Boolean\(menu&&cart\.length&&affectedCount===0&&quote\)/);
  assert.match(app,/disabled=\{!checkoutReady\}/);
  assert.match(app,/接受更新/);
  assert.match(app,/重新編輯/);
});

test('passive refresh stores only attention proposal and does not replace accepted line facts',()=>{
  const marker='if(!menu||cart.length===0)return;';
  const start=app.indexOf(marker);
  assert.ok(start>=0);
  const end=app.indexOf('const resetProductEditor',start);
  assert.ok(end>start);
  const passive=app.slice(start,end);
  assert.match(passive,/refreshAttention:proposal/);
  assert.doesNotMatch(passive,/selections:Object\.freeze\(refreshedSelections\)/);
  assert.doesNotMatch(passive,/publishedUnitPriceMinor:unitMinor/);
  assert.doesNotMatch(passive,/combo:refreshedCombo/);
});

test('explicit service-mode repricing still applies current published facts directly',()=>{
  const start=app.indexOf('const repriceLine=');
  const end=app.indexOf('const publishedTotalMinor=',start);
  const reprice=app.slice(start,end);
  assert.match(reprice,/projectLineAgainstCurrentMenu\(line,mode\)/);
  assert.match(reprice,/publishedUnitPriceMinor:projected\.proposedPublishedUnitPriceMinor/);
  assert.match(reprice,/const \{refreshAttention:_staleAttention,\.\.\.accepted\}=line/);
  assert.match(app,/const repriced=cart\.map\(line=>repriceLine\(line,next\)\)/);
});


test('unaffected passive cart lines are returned unchanged',()=>{
  const marker='if(!menu||cart.length===0)return;';
  const start=app.indexOf(marker);
  const end=app.indexOf('const resetProductEditor',start);
  const passive=app.slice(start,end);
  assert.match(passive,/if\(!proposal\)\{[\s\S]*if\(!line\.refreshAttention\)return line/);
  assert.match(passive,/sameSmmCartRefreshAttention\(line\.refreshAttention,proposal\)\)return line/);
});

test('Stage 0-2 loginId and canonical Combo regression seams remain present',()=>{
  const stage0=readFileSync(new URL('../src/StageZero.tsx',import.meta.url),'utf8');
  const staff=readFileSync(new URL('../src/pwa-staff.ts',import.meta.url),'utf8');
  const selection=readFileSync(new URL('../src/selection.ts',import.meta.url),'utf8');
  assert.match(stage0,/stage0/);
  assert.match(app,/stage1-order/);
  assert.match(app,/stage2-product-sheet/);
  assert.match(staff,/loginId/);
  assert.match(selection,/resolveSmmProductCombo/);
  assert.match(selection,/revalidateSmmCartComboIntent/);
  assert.match(app,/正式套餐內容同價格會由 SMT 再驗證/);
});
