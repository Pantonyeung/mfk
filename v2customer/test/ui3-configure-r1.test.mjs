import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const views=fs.readFileSync(path.join(src,'components/product-sheet-ui3.tsx'),'utf8');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const css=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const nav=fs.readFileSync(path.join(src,'stage2/Stage2BottomNavigation.tsx'),'utf8');
const selection=fs.readFileSync(path.join(src,'selection.ts'),'utf8');
const quote=fs.readFileSync(path.join(src,'local-quote.ts'),'utf8');
const cloud=fs.readFileSync(path.join(src,'../../contracts/customer-cloud-v1.ts'),'utf8');
const intake=fs.readFileSync(path.join(src,'../../v2local/src/runtime/customer-cloud-intake.ts'),'utf8');

test('UI3 Product Detail follows the locked Configure flow order',()=>{
  const start=views.indexOf('export function ProductSheet');
  assert.ok(start>=0);
  const body=views.slice(start);
  const markers=[
    'data-ui3-section="hero"',
    'data-ui3-section="combo"',
    'data-ui3-section="required"',
    'data-ui3-section="optional"',
    'data-ui3-section="quantity"',
    'data-ui3-section="recommendation"',
    'data-ui3-section="summary"',
    'data-ui3-section="add"',
  ];
  let previous=-1;
  for(const marker of markers){
    const index=body.indexOf(marker);
    assert.ok(index>previous,marker);
    previous=index;
  }
});

test('UI3 keeps exact five-nav with 記憶罐 in the center',()=>{
  const labels=["label:'首頁'","label:'點單'","label:'記憶罐'","label:'訂單'","label:'會員'"];
  let previous=-1;
  for(const label of labels){
    const index=nav.indexOf(label);
    assert.ok(index>previous,label);
    previous=index;
  }
  assert.match(nav,/data-center=\{item\.id==='cart'\|\|undefined\}/);
});

test('UI3 Combo renders only from exact product.comboId and never heuristics',()=>{
  assert.match(views,/const combo=product\.comboId\?menu\?\.combos\?\.find\(item=>item\.comboId===product\.comboId\):undefined/);
  assert.match(views,/\{product\.comboId\?<section className="ui3-config-section ui3-combo-section"/);
  for(const forbidden of["includes('套餐')",'includes("套餐")','categoryId.includes','product.name.includes']){
    assert.equal(selection.includes(forbidden),false,forbidden);
    assert.equal(views.includes(forbidden),false,forbidden);
  }
});

test('UI3 required validation, unavailable choices and price readiness block Add locally',()=>{
  assert.match(views,/const addReady=product\.available&&variationOk&&validation\.ok&&comboValidation\.ok&&priceReady&&quantity>=1/);
  assert.match(views,/disabled=\{!choice\.available\|\|\(maxReached&&!active\)\}/);
  assert.match(views,/disabled=\{!option\.available\|\|\(maxReached&&!isSelected\)\}/);
  assert.match(views,/disabled=\{!addReady\}/);
  assert.match(views,/價格待同步/);
});

test('UI3 published preview exposes Combo base and canonical adjustments only',()=>{
  assert.match(views,/combo\.publishedBasePriceMinor/);
  assert.match(views,/subPool\.publishedAdjustmentMinor/);
  assert.match(views,/choice\.publishedAdjustmentMinor/);
  assert.match(views,/customerComboPublishedUnitMinor/);
  assert.match(views,/已發布套餐基本價/);
  assert.match(views,/正式提交由 SMT 再核對/);
  assert.match(quote,/comboPublishedFactsChanged/);
});

test('UI3 recommendation is non-blocking and uses no fake product media',()=>{
  assert.match(views,/recommendations\.length\?/);
  assert.match(views,/暫時未有合適推薦；可以照常完成今次設定/);
  assert.doesNotMatch(views,/addReady=.*recommend/);
  assert.match(views,/product-media-fallback true-empty/);
  assert.doesNotMatch(views,/product\.name\.slice\(0,1\)/);
});

test('UI3 mobile contract is <=480px, touch-safe, sticky and Reduced Motion aware',()=>{
  assert.match(css,/\.product-dialog \.dialog-surface\{[\s\S]*max-width:480px/);
  assert.match(css,/\.ui3-quantity-section button\{[\s\S]*min-width:44px;[\s\S]*min-height:44px/);
  assert.match(css,/\.ui3-sticky-actions\{[\s\S]*position:sticky/);
  assert.match(css,/\.ui3-sticky-actions \.action-button\{[\s\S]*min-height:52px/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('UI3 recommendation wiring does not create another cart/order identity',()=>{
  assert.match(app,/productRecommendations=selectedProduct\?buildCustomerRecommendations/);
  assert.match(app,/recommendations=\{productRecommendations\}/);
  assert.doesNotMatch(app,/createFormalOrder\(/);
});

test('Combo intent remains bounded through Customer Cloud and existing SMT revalidation',()=>{
  for(const marker of[
    'readonly combo?:CustomerCloudComboIntent',
    'CUSTOMER_COMBO_SELECTIONS_INVALID',
    'CUSTOMER_COMBO_CHOICE_TYPE_INVALID',
  ])assert.ok(cloud.includes(marker),marker);
  for(const marker of[
    'customerLineToSmmLanLine',
    'combo:line.combo',
    'revalidateSmmComboLine',
  ])assert.ok(intake.includes(marker),marker);
  assert.doesNotMatch(intake,/CustomerComboEngine|CustomerPricingEngine/);
});
