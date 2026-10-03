import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const dist=new URL('../dist/',import.meta.url);
const identity=JSON.parse(await readFile(new URL('build-identity.json',dist),'utf8'));
assert.equal(identity.target,'MFP_V3');
assert.equal(identity.linkedTestEnabled,true,'Build with VITE_MFP_V3_LINKED_TEST=1');
assert.match(identity.sourceSha,/^[a-f0-9]{40}$/);
if(process.env.MFP_SOURCE_SHA)assert.equal(identity.sourceSha,process.env.MFP_SOURCE_SHA);
const assets=await readdir(new URL('assets/',dist));
assert.equal(assets.some(name=>name.includes('normal-app-entry')),false,'Linked build must exclude normal/native runtime chunks');
for(const name of assets.filter(name=>name.endsWith('.js'))){
  const source=await readFile(new URL('assets/'+name,dist),'utf8');
  for(const forbidden of ['CHECKOUT_PAYMENT_CONFIRM','mfp.store-kernel.command.v1','moreFunNative','MFP_PRINT_JOB','MFP_SYNC_BINDING_UNAVAILABLE'])assert.equal(source.includes(forbidden),false,'Formal/native runtime leaked into linked asset: '+forbidden);
}
console.log('Linked POS build verified: exact source metadata, test flag, no formal/native runtime assets.');
