import {createMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope,type MfkAdminConfigAck} from '../../contracts/admin-config-sync-v1.ts';
import {readAdminReleases,readAdminStored,writeAdminStored,type AdminRelease} from './admin-local-store.ts';

const OUTBOX_KEY='sync-outbox.v1';
const STATUS_KEY='sync-status.v1';
const PUBLISHER_KEY='sync-publisher-key.v1';

export type AdminSyncState='IDLE'|'QUEUED'|'PUBLISHING'|'PUBLISHED'|'ERROR';
export interface AdminSyncStatus{
  readonly state:AdminSyncState;
  readonly revision?:number;
  readonly fingerprint?:string;
  readonly updatedAt:string;
  readonly error?:string;
}
const idle=():AdminSyncStatus=>({state:'IDLE',updatedAt:new Date().toISOString()});

function emit(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-admin-sync'));}

export function readAdminSyncStatus(){
  return readAdminStored<AdminSyncStatus>(STATUS_KEY,idle());
}
function writeStatus(status:AdminSyncStatus){
  writeAdminStored(STATUS_KEY,status);
  emit();
}
function readOutbox(){
  return readAdminStored<MfkAdminConfigEnvelope[]>(OUTBOX_KEY,[]);
}
function writeOutbox(rows:readonly MfkAdminConfigEnvelope[]){
  writeAdminStored(OUTBOX_KEY,rows);
  emit();
}
function randomKey(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function publisherKey(){
  let key=readAdminStored<string>(PUBLISHER_KEY,'');
  if(!key&&typeof crypto!=='undefined'){
    key=randomKey();
    writeAdminStored(PUBLISHER_KEY,key);
  }
  return key;
}

export function queueAdminReleaseSync(release:AdminRelease,storeId='MF01'){
  if(!release.snapshot||typeof release.snapshot!=='object'||Array.isArray(release.snapshot))throw new Error('ADMIN_SYNC_RELEASE_SNAPSHOT_INVALID');
  const envelope=createMfkAdminConfigEnvelope({
    storeId,
    revision:release.version,
    publishedAt:release.createdAt,
    adminFingerprint:release.fingerprint,
    snapshot:release.snapshot as Readonly<Record<string,unknown>>,
  });
  const rows=readOutbox().filter(row=>row.revision!==envelope.revision);
  writeOutbox([...rows,envelope].sort((a,b)=>a.revision-b.revision));
  writeStatus({state:'QUEUED',revision:envelope.revision,fingerprint:envelope.fingerprint,updatedAt:new Date().toISOString()});
  if(typeof window!=='undefined')void flushAdminSyncOutbox();
  return envelope;
}

export async function flushAdminSyncOutbox(){
  if(typeof window==='undefined'||typeof fetch==='undefined')return readAdminSyncStatus();
  const rows=readOutbox();
  if(rows.length===0)return readAdminSyncStatus();
  const latest=rows[rows.length-1]!;
  const key=publisherKey();
  if(!key){
    const status={state:'ERROR',revision:latest.revision,fingerprint:latest.fingerprint,updatedAt:new Date().toISOString(),error:'ADMIN_SYNC_PUBLISHER_KEY_UNAVAILABLE'} as const;
    writeStatus(status);
    return status;
  }
  writeStatus({state:'PUBLISHING',revision:latest.revision,fingerprint:latest.fingerprint,updatedAt:new Date().toISOString()});
  try{
    const response=await fetch('/api/admin-sync/publish?storeId='+encodeURIComponent(latest.storeId),{
      method:'POST',
      credentials:'same-origin',
      headers:{'content-type':'application/json','x-mfk-admin-publish-key':key},
      body:JSON.stringify(latest),
    });
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok)throw new Error(typeof body.code==='string'?body.code:'ADMIN_SYNC_PUBLISH_HTTP_'+response.status);
    writeOutbox(readOutbox().filter(row=>row.revision>latest.revision));
    const status={state:'PUBLISHED',revision:latest.revision,fingerprint:latest.fingerprint,updatedAt:new Date().toISOString()} as const;
    writeStatus(status);
    return status;
  }catch(error){
    const status={state:'ERROR',revision:latest.revision,fingerprint:latest.fingerprint,updatedAt:new Date().toISOString(),error:error instanceof Error?error.message:'ADMIN_SYNC_PUBLISH_FAILED'} as const;
    writeStatus(status);
    return status;
  }
}

export async function readAdminSyncAcks(storeId='MF01'):Promise<readonly MfkAdminConfigAck[]>{
  if(typeof fetch==='undefined')return [];
  try{
    const response=await fetch('/api/admin-sync/acks?storeId='+encodeURIComponent(storeId),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)return [];
    const body=await response.json() as {acks?:MfkAdminConfigAck[]};
    return Array.isArray(body.acks)?body.acks:[];
  }catch{return [];}
}

let installed=false;
export function installAdminSyncAutoFlush(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const flush=()=>{void flushAdminSyncOutbox();};
  const queueLatest=()=>{
    const latest=readAdminReleases()[0];
    if(!latest)return;
    const status=readAdminSyncStatus();
    const pending=readOutbox().some(row=>row.revision===latest.version);
    if(status.revision===latest.version&&status.state==='PUBLISHED'&&!pending)return;
    queueAdminReleaseSync(latest);
  };
  window.addEventListener('online',flush);
  window.addEventListener('focus',flush);
  window.addEventListener('mfk-admin-release',queueLatest);
  window.setTimeout(()=>{queueLatest();flush();},0);
}
