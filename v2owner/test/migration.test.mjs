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

test('owner capability registry remains complete with commands disconnected',()=>{
  assert.equal(registry.length,110);
  assert.equal(new Set(registry.map(item=>item.CAP_ID)).size,110);
  const commands=registry.filter(item=>item.KIND==='COMMAND_SHAPE');
  const reads=registry.filter(item=>item.KIND!=='COMMAND_SHAPE');
  assert.equal(commands.length,18);
  assert.deepEqual([...new Set(commands.map(item=>item.STATUS))],['NOT_WIRED']);
  assert.deepEqual([...new Set(reads.map(item=>item.STATUS))],['PRODUCT_READY_NOT_CONNECTED']);
});

test('owner production source has zero live network or transaction authority',()=>{
  const forbidden=[
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\baxios\b/,
    /\/api\//,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./i,
    /physicalPrinter\s*\./i,
    /cashDrawer\s*\./i,
    /\bD1Database\b/,
    /\bindexedDB\b/,
    /new\s+Worker\s*\(/,
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('local Owner workspace is durable and explicitly non-authoritative',()=>{
  const persistence=fs.readFileSync(path.join(srcRoot,'persistence.ts'),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/localStorage/);
  assert.match(persistence,/managerNote/);
  assert.match(persistence,/handoffNote/);
  assert.match(persistence,/checklist/);
  assert.doesNotMatch(persistence,/Formal Order|Store Kernel|Pricing engine|Payment/);
});

test('production Owner app has no fixture or migration operator truth',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\.\/fixtures/);
  assert.doesNotMatch(app,/CAPABILITY_UPGRADE_ONLY|Migration|fixture 截至|MFK Owner|Capability Registry/);
  assert.match(app,/老闆資料服務尚未連接/);
  assert.match(app,/唔會用假資料代替/);
});

test('complete Owner product surfaces remain present',()=>{
  for(const marker of[
    '而家間舖點','Action Queue','訂單監察','渠道健康','商品供應','員工','設備／打印',
    '報表','客戶','推廣','平台結算','現金','庫存','通知','經理日誌','活動紀錄','Admin',
    'Requester','Approver','Readback','OFFLINE','STALE','UNKNOWN','PARTIAL'
  ])assert.match(source,new RegExp(marker));
});

test('typed Owner runtime port is injection-only',()=>{
  const runtime=fs.readFileSync(path.join(srcRoot,'runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_OWNER_PRODUCT_PORT__/);
  assert.match(types,/MFK_OWNER_PORT_V1/);
  assert.match(types,/readSnapshot\(\)/);
  assert.match(types,/requestBoundedAction\?/);
  assert.match(types,/requestAdminDeepLink\?/);
  assert.doesNotMatch(runtime,/fetch|WebSocket|XMLHttpRequest/);
});

test('bounded actions require runtime and target readback semantics',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/requestBoundedAction/);
  assert.match(app,/冇改變任何正式狀態/);
  assert.match(app,/結果未明/);
  assert.match(app,/正式狀態必須等目標系統讀回/);
});

test('manager log and checklist are local-only product workflows',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/本機私人草稿/);
  assert.match(app,/唔係共享營運真相/);
  assert.match(app,/經理筆記/);
  assert.match(app,/交接草稿/);
});

test('production fixture file has been removed',()=>{
  assert.equal(fs.existsSync(path.join(srcRoot,'fixtures.ts')),false);
});


test('final Owner Today UI contract includes live orders and dine-in outstanding boundary',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'ui-data-mapping.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'today-components.tsx'),'utf8');
  assert.match(app,/TodayLiveOrdersCard/);
  assert.match(app,/DineInOpenChecksCard/);
  assert.match(types,/OwnerLiveOrdersSummary/);
  assert.match(types,/OwnerDineInSummary/);
  assert.match(types,/includedInEffectiveSales:false/);
  assert.match(components,/未計入有效營業額/);
  assert.match(components,/Order Value、已收款、未收款分開/);
  assert.match(mapping,/liveOrders/);
  assert.match(mapping,/dineInOpenChecks/);
  assert.doesNotMatch(mapping,/fetch|WebSocket|XMLHttpRequest/);
});
