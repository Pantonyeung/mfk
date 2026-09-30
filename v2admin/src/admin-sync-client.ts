import {createMfkAdminConfigEnvelope,validateMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope,type MfkAdminConfigAck} from '../../contracts/admin-config-sync-v1.ts';
import {projectStaffForRuntime} from '../../contracts/staff-auth-v1.ts';
import {readAdminReleases,readAdminStored,writeAdminStored,type AdminRelease} from './admin-local-store.ts';
import {readStoredAdminBrowserSession} from './admin-browser-session.ts';

const OUTBOX_KEY='sync-outbox.v1';
const STATUS_KEY='sync-status.v1';
const PUBLISHER_KEY='sync-publisher-key.v1';

export type AdminSyncState='IDLE'|'QUEUED'|'PUBLISHING'|'PUBLISHED'|'ERROR';
export interface AdminSyncStatus{
  readonly state:AdminSyncState;
  readonly revision?:number;
  readonly fingerprint?:string;
  readonly cloudPublishedAt?:string;
  readonly adminFingerprint?:string;
  readonly updatedAt:string;
  readonly error?:string;
}
const idle=():AdminSyncStatus=>({state:'IDLE',updatedAt:new Date().toISOString()});

export function validateAdminPublishConfirmation(input:unknown,expected:MfkAdminConfigEnvelope){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_SYNC_PUBLISH_CONFIRMATION_INVALID');
  const body=input as {state?:unknown;active?:unknown;cloudPublishedAt?:unknown;publishRequestFingerprint?:unknown};
  if(body.state!=='PUBLISHED'&&body.state!=='IDEMPOTENT')throw new Error('ADMIN_SYNC_PUBLISH_CONFIRMATION_INVALID');
  const active=validateMfkAdminConfigEnvelope(body.active);
  if(String(body.publishRequestFingerprint||'')!==expected.fingerprint||active.adminFingerprint!==expected.adminFingerprint){
    throw new Error('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  }
  const cloudPublishedAt=String(body.cloudPublishedAt||'').trim();
  if(!Number.isFinite(Date.parse(cloudPublishedAt))||active.publishedAt!==cloudPublishedAt){
    throw new Error('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
  }
  return Object.freeze({state:body.state,active,cloudPublishedAt});
}

function emit(){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-admin-sync'));}

export function readAdminSyncStatus(){
  return readAdminStored<AdminSyncStatus>(STATUS_KEY,idle());
}
export function reconcileAdminSyncStatusFromCanonical(active:MfkAdminConfigEnvelope){
  const current=readAdminSyncStatus();
  const next:AdminSyncStatus={
    state:'PUBLISHED',
    revision:active.revision,
    fingerprint:active.fingerprint,
    adminFingerprint:active.adminFingerprint,
    cloudPublishedAt:active.publishedAt,
    updatedAt:new Date().toISOString(),
  };
  if(current.state===next.state&&current.revision===next.revision&&current.fingerprint===next.fingerprint&&current.adminFingerprint===next.adminFingerprint&&current.cloudPublishedAt===next.cloudPublishedAt&&!current.error)return current;
  writeStatus(next);
  return next;
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

export function readExistingAdminPublisherKey(){
  return readAdminStored<string>(PUBLISHER_KEY,'');
}

export async function readCanonicalAdminActiveWithPublisherKey(storeId='MF01'):Promise<MfkAdminConfigEnvelope|null>{
  if(typeof fetch==='undefined')return null;
  const key=readExistingAdminPublisherKey();
  if(!key)return null;
  try{
    const response=await fetch('/api/admin-browser/publisher-active?storeId='+encodeURIComponent(storeId),{
      method:'GET',
      cache:'no-store',
      credentials:'same-origin',
      headers:{'x-mfk-admin-publish-key':key},
    });
    if(!response.ok)return null;
    return validateMfkAdminConfigEnvelope(await response.json());
  }catch{return null;}
}

async function runtimeSnapshot(release:AdminRelease){
  if(!release.snapshot||typeof release.snapshot!=='object'||Array.isArray(release.snapshot))throw new Error('ADMIN_SYNC_RELEASE_SNAPSHOT_INVALID');
  const snapshot=release.snapshot as Readonly<Record<string,unknown>>;
  return Object.freeze({
    ...snapshot,
    staffAuth:await projectStaffForRuntime(snapshot.staff),
    // Never transmit raw staff PIN material to SMT/cloud projection.
    staff:undefined,
  });
}

export async function queueAdminReleaseSync(release:AdminRelease,storeId='MF01'){
  const envelope=createMfkAdminConfigEnvelope({
    storeId,
    revision:release.version,
    publishedAt:release.createdAt,
    adminFingerprint:release.fingerprint,
    snapshot:await runtimeSnapshot(release),
  });
  const rows=readOutbox().filter(row=>row.fingerprint!==envelope.fingerprint);
  writeOutbox([...rows,envelope].sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt)));
  writeStatus({state:'QUEUED',revision:envelope.revision,fingerprint:envelope.fingerprint,adminFingerprint:envelope.adminFingerprint,updatedAt:new Date().toISOString()});
  if(typeof window!=='undefined')void flushAdminSyncOutbox();
  return envelope;
}

let adminSyncFlushInFlight:Promise<AdminSyncStatus>|null=null;

export async function flushAdminSyncOutbox(){
  if(typeof window==='undefined'||typeof fetch==='undefined')return readAdminSyncStatus();
  if(adminSyncFlushInFlight)return adminSyncFlushInFlight;

  adminSyncFlushInFlight=(async()=>{
    while(true){
      const rows=readOutbox().slice().sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
      if(rows.length===0)return readAdminSyncStatus();

      // Deliver every formal publish. Never collapse to only the numerically latest revision.
      const next=rows[0]!;
      const browserSession=readStoredAdminBrowserSession();
      const key=browserSession?'':publisherKey();
      if(!browserSession&&!key){
        const status={state:'ERROR',revision:next.revision,fingerprint:next.fingerprint,adminFingerprint:next.adminFingerprint,updatedAt:new Date().toISOString(),error:'ADMIN_SYNC_PUBLISHER_KEY_UNAVAILABLE'} as const;
        writeStatus(status);
        return status;
      }

      writeStatus({state:'PUBLISHING',revision:next.revision,fingerprint:next.fingerprint,adminFingerprint:next.adminFingerprint,updatedAt:new Date().toISOString()});
      try{
        const endpoint=browserSession?'/api/admin-browser/publish':'/api/admin-sync/publish';
        const headers:Record<string,string>={'content-type':'application/json'};
        if(browserSession)headers['x-mfk-admin-session']=browserSession.sessionToken;
        else headers['x-mfk-admin-publish-key']=key;
        const response=await fetch(endpoint+'?storeId='+encodeURIComponent(next.storeId),{
          method:'POST',
          credentials:'same-origin',
          headers,
          body:JSON.stringify(next),
        });
        const body=await response.json().catch(()=>({})) as Record<string,unknown>;
        if(!response.ok)throw new Error(typeof body.code==='string'?body.code:'ADMIN_SYNC_PUBLISH_HTTP_'+response.status);
        const confirmed=validateAdminPublishConfirmation(body,next);

        writeOutbox(readOutbox().filter(row=>row.fingerprint!==next.fingerprint));
        writeStatus({
          state:'PUBLISHED',
          revision:confirmed.active.revision,
          fingerprint:confirmed.active.fingerprint,
          adminFingerprint:confirmed.active.adminFingerprint,
          cloudPublishedAt:confirmed.cloudPublishedAt,
          updatedAt:new Date().toISOString(),
        });
      }catch(error){
        const status={state:'ERROR',revision:next.revision,fingerprint:next.fingerprint,adminFingerprint:next.adminFingerprint,updatedAt:new Date().toISOString(),error:error instanceof Error?error.message:'ADMIN_SYNC_PUBLISH_FAILED'} as const;
        writeStatus(status);
        return status;
      }
    }
  })().finally(()=>{
    adminSyncFlushInFlight=null;
    if(readOutbox().length)void flushAdminSyncOutbox();
  });

  return adminSyncFlushInFlight;
}


export async function uploadAdminPaymentQr(file:File,channelId:string,storeId='MF01'):Promise<{readonly qrImageUrl:string;readonly objectKey:string}>{
  const id=channelId.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(id))throw new Error('PAYMENT_CHANNEL_ID_INVALID');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('付款 QR 只支援 JPG、PNG 或 WebP');
  if(file.size<1||file.size>5*1024*1024)throw new Error('付款 QR 圖片必須細過 5MB');
  const key=publisherKey();
  if(!key)throw new Error('ADMIN_SYNC_PUBLISHER_KEY_UNAVAILABLE');
  const url='/api/admin/payment-qr?storeId='+encodeURIComponent(storeId)+'&channelId='+encodeURIComponent(id);
  const response=await fetch(url,{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':file.type,'x-mfk-admin-publish-key':key},
    body:file,
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||typeof body.qrImageUrl!=='string'||typeof body.objectKey!=='string'){
    throw new Error(typeof body.code==='string'?body.code:'ADMIN_PAYMENT_QR_UPLOAD_HTTP_'+response.status);
  }
  return Object.freeze({qrImageUrl:body.qrImageUrl,objectKey:body.objectKey});
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
    const pending=readOutbox().some(row=>row.revision===latest.version&&row.adminFingerprint===latest.fingerprint);
    if(status.state==='PUBLISHED'&&!pending&&status.revision===latest.version&&status.adminFingerprint===latest.fingerprint)return;
    void queueAdminReleaseSync(latest);
  };
  window.addEventListener('online',flush);
  window.addEventListener('focus',flush);
  window.addEventListener('mfk-admin-release',queueLatest);
  window.setTimeout(flush,0);
}

export interface AdminDiningOccupancyReadback{
  readonly storeId:string;readonly tableId:string;readonly hasActiveSession:boolean;readonly activeSessionCount:number;
  readonly observedAt:string;readonly runtimeRevision:number;readonly receivedAt?:string;
}
export async function readFreshDiningOccupancy(tableId:string,maxAgeMs=5000):Promise<AdminDiningOccupancyReadback|null>{
  const id=String(tableId||'').trim();if(!id||typeof fetch==='undefined')return null;
  const key=readExistingAdminPublisherKey();if(!key)return null;
  try{
    const response=await fetch('/api/admin-sync/dining-occupancy?storeId=MF01&tableId='+encodeURIComponent(id),{method:'GET',cache:'no-store',credentials:'same-origin',headers:{'x-mfk-admin-publish-key':key}});
    if(!response.ok)return null;
    const body=await response.json() as {readback?:AdminDiningOccupancyReadback};
    const row=body.readback;if(!row||row.tableId!==id)return null;
    const age=Date.now()-Date.parse(row.observedAt);
    if(!Number.isFinite(age)||age<0||age>maxAgeMs)return null;
    return Object.freeze({...row});
  }catch{return null;}
}
