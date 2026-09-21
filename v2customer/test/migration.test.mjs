import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(srcRoot,'capabilities.json'),'utf8'));
const source=fs.readdirSync(srcRoot)
  .filter(name=>/\.(ts|tsx|js|jsx)$/.test(name))
  .map(name=>fs.readFileSync(path.join(srcRoot,name),'utf8'))
  .join('\n');

test('customer capability registry is complete and stable',()=>{
  assert.equal(registry.length,44);
  assert.equal(new Set(registry.map(item=>item.id)).size,44);
  for(const item of registry){
    assert.ok(item.id);
    assert.ok(item.group);
    assert.ok(item.label);
    assert.ok(item.surface);
    assert.ok(item.owner);
    assert.ok(['READ_SHAPE','COMMAND_SHAPE'].includes(item.kind));
    if(item.kind==='COMMAND_SHAPE')assert.equal(item.status,'NOT_WIRED');
  }
});

test('all customer command shapes remain NOT_WIRED',()=>{
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  assert.deepEqual([...new Set(commands.map(item=>item.status))],['NOT_WIRED']);
});

test('required customer migration capabilities exist',()=>{
  const ids=new Set(registry.map(item=>item.id));
  for(const id of [
    'HOME','MENU_BROWSE','CATEGORY_BROWSE','PRODUCT_DETAIL','PRODUCT_CONFIG','MODIFIER_SELECT','OPTION_SELECT','COMBO_SELECT',
    'CART_VIEW','CHECKOUT_FORM','PHONE_INPUT','PICKUP_CODE_PRESENTATION','SAFE_SUBMIT_PRESENTATION','PENDING_INTENT_PRESENTATION',
    'STORE_ACCEPTANCE_PRESENTATION','PREPARING_PRESENTATION','READY_PRESENTATION','PICKUP_PRESENTATION','COMPLETED_PRESENTATION',
    'ORDER_STATUS','ORDER_DETAIL','HISTORY','REORDER_SHAPE','OWN_CHANNEL_UNAVAILABLE','FALLBACK_PRESENTATION',
    'OFFLINE_PRESENTATION','FAILURE_PRESENTATION','RETRY_PRESENTATION','UNKNOWN_PRESENTATION','STALE_PRESENTATION','CAPABILITY_REGISTRY'
  ])assert.ok(ids.has(id),id);
});

const forbidden=[
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /\baxios\b/,
  /https?:\/\//,
  /from\s+['"][^'"]*v2local/,
  /from\s+['"][^'"]*v2smt/,
  /createFormalOrder/,
  /allocateDisplayNumber/,
  /storeKernel\s*\./i,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /new\s+Worker\s*\(/
];

test('customer clean port has zero live authority or network path',()=>{
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('customer workflow surfaces remain visible without live authority',()=>{
  for(const marker of [
    '首頁','菜單','Product Detail','Product Config','Modifier / Option Selection Shape','Combo Selection Shape',
    '購物籃','Checkout Form Shape','電話','Pickup Code Presentation','Safe Submit Presentation','PENDING_INTENT',
    '等待店舖接單','製作中','可取餐','取餐','已完成','Order Status','Order Detail','歷史','再次下單',
    '自家渠道暫時不可用','WhatsApp','離線','Failure','Retry Presentation','UNKNOWN','STALE','Capability Registry'
  ])assert.match(source,new RegExp(marker));
});

test('safe submit cannot present a formal-order success claim',()=>{
  assert.match(source,/提交訂單（NOT_WIRED）/);
  assert.match(source,/未建立正式 Order/);
  assert.match(source,/未送店舖/);
  assert.match(source,/未派正式 Display Number/);
  assert.match(source,/未建立離線 queue/);
  assert.doesNotMatch(source,/正式訂單已建立/);
});
