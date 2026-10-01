import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 mobile layout order is Header → Active Order → Search → Hero → Shortcuts → Categories → Products',()=>{
  const markers=[
    'stage1-mobile-header',
    'stage1-active-order',
    'stage1-search',
    'stage1-big-hero',
    'stage1-quick-row',
    'stage1-category-section',
    'stage1-product-section',
  ];
  const indexes=markers.map(marker=>home.indexOf(marker));
  for(const index of indexes)assert.ok(index>=0);
  for(let i=1;i<indexes.length;i++)assert.ok(indexes[i]>indexes[i-1],markers[i]);
});

test('UI1 fixed shortcut rail maps to real destinations',()=>{
  for(const label of['我的收藏','回憶券','期間限定'])assert.ok(home.includes(label),label);
  assert.ok(home.includes('onFavorites:()=>void'));
  assert.ok(home.includes('onLimited:()=>void'));
  assert.ok(home.includes('onMember:()=>void'));
});

test('UI1 category rail is data-driven and routes to Browse',()=>{
  assert.ok(home.includes('const categories=menu?.categories??[]'));
  assert.ok(home.includes('onCategory(category.categoryId)'));
});
