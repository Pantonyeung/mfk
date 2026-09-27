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
const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const styles=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const primitives=fs.readFileSync(path.join(src,'ui/primitives.tsx'),'utf8');
const contract=fs.readFileSync(path.join(repoRoot,'contracts/customer-cloud-v1.ts'),'utf8');
const intake=fs.readFileSync(path.join(repoRoot,'v2local/src/runtime/customer-cloud-intake.ts'),'utf8');
const admin=fs.readFileSync(path.join(repoRoot,'v2admin/worker.ts'),'utf8');

test('Stage8 provides current completed and all filters',()=>{
  assert.match(ui8,/export type Ui8OrderSegment='current'\|'completed'\|'all'/);
  assert.match(ui8,/>進行中</);
  assert.match(ui8,/>已完成</);
  assert.match(ui8,/>全部</);
});

test('Stage8 preserves deterministic page states including READY and EMPTY',()=>{
  for(const state of['LOADING','READY','EMPTY','ERROR','OFFLINE','STALE','UNKNOWN'])assert.match(ui8,new RegExp(state));
  assert.match(ui8,/return hasRows\?'READY':'EMPTY'/);
});

test('historical order is read-only and reorder never reopens old order',()=>{
  assert.match(ui8,/Historical Order 只讀/);
  assert.match(ui8,/Past Order → Copy Intent → New Cart/);
  assert.match(ui8,/唔會重開舊 Order/);
  assert.doesNotMatch(ui8,/reopenOrder|updateHistoricalOrder|mutateHistory|commitOrder/);
  assert.doesNotMatch(app,/port\?\.buildReorderCart/);
});

test('copy intent strips formal identity old price payment fulfillment and coupon truth',()=>{
  const sanitizer=contract.slice(contract.indexOf('export function customerReorderIntentFromCart'),contract.indexOf('export interface CustomerCloudCheckout'));
  assert.doesNotMatch(sanitizer,/lineId:/);
  assert.doesNotMatch(sanitizer,/publishedUnitPriceMinor:/);
  assert.doesNotMatch(sanitizer,/payment|fulfillment|coupon/i);
  assert.match(intake,/customerReorderIntent:customerReorderIntentFromCart\(intent\.cart\)/);
  assert.match(app,/withoutPaymentEvidence\(checkout\)/);
  assert.match(ui8,/Formal Order identity \/ payment evidence \/ fulfillment \/ coupon redemption 全部冇複製/);
});

test('historical price remains history-only and current validation builds current cart facts',()=>{
  assert.match(types,/historicalUnitLabel:string/);
  assert.match(contract,/CustomerReorderHistoryPriceFact/);
  assert.match(reorder,/const historicalUnit=order\.reorderPriceFacts/);
  assert.match(reorder,/歷史價 HK\$/);
  assert.match(reorder,/customerStandalonePublishedUnitMinor/);
  assert.match(reorder,/customerComboPublishedUnitMinor/);
  assert.match(reorder,/product\.available/);
  assert.match(ui8,/舊 Price \/ Sellability \/ Coupon eligibility 或 redemption 不可直接帶去新交易/);
});

test('local repair only changes affected line',()=>{
  assert.match(app,/cart\.map\(item=>item\.lineId===lineId\?clearReorderAttention\(repaired\):item\)/);
  assert.match(ui8,/只改受影響 Line/);
  assert.match(ui8,/其他 .* 項保持新購物車目前狀態/);
  assert.match(ui8,/接受目前資料/);
  assert.match(ui8,/修正呢一項/);
  assert.match(ui8,/移除/);
});

test('Final Review uses current quote and exits only to normal cart UI4 UI5 path',()=>{
  assert.match(ui8,/Current Quote/);
  assert.match(ui8,/quote\?\.freshness==='CURRENT'/);
  assert.match(ui8,/current catalog \/ current quote/);
  assert.match(ui8,/>前往記憶罐</);
  assert.match(ui8,/正常 UI4 Checkout → UI5 Submit/);
  assert.doesNotMatch(ui8,/submitOrder|createCustomerPendingIntent|openSubmitRoute|commitOrder/);
  assert.match(app,/onGoCart=\{\(\)=>changeView\('cart'\)\}/);
});

test('Pickup Code and Display Number are separate and UUID is not rendered',()=>{
  assert.match(ui8,/Pickup Code ≠ Display Number/);
  assert.match(ui8,/>流水號</);
  assert.match(ui8,/>取餐碼</);
  assert.match(ui8,/唔會顯示 UUID 或 internal Order ID/);
  assert.doesNotMatch(ui8,/\{order\.orderId\}/);
});

test('Stage8 keeps fixed five-item bottom nav with Orders active and no sixth item',()=>{
  const nav=primitives.slice(primitives.indexOf('export function BottomNavigation'),primitives.indexOf('export interface ProductOriginRect'));
  const ids=[...nav.matchAll(/\{id:'(home|menu|cart|orders|more)' as const/g)].map(match=>match[1]);
  assert.deepEqual(ids,['home','menu','cart','orders','more']);
  assert.match(app,/view==='orders'/);
  assert.match(app,/BottomNavigation active=\{view==='pickup'\|\|view==='orders'\?'orders':view as/);
  assert.match(styles,/\.bottom-navigation\{position:fixed[\s\S]*grid-template-columns:repeat\(5,1fr\)[\s\S]*safe-area-inset-bottom/);
  assert.match(styles,/\.bottom-navigation button\{[^}]*min-height:60px/);
});

test('Saved template is safe-unavailable rather than fake success',()=>{
  assert.match(ui8,/SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN/);
  assert.match(ui8,/設為常用訂單/);
  assert.match(ui8,/disabled aria-disabled="true"/);
  assert.doesNotMatch(ui8,/saveOrderTemplate|createSavedTemplate|persistFavoriteOrder/);
});

test('history projection is canonical and reorder is enabled only with sanitized intent',()=>{
  assert.match(admin,/reorderEligible:Boolean\(order\.reorderIntent\?\.length\)/);
  assert.match(admin,/historicalLines/);
  assert.match(admin,/reorderPriceFacts/);
});

test('Stage8 introduces no Stage9 Seed Reward mutation',()=>{
  assert.doesNotMatch(ui8,/Stage9|seed|reward|issueCoupon|redeemCoupon/i);
  assert.doesNotMatch(reorder,/seed|reward|coupon|paymentEvidence|fulfillment|orderId/i);
});

test('Stage8 formal composition exposes both supplied male and female IP variants',()=>{
  assert.match(ui8,/stage8-history-male\.svg/);
  assert.match(ui8,/stage8-history-female\.svg/);
});
