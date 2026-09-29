import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');
test('UI1 skeleton implements the five FINAL home situations without new authority',()=>{
  for(const mode of ['ORDER_ACTIVE','CLOSED','CAMPAIGN','RETURNING','NORMAL'])assert.ok(home.includes("'"+mode+"'"));
  assert.match(home,/data-home-mode=\{homeMode\}/);
  assert.match(home,/stage1-frequent-strip/);
  assert.match(home,/currentOrder\?<button className="stage1-live-order"/);
  assert.match(home,/store\?\.channelAvailable===false\?<section className="stage1-closed-panel"/);
  assert.match(home,/availableCouponCount\?<button className="stage1-promo-banner"/);
});

test('UI1 premium shortcut rail is 收藏 / 回憶券 / 期間限定 and does not duplicate bottom-order entry',()=>{
  const quick=home.slice(home.indexOf('stage1-quick-entry-section'),home.indexOf('stage1-top6'));
  for(const label of ['我的收藏','回憶券','期間限定'])assert.ok(quick.includes(label));
  assert.ok(!quick.includes('<strong>我的訂單</strong>'));
  assert.match(quick,/onClick=\{onBrowse\}[\s\S]*?<strong>期間限定<\/strong>/);
});
