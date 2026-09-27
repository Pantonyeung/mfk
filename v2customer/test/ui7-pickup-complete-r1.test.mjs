import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const repoRoot=path.resolve(here,'../..');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const ui7=fs.readFileSync(path.join(src,'components/customer-pickup-ui7.tsx'),'utf8');
const ui6=fs.readFileSync(path.join(src,'components/customer-fulfillment-ui6.tsx'),'utf8');
const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const styles=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const admin=fs.readFileSync(path.join(repoRoot,'v2admin/worker.ts'),'utf8');

test('UI7 route owns READY onward while UI6 remains the pre-pickup read-only surface',()=>{
  assert.match(app,/const pickupMatch=pathname\.match/);
  assert.match(app,/return \{view:'pickup',pickupOrderId/);
  assert.match(app,/openPickupRoute/);
  assert.match(app,/\['READY','ARRIVED','VERIFIED','HANDED_OVER','PICKUP_EXCEPTION','COMPLETED'\]/);
  assert.match(app,/PickupCompleteUi7View/);
  assert.match(ui6,/READY ≠ COMPLETED/);
});

test('core Stage 7 state lock stays explicit',()=>{
  for(const state of['READY','ARRIVED','VERIFIED','HANDED_OVER','COMPLETED']){
    assert.match(types,new RegExp("\\|'"+state+"'|='"+state+"'"));
  }
  assert.match(ui7,/READY 仍然唔係 Completed/);
  assert.match(ui7,/到店通知唔等於核對、交收或完成|我到了/);
  assert.match(ui7,/未真正交付並讀回 COMPLETED 前/);
  assert.match(ui7,/例外未 resolve 絕不會 Completed/);
});

test('arrival seam is classified unavailable and never mutates fulfillment',()=>{
  assert.match(ui7,/SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN/);
  assert.match(ui7,/>我到了</);
  assert.match(ui7,/disabled aria-disabled="true"/);
  assert.match(ui7,/唔會改 Fulfillment 或 Complete/);
  assert.doesNotMatch(ui7,/requestArrival|arrivalFetch|markArrived|setArrived/);
});

test('ARRIVED VERIFIED HANDED_OVER COMPLETED are canonical readback-only projections',()=>{
  assert.match(admin,/customerHandoverState/);
  assert.match(admin,/canonicalHandover==='ARRIVED'\?'ARRIVED'/);
  assert.match(admin,/canonicalHandover==='VERIFIED'\?'VERIFIED'/);
  assert.match(admin,/canonicalHandover==='HANDED_OVER'\?'HANDED_OVER'/);
  assert.match(admin,/canonicalHandover==='COMPLETED'\?'COMPLETED'/);
  assert.doesNotMatch(ui7,/markOrderReady|acceptOrder|updateFulfillment|completeOrder|handoverOrder/);
});

test('unresolved pickup exception always blocks Completed projection',()=>{
  assert.match(admin,/if\(pickupException&&pickupException\.resolved!==true\)stage='PICKUP_EXCEPTION'/);
  assert.match(ui7,/const unresolvedException=Boolean/);
  assert.match(ui7,/unresolvedException\?'PICKUP_EXCEPTION':canonicalStage/);
  assert.match(ui7,/CODE_MISMATCH/);
  assert.match(ui7,/MISSING_BAG/);
  assert.match(ui7,/SAME_NAME/);
});

test('Pickup Code and Display Number remain separate and no internal identity is rendered',()=>{
  assert.match(ui7,/>取餐碼</);
  assert.match(ui7,/>流水號</);
  assert.match(ui7,/Pickup Code ≠ Display Number/);
  assert.match(ui7,/唔會顯示 UUID 或 internal Order ID/);
  assert.doesNotMatch(ui7,/\{order\??\.orderId\}/);
  assert.doesNotMatch(ui7,/\{intent\??\.canonicalOrderId\}/);
});

test('completion time is shown only from canonical projected fact',()=>{
  assert.match(ui7,/const completedAt=order\?\.completedAt\?\?historyOrder\?\.completedAt/);
  assert.match(ui7,/formatTime\(completedAt\)/);
  assert.match(ui7,/canonical completion time 未提供；畫面唔會自行估算/);
  assert.doesNotMatch(ui7,/Date\.now\(\).*completed|new Date\(\)\.toISOString\(\).*completed/i);
});

test('UI7 preserves weak-network fail-closed freshness',()=>{
  for(const state of['LOADING','ERROR','OFFLINE','STALE','UNKNOWN']){
    assert.match(ui7,new RegExp(state));
  }
  assert.match(ui7,/Realtime 只係提示；canonical readback 先係真相/);
  assert.match(ui7,/唔會推斷 VERIFIED、HANDED_OVER 或 COMPLETED/);
});

test('UI7 contains no Stage8 reward or instant seed issuance',()=>{
  assert.doesNotMatch(ui7,/reorder|再來一單|seed|reward|coupon|badge/i);
});

test('formal Stage 7 composition uses supplied IP assets, touch target and reduced motion',()=>{
  assert.match(ui7,/\/brand\/stage7-pickup-male\.svg/);
  assert.match(ui7,/\/brand\/stage7-pickup-female\.svg/);
  assert.match(styles,/\.ui7-arrival-unavailable button[\s\S]*min-height:48px/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.ui7-shell/);
});
