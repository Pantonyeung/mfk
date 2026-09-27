import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {
  smmStage5ConfirmedDisplayCode,
  smmStage5DisplaySuffix,
  smmStage5RepairPath,
  smmStage5SharedState,
  smmStage5SubmissionShortRef,
} from '../src/stage5-submit.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/Stage5Submit.tsx',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../src/smt-lan-adapter.ts',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../src/pwa-cloud.ts',import.meta.url),'utf8');
const lan=readFileSync(new URL('../src/pwa-lan.ts',import.meta.url),'utf8');
const contract=readFileSync(new URL('../../contracts/smm-lan-v1.ts',import.meta.url),'utf8');
const shared=readFileSync(new URL('../src/stage5-submit.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage5.css',import.meta.url),'utf8');

test('Stage 5 state machine stays DRAFT -> PENDING -> CONFIRMED / REJECTED / UNKNOWN only',()=>{
  assert.match(view,/SmmStage5State='DRAFT'\|'PENDING'\|'CONFIRMED'\|'REJECTED'\|'UNKNOWN'/);
  for(const state of['DRAFT','PENDING','CONFIRMED','REJECTED','UNKNOWN'])assert.match(view,new RegExp(state));
  const stateType=view.match(/export type SmmStage5State=([^;]+);/)?.[1]??'';
  assert.doesNotMatch(stateType,/PREPARING|READY|COMPLETED/);
  assert.doesNotMatch(view,/Stage 6|第 6 階段/);
});

