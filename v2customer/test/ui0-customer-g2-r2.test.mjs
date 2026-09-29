import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
const launch=readFileSync(new URL('../src/launch/LaunchOverlay.tsx',import.meta.url),'utf8');
test('UI0 media is Customer G2 owned and private R2 backed',()=>{
 assert.match(wrangler,/"binding": "CUSTOMER_ASSETS"/);
 assert.match(wrangler,/"bucket_name": "mfk-customer-assets"/);
 assert.match(worker,/CUSTOMER_ASSETS\.get\(UI0_OBJECT_KEY\)/);
 assert.match(worker,/ui\/ui0\/opening-mobile-v1\.mp4/);
 assert.ok(launch.includes("UI0_VIDEO_PATH='/media/ui0/opening-mobile-v1.mp4'"));
 assert.doesNotMatch(launch,/admin\.morefunos\.com/);
});
