import {createMfkAdminConfigEnvelope,validateMfkAdminConfigEnvelope,type MfkAdminConfigAck,type MfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {
  MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
  validateMfkSyncChangeBatch,
  validateMfkSyncCheckpoint,
  validateMfkSyncHead,
  type MfkSyncHead,
} from '../../../contracts/checkpointed-delta-sync-v1.ts';
import {
  applyMfkSyncChangeBatch,
  buildSmtSyncEntities,
  entityMapFromCheckpoint,
  materializeSmtSnapshot,
  projectionHashForEntities,
  type MfkSyncEntityMap,
} from '../../../sync/checkpointed-delta-sync.ts';
import {smtAdminHttpOrigin,smtAdminWebSocketUrl} from './web-acceptance.ts';

export const SMT_ADMIN_CONFIG_LKG_KEY='mfk.admin-sync.active.v1';
export const SMT_ADMIN_CONFIG_STATUS_KEY='mfk.admin-sync.status.v1';
export const SMT_ADMIN_CONFIG_DEVICE_KEY='mfk.admin-sync.device.v1';
export const SMT_ADMIN_SYNC_BUNDLE_POINTER_KEY='mfk.admin-sync.bundle-pointer.v1';
export const SMT_ADMIN_SYNC_BUNDLE_PREFIX='mfk.admin-sync.bundle.v1:';
export const SMT_ADMIN_CONFIG_ENDPOINT=smtAdminHttpOrigin();

export type SmtAdminSyncState='LOCAL_LKG'|'CONNECTING'|'SYNCED'|'OFFLINE'|'ERROR';
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
  readonly appliedSeq?:number;
  readonly headSeq?:number;
  readonly syncProtocol?:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
}
export interface SmtAdminConfigApplyResult{
  readonly disposition:'APPLIED'|'IDEMPOTENT'|'STALE';
  readonly revision:number;
  readonly fingerprint:string;
}

const listeners=new Set<()=>void>();
export interface SmtCloudDoorbell{readonly type:string;readonly [key:string]:unknown}
const ADMIN_PROPAGATION_DIAG_KEY='mfk.v2local.admin-propagation-diag.v1';
const cloudDoorbellListeners=new Set<(event:SmtCloudDoorbell)=>void>();

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

interface SmtAdminSyncBundle{
  readonly schema:'MFK_SMT_ADMIN_SYNC_BUNDLE_V1';
  readonly appliedSeq:number;
  readonly checkpointSeq:number;
  readonly projectionHash:string;
  readonly envelope:MfkAdminConfigEnvelope;
  readonly entities:MfkSyncEntityMap;
  readonly updatedAt:string;
}

function readSmtAdminSyncBundle():SmtAdminSyncBundle|null{
  try{
    const pointer=localStorage.getItem(SMT_ADMIN_SYNC_BUNDLE_POINTER_KEY);
    if(!pointer)return null;
    const raw=localStorage.getItem(pointer);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as SmtAdminSyncBundle;
    if(parsed?.schema!=='MFK_SMT_ADMIN_SYNC_BUNDLE_V1')return null;
    if(!Number.isSafeInteger(Number(parsed.appliedSeq))||Number(parsed.appliedSeq)<0)return null;
    const envelope=validateMfkAdminConfigEnvelope(parsed.envelope);
    const entities=parsed.entities&&typeof parsed.entities==='object'?parsed.entities:null;
    if(!entities)return null;
    return Object.freeze({...parsed,envelope,entities});
  }catch{return null;}
}

