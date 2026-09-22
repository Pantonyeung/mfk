import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));

async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(path));
    else if (['.js', '.d.ts'].some((suffix) => path.endsWith(suffix))) out.push(path);
  }
  return out;
}

test('runtime firewall: live network authority is isolated to the bounded K0 runtime helper', async () => {
  const patterns = [
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\bsetInterval\s*\(/,
    /\bsetTimeout\s*\(/,
    /\bsetAlarm\s*\(/,
    /\bWorkerEntrypoint\b/,
    /\bDurableObject\b/,
    /\bscheduled\s*\(/,
    /\bD1Database\b/,
    /workers\.dev/,
    /process\.env/,
    /wrangler/i,
    /cloudflare/i,
  ];

  for (const file of await collect(srcRoot)) {
    const source = await readFile(file, 'utf8');
    const isLiveRuntime=file.endsWith('live-runtime.js');
    for (const pattern of patterns) {
      if(isLiveRuntime&&String(pattern)==='/\\bfetch\\s*\\(/')continue;
      assert.doesNotMatch(source, pattern, `${file} violates runtime firewall with ${pattern}`);
    }
    if(isLiveRuntime){
      assert.match(source,/https:\/\/open\.mykeeta\.com\/api\/open\/base\/oauth\/token/);
      assert.doesNotMatch(source,/v2(?:local|admin|smm|customer|owner)/);
      assert.doesNotMatch(source,/setInterval|setTimeout|DurableObject|D1Database|scheduled/);
    }
  }
});

test('migration firewall: no product-port import is allowed', async () => {
  for (const file of await collect(srcRoot)) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:\.\.\/)+v2(?:local|admin|smm|customer|owner)\b/);
  }
});

test('runtime firewall: K0 live helper never owns canonical MFK truth', async () => {
  const source = await readFile(join(srcRoot,'live-runtime.js'),'utf8');
  for (const forbidden of ['createOrder','StoreKernel','PaymentAuthority','FormalOrder','D1Database','canonical writer']) {
    assert.doesNotMatch(source,new RegExp(forbidden,'i'));
  }
});
