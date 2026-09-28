import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  smmStage7AmountLabel,
  smmStage7ConnectionState,
  smmStage7InSegment,
  smmStage7ItemCount,
  smmStage7MatchesDate,
  smmStage7MatchesSearch,
  smmStage7MatchesSource,
  smmStage7MatchesStatus,
  smmStage7Phone,
  smmStage7Sort,
  smmStage7SourceGroup,
  smmStage7StatusKey,
  smmStage7StatusLabel,
} from '../src/stage7-orders.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/Stage7Orders.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage7.css',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/product-types.ts',import.meta.url),'utf8');
const stage6=readFileSync(new URL('../src/Stage6Queue.tsx',import.meta.url),'utf8');
const stage5=readFileSync(new URL('../src/Stage5Submit.tsx',import.meta.url),'utf8');
const capabilities=JSON.parse(readFileSync(new URL('../src/capabilities.json',import.meta.url),'utf8'));

const rows=[
  {
    orderId:'internal-1',
    displayCode:'#028',
    source:'Keeta',
    sourceGroup:'THIRD_PARTY',
    lifecycle:'PREPARING',
    fulfillmentLabel:'製作中',
    itemSummary:'牛油照燒叉治 · 台式奶茶',
    itemCount:2,
    effectiveAmountLabel:'$132',
    amountLabel:'$132',
    observedAt:'2026-09-27T10:00:00+08:00',
    orderTime:'2026-09-27T09:58:00+08:00',
    readback:'CONFIRMED',
    customerPhone:'9123 4567',
    customerPhonePermitted:true,
    items:[{quantity:1,name:'牛油照燒叉治'},{quantity:1,name:'台式奶茶'}],
    timeline:[],
  },
  {
    orderId:'internal-2',
    displayCode:'#017',
    source:'現場',
    sourceGroup:'ONSITE',
    lifecycle:'COMPLETED',
    fulfillmentLabel:'已取餐',
    itemSummary:'飯團',
    itemCount:1,
    amountLabel:'$48',
    observedAt:'2026-09-26T19:12:00+08:00',
    orderTime:'2026-09-26T19:10:00+08:00',
    readback:'CONFIRMED',
    customerPhone:'9000 0000',
    customerPhonePermitted:false,
    items:[{quantity:1,name:'飯團'}],
    timeline:[],
  },
  {
    orderId:'internal-3',
    displayCode:'#029',
    source:'SMM',
    sourceGroup:'SMM',
    lifecycle:'READY',
    itemSummary:'咖喱便當',
    observedAt:'2026-09-27T10:05:00+08:00',
    readback:'PARTIAL',
    timeline:[],
  },
];

test('Stage 7 active/history segmentation is deterministic',()=>{
  assert.equal(smmStage7InSegment(rows[0],'ACTIVE'),true);
  assert.equal(smmStage7InSegment(rows[1],'HISTORY'),true);
  assert.equal(smmStage7InSegment(rows[1],'ACTIVE'),false);
  assert.deepEqual(smmStage7Sort(rows).map(row=>row.displayCode),['#029','#028','#017']);
});

test('Stage 7 source and canonical status filters are deterministic',()=>{
  assert.equal(smmStage7SourceGroup(rows[0]),'THIRD_PARTY');
  assert.equal(smmStage7SourceGroup(rows[1]),'ONSITE');
  assert.equal(smmStage7SourceGroup(rows[2]),'SMM');
  assert.equal(smmStage7MatchesSource(rows[0],'THIRD_PARTY'),true);
  assert.equal(smmStage7StatusKey(rows[0]),'WORKING');
  assert.equal(smmStage7StatusKey(rows[1]),'PICKED_UP');
  assert.equal(smmStage7MatchesStatus(rows[0],'WORKING'),true);
  assert.equal(smmStage7MatchesStatus(rows[0],'READY'),false);
});

