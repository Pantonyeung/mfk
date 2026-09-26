import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(srcRoot,'capabilities.json'),'utf8'));
const source=fs.readdirSync(srcRoot)
  .filter(name=>/\.(ts|tsx|js|jsx)$/.test(name))
  .map(name=>fs.readFileSync(path.join(srcRoot,name),'utf8'))
  .join('\n');

function loadPureTsModule(filename){
  const input=fs.readFileSync(path.join(srcRoot,filename),'utf8');
  const output=ts.transpileModule(input,{
    compilerOptions:{
      module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module={exports:{}};
  new Function('module','exports',output)(module,module.exports);
  return module.exports;
}

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
  assert.match(app,/OFFLINE_READONLY|離線唯讀/);
  assert.match(app,/唔會顯示假 KPI|唔會用假資料代替/);
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


test('Stage01 Today implements live orders and dine-in outstanding without fake sales',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const vm=fs.readFileSync(path.join(srcRoot,'today-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'today-components.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage01-api-mapping.ts'),'utf8');

  assert.match(app,/TodayLiveOrdersCard/);
  assert.match(app,/DineInOpenChecksCard/);
  assert.match(types,/OwnerLiveOrdersSummary/);
  assert.match(types,/OwnerDineInSummary/);
  assert.match(types,/includedInEffectiveSales:false/);
  assert.match(vm,/liveOrders:snapshot\?\.liveOrders\?\?null/);
  assert.match(vm,/dineIn:snapshot\?\.dineIn\?\?null/);
  assert.match(components,/未計入有效營業額/);
  assert.match(components,/總額、已收款、未收款分開/);
  assert.match(mapping,/OA-TOD-001/);
  assert.match(mapping,/liveOrders/);
  assert.match(mapping,/dineInOpenChecks/);
});

test('Stage01 does not introduce non-AI decorative icon assets or product photos',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/AI_ASSET_PENDING/);
  assert.doesNotMatch(app,/glyph="◆"|glyph="▤"|glyph="•••"/);
  assert.doesNotMatch(app,/productImage|product-photo|stock-photo/i);
});

test('Stage01 commander corrections satisfy OA-TOD-001 acceptance contract',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const vm=fs.readFileSync(path.join(srcRoot,'today-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'today-components.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage01-api-mapping.ts'),'utf8');

  // 1 Header: store / business day / operating status / freshness.
  assert.match(types,/operatingStatus:string/);
  assert.match(components,/門店/);
  assert.match(components,/Business Day/);
  assert.match(components,/營業狀態/);
  assert.match(components,/Freshness/);
  assert.doesNotMatch(vm,/operatingStatus:.*connection/i);

  // 2 Live orders always open active scope, with all summary fields.
  assert.match(app,/openOrdersScope\('ACTIVE'\)/);
  for(const field of['displayCode','source','amountLabel','fulfillmentLabel','elapsedLabel','promisedTimeLabel','exceptionBadge']){
    assert.match(types,new RegExp(field));
    assert.match(components,new RegExp(field));
  }

  // 3 Dine-in CTA always opens dine-in + open-payment scope.
  assert.match(app,/openOrdersScope\('DINE_IN_OPEN'\)/);
  assert.match(app,/fulfillmentMode==='DINE_IN'/);
  assert.match(app,/paymentState==='OPEN'.*paymentState==='PARTIAL'/);

  // 4 Open Check renders Total / Paid / Outstanding + payment state.
  assert.match(components,/currentOrderTotalLabel/);
  assert.match(components,/confirmedPaidLabel/);
  assert.match(components,/outstandingLabel/);
  assert.match(components,/paymentState/);
  assert.match(components,/未計入有效營業額/);

  // 5 Action summary count / top severity / oldest unresolved.
  assert.match(vm,/openCount/);
  assert.match(vm,/topSeverity/);
  assert.match(vm,/oldestUnresolved/);
  assert.match(components,/最高優先/);
  assert.match(components,/最舊未處理/);
  assert.match(components,/唔係 SMT Pending Order Queue/);

  // 6 Explicit Health Summary, no provider truth guessing.
  for(const health of['INTERNET','KEETA','OWN_PLATFORM','SMT','PRINTER'])assert.match(mapping,new RegExp(health));
  assert.match(vm,/row\.kind===kind/);
  assert.doesNotMatch(vm,/label\.includes|name\.includes/);
  assert.match(components,/Health 同 Availability 分開/);

  // 7 Staff summary is projection-driven, including scheduled count.
  for(const field of['staffNow','scheduledStaffCount','onBreakStaffCount','abnormalStaffCount'])assert.match(types,new RegExp(field));
  assert.doesNotMatch(app,/presence\.includes\('休息'\)|presence\.includes\('異常'\)/);

  // 8 Explicit Top Product + Current Hour Trend contract.
  assert.match(types,/OwnerTodayInsight/);
  assert.match(components,/Top Product/);
  assert.match(components,/Current Hour Trend/);
  assert.match(components,/UNAVAILABLE/);
  assert.doesNotMatch(app,/reports\.slice\(0,3\)/);

  // 9 Nine global states can be represented.
  for(const state of['LOADING','EMPTY','FRESH','STALE','PARTIAL','OFFLINE_READONLY','PERMISSION_DENIED','ERROR','UNKNOWN']){
    assert.match(types,new RegExp(state));
    assert.match(mapping,new RegExp(state));
  }

  // 10 Human-safe normal UI; raw errors/UUIDs are not rendered.
  assert.doesNotMatch(app,/reason instanceof Error\?reason\.message|error\.message/);
  assert.doesNotMatch(app,/<(?:span|strong|small|p|h\\d)[^>]*>\\{order\\.orderId\\}/);

  // 14 Authority boundary remains unchanged.
  assert.match(mapping,/No direct network or second Order \/ Pricing \/ Payment \/ Print \/ Auth \/ Sync authority/);
});

test('Stage01 offline mode disables remote mutation',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/connection==='OFFLINE_READONLY'/);
  assert.match(app,/離線唯讀：遠端操作已停用/);
});


test('Stage01 uses the exact Owner-approved canonical logo asset in the top bar',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const logoPath=path.resolve(testDir,'../public/brand/morefun-logo-canonical.png');
  assert.doesNotMatch(app,/className="brand-mark">磨</);
  assert.match(app,/src="\/brand\/morefun-logo-canonical\.png"/);
  assert.match(app,/className="brand-logo"/);
  assert.equal(fs.existsSync(logoPath),true);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex');
  assert.equal(digest,'9932546497935faaaf9c8d75c5a193d5ce9e3d70c0e16bd9d9f987777790d95f');
  assert.doesNotMatch(app,/mascot|character|blue-haired|purple-haired|boy-ip|girl-ip/i);
});


