export type MfpSyncState='UNINITIALIZED'|'LOCAL_LKG'|'CONNECTING'|'READY'|'BEHIND'|'RECOVERING'|'OFFLINE'|'ERROR';
export type MfpSyncConnection='DISCONNECTED'|'CONNECTED'|'OFFLINE';
export const MFP_SYNC_PROTOCOL='MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1' as const;

export interface MfpSyncRequestContext{
  readonly storeId:string;
  readonly clientId:string;
  readonly deviceId:string;
  readonly staffSessionRef?:string;
}

export interface MfpSyncHead{
  readonly schema:'MFK_SYNC_HEAD_V1';
  readonly protocol:typeof MFP_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:'SMT';
  readonly schemaVersion:1;
  readonly headSeq:number;
  readonly journalFloorSeq:number;
  readonly checkpointSeq:number;
  readonly checkpointHash:string;
  readonly projectionHash:string;
  readonly observedAt:string;
}

export interface MfpSyncDoorbell{
  readonly type:string;
  readonly port:'SMT';
  readonly advertisedHeadSeq?:number;
  readonly observedAt:string;
}

export interface MfpSyncEntity{
  readonly entityType:string;
  readonly entityId:string;
  readonly entityRevision:number;
  readonly payload:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
}

export type MfpSyncEntities=Readonly<Record<string,MfpSyncEntity>>;

export interface MfpSyncChange{
  readonly schema:'MFK_PORT_CHANGE_V1';
  readonly protocol:typeof MFP_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:'SMT';
  readonly schemaVersion:1;
  readonly portSeq:number;
  readonly sourceCommitSeq:number;
  readonly commitId:string;
  readonly entityType:string;
  readonly entityId:string;
  readonly entityRevision:number;
  readonly op:'UPSERT'|'DELETE';
  readonly payload?:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
  readonly createdAt:string;
}

export interface MfpSyncChangeBatch{
  readonly schema:'MFK_SYNC_CHANGE_BATCH_V1';
  readonly protocol:typeof MFP_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:'SMT';
  readonly fromExclusive:number;
  readonly toInclusive:number;
  readonly headSeq:number;
  readonly journalFloorSeq:number;
  readonly changes:readonly MfpSyncChange[];
  readonly observedAt:string;
}

export interface MfpSyncCheckpoint{
  readonly schema:'MFK_SYNC_CHECKPOINT_V1';
  readonly protocol:typeof MFP_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:'SMT';
  readonly schemaVersion:1;
  readonly checkpointSeq:number;
  readonly sourceCommitSeq:number;
  readonly projectionHash:string;
  readonly checkpointHash:string;
  readonly entities:readonly MfpSyncEntity[];
  readonly createdAt:string;
}

export type MfpSyncChangesResult=
  |Readonly<{kind:'DELTA';batch:MfpSyncChangeBatch}>
  |Readonly<{kind:'CHECKPOINT_REQUIRED'}>;

export interface MfpSyncAppliedAck{
  readonly schema:'MFK_SYNC_APPLIED_ACK_V1';
  readonly protocol:typeof MFP_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:'SMT';
  readonly clientId:string;
  readonly appliedSeq:number;
  readonly projectionHash:string;
  readonly appliedAt:string;
  readonly checkpointSeq:number;
}

export interface MfpSyncActiveProjection{
  readonly storeId:string;
  readonly port:'SMT';
  readonly schemaVersion:1;
  readonly appliedSeq:number;
  readonly checkpointSeq:number;
  readonly projectionHash:string;
  readonly entities:MfpSyncEntities;
  readonly appliedAt:string;
}

export interface MfpSyncProjectionStore{
  readActive():Promise<MfpSyncActiveProjection|null>;
  commitAtomically(candidate:MfpSyncActiveProjection):Promise<void>;
}

