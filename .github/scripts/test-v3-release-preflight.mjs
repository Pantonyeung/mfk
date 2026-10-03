import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readlink,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {guardContext, readSnapshot, assertPreserved, validateBuildIdentity, validateConfig, makePosConfig, RELEASE, runQuiet, verifyRemoteHead, createWranglerEnvironment} from './v3-release-preflight.mjs';
const sha='a'.repeat(40);
const context={repository:'Pantonyeung/mfk',repositoryOwner:'Pantonyeung',eventName:'workflow_dispatch',ref:RELEASE.ref,sha,localHead:sha,inputs:{expected_sha:sha,target:'all',operation:'preflight'}};
const secret=()=>new Proxy({name:'KEETA_APP_SECRET',type:'secret_text'},{get(o,k){if(['text','value','json'].includes(k))throw Error('secret value read');return o[k];}});
const bindings=()=>[
 {name:'ASSETS',type:'assets'},
 ...[['ADMIN_SYNC','AdminSyncStore','ns-admin'],['KEETA_RUNTIME','KeetaRuntimeStore','ns-keeta'],['CUSTOMER_RUNTIME','CustomerRuntimeStore','ns-customer']].map(([name,class_name,namespace_id])=>({name,type:'durable_object_namespace',class_name,namespace_id})),
 {name:'CUSTOMER_PAYMENT_EVIDENCE',type:'r2_bucket',bucket_name:'mfk-customer-payment-evidence'},secret(),{name:'KEETA_TOKEN_ENCRYPTION_KEY',type:'secret_text'},
 {name:'KEETA_APP_ID',type:'plain_text',text:'same-value'},
 new Proxy({name:'PRIVATE_CONFIG',type:'plain_text'},{get(o,k){if(k==='text'||k==='value')throw Error('private plaintext read');return o[k];}}),
];
function fakeApi(changes={}){
 const responses={settings:{bindings:bindings()},deployments:{deployments:[{id:'deployment-old',versions:[{version_id:'version-old',percentage:100}]}]},version:{id:'version-old',resources:{script_runtime:{migration_tag:'customer-runtime-v1'},script:{etag:'etag-old'}}},domains:[{hostname:'admin.morefunos.com',service:'mfk-admin',environment:'production'}],accountSubdomain:{subdomain:'yeungyi88'},scriptSubdomain:{enabled:true,previews_enabled:true},...changes};
 const calls=[];
 return {calls,async api(path){calls.push(path);if(path.endsWith('/settings'))return responses.settings;if(path.endsWith('/deployments'))return responses.deployments;if(path.includes('/versions/'))return responses.version;if(path.endsWith('/domains'))return responses.domains;if(path.includes('/scripts/')&&path.endsWith('/subdomain'))return responses.scriptSubdomain;if(path.endsWith('/subdomain'))return responses.accountSubdomain;throw Error('unexpected API route');}};
}
test('guard accepts only pinned manual branch/repository/SHA and bounded inputs',()=>{
 assert.deepEqual(guardContext(context),{expectedSha:sha,target:'all',operation:'preflight',targets:['admin','pos','customer']});
 for(const bad of [{repository:'evil/mfk'},{repositoryOwner:'evil'},{eventName:'push'},{ref:'refs/heads/main'},{sha:'b'.repeat(40)},{localHead:'b'.repeat(40)},{inputs:{...context.inputs,phase:2}},{inputs:{...context.inputs,target:'v2'}},{inputs:{...context.inputs,operation:'rollback'}},{inputs:{...context.inputs,expected_sha:'a'.repeat(7)}}])assert.throws(()=>guardContext({...context,...bad}));
});
test('remote branch guard checks exact GitHub ref and SHA using fixed endpoint',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ref:RELEASE.ref,object:{type:'commit',sha}})};};
 await verifyRemoteHead(sha,{fetchImpl,token:'synthetic-token'});assert.match(calls[0].url,/api.github.com\/repos\/Pantonyeung\/mfk\/git\/ref\/heads\/release\//);
 await assert.rejects(verifyRemoteHead(sha,{token:'synthetic-token',fetchImpl:async()=>({ok:true,json:async()=>({ref:RELEASE.ref,object:{type:'commit',sha:'b'.repeat(40)}})})}));
});
test('preflight captures only safe existing metadata and checks configured plaintext in memory',async()=>{
 const mock=fakeApi();const result=await readSnapshot('admin',{api:mock.api,declaredVars:{KEETA_APP_ID:'same-value'}});
 assert.equal(result.versionId,'version-old');assert.equal(result.migrationTag,'customer-runtime-v1');assert.equal(result.bindings.find(b=>b.name==='ADMIN_SYNC').namespaceId,'ns-admin');
 assert(!JSON.stringify(result).includes('same-value'));assert(!JSON.stringify(result).includes('synthetic-token'));assert(mock.calls.every(p=>!p.includes('/storage/')&&!p.includes('/objects/')));
 await assert.rejects(readSnapshot('admin',{api:fakeApi().api,declaredVars:{KEETA_APP_ID:'different-value'}}),/DECLARED_VAR_MISMATCH/);
});
test('preflight fails missing targets, domains, migration, bindings and multi-version state',async()=>{
 for(const changes of [
 {settings:{bindings:[]}},
 {domains:[{hostname:'admin.morefunos.com',service:'other',environment:'production'}]},
 {version:{id:'version-old',resources:{script_runtime:{migration_tag:'new-tag'},script:{etag:'old'}}}},
 {deployments:{deployments:[{id:'d',versions:[{version_id:'v',percentage:99}]}]}},
 {deployments:{deployments:[]}},
 {settings:{bindings:[...bindings(),{name:'NEW_DB',type:'d1',id:'db'}]}},
 {settings:{bindings:bindings().filter(b=>b.name!=='KEETA_APP_SECRET')}},
 ])await assert.rejects(readSnapshot('admin',{api:fakeApi(changes).api}));
});
test('postflight rejects DO/R2/secret/migration drift and accepts only deliberate safe variable changes',async()=>{
 const before=await readSnapshot('admin',{api:fakeApi().api});const after=structuredClone(before);after.versionId='version-new';after.scriptEtag='new-etag';assert.doesNotThrow(()=>assertPreserved(before,after));
 for(const change of [(a)=>a.bindings.find(b=>b.name==='ADMIN_SYNC').namespaceId='other',(a)=>a.bindings.find(b=>b.name==='CUSTOMER_PAYMENT_EVIDENCE').bucketName='other',(a)=>a.bindings=a.bindings.filter(b=>b.name!=='KEETA_APP_SECRET'),(a)=>a.migrationTag='new']){const bad=structuredClone(after);change(bad);assert.throws(()=>assertPreserved(before,bad));}
});
test('identity gates reject wrong-source, dirty Customer and enabled Admin writes',()=>{
 validateBuildIdentity('admin',{sourceSha:sha,mode:'PRESERVATION',configurationWritesEnabled:false},sha);
 validateBuildIdentity('pos',{target:'MFP_V3',sourceSha:sha},sha);
 validateBuildIdentity('customer',{surface:'MFP_CUSTOMER_V3',sourceCommit:sha,sourceDirty:false},sha);
 for(const [target,body] of [['admin',{sourceSha:sha,mode:'ACCEPTANCE',configurationWritesEnabled:true}],['customer',{surface:'MFP_CUSTOMER_V3',sourceCommit:sha,sourceDirty:true}],['pos',{target:'MFP_V3',sourceSha:'b'.repeat(40)}]])assert.throws(()=>validateBuildIdentity(target,body,sha));
});
test('POS config stays outside source tree and forbids names/routes/bindings outside approved scope',()=>{
 const config=makePosConfig('/work/repo');assert.equal(config.name,'mfk-mfp-v3-acceptance');assert.equal(config.assets.directory,'/work/repo/v3smt/dist');validateConfig('pos',config,'/work/repo');
 for(const changed of [{...config,name:'new-service'},{...config,routes:['example.com/*']},{...config,vars:{UNAPPROVED:'1'}},{...config,compatibility_date:'2027-01-01'}])assert.throws(()=>validateConfig('pos',changed,'/work/repo'));
});
test('Wrangler runner suppresses stdout/stderr and returns only an exit code',async()=>{
 const result=await runQuiet(process.execPath,['-e',"console.log('RAW_SECRET');console.error('SECRET_VAR');process.exit(7)"],{});assert.deepEqual(result,{exitCode:7});
});

