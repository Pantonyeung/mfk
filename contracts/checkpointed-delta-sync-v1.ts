export const MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL='MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1' as const;
export const MFK_SYNC_SCHEMA_VERSION=1 as const;
export const MFK_SYNC_PORTS=['SMT','SMM','CUSTOMER','KEETA'] as const;
export type MfkSyncPort=typeof MFK_SYNC_PORTS[number];
export type MfkSyncChangeOperation='UPSERT'|'DELETE';

export interface MfkSyncHead{
  readonly schema:'MFK_SYNC_HEAD_V1';
  readonly protocol:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
  readonly schemaVersion:typeof MFK_SYNC_SCHEMA_VERSION;
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly headSeq:number;
  readonly journalFloorSeq:number;
  readonly checkpointSeq:number;
  readonly checkpointHash:string;
  readonly projectionHash:string;
  readonly sourceCommitSeq:number;
  readonly observedAt:string;
}

export interface MfkSyncChange{
  readonly schema:'MFK_PORT_CHANGE_V1';
  readonly protocol:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
  readonly schemaVersion:typeof MFK_SYNC_SCHEMA_VERSION;
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly portSeq:number;
  readonly sourceCommitSeq:number;
  readonly commitId:string;
  readonly entityType:string;
  readonly entityId:string;
  readonly entityRevision:number;
  readonly op:MfkSyncChangeOperation;
  readonly payload?:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
  readonly createdAt:string;
}

export interface MfkSyncChangeBatch{
  readonly schema:'MFK_SYNC_CHANGE_BATCH_V1';
  readonly protocol:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly fromExclusive:number;
  readonly toInclusive:number;
  readonly headSeq:number;
  readonly journalFloorSeq:number;
  readonly changes:readonly MfkSyncChange[];
  readonly observedAt:string;
}

export interface MfkSyncCheckpointEntity{
  readonly entityType:string;
  readonly entityId:string;
  readonly entityRevision:number;
  readonly payload:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
}

export interface MfkSyncCheckpoint{
  readonly schema:'MFK_SYNC_CHECKPOINT_V1';
  readonly protocol:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
  readonly schemaVersion:typeof MFK_SYNC_SCHEMA_VERSION;
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly checkpointSeq:number;
  readonly sourceCommitSeq:number;
  readonly projectionHash:string;
  readonly checkpointHash:string;
  readonly entities:readonly MfkSyncCheckpointEntity[];
  readonly createdAt:string;
}

export interface MfkSyncAppliedAck{
  readonly schema:'MFK_SYNC_APPLIED_ACK_V1';
  readonly protocol:typeof MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL;
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly clientId:string;
  readonly appliedSeq:number;
  readonly projectionHash:string;
  readonly appliedAt:string;
  readonly checkpointSeq?:number;
}

function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const normalized=value.trim();
  if(!normalized||normalized.length>max)throw new Error(code);
  return normalized;
}
function nonNegativeInt(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new Error(code);
  return n;
}
function positiveInt(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1)throw new Error(code);
  return n;
}
export function isMfkSyncPort(value:unknown):value is MfkSyncPort{
  return MFK_SYNC_PORTS.includes(String(value) as MfkSyncPort);
}
function port(value:unknown,code:string):MfkSyncPort{
  if(!isMfkSyncPort(value))throw new Error(code);
  return String(value) as MfkSyncPort;
}
function instant(value:unknown,code:string){
  const normalized=text(value,code,64);
  if(!Number.isFinite(Date.parse(normalized)))throw new Error(code);
  return normalized;
}