export interface MfpSyncTransport{
  readHead(context:MfpSyncRequestContext):Promise<MfpSyncHead>;
  readChanges(afterSeq:number,context:MfpSyncRequestContext):Promise<MfpSyncChangesResult>;
  readCheckpoint(checkpointSeq:number,context:MfpSyncRequestContext):Promise<MfpSyncCheckpoint>;
  ackApplied(ack:MfpSyncAppliedAck,context:MfpSyncRequestContext):Promise<void>;
  connectDoorbell(listener:Readonly<{
    onOpen():void;
    onDoorbell(doorbell:MfpSyncDoorbell):void;
    onOffline():void;
  }>):()=>void;
}

export interface MfpSyncSnapshot{
  readonly connection:MfpSyncConnection;
  readonly state:MfpSyncState;
  readonly headSeq:number|null;
  readonly appliedSeq:number|null;
  readonly lkgAvailable:boolean;
  readonly lastDoorbellAt:string|null;
  readonly lastHeadReadAt:string|null;
  readonly lastAppliedAt:string|null;
  readonly lastAckAt:string|null;
  readonly lastError:string|null;
}

export interface MfpSyncCoordinator{
  getSnapshot():MfpSyncSnapshot;
  subscribe(listener:()=>void):()=>void;
  restore():Promise<void>;
  startup():Promise<void>;
  webSocketOpened():Promise<void>;
  doorbellReceived(doorbell:MfpSyncDoorbell):Promise<void>;
  networkOnline():Promise<void>;
  resumed():Promise<void>;
  manualCatchUp():Promise<void>;
  networkOffline():void;
  connectDoorbell():()=>void;
}

function text(value:unknown,code:string,max=240){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw new Error(code);
  return value;
}

function nonNegative(value:unknown,code:string){
  if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(code);
  return Number(value);
}

function positive(value:unknown,code:string){
  if(!Number.isSafeInteger(value)||Number(value)<1)throw new Error(code);
  return Number(value);
}

function instant(value:unknown,code:string){
  text(value,code,64);
  if(!Number.isFinite(Date.parse(String(value))))throw new Error(code);
  return String(value);
}

function canonical(value:unknown,seen=new Set<object>()):string{
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('MFP_SYNC_VALUE_INVALID');
    return JSON.stringify(value);
  }
  if(typeof value!=='object')throw new Error('MFP_SYNC_VALUE_INVALID');
  if(seen.has(value))throw new Error('MFP_SYNC_VALUE_INVALID');
  seen.add(value);
  try{
    if(Array.isArray(value))return '['+value.map(item=>canonical(item,seen)).join(',')+']';
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)throw new Error('MFP_SYNC_VALUE_INVALID');
    const row=value as Record<string,unknown>;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+canonical(row[key],seen)).join(',')+'}';
  }finally{seen.delete(value);}
}

function fnv1a(value:string){
  let hash=0x811c9dc5;
  for(let index=0;index<value.length;index++){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}

export function fingerprintMfpSyncValue(value:unknown){return 'fnv1a32:'+fnv1a(canonical(value));}

function entityKey(entityType:string,entityId:string){return entityType+':'+entityId;}

function validateEntity(value:MfpSyncEntity):MfpSyncEntity{
  text(value.entityType,'MFP_SYNC_ENTITY_TYPE_INVALID',120);
  text(value.entityId,'MFP_SYNC_ENTITY_ID_INVALID');
  positive(value.entityRevision,'MFP_SYNC_ENTITY_REVISION_INVALID');
  if(!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload))throw new Error('MFP_SYNC_ENTITY_PAYLOAD_INVALID');
  if(fingerprintMfpSyncValue(value.payload)!==value.payloadHash)throw new Error('MFP_SYNC_ENTITY_PAYLOAD_HASH_MISMATCH');
  return Object.freeze({...value,payload:Object.freeze({...value.payload})});
}

