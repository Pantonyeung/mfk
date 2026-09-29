import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');
test('UI1 FINAL home keeps source quick-entry hierarchy and canonical handlers',()=>{
  for(const label of ['我的訂單','我的收藏','回憶券'])assert.ok(home.includes('<strong>'+label+'</strong>'));
  assert.match(home,/onClick=\{onOrders\}[\s\S]*?<strong>我的訂單<\/strong>/);
  assert.match(home,/onClick=\{onHistory\}[\s\S]*?<strong>我的收藏<\/strong>/);
  assert.match(home,/onClick=\{onMember\}[\s\S]*?<strong>回憶券<\/strong>/);
  assert.ok(home.indexOf('stage1-hero-banner')<home.indexOf('stage1-quick-entry-section'));
  assert.ok(home.indexOf('stage1-quick-entry-section')<home.indexOf('stage1-top6'));
});
