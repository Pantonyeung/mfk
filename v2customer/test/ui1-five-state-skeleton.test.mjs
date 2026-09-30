import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');
test('UI1 skeleton implements the five FINAL home situations without new authority',()=>{
  for(const mode of ['ORDER_ACTIVE','CLOSED','CAMPAIGN','RETURNING','NORMAL'])assert.ok(home.includes("'"+mode+"'"));
  assert.match(home,/data-home-mode=\{homeMode\}/);
  assert.match(home,/currentOrder\?<button className="stage1-live-order"/);
  assert.match(home,/store\?\.channelAvailable===false\?<section className="stage1-closed-panel"/);
  assert.match(home,/availableCouponCount\?<button className="stage1-promo-banner"/);
  for(const state of ['state-loading','state-empty','state-stale','state-offline','state-error'])assert.ok(home.includes(state),state);
});

test('UI1 shortcut rail is canonical 記憶券 / 常購清單 / 期間限定 in that order',()=>{
  const quick=home.slice(home.indexOf('<section className="stage1-quick-entry-section"'),home.indexOf('<section className="stage1-top6"'));
  const labels=['記憶券','常購清單','期間限定'];
  for(const label of labels)assert.ok(quick.includes(label));
  assert.ok(labels.every((label,index)=>index===0||quick.indexOf(labels[index-1])<quick.indexOf(label)));
  assert.doesNotMatch(quick,/我的收藏|我的訂單|回憶券/);
  assert.match(quick,/onClick=\{onBrowse\}[\s\S]*?<strong>期間限定<\/strong>/);
});

test('UI1 keeps Top 6 and closed browsing on existing presentation handlers',()=>{
  assert.match(home,/recommendations\.filter\(item=>item\.product\.available\)\.slice\(0,6\)/);
  assert.match(home,/const canBrowse=Boolean\(snapshot\?\.menu\)/);
  assert.match(home,/stage1-closed-panel[\s\S]*?onClick=\{onBrowse\}/);
  assert.doesNotMatch(home,/submitOrder|quoteCart|channelAvailable\s*=(?!=)/);
});