export function projectionHashForMfpSyncEntities(current:MfpSyncEntities){
  return fingerprintMfpSyncValue(Object.keys(current).sort().map(key=>({
    key,payloadHash:fingerprintMfpSyncValue(current[key]!.payload),
  })));
}

function validateActive(value:MfpSyncActiveProjection){
  if(value.port!=='SMT'||value.schemaVersion!==1)throw new Error('MFP_SYNC_LKG_SCHEMA_INVALID');
  text(value.storeId,'MFP_SYNC_LKG_STORE_ID_INVALID',64);
  nonNegative(value.appliedSeq,'MFP_SYNC_LKG_APPLIED_SEQ_INVALID');
  nonNegative(value.checkpointSeq,'MFP_SYNC_LKG_CHECKPOINT_SEQ_INVALID');
  if(value.checkpointSeq>value.appliedSeq)throw new Error('MFP_SYNC_LKG_CHECKPOINT_AHEAD');
  const rows=value.entities;
  for(const [key,raw] of Object.entries(rows)){
    const entity=validateEntity(raw);
    if(key!==entityKey(entity.entityType,entity.entityId))throw new Error('MFP_SYNC_LKG_ENTITY_KEY_INVALID');
  }
  if(projectionHashForMfpSyncEntities(rows)!==value.projectionHash)throw new Error('MFP_SYNC_LKG_PROJECTION_HASH_MISMATCH');
  instant(value.appliedAt,'MFP_SYNC_LKG_APPLIED_AT_INVALID');
  return value;
}

function validateHead(value:MfpSyncHead,context:MfpSyncRequestContext){
  if(value.schema!=='MFK_SYNC_HEAD_V1'||value.protocol!==MFP_SYNC_PROTOCOL)throw new Error('MFP_SYNC_HEAD_SCHEMA_INVALID');
  if(value.storeId!==context.storeId||value.port!=='SMT')throw new Error('MFP_SYNC_HEAD_IDENTITY_INVALID');
  if(value.schemaVersion!==1)throw new Error('MFP_SYNC_HEAD_SCHEMA_INVALID');
  const headSeq=nonNegative(value.headSeq,'MFP_SYNC_HEAD_SEQ_INVALID');
  const journalFloorSeq=nonNegative(value.journalFloorSeq,'MFP_SYNC_HEAD_JOURNAL_FLOOR_INVALID');
  const checkpointSeq=nonNegative(value.checkpointSeq,'MFP_SYNC_HEAD_CHECKPOINT_SEQ_INVALID');
  if(journalFloorSeq>headSeq+1)throw new Error('MFP_SYNC_HEAD_JOURNAL_FLOOR_AHEAD');
  if(checkpointSeq>headSeq)throw new Error('MFP_SYNC_HEAD_CHECKPOINT_AHEAD');
  if(checkpointSeq>0)text(value.checkpointHash,'MFP_SYNC_HEAD_CHECKPOINT_HASH_INVALID',180);
  text(value.projectionHash,'MFP_SYNC_HEAD_PROJECTION_HASH_INVALID',180);
  instant(value.observedAt,'MFP_SYNC_HEAD_OBSERVED_AT_INVALID');
  return value;
}