test('Wrangler debug log is an owned .log symlink to /dev/null with sanitized flags',async()=>{
 const root=await mkdtemp(join(tmpdir(),'v3-log-test-'));
 try{const env=await createWranglerEnvironment(root,{SENTINEL:'kept',GH_TOKEN:'do-not-pass'});assert.equal(env.GH_TOKEN,undefined);assert.equal(env.WRANGLER_LOG_SANITIZE,'true');assert.equal(env.WRANGLER_SEND_METRICS,'false');assert.match(env.WRANGLER_LOG_PATH,/\.log$/);assert.equal(await readlink(env.WRANGLER_LOG_PATH),'/dev/null');
 const result=await runQuiet(process.execPath,['-e',"require('fs').appendFileSync(process.env.WRANGLER_LOG_PATH,'RAW_SECRET');console.log('RAW_SECRET')"],{env});assert.equal(result.exitCode,0);assert.deepEqual(await readdir(root),[env.WRANGLER_LOG_PATH.split('/').at(-2)]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('asset-only POS and Customer metadata have bounded topology without Admin requirements',async()=>{
 const pos=fakeApi({settings:{bindings:[]},version:{id:'version-old',resources:{script_runtime:{},script:{etag:'old'}}},scriptSubdomain:{enabled:true,previews_enabled:false}});
 const p=await readSnapshot('pos',{api:pos.api});assert.equal(p.domain.hostname,'mfk-mfp-v3-acceptance.yeungyi88.workers.dev');
 const c=fakeApi({settings:{bindings:[{name:'ASSETS',type:'assets'},{name:'CUSTOMER_ASSETS',type:'r2_bucket',bucket_name:'mfk-customer-assets'}]},version:{id:'version-old',resources:{script_runtime:{},script:{etag:'old'}}},domains:[{hostname:'order.morefunos.com',service:'mfk-customer',environment:'production'}]});
 assert.equal((await readSnapshot('customer',{api:c.api})).service,'mfk-customer');
 await assert.rejects(readSnapshot('pos',{api:fakeApi({settings:{bindings:[]},version:{id:'version-old',resources:{script_runtime:{},script:{etag:'old'}}},scriptSubdomain:{enabled:false,previews_enabled:false}}).api}),/WORKERS_DEV/);
});
