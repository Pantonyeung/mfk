/** Bounded manual V3 release. Never log API bodies, binding values or Wrangler output. */
import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,symlink,chmod} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const RELEASE=Object.freeze({repository:'Pantonyeung/mfk',owner:'Pantonyeung',ref:'refs/heads/release/MFP-V3-ACCEPTANCE-2026-10-03',account:'314abfde9f49e752cf8f67c79d83dd7c',wrangler:'4.146.0'});
const TARGETS=Object.freeze({
 admin:{service:'mfk-admin',host:'admin.morefunos.com',directory:'v3admin',identity:'release.json',migration:'customer-runtime-v1',r2:{CUSTOMER_PAYMENT_EVIDENCE:'mfk-customer-payment-evidence'},dos:{ADMIN_SYNC:'AdminSyncStore',KEETA_RUNTIME:'KeetaRuntimeStore',CUSTOMER_RUNTIME:'CustomerRuntimeStore'},secrets:['KEETA_APP_SECRET','KEETA_TOKEN_ENCRYPTION_KEY']},
 pos:{service:'mfk-mfp-v3-acceptance',host:'mfk-mfp-v3-acceptance.yeungyi88.workers.dev',directory:'v3smt',identity:'build-identity.json',migration:null,r2:{},dos:{},secrets:[]},
 customer:{service:'mfk-customer',host:'order.morefunos.com',directory:'v3customer',identity:'customer-build-identity.json',migration:null,r2:{CUSTOMER_ASSETS:'mfk-customer-assets'},dos:{},secrets:[]},
});
const fail=(code)=>{throw new Error(code);};
const requireThat=(condition,code)=>{if(!condition)fail(code);};
const exactSHA=(sha)=>typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha);
const sorted=(items)=>items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function targetInfo(target){requireThat(Object.hasOwn(TARGETS,target),'TARGET_INVALID');return TARGETS[target];}
function metadataString(value,code){requireThat(typeof value==='string'&&/^[a-zA-Z0-9_.:@/-]{1,256}$/.test(value),code);return value;}

