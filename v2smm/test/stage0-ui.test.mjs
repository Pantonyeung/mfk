import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const stage0=readFileSync(new URL('../src/StageZero.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/stage0.css',import.meta.url),'utf8');

test('Stage 0 wraps the existing SMM app without moving authority',()=>{
  assert.match(main,/StageZeroGate/);
  assert.match(main,/<StageZeroGate><App\/><\/StageZeroGate>/);
  assert.doesNotMatch(stage0,/submitOrder\s*\(/);
  assert.doesNotMatch(stage0,/setSellability\s*\(/);
  assert.doesNotMatch(stage0,/createDineSession\s*\(/);
});

test('Stage 0 source flow contains Splash Login Connection and Recovery',()=>{
  assert.match(stage0,/SPLASH_MS=650/);
  assert.ok(650<=1200);
  for(const marker of['StageZeroSplash','StageZeroStaffLogin','StageZeroConnectionChecking','StageZeroConnectionRecovery','員工登入','正在連線','連線與恢復','重新檢查','繼續離線工作']){
    assert.match(stage0,new RegExp(marker));
  }
  assert.match(stage0,/Internet/);
  assert.match(stage0,/LAN/);
  assert.match(stage0,/最後觀察時間/);
});

test('Stage 0 uses MoreFun brand and approved IP assets from the final visual source',()=>{
  assert.match(stage0,/\/brand\/morefun-logo\.webp/);
  for(const asset of['stage0-splash-male.webp','stage0-login-duo.webp','stage0-recovery-female.webp','stage0-female.webp']){
    assert.match(stage0,new RegExp(asset.replace('.','\\.')));
    assert.ok(existsSync(new URL('../public/brand/stage0/'+asset,import.meta.url)));
  }
  assert.ok(existsSync(new URL('../public/brand/morefun-logo.webp',import.meta.url)));
  assert.match(css,/stage0-mascot-login/);
  assert.match(css,/stage0-feather/);
});

test('Stage 0 staff login reuses current Staff Auth and PIN flow',()=>{
  assert.match(stage0,/listSmmStaff/);
  assert.match(stage0,/verifySmmStaff/);
  assert.match(stage0,/登入編號/);
  assert.match(stage0,/4–8 位數字/);
  assert.doesNotMatch(stage0,/new Auth|second auth|createStaffAuth/i);
});

test('Stage 0 recovery reuses LAN primitives and never bypasses trusted staff identity',()=>{
  assert.match(stage0,/pairSmmLan/);
  assert.match(stage0,/probeSmmLan/);
  assert.match(stage0,/readSmmLanPwaConfig/);
  assert.match(stage0,/offlineBypass&&staffSession/);
  assert.match(stage0,/disabled=\{!canEnterOffline\}/);
  assert.match(stage0,/離線模式唔會繞過員工登入/);
});

test('Stage 0 never exposes raw engineering failures in frontline copy',()=>{
  assert.doesNotMatch(stage0,/setProbeMessage\(reason/);
  assert.doesNotMatch(stage0,/setError\(reason/);
  assert.match(stage0,/SMM_STAGE0_PROBE_DIAGNOSTIC/);
  assert.match(stage0,/SMM_STAGE0_STAFF_VERIFY_DIAGNOSTIC/);
  assert.match(stage0,/登入編號或 PIN 未能驗證/);
});

test('Stage 0 acceptance bypass remains restricted',()=>{
  assert.match(stage0,/function uiAcceptanceBypass/);
  assert.match(stage0,/\.yeungyi88\.workers\.dev/);
  assert.match(stage0,/isLocal&&query\.get\('ui-bypass'\)==='1'/);
});

test('Stage 0 mobile visual contract supports 440x956 and 360x780 class devices',()=>{
  assert.match(css,/min-height:100dvh/);
  assert.match(css,/width:min\(100%,520px\)/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
