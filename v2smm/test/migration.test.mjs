import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(root,'capabilities.json'),'utf8'));
const sourceFiles=fs.readdirSync(root).filter(name=>/\.(ts|tsx|js|jsx)$/.test(name));
const source=sourceFiles.map(name=>fs.readFileSync(path.join(root,name),'utf8')).join('\n');

test('capability registry stays unique and command authority remains disconnected',()=>{
  assert.equal(registry.length,54);
  assert.equal(new Set(registry.map(item=>item.id)).size,54);
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  assert.deepEqual([...new Set(commands.map(item=>item.status))],['NOT_WIRED']);
  const reads=registry.filter(item=>item.kind!=='COMMAND_SHAPE');
  assert.deepEqual([...new Set(reads.map(item=>item.status))],['PRODUCT_READY_NOT_CONNECTED']);
});

test('SMM product shell has no live network or canonical writer',()=>{
  const forbidden=[
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\bindexedDB\b/,
    /\/api\//,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./,
    /\bD1Database\b/,
    /new\s+Worker\s*\(/,
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('local persistence is explicitly non-authoritative',()=>{
  const persistence=fs.readFileSync(path.join(root,'persistence.ts'),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/localStorage/);
  assert.match(persistence,/smm-direct:/);
  assert.doesNotMatch(persistence,/Formal Order|Store Kernel|Pricing engine/i);
});

test('production App no longer imports fixtures or exposes migration/demo operator copy',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\.\/fixtures/);
  assert.doesNotMatch(app,/Migration Mode|DEMO|Capability Registry|所有 Command：NOT_WIRED/);
  assert.match(app,/尚未連接門店服務/);
  assert.match(app,/唔會顯示假資料/);
  assert.match(app,/本機草稿/);
  assert.match(app,/結果未明/);
});

test('complete operator routes and failure states are present',()=>{
  for(const marker of[
    '快速點餐','前線工作','訂單記錄','桌面管理','店務工具',
    '搜尋商品','商品設定','購物草稿','待提交草稿','平台狀態',
    '商品供應','營業日','列印狀態','診斷','正在同步餐單',
    '同步失敗','重新確認結果'
  ])assert.match(source,new RegExp(marker));
});

test('typed runtime port is an injected boundary only',()=>{
  const runtime=fs.readFileSync(path.join(root,'runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_SMM_PRODUCT_PORT__/);
  assert.match(types,/MFK_SMM_PORT_V1/);
  assert.match(types,/readSnapshot\(\)/);
  assert.match(types,/submitOrder\?/);
  assert.doesNotMatch(runtime,/fetch|WebSocket|XMLHttpRequest/);
});

test('UNKNOWN flow preserves identity and reads back before any resend',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(app,/readSubmission/);
  assert.match(app,/唔會自動重送/);
  assert.match(app,/未有重新提交/);
  assert.match(app,/submissionId/);
  const persistence=fs.readFileSync(path.join(root,'persistence.ts'),'utf8');
  assert.match(persistence,/idempotencyKey/);
});

test('Business Day remains record-only and non-blocking',()=>{
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(types,/recordOnly:true/);
  assert.match(app,/永遠唔會阻止落單、付款或者本機提交/);
});


test('production source contains no static fixture module or fake product truth',()=>{
  assert.equal(fs.existsSync(path.join(root,'fixtures.ts')),false);
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\$6,420|Keeta provider readback|紫米飯團 ×2|DEMO/);
});

test('quote and mutation operations can only cross the typed injected port',()=>{
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  assert.match(types,/quoteCart\?/);
  assert.match(types,/submitOrder\?/);
  assert.match(types,/setSellability\?/);
  assert.match(types,/createDineSession\?/);
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(app,/port\?\.quoteCart/);
  assert.match(app,/port\?\.submitOrder/);
  assert.doesNotMatch(app,/finalUnitPriceMinor\s*[*+\-\/]/);
});
