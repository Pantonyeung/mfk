import {validateMfkAdminConfigEnvelope,type MfkAdminConfigAck,type MfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';

export const SMT_ADMIN_CONFIG_LKG_KEY='mfk.admin-sync.active.v1';
export const SMT_ADMIN_CONFIG_STATUS_KEY='mfk.admin-sync.status.v1';
export const SMT_ADMIN_CONFIG_DEVICE_KEY='mfk.admin-sync.device.v1';
export const SMT_ADMIN_CONFIG_ENDPOINT='https://admin.morefunos.com';

export type SmtAdminSyncState='LOCAL_LKG'|'CONNECTING'|'SYNCED'|'OFFLINE'|'ERROR';
export interface SmtAdminSyncStatus{
  readonly state:SmtAdminSyncState;
  readonly revision:number;
  readonly fingerprint:string;
  readonly updatedAt:string;
  readonly error?:string;
}
export interface SmtAdminConfigApplyResult{
  readonly disposition:'APPLIED'|'IDEMPOTENT'|'STALE';
  readonly revision:number;
  readonly fingerprint:string;
}

const listeners=new Set<()=>void>();

function emit(){for(const listener of listeners)listener();}
function now(){return new Date().toISOString();}
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
export function readSmtAdminSyncStatus():SmtAdminSyncStatus{
  const active=readSmtAdminConfigLkg();
  return readJson<SmtAdminSyncStatus>(SMT_ADMIN_CONFIG_STATUS_KEY,{
    state:active?'LOCAL_LKG':'OFFLINE',
    revision:active?.revision??0,
    fingerprint:active?.fingerprint??'',
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

export function applyAdminConfigEnvelope(input:unknown):SmtAdminConfigApplyResult{
  const next=validateMfkAdminConfigEnvelope(input);
  const current=readSmtAdminConfigLkg();
  if(current){
    if(next.revision<current.revision){
      return Object.freeze({disposition:'STALE',revision:current.revision,fingerprint:current.fingerprint});
    }
    if(next.revision===current.revision){
      if(next.fingerprint!==current.fingerprint)throw new Error('ADMIN_CONFIG_REVISION_CONFLICT');
      setStatus({state:'SYNCED',revision:current.revision,fingerprint:current.fingerprint,updatedAt:now()});
      return Object.freeze({disposition:'IDEMPOTENT',revision:current.revision,fingerprint:current.fingerprint});
    }
  }
  // One localStorage replacement is the canonical atomic LKG switch.
  writeJson(SMT_ADMIN_CONFIG_LKG_KEY,next);
  setStatus({state:'SYNCED',revision:next.revision,fingerprint:next.fingerprint,updatedAt:now()});
  return Object.freeze({disposition:'APPLIED',revision:next.revision,fingerprint:next.fingerprint});
}

async function ack(envelope:MfkAdminConfigEnvelope,disposition:'APPLIED'|'IDEMPOTENT'){
  const body:MfkAdminConfigAck={
    schema:'MFK_ADMIN_CONFIG_ACK_V1',
    storeId:envelope.storeId,
    deviceId:readSmtDeviceId(),
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    appliedAt:now(),
    disposition,
  };
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/ack?storeId='+encodeURIComponent(envelope.storeId),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!response.ok)throw new Error('ADMIN_CONFIG_ACK_HTTP_'+response.status);
}

export async function fetchAndApplyAdminConfig(){
  const current=readSmtAdminConfigLkg();
  setStatus({
    state:'CONNECTING',
    revision:current?.revision??0,
    fingerprint:current?.fingerprint??'',
    updatedAt:now(),
  });
  try{
    const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/active?storeId=MF01',{cache:'no-store'});
    if(response.status===404){
      setStatus({state:current?'LOCAL_LKG':'OFFLINE',revision:current?.revision??0,fingerprint:current?.fingerprint??'',updatedAt:now()});
      return null;
    }
    if(!response.ok)throw new Error('ADMIN_CONFIG_FETCH_HTTP_'+response.status);
    const envelope=validateMfkAdminConfigEnvelope(await response.json());
    const applied=applyAdminConfigEnvelope(envelope);
    if(applied.disposition!=='STALE')await ack(envelope,applied.disposition);
    return applied;
  }catch(error){
    const lkg=readSmtAdminConfigLkg();
    setStatus({
      state:lkg?'LOCAL_LKG':'ERROR',
      revision:lkg?.revision??0,
      fingerprint:lkg?.fingerprint??'',
      updatedAt:now(),
      error:error instanceof Error?error.message:'ADMIN_CONFIG_SYNC_FAILED',
    });
    return null;
  }
}

let installed=false;
let socket:WebSocket|null=null;
let reconnectTimer:number|undefined;
let reconnectAttempt=0;

function scheduleReconnect(){
  if(typeof window==='undefined'||!navigator.onLine)return;
  if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);
  const delays=[2000,5000,15000,30000,60000];
  const delay=delays[Math.min(reconnectAttempt,delays.length-1)]!;
  reconnectAttempt+=1;
  reconnectTimer=window.setTimeout(()=>connectDoorbell(),delay);
}
function connectDoorbell(){
  if(typeof window==='undefined'||typeof WebSocket==='undefined'||!navigator.onLine)return;
  if(socket&&socket.readyState<=WebSocket.OPEN)return;
  try{
    socket=new WebSocket('wss://admin.morefunos.com/api/admin-sync/events?storeId=MF01');
    socket.addEventListener('open',()=>{
      reconnectAttempt=0;
      void fetchAndApplyAdminConfig();
    });
    socket.addEventListener('message',event=>{
      try{
        const row=JSON.parse(String(event.data)) as {type?:string;revision?:number;fingerprint?:string};
        if(row.type!=='ADMIN_CONFIG_AVAILABLE')return;
        const current=readSmtAdminConfigLkg();
        if(!current||Number(row.revision)>current.revision||String(row.fingerprint)!==current.fingerprint){
          void fetchAndApplyAdminConfig();
        }
      }catch{}
    });
    socket.addEventListener('close',()=>{socket=null;scheduleReconnect();});
    socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
  }catch{scheduleReconnect();}
}

export function installSmtAdminAutoSync(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const onOnline=()=>{void fetchAndApplyAdminConfig();connectDoorbell();};
  const onOffline=()=>{
    const lkg=readSmtAdminConfigLkg();
    setStatus({state:lkg?'LOCAL_LKG':'OFFLINE',revision:lkg?.revision??0,fingerprint:lkg?.fingerprint??'',updatedAt:now()});
    try{socket?.close();}catch{}
  };
  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  if(navigator.onLine){
    void fetchAndApplyAdminConfig();
    connectDoorbell();
  }else onOffline();
}

export function readAdminSnapshotSection<T=unknown>(key:string):T|undefined{
  const envelope=readSmtAdminConfigLkg();
  return envelope?.snapshot[key] as T|undefined;
}
