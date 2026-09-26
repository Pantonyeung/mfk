import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const main=fs.readFileSync(path.join(srcRoot,'main.tsx'),'utf8');
const launchPath=path.join(srcRoot,'stage0/LaunchGate.tsx');
const launchCssPath=path.join(srcRoot,'stage0/stage0.css');

test('Stage 0 mounts the real app behind a non-authoritative launch gate',()=>{
  assert.equal(fs.existsSync(launchPath),true);
  assert.match(main,/LaunchGate/);
  assert.match(main,/<LaunchGate><App\/><\/LaunchGate>/);
});

test('Stage 0 keeps only the two Owner-approved entry CTAs',()=>{
  const launch=fs.readFileSync(launchPath,'utf8');
  assert.match(launch,/進入主頁/);
  assert.match(launch,/進入會員頁/);
  assert.doesNotMatch(launch,/直接點餐/);
});

test('Stage 0 chooses one male or female mascot per session and keeps it stable',()=>{
  const launch=fs.readFileSync(launchPath,'utf8');
  assert.match(launch,/sessionStorage/);
  assert.match(launch,/MFK_CUSTOMER_LAUNCH_VARIANT/);
  assert.match(launch,/male/);
  assert.match(launch,/female/);
});

test('Stage 0 supports returning-session fast path and reduced motion',()=>{
  const launch=fs.readFileSync(launchPath,'utf8');
  const styles=fs.readFileSync(launchCssPath,'utf8');
  assert.match(launch,/MFK_CUSTOMER_LAUNCH_SEEN/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(styles,/stage0-returning/);
});

test('Stage 0 uses locked brand/IP assets and no product photography',()=>{
  const launch=fs.readFileSync(launchPath,'utf8');
  assert.match(launch,/\/stage0\/morefun-logo\.png/);
  assert.match(launch,/\/stage0\/male-ip\.jpeg/);
  assert.match(launch,/\/stage0\/female-ip\.jpeg/);
  assert.doesNotMatch(launch,/product|bowl|riceball|food-photo/i);
});
