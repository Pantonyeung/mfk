import {
  mfkHongKongIso,
  mfkPublishTimeMs,
  validateMfkAdminConfigEnvelope,
  type MfkAdminConfigAck,
  type MfkAdminConfigEnvelope,
} from '../../../contracts/admin-config-sync-v1.ts';
import {smtAdminHttpOrigin,smtAdminWebSocketUrl} from './web-acceptance.ts';

export const SMT_ADMIN_CONFIG_LKG_KEY='mfk.admin-sync.active.v1';
export const SMT_ADMIN_CONFIG_STATUS_KEY='mfk.admin-sync.status.v1';
export const SMT_ADMIN_CONFIG_DEVICE_KEY='mfk.admin-sync.device.v1';
export const SMT_ADMIN_TIME_FIRST_CUTOVER_KEY='mfk.admin-sync.time-first-cutover.v1';
export const SMT_ADMIN_CONFIG_ENDPOINT=smtAdminHttpOrigin();

export type SmtAdminSyncState='LOCAL_LKG'|'CONNECTING'|'SYNCED'|'WAITING_ADMIN_PUBLISH'|'OFFLINE'|'ERROR';
export interface SmtAdminSyncStatus{
  readonly state:SmtAdminSyncState;
  readonly revision:number;
  readonly fingerprint:string;
  readonly publishedAt?:string;
  readonly receivedAt?:string;
  readonly appliedAt?:string;
  readonly ackAt?:string;
  readonly updatedAt:string;
  readonly error?:string;
}
export interface SmtAdminConfigApplyResult{
  readonly disposition:'APPLIED'|'IDEMPOTENT'|'STALE';
  readonly revision:number;
  readonly fingerprint:string;
}
export interface SmtAdminTimeFirstCutover{
  readonly clearedAt:string;
  readonly priorFingerprint:string|null;
  readonly priorPublishedAt:string|null;
  readonly priorRevision:number|null;
}

const listeners=new Set<()=>void>();
export interface SmtCloudDoorbell{readonly type:string;readonly [key:string]:unknown}
const ADMIN_PROPAGATION_DIAG_KEY='mfk.v2local.admin-propagation-diag.v1';
const cloudDoorbellListeners=new Set<(event:SmtCloudDoorbell)=>void();