function commitSmtAdminSyncBundle(head:MfkSyncHead,entities:MfkSyncEntityMap,appliedSeq:number,checkpointSeq:number){
  const projectionHash=projectionHashForEntities(entities);
  if(appliedSeq===head.headSeq&&projectionHash!==head.projectionHash)throw new Error('SYNC_FINAL_PROJECTION_HASH_MISMATCH');
  const snapshot=materializeSmtSnapshot(entities);
  const envelope=createMfkAdminConfigEnvelope({
    storeId:head.storeId,
    revision:head.canonicalRevision,
    publishedAt:head.canonicalPublishedAt,
    adminFingerprint:head.adminFingerprint,
    snapshot,
  });
  if(envelope.fingerprint!==head.canonicalFingerprint)throw new Error('SYNC_CANONICAL_FINGERPRINT_MISMATCH');

  const bundle:SmtAdminSyncBundle=Object.freeze({
    schema:'MFK_SMT_ADMIN_SYNC_BUNDLE_V1',
    appliedSeq,
    checkpointSeq,
    projectionHash,
    envelope,
    entities,
    updatedAt:now(),
  });
  const bundleKey=SMT_ADMIN_SYNC_BUNDLE_PREFIX+String(appliedSeq).padStart(16,'0')+':'+head.canonicalFingerprint;
  // Write full candidate first. The single pointer write is the local atomic switch.
  localStorage.setItem(bundleKey,JSON.stringify(bundle));
  localStorage.setItem(SMT_ADMIN_SYNC_BUNDLE_POINTER_KEY,bundleKey);
  // Legacy mirror is compatibility only; readers in this module prefer the bundle pointer.
  localStorage.setItem(SMT_ADMIN_CONFIG_LKG_KEY,JSON.stringify(envelope));
  setStatus({
    state:'SYNCED',
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    publishedAt:envelope.publishedAt,
    appliedAt:bundle.updatedAt,
    updatedAt:bundle.updatedAt,
    appliedSeq,
    headSeq:head.headSeq,
    syncProtocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
  });
  return bundle;
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
  const bundle=readSmtAdminSyncBundle();
  if(bundle)return bundle.envelope;
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

export function applyAdminConfigEnvelope(input:unknown):SmtAdminConfigApplyResult{
  const next=validateMfkAdminConfigEnvelope(input);
  const current=readSmtAdminConfigLkg();
  if(current){
    const nextPublishedAt=Date.parse(next.publishedAt);
    const currentPublishedAt=Date.parse(current.publishedAt);
    if(!Number.isFinite(nextPublishedAt)||!Number.isFinite(currentPublishedAt))throw new Error('ADMIN_CONFIG_PUBLISHED_AT_INVALID');
    if(nextPublishedAt<currentPublishedAt){
      return Object.freeze({disposition:'STALE',revision:current.revision,fingerprint:current.fingerprint});
    }
    if(nextPublishedAt===currentPublishedAt){
      if(next.fingerprint!==current.fingerprint)throw new Error('ADMIN_CONFIG_PUBLISHED_AT_CONFLICT');
      const appliedAt=now();
      setStatus({
        state:'SYNCED',
        revision:current.revision,
        fingerprint:current.fingerprint,
        publishedAt:current.publishedAt,
        appliedAt,
        updatedAt:appliedAt,
      });
      return Object.freeze({disposition:'IDEMPOTENT',revision:current.revision,fingerprint:current.fingerprint});
    }
  }
  writeJson(SMT_ADMIN_CONFIG_LKG_KEY,next);
  const appliedAt=now();
  setStatus({
    state:'SYNCED',
    revision:next.revision,
    fingerprint:next.fingerprint,
    publishedAt:next.publishedAt,
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
  if(status.fingerprint===envelope.fingerprint)setStatus({...status,ackAt,updatedAt:ackAt});
  try{
    const diag=readJson<Record<string,unknown>>(ADMIN_PROPAGATION_DIAG_KEY,{});
    writeJson(ADMIN_PROPAGATION_DIAG_KEY,{...diag,ackAt});
  }catch{}
}

async function fetchSmtSyncHead():Promise<MfkSyncHead>{
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/sync/head?storeId=MF01&port=SMT&deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});
  if(!response.ok)throw new Error('SYNC_HEAD_HTTP_'+response.status);
  return validateMfkSyncHead(await response.json());
}

async function fetchSmtSyncCheckpoint(head:MfkSyncHead){
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/sync/checkpoint?storeId=MF01&port=SMT&deviceId='+encodeURIComponent(deviceId)+'&seq='+String(head.checkpointSeq),{cache:'no-store'});
  if(!response.ok)throw new Error('SYNC_CHECKPOINT_HTTP_'+response.status);
  const checkpoint=validateMfkSyncCheckpoint(await response.json());
  if(checkpoint.port!=='SMT'||checkpoint.storeId!==head.storeId||checkpoint.checkpointSeq!==head.checkpointSeq)throw new Error('SYNC_CHECKPOINT_IDENTITY_MISMATCH');
  if(checkpoint.checkpointHash!==head.checkpointHash)throw new Error('SYNC_CHECKPOINT_HASH_MISMATCH');
  return checkpoint;
}

async function fetchSmtSyncChanges(after:number){
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/sync/changes?storeId=MF01&port=SMT&deviceId='+encodeURIComponent(deviceId)+'&after='+String(after),{cache:'no-store'});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(response.status===409&&String(body.code||'').includes('CHECKPOINT'))return{checkpointRequired:true as const};
  if(!response.ok)throw new Error('SYNC_CHANGES_HTTP_'+response.status+':'+String(body.code||''));
  return{checkpointRequired:false as const,batch:validateMfkSyncChangeBatch(body)};
}

async function ackSmtSyncApplied(head:MfkSyncHead,bundle:SmtAdminSyncBundle){
  const deviceId=readSmtDeviceId();
  const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/sync/applied?storeId=MF01&port=SMT&deviceId='+encodeURIComponent(deviceId),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      schema:'MFK_SYNC_APPLIED_ACK_V1',
      protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
      storeId:head.storeId,
      port:'SMT',
      clientId:deviceId,
      appliedSeq:bundle.appliedSeq,
      projectionHash:bundle.projectionHash,
      appliedAt:now(),
      checkpointSeq:bundle.checkpointSeq,
    }),
  });
  if(!response.ok)throw new Error('SYNC_APPLIED_ACK_HTTP_'+response.status);
  const ackAt=now();
  const status=readSmtAdminSyncStatus();
  setStatus({...status,ackAt,updatedAt:ackAt});
}

