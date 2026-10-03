import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readlink,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {guardContext, readSnapshot, assertPreserved, validateBuildIdentity, validateConfig, makePosConfig, RELEASE, runQuiet, verifyRemoteHead, createWranglerEnvironment, createMetadataClient} from './v3-release-preflight.mjs';
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

const accountPath=`/accounts/${RELEASE.account}/workers`;
const deploymentPath=`${accountPath}/scripts/mfk-admin/deployments`;
const domainPath=`${accountPath}/domains`;
const deployment=(id)=>({id,versions:[{version_id:`version-${id}`,percentage:100}]});
const pageBody=(rows,page,total,perPage=100)=>({success:true,result:{deployments:rows},result_info:{page,per_page:perPage,count:rows.length,total_count:total,total_pages:Math.ceil(total/perPage)}});
function mockMetadata(bodies){
 const calls=[],diagnostics=[];let index=0;
 const api=createMetadataClient({accountId:RELEASE.account,token:'synthetic-token',onDiagnostic:d=>diagnostics.push(d),fetchImpl:async(url,options)=>{
  calls.push({url,options});const body=typeof bodies==='function'?bodies(index++,url):bodies[index++];assert(body,'mock exhausted');return {ok:true,status:200,json:async()=>body};
 }});
 return {api,calls,diagnostics};
}
test('deployment pagination preserves active-first ordering and validates all bounded pages',async()=>{
 const first=Array.from({length:100},(_,i)=>deployment(`d${i}`));const last=[deployment('d100')];
 const mock=mockMetadata([pageBody(first,1,101),pageBody(last,2,101),pageBody(first,1,101)]);
 const result=await mock.api(deploymentPath);assert.equal(result.deployments.length,101);assert.equal(result.deployments[0].id,'d0');
 assert.deepEqual(mock.calls.map(c=>new URL(c.url).search),['?page=1&per_page=100','?page=2&per_page=100','?page=1&per_page=100']);
 assert(mock.calls.every(c=>c.options.method==='GET'));
});
test('deployment pagination rejects missing/unknown/inconsistent metadata, duplicates, truncation and excessive bounds',async()=>{
 const row=deployment('d0');
 const bad=[{success:true,result:{deployments:[row]}},pageBody([row],2,1),pageBody([row],1,1,20),pageBody([row],1,101),pageBody([row],1,2501),{...pageBody([row],1,1),result_info:{...pageBody([row],1,1).result_info,cursor:'secret-cursor'}},{...pageBody([row],1,1),result_info:{page:1,count:1}},pageBody([row,row],1,2)];
 for(const body of bad)await assert.rejects(mockMetadata([body]).api(deploymentPath));
 const first=Array.from({length:100},(_,i)=>deployment(`d${i}`));
 for(const body of [pageBody([row],2,101),pageBody([],2,101),pageBody([deployment('d100')],2,102),pageBody([deployment('d100')],1,101)])await assert.rejects(mockMetadata([pageBody(first,1,101),body]).api(deploymentPath));
 const changed=[...first];changed[0]=deployment('new');await assert.rejects(mockMetadata([pageBody(first,1,101),pageBody([deployment('d100')],2,101),pageBody(changed,1,101)]).api(deploymentPath),/PAGINATION_CHANGED/);
});
test('repeated pages terminate with failure and do not request an unbounded next page',async()=>{
 const first=Array.from({length:100},(_,i)=>deployment(`d${i}`));const mock=mockMetadata(()=>pageBody(first,1,200));
 await assert.rejects(mock.api(deploymentPath));assert.equal(mock.calls.length,2);
});
test('domain list uses no undocumented paging parameters and rejects ambiguous completeness and duplicates',async()=>{
 const domain={id:'domain-admin',hostname:'admin.morefunos.com',service:'mfk-admin',environment:'production'};
 const one={success:true,result:[domain]};const mock=mockMetadata([one]);assert.deepEqual(await mock.api(domainPath),[domain]);assert.equal(new URL(mock.calls[0].url).search,'');
 const validInfo={page:1,per_page:100,count:1,total_count:1,total_pages:1};assert.equal((await mockMetadata([{...one,result_info:validInfo}]).api(domainPath)).length,1);
 for(const body of [{...one,result:[domain,domain]},{...one,result_info:{...validInfo,total_pages:2,total_count:200}},{...one,result_info:{...validInfo,count:2}},{...one,result_info:{page:1}},{...one,result_info:{...validInfo,cursors:{after:'secret'}}}])await assert.rejects(mockMetadata([body]).api(domainPath));
});
test('safe diagnostics preserve endpoint/stage and numeric shape without unknown strings or binding values',async()=>{
 const body={...pageBody([deployment('d0')],1,1),result_info:{page:'SENSITIVE_PAGE',count:1,cursor:'SECRET_CURSOR'}};
 const mock=mockMetadata([body]);await assert.rejects(mock.api(deploymentPath));
 const serialized=JSON.stringify(mock.diagnostics);assert(serialized.includes('deployments'));assert(!serialized.includes('SENSITIVE_PAGE'));assert(!serialized.includes('SECRET_CURSOR'));assert(!serialized.includes('synthetic-token'));
 const secretValue=new Proxy({name:'SECRET',type:'secret_text'},{get(o,k){if(k==='text'||k==='value')throw Error('value inspected');return o[k];}});
 const safe=mockMetadata([{success:true,result:{bindings:[secretValue]}}]);await safe.api(`${accountPath}/scripts/mfk-admin/settings`);assert(!JSON.stringify(safe.diagnostics).includes('SECRET'));
});
test('missing POS ETag is diagnostic-blocked until positive assets-only proof exists; Admin and Customer stay strict',async()=>{
 const shapes=[];const pos=fakeApi({settings:{bindings:[]},version:{id:'version-old',resources:{bindings:[]}},scriptSubdomain:{enabled:true,previews_enabled:false}});
 await assert.rejects(readSnapshot('pos',{api:pos.api,config:makePosConfig('/work/repo'),root:'/work/repo',onDiagnostic:d=>shapes.push(d)}),/POS_ASSETS_ONLY_EVIDENCE_REQUIRED/);
 assert(shapes.some(d=>d.endpoint==='version'&&d.scriptPresent===false&&d.versionBindingsCount===0));
 for(const target of ['admin','customer']){
  const changes=target==='admin'?{}:{settings:{bindings:[{name:'ASSETS',type:'assets'},{name:'CUSTOMER_ASSETS',type:'r2_bucket',bucket_name:'mfk-customer-assets'}]}};
  await assert.rejects(readSnapshot(target,{api:fakeApi({...changes,version:{id:'version-old',resources:{script_runtime:{migration_tag:target==='admin'?'customer-runtime-v1':null}}}}).api}),/SCRIPT_ETAG_MISSING/);
 }
});
test('POS exact assets-only config cannot contain an undeclared script entrypoint',()=>{
 assert.throws(()=>validateConfig('pos',{...makePosConfig('/work/repo'),main:'./unexpected.js'},'/work/repo'),/CONFIG_MAIN/);
});

