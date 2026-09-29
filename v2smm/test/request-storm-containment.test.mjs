import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSingleFlightRefresh} from '../src/refresh-single-flight.mjs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../src/pwa-runtime.ts',import.meta.url),'utf8');

function deferred(){
  let resolve;
  const promise=new Promise(done=>{resolve=done});
  return {promise,resolve};
}

test('visible SMM has one initial refresh and no periodic snapshot polling',()=>{
  assert.match(app,/initialRefreshRef/);
  assert.doesNotMatch(app,/setInterval\s*\(/);
  assert.doesNotMatch(app,/2500/);
});

test('online, pageshow, visibility and manual triggers share one bounded single-flight',async()=>{
  const first=deferred();
  const trailing=deferred();
  const gates=[first,trailing];
  let calls=0;
  let active=0;
  let maxActive=0;
  const refresh=createSingleFlightRefresh(async()=>{
    const gate=gates[calls++];
    active++;
    maxActive=Math.max(maxActive,active);
    await gate.promise;
    active--;
  });

  const initial=refresh();
  for(const trigger of ['online','pageshow','visibilitychange','manual']){
    assert.strictEqual(refresh(trigger),initial);
  }
  assert.equal(calls,1);
  assert.equal(maxActive,1);

  first.resolve();
  while(calls<2)await Promise.resolve();
  for(let duplicate=0;duplicate<4;duplicate++)assert.strictEqual(refresh(),initial);
  assert.equal(calls,2);
  assert.equal(maxActive,1);

  trailing.resolve();
  await initial;
  assert.equal(calls,2);
  assert.equal(maxActive,1);
});

test('a 3.5 second LAN read cannot overlap another snapshot read',async()=>{
  const timeout=deferred();
  let calls=0;
  const refresh=createSingleFlightRefresh(async()=>{calls++;await timeout.promise});

  const first=refresh();
  const second=refresh();
  assert.strictEqual(second,first);
  assert.equal(calls,1);
  assert.match(runtime,/timeoutMs=3500/);
  assert.match(runtime,/withTimeout\(lanRequest\(/);

  timeout.resolve();
  await first;
});

test('readSnapshot error does not start an automatic retry loop',async()=>{
  let calls=0;
  const refresh=createSingleFlightRefresh(async()=>{calls++;throw new Error('offline')});

  await assert.rejects(refresh(),/offline/);
  await Promise.resolve();
  assert.equal(calls,1);
});

test('manual, online and transaction readback refresh paths remain wired',()=>{
  assert.match(app,/addEventListener\('online',onOnline\)/);
  assert.match(app,/addEventListener\('pageshow',onPageShow\)/);
  assert.match(app,/addEventListener\('visibilitychange',onVisibility\)/);
  assert.match(app,/aria-label="重新同步門店資料"/);
  assert.match(app,/resolveConfirmedIntent[\s\S]*?void refresh\(\)/);
  assert.match(app,/SMM_PUBLISHED_PRICE_CHANGED[\s\S]*?await refresh\(\)/);
});
