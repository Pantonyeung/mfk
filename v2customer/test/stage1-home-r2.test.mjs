import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');

const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const home=fs.readFileSync(path.join(srcRoot,'stage1/Stage1Home.tsx'),'utf8');
const css=fs.readFileSync(path.join(srcRoot,'stage1/stage1-home.css'),'utf8');
const primitives=fs.readFileSync(path.join(srcRoot,'ui/primitives.tsx'),'utf8');

test('Stage 1 uses a separate homepage component without order/payment authority',()=>{
  assert.ok(app.includes('Stage1Home'));
  for(const forbidden of['submitOrder(','quoteCart(','createFormalOrder','allocateDisplayNumber','uploadPaymentEvidence']){
    assert.ok(!home.includes(forbidden),forbidden+' must not exist in Stage1Home');
  }
});

test('Stage 1 uses AI-generated brand artwork and never renders product photography',()=>{
  assert.ok(home.includes('57ce2f93-c8d0-491d-9bd0-23a2be364d14.png'));
  assert.ok(home.includes('stage1-product-placeholder'));
  assert.ok(!home.includes('product.imageUrl'));
  assert.ok(!home.includes('ProductMedia'));
});

test('Stage 1 has the locked storefront structure',()=>{
  for(const marker of['stage1-store-status','stage1-hero','stage1-announcement','stage1-top6','記憶券','常購清單','期間限定']){
    assert.ok(home.includes(marker),marker);
  }
});

test('closed store can still browse and build intent while commit remains outside Stage 1',()=>{
  assert.ok(home.includes('const canBrowse=Boolean(snapshot?.menu)'));
  assert.ok(home.includes('今日暫停正式落單'));
  assert.ok(home.includes('繼續睇菜單'));
});

test('Top 6 is bounded to six and uses current recommendation projection',()=>{
  assert.ok(app.includes('limit:6'));
  assert.ok(home.includes('recommendations.filter(item=>item.product.available).slice(0,6)'));
});

test('Stage 1 bottom navigation uses canonical customer vocabulary',()=>{
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.ok(primitives.includes("label:'"+label+"'"));
  assert.ok(!primitives.includes("label:'我的訂單'"));
  assert.ok(!primitives.includes("label:'我的記憶'"));
});

test('Stage 1 remains mobile-first and reduced-motion safe',()=>{
  assert.ok(css.includes('@media(max-width:620px)'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});
