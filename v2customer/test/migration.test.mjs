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

test('customer capability registry marks only the authorized submit bridge as source-wired',()=>{
  assert.equal(registry.length,58);
  assert.equal(new Set(registry.map(item=>item.id)).size,58);
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  const reads=registry.filter(item=>item.kind!=='COMMAND_SHAPE');
  const submit=commands.find(item=>item.id==='SUBMIT_ORDER_COMMAND');
  assert.equal(submit?.status,'SOURCE_WIRED_NOT_DEPLOYED');
  assert.deepEqual([...new Set(commands.filter(item=>item.id!=='SUBMIT_ORDER_COMMAND').map(item=>item.status))],['NOT_WIRED']);
  assert.deepEqual([...new Set(reads.map(item=>item.status))],['PRODUCT_READY_NOT_CONNECTED']);
});

test('customer production network is isolated to the authorized cloud runtime and has no canonical writer',()=>{
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const nonCloud=sourceFiles
    .filter(name=>name!=='cloud-runtime.ts')
    .map(name=>fs.readFileSync(path.join(srcRoot,name),'utf8'))
    .join('\n');
  assert.match(cloud,/https:\/\/admin\.morefunos\.com/);
  assert.match(cloud,/\/api\/customer\//);
  assert.match(cloud,/\bfetch\s*\(/);
  assert.doesNotMatch(cloud,/\bWebSocket\b|\bXMLHttpRequest\b|\baxios\b|\bsetInterval\s*\(|new\s+Worker\s*\(/);
  assert.doesNotMatch(nonCloud,/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\baxios\b/);
  for(const pattern of[
    /from\s+['"][^'"]*v2local/,
    /from\s+['"][^'"]*v2smt/,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./i,
    /\bD1Database\b/,
    /\bindexedDB\b/,
    /new\s+Worker\s*\(/
  ])assert.equal(pattern.test(source),false,String(pattern));
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

test('typed customer runtime port keeps injection override and falls back only to the authorized cloud bridge',()=>{
  const runtime=fs.readFileSync(path.join(srcRoot,'runtime.ts'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_CUSTOMER_PRODUCT_PORT__/);
  assert.match(runtime,/createCloudCustomerRuntimePort/);
  assert.match(cloud,/MFK_CUSTOMER_PORT_V1/);
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

test('published menu prices are calculated locally while formal order still belongs to SMT',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const quote=fs.readFileSync(path.join(srcRoot,'local-quote.ts'),'utf8');
  assert.match(app,/quotePublishedCart\(cart,snapshot\?\.menu\)/);
  assert.match(app,/port\?\.submitOrder/);
  assert.match(quote,/publishedUnitPriceMinor/);
  assert.match(quote,/PUBLISHED-MENU/);
  assert.doesNotMatch(app,/正式訂單已建立/);
});

test('production fixture file has been removed',()=>{
  assert.equal(fs.existsSync(path.join(srcRoot,'fixtures.ts')),false);
});


test('customer checks SMT availability a bounded number of times before WhatsApp fallback',()=>{
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const attempts=Number(cloud.match(/BACKEND_PROBE_ATTEMPTS=(\d+)/)?.[1]);
  assert.equal(attempts,3);
  assert.match(cloud,/\/api\/customer\/channel-health/);
  assert.match(cloud,/state:'NOT_CONNECTED'/);
  assert.match(app,/轉用 WhatsApp/);
  assert.match(app,/buildWhatsAppFallbackUrl/);
});


test('payment evidence is transient and cannot reappear in a later checkout draft',()=>{
  const persistence=fs.readFileSync(path.join(srcRoot,'persistence.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(persistence,/persistedCheckout/);
  assert.doesNotMatch(persistence,/checkout\.paymentEvidence&&typeof checkout\.paymentEvidence/);
  assert.match(app,/withoutPaymentEvidence/);
  assert.match(app,/付款截圖需要重新提供/);
});

test('backend preflight is wall-clock bounded and shows visible progress before WhatsApp fallback',()=>{
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const views=fs.readFileSync(path.join(srcRoot,'components/customer-views.tsx'),'utf8');
  assert.match(cloud,/BACKEND_PROBE_TIMEOUT_MS=1600/);
  assert.match(cloud,/AbortController/);
  assert.match(cloud,/onAttempt\?\.\(attempt,BACKEND_PROBE_ATTEMPTS\)/);
  assert.match(app,/setSubmitProbe/);
  assert.match(views,/3 次有限連線檢查/);
  assert.match(views,/轉用 WhatsApp/);
  assert.match(views,/正在檢查店舖連線/);
});


test('checkout submit is fail-closed before click and guarded by a synchronous mutex',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const views=fs.readFileSync(path.join(srcRoot,'components/customer-views.tsx'),'utf8');
  assert.match(app,/submitLockRef=useRef\(false\)/);
  assert.match(app,/if\(submitLockRef\.current\|\|submitting\)return/);
  assert.match(app,/submitLockRef\.current=true/);
  assert.match(app,/submitLockRef\.current=false/);
  assert.match(app,/if\(!selectedPaymentChannel\.qrImageUrl\)return '呢個電子支付方式未有付款 QR/);
  assert.match(app,/Boolean\(submitBlockReason\)\?'disabled'/);
  assert.match(views,/submitBlockReason\?<section className="safe-submit danger"/);
  assert.match(views,/未完成提交條件/);
});
