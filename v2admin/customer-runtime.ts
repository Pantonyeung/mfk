import {
  validateMfkCustomerOrderIntent,
  validateMfkCustomerQuoteRequest,
} from '../contracts/customer-cloud-v1.ts';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});}
function record(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const out=value.trim();
  if(!out||out.length>max)throw new Error(code);
  return out;
}
function instant(value:unknown,code:string){
  const out=text(value,code,80);
  if(!Number.isFinite(Date.parse(out)))throw new Error(code);
  return out;
}
function stable(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}

export class CustomerRuntimeStore{
  state:any;
  env:any;
  constructor(state:any,env:any){this.state=state;this.env=env;}

  async pending(prefix:string){
    const rows=await this.state.storage.list({prefix});
    return [...rows.values()]
      .filter((row:any)=>row?.state==='PENDING_SMT')
      .sort((a:any,b:any)=>String(a.receivedAt||a.createdAt||'').localeCompare(String(b.receivedAt||b.createdAt||'')))
      .slice(0,50);
  }

  async fetch(request:Request){
    const url=new URL(request.url);

    if(url.pathname==='/public/quote'&&request.method==='POST'){
      let quote;
      try{quote=validateMfkCustomerQuoteRequest(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'CUSTOMER_QUOTE_INVALID'},400);}
      const key='quote:'+quote.requestId;
      const existing=await this.state.storage.get(key) as any;
      const fingerprint=stable(quote);
      if(existing){
        if(existing.requestFingerprint!==fingerprint)return json({code:'CUSTOMER_QUOTE_ID_CONFLICT'},409);
        return json({state:existing.state,requestId:quote.requestId,message:'同一報價要求已存在'});
      }
      await this.state.storage.put(key,Object.freeze({
        ...quote,
        requestFingerprint:fingerprint,
        state:'PENDING_SMT',
        receivedAt:new Date().toISOString(),
      }));
      return json({state:'PENDING',requestId:quote.requestId},202);
    }

    if(url.pathname==='/public/quote/readback'&&request.method==='GET'){
      const requestId=(url.searchParams.get('requestId')||'').trim();
      if(!requestId)return json({code:'CUSTOMER_QUOTE_REQUEST_ID_REQUIRED'},400);
      const row=await this.state.storage.get('quote:'+requestId) as any;
      if(!row)return json({state:'UNKNOWN',requestId},404);
      return json({
        state:row.state,
        requestId,
        ...(row.state==='CONFIRMED'?{
          quoteId:row.quoteId,
          revision:row.revision,
          currency:row.currency,
          totalMinor:row.totalMinor,
          observedAt:row.observedAt,
        }:{}),
        ...(row.state==='REJECTED'?{code:row.code,message:row.message}:{}),
      });
    }