function emit(){for(const listener of listeners)listener();}
function now(){return mfkHongKongIso();}
function readJson<T>(key:string,fallback:T):T{
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw) as T:fallback;
  }catch{return fallback;}
}
function writeJson(key:string,value:unknown){
  localStorage.setItem(key,JSON.stringify(value));
}
function randomId(){
  const bytes=new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'SMT-'+[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function readSmtDeviceId(){
  let id=readJson<string>(SMT_ADMIN_CONFIG_DEVICE_KEY,'');
  if(!id){
    id=randomId();
    writeJson(SMT_ADMIN_CONFIG_DEVICE_KEY,id);
  }
  return id;
}
export function readSmtAdminConfigLkg():MfkAdminConfigEnvelope|null{
  try{
    const raw=localStorage.getItem(SMT_ADMIN_CONFIG_LKG_KEY);
    return raw?validateMfkAdminConfigEnvelope(JSON.parse(raw)):null;
  }catch{return null;}
}
export function readSmtAdminTimeFirstCutover(){
  return readJson<SmtAdminTimeFirstCutover|null>(SMT_ADMIN_TIME_FIRST_CUTOVER_KEY,null);
}
export function readSmtAdminSyncStatus():SmtAdminSyncStatus{
  const active=readSmtAdminConfigLkg();
  return readJson<SmtAdminSyncStatus>(SMT_ADMIN_CONFIG_STATUS_KEY,{
    state:active?'LOCAL_LKG':'OFFLINE',
    revision:active?.revision??0,
    fingerprint:active?.fingerprint??'',
    publishedAt:active?.publishedAt,
    updatedAt:active?.publishedAt??now(),
  });
}
function setStatus(status:SmtAdminSyncStatus){
  writeJson(SMT_ADMIN_CONFIG_STATUS_KEY,status);
  emit();
}
export function subscribeSmtAdminConfig(listener:()=>void){
  listeners.add(listener);
  return()=>{listeners.delete(listener);};
}
export function subscribeSmtCloudDoorbell(listener:(event:SmtCloudDoorbell)=>void){
  cloudDoorbellListeners.add(listener);
  return()=>{cloudDoorbellListeners.delete(listener);};
}

export function clearLegacySmtAdminConfigForTimeFirstCutover(){
  if(typeof localStorage==='undefined')return false;
  if(localStorage.getItem(SMT_ADMIN_TIME_FIRST_CUTOVER_KEY))return false;
  const prior=readSmtAdminConfigLkg();
  localStorage.removeItem(SMT_ADMIN_CONFIG_LKG_KEY);
  localStorage.removeItem(SMT_ADMIN_CONFIG_STATUS_KEY);
  localStorage.removeItem(ADMIN_PROPAGATION_DIAG_KEY);
  writeJson(SMT_ADMIN_TIME_FIRST_CUTOVER_KEY,{
    clearedAt:now(),
    priorFingerprint:prior?.fingerprint??null,
    priorPublishedAt:prior?.publishedAt??null,
    priorRevision:prior?.revision??null,
  } satisfies SmtAdminTimeFirstCutover);
  emit();
  return true;
}

export function applyAdminConfigEnvelope(input:unknown):SmtAdminConfigApplyResult{
  const next=validateMfkAdminConfigEnvelope(input);
  const current=readSmtAdminConfigLkg();
  const nextPublishedAt=mfkPublishTimeMs(next.publishedAt);

  if(!current){
    const cutover=readSmtAdminTimeFirstCutover();
    if(cutover&&nextPublishedAt<=mfkPublishTimeMs(cutover.clearedAt)){
      return Object.freeze({disposition:'STALE',revision:next.revision,fingerprint:next.fingerprint});
    }
  }

  if(current){
    const currentPublishedAt=mfkPublishTimeMs(current.publishedAt);
    if(nextPublishedAt<currentPublishedAt){
      return Object.freeze({disposition:'STALE',revision:current.revision,fingerprint:current.fingerprint});
    }
    if(nextPublishedAt===currentPublishedAt){
      if(next.fingerprint!==current.fingerprint)throw new Error('ADMIN_CONFIG_PUBLISHED_AT_CONFLICT');
      const prior=readSmtAdminSyncStatus();
      const appliedAt=now();
      setStatus({
        state:'SYNCED',
        revision:current.revision,
        fingerprint:current.fingerprint,
        publishedAt:current.publishedAt,
        receivedAt:prior.receivedAt,
        appliedAt,
        ackAt:prior.ackAt,
        updatedAt:appliedAt,
      });
      return Object.freeze({disposition:'IDEMPOTENT',revision:current.revision,fingerprint:current.fingerprint});
    }
  }

  writeJson(SMT_ADMIN_CONFIG_LKG_KEY,next);
  const prior=readSmtAdminSyncStatus();
  const appliedAt=now();
  setStatus({
    state:'SYNCED',
    revision:next.revision,
    fingerprint:next.fingerprint,
    publishedAt:next.publishedAt,
    receivedAt:prior.receivedAt,
    appliedAt,
    updatedAt:appliedAt,
  });
  return Object.freeze({disposition:'APPLIED',revision:next.revision,fingerprint:next.fingerprint});
}

async function ack(envelope:MfkAdminConfigEnvelope,disposition:'APPLIED'|'IDEMPOTENT'){
  const body:MfkAdminConfigAck={
    schema:'MFK_ADMIN_CONFIG_ACK_V1',
    storeId:envelope.storeId,
    deviceId:readSmtDeviceId(),
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    publishedAt:envelope.publishedAt,
    appliedAt:now(),
    disposition,
  };
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/ack?storeId='+encodeURIComponent(envelope.storeId),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!response.ok)throw new Error('ADMIN_CONFIG_ACK_HTTP_'+response.status);
  const ackAt=now();
  const status=readSmtAdminSyncStatus();
  if(status.fingerprint===envelope.fingerprint){
    setStatus({...status,ackAt,updatedAt:ackAt});
  }
  const diag=readJson<Record<string,unknown>>(ADMIN_PROPAGATION_DIAG_KEY,{});
  writeJson(ADMIN_PROPAGATION_DIAG_KEY,{...diag,ackAt});
}

async function applyCanonicalEnvelope(input:unknown){
  const envelope=validateMfkAdminConfigEnvelope(input);
  const applied=applyAdminConfigEnvelope(envelope);
  if(applied.disposition==='STALE')return applied;
  const appliedAt=readSmtAdminSyncStatus().appliedAt??now();
  const diag=readJson<Record<string,unknown>>(ADMIN_PROPAGATION_DIAG_KEY,{});
  writeJson(ADMIN_PROPAGATION_DIAG_KEY,{
    ...diag,
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    publishedAt:envelope.publishedAt,
    appliedAt,
  });
  await ack(envelope,applied.disposition);
  return applied;
}

let adminConfigFetchInFlight:Promise<SmtAdminConfigApplyResult|null>|null=null;
let adminConfigRefetchRequested=false;

async function fetchActiveFallback(){
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/active?storeId=MF01',{cache:'no-store'});
  if(response.status===404)return null;
  if(!response.ok)throw new Error('ADMIN_CONFIG_FETCH_HTTP_'+response.status);
  return applyCanonicalEnvelope(await response.json());
}

async function fetchPublishedSince(after:string){
  const url=SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/published-since?storeId=MF01&after='+encodeURIComponent(after);
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error('ADMIN_CONFIG_HISTORY_HTTP_'+response.status);
  const body=await response.json() as {items?:unknown[]};
  return Array.isArray(body.items)?body.items:[];
}

export async function fetchAndApplyAdminConfig(){
  if(adminConfigFetchInFlight){
    adminConfigRefetchRequested=true;
    return adminConfigFetchInFlight;
  }

  adminConfigFetchInFlight=(async()=>{
    const before=readSmtAdminConfigLkg();
    const prior=readSmtAdminSyncStatus();
    setStatus({
      state:'CONNECTING',
      revision:before?.revision??0,
      fingerprint:before?.fingerprint??'',
      publishedAt:before?.publishedAt,
      receivedAt:prior.receivedAt,
      appliedAt:prior.appliedAt,
      ackAt:prior.ackAt,
      updatedAt:now(),
    });

    try{
      let cursor=before?.publishedAt??readSmtAdminTimeFirstCutover()?.clearedAt;
      let last:SmtAdminConfigApplyResult|null=null;

      if(!cursor){
        return await fetchActiveFallback();
      }

      for(let page=0;page<100;page++){
        const items=await fetchPublishedSince(cursor);
        if(!items.length)break;
        for(const raw of items){
          const envelope=validateMfkAdminConfigEnvelope(raw);
          last=await applyCanonicalEnvelope(envelope);
          cursor=envelope.publishedAt;
        }
        if(items.length<200)break;
      }

      const current=readSmtAdminConfigLkg();
      if(!current){
        const at=now();
        setStatus({
          state:'WAITING_ADMIN_PUBLISH',
          revision:0,
          fingerprint:'',
          updatedAt:at,
        });
      }else if(!last){
        const status=readSmtAdminSyncStatus();
        if(status.state==='CONNECTING'){
          const at=now();
          setStatus({
            state:'SYNCED',
            revision:current.revision,
            fingerprint:current.fingerprint,
            publishedAt:current.publishedAt,
            receivedAt:status.receivedAt,
            appliedAt:status.appliedAt,
            ackAt:status.ackAt,
            updatedAt:at,
          });
        }
      }
      return last;
    }catch(error){
      const lkg=readSmtAdminConfigLkg();
      const at=now();
      setStatus({
        state:lkg?'LOCAL_LKG':'ERROR',
        revision:lkg?.revision??0,
        fingerprint:lkg?.fingerprint??'',
        publishedAt:lkg?.publishedAt,
        receivedAt:prior.receivedAt,
        appliedAt:prior.appliedAt,
        ackAt:prior.ackAt,
        updatedAt:at,
        error:error instanceof Error?error.message:'ADMIN_CONFIG_SYNC_FAILED',
      });
      return null;
    }finally{
      adminConfigFetchInFlight=null;
      if(adminConfigRefetchRequested){
        adminConfigRefetchRequested=false;
        void fetchAndApplyAdminConfig();
      }
    }
  })();

  return adminConfigFetchInFlight;
}

let installed=false;
let socket:WebSocket|null=null;
let reconnectTimer:number|undefined;
let reconnectAttempt=0;

function scheduleReconnect(){
  if(typeof window==='undefined'||!navigator.onLine)return;
  if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);
  const delays=[500,1000,2000,5000,15000];
  const delay=delays[Math.min(reconnectAttempt,delays.length-1)]!;
  reconnectAttempt+=1;
  reconnectTimer=window.setTimeout(()=>connectDoorbell(),delay);
}
function connectDoorbell(){
  if(typeof window==='undefined'||typeof WebSocket==='undefined'||!navigator.onLine)return;
  if(socket&&socket.readyState<=WebSocket.OPEN)return;
  try{
    socket=new WebSocket(smtAdminWebSocketUrl());
    socket.addEventListener('open',()=>{
      reconnectAttempt=0;
      void fetchAndApplyAdminConfig();
    });
    socket.addEventListener('message',event=>{
      try{
        const row=JSON.parse(String(event.data)) as SmtCloudDoorbell&{
          revision?:number;fingerprint?:string;publishedAt?:string;acceptedAt?:string
        };
        if(row.type==='ADMIN_CONFIG_AVAILABLE'){
          const receivedAt=now();
          writeJson(ADMIN_PROPAGATION_DIAG_KEY,{
            revision:row.revision,
            fingerprint:row.fingerprint,
            publishedAt:row.publishedAt,
            acceptedAt:row.acceptedAt,
            doorbellReceivedAt:receivedAt,
          });
          const status=readSmtAdminSyncStatus();
          setStatus({...status,receivedAt,updatedAt:receivedAt});
          // Every formal Admin publish triggers a canonical history catch-up.
          // No R/revision comparison is allowed to veto a publish.
          void fetchAndApplyAdminConfig();
          return;
        }
        for(const listener of cloudDoorbellListeners)listener(row);
      }catch{}
    });
    socket.addEventListener('close',()=>{socket=null;scheduleReconnect();});
    socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
  }catch{scheduleReconnect();}
}

export function installSmtAdminAutoSync(){
  if(installed||typeof window==='undefined')return;
  installed=true;

  const reconcile=()=>{
    if(!navigator.onLine)return;
    clearLegacySmtAdminConfigForTimeFirstCutover();
    void fetchAndApplyAdminConfig();
    connectDoorbell();
  };
  const onOnline=()=>reconcile();
  const onFocus=()=>reconcile();
  const onPageShow=()=>reconcile();
  const onVisibility=()=>{if(document.visibilityState==='visible')reconcile();};
  const onOffline=()=>{
    const lkg=readSmtAdminConfigLkg();
    const at=now();
    setStatus({
      state:lkg?'LOCAL_LKG':'OFFLINE',
      revision:lkg?.revision??0,
      fingerprint:lkg?.fingerprint??'',
      publishedAt:lkg?.publishedAt,
      updatedAt:at,
    });
    try{socket?.close();}catch{}
  };

  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  window.addEventListener('focus',onFocus);
  window.addEventListener('pageshow',onPageShow);
  document.addEventListener('visibilitychange',onVisibility);
  if(navigator.onLine)reconcile();
  else onOffline();
}

export function readAdminSnapshotSection<T=unknown>(key:string):T|undefined{
  const envelope=readSmtAdminConfigLkg();
  return envelope?.snapshot[key] as T|undefined;
}

export async function readOwnerSellabilityCommands(){
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/smt-owner-sellability?storeId=MF01&deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});
  if(!response.ok)throw new Error('OWNER_SELLABILITY_COMMAND_READ_FAILED');
  const body=await response.json() as {commands?:unknown[]};
  return Array.isArray(body.commands)?body.commands:[];
}

export async function ackOwnerSellabilityCommand(operationId:string,state:'CONFIRMED'|'REJECTED',results:readonly unknown[]){
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/smt-owner-sellability?storeId=MF01&deviceId='+encodeURIComponent(deviceId),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operationId,state,results}),
  });
  if(!response.ok)throw new Error('OWNER_SELLABILITY_COMMAND_ACK_FAILED');
}
