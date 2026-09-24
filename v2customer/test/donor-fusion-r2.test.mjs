import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'..');
const srcRoot=path.join(root,'src');

function collectSource(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())return collectSource(target);
    return /\.(ts|tsx|css)$/.test(entry.name)?[fs.readFileSync(target,'utf8')]:[];
  }).join('\n');
}

const source=collectSource(srcRoot);
const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
const views=fs.readFileSync(path.join(srcRoot,'components/customer-views.tsx'),'utf8');
const types=fs.readFileSync(path.join(srcRoot,'product-types.ts'),'utf8');
const primitives=fs.readFileSync(path.join(srcRoot,'ui/primitives.tsx'),'utf8');
const styles=fs.readFileSync(path.join(srcRoot,'styles.css'),'utf8');

test('R2 keeps the five-part customer mental model and complete memory jar',()=>{
  for(const label of['首頁','點單','記憶罐','我的訂單','我的記憶'])assert.match(primitives,new RegExp(label));
  for(const marker of['記憶罐係今次落單草稿','今次已選','取餐聯絡','店舖正式報價','前往最後確認'])assert.match(views,new RegExp(marker));
  assert.match(views,/JarVisual/);
  assert.match(views,/removeConfirm/);
  assert.match(views,/onProduct\(product,[\s\S]*line/);
  assert.match(views,/正式訂單紀錄冇被刪除/);
  assert.match(views,/hideFromView/);
});

test('product configuration is progressive and preserves required min max unavailable validation',()=>{
  assert.match(views,/設定進度/);
  assert.match(views,/目前步驟/);
  assert.match(views,/已完成/);
  assert.match(views,/最少/);
  assert.match(views,/最多/);
  assert.match(views,/disabled=\{!option\.available\}/);
  assert.match(app,/validateCustomerSelections/);
});

test('member ecosystem is read-only projection with honest disconnected states',()=>{
  for(const marker of['CustomerMemberProjection','CustomerMemorySeedProjection','CustomerMemoryBadgeProjection','CustomerMemoryCouponProjection'])assert.match(types,new RegExp(marker));
  for(const marker of['記憶種子','下一個小心意','回憶券','記憶勳章','常食味道','More Fun Care'])assert.match(source,new RegExp(marker,'i'));
  assert.match(views,/等待正式資料/);
  assert.doesNotMatch(views,/>NOT WIRED</);
  assert.doesNotMatch(source,/10\s*seeds|30\s*seeds|seeds\s*[%+*/-]\s*10/i);
});

test('no obsolete donor runtime or customer-side business authority is transplanted',()=>{
  for(const pattern of[/FRONTEND_STORE_RULES_LOCK/,/Apps Script/i,/Firebase/i,/Google Sheet/i,/phone-last-4/i,/createFormalOrder/,/allocateDisplayNumber/])assert.doesNotMatch(source,pattern);
  const cloud=fs.readFileSync(path.join(srcRoot,'cloud-runtime.ts'),'utf8');
  const nonCloud=fs.readdirSync(srcRoot,{withFileTypes:true}).flatMap(entry=>{
    if(entry.name==='cloud-runtime.ts')return[];
    const target=path.join(srcRoot,entry.name);
    if(entry.isDirectory())return collectSource(target);
    return /\.(ts|tsx)$/.test(entry.name)?[fs.readFileSync(target,'utf8')]:[];
  }).join('\n');
  assert.match(cloud,/https:\/\/admin\.morefunos\.com/);
  assert.doesNotMatch(nonCloud,/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/);
  assert.match(app,/port\?\.submitOrder/);
  assert.match(app,/port\?\.buildReorderCart/);
});

test('R2 visual and interaction systems are tokenized and accessible',()=>{
  for(const token of['--purple','--green','--coral','--motion-micro','--motion-layout','--motion-sheet'])assert.match(styles,new RegExp(token));
  assert.match(styles,/min-height:44px/);
  assert.match(styles,/:focus-visible/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles,/scale\(\.97\)/);
  assert.match(primitives,/PullRefreshSurface/);
  assert.match(primitives,/returnFocusId/);
});

test('brand photography and reproducible browser acceptance surface exist outside production entry',()=>{
  for(const asset of['mf-home-hero-bowl.webp','mf-home-hero-f4.webp','mf-home-hero-salad.webp'])assert.equal(fs.existsSync(path.join(root,'public/brand',asset)),true);
  assert.equal(fs.existsSync(path.join(root,'visual-acceptance.html')),true);
  assert.equal(fs.existsSync(path.join(testDir,'visual-acceptance.mjs')),true);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'index.html'),'utf8'),/visual-acceptance/);
});
