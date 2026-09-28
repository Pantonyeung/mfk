import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('Owner hosting uses a dedicated presentation Worker without business authority',()=>{
  const config=fs.readFileSync(path.join(dir,'wrangler.jsonc'),'utf8');
  const worker=fs.readFileSync(path.join(dir,'worker.ts'),'utf8');
  assert.match(config,/"name": "mfk-owner"/);
  assert.match(config,/"pattern": "owner\.morefunos\.com"/);
  assert.match(config,/"custom_domain": true/);
  assert.match(config,/"not_found_handling": "single-page-application"/);
  assert.match(worker,/env\.ASSETS\.fetch/);
  assert.match(worker,/service:'mfk-owner'/);
  for(const forbidden of[
    'D1Database',
    'DurableObject',
    'createFormalOrder',
    'PricingEngine',
    'PaymentEngine',
    'x-mfk-admin-publish-key',
  ])assert.equal(worker.includes(forbidden),false,forbidden);
});