test('Stage 5 implements the V2 full-screen 5.2-5.6 family instead of a generic bottom sheet',()=>{
  for(const marker of[
    '5.2_SUBMITTING','5.3_PENDING','5.4_CONFIRMED','5.5_REJECTED','5.6_UNKNOWN',
    '正在處理您的訂單','訂單已提交','訂單已確認','未能提交訂單','提交結果未確認',
  ])assert.ok(view.includes(marker),marker);
  assert.match(css,/\.stage5-screen\{[\s\S]*position:fixed;[\s\S]*height:100dvh/);
  assert.doesNotMatch(css,/\.stage5-overlay|\.stage5-sheet/);
  assert.doesNotMatch(view,/className="overlay stage5|className="sheet stage5/);
});

test('Stage 5 uses supplied branded artwork slots for every V2 result state',()=>{
  for(const name of['submitting','pending','confirmed','rejected','unknown']){
    assert.ok(view.includes("stage5-"+name+".webp"),name);
  }
  assert.doesNotMatch(view,/stage5-(?:submitting|pending|confirmed|rejected|unknown)\.svg/);
});

test('one intent owns one stable submissionId and one derived idempotencyKey',()=>{
  assert.match(persistence,/const submissionId=createSmmStableSubmissionId\(\)/);
  assert.match(persistence,/idempotencyKey:`smm-direct:\$\{submissionId\}`/);
  assert.match(adapter,/submissionId:intent\.submissionId/);
  assert.match(adapter,/idempotencyKey:intent\.idempotencyKey/);
  assert.match(app,/const base=existing\?\?createSmmPendingIntent/);
});

test('rapid multi tap is synchronously locked before any await',()=>{
  const start=app.indexOf('const submitCart=async()=>');
  const end=app.indexOf('const readbackIntent=',start);
  const source=app.slice(start,end);
  assert.match(source,/if\(submitLockRef\.current\|\|cart\.length===0\)return/);
  assert.ok(source.indexOf('submitLockRef.current=true')<source.indexOf('await '));
  assert.match(source,/releaseSubmitLock/);
});

test('5.2 submitting and 5.3 pending keep a human-safe reference instead of raw UUID',()=>{
  assert.equal(smmStage5SubmissionShortRef('SMM-550e8400-e29b-41d4-a716-446655440000'),'440000');
  assert.match(view,/smmStage5SubmissionShortRef\(session\.intent\.submissionId\)/);
  assert.match(view,/提交參考/);
  assert.match(view,/訂單號/);
  assert.doesNotMatch(view,/\{session\.intent\.submissionId\}/);
});

test('5.4 confirmed renders only canonical display code hierarchy, never orderId or UUID',()=>{
  assert.match(view,/取餐碼/);
  assert.match(view,/顯示號/);
  assert.match(view,/session\.displayCode/);
  assert.doesNotMatch(view,/orderId|UUID/);
  assert.equal(smmStage5ConfirmedDisplayCode('P0017'),'P0017');
  assert.equal(smmStage5DisplaySuffix('P0017'),'017');
  assert.equal(smmStage5ConfirmedDisplayCode('550e8400-e29b-41d4-a716-446655440000'),null);
  assert.equal(smmStage5ConfirmedDisplayCode('SMM-ABC123'),null);
  assert.match(contract,/displayCode:string/);
  assert.match(adapter,/displayCode:response\.displayCode/);
  assert.match(cloud,/canonicalDisplay/);
});

test('5.5 rejected exposes deterministic repair path and keeps cart until repair',()=>{
  assert.equal(smmStage5RepairPath('SMM_MENU_REVISION_CHANGED').target,'CART');
  assert.equal(smmStage5RepairPath('SMM_DINING_TABLE_NOT_PUBLISHED').target,'CHECKOUT');
  assert.equal(smmStage5RepairPath('SMM_STAFF_UNAUTHORIZED').target,'STAFF');
  assert.match(view,/返回修改/);
  assert.match(view,/stage5-reason-card/);
  assert.match(app,/state:'REJECTED'/);
});

test('5.6 UNKNOWN has readback-first only and never exposes resubmit',()=>{
  const unknownStart=view.indexOf('function Stage5Unknown');
  const unknownEnd=view.indexOf('export function Stage5SubmitView',unknownStart);
  const unknown=view.slice(unknownStart,unknownEnd);
  assert.match(unknown,/重新確認結果/);
  assert.doesNotMatch(unknown,/重新提交|submitOrder|onSubmit/);
  const start=app.indexOf('const readbackIntent=async');
  const end=app.indexOf('const repairStage5=',start);
  const readback=app.slice(start,end);
  assert.match(readback,/port\.readSubmission\(intent\.submissionId\)/);
  assert.doesNotMatch(readback,/submitOrder|createSmmPendingIntent/);
});

test('transport Offline is separate from transaction UNKNOWN',()=>{
  assert.equal(smmStage5SharedState('NOT_CONNECTED',true)?.kind,'OFFLINE');
  assert.equal(smmStage5SharedState('UNKNOWN',true)?.kind,'UNKNOWN');
  assert.notEqual(smmStage5SharedState('NOT_CONNECTED',true)?.kind,'UNKNOWN');
  assert.match(app,/result\.state==='NOT_CONNECTED'/);
  assert.match(app,/傳輸通道離線；未將交易結果改寫成 UNKNOWN/);
  assert.match(app,/原交易狀態保持不變/);
  assert.match(cloud,/catch\(error\)[\s\S]*return\{kind:'UNKNOWN'\}/);
  assert.match(lan,/catch\(error\)[\s\S]*return\{kind:'UNKNOWN'\}/);
});

test('shared Loading Empty Offline Stale Partial Unknown Error remain distinct',()=>{
  assert.equal(smmStage5SharedState('LOADING',true)?.kind,'LOADING');
  assert.equal(smmStage5SharedState('READY',false)?.kind,'EMPTY');
  assert.equal(smmStage5SharedState('NOT_CONNECTED',true)?.kind,'OFFLINE');
  assert.equal(smmStage5SharedState('STALE',true)?.kind,'STALE');
  assert.equal(smmStage5SharedState('PARTIAL',true)?.kind,'PARTIAL');
  assert.equal(smmStage5SharedState('UNKNOWN',true)?.kind,'UNKNOWN');
  assert.equal(smmStage5SharedState('ERROR',true)?.kind,'ERROR');
  for(const marker of['LOADING','EMPTY','OFFLINE','STALE','PARTIAL','UNKNOWN','ERROR'])assert.ok(shared.includes(marker),marker);
  assert.match(view,/data-stage5-transport-state/);
  assert.match(view,/data-stage5-state/);
});

test('Error Stale Partial presentation has no resubmit control',()=>{
  assert.doesNotMatch(view,/重新提交/);
  assert.match(view,/Stage5SharedState/);
  assert.match(view,/connection:SmmConnectionState/);
});

test('cart is cleared only inside canonical confirmed resolver',()=>{
  const start=app.indexOf('const resolveConfirmedIntent=');
  const end=app.indexOf('const releaseSubmitLock=',start);
  const confirmed=app.slice(start,end);
  assert.match(confirmed,/setCart\(\[\]\)/);
  assert.match(confirmed,/setCartNote\(''\)/);
  const submitStart=app.indexOf('const submitCart=async()=>');
  const submitEnd=app.indexOf('const readbackIntent=',submitStart);
  const submit=app.slice(submitStart,submitEnd);
  const withoutConfirmed=submit.replace(/if\(result\.state==='CONFIRMED'\)[\s\S]*?return;\n\s*}/,'');
  assert.doesNotMatch(withoutConfirmed,/setCart\(\[\]\)/);
});

test('SMM submit client has one POST seam and no reconnect or background resend',()=>{
  assert.equal((cloud.match(/orderEndpoint\('submit'\)/g)||[]).length,1);
  assert.doesNotMatch(app,/addEventListener\(['"]online['"][\s\S]{0,400}submitCart/);
  assert.doesNotMatch(app,/setInterval\([\s\S]{0,400}submitCart/);
  assert.doesNotMatch(app,/setTimeout\([\s\S]{0,400}submitCart/);
});

test('UNKNOWN pending list hides discard and exposes readback only',()=>{
  assert.match(app,/intent\.state==='UNKNOWN'[\s\S]*重新確認結果/);
  assert.match(app,/const locked=intent\.state==='UNKNOWN'\|\|intent\.state==='PENDING'/);
  assert.match(app,/\{!locked\?<button className="danger"[\s\S]*刪除草稿/);
});

test('Stage 5 is usable at 440x956 and 360px minimum with touch targets and reduced motion',()=>{
  assert.match(css,/width:min\(100%,520px\)/);
  assert.match(css,/@media\(max-width:389px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/\.stage5-primary,[\s\S]*min-height:50px/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});


test('Stage 5 landing candidate contains no one-off workflow',()=>{
  assert.equal(existsSync(new URL('../../.github/workflows/smm-stage5-formal-submit-r1.yml',import.meta.url)),false);
});
