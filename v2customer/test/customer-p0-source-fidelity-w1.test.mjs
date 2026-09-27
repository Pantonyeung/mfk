import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('UI0 uses dedicated Stage0 assets and preserves 50:50, first, returning and reduced motion',()=>{
  const config=read('src/launch/launch-config.ts');
  const overlay=read('src/launch/LaunchOverlay.tsx');
  assert.match(config,/stage0-character-male\.svg/);
  assert.match(config,/stage0-character-female\.svg/);
  assert.doesNotMatch(config,/stage7-pickup/);
  assert.match(config,/<\.5\?'male':'female'/);
  for(const mode of ["'reduced'","'returning'","'first'"])assert.match(overlay,new RegExp(mode));
  assert.match(overlay,/onEnterHome/);
  assert.match(overlay,/onEnterMember/);
});

test('UI1 renders canonical product media and removes transaction-engine wording from the touched home presentation',()=>{
  const home=read('src/stage1/Stage1Home.tsx');
  assert.match(home,/item\.product\.imageUrl/);
  assert.match(home,/item\.product\.imageAlt\?\?item\.product\.name/);
  assert.doesNotMatch(home,/Browse \/ Build Cart|正式 Commit|正式投影|Coupon 狀態|Reorder 會/);
});

test('UI2 renders canonical product media, sold-out, favorite, search, cart and final five-tab navigation',()=>{
  const menu=read('src/stage2/Stage2Menu.tsx');
  const nav=read('src/stage2/Stage2BottomNavigation.tsx');
  for(const marker of['product.imageUrl','stage2-sold-out','stage2-favorite','stage2-search-field','onCart'])assert.match(menu,new RegExp(marker.replace('.','\\.')));
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.match(nav,new RegExp(label));
  assert.match(nav,/stage2-nav-icon/);
  assert.match(nav,/data-center=\{item\.id==='cart'\|\|undefined\}/);
});

test('390 baseline and 360 minimum remain explicitly responsive',()=>{
  const stage1=read('src/stage1/stage1.css');
  const stage2=read('src/stage2/stage2.css');
  assert.match(stage1,/max-width:480px/);
  assert.match(stage1,/@media\(max-width:360px\)/);
  assert.match(stage2,/max-width:480px/);
  assert.match(stage2,/@media\(max-width:360px\)/);
});
