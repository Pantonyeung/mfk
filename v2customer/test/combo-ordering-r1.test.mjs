import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const repoRoot=path.resolve(here,'../..');

const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const selection=fs.readFileSync(path.join(src,'selection.ts'),'utf8');
const quote=fs.readFileSync(path.join(src,'local-quote.ts'),'utf8');
const views=fs.readFileSync(path.join(src,'components/customer-views.tsx'),'utf8');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const persistence=fs.readFileSync(path.join(src,'persistence.ts'),'utf8');
const cloudRuntime=fs.readFileSync(path.join(src,'cloud-runtime.ts'),'utf8');
const cloudContract=fs.readFileSync(path.join(repoRoot,'contracts/customer-cloud-v1.ts'),'utf8');

test('Customer cart has bounded canonical Combo intent shape',()=>{
  for(const marker of[
    'export interface CustomerCartComboSelection',
    'readonly poolId:string',
    'readonly groupId:string',
    'readonly subPoolId:string',
    'readonly choiceId:string',
    'readonly choiceType:CustomerComboChoiceType',
    'readonly choiceLabel:string',
    'readonly publishedAdjustmentMinor:number',
    'export interface CustomerCartComboIntent',
    'readonly comboId:string',
    'readonly comboName:string',
    'readonly publishedBasePriceMinor:number',
    'readonly combo?:CustomerCartComboIntent',
  ])assert.ok(types.includes(marker),marker);
});

test('Combo draft selection uses exact IDs and banked DRINK optional semantics only',()=>{
  for(const marker of[
    'export type CustomerComboSelectionState',
    'toggleCustomerComboSelection',
    'validateCustomerComboSelection',
    'selectedCustomerComboIntent',
    "pool.addonKind==='DRINK'?0",
    'product.comboId',
    'combo.comboId===product.comboId',
    'choice.choiceId===draft.choiceId',
  ])assert.ok(selection.includes(marker),marker);
  for(const forbidden of['includes(\'套餐\')','includes("套餐")','categoryId.includes','product.name.includes']){
    assert.ok(!selection.includes(forbidden),forbidden);
  }
});

test('ProductSheet consumes canonical Combo projection and renders selectable Combo section',()=>{
  for(const marker of[
    "kind:'combo'",
    'menu?.combos',
    'menu?.comboPools',
    'product.comboId',
    '升級套餐',
    '套餐基本價',
    'addonKind',
    'publishedAdjustmentMinor',
    'disabled={!choice.available}',
  ])assert.ok(views.includes(marker),marker);
  assert.ok(views.includes('toggleCombo'));
  assert.ok(views.includes('comboEnabled'));
});

test('valid Combo is written into CustomerCartLine while standalone ordering remains possible',()=>{
  for(const marker of[
    'selectedComboEnabled',
    'selectedComboSelections',
    'selectedCustomerComboIntent',
    'comboIntent',
    '...(comboIntent?{combo:comboIntent}:{})',
  ])assert.ok(app.includes(marker),marker);
  assert.ok(app.includes('line?.combo'));
});

test('published local quote uses Combo base plus selected Combo adjustments and ordinary option adjustments',()=>{
  for(const marker of[
    'line.combo',
    'combo.publishedBasePriceMinor',
    'subPool.publishedAdjustmentMinor',
    'choice.publishedAdjustmentMinor',
    'comboPublishedFactsChanged',
  ])assert.ok(quote.includes(marker),marker);
  assert.ok(quote.includes("'MATERIAL_CHANGE'"));
});

test('local persistence and cloud submit preserve the same Combo-bearing cart identity',()=>{
  assert.ok(persistence.includes('cart:Object.freeze([...workspace.cart])'));
  assert.ok(persistence.includes('pendingIntents:Object.freeze([...workspace.pendingIntents])'));
  assert.ok(cloudRuntime.includes('cart:intent.cart'));
  assert.ok(cloudRuntime.includes('submissionId:intent.submissionId'));
  assert.ok(cloudRuntime.includes('idempotencyKey:intent.idempotencyKey'));
});

test('Customer Cloud contract validates and preserves bounded Combo payload',()=>{
  for(const marker of[
    'export interface CustomerCloudComboSelection',
    'export interface CustomerCloudComboIntent',
    'readonly combo?:CustomerCloudComboIntent',
    'function comboSelection',
    'function comboIntent',
    'CUSTOMER_COMBO_SELECTIONS_INVALID',
    'CUSTOMER_COMBO_CHOICE_TYPE_INVALID',
    'CUSTOMER_COMBO_PRODUCT_ID_REQUIRED',
    '...(row.combo!==undefined?{combo:comboIntent',
  ])assert.ok(cloudContract.includes(marker),marker);
});

test('Customer Combo completion adds no second authority engine',()=>{
  const combined=[types,selection,quote,views,app,cloudRuntime,cloudContract].join('\n');
  for(const forbidden of[
    'class CustomerComboEngine',
    'class ComboEngine',
    'class CustomerPricingEngine',
    'SECOND_PRICING_ENGINE',
    'createFormalOrder(',
  ])assert.ok(!combined.includes(forbidden),forbidden);
});


test('stale missing Combo can be repaired back to standalone from ProductSheet',()=>{
  assert.ok(views.includes('套餐資料待同步，暫時只可以主餐方式加入。'));
  assert.equal((views.match(/>只要主餐</g)||[]).length,2);
});

test('cart review exposes selected Combo identity and choices to the customer',()=>{
  assert.ok(views.includes('line.combo?.comboName'));
  assert.ok(views.includes('line.combo?.selections.map(item=>item.choiceLabel)'));
});
