import {readSmtDeviceId,subscribeSmtCloudDoorbell} from './admin-config-sync.ts';
import {localRuntime} from './local-runtime.ts';

const ENDPOINT='https://admin.morefunos.com';
const ATTENTION_KEY='mfk.keeta.order-lifecycle.attention.v1';

export interface KeetaOrderLifecycleEvent{
  readonly schema:'MFK_KEETA_ORDER_EVENT_V1';
  readonly storeId:'MF01';
  readonly provider:'KEETA';
  readonly providerShopId:number;
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly eventId:1002|1003|1004|1006|1008;
  readonly eventName:string;
  readonly providerPushedAt:string;
  readonly receivedAt:string;
  readonly fingerprint:string;
  readonly rawMessage:string;
  readonly state:'PENDING_SMT'|'LINKED';
  readonly canonicalOrderId?:string;
  readonly linkedAt?:string;
}

function validateEvent(input:unknown):KeetaOrderLifecycleEvent{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('KEETA_ORDER_EVENT_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!=='MFK_KEETA_ORDER_EVENT_V1'||row.storeId!=='MF01'||row.provider!=='KEETA')throw new Error('KEETA_ORDER_EVENT_SCHEMA_INVALID');
  const eventId=Number(row.eventId);
  if(![1002,1003,1004,1006,1008].includes(eventId))throw new Error('KEETA_ORDER_EVENT_ID_UNSUPPORTED');
  const providerOrderId=String(row.providerOrderId??'').trim();
  const providerMessageId=String(row.providerMessageId??'').trim();
  if(!providerOrderId||!providerMessageId)throw new Error('KEETA_ORDER_EVENT_IDENTITY_REQUIRED');
  if(row.state!=='PENDING_SMT'&&row.state!=='LINKED')throw new Error('KEETA_ORDER_EVENT_STATE_INVALID');
  return row as unknown as KeetaOrderLifecycleEvent;
}

function attention(providerOrderId:string,code:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    const rows=Array.isArray(current)?current:[];
    localStorage.setItem(ATTENTION_KEY,JSON.stringify([
      {providerOrderId,code,updatedAt:new Date().toISOString()},
      ...rows.filter(row=>String(row?.providerOrderId)!==providerOrderId),
    ].slice(0,100)));
  }catch{}
}
function clearAttention(providerOrderId:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    if(!Array.isArray(current))return;
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.filter(row=>String(row?.providerOrderId)!==providerOrderId)));
  }catch{}
}
export function readKeetaOrderLifecycleAttention(){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    return Object.freeze(Array.isArray(current)?current:[]);
  }catch{return Object.freeze([]);}
}

async function ack(event:KeetaOrderLifecycleEvent,canonicalOrderId:string){
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/events/ack?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        providerOrderId:event.providerOrderId,
        providerMessageId:event.providerMessageId,
        canonicalOrderId,
      }),
    },
  );
  const body=await response.json().catch(()=>({})) as {code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_ORDER_EVENT_ACK_HTTP_'+response.status);
}

let reconciling=false;
export async function reconcileKeetaOrderLifecycle(){
  if(reconciling||typeof navigator!=='undefined'&&typeof navigator.onLine==='boolean'&&!navigator.onLine)return;
  reconciling=true;
  try{
    const deviceId=readSmtDeviceId();
    const response=await fetch(
      ENDPOINT+'/api/keeta/smt/orders/events/pending?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
      {cache:'no-store'},
    );
    if(response.status===401)return;
    const body=await response.json().catch(()=>({})) as {events?:unknown[];code?:string};
    if(!response.ok)throw new Error(body.code||'KEETA_ORDER_EVENT_PENDING_HTTP_'+response.status);
    for(const raw of Array.isArray(body.events)?body.events:[]){
      let event:KeetaOrderLifecycleEvent|undefined;
      try{
        event=validateEvent(raw);
        const providerRef='KEETA:'+event.providerOrderId;
        const order=localRuntime.orders().find(row=>row.providerRef===providerRef);
        if(!order)throw new Error('KEETA_ORDER_EVENT_CANONICAL_ORDER_NOT_FOUND:'+event.providerOrderId);
        localRuntime.applyProviderLifecycle({
          orderId:order.id,
          eventId:event.eventId,
          eventName:event.eventName,
          providerMessageId:event.providerMessageId,
          providerPushedAt:event.providerPushedAt,
          rawMessage:event.rawMessage,
        });
        await ack(event,order.id);
        clearAttention(event.providerOrderId);
      }catch(error){
        attention(event?.providerOrderId??'UNKNOWN',error instanceof Error?error.message:'KEETA_ORDER_EVENT_APPLY_FAILED');
      }
    }
  }finally{
    reconciling=false;
  }
}

let installed=false;
export function installKeetaOrderLifecycle(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='KEETA_ORDER_EVENT_AVAILABLE')void reconcileKeetaOrderLifecycle();
  });
  window.addEventListener('online',()=>void reconcileKeetaOrderLifecycle());
  window.addEventListener('focus',()=>void reconcileKeetaOrderLifecycle());
  window.setTimeout(()=>void reconcileKeetaOrderLifecycle(),0);
}
