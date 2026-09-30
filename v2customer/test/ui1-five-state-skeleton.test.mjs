import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 Home has only factual presentation modes and puts active order first',()=>{
  for(const mode of ['ORDER_ACTIVE','CLOSED','NORMAL'])assert.ok(home.includes("'"+mode+"'"));
  for(const removed of ['CAMPAIGN','RETURNING'])assert.ok(!home.includes("'"+removed+"'"),removed);
  assert.match(home,/data-home-mode=\{homeMode\}/);
  const activeIndex=home.indexOf('currentOrder?<button className="stage1-live-order"');
  const searchIndex=home.indexOf('<button className="stage1-search-entry"');
  assert.ok(activeIndex>=0&&searchIndex>activeIndex);
  assert.ok(!home.includes('stage1-welcome'));
  assert.ok(!home.includes('stage1-memory-strip'));
});

test('UI1 contextual actions are conditional, factual and do not duplicate fake product truth',()=>{
  assert.ok(home.includes('lastOrder?<button'));
  assert.ok(home.includes('availableCouponCount?<button'));
  assert.ok(home.includes('stage1-product-image-empty'));
  assert.ok(!home.includes('我的收藏'));
  assert.ok(!home.includes('期間限定'));
  assert.ok(!home.includes('stage1-shortcut-'));
});
