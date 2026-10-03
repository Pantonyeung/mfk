import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('FINAL source provenance is explicit and points to the supplied package files',()=>{
  const source=read('src/source-assets.ts');
  for(const marker of[
    'B3D808D8-931D-4FC7-8259-B5C1BF3934E2.jpeg',
    'AA9C700D-7045-4071-8BAE-22CABFD10FC1(1).jpeg',
    'IMG_5084.jpeg',
    'IMG_4585.jpeg',
    'stage0_launch_animation_storyboard_v1.png',
    '磨飯_stage_1_首頁品牌展示.png',
    'stage2_order_discovery_female_v1.png',
  ])assert.ok(source.includes(marker),marker);
});

test('UI0 uses supplied male/female IP sheets, 50:50 selection and owner-locked auto-Home handoff',()=>{
  const config=read('src/launch/launch-config.ts');
  const overlay=read('src/launch/LaunchOverlay.tsx');
  assert.ok(config.includes('CUSTOMER_FINAL_SOURCE.maleIpSheet.url'));
  assert.ok(config.includes('CUSTOMER_FINAL_SOURCE.femaleIpSheet.url'));
  assert.ok(config.includes("<.5?'male':'female'"));
  assert.doesNotMatch(config,/stage7-pickup|stage0-character-.*\.svg/);
  for(const mode of ["'reduced'","'returning'","'first'"])assert.ok(overlay.includes(mode),mode);
  for(const copy of['肚餓啦？','用心手作，','每一口都更幸福。'])assert.ok(overlay.includes(copy),copy);
  for(const removed of['進入主頁','進入會員頁'])assert.ok(!overlay.includes(removed),removed);
  assert.ok(overlay.includes("mode==='reduced'?120:mode==='returning'?700:2500"));
  assert.ok(overlay.includes('enterHomeRef.current()'));
});

test('UI1 implements the mobile-first large-hero R4 composition as real components',()=>{
  const home=read('src/stage1/Stage1Home.tsx');
  const css=read('src/stage1/stage1.css');
  for(const marker of['stage1-mobile-header','stage1-search','stage1-big-hero','stage1-quick-row','stage1-category-rail','stage1-product-section'])assert.ok(home.includes(marker),marker);
  assert.ok(home.includes("const HERO_IP_PAIR='https://cdn.creativeclaw.co/u/6ad84d58/images/c40034d5-c340-4af5-8819-68c52b236c09.png'"));
  assert.ok(home.includes('product.imageUrl'));
  assert.ok(home.includes('stage1-food-placeholder'));
  assert.ok(css.includes('.stage1-big-hero'));
  assert.ok(css.includes('@media(max-width:390px)'));
  assert.ok(css.includes('@media(max-width:360px)'));
  assert.ok(css.includes('@media(min-width:400px)'));
  assert.ok(!home.includes('CUSTOMER_FINAL_SOURCE.stage1Final.url'));
  assert.ok(!home.includes('stage1-source-hero'));
  for(const forbidden of['/brand/p0-riceball.webp','/brand/mf-home-hero-salad.webp','/brand/mf-home-hero-bowl.webp'])assert.ok(!home.includes(forbidden),forbidden);
});

test('UI2 keeps canonical product media and FINAL zero-result female IP repair',()=>{
  const menu=read('src/stage2/Stage2Menu.tsx');
  const nav=read('src/stage2/Stage2BottomNavigation.tsx');
  for(const marker of['product.imageUrl','mediaFor(product)','stage2-sold-out','stage2-favorite','stage2-search-field','stage2-category-rail','onCart','ZERO_RESULT_IP'])assert.ok(menu.includes(marker),marker);
  assert.ok(menu.includes('/brand/stage0-female.webp'));
  for(const copy of['暫時搵唔到呢個結果','不如試下其他分類？','返回點單'])assert.ok(menu.includes(copy),copy);
  for(const label of['首頁','點單','記憶罐','訂單','會員'])assert.ok(nav.includes(label),label);
});

test('mobile acceptance stays 360 / 390 / 412-oriented and touch safe',()=>{
  const stage1=read('src/stage1/stage1.css');
  const stage2=read('src/stage2/stage2.css');
  assert.ok(stage1.includes('max-width:480px'));
  assert.ok(stage1.includes('@media(max-width:390px)'));
  assert.ok(stage1.includes('@media(max-width:360px)'));
  assert.ok(stage1.includes('@media(min-width:400px)'));
  assert.ok(stage2.includes('min-height:44px'));
});
