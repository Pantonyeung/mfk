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
  assert.ok(reads.every(item=>['PRODUCT_READY_NOT_CONNECTED','PRODUCT_READY_PARTIAL_CONNECTED','CONNECTED_READ'].includes(item.STATUS)));
});

test('owner production source has bounded read networking and zero transaction authority',()=>{
  const forbidden=[
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./i,
    /physicalPrinter\s*\./i,
    /cashDrawer\s*\./i,
    /\bD1Database\b/,
    /\bindexedDB\b/,
    /new\s+Worker\s*\(/
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  assert.match(cloud,/\/api\/owner\/snapshot/);
  assert.match(cloud,/x-mfk-owner-session/);
  assert.doesNotMatch(cloud,/x-mfk-admin-publish-key|\/api\/projection\/orders/);
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
  assert.match(app,/唔會顯示假 KPI|唔會用假資料代替|唔會顯示推算數字/);
});

test('complete Owner product surfaces remain present',()=>{
  for(const marker of[
    '而家間舖點','待處理事項','訂單監察','渠道健康','商品供應','員工','設備／打印',
    '報表','客戶','推廣','平台結算','現金','庫存','通知','經理日誌','活動紀錄','Admin',
    '操作人','批核人','狀態未明','離線唯讀','資料稍舊','部分資料'
  ])assert.match(source,new RegExp(marker));
});

test('typed Owner runtime keeps injection override and adds first-party authenticated read fallback',()=>{
  const runtime=fs.readFileSync(path.join(srcRoot,'runtime.ts'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_OWNER_PRODUCT_PORT__/);
  assert.match(runtime,/createCloudOwnerRuntimePort/);
  assert.match(types,/MFK_OWNER_PORT_V1/);
  assert.match(types,/readSnapshot\(\)/);
  assert.match(types,/readOwnerSession\?/);
  assert.match(types,/loginOwner\?/);
  assert.match(cloud,/MFK_OWNER_LOGIN_V1/);
  assert.match(cloud,/PBKDF2/);
  assert.match(cloud,/HMAC/);
  assert.doesNotMatch(cloud,/x-mfk-admin-publish-key/);
});

test('bounded actions require runtime and target readback semantics',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/requestBoundedAction/);
  assert.match(app,/正式狀態沒有改變/);
  assert.match(app,/操作結果未能確認|結果未能確認/);
  assert.match(app,/完成後會再次確認最新狀態/);
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
  const orderVm=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');

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
  const orderVm=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');

  // 1 Header: store / business day / operating status / freshness.
  assert.match(types,/operatingStatus:string/);
  assert.match(components,/門店/);
  assert.match(components,/營業日/);
  assert.match(components,/營業狀態/);
  assert.match(components,/資料更新/);
  assert.doesNotMatch(vm,/operatingStatus:.*connection/i);

  // 2 Live orders always open active scope, with all summary fields.
  assert.match(app,/openOrdersScope\('ACTIVE'\)/);
  for(const field of['displayCode','source','amountLabel','fulfillmentLabel','elapsedLabel','promisedTimeLabel','exceptionBadge']){
    assert.match(types,new RegExp(field));
    assert.match(components,new RegExp(field));
  }

  // 3 Dine-in CTA always opens dine-in + open-payment scope.
  assert.match(app,/openOrdersScope\('DINE_IN_OPEN'\)/);
  assert.match(orderVm,/fulfillmentMode==='DINE_IN'/);
  assert.match(orderVm,/paymentState==='OPEN'.*paymentState==='PARTIAL'/);

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
  assert.match(components,/只顯示真係需要你介入嘅營運事項/);

  // 6 Explicit Health Summary, no provider truth guessing.
  for(const health of['INTERNET','KEETA','OWN_PLATFORM','SMT','PRINTER'])assert.match(mapping,new RegExp(health));
  assert.match(vm,/row\.kind===kind/);
  assert.doesNotMatch(vm,/label\.includes|name\.includes/);
  assert.match(components,/各渠道同設備分開顯示/);

  // 7 Staff summary is projection-driven, including scheduled count.
  for(const field of['staffNow','scheduledStaffCount','onBreakStaffCount','abnormalStaffCount'])assert.match(types,new RegExp(field));
  assert.doesNotMatch(app,/presence\.includes\('休息'\)|presence\.includes\('異常'\)/);

  // 8 Explicit Top Product + Current Hour Trend contract.
  assert.match(types,/OwnerTodayInsight/);
  assert.match(components,/熱賣商品/);
  assert.match(components,/目前時段/);
  assert.match(components,/未有資料/);
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
    '影響目標','目前狀態','安全下一步','已持續',
    '處理紀錄會保留','處理結果','相關處理紀錄'
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

test('Stage02 visual convergence matches FINAL blue white Owner direction',()=>{
  const css=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');

  assert.match(css,/OWNER FINAL VISUAL SYSTEM P0/);
  assert.match(css,/--owner-final-navy:#103f78/);
  assert.match(css,/--owner-final-bg:#f5f8fc/);
  assert.match(css,/--owner-final-surface:#ffffff/);
  assert.match(css,/\.bottom-nav button::before/);
  assert.match(css,/\.action-queue-card/);
  assert.match(css,/\.action-detail-drawer/);

  assert.match(app,/morefun-logo-canonical\.png/);
  assert.doesNotMatch(app,/>◆</);
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
  assert.match(todayVm,/const topSeverity=\[\.\.\.actions\]\.sort/);
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
  assert.match(components,/canonicalUnknown=row\.state===\'UNKNOWN\'/);
  assert.match(components,/commandLocked=canonicalUnknown\|\|flight\?\.state===\'PENDING\'\|\|flight\?\.state===\'UNKNOWN\'/);
  assert.match(components,/正在處理/);
  assert.match(components,/結果待確認/);
  assert.match(components,/重新確認狀態/);
  assert.match(app,/暫時唔好重複提交/);
  assert.match(app,/暫時唔好再次提交/);
  assert.doesNotMatch(app,/setCommandFlight\([^\n]*RESOLVED/);
  assert.doesNotMatch(app,/result\.message/);
  assert.match(components,/未確認完成嘅事項會繼續留喺待處理清單/);
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


test('Stage02 canonical UNKNOWN locks action even with no commandFlight and exposes readback-only UX',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');
  assert.match(components,/const canonicalUnknown=row\.state===\'UNKNOWN\'/);
  assert.match(components,/const commandLocked=canonicalUnknown\|\|flight\?\.state===\'PENDING\'\|\|flight\?\.state===\'UNKNOWN\'/);
  assert.match(components,/disabled=\{commandLocked\}/);
  assert.match(components,/canonicalUnknown\?\'結果待確認\'/);
  assert.match(components,/重新確認狀態/);
  assert.match(components,/最新狀態仍未能確認；請先重新檢查/);
});

test('Stage02 canonical UNKNOWN cannot reach requestBoundedAction',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const requestGuard=app.indexOf("if(actionId&&isCanonicalActionUnknown(snapshot?.actions??[],actionId))");
  const confirmation=app.indexOf("setConfirmation({label,target");
  assert.ok(requestGuard>=0&&confirmation>requestGuard);

  const executeGuard=app.indexOf("if(value.actionId&&isCanonicalActionUnknown(snapshot?.actions??[],value.actionId))");
  const requestCall=app.indexOf("await port.requestBoundedAction");
  assert.ok(executeGuard>=0&&requestCall>executeGuard);
  assert.match(app,/處理結果仍未確認；請先重新檢查最新狀態/);
});

test('Stage02 recheck success keeps UNKNOWN locked until canonical projection leaves UNKNOWN',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const selectorSource=fs.readFileSync(path.join(srcRoot,'stage02-open-actions.ts'),'utf8');
  const {isCanonicalActionUnknown}=loadPureTsModule('stage02-open-actions.ts');

  const unknownAction={
    actionId:'unknown-action',
    severity:'URGENT',
    domain:'TEST',
    title:'Unknown',
    detail:'',
    target:'target',
    certainty:'UNKNOWN',
    state:'UNKNOWN',
    observedAt:'2026-09-27T00:00:00Z',
  };
  const openAction={...unknownAction,state:'OPEN',certainty:'CONFIRMED'};

  assert.equal(isCanonicalActionUnknown([unknownAction],'unknown-action'),true);
  assert.equal(isCanonicalActionUnknown([openAction],'unknown-action'),false);
  assert.match(selectorSource,/action\.actionId===actionId&&action\.state===\'UNKNOWN\'/);

  const recheckStart=app.indexOf('const recheckAction=async(actionId:string)=>');
  const recheckEnd=app.indexOf('const connectionLabel=',recheckStart);
  const recheck=app.slice(recheckStart,recheckEnd);
  const canonicalCheck=recheck.indexOf('isCanonicalActionUnknown(readback.actions,actionId)');
  const unlock=recheck.indexOf('setCommandFlight(null)');
  assert.ok(canonicalCheck>=0&&unlock>canonicalCheck);
  assert.match(recheck,/最新狀態仍未能確認；暫時保持鎖定/);
});

test('Stage02 selected drawer follows fresh canonical row state after readback',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage02-action-queue.tsx'),'utf8');
  assert.match(components,/selectedActionId/);
  assert.match(components,/vm\.rows\.find\(row=>row\.action\.actionId===selectedActionId\)/);
  assert.doesNotMatch(components,/useState<OwnerActionQueueRowViewModel\|null>/);
});


test('Stage03 Order Oversight replaces legacy order page with read-only OA-ORD-001',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage03-api-mapping.ts'),'utf8');

  assert.match(app,/OrderOversightPage/);
  assert.doesNotMatch(app,/function OrdersPage\(/);
  assert.doesNotMatch(app,/function OrderDrawer\(/);
  assert.match(mapping,/OA-ORD-001/);
  assert.match(mapping,/READ_OVERSIGHT_FIRST/);

  for(const forbidden of['CREATE_ORDER','EDIT_ORDER','CANCEL_ORDER','REFUND','TENDER_CORRECTION']){
    assert.match(mapping,new RegExp(forbidden));
  }
  assert.doesNotMatch(components,/>取消訂單<|>退款<|>修改付款<|>Tender Correction</);
});

test('Stage03 list search and filters use explicit order projection fields',()=>{
  const vm=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');

  for(const field of['displayCode','customerName','customerPhone','externalRef']){
    assert.match(vm,new RegExp('order\\.'+field));
  }
  for(const field of['businessDate','source','paymentState','fulfillmentState']){
    assert.match(vm,new RegExp(field));
  }
  assert.doesNotMatch(vm,/filters\.fulfillmentMode|fulfillmentModes/);
  assert.match(components,/訂單編號／客戶／電話／外部訂單編號/);
  assert.match(components,/營業日/);
  assert.match(components,/來源/);
  assert.match(components,/付款/);
  assert.match(components,/交收/);
});

test('Stage03 preserves Today active and dine-in open scopes',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const vm=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');

  assert.match(app,/openOrdersScope\('ACTIVE'\)/);
  assert.match(app,/openOrdersScope\('DINE_IN_OPEN'\)/);
  assert.match(app,/scope=\{ordersScope\}/);
  assert.match(vm,/scope==='ACTIVE'/);
  assert.match(vm,/scope==='DINE_IN_OPEN'/);
  assert.match(vm,/order\.fulfillmentMode==='DINE_IN'/);
  assert.match(vm,/order\.paymentState==='OPEN'.*order\.paymentState==='PARTIAL'/);
  assert.match(components,/由今日頁查看正在處理嘅訂單/);
  assert.match(components,/由今日頁查看堂食未結帳訂單/);
});

test('Stage03 order card renders required oversight summary without raw order identity',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');

  for(const field of[
    'displayCode','source','workflowStatusLabel','elapsedLabel','promisedTimeLabel',
    'currentEffectiveAmountLabel','currentTenderLabel','exceptionBadges'
  ]){
    assert.match(types,new RegExp(field));
    assert.match(components,new RegExp(field));
  }
  assert.match(types,/OwnerCanonicalFulfillmentState/);
  assert.match(types,/fulfillmentLabel\?:OwnerCanonicalFulfillmentState/);
  assert.match(components,/getOwnerOrderFulfillmentStateLabel\(order\)/);

  assert.doesNotMatch(components,/<(?:span|strong|small|p|h\d)[^>]*>\{order\.orderId\}/);
  assert.doesNotMatch(components,/order\.exceptions\.map|order\.timeline\.map|order\.prints\.map/);
});

test('Stage03 order detail has seven safe sections and no raw engineering payload fallback',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');

  for(const section of[
    '1｜訂單資料',
    '2｜訂單內容',
    '3｜金額與付款',
    '4｜交收進度',
    '5｜來源資料',
    '6｜打印狀況',
    '7｜處理記錄',
  ])assert.match(components,new RegExp(section.replace(/[|/]/g,'\\$&')));

  for(const label of['原始金額','調整','目前有效金額','付款方式','小票','製作單','打包單','標籤']){
    assert.match(components,new RegExp(label));
  }

  assert.match(components,/auditTrail/);
  assert.match(components,/暫時未有可顯示嘅處理記錄/);
  assert.doesNotMatch(components,/order\.timeline\.map|order\.prints\.map|order\.exceptions\.map/);
});

test('Stage03 visual and touch contract remains in approved Owner language',()=>{
  const css=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');

  assert.match(css,/\.order-scope-banner button\{[\s\S]*min-height:44px/);
  assert.match(css,/\.order-segmented button\{min-height:44px\}/);
  assert.match(css,/\.order-search input\{min-height:44px\}/);
  assert.match(css,/\.order-filter select\{[\s\S]*min-height:44px/);
  assert.match(css,/var\(--owner-final-navy\)/);
  assert.match(css,/--owner-final-surface:#ffffff/);

  for(const width of[360,375,390,430,520]){
    assert.match(css,new RegExp('@media\\(max-width:'+width+'px\\)'));
  }

  assert.doesNotMatch(components,/productImage|product-photo|stock-photo|mascot|blue-haired|purple-haired/i);
});

test('Stage03 creates no new transaction or command authority',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage03-api-mapping.ts'),'utf8');
  const combined=components+'\n'+mapping;

  assert.doesNotMatch(components,/requestBoundedAction|requestAdminDeepLink|fetch\(|WebSocket|XMLHttpRequest/);
  assert.match(mapping,/No second Order \/ Pricing \/ Payment \/ Print \/ Auth \/ Sync authority/);
  assert.match(app,/OrderOversightPage/);
  assert.doesNotMatch(combined,/createFormalOrder|allocateDisplayNumber|cashDrawer|physicalPrinter/);
});


test('Stage03 fulfillment filter/card/detail use canonical fulfillment state, never mode fallback',()=>{
  const vmSource=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage03-api-mapping.ts'),'utf8');
  const {mapCanonicalFulfillmentState,getOwnerOrderFulfillmentStateLabel}=loadPureTsModule('stage03-view-model.ts');

  assert.match(vmSource,/filters\.fulfillmentState/);
  assert.match(vmSource,/mapCanonicalFulfillmentState\(order\.fulfillmentLabel\)/);
  assert.doesNotMatch(vmSource,/filters\.fulfillmentMode|fulfillmentModes/);

  assert.equal(mapCanonicalFulfillmentState('待處理'),'未完成');
  assert.equal(mapCanonicalFulfillmentState('進行中'),'未完成');
  assert.equal(mapCanonicalFulfillmentState('可取餐'),'可取餐');
  assert.equal(mapCanonicalFulfillmentState('已完成'),'已取餐');
  assert.equal(mapCanonicalFulfillmentState('已取消'),'已取消');
  assert.equal(mapCanonicalFulfillmentState(undefined),null);

  assert.equal(getOwnerOrderFulfillmentStateLabel({fulfillmentLabel:'可取餐'}),'可取餐');
  assert.equal(getOwnerOrderFulfillmentStateLabel({fulfillmentMode:'TAKEAWAY'}),'未有交收狀態資料');

  assert.match(components,/label="交收狀態"/);
  assert.match(components,/getOwnerOrderFulfillmentStateLabel\(order\)/);
  assert.match(components,/Detail label="狀態" value=\{detail\.fulfillment\.state\}/);
  assert.match(components,/Detail label="方式" value=\{detail\.fulfillment\.mode\}/);
  assert.doesNotMatch(components,/fulfillmentLabel\?\?order\.fulfillmentMode|fulfillmentLabel\?\?order\.fulfillmentMode\?\?/);

  assert.match(mapping,/StoredOrder\.fulfillmentLabel -> v2local projection-outbox fulfillmentLabel -> Owner order projection/);
  assert.match(mapping,/DO_NOT_USE_FULFILLMENT_MODE_AS_STATE/);
  assert.match(mapping,/DO_NOT_INFER_READY_OR_PICKED_UP_FROM_LIFECYCLE/);
});

test('Stage03 scoped entry resets every conflicting filter before applying scope',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const vmSource=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');
  const {DEFAULT_OWNER_ORDER_FILTERS,buildOwnerOrderListViewModel}=loadPureTsModule('stage03-view-model.ts');

  assert.deepEqual(DEFAULT_OWNER_ORDER_FILTERS,{
    query:'',
    businessDate:'ALL',
    source:'ALL',
    segment:'ACTIVE',
    paymentState:'ALL',
    fulfillmentState:'ALL',
  });
  assert.match(components,/if\(scope==='ACTIVE'\|\|scope==='DINE_IN_OPEN'\)\{\s*setFilters\(DEFAULT_OWNER_ORDER_FILTERS\)/);
  assert.doesNotMatch(components,/setFilters\(value=>\(\{\.\.\.value,segment:'ACTIVE',query:'',source:'ALL'\}\)\)/);

  const dineInOpen={
    orderId:'o1',
    displayCode:'001',
    source:'STORE',
    lifecycle:'ACTIVE',
    businessDate:'2026-09-27',
    paymentState:'OPEN',
    fulfillmentMode:'DINE_IN',
    fulfillmentLabel:'進行中',
    itemSummary:'x',
    readback:'CONFIRMED',
    observedAt:'2026-09-27T00:00:00Z',
    prints:[],
    exceptions:[],
    timeline:[],
  };

  const resetRows=buildOwnerOrderListViewModel([dineInOpen],DEFAULT_OWNER_ORDER_FILTERS,'DINE_IN_OPEN').rows;
  assert.equal(resetRows.length,1);

  const staleSettled={...DEFAULT_OWNER_ORDER_FILTERS,paymentState:'SETTLED'};
  assert.equal(buildOwnerOrderListViewModel([dineInOpen],staleSettled,'DINE_IN_OPEN').rows.length,0);
  assert.match(components,/setFilters\(DEFAULT_OWNER_ORDER_FILTERS\);\s*setSelectedOrderId\(null\);\s*onScopeReset\(\)/);
});

test('Stage03 scoped ACTIVE cannot coexist with completed history in UI',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  assert.match(components,/scope==='DEFAULT'\?<div className="segmented order-segmented"/);
  assert.match(components,/目前訂單範圍/);
  assert.match(components,/<button className="active" disabled>進行中<\/button>/);
});

test('Stage03 fulfillment mode remains mode-only and old TAKEAWAY filter cannot survive scoped entry',()=>{
  const vmSource=fs.readFileSync(path.join(srcRoot,'stage03-view-model.ts'),'utf8');
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');

  assert.match(vmSource,/order\.fulfillmentMode==='DINE_IN'/);
  assert.match(vmSource,/formatFulfillmentMode\(order\.fulfillmentMode\)/);
  assert.doesNotMatch(vmSource,/readonly fulfillmentMode:string/);
  assert.doesNotMatch(components,/value=\{filters\.fulfillmentMode\}|fulfillmentModes/);
  assert.match(components,/fulfillmentState/);
});

test('Stage03 keeps seven detail sections, four-field search, and no mutations after correction',()=>{
  const components=fs.readFileSync(path.join(srcRoot,'stage03-order-oversight.tsx'),'utf8');
  const mapping=fs.readFileSync(path.join(srcRoot,'stage03-api-mapping.ts'),'utf8');

  assert.match(components,/訂單編號／客戶／電話／外部訂單編號/);
  for(const section of[
    '1｜訂單資料','2｜訂單內容','3｜金額與付款',
    '4｜交收進度','5｜來源資料','6｜打印狀況','7｜處理記錄'
  ])assert.match(components,new RegExp(section.replace(/[|/]/g,'\\$&')));

  assert.doesNotMatch(components,/>取消訂單<|>退款<|>修改付款<|>Tender Correction/);
  assert.doesNotMatch(components,/<(?:span|strong|small|p|h\d)[^>]*>\{order\.orderId\}/);
  assert.match(mapping,/No second Order \/ Pricing \/ Payment \/ Print \/ Auth \/ Sync authority/);
});

test('Owner auth UI is fail-closed before canonical read',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(app,/OWNER ACCESS/);
  assert.match(app,/Admin 已發布嘅 OWNER 登入編號同 PIN/);
  assert.match(app,/PERMISSION_DENIED/);
  assert.match(app,/正式資料未完成身份確認前唔會載入/);
});

test('Owner read runtime refreshes without enabling bounded mutation transport',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  assert.match(app,/visibilitychange/);
  assert.match(app,/15000/);
  assert.doesNotMatch(cloud,/requestBoundedAction\s*:/);
});


test('OA-CHN-001 exposes canonical channel semantics and disables unsupported commands',()=>{
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const page=fs.readFileSync(path.join(srcRoot,'channel-health.tsx'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  for(const field of['acceptingOrders','desiredState','observedState','health','mode','cause','observedAt','freshness','lastCommand','readback'])assert.match(types,new RegExp(field));
  for(const mode of['NORMAL','BUSY','SNOOZED','PAUSED','CLOSED'])assert.match(types,new RegExp(mode));
  for(const health of['HEALTHY','DEGRADED','OFFLINE','UNKNOWN'])assert.match(types,new RegExp(health));
  assert.match(page,/暫停接單/);
  assert.match(page,/恢復接單/);
  assert.match(page,/<button disabled>暫停接單<\/button>/);
  assert.match(page,/目前只供查看；可操作功能會喺完成連接後開放/);
  assert.doesNotMatch(cloud,/\/api\/owner\/channels\/command/);
});

test('OA-PLN-001 uses canonical runtime rather than localStorage and keeps cost semantics separate',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const page=fs.readFileSync(path.join(srcRoot,'planning.tsx'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  assert.match(types,/MFK_OWNER_MONTHLY_PLAN_V1/);
  assert.match(types,/monthlyRevenueTargetMinor/);
  assert.match(types,/plannedMonthlyMinor/);
  assert.match(types,/actualToDateMinor/);
  assert.match(types,/expectedRevision/);
  assert.match(types,/COMPLETE.*PARTIAL.*MANUAL_ESTIMATE/s);
  assert.match(page,/Current Effective Sales/);
  assert.match(page,/估算營運淨利（按已輸入成本）/);
  assert.match(page,/本月目標已達成/);
  assert.match(page,/預計 \/ Forecast/);
  assert.match(page,/Draft \/ Pending \/ External Pre-admission \/ 未結帳 Open Check \/ estimatedOpenAmount 不會加入/);
  assert.doesNotMatch(page,/localStorage|sessionStorage/);
  assert.match(cloud,/\/api\/owner\/planning/);
  assert.match(app,/營業目標與成本/);
});

test('Stage04 keeps four-item bottom navigation and secondary routes',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const navBlock=app.match(/<nav className="bottom-nav"[\s\S]*?<\/nav>/)?.[0]??'';
  assert.equal((navBlock.match(/<Nav /g)||[]).length,4);
  for(const label of['今日','待處理','訂單','更多'])assert.match(navBlock,new RegExp(label));
  assert.match(app,/\/channels/);
  assert.match(app,/\/planning/);
  assert.match(app,/PlanningPage/);
  assert.doesNotMatch(app,/MonthlyTargetSummaryCard/);
});


test('OA-SEL-001 uses canonical Sellability Authority with per-target readback',()=>{
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const page=fs.readFileSync(path.join(srcRoot,'sellability.tsx'),'utf8');
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  for(const grain of['PRODUCT','OPTION','MODIFIER','COMBO_CHILD'])assert.match(types,new RegExp(grain));
  for(const state of['CONFIRMED','PARTIAL','UNKNOWN'])assert.match(types,new RegExp(state));
  assert.match(types,/ONLINE_ONLY/);
  assert.match(types,/restoreAt/);
  assert.match(cloud,/\/api\/owner\/sellability/);
  assert.match(page,/即時停售或恢復商品/);
  assert.match(page,/商品結構同價格設定仍留喺 Admin/);
  assert.match(page,/只停網上/);
  assert.match(page,/只停至今日/);
  assert.match(page,/停至指定時間/);
  assert.match(page,/數量資料.*只展示/);
  assert.match(page,/改價、商品／套餐結構、平台對應同刪除商品仍然喺 Admin 處理/);
  assert.match(page,/唔會自動改成售罄/);
  assert.match(app,/sellability/);
  assert.doesNotMatch(page,/localStorage|sessionStorage/);
});

test('OA-STF-001 is read-only and never fabricates attendance data',()=>{
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  const page=fs.readFileSync(path.join(srcRoot,'staff-overview.tsx'),'utf8');
  const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
  const identitySource=fs.readFileSync(path.join(srcRoot,'staff-identity.ts'),'utf8');

  assert.match(app,/StaffOverviewPage/);
  assert.match(app,/\/staff/);
  assert.match(app,/onStaff/);

  for(const marker of[
    '員工摘要',
    '上班中',
    '排班與實際',
    '休息中',
    '今日工時',
    '員工提醒',
    '角色摘要',
    '基本資料',
    '角色與能力',
    '相關紀錄',
    '員工資料',
    '未有資料',
    '未有員工編號資料',
    '未有能力摘要資料',
    '暫時未有相關紀錄',
    '打卡、登入同角色權限係不同資料',
    '薪酬資料不會喺呢個頁面顯示',
  ])assert.match(page,new RegExp(marker));

  assert.match(page,/目前未有完整出勤、休息同工時資料/);
  assert.match(page,/出勤資料未連接/);
  assert.match(page,/新增／停用員工、角色權限同 PIN 設定請到 Admin 處理/);
  assert.match(types,/loginId\?:string/);
  assert.match(types,/capabilitySummary\?:string/);
  assert.match(identitySource,/staff\.staffId/);
  assert.doesNotMatch(identitySource,/staff\.name/);

  assert.doesNotMatch(page,/person\.permissions|selected\.permissions/);
  assert.doesNotMatch(page,/員工編號 \{person\.staffId\}|員工編號<\/span><strong>\{selected\.staffId\}/);
  assert.doesNotMatch(page,/presence\.includes|schedule\.includes/);
  assert.doesNotMatch(page,/onCommand|requestBoundedAction|command[A-Z]|fetch\(/);
  assert.doesNotMatch(page,/localStorage|sessionStorage/);
  assert.doesNotMatch(page,/<input|<select|<textarea/);
  assert.doesNotMatch(page,/pinVerifier|password|hashHex|saltHex/);
});

test('OA-STF-001 audit custody never assigns same-name staff without stable identity',()=>{
  const {selectStaffAuditHistory,humanEmployeeCode}=loadPureTsModule('staff-identity.ts');
  const sameNameA={staffId:'staff-a',loginId:'1001',name:'同名員工',role:'STAFF',presence:'UNKNOWN'};
  const sameNameB={staffId:'staff-b',loginId:'1002',name:'同名員工',role:'STAFF',presence:'UNKNOWN'};
  const activity=[
    {activityId:'name-only',title:'舊紀錄',actor:'同名員工',result:'OK',observedAt:'2026-09-27T00:00:00Z'},
    {activityId:'stable-b',title:'可靠紀錄',actor:'同名員工',actorStaffId:'staff-b',result:'OK',observedAt:'2026-09-27T00:01:00Z'},
  ];
  assert.deepEqual(selectStaffAuditHistory(activity,sameNameA).map(row=>row.activityId),[]);
  assert.deepEqual(selectStaffAuditHistory(activity,sameNameB).map(row=>row.activityId),['stable-b']);
  assert.equal(humanEmployeeCode(sameNameA),'1001');
  assert.equal(humanEmployeeCode({...sameNameA,loginId:undefined}),null);
});
