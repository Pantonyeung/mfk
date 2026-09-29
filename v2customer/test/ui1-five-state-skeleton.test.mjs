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
