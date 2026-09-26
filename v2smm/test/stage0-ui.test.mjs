import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const stage0=readFileSync(new URL('../src/StageZero.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage0.css',import.meta.url),'utf8');
const assets=readFileSync(new URL('../src/approved-brand-assets.ts',import.meta.url),'utf8');

test('Stage 0 gate wraps the existing SMM app without moving transaction authority',()=>{
  assert.match(main,/StageZeroGate/);
  assert.match(main,/<StageZeroGate><App\/><\/StageZeroGate>/);
  assert.doesNotMatch(stage0,/submitOrder\s*\(/);
  assert.doesNotMatch(stage0,/setSellability\s*\(/);
  assert.doesNotMatch(stage0,/createDineSession\s*\(/);
});

test('Stage 0 recovery exposes required operator-safe connection facts',()=>{
  for(const label of ['Internet','LAN','最後觀察時間','重新連線','重新配對'])assert.match(stage0,new RegExp(label));
  assert.match(stage0,/pairSmmLan/);
  assert.match(stage0,/readSmmLanPwaConfig/);
});

test('Stage 0 never renders raw engineering errors in normal operator copy',()=>{
  assert.match(stage0,/humanProbeMessage/);
  assert.match(stage0,/humanStaffMessage/);
  assert.doesNotMatch(stage0,/setError\(reason instanceof Error\?reason\.message/);
  assert.doesNotMatch(stage0,/setProbeError/);
});

test('offline workspace cannot bypass staff identity',()=>{
  assert.match(stage0,/offlineBypass&&staffSession/);
  assert.match(stage0,/disabled=!hasTrustedStaff/);
  assert.match(stage0,/需先完成員工登入/);
});

test('Stage 0 reuses current staff verification and approved Owner assets',()=>{
  assert.match(stage0,/listSmmStaff/);
  assert.match(stage0,/verifySmmStaff/);
  assert.match(stage0,/APPROVED_LOGO_SRC/);
  assert.match(stage0,/APPROVED_MALE_IP_SRC/);
  assert.match(assets,/Owner-supplied brand assets/);
  assert.doesNotMatch(stage0,/stage0-team-art/);
});

test('Stage 0 has bounded splash and mobile accessibility rules',()=>{
  assert.match(stage0,/SPLASH_MS=650/);
  assert.match(stage0,/PROBE_TIMEOUT_MS=3500/);
  assert.match(css,/min-height:100dvh/);
  assert.match(css,/width:min\(100%,520px\)/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