test('Stage 7 filter no-match never becomes page EMPTY',()=>{
  const active=rows.filter(row=>smmStage7InSegment(row,'ACTIVE'));
  assert.ok(active.length>0);

  const sourceNoMatch=active.filter(row=>smmStage7MatchesSource(row,'ONSITE'));
  assert.equal(sourceNoMatch.length,0);

  const statusNoMatch=active.filter(row=>smmStage7MatchesStatus(row,'PENDING'));
  assert.equal(statusNoMatch.length,0);

  const history=rows.filter(row=>smmStage7InSegment(row,'HISTORY'));
  assert.ok(history.length>0);
  const dateNoMatch=history.filter(row=>smmStage7MatchesDate(row,'CUSTOM','2026-09-25','2026-09-27T12:00:00+08:00'));
  assert.equal(dateNoMatch.length,0);

  assert.match(view,/connection==='READY'&&segmentRows\.length===0\?<Stage7Empty/);
  assert.match(view,/segmentRows\.length>0&&filteredRows\.length===0/);
  assert.match(view,/目前篩選條件沒有符合訂單/);
  assert.doesNotMatch(view,/connection==='READY'&&filteredRows\.length===0\?<Stage7Empty/);
});

test('Stage 7 search ignores hidden list source/status/date filters within the current segment',()=>{
  assert.match(view,/if\(surface==='SEARCH'\)[\s\S]*rows=\{segmentRows\}/);
  assert.doesNotMatch(view,/if\(surface==='SEARCH'\)[\s\S]{0,240}rows=\{filteredRows\}/);

  const history=rows.filter(row=>smmStage7InSegment(row,'HISTORY'));
  const hiddenListThirdParty=history.filter(row=>smmStage7MatchesSource(row,'THIRD_PARTY'));
  assert.equal(hiddenListThirdParty.length,0);
  const searchResult=history.filter(row=>smmStage7MatchesSearch(row,'017','DISPLAY'));
  assert.deepEqual(searchResult.map(row=>row.displayCode),['#017']);
});

test('Stage 7 history date filter uses canonical order/observed time only',()=>{
  const now='2026-09-27T12:00:00+08:00';
  assert.equal(smmStage7MatchesDate(rows[1],'YESTERDAY','',now),true);
  assert.equal(smmStage7MatchesDate(rows[1],'TODAY','',now),false);
  assert.equal(smmStage7MatchesDate(rows[1],'CUSTOM','2026-09-26',now),true);
});

