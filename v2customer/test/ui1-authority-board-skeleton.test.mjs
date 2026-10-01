import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 exposes factual store and order state without tutorial copy',()=>{
  for(const copy of ['營業中','休息中','更新中','等店舖確認','已接單','製作中','稍有延誤','可以取餐','需要協助','已完成'])assert.ok(home.includes(copy),copy);
  assert.match(home,/currentOrder\?<button className="stage1-active-order"/);
  assert.ok(home.includes("currentOrder.stage==='READY'&&currentOrder.pickupCode"));
  assert.ok(!home.includes('aria-label="通知"'));
});

test('UI1 keeps Owner-confirmed brand warmth and fixed shortcut entry trio',()=>{
  for(const copy of ['好好吃飯','讓日常更有趣','手作 · 輕食'])assert.ok(home.includes(copy),copy);
  for(const label of ['我的收藏','回憶券','期間限定'])assert.ok(home.includes(label),label);
});

test('UI1 Home is mobile-first with a large visual hero and direct discovery',()=>{
  for(const marker of['stage1-search','stage1-big-hero','stage1-category-rail','stage1-product-section'])assert.ok(home.includes(marker),marker);
  assert.ok(home.includes('onCategory:(categoryId:string)=>void'));
  assert.ok(!home.includes('CUSTOMER_FINAL_SOURCE.stage1Final.url'));
});
