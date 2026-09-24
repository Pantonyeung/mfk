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

async function waitQuote(requestIdValue:string):Promise<CustomerQuoteSnapshot>{
  for(let attempt=0;attempt<12;attempt++){
    if(attempt>0)await sleep(250);
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

export function createCloudCustomerRuntimePort():CustomerRuntimePort{
  return Object.freeze({
    portId:'MFK_CUSTOMER_PORT_V1' as const,

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
      rememberSubmissionRef(intent.submissionId);
      const {response,body}=await jsonFetch('/api/customer/orders/submit?storeId='+STORE_ID,{
        method:'POST',
        body:JSON.stringify({
          schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
          storeId:STORE_ID,
          submissionId:intent.submissionId,
          idempotencyKey:intent.idempotencyKey,
          createdAt:intent.createdAt,
          updatedAt:intent.updatedAt,
          cart:intent.cart,
          checkout:intent.checkout,
        }),
      });
      if(response.status===409)return{state:'FAILED',message:String(body.code||'提交身份衝突')};
      if(!response.ok&&response.status!==202)return{state:'FAILED',message:String(body.code||'未能提交訂單')};
      return{state:'UNKNOWN',message:'訂單已送出，等待店舖確認；如結果未明請使用同一 Submission ID 查詢。'};
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
