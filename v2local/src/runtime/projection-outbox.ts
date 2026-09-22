import {createSmtProjectionEvent,type SmtProjectionEvent} from '../../../contracts/smt-projection-v1.ts';
import {readSmtDeviceId,readAdminSnapshotSection,subscribeSmtAdminConfig} from './admin-config-sync.ts';
import {resolveBusinessWindow,type LocalCashOpening,type LocalDayClose} from './local-operations.ts';

export const SMT_PROJECTION_OUTBOX_KEY='mfk.v2local.projection-outbox.v1';
export const SMT_PROJECTION_ACKED_KEY='mfk.v2local.projection-acked.v1';
export const SMT_PROJECTION_ENDPOINT='https://admin.morefunos.com';

export interface ProjectionOrderInput{
  readonly id:string;
  readonly display:string;
  readonly createdAt:string;
  readonly updatedAt?:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly fulfillmentLabel:string;
  readonly sourceLabel:string;
  readonly staffId?:string;
  readonly staffName?:string;
  readonly items:readonly {readonly id:string;readonly name:string;readonly qty:number;readonly unitMinor:number}[];
}

interface OutboxRow{
  readonly event:SmtProjectionEvent;
  readonly queuedAt:string;
  readonly attempts:number;
  readonly lastError?:string;
}

const listeners=new Set<()=>void>();
function emit(){for(const listener of listeners)listener();}
function readRows(){
  try{
    const value=JSON.parse(localStorage.getItem(SMT_PROJECTION_OUTBOX_KEY)||'[]');
    return Array.isArray(value)?value as OutboxRow[]:[];
  }catch{return []}
}
function writeRows(rows:readonly OutboxRow[]){
  localStorage.setItem(SMT_PROJECTION_OUTBOX_KEY,JSON.stringify(rows));
  emit();
}
function readAcked(){
  try{
    const value=JSON.parse(localStorage.getItem(SMT_PROJECTION_ACKED_KEY)||'[]');
    return new Set(Array.isArray(value)?value.map(String):[]);
  }catch{return new Set<string>()}
}
function writeAcked(ids:Iterable<string>){
  const unique=[...new Set(ids)];
  localStorage.setItem(SMT_PROJECTION_ACKED_KEY,JSON.stringify(unique.slice(-5000)));
}
function cutoff(){
  const config=readAdminSnapshotSection<{cutoff?:string}>('businessDay');
  const value=String(config?.cutoff??'05:00');
  const match=value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match?{hour:Number(match[1]),minute:Number(match[2])}:{hour:5,minute:0};
}
function businessDateFor(iso:string){
  const at=Date.parse(iso);
  const c=cutoff();
  return resolveBusinessWindow(Number.isFinite(at)?at:Date.now(),c.hour,c.minute).businessDate;
}
function enqueue(event:SmtProjectionEvent){
  if(readAcked().has(event.eventId))return event;
  const current=readRows();
  if(current.some(row=>row.event.eventId===event.eventId))return event;
  const next=[...current,{event,queuedAt:new Date().toISOString(),attempts:0}];
  writeRows(next);
  if(typeof window!=='undefined'&&navigator.onLine)void flushProjectionOutbox();
  return event;
}
export function subscribeProjectionOutbox(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}
export function readProjectionOutbox(){return Object.freeze(readRows().map(row=>Object.freeze({...row,event:Object.freeze({...row.event})})));}

export function queueOrderProjection(order:ProjectionOrderInput){
  const occurredAt=order.updatedAt||order.createdAt;
  return enqueue(createSmtProjectionEvent({
    storeId:'MF01',
    deviceId:readSmtDeviceId(),
    type:'ORDER_UPSERT',
    entityId:order.id,
    occurredAt,
    payload:Object.freeze({
      orderId:order.id,
      display:order.display,
      createdAt:order.createdAt,
      updatedAt:occurredAt,
      businessDate:businessDateFor(order.createdAt),
      totalMinor:Math.max(0,Math.round(order.totalMinor)),
      paymentLabel:String(order.paymentLabel||''),
      fulfillmentLabel:String(order.fulfillmentLabel||''),
      sourceLabel:String(order.sourceLabel||''),
      ...(order.staffId?{staffId:String(order.staffId)}:{}),
      ...(order.staffName?{staffName:String(order.staffName)}:{}),
      items:Object.freeze(order.items.map(item=>Object.freeze({
        id:String(item.id),
        name:String(item.name),
        qty:Math.max(0,Math.floor(Number(item.qty)||0)),
        unitMinor:Math.max(0,Math.round(Number(item.unitMinor)||0)),
      }))),
    }),
  }));
}

export function queueCashOpeningProjection(row:LocalCashOpening){
  return enqueue(createSmtProjectionEvent({
    storeId:'MF01',
    deviceId:readSmtDeviceId(),
    type:'CASH_OPENING_CONFIRMED',
    entityId:row.businessDate,
    occurredAt:new Date(row.createdAt).toISOString(),
    payload:Object.freeze({...row}),
  }));
}

export function queueDayCloseProjection(row:LocalDayClose){
  return enqueue(createSmtProjectionEvent({
    storeId:'MF01',
    deviceId:readSmtDeviceId(),
    type:'DAY_CLOSE_RECORDED',
    entityId:row.businessDate,
    occurredAt:new Date(row.createdAt).toISOString(),
    payload:Object.freeze({...row}),
  }));
}

let flushing=false;
export async function flushProjectionOutbox(){
  if(flushing||typeof fetch==='undefined'||typeof navigator!=='undefined'&&!navigator.onLine)return;
  const rows=readRows();
  if(!rows.length)return;
  flushing=true;
  const batch=rows.slice(0,50);
  try{
    const response=await fetch(SMT_PROJECTION_ENDPOINT+'/api/projection/events?storeId=MF01',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({events:batch.map(row=>row.event)}),
    });
    const body=await response.json().catch(()=>({})) as {accepted?:string[];code?:string};
    if(!response.ok)throw new Error(body.code||'PROJECTION_HTTP_'+response.status);
    const accepted=new Set(Array.isArray(body.accepted)?body.accepted:[]);
    const acked=readAcked();
    for(const id of accepted)acked.add(id);
    writeAcked(acked);
    writeRows(readRows().filter(row=>!accepted.has(row.event.eventId)));
  }catch(error){
    const failedIds=new Set(batch.map(row=>row.event.eventId));
    writeRows(readRows().map(row=>failedIds.has(row.event.eventId)?{
      ...row,
      attempts:row.attempts+1,
      lastError:error instanceof Error?error.message:'PROJECTION_FLUSH_FAILED',
    }:row));
  }finally{
    flushing=false;
  }
}

let installed=false;
export function installProjectionOutboxAutoFlush(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const flush=()=>void flushProjectionOutbox();
  window.addEventListener('online',flush);
  window.addEventListener('focus',flush);
  subscribeSmtAdminConfig(flush);
  window.setTimeout(flush,0);
}