function validateChange(change:MfpSyncChange,batch:MfpSyncChangeBatch,expectedSeq:number){
  if(change.schema!=='MFK_PORT_CHANGE_V1'||change.protocol!==MFP_SYNC_PROTOCOL)throw new Error('MFP_SYNC_CHANGE_SCHEMA_INVALID');
  if(change.storeId!==batch.storeId||change.port!=='SMT'||change.schemaVersion!==1||change.portSeq!==expectedSeq){
    throw new Error('MFP_SYNC_CHANGE_BATCH_NON_CONTIGUOUS');
  }
  positive(change.sourceCommitSeq,'MFP_SYNC_CHANGE_SOURCE_COMMIT_INVALID');
  text(change.commitId,'MFP_SYNC_CHANGE_COMMIT_ID_INVALID',180);
  text(change.entityType,'MFP_SYNC_CHANGE_ENTITY_TYPE_INVALID',120);
  text(change.entityId,'MFP_SYNC_CHANGE_ENTITY_ID_INVALID');
  positive(change.entityRevision,'MFP_SYNC_CHANGE_ENTITY_REVISION_INVALID');
  instant(change.createdAt,'MFP_SYNC_CHANGE_CREATED_AT_INVALID');
  const expectedHash=change.op==='UPSERT'
    ?fingerprintMfpSyncValue(change.payload)
    :fingerprintMfpSyncValue({entityType:change.entityType,entityId:change.entityId,op:'DELETE'});
  if(change.op==='UPSERT'&&(!change.payload||typeof change.payload!=='object'||Array.isArray(change.payload))){
    throw new Error('MFP_SYNC_CHANGE_PAYLOAD_REQUIRED');
  }
  if(change.op!=='UPSERT'&&change.op!=='DELETE')throw new Error('MFP_SYNC_CHANGE_OP_INVALID');
  if(change.payloadHash!==expectedHash)throw new Error('MFP_SYNC_CHANGE_PAYLOAD_HASH_MISMATCH');
}

export function applyMfpSyncChangeBatch(
  current:MfpSyncEntities,
  appliedSeq:number,
  value:MfpSyncChangeBatch,
):Readonly<{entities:MfpSyncEntities;appliedSeq:number}>{
  if(value.schema!=='MFK_SYNC_CHANGE_BATCH_V1'||value.protocol!==MFP_SYNC_PROTOCOL)throw new Error('MFP_SYNC_CHANGE_BATCH_SCHEMA_INVALID');
  if(value.port!=='SMT')throw new Error('MFP_SYNC_CHANGE_BATCH_IDENTITY_INVALID');
  const fromExclusive=nonNegative(value.fromExclusive,'MFP_SYNC_CHANGE_BATCH_FROM_INVALID');
  const toInclusive=nonNegative(value.toInclusive,'MFP_SYNC_CHANGE_BATCH_TO_INVALID');
  const headSeq=nonNegative(value.headSeq,'MFP_SYNC_CHANGE_BATCH_HEAD_INVALID');
  nonNegative(value.journalFloorSeq,'MFP_SYNC_CHANGE_BATCH_FLOOR_INVALID');
  instant(value.observedAt,'MFP_SYNC_CHANGE_BATCH_OBSERVED_AT_INVALID');
  if(toInclusive<=appliedSeq)return Object.freeze({entities:current,appliedSeq});
  if(fromExclusive!==appliedSeq)throw new Error('MFP_SYNC_CHANGE_BATCH_FROM_MISMATCH');
  if(toInclusive>headSeq)throw new Error('MFP_SYNC_CHANGE_BATCH_TO_AHEAD_OF_HEAD');
  let expected=appliedSeq+1;
  const out:Record<string,MfpSyncEntity>={...current};
  for(const item of value.changes){
    validateChange(item,value,expected++);
    const key=entityKey(item.entityType,item.entityId);
    if(item.op==='DELETE'){delete out[key];continue;}
    const next=validateEntity({
      entityType:item.entityType,entityId:item.entityId,entityRevision:item.entityRevision,
      payload:item.payload!,payloadHash:item.payloadHash,
    });
    const existing=out[key];
    if(existing&&existing.entityRevision>next.entityRevision)continue;
    if(existing&&existing.entityRevision===next.entityRevision){
      if(existing.payloadHash!==next.payloadHash)throw new Error('MFP_SYNC_ENTITY_REVISION_CONFLICT');
      continue;
    }
    out[key]=next;
  }
  if(value.changes.length&&value.changes.at(-1)!.portSeq!==toInclusive)throw new Error('MFP_SYNC_CHANGE_BATCH_TO_MISMATCH');
  if(!value.changes.length&&toInclusive!==fromExclusive)throw new Error('MFP_SYNC_CHANGE_BATCH_EMPTY_RANGE_INVALID');
  return Object.freeze({entities:Object.freeze(out),appliedSeq:toInclusive});
}

