import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');

test('fresh Stage 2 integration preserves canonical combo projection fields',()=>{
  assert.ok(types.includes('readonly comboId?'));
  assert.ok(types.includes('readonly combos'));
  assert.ok(types.includes('readonly comboPools'));
});

test('fresh Stage 2 integration does not create a second combo or pricing authority',()=>{
  for(const forbidden of[
    'class ComboEngine',
    'function priceCombo',
    'function quoteCombo',
    'SECOND_PRICING_ENGINE',
  ])assert.ok(!types.includes(forbidden),forbidden);
});
