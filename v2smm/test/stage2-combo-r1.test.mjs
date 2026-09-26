import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(testDir,'../..');
const smmRoot=path.resolve(testDir,'../src');
const read=(...parts)=>fs.readFileSync(path.join(...parts),'utf8');

const types=read(smmRoot,'product-types.ts');
const selection=read(smmRoot,'selection.ts');
const app=read(smmRoot,'App.tsx');
const worker=read(repoRoot,'v2smm','worker.ts');
const adapter=read(smmRoot,'smt-lan-adapter.ts');
const contract=read(repoRoot,'contracts','smm-lan-v1.ts');
const ingress=read(repoRoot,'v2local','src','runtime','smm-lan-ingress.ts');
const cloudIntake=read(repoRoot,'v2local','src','runtime','customer-cloud-intake.ts');

test('SMM menu projection exposes canonical Combo definitions and exact product binding',()=>{
  assert.match(types,/readonly combos\?:readonly SmmCombo\[\]/);
  assert.match(types,/readonly comboPools\?:readonly SmmComboPool\[\]/);
  assert.match(types,/readonly comboId\?:string/);
  assert.match(worker,/projectSyncedCombos\(envelope\)/);
  assert.match(worker,/matches\.length===1\?matches\[0\]!\.id:undefined/);
  assert.match(worker,/choice\.type==='PRODUCT'&&choice\.productId===productId/);
  assert.doesNotMatch(worker,/includes\(['"]套餐['"]\)|includes\(['"]飯團['"]\)/);
});

test('LAN snapshot mirrors the same canonical Combo projection without name/category heuristics',()=>{
  assert.match(ingress,/projectSyncedCombos\(envelope\)/);
  assert.match(ingress,/combos:Object\.freeze\(comboData\.combos\.map/);
  assert.match(ingress,/comboPools:Object\.freeze\(comboData\.pools\.map/);
  assert.match(ingress,/matches\.length===1\?matches\[0\]!\.id:undefined/);
  assert.doesNotMatch(ingress,/includes\(['"]套餐['"]\)|includes\(['"]飯團['"]\)/);
});

test('Stage 2 renders canonical Combo sections and validates them before Add',()=>{
  assert.match(app,/resolveSmmProductCombo\(product,menu\)/);
  assert.match(app,/stage2-combo-section/);
  assert.match(app,/套餐基礎價/);
  assert.match(app,/只讀 Admin 已發布 Combo \/ Pool；正式提交由 SMT 再驗證/);
  assert.match(app,/disabled=\{!validation\.ok\|\|!variationOk\|\|!comboValidation\.ok\}/);
  assert.match(selection,/pool\.addonKind==='DRINK'\?false:group\.required/);
  assert.match(selection,/pool\.addonKind==='DRINK'[\s\S]*\?0/);
  assert.doesNotMatch(selection,/product\.name.*套餐|category.*套餐/);
});

test('Combo identity and child selections survive local persistence and LAN/cloud transport',()=>{
  assert.match(types,/readonly combo\?:SmmCartComboIntent/);
  assert.match(contract,/readonly combo\?:SmmLanComboIntent/);
  assert.match(adapter,/line\.combo\?\{combo:Object\.freeze/);
  assert.match(worker,/request:orderRequest/);
  assert.match(worker,/requestFingerprint/);
  assert.match(cloudIntake,/validateSmmLanOrderRequest\(meta\.request\)/);
  assert.match(cloudIntake,/SMM_BRIDGE_SUBMISSION_MISMATCH/);
  assert.match(cloudIntake,/SMM_BRIDGE_IDEMPOTENCY_MISMATCH/);
});

test('SMT remains authoritative Combo revalidation seam and SMM does not create a Combo engine',()=>{
  assert.match(ingress,/revalidateSmmComboLine/);
  assert.match(ingress,/projectSyncedCombos\(envelope\)/);
  assert.match(ingress,/SMM_PUBLISHED_PRICE_CHANGED/);
  assert.match(app,/正式套餐內容同價格會由 SMT 再驗證/);
  assert.doesNotMatch(app,/function .*ComboEngine|class .*ComboEngine|createComboOrder/);
  assert.doesNotMatch(worker,/function .*ComboEngine|class .*ComboEngine|createComboOrder/);
});
