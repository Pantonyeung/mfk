import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SMM_STAGE4_TENDERS,
  smmStage4CheckoutReady,
  smmStage4DiningTargetStatus,
  smmStage4TenderLabel,
} from '../src/stage4-checkout.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');
const staff=readFileSync(new URL('../src/pwa-staff.ts',import.meta.url),'utf8');
const selection=readFileSync(new URL('../src/selection.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage4.css',import.meta.url),'utf8');

const checkoutStart=app.indexOf('function Stage4CheckoutView');
const checkoutEnd=app.indexOf('function DiningTargetSheet',checkoutStart);
assert.ok(checkoutStart>=0&&checkoutEnd>checkoutStart);
const checkout=app.slice(checkoutStart,checkoutEnd);

test('Stage 4 follows source 4.1-4.5 flow: Service Mode -> Dining Target -> Tender -> Summary -> Submit',()=>{
  const markers=['服務方式','堂食去向','付款方式','訂單確認','確認落單'];
  let previous=-1;
  for(const marker of markers){
    const index=checkout.indexOf(marker);
    assert.ok(index>previous,marker);
    previous=index;
  }
});

test('DINE_IN without Table or Waiting target cannot submit',()=>{
  const status=smmStage4DiningTargetStatus('DINE_IN',null,[]);
  assert.equal(status.required,true);
  assert.equal(status.valid,false);
  assert.equal(smmStage4CheckoutReady({cartLength:1,totalMinor:4300,hasAttention:false,tender:'CASH',diningTargetValid:status.valid}),false);
});

test('DINE_IN Waiting target is valid and published Table target must exist',()=>{
  assert.equal(smmStage4DiningTargetStatus('DINE_IN',{kind:'WAITING',covers:2},[]).valid,true);
  const tables=[{tableId:'T1',label:'A1',sortOrder:1}];
  assert.equal(smmStage4DiningTargetStatus('DINE_IN',{kind:'TABLE',tableId:'T1',covers:3},tables).valid,true);
  assert.equal(smmStage4DiningTargetStatus('DINE_IN',{kind:'TABLE',tableId:'T2',covers:3},tables).valid,false);
});

test('TAKEAWAY does not require Dining Target',()=>{
  const status=smmStage4DiningTargetStatus('TAKEAWAY',null,[]);
  assert.equal(status.required,false);
  assert.equal(status.valid,true);
});

test('all current tender semantics remain unchanged without payment execution',()=>{
  assert.deepEqual(SMM_STAGE4_TENDERS.map(row=>row.value),['CASH','ALIPAY','WECHAT','FPS','PAYME']);
  assert.equal(smmStage4TenderLabel('CASH'),'現金');
  assert.equal(smmStage4TenderLabel('FPS'),'FPS');
  assert.doesNotMatch(checkout,/PaymentEngine|executePayment|openDrawer|cashDrawer/);
});

test('Stage 4 final summary includes product media line totals note and final total',()=>{
  for(const marker of['itemCount','note.trim()','smmLineTotalMinor','quote.currency','quote.totalMinor','stage4-line-media']){
    assert.match(checkout,new RegExp(marker.replace(/[?.]/g,'\\$&')));
  }
  assert.match(checkout,/ProductMedia product=\{mediaProduct\}/);
  assert.match(checkout,/已按最新餐單資料計算/);
});

test('unresolved Stage 3 line attention blocks Stage 4 submit',()=>{
  assert.equal(smmStage4CheckoutReady({cartLength:1,totalMinor:4300,hasAttention:true,tender:'CASH',diningTargetValid:true}),false);
  assert.match(checkout,/const hasAttention=cart\.some\(line=>Boolean\(line\.refreshAttention\)\)/);
  assert.match(checkout,/disabled=\{!submitReady\}/);
});

test('Stage 4 submit CTA remains boundary-only and preserves Stage5 submission identity',()=>{
  assert.match(checkout,/onSubmitBoundary/);
  assert.doesNotMatch(checkout,/submitCart|submitOrder|readSubmission|createSmmPendingIntent/);
  assert.match(app,/const submitCart=async\(\)=>/);
  assert.match(app,/port\.submitOrder/);
  assert.match(app,/readSubmission/);
  assert.match(persistence,/createSmmStableSubmissionId/);
  assert.match(persistence,/idempotencyKey:`smm-direct:\$\{submissionId\}`/);
});

test('Dining Target remains local non-authoritative workspace and Admin-published tables only',()=>{
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/readonly diningTarget:SmmDiningTarget\|null/);
  assert.match(app,/diningTables=\{snapshot\?\.diningTables\?\?\[\]\}/);
  assert.match(checkout,/smmStage4DiningTargetStatus\(serviceMode,diningTarget,diningTables\)/);
  assert.doesNotMatch(checkout,/tableId.*<input|placeholder=.*枱/);
});

test('Stage 4 normal UI removes engineering copy while keeping source hierarchy',()=>{
  for(const marker of['落單前確認','今張單係外賣定堂食','揀枱號；未有座位就先加入輪候','揀客人今次使用嘅付款方式','最後一步']){
    assert.match(checkout,new RegExp(marker));
  }
  assert.doesNotMatch(checkout,/第 4 階段|第 5 階段|SMT \/ Store Kernel|餐單版本|PRICE_CHANGED|CONFIG_CHANGED|正式價格、Combo、餐單 revision/);
});

test('Stage 0-3 Auth Combo and repair seams remain present',()=>{
  assert.match(app,/stage1-order/);
  assert.match(app,/stage2-product-sheet/);
  assert.match(app,/stage3-cart-sheet/);
  assert.match(app,/PRICE_CHANGED/);
  assert.match(app,/CONFIG_CHANGED/);
  assert.match(staff,/loginId/);
  assert.match(selection,/resolveSmmProductCombo/);
  assert.match(selection,/revalidateSmmCartComboIntent/);
});

test('Stage 4 mobile checkout is touch-safe at 440x956 and 360x780',()=>{
  assert.match(css,/\.stage4-checkout-sheet\{[\s\S]*max-height:94dvh/);
  assert.match(css,/\.stage4-segmented button\{[\s\S]*min-height:50px/);
  assert.match(css,/\.stage4-tender-grid button\{[\s\S]*min-height:50px/);
  assert.match(css,/\.stage4-submit\{[\s\S]*background:#2f73ff/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Stage 3 checkout CTA moves only into Stage 4 presentation',()=>{
  assert.match(app,/onCheckout=\{\(\)=>setCheckoutStage\(true\)\}/);
  assert.match(app,/if\(checkoutStage\)\{[\s\S]*return <Stage4CheckoutView/);
  assert.doesNotMatch(app,/onCheckout=\{\(\)=>void submitCart\(\)\}/);
});