function entitiesFromCheckpoint(value:MfpSyncCheckpoint,head:MfpSyncHead):MfpSyncEntities{
  if(value.schema!=='MFK_SYNC_CHECKPOINT_V1'||value.protocol!==MFP_SYNC_PROTOCOL)throw new Error('MFP_SYNC_CHECKPOINT_SCHEMA_INVALID');
  if(value.storeId!==head.storeId||value.port!=='SMT'||value.schemaVersion!==1||value.checkpointSeq!==head.checkpointSeq){
    throw new Error('MFP_SYNC_CHECKPOINT_IDENTITY_INVALID');
  }
  nonNegative(value.sourceCommitSeq,'MFP_SYNC_CHECKPOINT_SOURCE_COMMIT_INVALID');
  instant(value.createdAt,'MFP_SYNC_CHECKPOINT_CREATED_AT_INVALID');
  if(value.checkpointHash!==head.checkpointHash)throw new Error('MFP_SYNC_CHECKPOINT_HASH_MISMATCH');
  const out:Record<string,MfpSyncEntity>={};
  for(const raw of value.entities){
    const entity=validateEntity(raw);
    const key=entityKey(entity.entityType,entity.entityId);
    if(out[key])throw new Error('MFP_SYNC_CHECKPOINT_ENTITY_DUPLICATE');
    out[key]=entity;
  }
  const current=Object.freeze(out);
  const projectionHash=projectionHashForMfpSyncEntities(current);
  if(projectionHash!==value.projectionHash)throw new Error('MFP_SYNC_CHECKPOINT_PROJECTION_HASH_MISMATCH');
  const expectedHash=fingerprintMfpSyncValue({
    storeId:value.storeId,port:value.port,checkpointSeq:value.checkpointSeq,
    sourceCommitSeq:value.sourceCommitSeq,projectionHash,
    entities:Object.keys(current).sort().map(key=>{
      const entity=current[key]!;
      return {entityType:entity.entityType,entityId:entity.entityId,entityRevision:entity.entityRevision,payloadHash:entity.payloadHash};
    }),
  });
  if(value.checkpointHash!==expectedHash)throw new Error('MFP_SYNC_CHECKPOINT_HASH_MISMATCH');
  return current;
}

function errorCode(error:unknown){return error instanceof Error?error.message:'MFP_SYNC_FAILED';}
function securityFailure(error:unknown){return /(?:AUTH|DEVICE|SESSION|PERMISSION)/.test(errorCode(error));}

