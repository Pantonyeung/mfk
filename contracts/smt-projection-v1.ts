export const MFK_SMT_PROJECTION_SCHEMA='MFK_SMT_PROJECTION_EVENT_V1' as const;

export type SmtProjectionEventType=
  |'ORDER_UPSERT'
  |'CASH_OPENING_CONFIRMED'
  |'DAY_CLOSE_RECORDED';

export interface SmtProjectionEvent<T=Readonly<Record<string,unknown>>>{
  readonly schema:typeof MFK_SMT_PROJECTION_SCHEMA;
  readonly eventId:string;
  readonly storeId:string;
  readonly deviceId:string;
  readonly type:SmtProjectionEventType;
  readonly entityId:string;
  readonly occurredAt:string;
  readonly payload:T;
  readonly fingerprint:string;
}

function record(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const v=value.trim();
  if(!v||v.length>max)throw new Error(code);
  return v;
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
function canonicalBase(value:Omit<SmtProjectionEvent,'eventId'|'fingerprint'>){
  return {
    schema:value.schema,
    storeId:value.storeId,
    deviceId:value.deviceId,
    type:value.type,
    entityId:value.entityId,
    occurredAt:value.occurredAt,
    payload:value.payload,
  };
}
export function fingerprintSmtProjectionEvent(value:Omit<SmtProjectionEvent,'eventId'|'fingerprint'>){
  return 'fnv1a32:'+fnv1a(stable(canonicalBase(value)));
}
export function createSmtProjectionEvent<T extends Readonly<Record<string,unknown>>>(input:{
  readonly storeId:string;
  readonly deviceId:string;
  readonly type:SmtProjectionEventType;
  readonly entityId:string;
  readonly occurredAt:string;
  readonly payload:T;
}):SmtProjectionEvent<T>{
  const type=input.type;
  if(!['ORDER_UPSERT','CASH_OPENING_CONFIRMED','DAY_CLOSE_RECORDED'].includes(type))throw new Error('PROJECTION_EVENT_TYPE_INVALID');
  const base={
    schema:MFK_SMT_PROJECTION_SCHEMA,
    storeId:text(input.storeId,'PROJECTION_STORE_ID_INVALID',64),
    deviceId:text(input.deviceId,'PROJECTION_DEVICE_ID_INVALID',128),
    type,
    entityId:text(input.entityId,'PROJECTION_ENTITY_ID_INVALID',180),
    occurredAt:text(input.occurredAt,'PROJECTION_OCCURRED_AT_INVALID',64),
    payload:record(input.payload,'PROJECTION_PAYLOAD_INVALID') as T,
  } as const;
  if(!Number.isFinite(Date.parse(base.occurredAt)))throw new Error('PROJECTION_OCCURRED_AT_INVALID');
  const fingerprint=fingerprintSmtProjectionEvent(base);
  return Object.freeze({
    ...base,
    eventId:type+':'+base.entityId+':'+fingerprint,
    fingerprint,
  });
}

export function validateSmtProjectionEvent(input:unknown):SmtProjectionEvent{
  const row=record(input,'PROJECTION_EVENT_INVALID');
  if(row.schema!==MFK_SMT_PROJECTION_SCHEMA)throw new Error('PROJECTION_EVENT_SCHEMA_UNSUPPORTED');
  const type=String(row.type) as SmtProjectionEventType;
  if(!['ORDER_UPSERT','CASH_OPENING_CONFIRMED','DAY_CLOSE_RECORDED'].includes(type))throw new Error('PROJECTION_EVENT_TYPE_INVALID');
  const base={
    schema:MFK_SMT_PROJECTION_SCHEMA,
    storeId:text(row.storeId,'PROJECTION_STORE_ID_INVALID',64),
    deviceId:text(row.deviceId,'PROJECTION_DEVICE_ID_INVALID',128),
    type,
    entityId:text(row.entityId,'PROJECTION_ENTITY_ID_INVALID',180),
    occurredAt:text(row.occurredAt,'PROJECTION_OCCURRED_AT_INVALID',64),
    payload:record(row.payload,'PROJECTION_PAYLOAD_INVALID'),
  } as const;
  if(!Number.isFinite(Date.parse(base.occurredAt)))throw new Error('PROJECTION_OCCURRED_AT_INVALID');
  const fingerprint=fingerprintSmtProjectionEvent(base);
  if(row.fingerprint!==fingerprint)throw new Error('PROJECTION_EVENT_FINGERPRINT_MISMATCH');
  const eventId=text(row.eventId,'PROJECTION_EVENT_ID_INVALID',360);
  if(eventId!==type+':'+base.entityId+':'+fingerprint)throw new Error('PROJECTION_EVENT_ID_MISMATCH');
  return Object.freeze({...base,eventId,fingerprint});
}

export function validateSmtProjectionBatch(input:unknown){
  const row=record(input,'PROJECTION_BATCH_INVALID');
  if(!Array.isArray(row.events)||row.events.length===0||row.events.length>100)throw new Error('PROJECTION_BATCH_EVENTS_INVALID');
  return Object.freeze({events:Object.freeze(row.events.map(validateSmtProjectionEvent))});
}
