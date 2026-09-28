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
  assert.match(app,/view==='waiting'/);
  assert.match(app,/browserOnline=\{browserOnline\}/);
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

test('order null never falls back to RECEIVED and uses explicit readback states',()=>{
  assert.doesNotMatch(ui6,/order\?\.stage\?\?'RECEIVED'/);
  assert.doesNotMatch(ui6,/isUi6Stage\(rawStage\)\?rawStage:'RECEIVED'/);
  assert.match(ui6,/const stage=order&&isUi6Stage\(order\.stage\)\?order\.stage:null/);
  assert.match(ui6,/state=\{unsupported\?'UNKNOWN':emptyStateFrom\(freshness\)\}/);
  assert.match(ui6,/店舖狀態等待更新/);
  assert.match(ui6,/未確認到新狀態之前/);
});

test('unsupported stage fails closed to UNKNOWN instead of RECEIVED',()=>{
  assert.match(ui6,/const unsupported=Boolean\(order&&!stage\)/);
  assert.match(ui6,/unsupported\?'UNKNOWN'/);
  assert.match(ui6,/暫時未能確認最新進度/);
});

test('LOADING EMPTY ERROR OFFLINE STALE UNKNOWN are deterministic and separate',()=>{
  for(const state of['LOADING','EMPTY','ERROR','OFFLINE','STALE','UNKNOWN']){
    assert.match(ui6,new RegExp(state));
  }
  assert.match(ui6,/if\(!browserOnline\|\|connection==='NOT_CONNECTED'\)return 'OFFLINE'/);
  assert.match(ui6,/if\(connection==='LOADING'\)return 'LOADING'/);
  assert.match(ui6,/if\(connection==='ERROR'\)return 'ERROR'/);
  assert.match(ui6,/if\(connection==='STALE'\|\|connection==='PARTIAL'\)return 'STALE'/);
  assert.match(ui6,/if\(connection==='UNKNOWN'\)return 'UNKNOWN'/);
  assert.match(ui6,/freshness==='CURRENT'\?'EMPTY':freshness/);
});

test('last-known canonical state can remain visible while freshness is not CURRENT',()=>{
  assert.match(ui6,/data-ui6-freshness=\{freshness\}/);
  assert.match(ui6,/目前離線；以下係最近一次已知進度/);
  assert.match(ui6,/以下係最近一次已知進度；最新狀態仍在更新/);
  assert.match(ui6,/更新暫時出錯；以下保留最近一次已知進度/);
  assert.match(ui6,/目前先顯示最近一次已知進度/);
});

test('COMPLETED deep-link leaves UI6 waiting route and never renders waiting confirmation',()=>{
  assert.match(app,/history\.some\(order=>order\.orderId===waitingOrderId\)/);
  assert.match(app,/\['READY','ARRIVED','VERIFIED','HANDED_OVER','PICKUP_EXCEPTION','COMPLETED'\]\.includes\(waitingOrder\.stage\)/);
  assert.match(app,/if\(view!=='waiting'\|\|!waitingUi7Ready\|\|!waitingOrderId\)return/);
  assert.match(app,/openPickupRoute\(waitingOrderId\)/);
  assert.match(app,/view==='pickup'/);
  assert.match(app,/PickupCompleteUi7View/);
});

test('UI6 keeps Display Number, Pickup Code and Order ID semantics separate without showing the internal value',()=>{
  assert.match(ui6,/>流水號</);
  assert.match(ui6,/>取餐碼</);
  assert.match(ui6,/流水號同取餐碼用途不同/);
  assert.match(ui6,/到店取餐跟畫面提示出示即可/);
  assert.doesNotMatch(ui6,/\{order\??\.orderId\}/);
  assert.doesNotMatch(ui6,/\{intent\??\.canonicalOrderId\}/);
});

test('UI6 never implements UI7 pickup completion',()=>{
  assert.doesNotMatch(ui6,/PICKUP_VERIFICATION|HANDED_OVER|data-ui7|onHandover|onComplete/);
  assert.match(ui6,/可取餐唔代表已交收/);
  assert.match(ui6,/真正交畀你之後先會完成/);
});

test('Delay and ETA are canonical pass-through only, not a client timer invention',()=>{
  assert.match(adminWorker,/'稍有延誤':'DELAYED'/);
  assert.match(adminWorker,/order\.etaLabel\|\|order\.promisedReadyLabel/);
  assert.match(ui6,/stage==='DELAYED'&&order\.etaLabel/);
  assert.match(ui6,/唔會自行估算時間/);
});

test('reject and cancel remain separate canonical projections',()=>{
  assert.match(adminWorker,/'未能接單':'REJECTED'/);
  assert.match(adminWorker,/'已取消':'CANCELED'/);
  assert.match(adminWorker,/stage==='CANCELED'/);
  assert.match(adminWorker,/stage==='REJECTED'/);
});

test('manual refresh and weak-network recovery are read only and cannot resubmit',()=>{
  assert.match(ui6,/重新整理/);
  assert.match(ui6,/只會更新訂單進度/);
  assert.match(ui6,/恢復連線後會重新更新訂單進度/);
  assert.equal((cloud.match(/async readSnapshot\(\)/g)||[]).length,1);
  assert.doesNotMatch(ui6,/onSubmit|readSubmission|createCustomerPendingIntent/);
});

test('Customer runtime port still exposes no fulfillment mutation capability',()=>{
  const port=types.slice(types.indexOf('export interface CustomerRuntimePort'));
  for(const forbidden of['acceptOrder','markOrderReady','markCompleted','updateFulfillment','handoverOrder']){
    assert.equal(port.includes(forbidden),false,forbidden);
  }
});
