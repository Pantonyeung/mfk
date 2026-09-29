import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SMM_STAGE6_PRIORITY,
  smmStage6ConnectionState,
  smmStage6Counts,
  smmStage6DisplayCode,
  smmStage6ItemCount,
  smmStage6MatchesFilter,
  smmStage6Sort,
  smmStage6Source,
  smmStage6StateLabel,
} from '../src/stage6-queue.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/Stage6Queue.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage6.css',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/product-types.ts',import.meta.url),'utf8');
const stage5=readFileSync(new URL('../src/Stage5Submit.tsx',import.meta.url),'utf8');

const items=[
  {workId:'n',displayCode:'#104',kind:'TAKEAWAY',summary:'normal',state:'NORMAL',observedAt:'2026-09-27T10:04:00Z',serviceMode:'TAKEAWAY',itemCount:1},
  {workId:'u',displayCode:'#103',kind:'DINE_IN',summary:'unknown',state:'UNKNOWN',observedAt:'2026-09-27T10:03:00Z',serviceMode:'DINE_IN',itemCount:2},
  {workId:'d',displayCode:'#102',kind:'TAKEAWAY',summary:'delayed',state:'DELAYED',observedAt:'2026-09-27T10:02:00Z',serviceMode:'TAKEAWAY',itemCount:3},
  {workId:'a',displayCode:'#101',kind:'DINE_IN',summary:'attention',state:'ACTION_REQUIRED',observedAt:'2026-09-27T10:01:00Z',serviceMode:'DINE_IN',itemCount:4},
];

test('Stage 6 priority is ACTION_REQUIRED -> DELAYED -> UNKNOWN -> NORMAL',()=>{
  assert.deepEqual(SMM_STAGE6_PRIORITY,{ACTION_REQUIRED:0,DELAYED:1,UNKNOWN:2,NORMAL:3});
  assert.deepEqual(smmStage6Sort(items).map(item=>item.state),['ACTION_REQUIRED','DELAYED','UNKNOWN','NORMAL']);
});

test('Stage 6 source filters and counts are deterministic from canonical projection fields',()=>{
  assert.deepEqual(smmStage6Counts(items),{ALL:4,TAKEAWAY:2,DINE_IN:2,ATTENTION:3});
  assert.equal(items.filter(item=>smmStage6MatchesFilter(item,'ATTENTION')).length,3);
  assert.equal(items.filter(item=>smmStage6MatchesFilter(item,'TAKEAWAY')).length,2);
  assert.equal(items.filter(item=>smmStage6MatchesFilter(item,'DINE_IN')).length,2);
});

test('Stage 6 item count uses canonical count/items only and never invents a number',()=>{
  assert.equal(smmStage6ItemCount({itemCount:5}),5);
  assert.equal(smmStage6ItemCount({items:[{quantity:2},{quantity:1}]}),3);
  assert.equal(smmStage6ItemCount({summary:'five items'}),null);
});

test('Stage 6 list uses Display Number / Source / Time / Items / Status and never renders UUID identities',()=>{
  assert.match(view,/smmStage6DisplayCode/);
  assert.match(view,/smmStage6Source/);
  assert.match(view,/smmStage6ObservedTime/);
  assert.match(view,/smmStage6ItemCount/);
  assert.match(view,/smmStage6StateLabel/);
  assert.equal(smmStage6DisplayCode({displayCode:'#028'},undefined),'#028');
  assert.equal(smmStage6Source({source:'Keeta'},undefined),'Keeta');
  assert.doesNotMatch(view,/>\{item\.workId\}</);
  assert.doesNotMatch(view,/>\{item\.orderId\}</);
  assert.doesNotMatch(view,/>\{order\.orderId\}</);
});

test('Stage 6 6.1-6.5 visual family is explicit',()=>{
  for(const marker of['6.1_QUEUE','6.2_DETAIL','6.3_ACTIONS','6.4_STATUS','6.5_EMPTY'])assert.ok(view.includes(marker),marker);
  for(const text of['待處理','訂單詳情','更新訂單狀態','狀態更新','目前沒有需要處理的訂單'])assert.ok(view.includes(text),text);
  assert.match(view,/stage6-empty\.webp/);
});

