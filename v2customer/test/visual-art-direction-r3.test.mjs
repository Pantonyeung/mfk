import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'..');
const views=fs.readFileSync(path.join(root,'src/components/customer-views.tsx'),'utf8');
const styles=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');

test('R3 premium art direction markers remain present without new business semantics',()=>{
  for(const marker of[
    'hero-brand-chip',
    'jar-aura',
    'jar-particles',
    'submit-orbit',
    'pickup-code-lockup',
    'coupon-mark',
    'badge-medallion',
    'seed-constellation'
  ])assert.match(views,new RegExp(marker));

  for(const marker of[
    'Customer R3',
    'Signature Memory Jar',
    'Checkout confidence',
    'Premium order confidence',
    'My Memory collectible language'
  ])assert.match(styles,new RegExp(marker));

  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(views,/seed(s)?\s*[+*/-]\s*\d+/i);
  assert.doesNotMatch(views,/coupon.*discount.*=/i);
  assert.doesNotMatch(views,/award.*badge/i);
});