async function bootstrapSmtSyncFromLegacy(){
  await fetchAndApplyAdminConfig();
  const lkg=readSmtAdminConfigLkg();
  if(!lkg)throw new Error('SYNC_BOOTSTRAP_LKG_UNAVAILABLE');
  // Ensure the legacy device registration/ACK has landed before the protected
  // delta endpoints are used for the first time.
  await ack(lkg,'IDEMPOTENT');
  const head=await fetchSmtSyncHead();
  const entities=buildSmtSyncEntities(lkg.snapshot);
  const projectionHash=projectionHashForEntities(entities);
  if(head.headSeq>0&&head.canonicalFingerprint===lkg.fingerprint&&head.projectionHash===projectionHash){
    const bundle=commitSmtAdminSyncBundle(head,entities,head.headSeq,head.checkpointSeq);
    void ackSmtSyncApplied(head,bundle).catch(()=>{});
    return bundle;
  }
  return null;
}

let deltaSyncInFlight:Promise<SmtAdminSyncBundle|null>|null=null;
let deltaSyncRequested=false;
export async function reconcileSmtCheckpointedSync(){
  if(deltaSyncInFlight){deltaSyncRequested=true;return deltaSyncInFlight;}
  deltaSyncInFlight=(async()=>{
    try{
      let head:MfkSyncHead;
      try{head=await fetchSmtSyncHead();}
      catch(error){
        // Existing installations may not yet have a device ACK or sync head.
        const bootstrapped=await bootstrapSmtSyncFromLegacy();
        if(bootstrapped)return bootstrapped;
        head=await fetchSmtSyncHead();
      }

      let bundle=readSmtAdminSyncBundle();
      let entities:MfkSyncEntityMap;
      let appliedSeq:number;
      let checkpointSeq:number;

      if(bundle&&bundle.envelope.storeId===head.storeId){
        entities=bundle.entities;
        appliedSeq=bundle.appliedSeq;
        checkpointSeq=bundle.checkpointSeq;
      }else if(head.checkpointHash){
        const checkpoint=await fetchSmtSyncCheckpoint(head);
        entities=entityMapFromCheckpoint(checkpoint);
        appliedSeq=checkpoint.checkpointSeq;
        checkpointSeq=checkpoint.checkpointSeq;
      }else{
        const bootstrapped=await bootstrapSmtSyncFromLegacy();
        if(bootstrapped)return bootstrapped;
        throw new Error('SYNC_BOOTSTRAP_CHECKPOINT_UNAVAILABLE');
      }

      for(let guard=0;guard<12;guard++){
        head=await fetchSmtSyncHead();
        if(appliedSeq>head.headSeq||appliedSeq<Math.max(0,head.journalFloorSeq-1)){
          if(!head.checkpointHash)throw new Error('SYNC_CHECKPOINT_REQUIRED_BUT_UNAVAILABLE');
          const checkpoint=await fetchSmtSyncCheckpoint(head);
          entities=entityMapFromCheckpoint(checkpoint);
          appliedSeq=checkpoint.checkpointSeq;
          checkpointSeq=checkpoint.checkpointSeq;
        }

        if(appliedSeq===head.headSeq){
          const committed=commitSmtAdminSyncBundle(head,entities,appliedSeq,checkpointSeq);
          void ackSmtSyncApplied(head,committed).catch(()=>{});
          return committed;
        }

        const next=await fetchSmtSyncChanges(appliedSeq);
        if(next.checkpointRequired){
          if(!head.checkpointHash)throw new Error('SYNC_CHECKPOINT_REQUIRED_BUT_UNAVAILABLE');
          const checkpoint=await fetchSmtSyncCheckpoint(head);
          entities=entityMapFromCheckpoint(checkpoint);
          appliedSeq=checkpoint.checkpointSeq;
          checkpointSeq=checkpoint.checkpointSeq;
          continue;
        }
        if(next.batch.storeId!==head.storeId||next.batch.port!=='SMT')throw new Error('SYNC_CHANGE_BATCH_IDENTITY_MISMATCH');
        ({entities,appliedSeq}=applyMfkSyncChangeBatch(entities,appliedSeq,next.batch));
      }
      throw new Error('SYNC_RECONCILE_GUARD_EXCEEDED');
    }catch(error){
      const lkg=readSmtAdminConfigLkg();
      const status=readSmtAdminSyncStatus();
      setStatus({
        ...status,
        state:lkg?'LOCAL_LKG':'ERROR',
        revision:lkg?.revision??status.revision??0,
        fingerprint:lkg?.fingerprint??status.fingerprint??'',
        publishedAt:lkg?.publishedAt??status.publishedAt,
        updatedAt:now(),
        error:error instanceof Error?error.message:'SYNC_RECONCILE_FAILED',
      });
      return null;
    }finally{
      deltaSyncInFlight=null;
      if(deltaSyncRequested){deltaSyncRequested=false;void reconcileSmtCheckpointedSync();}
    }
  })();
  return deltaSyncInFlight;
}

