import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const views=fs.readFileSync(path.join(src,'components/customer-views.tsx'),'utf8');
const checkout=fs.readFileSync(path.join(src,'components/customer-checkout-ui4.tsx'),'utf8');
const persistence=fs.readFileSync(path.join(src,'persistence.ts'),'utf8');
const quote=fs.readFileSync(path.join(src,'local-quote.ts'),'utf8');
const css=fs.readFileSync(path.join(src,'styles.css'),'utf8');

test('UI4 exposes the canonical Memory Jar and three checkout routes only',()=>{
  for(const route of[
    "'/memory-jar'",
    "'/checkout/contact'",
    "'/checkout/payment'",
    "'/checkout/review'",
  ])assert.ok(app.includes(route),route);
  assert.ok(!checkout.includes('/submit/'));
  assert.ok(!checkout.includes('SubmitProgress'));
  assert.ok(!checkout.includes('WaitingStoreConfirmation'));
});

test('Memory Jar line shows product configuration, quantity, total, edit, remove and repair',()=>{
  for(const marker of[
    'line.productName',
    'line.selectedVariationName',
    'optionSummary',
    'line.combo.comboName',
    '套餐內容：',
    'QuantityStepper',
    '小計',
    '編輯',
    '移除',
    'line-attention',
    '只移除',
  ])assert.ok(views.includes(marker),marker);
});

test('editing reuses UI3 and updates the same line identity',()=>{
  for(const marker of[
    'setSelectedComboEnabled(Boolean(line?.combo))',
    'restoreCustomerComboSelectionState(line?.combo)',
    'setEditingLineId(line?.lineId??null)',
    'lineId:existing?.lineId??crypto.randomUUID()',
    'cart.map(item=>item.lineId===existing.lineId?line:item)',
  ])assert.ok(app.includes(marker),marker);
});

test('quantity and cart actions remain touch-safe and mutations are line-scoped',()=>{
  assert.match(css,/\.ui4-memory-jar \.quantity-stepper button,[\s\S]*min-width:44px;[\s\S]*min-height:44px/);
  assert.ok(app.includes("cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line)"));
  assert.ok(app.includes("cart.filter(line=>line.lineId!==lineId)"));
  assert.ok(app.includes("updateCart(cart.map(item=>item.lineId===lineId?repaired:item))"));
  assert.ok(!views.includes('setCart([])'));
});

test('Checkout is fixed to four UI4 review steps and never creates a submit identity',()=>{
  const labels=['確認商品','聯絡與取餐','付款','提交前確認'];
  let previous=-1;
  for(const label of labels){
    const index=checkout.indexOf(label);
    assert.ok(index>previous,label);
    previous=index;
  }
  for(const forbidden of['onSubmit','submitOrder(','createCustomerPendingIntent','submissionId','idempotencyKey']){
    assert.equal(checkout.includes(forbidden),false,forbidden);
  }
  assert.ok(checkout.includes('真正安全提交屬下一階段'));
});

test('Contact derives Pickup Code only from the phone last four digits',()=>{
  assert.ok(checkout.includes("value.replace(/\\D/g,'')"));
  assert.ok(checkout.includes("value.length>=4?value.slice(-4):null"));
  assert.ok(checkout.includes('取餐碼只係電話最後 4 位'));
  assert.ok(checkout.includes('唔係流水號、備用參考碼或者訂單識別'));
  assert.equal(checkout.includes('crypto.randomUUID'),false);
});

test('Electronic payment consumes published channels and treats screenshot as evidence only',()=>{
  for(const marker of[
    'paymentChannels.find',
    'selectedChannel.qrImageUrl',
    '店舖已發布付款 QR',
    '截圖本身唔會改寫付款真相',
    '已提交付款憑證',
    '仍待 SMT / 店員正式核對',
  ])assert.ok(checkout.includes(marker),marker);
  assert.equal(checkout.includes('已確認付款'),false);
  assert.ok(app.includes("setNotice('已提交付款憑證，等待店舖核對。')"));
});

test('payment evidence is checkout-session-only and cart mutation invalidates it',()=>{
  assert.ok(persistence.includes('const {paymentEvidence:_paymentEvidence,...persistedCheckout}=workspace.checkout'));
  assert.ok(app.includes('changed&&checkout.paymentEvidence?withoutPaymentEvidence(checkout):checkout'));
  assert.ok(app.includes('舊付款憑證已失效'));
  assert.ok(checkout.includes("changed?{paymentEvidence:undefined}:{}"));
});

test('Checkout and review re-read current published facts and repair only affected lines',()=>{
  assert.ok(app.includes("if(step==='contact'||step==='review')await refresh()"));
  assert.ok(app.includes('quotePublishedCart(cart,snapshot?.menu)'));
  assert.ok(app.includes('publishedCartRepairs(cart,menu)'));
  assert.ok(quote.includes("'MATERIAL_CHANGE'"));
  assert.ok(checkout.includes('禁止靜默沿用舊價'));
  assert.ok(checkout.includes('返回記憶罐，只修受影響餐點'));
  assert.ok(checkout.includes(' → '));
});

test('UI4 does not invent coupon, pricing, payment or order authorities',()=>{
  const combined=[checkout,views,app].join('\n');
  for(const forbidden of[
    'class CustomerPricingEngine',
    'class CustomerPaymentEngine',
    'class CustomerOrderEngine',
    'class CouponEngine',
    'createCouponAuthority',
  ])assert.equal(combined.includes(forbidden),false,forbidden);
  assert.equal(checkout.includes('CouponCard'),false);
});
