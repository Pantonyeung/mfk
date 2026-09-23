import {readSmtDeviceId,subscribeSmtCloudDoorbell} from './admin-config-sync.ts';
import {localRuntime,type StoredOrder} from './local-runtime.ts';

const ENDPOINT='https://admin.morefunos.com';
const CASE_KEY='mfk.keeta.after-sale.cases.v1';
const ATTENTION_KEY='mfk.keeta.after-sale.attention.v1';

export interface KeetaAfterSaleCase{
  readonly afterSaleOrderId:string;
  readonly providerOrderId:string;
  readonly canonicalOrderId:string;
  readonly eventId:1005|1007;
  readonly providerMessageId:string;
  readonly providerStatus:number|null;
  readonly refundAmountMinor:number|null;
  readonly currency:string|null;
  readonly applyReason:string;
  readonly handleReason:string;
  readonly isAppeal:boolean;
  readonly updatedAt:string;
  readonly decisionState?:'APPROVED'|'REJECTED'|'ATTENTION';
  readonly decisionCode?:string;
}
interface PendingAfterSaleEvent{
  readonly schema:'MFK_KEETA_AFTER_SALE_EVENT_V1';
  readonly storeId:'MF01';
  readonly provider:'KEETA';
  readonly providerOrderId:string;
  readonly afterSaleOrderId:string;
  readonly providerMessageId:string;
  readonly eventId:1005|1007;
  readonly providerStatus:number|null;
  readonly refundAmountMinor:number|null;
  readonly currency:string|null;
  readonly rawMessage:string;
  readonly state:'PENDING_SMT'|'LINKED';
  readonly receivedAt:string;
}

function readCases():KeetaAfterSaleCase[]{
  try{
    const value=JSON.parse(localStorage.getItem(CASE_KEY)||'[]');
    return Array.isArray(value)?value:[];
  }catch{return [];}
}
function writeCases(rows:readonly KeetaAfterSaleCase[]){
  localStorage.setItem(CASE_KEY,JSON.stringify(rows.slice(0,300)));
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-keeta-after-sale'));
}
function upsertCase(row:KeetaAfterSaleCase){
  const current=readCases();
  const existing=current.find(item=>item.afterSaleOrderId===row.afterSaleOrderId);
  writeCases([{...existing,...row},...current.filter(item=>item.afterSaleOrderId!==row.afterSaleOrderId)]);
}
function parseEvent(input:unknown):PendingAfterSaleEvent{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('KEETA_AFTER_SALE_EVENT_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!=='MFK_KEETA_AFTER_SALE_EVENT_V1'||row.storeId!=='MF01'||row.provider!=='KEETA')throw new Error('KEETA_AFTER_SALE_EVENT_SCHEMA_INVALID');
  const eventId=Number(row.eventId);
  if(eventId!==1005&&eventId!==1007)throw new Error('KEETA_AFTER_SALE_EVENT_ID_UNSUPPORTED');
  const providerOrderId=String(row.providerOrderId??'').trim();
  const afterSaleOrderId=String(row.afterSaleOrderId??'').trim();
  const providerMessageId=String(row.providerMessageId??'').trim();
  if(!providerOrderId||!afterSaleOrderId||!providerMessageId)throw new Error('KEETA_AFTER_SALE_EVENT_IDENTITY_REQUIRED');
  if(row.state!=='PENDING_SMT'&&row.state!=='LINKED')throw new Error('KEETA_AFTER_SALE_EVENT_STATE_INVALID');
  return row as unknown as PendingAfterSaleEvent;
}
function parseMessage(rawMessage:string){
  try{
    const value=JSON.parse(rawMessage);
    return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  }catch{return {};}
}
function attention(afterSaleOrderId:string,code:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    const rows=Array.isArray(current)?current:[];
    localStorage.setItem(ATTENTION_KEY,JSON.stringify([
      {afterSaleOrderId,code,updatedAt:new Date().toISOString()},
      ...rows.filter(row=>String(row?.afterSaleOrderId)!==afterSaleOrderId),
    ].slice(0,100)));
  }catch{}
}
function clearAttention(afterSaleOrderId:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    if(!Array.isArray(current))return;
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.filter(row=>String(row?.afterSaleOrderId)!==afterSaleOrderId)));
  }catch{}
}
export function readKeetaAfterSaleAttention(){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    return Object.freeze(Array.isArray(current)?current:[]);
  }catch{return Object.freeze([]);}
}
export function readKeetaAfterSales(orderId?:string){
  const rows=readCases();
  return Object.freeze(orderId?rows.filter(row=>row.canonicalOrderId===orderId):rows);
}

function providerId(order:StoredOrder){
  const ref=String(order.providerRef||'').trim();
  return ref.startsWith('KEETA:')?ref.slice('KEETA:'.length).trim():'';
}

async function ack(event:PendingAfterSaleEvent,canonicalOrderId:string){
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/after-sales/ack?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        providerOrderId:event.providerOrderId,
        providerMessageId:event.providerMessageId,
        afterSaleOrderId:event.afterSaleOrderId,
        canonicalOrderId,
      }),
    },
  );
  const body=await response.json().catch(()=>({})) as {code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_AFTER_SALE_ACK_HTTP_'+response.status);
}

