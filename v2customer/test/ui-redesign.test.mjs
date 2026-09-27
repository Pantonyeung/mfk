import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const primitives=fs.readFileSync(path.join(srcRoot,'ui/primitives.tsx'),'utf8');
const styles=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');
const recommendation=fs.readFileSync(path.join(srcRoot,'recommendation.ts'),'utf8');

test('shared interaction primitives expose distinct transaction states',()=>{
  for(const state of['loading','pending','success','error','unknown','disabled']){
    assert.match(primitives,new RegExp(`'${state}'`));
  }
  assert.match(app,/請勿重複提交/);
  assert.match(app,/readSubmission/);
  assert.match(primitives,/finalState==='disabled'/);
  assert.doesNotMatch(app,/>Submission ID</);
  assert.doesNotMatch(app,/\{intent\.submissionId\}<\/strong>/);
});

test('product sheet follows distance and velocity before snapping or dismissing',()=>{
  assert.match(primitives,/distance>140/);
  assert.match(primitives,/velocity>850/);
  assert.match(primitives,/--drag-y/);
  assert.match(primitives,/setPointerCapture/);
  assert.match(primitives,/showModal/);
});

test('motion system is tokenized and has a reduced-motion functional fallback',()=>{
  for(const token of['--motion-micro','--motion-layout','--motion-sheet'])assert.match(styles,new RegExp(token));
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(primitives,/prefers-reduced-motion: reduce/);
  assert.match(primitives,/requestAnimationFrame/);
});

test('memory jar and recommendations use projected product and history data',()=>{
  assert.match(app,/記憶罐/);
  assert.match(app,/記憶種子/);
  assert.match(app,/buildCustomerRecommendations/);
  assert.match(recommendation,/product\.badge/);
  assert.match(recommendation,/appearedInHistory/);
  assert.match(app,/buildReorderCart/);
  assert.doesNotMatch(app,/fake|fixture|mock/i);
});
