import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 human-logic Home exposes factual store and order state without unsupported controls',()=>{
  for(const copy of ['營業中','休息中','todayHours','等店舖確認','已接單','製作中','稍有延誤','可以取餐','需要協助','已完成'])assert.ok(home.includes(copy),copy);
  assert.match(home,/todayHours\?' · '\+todayHours/);
  assert.match(home,/currentOrder\?<button className="stage1-live-order"/);
  assert.ok(home.includes("currentOrder.stage==='READY'&&currentOrder.pickupCode"));
  assert.ok(!home.includes('aria-label="通知"'));
  assert.ok(!home.includes('stage1-store-chevron'));
});

test('UI1 keeps Owner-confirmed warmth copy and fixed shortcut entry trio',()=>{
  assert.ok(home.includes('stage1-welcome'));
  for(const copy of ['辛苦了！美味正在為你準備中','歡迎回來，今天也要好好吃飯！','早安，今天想食咩？'])assert.ok(home.includes(copy),copy);
  for(const label of ['我的收藏','回憶券','期間限定'])assert.ok(home.includes(label),label);
});
