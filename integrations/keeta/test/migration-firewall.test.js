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

test('migration firewall: production source has zero live runtime/network authority', async () => {
  const patterns = [
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\bsetInterval\s*\(/,
    /\bD1Database\b/,
    /workers\.dev/,
    /process\.env/,
    /wrangler/i,
    /cloudflare/i,
  ];

  for (const file of await collect(srcRoot)) {
    const source = await readFile(file, 'utf8');
    for (const pattern of patterns) {
      assert.doesNotMatch(source, pattern, `${file} violates migration firewall with ${pattern}`);
    }
  }
});

test('migration firewall: no product-port import is allowed', async () => {
  for (const file of await collect(srcRoot)) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:\.\.\/)+v2(?:local|admin|smm|customer|owner)\b/);
  }
});
