import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const launch=readFileSync(new URL('../src/launch/LaunchOverlay.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/launch/launch.css',import.meta.url),'utf8');
test('UI0 uses exact opening video delivery path without changing authority',()=>{
  assert.ok(launch.includes("UI0_VIDEO_PATH='/media/customer-ui0-opening.mp4'"));
  assert.ok(launch.includes('autoPlay muted playsInline preload="auto"'));
  assert.ok(launch.includes('onError={()=>setVideoUnavailable(true)}'));
  assert.ok(launch.includes('!reducedMotion&&!videoUnavailable'));
  assert.match(css,/\.launch-opening-video\{[^}]*object-fit:cover/);
  assert.match(css,/\.launch-brand-scene\.is-video-backed\{opacity:0/);
  assert.doesNotMatch(launch,/Order|Payment|Pricing|Fulfillment/);
});
