import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const ui5=fs.readFileSync(path.join(src,'components/customer-submit-ui5.tsx'),'utf8');
const ui4=fs.readFileSync(path.join(src,'components/customer-checkout-ui4.tsx'),'utf8');
const persistence=fs.readFileSync(path.join(src,'persistence.ts'),'utf8');
const cloud=fs.readFileSync(path.join(src,'cloud-runtime.ts'),'utf8');
const fallback=fs.readFileSync(path.join(src,'whatsapp-fallback.ts'),'utf8');
const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const styles=fs.readFileSync(path.join(src,'styles.css'),'utf8');

test('UI5 exposes only canonical submit and waiting routes after UI4 review',()=>{
  assert.ok(app.includes("pathname.match(/^\\/submit\\/([^/]+)$/)"));
  assert.ok(app.includes("pathname.match(/^\\/orders\\/([^/]+)\\/waiting$/)"));
  assert.match(app,/replacePath\('\/submit\/'/);
  assert.match(app,/replacePath\('\/orders\/'/);
  assert.match(ui4,/onReviewConfirmed/);
  assert.match(app,/onReviewConfirmed=\{startUi5Submission\}/);
});

test('one reviewed Checkout Intent gets one stable submission identity and idempotency key',()=>{
  assert.match(persistence,/const submissionId=createCustomerSubmissionId\(\)/);
  assert.match(persistence,/idempotencyKey:`customer-order:\$\{submissionId\}`/);
  assert.match(persistence,/fallbackReference:createCustomerFallbackReference\(\)/);
  assert.match(app,/const intent=same\?\?createCustomerPendingIntent/);
  assert.match(app,/if\(!same\)saveIntent\(intent\)/);
  assert.match(app,/openSubmitRoute\(intent\.submissionId\)/);
});

test('duplicate submit is synchronously locked and a routed intent can submit only from DRAFT',()=>{
  assert.match(app,/if\(submitLockRef\.current\|\|submitting\)return/);
  assert.match(app,/if\(routeIntent&&routeIntent\.state!==\'DRAFT\'\)return/);
  assert.match(app,/submitLockRef\.current=true/);
  assert.match(app,/submitLockRef\.current=false/);
  assert.match(ui5,/const locked=state===\'PENDING\'[\s\S]*state===\'DELIVERED\'/);
  assert.match(ui5,/disabled=\{locked\}/);
});

test('UI5 revalidates current published facts immediately before the existing submit bridge',()=>{
  assert.match(app,/quotePublishedCart\(intentCart,menu\)/);
  assert.match(app,/publishedCartRepairs\(intentCart,menu\)/);
  assert.match(app,/latestQuote\.freshness!==\'CURRENT\'/);
  assert.match(app,/付款方式資料已更新/);
  assert.match(app,/電子支付 QR 已失效/);
  assert.match(app,/paymentEvidence\?\.state!==\'UPLOADED\'/);
  assert.match(app,/await port\.submitOrder\(pending\)/);
});

test('SubmitProgress represents bounded checks but cloud submit POST exists once and no reconnect auto-submit is introduced',()=>{
  assert.match(ui5,/第 \'\+probeAttempt\+\' \/ \'\+probeTotal\+\' 次接單檢查/);
  assert.match(ui5,/每次檢查都屬同一個 Checkout Intent/);
  assert.equal((cloud.match(/\/api\/customer\/orders\/submit/g)||[]).length,1);
  assert.doesNotMatch(app,/addEventListener\(['"]online['"][\s\S]{0,300}submit\(/);
  assert.doesNotMatch(app,/setInterval\([\s\S]{0,300}submit\(/);
  assert.doesNotMatch(app,/setTimeout\([\s\S]{0,300}submit\(/);
});

test('UNKNOWN can only read back the original submission and never creates another identity',()=>{
  assert.match(ui5,/SUBMISSION UNKNOWN/);
  assert.match(ui5,/請勿重複提交/);
  assert.match(ui5,/onReadback/);
  assert.doesNotMatch(ui5,/createCustomerPendingIntent/);
  assert.match(app,/const result=await port\.readSubmission\(intent\.submissionId\)/);
  assert.match(app,/state:'UNKNOWN'/);
  assert.match(app,/未有重新提交/);
});

test('canonical CONFIRMED delivery is cached then routes to Waiting Store Confirmation without entering UI6',()=>{
  assert.match(app,/state:'DELIVERED'/);
  assert.match(app,/canonicalOrderId:result\.orderId/);
  assert.match(app,/canonicalDisplay:result\.displayCode/);
  assert.match(app,/openWaitingRoute/);
  assert.match(app,/\/waiting/);
  assert.match(ui5,/訂單已成功送達/);
  assert.match(ui5,/等待店舖確認/);
  assert.match(ui5,/UI5 唔會自行推斷後續流程/);
});

test('waiting screen contains elapsed time, separate Display Number and Pickup Code, summary, safe leave and read-only refresh',()=>{
  for(const marker of[
    '已等待',
    '流水號',
    '取餐碼',
    'Order Summary',
    '可以離開呢一頁',
    '只讀 Refresh',
    'Refresh 只查 Status，永遠唔會重新 Submit',
  ])assert.match(ui5,new RegExp(marker));
  assert.match(ui5,/phone\.replace|pickupCodeFromPhone/);
  assert.doesNotMatch(ui5,/intent\.canonicalOrderId\}/);
  assert.doesNotMatch(ui5,/order\.orderId\}/);
});

test('WhatsApp fallback uses a manual 4-6 digit reference and complete locked order snapshot, never raw Submission ID',()=>{
  assert.match(persistence,/String\(value\)\.padStart\(6,'0'\)/);
  assert.match(persistence,/fallbackReference/);
  assert.match(fallback,/line\.selectedVariationName/);
  assert.match(fallback,/line\.combo\?\.comboName/);
  assert.match(fallback,/line\.combo\?\.selections/);
  assert.match(fallback,/publishedTotalMinor/);
  assert.match(fallback,/\{fallbackReference\}/);
  assert.match(fallback,/\{submissionId\}':input\.fallbackReference/);
  assert.match(ui5,/人工參考碼/);
  assert.match(ui5,/零背景重送、零延遲重送、零 reconnect auto-submit/);
  assert.doesNotMatch(ui5,/intent\.submissionId/);
});

test('electronic screenshot stays Payment Evidence only in submit and fallback copy',()=>{
  assert.match(ui5,/已提交付款憑證/);
  assert.match(ui5,/付款截圖只係 Evidence/);
  assert.match(ui5,/SMT \/ 店員正式核對/);
  assert.doesNotMatch(ui5,/已確認付款/);
  assert.match(fallback,/付款憑證未完成/);
  assert.doesNotMatch(fallback,/已確認付款/);
});

test('payment evidence remains transient to the checkout/submission session, not durable cart truth',()=>{
  assert.match(persistence,/const \{paymentEvidence:_paymentEvidence,\.\.\.persistedCheckout\}=workspace\.checkout/);
  assert.match(persistence,/pendingIntents:Object\.freeze/);
  assert.match(app,/withoutPaymentEvidence\(checkout\)/);
  assert.match(app,/intent\?\.checkout|intentCheckout/);
  assert.doesNotMatch(types,/CustomerCartLine[\s\S]{0,800}paymentEvidence/);
});

test('UI5 adds no second Order Pricing Payment or Submit engine and keeps reduced motion and touch targets',()=>{
  const combined=[app,ui5,cloud,persistence].join('\n');
  for(const forbidden of[
    'class CustomerOrderEngine',
    'class CustomerPricingEngine',
    'class CustomerPaymentEngine',
    'class CustomerSubmitQueue',
    'SECOND_ORDER_ENGINE',
    'SECOND_PRICING_ENGINE',
  ])assert.equal(combined.includes(forbidden),false,forbidden);
  assert.match(styles,/\.ui5-readonly-refresh button,[\s\S]*min-height:44px/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*ui5/);
});