let adminConfigFetchInFlight:Promise<SmtAdminConfigApplyResult|null>|null=null;
let adminConfigRefetchRequested=false;
export async function fetchAndApplyAdminConfig(){
  if(adminConfigFetchInFlight){adminConfigRefetchRequested=true;return adminConfigFetchInFlight;}
  adminConfigFetchInFlight=(async()=>{
  const current=readSmtAdminConfigLkg();
  setStatus({
    state:'CONNECTING',
    revision:current?.revision??0,
    fingerprint:current?.fingerprint??'',
    publishedAt:current?.publishedAt,
    updatedAt:now(),
  });
  try{
    const response=await fetch(SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/active?storeId=MF01',{cache:'no-store'});
    if(response.status===404){
      setStatus({state:current?'LOCAL_LKG':'OFFLINE',revision:current?.revision??0,fingerprint:current?.fingerprint??'',publishedAt:current?.publishedAt,updatedAt:now()});
      return null;
    }
    if(!response.ok)throw new Error('ADMIN_CONFIG_FETCH_HTTP_'+response.status);
    const envelope=validateMfkAdminConfigEnvelope(await response.json());
    const applied=applyAdminConfigEnvelope(envelope);
    if(applied.disposition!=='STALE'){
      try{
        const diag=JSON.parse(localStorage.getItem(ADMIN_PROPAGATION_DIAG_KEY)||'{}');
        localStorage.setItem(ADMIN_PROPAGATION_DIAG_KEY,JSON.stringify({...diag,revision:envelope.revision,fingerprint:envelope.fingerprint,publishedAt:envelope.publishedAt,appliedAt:now()}));
      }catch{}
      void ack(envelope,applied.disposition).catch(()=>{});
    }
    return applied;
  }catch(error){
    const lkg=readSmtAdminConfigLkg();
    setStatus({
      state:lkg?'LOCAL_LKG':'ERROR',
      revision:lkg?.revision??0,
      fingerprint:lkg?.fingerprint??'',
      publishedAt:lkg?.publishedAt,
      updatedAt:now(),
      error:error instanceof Error?error.message:'ADMIN_CONFIG_SYNC_FAILED',
    });
    return null;
  }finally{
    adminConfigFetchInFlight=null;
    if(adminConfigRefetchRequested){adminConfigRefetchRequested=false;void fetchAndApplyAdminConfig();}
  }
  })();
  return adminConfigFetchInFlight;
}

let installed=false;
let socket:WebSocket|null=null;
let reconnectTimer:number|undefined;
let reconnectAttempt=0;

export function isSmtCloudDoorbellConnected(){
  return typeof WebSocket!=='undefined'&&socket?.readyState===WebSocket.OPEN;
}

export function isSmtCloudDoorbellConnected(){
  return typeof WebSocket!=='undefined'&&socket?.readyState===WebSocket.OPEN;
}

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
      void reconcileSmtCheckpointedSync();
    });
    socket.addEventListener('message',event=>{
      try{
        const row=JSON.parse(String(event.data)) as SmtCloudDoorbell&{revision?:number;fingerprint?:string};
        if(row.type==='PORT_HEAD_AVAILABLE'&&row.port==='SMT'){
          const receivedAt=now();
          const status=readSmtAdminSyncStatus();
          setStatus({...status,receivedAt,headSeq:Number(row.headSeq)||status.headSeq,updatedAt:receivedAt});
          void reconcileSmtCheckpointedSync();
          return;
        }
        if(row.type==='ADMIN_CONFIG_AVAILABLE'){
          const receivedAt=now();
          try{
            localStorage.setItem(ADMIN_PROPAGATION_DIAG_KEY,JSON.stringify({
              revision:row.revision,
              fingerprint:row.fingerprint,
              publishedAt:row.publishedAt,
              acceptedAt:row.acceptedAt,
              doorbellReceivedAt:receivedAt,
            }));
          }catch{}
          const status=readSmtAdminSyncStatus();
          setStatus({...status,receivedAt,updatedAt:receivedAt});
          // Legacy doorbell remains during migration; the new client reconciles the
          // checkpointed delta head instead of pulling the full canonical snapshot.
          void reconcileSmtCheckpointedSync();
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
  const reconcile=()=>{if(!navigator.onLine)return;void reconcileSmtCheckpointedSync();connectDoorbell();};
  const onOnline=()=>reconcile();
  const onFocus=()=>reconcile();
  const onPageShow=()=>reconcile();
  const onVisibility=()=>{if(document.visibilityState==='visible')reconcile();};
  const onOffline=()=>{
    const lkg=readSmtAdminConfigLkg();
    setStatus({state:lkg?'LOCAL_LKG':'OFFLINE',revision:lkg?.revision??0,fingerprint:lkg?.fingerprint??'',publishedAt:lkg?.publishedAt,updatedAt:now()});
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
