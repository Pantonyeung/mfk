import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');

test('Customer menu model accepts canonical Combo, Pool and drink projections',()=>{
  assert.match(types,/interface CustomerCombo/);
  assert.match(types,/interface CustomerComboPool/);
  assert.match(types,/addonKind\?:'SNACK'\|'DRINK'/);
  assert.match(types,/readonly combos\?:readonly CustomerCombo\[\]/);
  assert.match(types,/readonly comboPools\?:readonly CustomerComboPool\[\]/);
  assert.match(types,/readonly comboId\?:string/);
});

test('Customer keeps pulling the current Admin-derived snapshot while visible',()=>{
  assert.match(app,/window\.setInterval\(\(\)=>void poll\(\),3000\)/);
  assert.match(app,/document\.visibilityState!=='visible'/);
  assert.match(cloud,/\/api\/customer\/snapshot/);
  assert.doesNotMatch(cloud,/combo.*fixture|drink.*fixture/i);
});
