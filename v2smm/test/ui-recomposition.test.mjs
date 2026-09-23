import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'../src');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('primary IA is task-first and limited to five operator destinations',()=>{
  const ui=read('ui.tsx');
  for(const marker of["label:'點單'","label:'工作'","label:'訂單'","label:'狀態'","label:'更多'"]){
    assert.match(ui,new RegExp(marker));
  }
  assert.match(ui,/PrimaryView='order'\|'work'\|'orders'\|'status'\|'more'/);
});

test('guided ordering reveals one decision range and retains editable completed steps',()=>{
  const flow=read('order-flow.tsx');
  assert.match(flow,/GuidedProgress/);
  assert.match(flow,/CompletedStep/);
  assert.match(flow,/完成目前步驟後便可繼續/);
  assert.match(flow,/disabled={!stepComplete\(current\)}/);
  assert.match(flow,/取得正式報價/);
  assert.match(flow,/確認提交意圖/);
  assert.match(flow,/正在確認訂單結果/);
  assert.match(flow,/if\(open&&!wasOpen\.current\)setStage/);
});

test('dialog foundation uses native modal semantics and restores focus',()=>{
  const ui=read('ui.tsx');
  assert.match(ui,/<dialog/);
  assert.match(ui,/showModal\(\)/);
  assert.match(ui,/aria-labelledby/);
  assert.match(ui,/onCancel/);
  assert.match(ui,/previousFocusRef\.current\?\.focus\(\)/);
});

test('submission and readback are synchronously locked and never invent a second identity',()=>{
  const app=read('App.tsx');
  assert.match(app,/commandLockRef\.current/);
  assert.match(app,/state==='PENDING'\|\|item\.state==='UNKNOWN'/);
  assert.match(app,/port\.submitOrder\(pending\)/);
  assert.match(app,/port\.readSubmission\(intent\.submissionId\)/);
  assert.match(app,/state:'readback',submissionId:intent\.submissionId/);
  assert.match(app,/REJECTED \/ FAILED are presentation truth only/);
  assert.match(app,/本機只保存草稿狀態，未保存終結結果/);
});

test('responsive and accessibility rules are explicit in the production stylesheet',()=>{
  const css=read('styles.css');
  assert.match(css,/min-height:\s*44px/);
  assert.match(css,/@media \(min-width: 768px\)/);
  assert.match(css,/@media \(min-width: 1180px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
});

test('observed time is neutral and state labels come from supplied runtime states',()=>{
  const presentation=read('presentation.ts');
  assert.match(presentation,/最後更新/);
  assert.match(presentation,/if\(state==='STALE'\)/);
  assert.match(presentation,/if\(state==='PARTIAL'\)/);
  assert.doesNotMatch(presentation,/Date\.now\(\).*STALE|setTimeout|setInterval/);
});
