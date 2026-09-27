import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const repoRoot=path.resolve(here,'../..');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const ui8=fs.readFileSync(path.join(src,'components/customer-history-ui8.tsx'),'utf8');
const reorder=fs.readFileSync(path.join(src,'reorder.ts'),'utf8');
const localQuote=fs.readFileSync(path.join(src,'local-quote.ts'),'utf8');
const primitives=fs.readFileSync(path.join(src,'ui/primitives.tsx'),'utf8');
const styles=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const contract=fs.readFileSync(path.join(repoRoot,'contracts/customer-cloud-v1.ts'),'utf8');
const intake=fs.readFileSync(path.join(repoRoot,'v2local/src/runtime/customer-cloud-intake.ts'),'utf8');
const admin=fs.readFileSync(path.join(repoRoot,'v2admin/worker.ts'),'utf8');

test('Stage8 list has current completed all and keeps Orders active in the fixed five-item nav',()=>{
  assert.match(ui8,/Ui8OrderSegment='current'\|'completed'\|'all'/);
  assert.match(ui8,/>進行中</);
  assert.match(ui8,/>已完成</);
  assert.match(ui8,/>全部</);
  assert.match(app,/view==='orders'\?<HistoryReorderUi8View/);

  const navBlock=primitives.slice(primitives.indexOf('export function BottomNavigation'),primitives.indexOf('export interface ProductOriginRect'));
  const navIds=[...navBlock.matchAll(/\{id:'(home|menu|cart|orders|more)' as const/g)].map(match=>match[1]);
  assert.deepEqual(navIds,['home','menu','cart','orders','more']);
  assert.match(app,/BottomNavigation active=\{view==='pickup'\?'orders':view as/);
  assert.match(styles,/\.bottom-navigation\{position:fixed[\s\S]*grid-template-columns:repeat\(5,1fr\)[\s\S]*env\(safe-area-inset-bottom\)/);
  const buttonMinHeight=styles.match(/\.bottom-navigation button\{[^}]*min-height:(\d+)px/);
  assert.ok(buttonMinHeight);
  assert.ok(Number(buttonMinHeight[1])>=44);
});

test('Historical Order stays immutable and Pickup Code remains separate from Display Number',()=>{
  assert.match(ui8,/歷史快照｜只讀/);
  assert.match(ui8,/舊 Order 唔會被重新開啟或修改/);
  assert.match(ui8,/Pickup Code ≠ Display Number/);
  assert.match(ui8,/唔會顯示 UUID 或 internal Order ID/);
  assert.match(types,/historicalLines:readonly CustomerHistoricalLine\[\]/);
  assert.doesNotMatch(ui8,/updateHistory|mutateHistory|reopenOrder|reopenOldOrder/);
});

test('Reorder means price-free Copy Intent to a NEW CART, never reopen old Order',()=>{
  assert.match(contract,/customerReorderIntentFromCart/);
  assert.match(intake,/customerReorderIntent:customerReorderIntentFromCart\(intent\.cart\)/);
  assert.match(reorder,/createLineId:\(\)=>string=\(\)=>crypto\.randomUUID\(\)/);
  assert.match(ui8,/Past Order → Copy Intent → New Cart/);
  assert.match(ui8,/唔會重開舊 Order/);

  const sanitizer=contract.slice(contract.indexOf('export function customerReorderIntentFromCart'),contract.indexOf('export interface CustomerCloudCheckout'));
  assert.doesNotMatch(sanitizer,/lineId:/);
  assert.doesNotMatch(sanitizer,/publishedUnitPriceMinor:/);
  assert.doesNotMatch(sanitizer,/paymentEvidence|fulfillment|coupon|orderId/i);
});

test('Old price is historical only and a changed price requires local line confirmation',()=>{
  assert.match(contract,/CustomerReorderHistoryPriceFact/);
  assert.match(contract,/historicalPublishedUnitMinor/);
  assert.match(reorder,/order\.reorderPriceFacts/);
  assert.match(reorder,/歷史價 HK\$/);
  assert.match(reorder,/目前 HK\$/);
  assert.match(reorder,/請確認目前價格/);
  assert.match(ui8,/接受目前資料/);
  assert.match(ui8,/Current Quote/);
});

test('Current sellability required options and combo validation drive reorder rebuild',()=>{
  assert.match(reorder,/product\.available/);
  assert.match(reorder,/validateCustomerSelections/);
  assert.match(reorder,/validateCustomerComboSelection/);
  assert.match(reorder,/selectedCustomerComboIntent/);
  assert.match(reorder,/customerStandalonePublishedUnitMinor/);
  assert.match(reorder,/customerComboPublishedUnitMinor/);
  assert.match(localQuote,/publishedCartRepairs/);
  assert.match(localQuote,/PRODUCT_UNAVAILABLE/);
  assert.match(localQuote,/CONFIG_CHANGED/);
});

test('Local Repair changes only affected NEW CART lines',()=>{
  assert.match(ui8,/只改受影響 Line/);
  assert.match(app,/cart\.map\(item=>item\.lineId===lineId\?clearReorderAttention\(repaired\):item\)/);
  assert.match(app,/cart\.filter\(line=>line\.lineId!==lineId\)/);
  assert.match(app,/openProduct\(product,null,line\)/);
  assert.doesNotMatch(app,/reopenOrder|updateHistoricalOrder/);
});

test('Final Review uses current quote and can only return to normal Cart then UI4 UI5',()=>{
  assert.match(ui8,/quote\?\.freshness==='CURRENT'/);
  assert.match(ui8,/Current Quote/);
  assert.match(ui8,/UI4 Checkout → UI5 Submit/);
  assert.match(app,/onGoCart=\{\(\)=>changeView\('cart'\)\}/);
  assert.match(app,/view==='checkout'\?<CheckoutUi4View/);
  assert.match(app,/view==='submit'/);
  assert.doesNotMatch(ui8,/submitOrder|createOrder|commitOrder|createCustomerPendingIntent/);
});

test('Old payment evidence fulfillment and coupon finality are not copied',()=>{
  assert.match(app,/const nextCheckout=withoutPaymentEvidence\(checkout\)/);
  assert.match(ui8,/Formal Order identity \/ payment evidence \/ fulfillment \/ coupon redemption 全部冇複製/);
  assert.doesNotMatch(reorder,/paymentEvidence|fulfillment|coupon/i);
});

test('Stage8 page states distinguish LOADING READY EMPTY ERROR OFFLINE STALE UNKNOWN',()=>{
  for(const state of['LOADING','READY','EMPTY','ERROR','OFFLINE','STALE','UNKNOWN']){
    assert.match(ui8,new RegExp("'"+state+"'"));
  }
  assert.match(ui8,/return hasRows\?'READY':'EMPTY'/);
  assert.match(ui8,/EMPTY 唔等於連線錯誤/);
  assert.match(ui8,/禁止由 Stage 8 直接建立或提交新 Order/);
});

test('saved-template CTA is safe unavailable because current main has no mutation seam',()=>{
  assert.match(ui8,/SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN/);
  assert.match(ui8,/>設為常用訂單</);
  assert.match(ui8,/disabled aria-disabled="true"/);
  assert.doesNotMatch(app,/saveOrderTemplate|createSavedOrder|mutateSavedTemplate/);
});

test('Stage8 uses formal male and female IP assets and introduces no Stage9 reward mutation',()=>{
  assert.match(ui8,/stage8-reorder-female\.svg/);
  assert.match(ui8,/stage8-reorder-male\.svg/);
  assert.doesNotMatch(ui8,/Stage9|seed|reward|issueCoupon|redeemCoupon/i);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.ui8-page/);
});

test('Admin history projection carries immutable facts plus safe reorder intent only',()=>{
  assert.match(admin,/historicalLines/);
  assert.match(admin,/reorderIntent/);
  assert.match(admin,/reorderPriceFacts/);
  assert.match(admin,/reorderEligible:Boolean\(order\.reorderIntent\?\.length\)/);
});
