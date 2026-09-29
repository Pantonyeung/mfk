import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/launch/launch.css',import.meta.url),'utf8');
test('UI0 is an exclusive stage and underlying Customer shell is not rendered',()=>{
  assert.match(app,/if\(launchVisible\)return <LaunchOverlay/);
  assert.ok(app.indexOf('if(launchVisible)return <LaunchOverlay')<app.indexOf('return <main className="customer-shell"'));
  assert.match(app,/body\.style\.overflow='hidden'/);
  assert.match(app,/html\.style\.overflow='hidden'/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/min-height:100svh/);
  assert.match(css,/overscroll-behavior:none/);
});
