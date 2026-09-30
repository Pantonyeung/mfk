import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 human-logic Home exposes factual store and order state without unsupported affordances',()=>{
  for(const copy of ['營業中','休息中','todayHours','等店舖確認','已接單','製作中','稍有延誤','可以取餐','需要協助','已完成'])assert.ok(home.includes(copy),copy);
  assert.match(home,/todayHours\?' · '\+todayHours/);
  assert.match(home,/currentOrder\?<button className="stage1-live-order"/);
  assert.ok(home.includes("currentOrder.stage==='READY'&&currentOrder.pickupCode"));
  assert.ok(!home.includes('aria-label="通知"'));
  assert.ok(!home.includes('stage1-store-chevron'));
});

test('UI1 only exposes factual contextual shortcuts',()=>{
  assert.ok(home.includes('lastOrder||availableCouponCount'));
  assert.ok(home.includes('再來一單'));
  assert.ok(home.includes('回憶券'));
  assert.ok(!home.includes('我的收藏'));
  assert.ok(!home.includes('期間限定'));
});
