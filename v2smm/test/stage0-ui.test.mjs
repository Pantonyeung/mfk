import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const stage0=readFileSync(new URL('../src/StageZero.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage0.css',import.meta.url),'utf8');

test('Stage 0 gate wraps the existing SMM app without moving transaction authority',()=>{
  assert.match(main,/StageZeroGate/);
  assert.match(main,/<StageZeroGate><App\/><\/StageZeroGate>/);
  assert.doesNotMatch(stage0,/submitOrder\s*\(/);
  assert.doesNotMatch(stage0,/setSellability\s*\(/);
  assert.doesNotMatch(stage0,/createDineSession\s*\(/);
});

test('Stage 0 has bounded splash and recovery path',()=>{
  assert.match(stage0,/SPLASH_MS=650/);
  assert.match(stage0,/PROBE_TIMEOUT_MS=3500/);
  assert.match(stage0,/進入離線工作區/);
  assert.match(stage0,/重新連線/);
});

test('Stage 0 staff login reuses current staff verification',()=>{
  assert.match(stage0,/listSmmStaff/);
  assert.match(stage0,/verifySmmStaff/);
  assert.match(stage0,/4–8 位數字/);
});

test('Stage 0 style respects mobile viewport and accessibility preferences',()=>{
  assert.match(css,/min-height:100dvh/);
  assert.match(css,/width:min\(100%,520px\)/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
