import {
  MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
  MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
} from '../../contracts/customer-cloud-v1';
import type {
  CustomerCartLine,
  CustomerCommandResult,
  CustomerPendingIntent,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
  CustomerRuntimePort,
} from './product-types.ts';

const ENDPOINT='https://admin.morefunos.com';
const STORE_ID='MF01';
const REF_KEY='mfk:customer:cloud-submission-refs:v1';

function readSubmissionRefs():string[]{
  try{
    const raw=localStorage.getItem(REF_KEY);
    const value=raw?JSON.parse(raw):[];
    return Array.isArray(value)?value.map(String).filter(Boolean).slice(0,24):[];
  }catch{return[];}
}
function rememberSubmissionRef(submissionId:string){
  try{
    const next=[submissionId,...readSubmissionRefs().filter(id=>id!==submissionId)].slice(0,24);
    localStorage.setItem(REF_KEY,JSON.stringify(next));
  }catch{}
}

function requestId(prefix:string){
  const id=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID()
    :Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  return prefix+id;
}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
async function jsonFetch(path:string,init?:RequestInit){
  const response=await fetch(ENDPOINT+path,{
    cache:'no-store',
    ...init,
    headers:{'content-type':'application/json',...(init?.headers??{})},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  return {response,body};
}
async function jsonFetchWithTimeout(path:string,init:RequestInit|undefined,timeoutMs:number){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await jsonFetch(path,{...init,signal:controller.signal});
  }finally{
    window.clearTimeout(timer);
  }
}
function commandFromReadback(body:Record<string,unknown>):CustomerCommandResult{
  const state=String(body.state||'UNKNOWN');
  if(state==='CONFIRMED'){
    return {
      state:'CONFIRMED',
      message:'店舖已確認收到訂單',
      orderId:typeof body.canonicalOrderId==='string'?body.canonicalOrderId:undefined,
    };
  }
  if(state==='REJECTED'){
    return {
      state:'REJECTED',
      message:typeof body.message==='string'?body.message:'店舖未能接受訂單',
    };
  }
  return {
    state:'UNKNOWN',
    message:'訂單已送出，等待店舖確認；系統唔會自動重送。',
  };
}

const QUOTE_READBACK_INTERVAL_MS=250;
const BACKEND_PROBE_ATTEMPTS=3;
const BACKEND_PROBE_INTERVAL_MS=700;
const BACKEND_PROBE_TIMEOUT_MS=1600;
const BACKEND_PROBE_FRESH_MS=5000;
let lastReachableBackendProbeAt=0;

async function probeOrderBackend(onAttempt?:(attempt:number,total:number)=>void){
  let lastReason='CUSTOMER_SMT_BACKEND_UNAVAILABLE';
  for(let attempt=1;attempt<=BACKEND_PROBE_ATTEMPTS;attempt++){
    onAttempt?.(attempt,BACKEND_PROBE_ATTEMPTS);
    try{
      const {response,body}=await jsonFetchWithTimeout('/api/customer/channel-health?storeId='+STORE_ID,undefined,BACKEND_PROBE_TIMEOUT_MS);
      if(response.ok&&body.reachable===true){
        lastReachableBackendProbeAt=Date.now();
        return Object.freeze({reachable:true,attempts:attempt});
      }
      lastReason=String(body.code||'CUSTOMER_SMT_BACKEND_UNAVAILABLE');
    }catch(error){
      lastReason=error instanceof Error?error.name==='AbortError'?'CUSTOMER_SMT_BACKEND_PROBE_TIMEOUT':error.message:'CUSTOMER_SMT_BACKEND_UNAVAILABLE';
    }
    if(attempt<BACKEND_PROBE_ATTEMPTS)await sleep(BACKEND_PROBE_INTERVAL_MS);
  }
  return Object.freeze({reachable:false,attempts:BACKEND_PROBE_ATTEMPTS,reason:lastReason});
}
// SMT has a 5s fallback reconcile when the realtime doorbell is missed. Keep the
// customer readback window safely beyond that fallback so a healthy local-first
// quote is not abandoned before SMT gets its first polling opportunity.
const QUOTE_READBACK_ATTEMPTS=48;

async function waitQuote(requestIdValue:string):Promise<CustomerQuoteSnapshot>{
  for(let attempt=0;attempt<QUOTE_READBACK_ATTEMPTS;attempt++){
    if(attempt>0)await sleep(QUOTE_READBACK_INTERVAL_MS);
    const {response,body}=await jsonFetch('/api/customer/quote/readback?storeId='+STORE_ID+'&requestId='+encodeURIComponent(requestIdValue));
    if(response.ok&&body.state==='CONFIRMED'){
      const totalMinor=Number(body.totalMinor);
      if(!Number.isSafeInteger(totalMinor)||totalMinor<0)throw new Error('CUSTOMER_QUOTE_TOTAL_INVALID');
      return Object.freeze({
        quoteId:String(body.quoteId||requestIdValue),
        revision:String(body.revision||'UNKNOWN'),
        currency:String(body.currency||'HKD'),
        totalMinor,
        observedAt:String(body.observedAt||new Date().toISOString()),
        freshness:'CURRENT',
      });
    }
    if(response.ok&&body.state==='REJECTED'){
      throw new Error(typeof body.message==='string'?body.message:'購物籃需要重新確認');
    }
    if(response.status!==404&&!response.ok)throw new Error(String(body.code||'CUSTOMER_QUOTE_READBACK_FAILED'));
  }
  throw new Error('店舖暫時未完成報價，請稍後再試');
}

async function waitOrder(submissionId:string):Promise<CustomerCommandResult>{
  for(let attempt=0;attempt<48;attempt++){
    if(attempt>0)await sleep(250);
    const {response,body}=await jsonFetch('/api/customer/orders/readback?storeId='+STORE_ID+'&submissionId='+encodeURIComponent(submissionId));
    if(response.ok){
      const result=commandFromReadback(body);
      if(result.state!=='UNKNOWN')return result;
    }else if(response.status!==404){
      return{state:'UNKNOWN',message:String(body.code||'暫時未能讀回訂單結果')};
    }
  }
  return{state:'UNKNOWN',message:'店舖已收到落單要求，確認仍在處理；請用同一 Submission ID 查詢。'};
}

export async function uploadCustomerPaymentEvidence(file:File):Promise<{evidenceRef:string}>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('付款截圖只支援 JPG、PNG 或 WebP');
  if(file.size<1||file.size>8*1024*1024)throw new Error('付款截圖必須細過 8MB');
  const response=await fetch(ENDPOINT+'/api/customer/payment-evidence?storeId='+STORE_ID,{
    method:'POST',
    headers:{'content-type':file.type},
    body:file,
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||typeof body.evidenceRef!=='string')throw new Error(String(body.code||'付款截圖上載失敗'));
  return{evidenceRef:body.evidenceRef};
}

export function createCloudCustomerRuntimePort():CustomerRuntimePort{
  return Object.freeze({
    portId:'MFK_CUSTOMER_PORT_V1' as const,
    uploadPaymentEvidence:uploadCustomerPaymentEvidence,
    probeOrderBackend,

    async readSnapshot():Promise<CustomerReadModelSnapshot>{
      const params=new URLSearchParams({storeId:STORE_ID});
      for(const submissionId of readSubmissionRefs())params.append('submissionId',submissionId);
      const {response,body}=await jsonFetch('/api/customer/snapshot?'+params.toString());
      if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SNAPSHOT_FAILED'));
      return body as unknown as CustomerReadModelSnapshot;
    },

    async quoteCart(cart:readonly CustomerCartLine[]):Promise<CustomerQuoteSnapshot>{
      const id=requestId('CUSTOMER-QUOTE-');
      const {response,body}=await jsonFetch('/api/customer/quote?storeId='+STORE_ID,{
        method:'POST',
        body:JSON.stringify({
          schema:MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
          storeId:STORE_ID,
          requestId:id,
          createdAt:new Date().toISOString(),
          cart,
        }),
      });
      if(!response.ok&&response.status!==202)throw new Error(String(body.code||'CUSTOMER_QUOTE_SUBMIT_FAILED'));
      return waitQuote(id);
    },

    async submitOrder(intent:CustomerPendingIntent):Promise<CustomerCommandResult>{
      if(Date.now()-lastReachableBackendProbeAt>BACKEND_PROBE_FRESH_MS){
        const health=await probeOrderBackend();
        if(!health.reachable){
          return{state:'NOT_CONNECTED',message:'暫時未能連接店舖接單系統；請改用 WhatsApp 聯絡店舖。'};
        }
      }
      rememberSubmissionRef(intent.submissionId);
      try{
        const {response,body}=await jsonFetchWithTimeout('/api/customer/orders/submit?storeId='+STORE_ID,{
          method:'POST',
          body:JSON.stringify({
            schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
            storeId:STORE_ID,
            submissionId:intent.submissionId,
            menuRevision:intent.menuRevision,
            idempotencyKey:intent.idempotencyKey,
            createdAt:intent.createdAt,
            updatedAt:intent.updatedAt,
            cart:intent.cart,
            checkout:{
              name:intent.checkout.name,
              phone:intent.checkout.phone,
              paymentMethod:intent.checkout.paymentMethod,
              ...(intent.checkout.paymentMethod==='ELECTRONIC'&&intent.checkout.paymentChannelId?{paymentChannelId:intent.checkout.paymentChannelId,paymentChannelLabel:intent.checkout.paymentChannelLabel??''}:{}),
              ...(intent.checkout.paymentMethod==='ELECTRONIC'&&intent.checkout.paymentEvidence?.evidenceRef?{paymentEvidenceRef:intent.checkout.paymentEvidence.evidenceRef}:{}),
            },
          }),
        },5000);
        if(response.status===409)return{state:'FAILED',message:String(body.code||'提交身份衝突')};
        if(!response.ok&&response.status!==202)return{state:'FAILED',message:String(body.code||'未能提交訂單')};
        return waitOrder(intent.submissionId);
      }catch{
        return{state:'UNKNOWN',message:'落單要求可能已送出；系統會先讀回原本結果，請勿重複提交。'};
      }
    },

    async readSubmission(submissionId:string):Promise<CustomerCommandResult>{
      rememberSubmissionRef(submissionId);
      const {response,body}=await jsonFetch('/api/customer/orders/readback?storeId='+STORE_ID+'&submissionId='+encodeURIComponent(submissionId));
      if(response.status===404)return{state:'UNKNOWN',message:'店舖仍未回覆呢個提交身份'};
      if(!response.ok)return{state:'UNKNOWN',message:String(body.code||'暫時未能讀回訂單結果')};
      return commandFromReadback(body);
    },
  });
}
