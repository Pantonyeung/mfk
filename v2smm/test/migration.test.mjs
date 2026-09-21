import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(root,'capabilities.json'),'utf8'));
const source=fs.readdirSync(root).filter(name=>/\.(ts|tsx|js|jsx)$/.test(name)).map(name=>fs.readFileSync(path.join(root,name),'utf8')).join('\n');

test('capability registry is complete and stable',()=>{
  assert.equal(registry.length,42);
  assert.equal(new Set(registry.map(item=>item.id)).size,42);
  for(const item of registry){
    assert.ok(item.id);
    assert.ok(item.group);
    assert.ok(item.label);
    assert.ok(item.surface);
    assert.ok(item.owner);
    if(item.kind==='COMMAND_SHAPE')assert.equal(item.status,'NOT_WIRED');
  }
});

test('every command shape is explicitly NOT_WIRED',()=>{
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  assert.deepEqual([...new Set(commands.map(item=>item.status))],['NOT_WIRED']);
});

test('required migration capabilities exist',()=>{
  const ids=new Set(registry.map(item=>item.id));
  for(const id of [
    'MENU_BROWSE','PRODUCT_SELECT','MODIFIER_SELECT','COMBO_CONFIG','CART_PREVIEW','QUOTE_PREVIEW',
    'PENDING_INTENT','ORDER_RESULT_READBACK','SELLABILITY_PROJECTION','STAFF_CONTEXT','OFFLINE_PRESENTATION',
    'FAILURE_PRESENTATION','RETRY_PRESENTATION','UNKNOWN_PRESENTATION'
  ])assert.ok(ids.has(id),id);
});

const forbidden=[
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bindexedDB\b/,
  /\blocalStorage\b/,
  /\/api\//,
  /createFormalOrder/,
  /allocateDisplayNumber/,
  /storeKernel\s*\./,
  /d1\s*\./i,
  /new\s+Worker\s*\(/
];

test('SMM clean port has zero live authority or network mutation',()=>{
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('donor workflow surfaces remain visible without authority',()=>{
  for(const marker of ['點單','待處理','訂單','堂食','更多','商品供應','營業日','營運報表','列印管理','診斷中心','訂單來源'])assert.match(source,new RegExp(marker));
});

test('UI declares migration boundary',()=>{
  assert.match(source,/所有 Command：NOT_WIRED/);
  assert.match(source,/未建立正式訂單/);
  assert.match(source,/等待 SMT Quote/);
});
