import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../..');
const customerRoot=path.resolve(here,'..');
const types=fs.readFileSync(path.join(customerRoot,'src','product-types.ts'),'utf8');
const app=fs.readFileSync(path.join(customerRoot,'src','App.tsx'),'utf8');
const worker=fs.readFileSync(path.join(repoRoot,'v2admin','worker.ts'),'utf8');

test('Customer public menu exposes Admin-published Combo and Combo Pool projection',()=>{
  assert.match(types,/readonly combos\?:readonly CustomerCombo\[\]/);
  assert.match(types,/readonly comboPools\?:readonly CustomerComboPool\[\]/);
  assert.match(types,/readonly comboId\?:string/);
  assert.match(worker,/rows\(catalog\.combos\)/);
  assert.match(worker,/rows\(catalog\.comboPools\)/);
  assert.match(worker,/publishedBasePriceMinor:minorFromMoney\(combo\.basePrice\)/);
  assert.match(worker,/publishedAdjustmentMinor:minorFromMoney\(choice\.priceAdjustment\)/);
  assert.match(worker,/publishedAdjustmentMinor:minorFromMoney\(band\.priceAdjustment\)/);
  assert.match(worker,/comboPools,/);
  assert.match(worker,/combos,/);
});

test('Drink choices stay inside the canonical ADDON DRINK pool instead of a second drink engine',()=>{
  assert.match(types,/addonKind\?:'SNACK'\|'DRINK'/);
  assert.match(worker,/pool\.addonKind==='DRINK'\?'DRINK':'SNACK'/);
  assert.match(worker,/choiceType:choice\.choiceType==='LABEL'\?'LABEL':choice\.choiceType==='NONE'\?'NONE':'PRODUCT'/);
  assert.doesNotMatch(worker,/createCustomerDrinkEngine|CustomerDrinkEngine|infer.*drink/i);
});

test('Customer product Combo binding is exact canonical main-pool membership only',()=>{
  assert.match(worker,/const uniqueComboIdForProduct=productId=>/);
  assert.match(worker,/matches\.length===1\?matches\[0\]\.comboId:undefined/);
  assert.match(worker,/choice\.choiceType==='PRODUCT'&&choice\.productId===productId/);
  assert.doesNotMatch(worker,/includes\(['"]套餐['"]\)|includes\(['"]飯團['"]\)|category.*套餐/i);
});

test('Existing Admin option-center projection continues to carry ordinary drink option updates',()=>{
  assert.match(worker,/const optionCenter=row\(snapshot\.optionCenter\)/);
  assert.match(worker,/rows\(optionCenter\.sets\)/);
  assert.match(worker,/rows\(optionCenter\.productLinks\)/);
  assert.match(worker,/publishedAdjustmentMinor:minorFromMoney\(option\.priceAdjustment\)/);
});

test('Visible Customer app follows config doorbell and resume reconciliation without full-config polling',()=>{
  assert.match(app,/port\.subscribeConfigChanges\?\.\(\(\)=>void reconcile\(\)\)/);
  assert.match(app,/document\.addEventListener\('visibilitychange',visible\)/);
  assert.match(app,/window\.addEventListener\('focus',focused\)/);
  assert.match(app,/window\.addEventListener\('pageshow',pageShown\)/);
  assert.match(app,/window\.addEventListener\('online',online\)/);
  assert.match(app,/const next=await port\.readSnapshot\(\)/);
  assert.doesNotMatch(app,/setInterval\(\(\)=>void poll\(\),3000\)/);
  assert.match(app,/snapshot\?\.activeOrders\.length/);
});
