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

test('UI1 skeleton prioritizes active order before the hero frame',()=>{
  const orderIndex=home.indexOf('className="stage1-live-order"');
  const heroIndex=home.indexOf('className="stage1-hero-frame"');
  assert.ok(orderIndex>0);
  assert.ok(heroIndex>orderIndex);
});

test('UI1 returning state restores a bounded frequent preview without inventing a new route',()=>{
  assert.match(home,/const frequentRecommendations=history\.length\?topRecommendations\.slice\(0,4\):\[\]/);
  assert.match(home,/homeMode==='RETURNING'&&frequentRecommendations\.length/);
  assert.match(home,/onClick=\{onHistory\}>查看全部<\/button>/);
  assert.doesNotMatch(home,/frequentRoute|changeView\('frequent'/);
});

test('UI1 Phase A keeps generated visual assets out of the implemented skeleton',()=>{
  assert.ok(home.includes('data-ui-phase="SKELETON"'));
  assert.doesNotMatch(home,/mf-home-storefront-hero-v1|stage1-hero-bg-.*\.(png|jpg|webp)|stage1-hero-ip-.*\.(png|jpg|webp)/);
  for(const slot of['HERO_BG_SLOT','HERO_IP_SLOT','HERO_FOOD_SLOT','MEMORY_TICKET_ICON_SLOT','TOP6_PRODUCT_IMAGE_SLOT'])assert.ok(home.includes(slot),slot);
});
