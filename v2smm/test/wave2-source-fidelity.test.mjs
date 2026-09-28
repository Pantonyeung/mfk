import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const stage7=readFileSync(new URL('../src/Stage7Orders.tsx',import.meta.url),'utf8');
const stage8=readFileSync(new URL('../src/Stage8Dine.tsx',import.meta.url),'utf8');
const stage9=readFileSync(new URL('../src/Stage9More.tsx',import.meta.url),'utf8');
const stageX=readFileSync(new URL('../src/StageXState.tsx',import.meta.url),'utf8');
const css8=readFileSync(new URL('../src/stage8.css',import.meta.url),'utf8');
const css9=readFileSync(new URL('../src/stage9.css',import.meta.url),'utf8');
const cssX=readFileSync(new URL('../src/stagex.css',import.meta.url),'utf8');
const capabilities=JSON.parse(readFileSync(new URL('../src/capabilities.json',import.meta.url),'utf8'));

test('Wave2 keeps Stage 0-6 product paths untouched while Stage 8/9/X are isolated presentation modules',()=>{
  assert.match(app,/Stage5SubmitView/);
  assert.match(app,/Stage6QueueView/);
  assert.match(app,/Stage7OrdersView/);
  assert.match(app,/Stage8DineView/);
  assert.match(app,/Stage9MoreView/);
  assert.doesNotMatch(app,/createDineSession/);
  assert.doesNotMatch(app,/setSellability/);
});

test('Stage 8 FINAL structure covers overview detail waiting and clear review without table mutation authority',()=>{
  for(const marker of['8.1_OVERVIEW','8.2_TABLE_DETAIL','8.4_WAITING','8.5_CLEAR_REVIEW'])assert.match(stage8,new RegExp(marker));
  for(const marker of['餐枱總覽','使用中','空枱','輪候','清枱前檢查','加入輪候後點單'])assert.match(stage8,new RegExp(marker));
  assert.match(stage8,/tables\.slice\(\)\.sort/);
  assert.match(stage8,/custody/);
  assert.match(stage8,/確認清枱<\/button>/);
  assert.match(stage8,/className="stage8-primary" disabled>確認清枱/);
  assert.match(stage8,/結帳" note="請到收銀機處理"/);
  assert.doesNotMatch(stage8,/createDineSession|closeDineSession|clearTable|updateCovers/);
});

test('Stage 9 FINAL hub contains only approved read/review tools and excludes legacy sellability mutation',()=>{
  for(const marker of['員工帳戶','連線','渠道健康','營業日','產能','營運報表','退款要求','打印與設備','診斷'])assert.match(stage9,new RegExp(marker));
  assert.doesNotMatch(stage9,/Stage9Tool[^\n]*sellability|setSellability|reprintOrder|manualReprint/);
  assert.match(stage9,/手機只做前線店務/);
  assert.match(stage9,/Stage9Tool='staff'\|'connection'\|'channels'\|'business'\|'printing'\|'diagnostics'\|'pending'\|'capacity'\|'reporting'\|'refunds'/);
});

test('Stage X exposes seven distinct source states and UNKNOWN remains readback-first',()=>{
  for(const state of['LOADING','EMPTY','OFFLINE','STALE','PARTIAL','UNKNOWN','ERROR'])assert.match(stageX,new RegExp(state));
  assert.match(stageX,/先確認原本結果，請勿重複執行同一操作/);
  assert.match(stageX,/重新確認結果/);
  assert.match(stageX,/data-final-art-pending/);
  assert.match(cssX,/\.stagex-loading/);
  assert.match(cssX,/\.stagex-unknown/);
  assert.match(cssX,/\.stagex-error/);
});

test('Stage 7 remaining visual gap uses final-art source slots while phone search stays permission-gated',()=>{
  assert.match(stage7,/data-final-art-pending=\{\`STAGE7_SOURCE_/);
  assert.match(stage7,/disabled=\{value==='PHONE'&&!phoneAvailable\}/);
  assert.match(stage7,/smmStage7Phone/);
  assert.doesNotMatch(stage7,/cancelOrder|updateFulfillment|setFulfillment|fulfillmentCommand/);
});

test('Wave2 final art is slot-only for Stage7/8/9/X',()=>{
  for(const marker of[
    'STAGE7_SOURCE_',
    'STAGE8_CLEAR_ILLUSTRATION','STAGE8_ADD_ORDER_ICON','STAGE8_CHECKOUT_ICON','STAGE8_CLEAR_ICON',
    'STAGE9_STAFF_ICON','STAGE9_CONNECTION_ICON','STAGE9_CHANNEL_ICON','STAGE9_BUSINESS_DAY_ICON',
    'STAGE9_CAPACITY_ICON','STAGE9_REPORTING_ICON','STAGE9_REFUND_ICON','STAGE9_DEVICE_ICON','STAGE9_DIAGNOSTICS_ICON',
    'STAGEX_',
  ])assert.ok((stage7+stage8+stage9+stageX).includes(marker),marker);
});

test('Wave2 responsive CSS keeps mobile geometry and reduced-motion support',()=>{
  assert.match(css8,/@media\(max-width:360px\)/);
  assert.match(css8,/@media\(max-height:780px\)/);
  assert.match(css9,/@media\(max-width:360px\)/);
  assert.match(css9,/@media\(max-height:780px\)/);
  assert.match(css8,/prefers-reduced-motion:reduce/);
  assert.match(css9,/prefers-reduced-motion:reduce/);
  assert.match(cssX,/@media\(max-width:360px\)/);
});

test('Wave2 authority hard locks remain NOT_WIRED',()=>{
  assert.equal(capabilities.find(item=>item.id==='FULFILLMENT_COMMAND')?.status,'NOT_WIRED');
  assert.equal(capabilities.find(item=>item.id==='CANCEL_COMMAND')?.status,'NOT_WIRED');
});
