import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const main=fs.readFileSync(path.join(srcRoot,'main.tsx'),'utf8');
const primitives=fs.readFileSync(path.join(srcRoot,'ui/primitives.tsx'),'utf8');
const system=fs.readFileSync(path.join(srcRoot,'ui/customer-design-system.css'),'utf8');
const tokens=fs.readFileSync(path.join(srcRoot,'ui/design-tokens.ts'),'utf8');

test('Customer UI System V1 loads after the legacy stylesheet',()=>{
  const legacyIndex=main.indexOf("import './styles.css'");
  const systemIndex=main.indexOf("import './ui/customer-design-system.css'");
  assert.ok(legacyIndex>=0);
  assert.ok(systemIndex>legacyIndex);
});

test('bottom navigation uses the canonical five-item vocabulary',()=>{
  for(const label of['首頁','點單','記憶罐','訂單','會員']){
    assert.ok(primitives.includes("label:'"+label+"'"));
  }
  assert.ok(!primitives.includes("label:'我的訂單'"));
  assert.ok(!primitives.includes("label:'我的記憶'"));
});

test('brand, semantic and character accent tokens are distinct',()=>{
  for(const marker of[
    '--mf-color-brand-navy:#15396b',
    '--mf-color-brand-orange:#f07f24',
    '--mf-color-success:#3a9a68',
    '--mf-color-error:#d75d5d',
    '--mf-color-female-accent:#8659b5',
    '--mf-color-male-accent:#2467b2',
  ])assert.ok(system.includes(marker));
  assert.ok(tokens.includes('Business/transaction states must use semantic'));
});

test('touch size and reduced motion contracts stay explicit',()=>{
  assert.ok(system.includes('--mf-touch-min:44px'));
  assert.ok(system.includes('@media(prefers-reduced-motion:reduce)'));
});


test('Stage 1 storefront follows the locked home brief',()=>{
  const views=fs.readFileSync(path.join(srcRoot,'components/customer-views.tsx'),'utf8');
  assert.ok(views.includes("const canBrowse=Boolean(snapshot?.menu);"));
  assert.ok(views.includes('人氣推薦 · TOP 6'));
  for(const label of['記憶券','常購清單','期間限定'])assert.ok(views.includes(label));
  assert.ok(views.includes('仍然可以慢慢睇、慢慢揀。'));
  assert.ok(views.includes("recommendations.filter(item=>item.product.available).slice(0,6)"));
});