test('Stage02 Action Queue is a unified actionable projection, not SMT pending orders',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');
  const vm=fs.readFileSync(path.join(srcRoot,'stage02-view-model.ts'),'utf8');
  const selector=fs.readFileSync(path.join(srcRoot,'stage02-open-actions.ts'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage02-api-mapping.ts'),'utf8');

  assert.match(app,/ActionQueuePage/);
  assert.doesNotMatch(app,/function QueuePage\(/);
  assert.doesNotMatch(app,/function ActionCard\(/);

  for(const marker of[
    '影響目標','責任域','確定性','安全下一步','已持續',
    'Dismissed ≠ Resolved','Readback / Proof','相關處理紀錄'
  ])assert.match(components,new RegExp(marker));

  assert.match(mapping,/OPEN_ACTIONABLE_ONLY/);
  assert.match(mapping,/SMT_PENDING_ORDER_QUEUE/);
  assert.match(mapping,/Dismissed != Resolved/);
  assert.match(mapping,/RESOLVED_OR_UNKNOWN/);

  assert.match(selector,/item\.state!==\'RESOLVED\'/);
  assert.match(vm,/selectOpenActions/);
  assert.match(vm,/severityRank/);
  assert.doesNotMatch(components,/\{item\.correlationId\}/);
});

test('Stage02 bounded action continues through existing Owner runtime only',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage02-api-mapping.ts'),'utf8');

  assert.match(components,/onCommand\(item\.actionLabel!/);
  assert.match(app,/requestBoundedAction/);
  assert.match(mapping,/No direct network transport is added/);
  assert.match(mapping,/No Order \/ Pricing \/ Payment \/ Print \/ Auth \/ Sync authority changes/);
});

test('Stage02 visual convergence matches approved warm ivory navy Owner direction',()=>{
  const css=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');

  assert.match(css,/--mf-navy:#173b72/);
  assert.match(css,/--mf-ivory:#f6f3ed/);
  assert.match(css,/--mf-purple:#735ab1/);
  assert.match(css,/body\{[\s\S]*background:var\(--mf-ivory\)/);
  assert.match(css,/\.bottom-nav button\.active\{[\s\S]*var\(--mf-blue-soft\)/);
  assert.match(css,/\.action-queue-card/);
  assert.match(css,/\.action-detail-drawer/);

  assert.match(app,/morefun-logo-canonical\.png/);
  assert.doesNotMatch(app,/>◆</);
  assert.match(app,/AI_ASSET_PENDING/);
});

test('Stage02 does not add product imagery or large mascot to normal operational UI',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');
  const source=app+'\n'+components;
  assert.doesNotMatch(source,/productImage|product-photo|stock-photo/i);
  assert.doesNotMatch(source,/mascot|blue-haired|purple-haired|boy-ip|girl-ip/i);
});


test('Stage02 shared openActions selector excludes RESOLVED everywhere and dedupes explicit incidents',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const todayVm=fs.readFileSync(path.join(srcRoot,'today-view-model.ts'),'utf8');
  const stageVm=fs.readFileSync(path.join(srcRoot,'stage02-view-model.ts'),'utf8');
  const selectorSource=fs.readFileSync(path.join(srcRoot,'stage02-open-actions.ts'),'utf8');
  const {selectOpenActions}=loadPureTsModule('stage02-open-actions.ts');

  assert.match(selectorSource,/actions\.filter\(item=>item\.state!==\'RESOLVED\'\)/);
  assert.match(todayVm,/selectOpenActions\(snapshot\?\.actions\?\?\[\]\)/);
  assert.match(stageVm,/selectOpenActions\(snapshot\?\.actions\?\?\[\]\)/);
  assert.match(app,/const openActions=useMemo\(\(\)=>selectOpenActions\(snapshot\?\.actions\?\?\[\]\)/);
  assert.match(app,/items=\{openActions\}/);
  assert.match(app,/badge=\{openActions\.length\?String\(openActions\.length\):undefined\}/);
  assert.doesNotMatch(todayVm,/openCount:snapshot\?\.actions\.length/);

  const base={
    severity:'ATTENTION',
    domain:'TEST',
    title:'Incident',
    detail:'detail',
    target:'same-target',
    certainty:'CONFIRMED',
    observedAt:'2026-09-26T12:00:00Z',
  };

  const rows=selectOpenActions([
    {...base,actionId:'resolved',correlationId:'resolved-c',state:'RESOLVED'},
    {...base,actionId:'open-a-old',correlationId:'same-c',state:'OPEN',observedAt:'2026-09-26T12:01:00Z'},
    {...base,actionId:'open-a-new',correlationId:'same-c',state:'OPEN',observedAt:'2026-09-26T12:02:00Z'},
    {...base,actionId:'open-b',correlationId:'other-c',state:'OPEN',observedAt:'2026-09-26T12:03:00Z'},
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows.some(row=>row.actionId==='resolved'),false);
  assert.equal(rows.some(row=>row.actionId==='open-a-new'),true);
  assert.equal(rows.some(row=>row.actionId==='open-a-old'),false);

  const sameTargetDifferentIncidents=selectOpenActions([
    {...base,actionId:'a',correlationId:'A',state:'OPEN'},
    {...base,actionId:'b',correlationId:'B',state:'OPEN'},
  ]);
  assert.equal(sameTargetDifferentIncidents.length,2);
});

test('Stage02 Today top severity and oldest unresolved derive only from shared open actions',()=>{
  const todayVm=fs.readFileSync(path.join(srcRoot,'today-view-model.ts'),'utf8');
  assert.match(todayVm,/const actions=\[\.\.\.selectOpenActions/);
  assert.match(todayVm,/const topSeverity=actions\.sort/);
  assert.match(todayVm,/oldestUnresolved=\[\.\.\.actions\]\s*\.sort/);
  assert.match(todayVm,/openCount:actions\.length/);
});

test('Stage02 Action history uses exact incident linkage and never target-only fallback',()=>{
  const selectorSource=fs.readFileSync(path.join(srcRoot,'stage02-open-actions.ts'),'utf8');
  const stageVm=fs.readFileSync(path.join(srcRoot,'stage02-view-model.ts'),'utf8');
  const {selectActionHistory}=loadPureTsModule('stage02-open-actions.ts');

  assert.match(selectorSource,/if\(action\.correlationId\)return record\.correlationId===action\.correlationId/);
  assert.match(selectorSource,/if\(action\.incidentId\)return record\.incidentId===action\.incidentId/);
  assert.match(selectorSource,/record\.linkedActionId===action\.actionId/);
  assert.doesNotMatch(selectorSource,/record\.target===action\.target/);
  assert.match(stageVm,/selectActionHistory\(row\.action,activity\)/);

  const actionA={actionId:'action-a',correlationId:'A',severity:'ATTENTION',domain:'TEST',title:'A',detail:'',target:'shared-target',certainty:'CONFIRMED',observedAt:'2026-09-26T12:00:00Z'};
  const history=selectActionHistory(actionA,[
    {activityId:'ha',title:'A history',actor:'owner',correlationId:'A',target:'shared-target',result:'OK',observedAt:'2026-09-26T12:01:00Z'},
    {activityId:'hb',title:'B history',actor:'owner',correlationId:'B',target:'shared-target',result:'OK',observedAt:'2026-09-26T12:02:00Z'},
    {activityId:'ht',title:'Target only',actor:'owner',target:'shared-target',result:'OK',observedAt:'2026-09-26T12:03:00Z'},
  ]);
  assert.deepEqual(history.map(row=>row.activityId),['ha']);

  const actionB={actionId:'action-b',incidentId:'INC-B',severity:'INFO',domain:'TEST',title:'B',detail:'',target:'shared-target',certainty:'CONFIRMED',observedAt:'2026-09-26T12:00:00Z'};
  const historyB=selectActionHistory(actionB,[
    {activityId:'bi',title:'B incident',actor:'owner',incidentId:'INC-B',target:'shared-target',result:'OK',observedAt:'2026-09-26T12:01:00Z'},
    {activityId:'bt',title:'target only',actor:'owner',target:'shared-target',result:'OK',observedAt:'2026-09-26T12:02:00Z'},
  ]);
  assert.deepEqual(historyB.map(row=>row.activityId),['bi']);
});

test('Stage02 command flow exposes Pending, locks duplicates, and UNKNOWN only permits recheck',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');

  const pendingIndex=app.indexOf("state:'PENDING'");
  const requestIndex=app.indexOf('await port.requestBoundedAction');
  assert.ok(pendingIndex>=0&&requestIndex>pendingIndex);

  assert.match(components,/disabled=\{commandLocked\}/);
  assert.match(components,/commandLocked=flight\?\.state===\'PENDING\'\|\|flight\?\.state===\'UNKNOWN\'/);
  assert.match(components,/正在提交／等待讀回/);
  assert.match(components,/狀態未明 — 禁止重送/);
  assert.match(components,/重新確認讀回/);
  assert.match(app,/禁止重複提交/);
  assert.match(app,/禁止 blind resend/);
  assert.doesNotMatch(app,/setCommandFlight\([^\n]*RESOLVED/);
  assert.doesNotMatch(app,/result\.message/);
  assert.match(components,/只有 canonical readback \/ proof 先可以真正移出 Queue/);
});

test('Stage02 primary touch targets are at least 44px and responsive gates cover target widths',()=>{
  const css=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');

  assert.match(css,/\.action-filter-row button\{min-height:44px\}/);
  assert.match(css,/\.drawer-head>button,\.sheet header>button\{[\s\S]*min-height:44px/);
  assert.match(css,/\.primary,\.action-primary,\.secondary-action\{min-height:44px\}/);

  for(const width of[360,375,390,430,520]){
    assert.match(css,new RegExp('@media\\(max-width:'+width+'px\\)'));
  }
});

test('Stage02 normal UI does not render raw correlation identity or engineering result payloads',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');

  assert.doesNotMatch(components,/\{(?:item|record)\.correlationId\}/);
  assert.doesNotMatch(components,/\{(?:item|record)\.incidentId\}/);
  assert.doesNotMatch(app,/result\.message/);
  assert.doesNotMatch(app,/reason instanceof Error\?reason\.message|error\.message/);
});
