import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');

test('UI1 mobile layout order is Header → Active Order → Hero → Search → Shortcuts → Categories → Products',()=>{
  const markers=[
    'stage1-mobile-header',
    'stage1-active-order',
    'stage1-hero-shell',
    'stage1-search',
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


test('UI1 Hero carousel collapses on scroll, delays the secondary banner, and opens full-screen detail',()=>{
  assert.ok(home.includes('HERO_SLIDES'));
  assert.ok(home.includes('heroProgress'));
  assert.ok(home.includes('showScrollBanner=heroProgress>=.52'));
  assert.ok(home.includes('stage1-scroll-banner'));
  assert.ok(home.includes('stage1-hero-modal'));
  assert.ok(home.includes('setHeroOpen(true)'));
  assert.ok(home.includes('relatedProducts'));
});