export function guardContext(ctx){
 requireThat(ctx.repository===RELEASE.repository&&ctx.repositoryOwner===RELEASE.owner,'REPOSITORY_NOT_TRUSTED');
 requireThat(ctx.eventName==='workflow_dispatch'&&ctx.ref===RELEASE.ref,'MANUAL_RELEASE_REF_REQUIRED');
 requireThat(ctx.inputs&&same(Object.keys(ctx.inputs).sort(),['expected_sha','operation','target']),'INPUTS_UNEXPECTED');
 const {expected_sha:expectedSha,target,operation}=ctx.inputs;
 requireThat(exactSHA(expectedSha)&&ctx.sha===expectedSha&&ctx.localHead===expectedSha,'SOURCE_SHA_MISMATCH');
 requireThat(['all',...Object.keys(TARGETS)].includes(target),'TARGET_INVALID');
 requireThat(['preflight','deploy'].includes(operation),'OPERATION_INVALID');
 return {expectedSha,target,operation,targets:target==='all'?Object.keys(TARGETS):[target]};
}
export async function verifyRemoteHead(expectedSha,{fetchImpl=fetch,token}={}){
 requireThat(exactSHA(expectedSha)&&typeof token==='string'&&token.length>0,'GITHUB_READ_TOKEN_REQUIRED');
 const response=await fetchImpl(`https://api.github.com/repos/${RELEASE.repository}/git/ref/heads/release/MFP-V3-ACCEPTANCE-2026-10-03`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(30000)});
 requireThat(response.ok,'REMOTE_BRANCH_READ_FAILED');
 const body=await response.json();
 requireThat(body?.ref===RELEASE.ref&&body?.object?.type==='commit'&&body.object.sha===expectedSha,'REMOTE_BRANCH_SHA_MISMATCH');
}
function safeBinding(binding){
 const name=metadataString(binding.name,'BINDING_NAME_INVALID');
 const type=metadataString(binding.type,'BINDING_TYPE_INVALID');
 requireThat(['plain_text','secret_text','assets','durable_object_namespace','r2_bucket'].includes(type),'UNSUPPORTED_BINDING_TYPE');
 const result={name,type};
 if(type==='durable_object_namespace'){
  result.className=metadataString(binding.class_name,'DO_CLASS_MISSING');
  result.namespaceId=metadataString(binding.namespace_id,'DO_NAMESPACE_MISSING');
  if(binding.script_name)result.scriptName=metadataString(binding.script_name,'DO_SCRIPT_INVALID');
  if(binding.environment)result.environment=metadataString(binding.environment,'DO_ENVIRONMENT_INVALID');
 }
 if(type==='r2_bucket'){
  result.bucketName=metadataString(binding.bucket_name,'R2_BUCKET_MISSING');
  if(binding.jurisdiction)result.jurisdiction=metadataString(binding.jurisdiction,'R2_JURISDICTION_INVALID');
 }
 // Never inspect text/value/json for secret_text or unspecified plain_text bindings.
 return result;
}
export async function readSnapshot(target,{api,declaredVars={},expectedSha}={}){
 const info=targetInfo(target);const base=`/accounts/${RELEASE.account}/workers`;
 const script=`${base}/scripts/${info.service}`;
 const settings=await api(`${script}/settings`);
 requireThat(Array.isArray(settings?.bindings),'BINDINGS_MISSING');
 const bindings=sorted(settings.bindings.map(safeBinding));
 requireThat(new Set(bindings.map(b=>b.name)).size===bindings.length,'DUPLICATE_BINDING');
 for(const binding of bindings){
  if(binding.type==='durable_object_namespace')requireThat(info.dos[binding.name]===binding.className&&(!binding.scriptName||binding.scriptName===info.service)&&(!binding.environment||binding.environment==='production'),'DO_BINDING_MISMATCH');
  if(binding.type==='r2_bucket')requireThat(info.r2[binding.name]===binding.bucketName,'R2_BINDING_MISMATCH');
  if(binding.type==='assets')requireThat(binding.name==='ASSETS','ASSET_BINDING_MISMATCH');
 }
 for(const [name,className] of Object.entries(info.dos))requireThat(bindings.some(b=>b.name===name&&b.type==='durable_object_namespace'&&b.className===className),'DO_BINDING_MISSING');
 for(const [name,bucketName] of Object.entries(info.r2))requireThat(bindings.some(b=>b.name===name&&b.type==='r2_bucket'&&b.bucketName===bucketName),'R2_BINDING_MISSING');
 for(const name of info.secrets)requireThat(bindings.some(b=>b.name===name&&b.type==='secret_text'),'REQUIRED_EXISTING_SECRET_MISSING');
 if(target!=='pos')requireThat(bindings.some(b=>b.name==='ASSETS'&&b.type==='assets'),'ASSET_BINDING_MISSING');
 else requireThat(!bindings.some(b=>b.type==='assets'),'ASSET_ONLY_POS_BINDING_MISMATCH');
 // Only explicitly declared, reviewed nonsecret config is compared, in memory, without exporting values.
 for(const [name,value] of Object.entries(declaredVars)){
  requireThat(['KEETA_APP_ID','KEETA_PROVIDER_SHOP_ID','KEETA_OAUTH_REDIRECT_URI'].includes(name),'DECLARED_VAR_NOT_APPROVED');
  const binding=settings.bindings.find(b=>b.name===name);
  requireThat(binding?.type==='plain_text'&&binding.text===value,'DECLARED_VAR_MISMATCH');
 }
 const publicReleaseVars={};
 for(const name of ['MFK_SOURCE_SHA','MFP_V3_CONFIG_WRITES_ENABLED']){
  const binding=settings.bindings.find(b=>b.name===name);
  if(binding){
   requireThat(binding.type==='plain_text','RELEASE_VAR_TYPE_MISMATCH');
   if(name==='MFK_SOURCE_SHA')publicReleaseVars.sourceSha=exactSHA(binding.text)?binding.text:'UNVERIFIED';
   else publicReleaseVars.configurationWritesEnabled=binding.text==='1';
   if(expectedSha&&target==='admin')requireThat(binding.text===(name==='MFK_SOURCE_SHA'?expectedSha:'0'),'RELEASE_VAR_MISMATCH');
  }else if(expectedSha&&target==='admin')fail('RELEASE_VAR_MISSING');
 }
 const deploymentResult=await api(`${script}/deployments`);
 const deployment=deploymentResult?.deployments?.[0];
 requireThat(deployment&&Array.isArray(deployment.versions)&&deployment.versions.length===1&&deployment.versions[0].percentage===100,'SINGLE_FULL_DEPLOYMENT_REQUIRED');
 const versionId=metadataString(deployment.versions[0].version_id,'VERSION_ID_MISSING');
 const version=await api(`${script}/versions/${encodeURIComponent(versionId)}`);
 requireThat(version?.id===versionId,'VERSION_ID_MISMATCH');
 const migrationTag=version?.resources?.script_runtime?.migration_tag||null;
 requireThat(migrationTag===info.migration,'MIGRATION_TAG_MISMATCH');
 const scriptEtag=metadataString(version?.resources?.script?.etag,'SCRIPT_ETAG_MISSING');
 const scriptSubdomain=await api(`${script}/subdomain`);
 requireThat(typeof scriptSubdomain?.enabled==='boolean'&&typeof scriptSubdomain?.previews_enabled==='boolean','SCRIPT_SUBDOMAIN_STATE_MISSING');
 let domain;
 if(target==='pos'){
  const accountSubdomain=await api(`${base}/subdomain`);
  requireThat(accountSubdomain?.subdomain==='yeungyi88'&&scriptSubdomain.enabled,'WORKERS_DEV_MISMATCH');
  requireThat(scriptSubdomain.previews_enabled===false,'PREVIEW_URLS_MISMATCH');
  domain={hostname:info.host,service:info.service,workersDev:true};
 }else{
  const domains=await api(`${base}/domains`);
  requireThat(Array.isArray(domains),'CUSTOM_DOMAINS_MISSING');
  const matches=domains.filter(d=>d.hostname===info.host);
  requireThat(matches.length===1&&matches[0].service===info.service&&matches[0].environment==='production','CUSTOM_DOMAIN_MISMATCH');
  domain={hostname:info.host,service:info.service,environment:'production'};
  requireThat(scriptSubdomain.enabled&&scriptSubdomain.previews_enabled,'SUBDOMAIN_CONFIG_MISMATCH');
 }
 return {target,service:info.service,accountId:RELEASE.account,domain,subdomain:{enabled:scriptSubdomain.enabled,previewsEnabled:scriptSubdomain.previews_enabled},deploymentId:metadataString(deployment.id,'DEPLOYMENT_ID_MISSING'),versionId,scriptEtag,migrationTag,bindings,publicReleaseVars};
}
export function assertPreserved(before,after){
 const stable=(snapshot)=>({target:snapshot.target,service:snapshot.service,accountId:snapshot.accountId,domain:snapshot.domain,subdomain:snapshot.subdomain,migrationTag:snapshot.migrationTag,bindings:snapshot.bindings.filter(b=>snapshot.target!=='admin'||!['MFK_SOURCE_SHA','MFP_V3_CONFIG_WRITES_ENABLED'].includes(b.name))});
 requireThat(same(stable(before),stable(after)),'PERSISTENT_METADATA_CHANGED');
}
export function validateBuildIdentity(target,identity,sha){
 requireThat(exactSHA(sha),'EXPECTED_SHA_INVALID');targetInfo(target);
 if(target==='admin')requireThat(identity?.sourceSha===sha&&identity.mode==='PRESERVATION'&&identity.configurationWritesEnabled===false,'ADMIN_PRESERVATION_IDENTITY_MISMATCH');
 if(target==='pos')requireThat(identity?.target==='MFP_V3'&&identity.sourceSha===sha,'POS_IDENTITY_MISMATCH');
 if(target==='customer')requireThat(identity?.surface==='MFP_CUSTOMER_V3'&&identity.sourceCommit===sha&&identity.sourceDirty===false,'CUSTOMER_IDENTITY_MISMATCH');
}
export function makePosConfig(root){return {name:TARGETS.pos.service,compatibility_date:'2026-10-03',workers_dev:true,preview_urls:false,assets:{directory:join(root,'v3smt/dist'),not_found_handling:'single-page-application'}};}
export function validateConfig(target,config,root){
 const info=targetInfo(target);const dir=join(root,info.directory);
 requireThat(config.name===info.service,'CONFIG_SERVICE_MISMATCH');
 requireThat(config.workers_dev===true&&config.preview_urls===(target!=='pos'),'CONFIG_SUBDOMAIN_MISMATCH');
 const allowed=['$schema','name','main','compatibility_date','workers_dev','preview_urls','assets',...(target==='admin'?['vars','secrets','r2_buckets','durable_objects','migrations']:target==='customer'?['r2_buckets']:[])];
 requireThat(Object.keys(config).every(key=>allowed.includes(key)),'CONFIG_KEY_NOT_APPROVED');
 requireThat(config.compatibility_date===(target==='admin'?'2026-09-22':target==='customer'?'2026-09-29':'2026-10-03'),'CONFIG_COMPATIBILITY_MISMATCH');
 requireThat(resolve(dir,config.assets?.directory||'')===join(dir,'dist'),'CONFIG_ASSET_PATH_MISMATCH');
 const expectedAssets={directory:config.assets.directory,not_found_handling:'single-page-application',...(target==='pos'?{}:{binding:'ASSETS',run_worker_first:target==='admin'?['/*','!/assets/*']:['/media/*']})};
 requireThat(same(sorted(Object.entries(config.assets)),sorted(Object.entries(expectedAssets))),'CONFIG_ASSETS_MISMATCH');
 if(target!=='pos')requireThat(config.main===(target==='admin'?'./worker.ts':'./worker.js'),'CONFIG_MAIN_MISMATCH');
 if(target!=='pos')requireThat(same(sorted(config.r2_buckets||[]),sorted(Object.entries(info.r2).map(([binding,bucket_name])=>({binding,bucket_name})))),'CONFIG_R2_MISMATCH');
 if(target==='admin'){
  requireThat(same(sorted(config.durable_objects?.bindings||[]),sorted(Object.entries(info.dos).map(([name,class_name])=>({name,class_name})))),'CONFIG_DO_MISMATCH');
  requireThat(same(config.migrations,[{tag:'admin-sync-v1',new_sqlite_classes:['AdminSyncStore']},{tag:'keeta-runtime-v1',new_sqlite_classes:['KeetaRuntimeStore']},{tag:'customer-runtime-v1',new_sqlite_classes:['CustomerRuntimeStore']}]),'CONFIG_MIGRATION_MISMATCH');
  requireThat(same(Object.keys(config.vars||{}).sort(),['KEETA_APP_ID','KEETA_OAUTH_REDIRECT_URI','KEETA_PROVIDER_SHOP_ID']),'CONFIG_VARS_MISMATCH');
  requireThat(same(config.secrets?.required,info.secrets)&&Object.keys(config.secrets).length===1,'CONFIG_SECRETS_MISMATCH');
 }
 return config;
}
export async function runQuiet(command,args,{cwd,env=process.env}={}){
 // Pipe buffers are intentionally discarded in memory. Never inherit or persist Wrangler logs.
 return await new Promise(resolveResult=>{
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  child.once('error',()=>resolveResult({exitCode:127}));
  child.once('close',code=>resolveResult({exitCode:Number.isInteger(code)?code:128}));
 });
}
export async function createWranglerEnvironment(tempRoot,baseEnv=process.env){
 const directory=await mkdtemp(join(tempRoot,'v3-release-log-'));
 await chmod(directory,0o700);
 const logPath=join(directory,'discard.log');await symlink('/dev/null',logPath);
 const env={...baseEnv,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'error',WRANGLER_LOG_SANITIZE:'true',WRANGLER_LOG_PATH:logPath};
 delete env.GH_TOKEN;delete env.GITHUB_TOKEN;
 return env;
}
function apiClient(){
 requireThat(process.env.CLOUDFLARE_ACCOUNT_ID===RELEASE.account,'CLOUDFLARE_ACCOUNT_MISMATCH');
 const token=process.env.CLOUDFLARE_API_TOKEN;requireThat(typeof token==='string'&&token.length>0,'CLOUDFLARE_TOKEN_MISSING');
 return async(path)=>{
  requireThat(path.startsWith(`/accounts/${RELEASE.account}/workers/`),'API_ROUTE_NOT_APPROVED');
  const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{method:'GET',headers:{authorization:`Bearer ${token}`,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
  requireThat(response.ok,'CLOUDFLARE_METADATA_READ_FAILED');
  const body=await response.json();requireThat(body?.success===true&&body.result!==undefined,'CLOUDFLARE_METADATA_RESPONSE_INVALID');
  if(body.result_info?.total_pages>1)fail('METADATA_PAGINATION_REQUIRES_REVIEW');
  return body.result;
 };
}
async function contextFromEnvironment(){
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 const localHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 return guardContext({repository:process.env.GITHUB_REPOSITORY,repositoryOwner:process.env.GITHUB_REPOSITORY_OWNER,eventName:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,sha:process.env.GITHUB_SHA,localHead,inputs:event.inputs});
}
async function loadConfig(target,root){
 if(target==='pos')return makePosConfig(root);
 // These release configs deliberately use the strict JSON subset of JSONC.
 return JSON.parse(await readFile(join(root,targetInfo(target).directory,'wrangler.release.jsonc'),'utf8'));
}
async function readIdentity(target,root,sha){const info=targetInfo(target);const body=JSON.parse(await readFile(join(root,info.directory,'dist',info.identity),'utf8'));validateBuildIdentity(target,body,sha);return body;}
async function publicReadback(target,sha){
 const info=targetInfo(target);
 const get=async(path)=>{
  const response=await fetch(`https://${info.host}/${path}`,{headers:{accept:'application/json','cache-control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(20000)});
  requireThat(response.ok,'PUBLIC_READBACK_HTTP_FAILED');return response.json();
 };
 // Bounded release verification, not business/auth polling. Only static identity and health.
 for(let attempt=0;attempt<12;attempt++){
  try{
   const identity=await get(info.identity);validateBuildIdentity(target,identity,sha);
   if(target==='admin'){
    const health=await get('api/health');
    requireThat(health?.ok===true&&health.service===info.service&&health.sourceSha===sha&&health.configurationWritesEnabled===false,'ADMIN_HEALTH_MISMATCH');
   }
   return {sourceSha:sha,identityVerified:true,...(target==='admin'?{configurationWritesEnabled:false,mode:'PRESERVATION'}:{})};
  }catch{if(attempt===11)fail('PUBLIC_IDENTITY_READBACK_FAILED');await new Promise(r=>setTimeout(r,5000));}
 }
}
async function main(){
 const [command,target]=process.argv.slice(2);const root=process.cwd();
 if(command==='guard'){
  const ctx=await contextFromEnvironment();await verifyRemoteHead(ctx.expectedSha,{token:process.env.GH_TOKEN});
  if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify({target:ctx.targets})}\n`,{flag:'a'});
  console.log('TRUSTED_EXACT_SOURCE_VERIFIED');return;
 }
 targetInfo(target);const receiptPath=join(root,'release-evidence',target,'receipt.json');
 await mkdir(dirname(receiptPath),{recursive:true});
 let receipt={schemaVersion:1,target,expectedSha:process.env.GITHUB_SHA||null,operation:null,status:'STARTED',attemptedDeployment:false};
 if(command==='init'){await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');return;}
 if(command==='finalize'){
  try{receipt=JSON.parse(await readFile(receiptPath,'utf8'));}catch{}
  if(!['PREFLIGHT_PASSED','DEPLOYED_VERIFIED','FAILED'].includes(receipt.status))receipt.status='FAILED';
  receipt.jobStatus=process.env.RELEASE_JOB_STATUS||'unknown';
  if(receipt.jobStatus!=='success'&&receipt.status!=='FAILED'){receipt.previousStatus=receipt.status;receipt.status='FAILED';}
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');return;
 }
 try{
  const ctx=await contextFromEnvironment();requireThat(ctx.targets.includes(target),'TARGET_NOT_REQUESTED');receipt.operation=ctx.operation;
  const config=validateConfig(target,await loadConfig(target,root),root);
  await readIdentity(target,root,ctx.expectedSha);
  if(command==='verify-build'){console.log('BUILD_IDENTITY_AND_FIXED_CONFIG_VERIFIED');return;}
  requireThat(command==='release','COMMAND_INVALID');
  // Re-check remote HEAD immediately before the first Cloudflare credential use.
  await verifyRemoteHead(ctx.expectedSha,{token:process.env.GH_TOKEN});
  const api=apiClient();const declaredVars=config.vars||{};
  const before=await readSnapshot(target,{api,declaredVars});receipt.before=before;receipt.status='PREFLIGHT_PASSED';
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  if(ctx.operation==='preflight'){console.log('EXISTING_TARGET_PREFLIGHT_PASSED');return;}
  // Recheck target metadata immediately before mutation. No automatic service creation.
  const latest=await readSnapshot(target,{api,declaredVars});
  requireThat(same(before,latest),'PREDEPLOY_METADATA_CHANGED');
  await verifyRemoteHead(ctx.expectedSha,{token:process.env.GH_TOKEN});
  const configPath=target==='pos'?join(process.env.RUNNER_TEMP||'/tmp',`mfp-v3-pos-release-${process.env.GITHUB_RUN_ID||'run'}.json`):join(root,targetInfo(target).directory,'wrangler.release.jsonc');
  if(target==='pos')await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  receipt.status='DEPLOYMENT_ATTEMPTED';receipt.attemptedDeployment=true;await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  const wranglerPath=join(process.env.RUNNER_TEMP||'/tmp','v3-release-tools/node_modules/wrangler/bin/wrangler.js');
  const wranglerPackage=JSON.parse(await readFile(join(dirname(wranglerPath),'../package.json'),'utf8'));
  requireThat(wranglerPackage.version===RELEASE.wrangler,'WRANGLER_VERSION_MISMATCH');
  const args=[wranglerPath,'deploy','--config',configPath,'--keep-vars','--no-autoconfig',...(target==='admin'?['--var',`MFK_SOURCE_SHA:${ctx.expectedSha}`,'--var','MFP_V3_CONFIG_WRITES_ENABLED:0']:[])];
  const commandResult=await runQuiet(process.execPath,args,{cwd:root,env:await createWranglerEnvironment(process.env.RUNNER_TEMP||'/tmp')});
  receipt.wrangler={version:RELEASE.wrangler,exitCode:commandResult.exitCode};
  // Read back even after a nonzero command exit: upload could have partially succeeded.
  try{receipt.after=await readSnapshot(target,{api,declaredVars,expectedSha:ctx.expectedSha});assertPreserved(before,receipt.after);}catch{receipt.postflight='FAILED';fail('POSTDEPLOY_METADATA_UNVERIFIED');}
  requireThat(commandResult.exitCode===0,'WRANGLER_DEPLOY_FAILED');
  receipt.readback=await publicReadback(target,ctx.expectedSha);receipt.status='DEPLOYED_VERIFIED';
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log('DEPLOYED_AND_PRESERVATION_VERIFIED');
 }catch(error){
  receipt.status='FAILED';receipt.failureCode=/^[A-Z0-9_]+$/.test(error?.message||'')?error.message:'UNEXPECTED_FAILURE';
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  console.error(receipt.failureCode);process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('RELEASE_HELPER_FAILED');process.exitCode=1;});
