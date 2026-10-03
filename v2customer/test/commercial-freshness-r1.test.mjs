import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../src/cloud-runtime.ts',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../src/persistence.ts',import.meta.url),'utf8');

test('Safari and BFCache resume block commercial actions before tiny HEAD reconciliation',()=>{
  assert.match(app,/window\.addEventListener\('pageshow',pageShown\)/);
  assert.match(app,/setConnection\('STALE'\);\s*try\{\s*const next=await port\.readSnapshot\(\)/);
  assert.match(app,/Date\.parse\(snapshot\.commercialFreshness\.expiresAt\)>Date\.now\(\)/);
  assert.match(app,/setTimeout\(\(\)=>\{\s*setConnection\('STALE'\)/);
  assert.match(app,/commercialReady=\{commercialReady\}/);
});

test('submit freezes the proof that backed the displayed commercial facts',()=>{
  assert.match(app,/createCustomerPendingIntent\(cart,checkout,String\(menu\?\.revision\|\|''\),snapshot\?\.commercialFreshness\)/);
  assert.match(app,/routeIntent\?\.commercialFreshness\?\?snapshot\?\.commercialFreshness/);
  assert.match(cloud,/customerPortSeq:intent\.commercialFreshness\?\.customerPortSeq/);
  assert.match(cloud,/commercialProof:intent\.commercialFreshness/);
  assert.match(persistence,/storageKind:'LOCAL_NON_AUTHORITATIVE'/);
});

test('normal freshness path is one HEAD proof plus entity delta or checkpoint catch-up',()=>{
  assert.match(cloud,/\/api\/customer\/sync\/head\?storeId=/);
  assert.match(cloud,/validateMfkCustomerCommercialFreshnessProof\(body\.commercialFreshness\)/);
  assert.match(cloud,/fetchCustomerChanges\(appliedSeq\)/);
  assert.match(cloud,/fetchCustomerCheckpoint\(head\)/);
  assert.doesNotMatch(cloud,/products\.map\([^\n]*fetch/);
});
