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
  assert.match(app,/BottomNavigation active=\{view==='cart'\|\|view==='checkout'\?'cart':view==='more'\?'more':'orders'\}/);
  assert.match(styles,/\.bottom-navigation\{position:fixed[\s\S]*grid-template-columns:repeat\(5,1fr\)[\s\S]*env\(safe-area-inset-bottom\)/);
  const buttonMinHeight=styles.match(/\.bottom-navigation button\{[^}]*min-height:(\d+)px/);
  assert.ok(buttonMinHeight);
  assert.ok(Number(buttonMinHeight[1])>=44);
});

test('Historical Order stays immutable and Pickup Code remains separate from Display Number',()=>{
  assert.match(ui8,/歷史訂單/);
  assert.match(ui8,/舊訂單唔會被改動/);
  assert.match(ui8,/流水號同取餐碼用途不同/);
  assert.match(ui8,/取餐時跟畫面提示出示即可/);
  assert.match(types,/historicalLines:readonly CustomerHistoricalLine\[\]/);
  assert.doesNotMatch(ui8,/updateHistory|mutateHistory|reopenOrder|reopenOldOrder/);
});

test('Reorder means price-free Copy Intent to a NEW CART, never reopen old Order',()=>{
  assert.match(contract,/customerReorderIntentFromCart/);
  assert.match(intake,/customerReorderIntent:customerReorderIntentFromCart\(intent\.cart\)/);
  assert.match(reorder,/createLineId:\(\)=>string=\(\)=>crypto\.randomUUID\(\)/);
  assert.match(ui8,/上次嘅選擇建立一個新記憶罐/);
  assert.match(ui8,/舊訂單保持不變/);

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
  assert.match(ui8,/目前總額/);
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
  assert.match(ui8,/只會改受影響餐點/);
  assert.match(app,/cart\.map\(item=>item\.lineId===lineId\?clearReorderAttention\(repaired\):item\)/);
  assert.match(app,/cart\.filter\(line=>line\.lineId!==lineId\)/);
  assert.match(app,/openProduct\(product,null,line\)/);
  assert.doesNotMatch(app,/reopenOrder|updateHistoricalOrder/);
});

test('Final Review uses current quote and can only return to normal Cart then UI4 UI5',()=>{
  assert.match(ui8,/quote\?\.freshness==='CURRENT'/);
  assert.match(ui8,/目前總額/);
  assert.match(ui8,/正常結帳流程/);
  assert.match(app,/onGoCart=\{\(\)=>changeView\('cart'\)\}/);
  assert.match(app,/view==='checkout'\?<CheckoutUi4View/);
  assert.match(app,/view==='submit'/);
  assert.doesNotMatch(ui8,/submitOrder|createOrder|commitOrder|createCustomerPendingIntent/);
});

test('Old payment evidence fulfillment and coupon finality are not copied',()=>{
  assert.match(app,/const nextCheckout=withoutPaymentEvidence\(checkout\)/);
  assert.match(ui8,/付款、取餐進度同舊優惠狀態都唔會複製/);
  assert.doesNotMatch(reorder,/paymentEvidence|fulfillment|coupon/i);
});

test('Stage8 page states distinguish LOADING READY EMPTY ERROR OFFLINE STALE UNKNOWN',()=>{
  for(const state of['LOADING','READY','EMPTY','ERROR','OFFLINE','STALE','UNKNOWN']){
    assert.match(ui8,new RegExp("'"+state+"'"));
  }
  assert.match(ui8,/return hasRows\?'READY':'EMPTY'/);
  assert.match(ui8,/呢個分類暫時未有訂單/);
  assert.match(ui8,/訂單狀態仍在確認/);
});


test('OFFLINE STALE UNKNOWN cannot start reorder while history stays readable; READY + menu can start',()=>{
  assert.match(ui8,/const reorderFresh=browserOnline&&connection==='READY'&&Boolean\(menu\)/);
  assert.match(ui8,/disabled=\{!order\.reorderEligible\|\|!reorderFresh\}/);
  assert.match(ui8,/歷史訂單仍可查看/);
  assert.match(ui8,/重新整理/);
  const start=app.indexOf('const reorder=async');
  const build=app.indexOf('buildCurrentReorderCart(order,menu)',start);
  const gate=app.indexOf("if(!browserOnline||connection!=='READY'||!menu)",start);
  assert.ok(start>=0&&gate>start&&build>gate);
  assert.match(app,/歷史訂單仍可查看；需要重新同步目前餐牌後先可以建立新購物車/);
});

test('freshness loss during COPY REPAIR REVIEW preserves draft and blocks progression',()=>{
  assert.match(ui8,/if\(!reorderFresh\)return <section className="page ui8-page ui8-freshness-block"/);
  assert.match(ui8,/已揀好嘅餐點會保留/);
  assert.match(ui8,/已保留記憶罐/);
  assert.match(ui8,/{cart\.length} 項餐點/);
  assert.match(ui8,/更新完成後會再確認目前餐單同價格/);
  const blocked=ui8.slice(ui8.indexOf("if(!reorderFresh)return"),ui8.indexOf("if(phase==='COPY')"));
  assert.doesNotMatch(blocked,/setCart|updateCart|onGoCart|onContinue/);
  assert.match(app,/if\(!browserOnline\|\|connection!=='READY'\|\|!menu\)\{setNotice\('目前資料未 fresh；draft cart 已保留/);
});

test('Final Review cannot become ready on stale local quote and reconnect READY re-enables current validation',()=>{
  assert.match(ui8,/const ready=Boolean\(fresh&&cart\.length&&quote\?\.freshness==='CURRENT'&&!cart\.some\(line=>line\.attention\)\)/);
  assert.match(ui8,/fresh=\{reorderFresh\}/);
  assert.match(ui8,/需要重新更新目前餐單/);
  assert.match(ui8,/onClick=\{onRefresh\}>重新整理/);
  assert.match(ui8,/const reorderFresh=browserOnline&&connection==='READY'&&Boolean\(menu\)/);
});

test('saved-template CTA keeps exact diagnostic classification but renders only human-safe copy',()=>{
  const exact='SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN';
  assert.ok(ui8.includes(exact));
  assert.match(ui8,/>設為常用訂單</);
  assert.match(ui8,/disabled aria-disabled="true"/);
  assert.match(ui8,/常用訂單功能尚未開放/);
  const historyDetail=ui8.slice(ui8.indexOf('function HistoryDetail'),ui8.indexOf('function CopyIntent'));
  assert.equal(historyDetail.includes(exact),false);
  assert.doesNotMatch(historyDetail,/{CUSTOMER_UI8_SAVED_TEMPLATE_SEAM_CLASSIFICATION}/);
  assert.doesNotMatch(app,/saveOrderTemplate|createSavedOrder|mutateSavedTemplate/);
});

test('Stage8 uses formal male and female IP assets and introduces no Stage9 reward mutation',()=>{
  assert.match(ui8,/data-final-art-pending="true"/);
  assert.match(ui8,/data-character-slot=\{variant\}/);
  assert.doesNotMatch(ui8,/Stage9|seed|reward|issueCoupon|redeemCoupon/i);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.ui8-page/);
});

test('Admin history projection carries immutable facts plus safe reorder intent only',()=>{
  assert.match(admin,/historicalLines/);
  assert.match(admin,/reorderIntent/);
  assert.match(admin,/reorderPriceFacts/);
  assert.match(admin,/reorderEligible:Boolean\(order\.reorderIntent\?\.length\)/);
});
