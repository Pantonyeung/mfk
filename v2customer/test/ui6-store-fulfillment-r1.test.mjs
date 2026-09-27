import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const customerSrc=path.resolve(here,'../src');
const repoRoot=path.resolve(here,'../..');
const app=fs.readFileSync(path.join(customerSrc,'App.tsx'),'utf8');
const ui6=fs.readFileSync(path.join(customerSrc,'components/customer-fulfillment-ui6.tsx'),'utf8');
const types=fs.readFileSync(path.join(customerSrc,'product-types.ts'),'utf8');
const cloud=fs.readFileSync(path.join(customerSrc,'cloud-runtime.ts'),'utf8');
const adminWorker=fs.readFileSync(path.join(repoRoot,'v2admin/worker.ts'),'utf8');

test('UI5 delivery enters dedicated UI6 tracking without a second fulfillment engine',()=>{
  assert.match(app,/StoreFulfillmentUi6View/);
  assert.match(app,/view==='waiting'\?<StoreFulfillmentUi6View/);
  assert.match(app,/onRefresh=\{\(\)=>void refresh\(\)\}/);
  assert.doesNotMatch(ui6,/submitOrder|markOrderReady|completeOrder|updateFulfillment|acceptOrder/);
});

test('UI6 presents only the requested customer-facing canonical tracking states',()=>{
  for(const marker of[
    "RECEIVED:{label:'等待店舖確認'",
    "PREPARING:{label:'製作中'",
    "DELAYED:{label:'稍有延誤'",
    "READY:{label:'可取餐'",
    "REJECTED:{label:'未能接單'",
    "CANCELED:{label:'已取消'",
  ])assert.ok(ui6.includes(marker),marker);
  assert.ok(types.includes("|'CANCELED'|"));
});

test('UI6 keeps Display Number, Pickup Code and Order ID semantics separate without showing the internal value',()=>{
  assert.match(ui6,/>流水號</);
  assert.match(ui6,/>取餐碼</);
  assert.match(ui6,/Order ID 只留系統內部關聯/);
  assert.match(ui6,/唔會顯示實際值或 UUID/);
  assert.doesNotMatch(ui6,/\{order\??\.orderId\}/);
  assert.doesNotMatch(ui6,/\{intent\??\.canonicalOrderId\}/);
});

test('UI6 never implements UI7 pickup completion',()=>{
  assert.doesNotMatch(ui6,/PICKUP_VERIFICATION|HANDED_OVER|data-ui7|onHandover|onComplete/);
  assert.match(ui6,/Ready ≠ Completed/);
  assert.match(ui6,/UI6 冇「完成交收」操作/);
});

test('Delay and ETA are canonical pass-through only, not a client timer invention',()=>{
  assert.match(adminWorker,/'稍有延誤':'DELAYED'/);
  assert.match(adminWorker,/order\.etaLabel\|\|order\.promisedReadyLabel/);
  assert.match(ui6,/stage==='DELAYED'&&order\?\.etaLabel/);
  assert.match(ui6,/唔會自行估算時間/);
});

test('reject and cancel remain separate canonical projections',()=>{
  assert.match(adminWorker,/'未能接單':'REJECTED'/);
  assert.match(adminWorker,/'已取消':'CANCELED'/);
  assert.match(adminWorker,/stage==='CANCELED'/);
  assert.match(adminWorker,/stage==='REJECTED'/);
});

test('manual refresh and weak-network recovery are read only and cannot resubmit',()=>{
  assert.match(ui6,/只讀 Refresh/);
  assert.match(ui6,/只查 canonical Status/);
  assert.match(ui6,/網絡恢復後只會重新讀狀態，唔會重新提交訂單/);
  assert.equal((cloud.match(/async readSnapshot\(\)/g)||[]).length,1);
  assert.doesNotMatch(ui6,/onSubmit|readSubmission|createCustomerPendingIntent/);
});

test('Customer runtime port still exposes no fulfillment mutation capability',()=>{
  const port=types.slice(types.indexOf('export interface CustomerRuntimePort'));
  for(const forbidden of['acceptOrder','markOrderReady','markCompleted','updateFulfillment','handoverOrder']){
    assert.equal(port.includes(forbidden),false,forbidden);
  }
});