test('Stage 6 enables only ACCEPT and READY through the SMT runtime authority',()=>{
  for(const label of['開始製作','已完成 / 可取餐','延遲','需要協助','取消訂單'])assert.ok(view.includes(label),label);
  assert.match(view,/onFulfill\('ACCEPT'\)/);
  assert.match(view,/onFulfill\('READY'\)/);
  assert.match(view,/status==='待處理'/);
  assert.match(view,/status==='進行中'/);
  assert.match(view,/\['延遲','需要協助','取消訂單'\]/);
  assert.match(view,/請於 SMT 處理/);
  assert.match(types,/fulfillOrder\?/);
  assert.doesNotMatch(types,/cancelOrder\?/);
});

test('Stage 6 fulfillment always refreshes canonical readback after SMT command',()=>{
  assert.match(view,/const result=await onFulfill/);
  assert.match(view,/await Promise\.resolve\(onRefresh\(\)\)/);
  assert.match(view,/正在由 SMT 更新/);
  assert.match(view,/暫未收到確認/);
  assert.doesNotMatch(view,/fetch\(|POST|PATCH|PUT|DELETE/);
});

test('Stage X Loading Empty Offline Stale Partial Unknown Error remain separated',()=>{
  assert.equal(smmStage6ConnectionState('LOADING',false)?.kind,'LOADING');
  assert.equal(smmStage6ConnectionState('NOT_CONNECTED',false)?.kind,'OFFLINE');
  assert.equal(smmStage6ConnectionState('STALE',true)?.kind,'STALE');
  assert.equal(smmStage6ConnectionState('PARTIAL',true)?.kind,'PARTIAL');
  assert.equal(smmStage6ConnectionState('UNKNOWN',true)?.kind,'UNKNOWN');
  assert.equal(smmStage6ConnectionState('ERROR',true)?.kind,'ERROR');
  assert.equal(smmStage6ConnectionState('READY',false),null);
  for(const marker of['LOADING','OFFLINE','STALE','PARTIAL','UNKNOWN','ERROR'])assert.ok(view.includes(marker)||readFileSync(new URL('../src/stage6-queue.mjs',import.meta.url),'utf8').includes(marker),marker);
  assert.match(view,/connection==='READY'&&sorted\.length===0\?<Stage6Empty/);
});

test('Stage 6 preserves Partial rows instead of flattening partial success to empty',()=>{
  assert.match(view,/Stage6ConnectionBanner connection=\{connection\} hasRows=\{sorted\.length>0\}/);
  assert.match(view,/\{filtered\.length\?<div className="stage6-queue"/);
  assert.doesNotMatch(view,/connection==='PARTIAL'[^\n]*Stage6Empty/);
});

test('fixed five-tab bottom nav keeps 待處理 active on work view and badge uses canonical queue count',()=>{
  const navStart=app.indexOf('<nav className="bottom-nav"');
  const navEnd=app.indexOf('</nav>',navStart);
  const nav=app.slice(navStart,navEnd);
  const labels=[...nav.matchAll(/<NavButton[^>]*label="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(labels,['點單','待處理','訂單','堂食','更多']);
  assert.match(nav,/active=\{view==='work'\} label="待處理"/);
  assert.match(nav,/badge=\{\(snapshot\?\.work\?\?\[\]\)\.length/);
});

test('Stage 6 responsive/accessibility contract covers 440x956 and 360x780',()=>{
  assert.match(css,/max-width:440px/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/@media\(max-height:780px\)/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/focus-visible/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Stage 6 keeps Stage 5 regression locks and does not introduce Stage 7',()=>{
  assert.match(stage5,/5\.2_SUBMITTING/);
  assert.match(stage5,/5\.6_UNKNOWN/);
  assert.match(app,/Stage5SubmitView/);
  assert.match(app,/Stage6QueueView/);
  assert.doesNotMatch(view,/Stage 7|第 7 階段/);
});

test('Stage 6 state labels are human-facing',()=>{
  assert.equal(smmStage6StateLabel('ACTION_REQUIRED'),'需要協助');
  assert.equal(smmStage6StateLabel('DELAYED'),'延遲');
  assert.equal(smmStage6StateLabel('UNKNOWN'),'狀態未明');
  assert.equal(smmStage6StateLabel('NORMAL'),'正常');
  assert.equal(smmStage6StateLabel('NORMAL','製作中'),'製作中');
});