let reconciling=false;
export async function reconcileKeetaAfterSales(){
  if(reconciling||typeof navigator!=='undefined'&&typeof navigator.onLine==='boolean'&&!navigator.onLine)return;
  reconciling=true;
  try{
    const deviceId=readSmtDeviceId();
    const response=await fetch(
      ENDPOINT+'/api/keeta/smt/orders/after-sales/pending?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
      {cache:'no-store'},
    );
    if(response.status===401)return;
    const body=await response.json().catch(()=>({})) as {events?:unknown[];code?:string};
    if(!response.ok)throw new Error(body.code||'KEETA_AFTER_SALE_PENDING_HTTP_'+response.status);
    for(const raw of Array.isArray(body.events)?body.events:[]){
      let event:PendingAfterSaleEvent|undefined;
      try{
        event=parseEvent(raw);
        const order=localRuntime.orders().find(row=>providerId(row)===event!.providerOrderId);
        if(!order)throw new Error('KEETA_AFTER_SALE_CANONICAL_ORDER_NOT_FOUND:'+event.providerOrderId);
        const message=parseMessage(event.rawMessage);
        upsertCase(Object.freeze({
          afterSaleOrderId:event.afterSaleOrderId,
          providerOrderId:event.providerOrderId,
          canonicalOrderId:order.id,
          eventId:event.eventId,
          providerMessageId:event.providerMessageId,
          providerStatus:event.providerStatus,
          refundAmountMinor:event.refundAmountMinor,
          currency:event.currency,
          applyReason:typeof message.applyReason==='string'?message.applyReason:'',
          handleReason:typeof message.handleReason==='string'?message.handleReason:'',
          isAppeal:Number(message.isAppeal)===1,
          updatedAt:event.receivedAt,
        }));
        await ack(event,order.id);
        clearAttention(event.afterSaleOrderId);
      }catch(error){
        attention(event?.afterSaleOrderId??'UNKNOWN',error instanceof Error?error.message:'KEETA_AFTER_SALE_APPLY_FAILED');
      }
    }
  }finally{
    reconciling=false;
  }
}

export async function decideKeetaAfterSale(
  afterSaleOrderId:string,
  decision:'APPROVE'|'REJECT',
  rejectCode?:100000|100001|100002,
  rejectReason?:string,
){
  const row=readCases().find(item=>item.afterSaleOrderId===afterSaleOrderId);
  if(!row)throw new Error('KEETA_AFTER_SALE_LOCAL_CASE_NOT_FOUND');
  const order=localRuntime.orders().find(item=>item.id===row.canonicalOrderId);
  if(!order)throw new Error('KEETA_AFTER_SALE_LOCAL_ORDER_NOT_FOUND');
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/after-sales/decision?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        providerOrderId:row.providerOrderId,
        canonicalOrderId:row.canonicalOrderId,
        afterSaleOrderId:row.afterSaleOrderId,
        decision,
        ...(decision==='REJECT'?{rejectCode:rejectCode??100000,rejectReason:rejectReason?.trim()||'Merchant rejected refund'}:{}),
      }),
    },
  );
  const body=await response.json().catch(()=>({})) as {state?:string;code?:string};
  if(!response.ok){
    upsertCase(Object.freeze({...row,decisionState:'ATTENTION',decisionCode:body.code||('KEETA_REFUND_DECISION_HTTP_'+response.status),updatedAt:new Date().toISOString()}));
    throw new Error(body.code||'KEETA_REFUND_DECISION_FAILED');
  }
  upsertCase(Object.freeze({
    ...row,
    decisionState:decision==='APPROVE'?'APPROVED':'REJECTED',
    decisionCode:undefined,
    updatedAt:new Date().toISOString(),
  }));
  clearAttention(row.afterSaleOrderId);
  return Object.freeze({state:body.state??'SUCCESS',decision});
}

export async function previewKeetaPartialRefund(
  orderId:string,
  products:readonly {orderProductId:number;refundCount:number}[]=[],
){
  const order=localRuntime.orders().find(row=>row.id===orderId);
  if(!order)throw new Error('ORDER_NOT_FOUND');
  const id=providerId(order);if(!id)throw new Error('KEETA_PROVIDER_ORDER_REQUIRED');
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/partial-refund/preview?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({providerOrderId:id,canonicalOrderId:order.id,products}),
    },
  );
  const body=await response.json().catch(()=>({})) as {state?:string;code?:string;receipt?:unknown;products?:unknown;fingerprint?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_PARTIAL_REFUND_PREVIEW_FAILED');
  return body;
}

export async function applyKeetaPartialRefund(
  orderId:string,
  products:readonly {orderProductId:number;refundCount:number}[],
  partRefundType:200000|200001|200002|200003|200004,
  partRefundReason?:string,
){
  const order=localRuntime.orders().find(row=>row.id===orderId);
  if(!order)throw new Error('ORDER_NOT_FOUND');
  const id=providerId(order);if(!id)throw new Error('KEETA_PROVIDER_ORDER_REQUIRED');
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/partial-refund/apply?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        providerOrderId:id,canonicalOrderId:order.id,products,partRefundType,
        ...(partRefundReason?.trim()?{partRefundReason:partRefundReason.trim()}:{}),
      }),
    },
  );
  const body=await response.json().catch(()=>({})) as {state?:string;code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_PARTIAL_REFUND_APPLY_FAILED');
  return body;
}

let installed=false;
export function installKeetaAfterSales(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='KEETA_AFTER_SALE_AVAILABLE')void reconcileKeetaAfterSales();
  });
  window.addEventListener('online',()=>void reconcileKeetaAfterSales());
  window.addEventListener('focus',()=>void reconcileKeetaAfterSales());
  window.setTimeout(()=>void reconcileKeetaAfterSales(),0);
}
