import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(srcRoot,'capabilities.json'),'utf8'));
const sourceFiles=fs.readdirSync(srcRoot).filter(name=>/\.(ts|tsx|js|jsx)$/.test(name));
const source=sourceFiles.map(name=>fs.readFileSync(path.join(srcRoot,name),'utf8')).join('\n');

test('customer capability registry remains complete with commands disconnected',()=>{
  assert.equal(registry.length,58);
  assert.equal(new Set(registry.map(item=>item.id)).size,58);
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  const reads=registry.filter(item=>item.kind!=='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  assert.deepEqual([...new Set(commands.map(item=>item.status))],['NOT_WIRED']);
  assert.deepEqual([...new Set(reads.map(item=>item.status))],['PRODUCT_READY_NOT_CONNECTED']);
});

test('customer production source has zero live network or canonical writer',()=>{
  const forbidden=[
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\baxios\b/,
    /from\s+['"][^'"]*v2local/,
    /from\s+['"][^'"]*v2smt/,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./i,
    /\bD1Database\b/,
    /\bindexedDB\b/,
    /new\s+Worker\s*\(/,
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('local persistence is durable but explicitly non-authoritative',()=>{
  const persistence=fs.readFileSync(path.join(srcRoot,'persistence.ts'),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/localStorage/);
  assert.match(persistence,/customer-order:/);
  assert.doesNotMatch(persistence,/Formal Order|Store Kernel|Pricing engine/i);
});

test('production customer app has no fixture/migration/demo truth',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\.\/fixtures/);
  assert.doesNotMatch(app,/MIGRATION_ONLY|Customer Migration|Capability Registry|fixture projection|展示：Online/);
  assert.match(app,/店舖服務尚未連接/);
  assert.match(app,/唔會用假資料代替/);
  assert.match(app,/未建立正式訂單/);
});

test('complete customer routes and lifecycle states are present',()=>{
  for(const marker of[
    '自家落單','菜單','購物籃','最後確認','訂單進度','落單狀態',
    '搜尋商品','商品詳情','最少','最多','安全提交','Submission ID',
    '等待店舖接單','未能接單','已接單','製作中','稍有延誤','可取餐',
    '取餐核對','已交收','已完成','再次下單','自家渠道暫時不可用',
    '重新確認提交結果'
  ])assert.match(source,new RegExp(marker));
});

test('typed customer runtime port is injection-only',()=>{
  const runtime=fs.readFileSync(path.join(srcRoot,'runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_CUSTOMER_PRODUCT_PORT__/);
  assert.match(types,/MFK_CUSTOMER_PORT_V1/);
  assert.match(types,/readSnapshot\(\)/);
  assert.match(types,/quoteCart\?/);
  assert.match(types,/submitOrder\?/);
  assert.match(types,/readSubmission\?/);
  assert.match(types,/buildReorderCart\?/);
  assert.doesNotMatch(runtime,/fetch|WebSocket|XMLHttpRequest/);
});

test('UNKNOWN preserves same submission identity and requires readback first',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const persistence=fs.readFileSync(path.join(srcRoot,'persistence.ts'),'utf8');
  assert.match(app,/readSubmission/);
  assert.match(app,/唔會自動重送/);
  assert.match(app,/未有重新提交/);
  assert.match(app,/submissionId/);
  assert.match(persistence,/idempotencyKey/);
});

test('quote and order creation cannot be implemented locally',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/port\?\.quoteCart/);
  assert.match(app,/port\?\.submitOrder/);
  assert.doesNotMatch(app,/finalUnitPriceMinor\s*[*+\-\/]/);
  assert.doesNotMatch(app,/正式訂單已建立/);
});

test('production fixture file has been removed',()=>{
  assert.equal(fs.existsSync(path.join(srcRoot,'fixtures.ts')),false);
});