export function createMfpSyncCoordinator(input:{
  readonly store:MfpSyncProjectionStore;
  readonly transport:MfpSyncTransport;
  readonly readRequestContext:()=>Promise<MfpSyncRequestContext>;
  readonly now?:()=>string;
}):MfpSyncCoordinator{
  const now=input.now??(()=>new Date().toISOString());
  const listeners=new Set<()=>void>();
  let active:MfpSyncActiveProjection|null=null;
  let advertisedHeadSeq=0;
  let inFlight:Promise<void>|null=null;
  let snapshot:MfpSyncSnapshot=Object.freeze({
    connection:'DISCONNECTED',state:'UNINITIALIZED',headSeq:null,appliedSeq:null,lkgAvailable:false,
    lastDoorbellAt:null,lastHeadReadAt:null,lastAppliedAt:null,lastAckAt:null,lastError:null,
  });

  const update=(patch:Partial<MfpSyncSnapshot>)=>{
    snapshot=Object.freeze({...snapshot,...patch});
    for(const listener of listeners)listener();
  };

  const loadCheckpoint=async(head:MfpSyncHead,context:MfpSyncRequestContext)=>{
    if(!head.checkpointHash)throw new Error('MFP_SYNC_CHECKPOINT_REQUIRED_BUT_UNAVAILABLE');
    const value=await input.transport.readCheckpoint(head.checkpointSeq,context);
    return {entities:entitiesFromCheckpoint(value,head),appliedSeq:value.checkpointSeq,checkpointSeq:value.checkpointSeq};
  };

  const acknowledge=async(projection:MfpSyncActiveProjection,context:MfpSyncRequestContext)=>{
    const ack:MfpSyncAppliedAck=Object.freeze({
      schema:'MFK_SYNC_APPLIED_ACK_V1',protocol:MFP_SYNC_PROTOCOL,
      storeId:projection.storeId,port:'SMT',clientId:context.clientId,
      appliedSeq:projection.appliedSeq,projectionHash:projection.projectionHash,
      appliedAt:projection.appliedAt,checkpointSeq:projection.checkpointSeq,
    });
    await input.transport.ackApplied(ack,context);
    update({state:'READY',lastAckAt:now(),lastError:null});
  };

  const runCatchUpPass=async()=>{
    update({state:'CONNECTING',lastError:null});
    const context=await input.readRequestContext();
    text(context.storeId,'MFP_SYNC_CONTEXT_STORE_ID_INVALID',64);
    text(context.clientId,'MFP_SYNC_CONTEXT_CLIENT_ID_INVALID',180);
    text(context.deviceId,'MFP_SYNC_CONTEXT_DEVICE_ID_INVALID',180);
    const head=validateHead(await input.transport.readHead(context),context);
    update({headSeq:head.headSeq,lastHeadReadAt:now()});

    if(active?.appliedSeq===head.headSeq){
      if(active.storeId!==head.storeId||active.projectionHash!==head.projectionHash)throw new Error('MFP_SYNC_PROJECTION_HASH_MISMATCH');
      await acknowledge(active,context);
      update({appliedSeq:active.appliedSeq,lkgAvailable:true});
      return;
    }

    update({state:'BEHIND'});
    let staged:{entities:MfpSyncEntities;appliedSeq:number;checkpointSeq:number};
    if(active&&active.storeId===head.storeId&&active.appliedSeq<=head.headSeq
      &&active.appliedSeq>=Math.max(0,head.journalFloorSeq-1)){
      staged={entities:active.entities,appliedSeq:active.appliedSeq,checkpointSeq:active.checkpointSeq};
    }else if(!active&&head.headSeq===0){
      staged={entities:Object.freeze({}),appliedSeq:0,checkpointSeq:0};
    }else{
      update({state:'RECOVERING'});
      staged=await loadCheckpoint(head,context);
    }

    if(staged.appliedSeq<head.headSeq){
      let changes=await input.transport.readChanges(staged.appliedSeq,context);
      if(changes.kind==='CHECKPOINT_REQUIRED'){
        update({state:'RECOVERING'});
        staged=await loadCheckpoint(head,context);
        changes=staged.appliedSeq<head.headSeq
          ?await input.transport.readChanges(staged.appliedSeq,context)
          :{kind:'DELTA',batch:{
            schema:'MFK_SYNC_CHANGE_BATCH_V1',protocol:MFP_SYNC_PROTOCOL,
            storeId:head.storeId,port:'SMT',fromExclusive:staged.appliedSeq,toInclusive:staged.appliedSeq,
            headSeq:head.headSeq,journalFloorSeq:head.journalFloorSeq,changes:[],observedAt:head.observedAt,
          }};
      }
      if(changes.kind==='CHECKPOINT_REQUIRED')throw new Error('MFP_SYNC_CHECKPOINT_RECOVERY_REJECTED');
      if(changes.batch.storeId!==head.storeId||changes.batch.headSeq<head.headSeq)throw new Error('MFP_SYNC_CHANGE_BATCH_IDENTITY_INVALID');
      const applied=applyMfpSyncChangeBatch(staged.entities,staged.appliedSeq,changes.batch);
      staged={...staged,...applied};
    }

    if(staged.appliedSeq!==head.headSeq)throw new Error('MFP_SYNC_CHANGE_BATCH_INCOMPLETE');
    const projectionHash=projectionHashForMfpSyncEntities(staged.entities);
    if(projectionHash!==head.projectionHash)throw new Error('MFP_SYNC_PROJECTION_HASH_MISMATCH');
    const appliedAt=now();
    const candidate:MfpSyncActiveProjection=Object.freeze({
      storeId:head.storeId,port:'SMT',schemaVersion:1,appliedSeq:staged.appliedSeq,
      checkpointSeq:staged.checkpointSeq,projectionHash,entities:staged.entities,appliedAt,
    });
    await input.store.commitAtomically(candidate);
    active=candidate;
    update({state:'RECOVERING',appliedSeq:candidate.appliedSeq,lkgAvailable:true,lastAppliedAt:appliedAt,lastError:null});
    await acknowledge(candidate,context);
  };

  const requestCatchUp=()=>{
    if(snapshot.connection==='OFFLINE')return Promise.reject(new Error('MFP_SYNC_OFFLINE'));
    if(inFlight)return inFlight;
    const task=(async()=>{
      try{
        for(let pass=0;pass<2;pass++){
          await runCatchUpPass();
          if(advertisedHeadSeq<=(active?.appliedSeq??-1))return;
        }
        update({state:'BEHIND'});
      }catch(error){
        update({state:securityFailure(error)?'ERROR':active?'RECOVERING':'ERROR',lastError:errorCode(error)});
        throw error;
      }
    })().finally(()=>{if(inFlight===task)inFlight=null;});
    inFlight=task;
    return task;
  };

  const coordinator:MfpSyncCoordinator=Object.freeze({
    getSnapshot:()=>snapshot,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    async restore(){
      const stored=await input.store.readActive();
      active=stored?validateActive(stored):null;
      update(active?{
        state:'LOCAL_LKG',appliedSeq:active.appliedSeq,lkgAvailable:true,lastAppliedAt:active.appliedAt,lastError:null,
      }:{state:'UNINITIALIZED',appliedSeq:null,lkgAvailable:false,lastAppliedAt:null,lastError:null});
    },
    startup:requestCatchUp,
    webSocketOpened(){update({connection:'CONNECTED'});return requestCatchUp();},
    doorbellReceived(doorbell:MfpSyncDoorbell){
      if(doorbell.port!=='SMT')return Promise.reject(new Error('MFP_SYNC_DOORBELL_PORT_INVALID'));
      if(doorbell.advertisedHeadSeq!==undefined){
        const advertised=nonNegative(doorbell.advertisedHeadSeq,'MFP_SYNC_DOORBELL_HEAD_INVALID');
        advertisedHeadSeq=Math.max(advertisedHeadSeq,advertised);
      }
      instant(doorbell.observedAt,'MFP_SYNC_DOORBELL_OBSERVED_AT_INVALID');
      update({lastDoorbellAt:now()});
      return requestCatchUp();
    },
    networkOnline(){update({connection:'DISCONNECTED'});return requestCatchUp();},
    resumed:requestCatchUp,
    manualCatchUp:requestCatchUp,
    networkOffline(){update({connection:'OFFLINE',state:active?'OFFLINE':'ERROR'});},
    connectDoorbell(){
      return input.transport.connectDoorbell({
        onOpen(){void coordinator.webSocketOpened().catch(()=>{});},
        onDoorbell(doorbell){void coordinator.doorbellReceived(doorbell).catch(()=>{});},
        onOffline(){coordinator.networkOffline();},
      });
    },
  });
  return coordinator;
}

export function createMfpSyncSurfacePorts(port:MfpSyncCoordinator){
  return Object.freeze({MFP_PAD:port,MFP_MOBILE:port});
}
