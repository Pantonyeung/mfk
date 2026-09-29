import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
test('Customer exposes no-store public build identity for UI1 acceptance',()=>{
 assert.match(worker,/\/__mfk\/build/);
 assert.match(worker,/CUSTOMER_BUILD_ID='40e20be86c75f457297abb474d7a67b6d8517188'/);
 assert.match(worker,/CUSTOMER_UI1_CONTRACT='five-state-home-v1'/);
 assert.match(worker,/cache-control':'no-store/);
});