test('Stage 7 search matches Display Number and product names without internal Order ID',()=>{
  assert.equal(smmStage7MatchesSearch(rows[0],'028','DISPLAY'),true);
  assert.equal(smmStage7MatchesSearch(rows[0],'台式奶茶','PRODUCT'),true);
  assert.equal(smmStage7MatchesSearch(rows[0],'internal-1','ALL'),false);
  assert.doesNotMatch(view,/smmStage7MatchesSearch\([^\n]*orderId/);
});

test('phone search is canonical + permitted only',()=>{
  assert.equal(smmStage7Phone(rows[0]),'9123 4567');
  assert.equal(smmStage7Phone(rows[1]),null);
  assert.equal(smmStage7MatchesSearch(rows[0],'9123','PHONE'),true);
  assert.equal(smmStage7MatchesSearch(rows[1],'9000','PHONE'),false);
  assert.match(view,/disabled=\{value==='PHONE'&&!phoneAvailable\}/);
  assert.match(view,/只會比對訂單編號、商品名稱，以及系統可用嘅電話資料/);
});

test('Stage 7 list shows human identity, source, time, items, amount and status with honest missing data',()=>{
  for(const marker of['displayCode','source','orderTime','itemCount','effectiveAmountLabel','fulfillmentLabel'])assert.ok(types.includes(marker),marker);
  assert.equal(smmStage7ItemCount(rows[0]),2);
  assert.equal(smmStage7ItemCount(rows[2]),null);
  assert.equal(smmStage7AmountLabel(rows[2]),'未有資料');
  assert.equal(smmStage7StatusLabel(rows[2]),'準備完成 / 可取餐');
  assert.match(view,/項目數未有資料/);
  assert.match(view,/未有資料/);
});

test('Stage 7 7.1-7.5 visual family is explicit',()=>{
  for(const marker of['7.1_ACTIVE','7.2_HISTORY','7.3_SEARCH','7.4_DETAIL','7.5_STATUS'])assert.ok(view.includes(marker),marker);
  for(const marker of['進行中','歷史','搜尋訂單','訂單詳情','訂單狀態'])assert.ok(view.includes(marker),marker);
});

test('Stage 7 source filters are exactly 全部 / 現場 / SMM / 自家平台 / 第三方',()=>{
  for(const label of['全部','現場','SMM','自家平台','第三方'])assert.ok(view.includes(label),label);
  assert.match(view,/SOURCE_FILTERS/);
});

test('Stage 7 detail is canonical-only and hides UUID/internal Order ID',()=>{
  assert.match(view,/row\.items\?\?\[\]/);
  assert.match(view,/smmStage7AmountLabel\(row\)/);
  assert.match(view,/row\.tenderLabel/);
  assert.match(view,/smmStage7StatusLabel\(row\)/);
  assert.match(view,/row\.timeline\.map/);
  assert.match(view,/row\.externalRef/);
  assert.doesNotMatch(view,/>\{row\.orderId\}</);
  assert.doesNotMatch(view,/UUID/);
  assert.doesNotMatch(view,/setTimeline|appendTimeline|push\([^\n]*timeline/);
});

test('Stage 7 status mutation controls are disabled and delegated to SMT',()=>{
  for(const label of['待確認','製作中','準備完成 / 可取餐','已取餐','已取消'])assert.ok(view.includes(label),label);
  assert.match(view,/input type="radio" disabled/);
  assert.match(view,/textarea disabled/);
  assert.match(view,/className="primary" disabled>確認更新/);
  assert.ok((view.match(/請在收銀機處理/g)||[]).length>=3);
  assert.doesNotMatch(view,/cancelOrder|updateFulfillment|setFulfillment|fulfillmentCommand|onCancel|onFulfillment/);
  assert.doesNotMatch(types,/cancelOrder\?|updateFulfillment\?|fulfillmentCommand\?/);
});

test('capability registry keeps fulfillment and cancel NOT_WIRED',()=>{
  assert.equal(capabilities.find(item=>item.id==='FULFILLMENT_COMMAND')?.status,'NOT_WIRED');
  assert.equal(capabilities.find(item=>item.id==='CANCEL_COMMAND')?.status,'NOT_WIRED');
});

test('Stage 7 refresh is the only operational action and has no transport mutation seam',()=>{
  assert.match(view,/await Promise\.resolve\(onRefresh\(\)\)/);
  assert.match(view,/重新整理/);
  assert.match(view,/重新整理狀態/);
  assert.doesNotMatch(view,/fetch\(|POST|PATCH|PUT|DELETE|submitOrder\(/);
});

test('Stage X Loading Empty Offline Stale Partial Unknown Error remain separated',()=>{
  assert.equal(smmStage7ConnectionState('LOADING',false)?.kind,'LOADING');
  assert.equal(smmStage7ConnectionState('NOT_CONNECTED',false)?.kind,'OFFLINE');
  assert.equal(smmStage7ConnectionState('STALE',true)?.kind,'STALE');
  assert.equal(smmStage7ConnectionState('PARTIAL',true)?.kind,'PARTIAL');
  assert.equal(smmStage7ConnectionState('UNKNOWN',true)?.kind,'UNKNOWN');
  assert.equal(smmStage7ConnectionState('ERROR',true)?.kind,'ERROR');
  assert.equal(smmStage7ConnectionState('READY',false),null);
  assert.match(view,/connection==='READY'&&segmentRows\.length===0\?<Stage7Empty/);
  assert.match(view,/segmentRows\.length>0&&filteredRows\.length===0\?<section className="stage7-filter-empty"/);
  assert.match(view,/Stage7StateBanner connection=\{connection\} hasRows=\{rows\.length>0\}/);
});

test('fixed five-tab nav keeps 訂單 active',()=>{
  const start=app.indexOf('<nav className="bottom-nav"');
  const end=app.indexOf('</nav>',start);
  const nav=app.slice(start,end);
  const labels=[...nav.matchAll(/<NavButton[^>]*label="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(labels,['點單','待處理','訂單','堂食','更多']);
  assert.match(nav,/active=\{view==='orders'\} label="訂單"/);
});

test('Stage 7 keeps Stage 5/6 regression locks and does not introduce Stage 8',()=>{
  assert.match(stage5,/5\.6_UNKNOWN/);
  assert.match(stage6,/6\.1_QUEUE/);
  assert.match(app,/Stage6QueueView/);
  assert.match(app,/Stage7OrdersView/);
  assert.doesNotMatch(view,/Stage 8|第 8 階段/);
});

test('Stage 7 responsive and accessibility contract covers 440x956 and 360x780',()=>{
  assert.match(css,/max-width:440px/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(max-height:780px\)/);
  assert.match(css,/min-width:44px/);
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.stage7-filter-empty/);
});