test('active or custom monitoring settings fail before deploy and diagnostics omit destinations',async()=>{
 for(const monitor of [{observability:{enabled:true}},{observability:{enabled:false,head_sampling_rate:0.2}},{logpush:true},{tail_consumers:[new Proxy({service:'PRIVATE_DESTINATION'},{get(){throw Error('tail destination read');}})]},{observability:'PRIVATE_VALUE'}]){
  const diagnostics=[];await assert.rejects(readSnapshot('admin',{api:fakeApi({settings:{bindings:bindings(),...monitor}}).api,onDiagnostic:d=>diagnostics.push(d)}),/MONITORING_/);
  const json=JSON.stringify(diagnostics);assert(!json.includes('PRIVATE_DESTINATION'));assert(!json.includes('PRIVATE_VALUE'));assert(!json.includes('0.2'));
 }
 await readSnapshot('admin',{api:fakeApi({settings:{bindings:bindings(),observability:{enabled:false},logpush:false,tail_consumers:[]}}).api});
});

test('metadata client rejects unapproved endpoints or caller-controlled queries without a request',async()=>{
 const mock=mockMetadata([]);
 for(const path of [`${accountPath}/scripts/other/settings`,`${deploymentPath}?page=8`,`${accountPath}/scripts/mfk-admin/secrets`,`${accountPath}/scripts/mfk-admin/versions/../../other`])await assert.rejects(mock.api(path),/API_ROUTE_NOT_APPROVED/);
 assert.equal(mock.calls.length,0);
});
test('optional structural flags never serialize arbitrary values or handler names',async()=>{
 const mock=mockMetadata([{success:true,result:{has_assets:true,has_modules:'PRIVATE_VALUE',handlers:['PRIVATE_HANDLER'],named_handlers:[{name:'PRIVATE_CLASS'}],bindings:[]}}]);
 await mock.api(`${accountPath}/scripts/mfk-mfp-v3-acceptance/settings`);
 const response=mock.diagnostics.find(d=>d.stage==='response');assert.equal(response.hasAssets,true);assert.equal(response.hasModules,'invalid');assert.equal(response.handlersCount,1);
 assert(!JSON.stringify(mock.diagnostics).includes('PRIVATE'));
});
