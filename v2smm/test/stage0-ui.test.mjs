import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

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

test('Stage 0 has bounded splash and full recovery contract',()=>{
  assert.match(stage0,/SPLASH_MS=650/);
  assert.match(stage0,/PROBE_TIMEOUT_MS=3500/);
  assert.match(stage0,/Internet/);
  assert.match(stage0,/LAN/);
  assert.match(stage0,/最後觀察時間/);
  assert.match(stage0,/重新連線/);
  assert.match(stage0,/配對 LAN|LAN 配對/);
  assert.match(stage0,/pairSmmLan/);
  assert.match(stage0,/probeSmmLan/);
  assert.match(stage0,/LAST_OBSERVED_KEY/);
  assert.match(stage0,/rememberLastObservedAt/);
  assert.match(stage0,/onRetry\(\);/);
});

test('Stage 0 never shows raw engineering error messages to frontline UI',()=>{
  assert.doesNotMatch(stage0,/setProbeMessage\(reason/);
  assert.doesNotMatch(stage0,/setError\(reason/);
  assert.doesNotMatch(stage0,/role="alert">\{reason/);
  assert.match(stage0,/SMM_STAGE0_PROBE_DIAGNOSTIC/);
  assert.match(stage0,/SMM_STAGE0_STAFF_VERIFY_DIAGNOSTIC/);
  assert.match(stage0,/員工編號或 PIN 未能驗證/);
});

test('Offline workspace cannot bypass trusted staff identity',()=>{
  assert.match(stage0,/offlineBypass&&staffSession/);
  assert.match(stage0,/disabled=\{!canEnterOffline\}/);
  assert.match(stage0,/離線模式唔會繞過員工登入/);
});

test('Stage 0 uses canonical logo plus regenerated purpose-specific IP illustrations',()=>{
  assert.match(stage0,/\/brand\/morefun-logo\.webp/);
  assert.match(stage0,/\/brand\/stage0\/splash-male\.svg/);
  assert.match(stage0,/\/brand\/stage0\/login-female\.svg/);
  assert.match(stage0,/\/brand\/stage0\/connecting-male\.svg/);
  assert.match(stage0,/\/brand\/stage0\/recovery-female\.svg/);
  assert.doesNotMatch(stage0,/\/brand\/ip-male\.webp/);
  assert.doesNotMatch(stage0,/\/brand\/ip-female\.webp/);
  assert.doesNotMatch(css,/data:image\/webp;base64/);
  assert.match(stage0,/BrandScene/);
  assert.ok(existsSync(new URL('../public/brand/morefun-logo.webp',import.meta.url)));
  for(const file of ['splash-male.svg','login-female.svg','connecting-male.svg','recovery-female.svg']){
    assert.ok(existsSync(new URL('../public/brand/stage0/'+file,import.meta.url)));
  }
  const provenance=JSON.parse(readFileSync(new URL('../public/brand/stage0/asset-provenance.json',import.meta.url),'utf8'));
  assert.equal(provenance.logo.source,'OWNER_CANONICAL_LOGO');
  assert.equal(provenance.logo.transformation,'NONE');
  assert.equal(provenance.illustrations.length,4);
  for(const asset of provenance.illustrations){
    assert.equal(asset.rendering,'AI_GENERATED_REDRAW');
    assert.equal(asset.source,'OWNER_IP_REFERENCE_ONLY');
    assert.equal(asset.crop,false);
  }
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


test('Stage 0 brand scenes keep one purpose-specific IP per surface and preserve logo ratio',()=>{
  for(const file of ['splash-male.svg','login-female.svg','connecting-male.svg','recovery-female.svg']){
    assert.equal((stage0.match(new RegExp(file.replace('.','\\.'),'g'))||[]).length,1);
  }
  assert.match(css,/\.stage0-brand-logo\{[\s\S]*height:auto/);
  assert.match(css,/\.stage0-brand-scene/);
  assert.match(css,/\.stage0-purpose-chip/);
});
