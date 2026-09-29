import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const src=path.join(root,'src');
const read=(file)=>fs.readFileSync(path.join(src,file),'utf8');

const ui3=read('components/product-sheet-ui3.tsx');
const ui4=read('components/customer-checkout-ui4.tsx');
const ui5=read('components/customer-submit-ui5.tsx');
const ui6=read('components/customer-fulfillment-ui6.tsx');
const ui7=read('components/customer-pickup-ui7.tsx');
const ui8=read('components/customer-history-ui8.tsx');
const views=read('components/customer-views.tsx');
const app=read('App.tsx');
const css=read('styles.css');
const nav=read('ui/primitives.tsx');

test('Wave2 keeps UI3-UI9 human-facing copy free of the audited engineering labels',()=>{
  const renderedSources=[ui3,ui4,ui5,ui6,ui7,ui8];
  const forbidden=[
    'exact comboId',
    'canonical Combo',
    'ADMIN PUBLISHED',
    'SUBMISSION UNKNOWN',
    'WHATSAPP FALLBACK',
    'Current Quote',
    'Final Review',
    'Historical Order',
    'Copy Intent',
    'Pickup Code ≠ Display Number',
  ];
  for(const phrase of forbidden){
    for(const source of renderedSources)assert.equal(source.includes(phrase),false,phrase);
  }
  assert.equal(ui4.includes('SMT / 店員正式核對'),false);
  assert.equal(ui5.includes('UI5 · SUBMIT'),false);
  assert.equal(ui6.includes('未有 canonical state 就唔顯示'),false);
  assert.equal(ui7.includes('READY 仍然唔係 Completed'),false);
});

test('Wave2 keeps formal product media and uses approved company source assets',()=>{
  assert.match(ui3,/product\.imageUrl\?<img/);
  assert.match(views,/className="ui4-product-media-slot"/);
  assert.match(views,/data-product-media=\{product\?\.imageUrl\?'canonical':'pending'\}/);
  for(const source of [ui5,ui6,ui7,ui8,views]){
    assert.doesNotMatch(source,/data-final-art-pending="true"/);
    assert.match(source,/data-source-asset=/);
  }
  assert.match(views,/ui9-brand-art-slot/);\n  for(const source of [ui5,ui6,ui7,ui8,views])assert.match(source,/source-ip-crop/);
  assert.doesNotMatch(ui7,/stage7-pickup-(male|female)\.svg/);
  assert.doesNotMatch(ui8,/stage8-history-(male|female)\.svg/);
});

test('Wave2 keeps source-owned headers, human degraded states and the current V1 pickup window',()=>{
  assert.equal(app.includes('<CustomerHeader'),false);
  assert.match(ui4,/ui4-pickup-window/);
  assert.match(ui4,/即時取餐/);
  assert.doesNotMatch(ui6,/<span>\{freshness\}<\/span>/);
  assert.doesNotMatch(ui7,/<strong>\{freshness\}<\/strong>/);
});

test('Wave2 keeps the fixed five-item navigation visible across UI4-UI9',()=>{
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.match(nav,new RegExp(label));
  assert.match(nav,/data-final-art-pending="icon"/);
  assert.match(app,/view==='cart'\\|\\|view==='checkout'\\?'cart':view==='more'\\|\\|view==='account'\\|\\|view==='recovery'\\?'more':'orders'/);
  assert.match(css,/\.bottom-navigation button:nth-child\(3\)/);
  assert.match(css,/--customer-source-orange:#ef7d24/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(max-width:370px\)/);
});

test('UI10 is now a bounded presentation route and still does not smuggle account-recovery authority into Customer',()=>{
  const ui10=read('customer-ui10.tsx');
  const combined=[app,views,ui3,ui4,ui5,ui6,ui7,ui8,ui10].join('\n');
  assert.match(app,/\/support\/account-recovery/);
  assert.match(app,/\/member\/account/);
  assert.doesNotMatch(combined,/createTemporaryPassword|resetCustomerPassword|changeCustomerPhone|sendOtp|verifyOtp/i);
  assert.doesNotMatch(ui10,/fetch\(|XMLHttpRequest|sendBeacon/);
});

test('Wave2 matches the source cart and customer-facing state composition',()=>{
  assert.doesNotMatch(views,/<JarVisual count=\{itemCount\}\/>/);
  assert.doesNotMatch(views,/aria-label="Checkout 進度"/);
  assert.doesNotMatch(ui8,/<strong>\{state\}<\/strong>/);
  assert.match(ui8,/暫時未有訂單/);
  assert.match(ui4,/已提交付款憑證/);
  assert.match(ui5,/訂單已成功送達/);
  assert.match(ui5,/等待店舖確認/);
  assert.match(ui8,/再來一單/);
  assert.match(views,/加入磨飯到主畫面/);
  assert.match(views,/開啟訂單通知/);
});

test('UI9 keeps the formal-member IA Phone + Password only and fail-closed',()=>{
  assert.match(views,/ui9-membership-module/);
  assert.match(views,/用電話同密碼建立會員/);
  assert.match(views,/type="tel" disabled/);
  assert.match(views,/type="password" disabled/);
  assert.match(views,/SMS／Email 驗證碼/);
  assert.doesNotMatch(views,/sendOtp|verifyOtp|createTemporaryPassword|resetCustomerPassword/i);
});

test('Wave2 does not move transaction authority into presentation components',()=>{
  const combined=[ui3,ui4,ui5,ui6,ui7,ui8,views].join('\n');
  assert.doesNotMatch(combined,/createFormalOrder\(|allocateDisplayNumber\(|markOrderReady\(|completeOrder\(|updateFulfillment\(/);
  assert.match(ui5,/onSubmit/);
  assert.match(ui6,/onRefresh/);
  assert.match(ui8,/onStartReorder/);
});
