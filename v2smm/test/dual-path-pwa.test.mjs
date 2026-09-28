import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const contract=readFileSync(new URL('../../contracts/smm-lan-v1.ts',import.meta.url),'utf8');

test('SMM PWA installability contract is present and operational APIs are never cached',()=>{
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.ok(manifest.icons.length>0);
  assert.match(html,/manifest\.webmanifest/);
  assert.match(main,/serviceWorker\.register/);
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw,/url\.pathname\.includes\('\/smm\/v1\/'\)/);
  assert.doesNotMatch(sw,/api\/smm\/snapshot/);
});

test('initial dining order is tenderless while takeaway tender remains required',()=>{
  assert.match(contract,/serviceMode==='TAKEAWAY'&&!tender/);
  assert.match(contract,/serviceMode==='DINE_IN'&&row\.tender!==undefined/);
  assert.match(app,/serviceMode==='TAKEAWAY'\?\{tender\}:\{\}/);
  assert.match(app,/堂食先落單，食完先埋單/);
  assert.match(app,/系統唔會自動再次提交/);
});
