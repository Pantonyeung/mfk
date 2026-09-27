import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('FINAL P0 visual system is blue/white and keeps formal four-icon navigation',()=>{
  const css=read('src/styles.css');
  assert.match(css,/OWNER FINAL VISUAL SYSTEM P0/);
  assert.match(css,/--owner-final-navy:#103f78/);
  assert.match(css,/\.bottom-nav button::before/);
  assert.match(css,/width:min\(100%,440px\)/);
  assert.match(css,/@media\(max-width:380px\)/);
  assert.match(css,/sellability-media/);
});

test('P0 normal Owner surfaces do not expose engineering copy',()=>{
  const sources=[
    read('src/App.tsx'),
    read('src/today-components.tsx'),
    read('src/stage02-action-queue.tsx'),
    read('src/stage03-order-oversight.tsx'),
    read('src/channel-health.tsx'),
    read('src/sellability.tsx'),
    read('src/staff-overview.tsx'),
  ];

  const visible=[];
  for(const source of sources){
    for(const match of source.matchAll(/>([^<>{}\n][^<>{}]*)</g))visible.push(match[1].trim());
    for(const match of source.matchAll(/(?:placeholder|label|title|detail|subtitle|empty|aria-label)="([^"]+)"/g))visible.push(match[1].trim());
    for(const match of source.matchAll(/setNotice\('([^']+)'\)/g))visible.push(match[1].trim());
    for(const match of source.matchAll(/message:'([^']+)'/g))visible.push(match[1].trim());
  }

  const joined=visible.filter(Boolean).join('\n');
  for(const term of ['canonical','readback','projection','correlation','command seam','OA-','UNAVAILABLE','engineering timeline','Read-only oversight','Side-effects','Freshness','Desired','Observed']){
    assert.equal(joined.toLowerCase().includes(term.toLowerCase()),false,'engineering copy leaked: '+term);
  }
});

test('P0 surfaces retain locked authority boundaries in source',()=>{
  const orders=read('src/stage03-order-oversight.tsx');
  const staff=read('src/staff-overview.tsx');
  const sellability=read('src/sellability.tsx');
  assert.match(orders,/此頁只供查看/);
  assert.match(staff,/此頁只供查看/);
  assert.match(sellability,/商品結構同價格設定仍留喺 Admin/);
});
