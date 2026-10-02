import {
  validateMfkSyncChangeBatch,
  validateMfkSyncCheckpoint,
  validateMfkSyncHead,
  type MfkSyncHead,
} from '../../contracts/checkpointed-delta-sync-v1';
import {
  applyMfkSyncChangeBatch,
  entityMapFromCheckpoint,
  materializeSmmConfigSnapshot,
  projectionHashForEntities,
  type MfkSyncEntityMap,
} from '../../sync/checkpointed-delta-sync';
import type {SmmReadModelSnapshot} from './product-types';
import {readSmmStaffSession} from './pwa-staff';

const ADMIN_SYNC_ENDPOINT='https://admin.morefunos.com';
const STORE_ID='MF01';
const KEY='mfk:smm:config-sync-bundle:v1';

interface Bundle{
  readonly schema:'MFK_SMM_CONFIG_SYNC_BUNDLE_V1';
  readonly appliedSeq:number;
  readonly checkpointSeq:number;
  readonly projectionHash:string;
  readonly entities:MfkSyncEntityMap;
  readonly head:MfkSyncHead;
  readonly updatedAt:string;
}

function readBundle():Bundle|null{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Bundle;
    if(parsed?.schema!=='MFK_SMM_CONFIG_SYNC_BUNDLE_V1')return null;
    const head=validateMfkSyncHead(parsed.head);
    if(head.port!=='SMM'||!parsed.entities||typeof parsed.entities!=='object')return null;
    return Object.freeze({...parsed,head,entities:parsed.entities});
  }catch{return null;}
}
function writeBundle(head:MfkSyncHead,entities:MfkSyncEntityMap,appliedSeq:number,checkpointSeq:number){
  const projectionHash=projectionHashForEntities(entities);
  if(appliedSeq===head.headSeq&&projectionHash!==head.projectionHash)throw new Error('SMM_SYNC_PROJECTION_HASH_MISMATCH');
  const bundle:Bundle=Object.freeze({
    schema:'MFK_SMM_CONFIG_SYNC_BUNDLE_V1',
    appliedSeq,checkpointSeq,projectionHash,entities,head,updatedAt:new Date().toISOString(),
  });
  localStorage.setItem(KEY,JSON.stringify(bundle));
  return bundle;
}
async function get(path:string){
  const session=readSmmStaffSession();
  if(!session)throw new Error('SMM_SYNC_SESSION_REQUIRED');
  const response=await fetch(ADMIN_SYNC_ENDPOINT+path,{
    cache:'no-store',
    credentials:'omit',
    headers:{accept:'application/json','x-mfk-smm-session':session.sessionToken},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  return{response,body};
}
async function head(){
  const {response,body}=await get('/api/admin-sync/sync/head?storeId='+STORE_ID+'&port=SMM');
  if(!response.ok)throw new Error(String(body.code||'SMM_SYNC_HEAD_FAILED'));
  const value=validateMfkSyncHead(body);
  if(value.port!=='SMM'||value.storeId!==STORE_ID)throw new Error('SMM_SYNC_HEAD_IDENTITY_MISMATCH');
  return value;
}
async function checkpoint(current:MfkSyncHead){
  const {response,body}=await get('/api/admin-sync/sync/checkpoint?storeId='+STORE_ID+'&port=SMM&seq='+String(current.checkpointSeq));
  if(!response.ok)throw new Error(String(body.code||'SMM_SYNC_CHECKPOINT_FAILED'));
  const value=validateMfkSyncCheckpoint(body);
  if(value.port!=='SMM'||value.storeId!==STORE_ID||value.checkpointSeq!==current.checkpointSeq)throw new Error('SMM_SYNC_CHECKPOINT_IDENTITY_MISMATCH');
  if(value.checkpointHash!==current.checkpointHash)throw new Error('SMM_SYNC_CHECKPOINT_HASH_MISMATCH');
  return value;
}
async function changes(after:number){
  const {response,body}=await get('/api/admin-sync/sync/changes?storeId='+STORE_ID+'&port=SMM&after='+String(after));
  if(response.status===409&&String(body.code||'').includes('CHECKPOINT'))return{checkpointRequired:true as const};
  if(!response.ok)throw new Error(String(body.code||'SMM_SYNC_CHANGES_FAILED'));
  return{checkpointRequired:false as const,batch:validateMfkSyncChangeBatch(body)};
}

async function ackApplied(current:MfkSyncHead,bundle:Bundle){
  const session=readSmmStaffSession();
  if(!session)return;
  const response=await fetch(ADMIN_SYNC_ENDPOINT+'/api/admin-sync/sync/applied?storeId='+STORE_ID+'&port=SMM',{
    method:'POST',
    credentials:'omit',
    cache:'no-store',
    headers:{'content-type':'application/json','x-mfk-smm-session':session.sessionToken},
    body:JSON.stringify({
      schema:'MFK_SYNC_APPLIED_ACK_V1',
      protocol:'MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1',
      storeId:STORE_ID,
      port:'SMM',
      clientId:'SMM:'+session.staffId,
      appliedSeq:bundle.appliedSeq,
      projectionHash:bundle.projectionHash,
      appliedAt:new Date().toISOString(),
      checkpointSeq:bundle.checkpointSeq,
    }),
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    throw new Error(String(body.code||'SMM_SYNC_APPLIED_ACK_FAILED'));
  }
}

export async function reconcileSmmConfig():Promise<Partial<SmmReadModelSnapshot>>{
  let current=await head();
  let bundle=readBundle();
  let entities:MfkSyncEntityMap;
  let appliedSeq:number;
  let checkpointSeq:number;

  if(bundle&&bundle.head.storeId===current.storeId){
    entities=bundle.entities;appliedSeq=bundle.appliedSeq;checkpointSeq=bundle.checkpointSeq;
  }else if(current.checkpointHash){
    const base=await checkpoint(current);
    entities=entityMapFromCheckpoint(base);appliedSeq=base.checkpointSeq;checkpointSeq=base.checkpointSeq;
  }else throw new Error('SMM_SYNC_BOOTSTRAP_CHECKPOINT_UNAVAILABLE');

  for(let guard=0;guard<12;guard++){
    current=await head();
    if(appliedSeq>current.headSeq||appliedSeq<Math.max(0,current.journalFloorSeq-1)){
      if(!current.checkpointHash)throw new Error('SMM_SYNC_CHECKPOINT_REQUIRED');
      const base=await checkpoint(current);
      entities=entityMapFromCheckpoint(base);appliedSeq=base.checkpointSeq;checkpointSeq=base.checkpointSeq;
    }
    if(appliedSeq===current.headSeq){
      bundle=writeBundle(current,entities,appliedSeq,checkpointSeq);
      void ackApplied(current,bundle).catch(()=>{});
      const config=materializeSmmConfigSnapshot(bundle.entities) as Partial<SmmReadModelSnapshot>;
      const menu=config.menu?Object.freeze({...config.menu,revision:String(current.canonicalRevision),observedAt:current.observedAt}):undefined;
      return Object.freeze({...config,...(menu?{menu}:{}),observedAt:current.observedAt});
    }
    const next=await changes(appliedSeq);
    if(next.checkpointRequired){
      if(!current.checkpointHash)throw new Error('SMM_SYNC_CHECKPOINT_REQUIRED');
      const base=await checkpoint(current);
      entities=entityMapFromCheckpoint(base);appliedSeq=base.checkpointSeq;checkpointSeq=base.checkpointSeq;
      continue;
    }
    if(next.batch.port!=='SMM'||next.batch.storeId!==STORE_ID)throw new Error('SMM_SYNC_CHANGE_IDENTITY_MISMATCH');
    ({entities,appliedSeq}=applyMfkSyncChangeBatch(entities,appliedSeq,next.batch));
  }
  throw new Error('SMM_SYNC_RECONCILE_GUARD_EXCEEDED');
}

export function subscribeSmmConfigChanges(listener:(headSeq:number)=>void){
  let stopped=false;
  let socket:WebSocket|null=null;
  let timer:number|undefined;
  let attempt=0;
  const connect=()=>{
    if(stopped||navigator.onLine===false)return;
    try{
      const session=readSmmStaffSession();
      if(!session){timer=window.setTimeout(connect,2000);return;}
      socket=new WebSocket(
        'wss://admin.morefunos.com/api/admin-sync/sync/events?storeId='+STORE_ID+'&port=SMM',
        ['mfk-smm-sync-v1','mfk-smm-session.'+session.sessionToken],
      );
      socket.addEventListener('open',()=>{attempt=0;});
      socket.addEventListener('message',event=>{
        try{
          const row=JSON.parse(String(event.data)) as Record<string,unknown>;
          if(row.type==='PORT_HEAD_AVAILABLE'&&row.port==='SMM')listener(Number(row.headSeq)||0);
        }catch{}
      });
      socket.addEventListener('close',()=>{
        socket=null;
        if(stopped)return;
        const delays=[500,1000,2000,5000,15000,30000];
        timer=window.setTimeout(connect,delays[Math.min(attempt++,delays.length-1)]!);
      });
      socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
    }catch{
      if(!stopped)timer=window.setTimeout(connect,2000);
    }
  };
  connect();
  return()=>{
    stopped=true;
    if(timer!==undefined)window.clearTimeout(timer);
    try{socket?.close();}catch{}
  };
}
