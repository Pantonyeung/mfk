import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 Home preserves five brand situations without turning them into instruction copy',()=>{
  for(const mode of ['ORDER_ACTIVE','CLOSED','CAMPAIGN','RETURNING','NORMAL'])assert.ok(home.includes("'"+mode+"'"));
  assert.match(home,/data-home-mode=\{homeMode\}/);
  assert.ok(home.includes('stage1-welcome'));
  assert.match(home,/currentOrder\?<button className="stage1-live-order"/);
});

test('UI1 fixed shortcut rail is 我的收藏 / 回憶券 / 期間限定',()=>{
  const start=home.indexOf('<section className="stage1-quick-entry-section"');
  const end=home.indexOf('<section className="stage1-top6"');
  const quick=home.slice(start,end);
  for(const label of ['我的收藏','回憶券','期間限定'])assert.ok(quick.includes(label),label);
  assert.ok(quick.includes('onClick={onHistory}'));
  assert.ok(quick.includes('onClick={onMember}'));
  assert.ok(quick.includes('onClick={onBrowse}'));
});