    if(url.pathname==='/public/orders/submit'&&request.method==='POST'){
      let intent;
      try{intent=validateMfkCustomerOrderIntent(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'CUSTOMER_ORDER_INTENT_INVALID'},400);}
      const key='order:'+intent.submissionId;
      const fingerprint=stable(intent);
      const existing=await this.state.storage.get(key) as any;
      if(existing){
        if(existing.idempotencyKey!==intent.idempotencyKey||existing.intentFingerprint!==fingerprint){
          return json({code:'CUSTOMER_SUBMISSION_ID_CONFLICT'},409);
        }
        return json({state:existing.state,submissionId:intent.submissionId,message:'同一提交身份已存在'});
      }
      await this.state.storage.put(key,Object.freeze({
        ...intent,
        intentFingerprint:fingerprint,
        state:'PENDING_SMT',
        receivedAt:new Date().toISOString(),
      }));
      return json({state:'PENDING',submissionId:intent.submissionId},202);
    }

    if(url.pathname==='/public/orders/readback'&&request.method==='GET'){
      const submissionId=(url.searchParams.get('submissionId')||'').trim();
      if(!submissionId)return json({code:'CUSTOMER_SUBMISSION_ID_REQUIRED'},400);
      const row=await this.state.storage.get('order:'+submissionId) as any;
      if(!row)return json({state:'UNKNOWN',submissionId},404);
      return json({
        state:row.state,
        submissionId,
        ...(row.state==='CONFIRMED'?{
          canonicalOrderId:row.canonicalOrderId,
          canonicalDisplay:row.canonicalDisplay,
          committedAt:row.committedAt,
          totalMinor:row.totalMinor,
        }:{}),
        ...(row.state==='REJECTED'?{code:row.code,message:row.message}:{}),
      });
    }

    if(url.pathname==='/smt/quotes/pending'&&request.method==='GET'){
      return json({quotes:await this.pending('quote:')});
    }

    if(url.pathname==='/smt/quotes/ack'&&request.method==='POST'){
      let body:Record<string,unknown>;
      try{body=record(await request.json(),'CUSTOMER_QUOTE_ACK_INVALID');}
      catch(error){return json({code:error instanceof Error?error.message:'CUSTOMER_QUOTE_ACK_INVALID'},400);}
      const requestId=text(body.requestId,'CUSTOMER_QUOTE_REQUEST_ID_REQUIRED',160);
      const key='quote:'+requestId;
      const current=await this.state.storage.get(key) as any;
      if(!current)return json({code:'CUSTOMER_QUOTE_NOT_FOUND'},404);
      if(current.state!=='PENDING_SMT')return json({state:'IDEMPOTENT',quote:current});
      const state=body.state==='CONFIRMED'?'CONFIRMED':body.state==='REJECTED'?'REJECTED':null;
      if(!state)return json({code:'CUSTOMER_QUOTE_ACK_STATE_INVALID'},400);
      const next=Object.freeze({
        ...current,
        state,
        resolvedAt:new Date().toISOString(),
        ...(state==='CONFIRMED'?{
          quoteId:text(body.quoteId,'CUSTOMER_QUOTE_ID_REQUIRED',180),
          revision:text(body.revision,'CUSTOMER_QUOTE_REVISION_REQUIRED',180),
          currency:text(body.currency,'CUSTOMER_QUOTE_CURRENCY_REQUIRED',16),
          totalMinor:Number(body.totalMinor),
          observedAt:instant(body.observedAt,'CUSTOMER_QUOTE_OBSERVED_AT_INVALID'),
        }:{
          code:typeof body.code==='string'?body.code:'CUSTOMER_QUOTE_REJECTED',
          message:typeof body.message==='string'?body.message:'暫時未能報價',
        }),
      });
      if(state==='CONFIRMED'&&(!Number.isSafeInteger(next.totalMinor)||next.totalMinor<0))return json({code:'CUSTOMER_QUOTE_TOTAL_INVALID'},400);
      await this.state.storage.put(key,next);
      return json({state:'ACKED'});
    }

    if(url.pathname==='/smt/orders/pending'&&request.method==='GET'){
      return json({orders:await this.pending('order:')});
    }

    if(url.pathname==='/smt/orders/ack'&&request.method==='POST'){
      let body:Record<string,unknown>;
      try{body=record(await request.json(),'CUSTOMER_ORDER_ACK_INVALID');}
      catch(error){return json({code:error instanceof Error?error.message:'CUSTOMER_ORDER_ACK_INVALID'},400);}
      const submissionId=text(body.submissionId,'CUSTOMER_SUBMISSION_ID_REQUIRED',180);
      const key='order:'+submissionId;
      const current=await this.state.storage.get(key) as any;
      if(!current)return json({code:'CUSTOMER_ORDER_NOT_FOUND'},404);
      if(current.state!=='PENDING_SMT')return json({state:'IDEMPOTENT',order:current});
      if(String(body.idempotencyKey||'')!==String(current.idempotencyKey))return json({code:'CUSTOMER_IDEMPOTENCY_KEY_MISMATCH'},409);
      const state=body.state==='CONFIRMED'?'CONFIRMED':body.state==='REJECTED'?'REJECTED':null;
      if(!state)return json({code:'CUSTOMER_ORDER_ACK_STATE_INVALID'},400);
      const next=Object.freeze({
        ...current,
        state,
        resolvedAt:new Date().toISOString(),
        ...(state==='CONFIRMED'?{
          canonicalOrderId:text(body.canonicalOrderId,'CUSTOMER_CANONICAL_ORDER_ID_REQUIRED',180),
          canonicalDisplay:text(body.canonicalDisplay,'CUSTOMER_CANONICAL_DISPLAY_REQUIRED',80),
          committedAt:instant(body.committedAt,'CUSTOMER_COMMITTED_AT_INVALID'),
          totalMinor:Number(body.totalMinor),
        }:{
          code:typeof body.code==='string'?body.code:'CUSTOMER_ORDER_REJECTED',
          message:typeof body.message==='string'?body.message:'店舖未能接受訂單',
        }),
      });
      if(state==='CONFIRMED'&&(!Number.isSafeInteger(next.totalMinor)||next.totalMinor<0))return json({code:'CUSTOMER_ORDER_TOTAL_INVALID'},400);
      await this.state.storage.put(key,next);
      return json({state:'ACKED'});
    }

    return json({code:'NOT_FOUND'},404);
  }
}