function stable(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function fnv1a(value:string){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}
export function fingerprintMfkSyncValue(value:unknown){
  return 'fnv1a32:'+fnv1a(stable(value));
}

export function validateMfkSyncHead(input:unknown):MfkSyncHead{
  const row=object(input,'SYNC_HEAD_INVALID');
  if(row.schema!=='MFK_SYNC_HEAD_V1'||row.protocol!==MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL)throw new Error('SYNC_HEAD_SCHEMA_UNSUPPORTED');
  const out={
    schema:'MFK_SYNC_HEAD_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    schemaVersion:positiveInt(row.schemaVersion,'SYNC_HEAD_SCHEMA_VERSION_INVALID') as typeof MFK_SYNC_SCHEMA_VERSION,
    storeId:text(row.storeId,'SYNC_HEAD_STORE_ID_INVALID',64),
    port:port(row.port,'SYNC_HEAD_PORT_INVALID'),
    headSeq:nonNegativeInt(row.headSeq,'SYNC_HEAD_SEQ_INVALID'),
    journalFloorSeq:nonNegativeInt(row.journalFloorSeq,'SYNC_HEAD_JOURNAL_FLOOR_INVALID'),
    checkpointSeq:nonNegativeInt(row.checkpointSeq,'SYNC_HEAD_CHECKPOINT_SEQ_INVALID'),
    checkpointHash:String(row.checkpointHash??''),
    projectionHash:String(row.projectionHash??''),
    sourceCommitSeq:nonNegativeInt(row.sourceCommitSeq,'SYNC_HEAD_SOURCE_COMMIT_INVALID'),
    observedAt:instant(row.observedAt,'SYNC_HEAD_OBSERVED_AT_INVALID'),
  };
  if(out.journalFloorSeq>out.headSeq)throw new Error('SYNC_HEAD_JOURNAL_FLOOR_AHEAD');
  if(out.checkpointSeq>out.headSeq)throw new Error('SYNC_HEAD_CHECKPOINT_AHEAD');
  return Object.freeze(out);
}

export function validateMfkSyncChange(input:unknown):MfkSyncChange{
  const row=object(input,'SYNC_CHANGE_INVALID');
  if(row.schema!=='MFK_PORT_CHANGE_V1'||row.protocol!==MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL)throw new Error('SYNC_CHANGE_SCHEMA_UNSUPPORTED');
  const op=row.op==='UPSERT'?'UPSERT':row.op==='DELETE'?'DELETE':null;
  if(!op)throw new Error('SYNC_CHANGE_OP_INVALID');
  const payload=row.payload===undefined?undefined:object(row.payload,'SYNC_CHANGE_PAYLOAD_INVALID');
  if(op==='UPSERT'&&!payload)throw new Error('SYNC_CHANGE_PAYLOAD_REQUIRED');
  const out={
    schema:'MFK_PORT_CHANGE_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    schemaVersion:positiveInt(row.schemaVersion,'SYNC_CHANGE_SCHEMA_VERSION_INVALID') as typeof MFK_SYNC_SCHEMA_VERSION,
    storeId:text(row.storeId,'SYNC_CHANGE_STORE_ID_INVALID',64),
    port:port(row.port,'SYNC_CHANGE_PORT_INVALID'),
    portSeq:positiveInt(row.portSeq,'SYNC_CHANGE_SEQ_INVALID'),
    sourceCommitSeq:positiveInt(row.sourceCommitSeq,'SYNC_CHANGE_SOURCE_COMMIT_INVALID'),
    commitId:text(row.commitId,'SYNC_CHANGE_COMMIT_ID_INVALID',180),
    entityType:text(row.entityType,'SYNC_CHANGE_ENTITY_TYPE_INVALID',120),
    entityId:text(row.entityId,'SYNC_CHANGE_ENTITY_ID_INVALID',240),
    entityRevision:positiveInt(row.entityRevision,'SYNC_CHANGE_ENTITY_REVISION_INVALID'),
    op,
    ...(payload?{payload:Object.freeze(payload)}:{}),
    payloadHash:text(row.payloadHash,'SYNC_CHANGE_PAYLOAD_HASH_INVALID',180),
    createdAt:instant(row.createdAt,'SYNC_CHANGE_CREATED_AT_INVALID'),
  };
  const expected=fingerprintMfkSyncValue(op==='UPSERT'?payload:{entityType:out.entityType,entityId:out.entityId,op:'DELETE'});
  if(out.payloadHash!==expected)throw new Error('SYNC_CHANGE_PAYLOAD_HASH_MISMATCH');
  return Object.freeze(out);
}

export function validateMfkSyncChangeBatch(input:unknown):MfkSyncChangeBatch{
  const row=object(input,'SYNC_CHANGE_BATCH_INVALID');
  if(row.schema!=='MFK_SYNC_CHANGE_BATCH_V1'||row.protocol!==MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL)throw new Error('SYNC_CHANGE_BATCH_SCHEMA_UNSUPPORTED');
  const changes=Array.isArray(row.changes)?row.changes.map(validateMfkSyncChange):(()=>{throw new Error('SYNC_CHANGE_BATCH_CHANGES_INVALID');})();
  const out={
    schema:'MFK_SYNC_CHANGE_BATCH_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    storeId:text(row.storeId,'SYNC_CHANGE_BATCH_STORE_ID_INVALID',64),
    port:port(row.port,'SYNC_CHANGE_BATCH_PORT_INVALID'),
    fromExclusive:nonNegativeInt(row.fromExclusive,'SYNC_CHANGE_BATCH_FROM_INVALID'),
    toInclusive:nonNegativeInt(row.toInclusive,'SYNC_CHANGE_BATCH_TO_INVALID'),
    headSeq:nonNegativeInt(row.headSeq,'SYNC_CHANGE_BATCH_HEAD_INVALID'),
    journalFloorSeq:nonNegativeInt(row.journalFloorSeq,'SYNC_CHANGE_BATCH_FLOOR_INVALID'),
    changes:Object.freeze(changes),
    observedAt:instant(row.observedAt,'SYNC_CHANGE_BATCH_OBSERVED_AT_INVALID'),
  };
  let expected=out.fromExclusive+1;
  for(const change of changes){
    if(change.port!==out.port||change.storeId!==out.storeId||change.portSeq!==expected)throw new Error('SYNC_CHANGE_BATCH_NON_CONTIGUOUS');
    expected++;
  }
  if(changes.length&&changes[changes.length-1]!.portSeq!==out.toInclusive)throw new Error('SYNC_CHANGE_BATCH_TO_MISMATCH');
  if(!changes.length&&out.toInclusive!==out.fromExclusive)throw new Error('SYNC_CHANGE_BATCH_EMPTY_RANGE_INVALID');
  return Object.freeze(out);
}

export function validateMfkSyncCheckpoint(input:unknown):MfkSyncCheckpoint{
  const row=object(input,'SYNC_CHECKPOINT_INVALID');
  if(row.schema!=='MFK_SYNC_CHECKPOINT_V1'||row.protocol!==MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL)throw new Error('SYNC_CHECKPOINT_SCHEMA_UNSUPPORTED');
  if(!Array.isArray(row.entities))throw new Error('SYNC_CHECKPOINT_ENTITIES_INVALID');
  const entities=row.entities.map(raw=>{
    const entity=object(raw,'SYNC_CHECKPOINT_ENTITY_INVALID');
    const payload=object(entity.payload,'SYNC_CHECKPOINT_ENTITY_PAYLOAD_INVALID');
    const payloadHash=text(entity.payloadHash,'SYNC_CHECKPOINT_ENTITY_PAYLOAD_HASH_INVALID',180);
    if(payloadHash!==fingerprintMfkSyncValue(payload))throw new Error('SYNC_CHECKPOINT_ENTITY_PAYLOAD_HASH_MISMATCH');
    return Object.freeze({
      entityType:text(entity.entityType,'SYNC_CHECKPOINT_ENTITY_TYPE_INVALID',120),
      entityId:text(entity.entityId,'SYNC_CHECKPOINT_ENTITY_ID_INVALID',240),
      entityRevision:positiveInt(entity.entityRevision,'SYNC_CHECKPOINT_ENTITY_REVISION_INVALID'),
      payload:Object.freeze(payload),
      payloadHash,
    });
  });
  return Object.freeze({
    schema:'MFK_SYNC_CHECKPOINT_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    schemaVersion:positiveInt(row.schemaVersion,'SYNC_CHECKPOINT_SCHEMA_VERSION_INVALID') as typeof MFK_SYNC_SCHEMA_VERSION,
    storeId:text(row.storeId,'SYNC_CHECKPOINT_STORE_ID_INVALID',64),
    port:port(row.port,'SYNC_CHECKPOINT_PORT_INVALID'),
    checkpointSeq:nonNegativeInt(row.checkpointSeq,'SYNC_CHECKPOINT_SEQ_INVALID'),
    sourceCommitSeq:nonNegativeInt(row.sourceCommitSeq,'SYNC_CHECKPOINT_SOURCE_COMMIT_INVALID'),
    projectionHash:text(row.projectionHash,'SYNC_CHECKPOINT_PROJECTION_HASH_INVALID',180),
    checkpointHash:text(row.checkpointHash,'SYNC_CHECKPOINT_HASH_INVALID',180),
    entities:Object.freeze(entities),
    createdAt:instant(row.createdAt,'SYNC_CHECKPOINT_CREATED_AT_INVALID'),
  });
}

export function validateMfkSyncAppliedAck(input:unknown):MfkSyncAppliedAck{
  const row=object(input,'SYNC_APPLIED_ACK_INVALID');
  if(row.schema!=='MFK_SYNC_APPLIED_ACK_V1'||row.protocol!==MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL)throw new Error('SYNC_APPLIED_ACK_SCHEMA_UNSUPPORTED');
  return Object.freeze({
    schema:'MFK_SYNC_APPLIED_ACK_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    storeId:text(row.storeId,'SYNC_APPLIED_ACK_STORE_ID_INVALID',64),
    port:port(row.port,'SYNC_APPLIED_ACK_PORT_INVALID'),
    clientId:text(row.clientId,'SYNC_APPLIED_ACK_CLIENT_ID_INVALID',180),
    appliedSeq:nonNegativeInt(row.appliedSeq,'SYNC_APPLIED_ACK_SEQ_INVALID'),
    projectionHash:text(row.projectionHash,'SYNC_APPLIED_ACK_PROJECTION_HASH_INVALID',180),
    appliedAt:instant(row.appliedAt,'SYNC_APPLIED_ACK_APPLIED_AT_INVALID'),
    ...(row.checkpointSeq===undefined?{}:{checkpointSeq:nonNegativeInt(row.checkpointSeq,'SYNC_APPLIED_ACK_CHECKPOINT_INVALID')}),
  });
}
