import {
  validateMfkCustomerOrderIntent,
} from '../contracts/customer-cloud-v1.ts';
import {validateMfkCustomerCommercialGrant} from '../contracts/customer-commercial-freshness-v1.ts';
import {validateSmmLanOrderRequest} from '../contracts/smm-lan-v1.ts';

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

    if(url.pathname==='/public/events'){
      if(request.headers.get('upgrade')!=='websocket')return json({code:'WEBSOCKET_REQUIRED'},426);
      const pair=new WebSocketPair();
      const client=pair[0],server=pair[1];
      this.state.acceptWebSocket(server);
      const head=await this.state.storage.get('config:head');
      if(head)server.send(JSON.stringify(head));
      return new Response(null,{status:101,webSocket:client});
    }

    if(url.pathname==='/internal/config-doorbell'&&request.method==='POST'){
      const body=record(await request.json().catch(()=>({})),'CUSTOMER_CONFIG_DOORBELL_INVALID');
      if(body.type!=='PORT_HEAD_AVAILABLE'||body.port!=='CUSTOMER')return json({code:'CUSTOMER_CONFIG_DOORBELL_TYPE_INVALID'},400);
      const event=Object.freeze({
        type:'PORT_HEAD_AVAILABLE',
        port:'CUSTOMER',
        storeId:String(body.storeId||'MF01'),
        headSeq:Number(body.headSeq)||0,
        sourceCommitSeq:Number(body.sourceCommitSeq)||0,
        projectionHash:String(body.projectionHash||''),
        publishedAt:String(body.publishedAt||new Date().toISOString()),
      });
      await this.state.storage.put('config:head',event);
      for(const socket of this.state.getWebSockets()){try{socket.send(JSON.stringify(event));}catch{}}
      return json({state:'DOORBELL_SENT',headSeq:event.headSeq});
    }

    if(url.pathname==='/public/channel-health'&&request.method==='GET'){
      const lastOrderPull=await this.state.storage.get('diag:lastOrderPull') as any;
      const observedAt=new Date().toISOString();
      const lastAt=lastOrderPull&&typeof lastOrderPull.at==='string'?Date.parse(lastOrderPull.at):NaN;
      const ageMs=Number.isFinite(lastAt)?Math.max(0,Date.now()-lastAt):null;
      const reachable=ageMs!==null&&ageMs<=15000;
      return json({
        reachable,
        ageMs,
        lastOrderPull:lastOrderPull??null,
        observedAt,
      },200);
    }

    if(url.pathname==='/internal/orders/submit'&&request.method==='POST'){
      let intent,commercialGrant;
      try{
        const body=record(await request.json(),'CUSTOMER_VERIFIED_ORDER_INVALID');
        intent=validateMfkCustomerOrderIntent(body.intent);
        commercialGrant=validateMfkCustomerCommercialGrant(body.commercialGrant);
        if(commercialGrant.storeId!==intent.storeId||commercialGrant.submissionId!==intent.submissionId||commercialGrant.customerPortSeq!==intent.customerPortSeq||commercialGrant.projectionHash!==intent.projectionHash||commercialGrant.canonicalRevision!==intent.canonicalRevision)throw new Error('CUSTOMER_COMMERCIAL_GRANT_IDENTITY_MISMATCH');
        if(commercialGrant.lines.length!==intent.cart.length)throw new Error('CUSTOMER_COMMERCIAL_GRANT_CART_MISMATCH');
        for(const line of intent.cart){
          const grantLine=commercialGrant.lines.find(value=>value.lineId===line.lineId);
          if(!grantLine||grantLine.productId!==line.productId||grantLine.quantity!==line.quantity||grantLine.publishedUnitPriceMinor!==line.publishedUnitPriceMinor)throw new Error('CUSTOMER_COMMERCIAL_GRANT_CART_MISMATCH');
        }
      }
      catch(error){return json({code:error instanceof Error?error.message:'CUSTOMER_ORDER_INTENT_INVALID'},400);}
      const key='order:'+intent.submissionId;
      const existing=await this.state.storage.get(key) as any;
      const fingerprint=stable(intent);
      if(existing){
        if(existing.idempotencyKey!==intent.idempotencyKey||existing.intentFingerprint!==fingerprint){
          return json({code:'CUSTOMER_SUBMISSION_ID_CONFLICT'},409);
        }
        return json({state:existing.state,submissionId:intent.submissionId,message:'同一提交身份已存在'});
      }
      const row=Object.freeze({
        ...intent,
        commercialGrant,
        bridgeKind:'CUSTOMER' as const,
        intentFingerprint:fingerprint,
        state:'PENDING_SMT',
        receivedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,row);
      return json({state:'PENDING',submissionId:intent.submissionId},202);
    }

    if(url.pathname==='/public/staff-orders/submit'&&request.method==='POST'){
      let body:Record<string,unknown>;
      try{body=record(await request.json(),'SMM_STAFF_ORDER_ENVELOPE_INVALID');}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_STAFF_ORDER_ENVELOPE_INVALID'},400);}
      let orderRequest;
      try{orderRequest=validateSmmLanOrderRequest(body.request);}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_STAFF_ORDER_INVALID'},400);}
      let staff:Record<string,unknown>;
      try{staff=record(body.staff,'SMM_STAFF_IDENTITY_INVALID');}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_STAFF_IDENTITY_INVALID'},400);}
      const staffId=text(staff.staffId,'SMM_STAFF_ID_REQUIRED',120);
      const displayName=text(staff.displayName,'SMM_STAFF_NAME_REQUIRED',160);
      const role=typeof staff.role==='string'?staff.role.trim().slice(0,40):'STAFF';
      const key='order:'+orderRequest.submissionId;
      const fingerprint=stable({orderRequest,staff:{staffId,displayName,role}});
      const existing=await this.state.storage.get(key) as any;
      if(existing){
        if(existing.idempotencyKey!==orderRequest.idempotencyKey||existing.intentFingerprint!==fingerprint){
          return json({code:'SMM_SUBMISSION_ID_CONFLICT'},409);
        }
        return json({state:existing.state,submissionId:orderRequest.submissionId,message:'同一員工提交身份已存在'});
      }
      const row=Object.freeze({
        bridgeKind:'SMM_STAFF' as const,
        request:orderRequest,
        staff:Object.freeze({staffId,displayName,role}),
        submissionId:orderRequest.submissionId,
        idempotencyKey:orderRequest.idempotencyKey,
        intentFingerprint:fingerprint,
        state:'PENDING_SMT',
        receivedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,row);
      await this.state.storage.put('diag:lastStaffOrderSubmit',{
        submissionId:orderRequest.submissionId,
        staffId,
        receivedAt:row.receivedAt,
      });
      return json({state:'PENDING',submissionId:orderRequest.submissionId},202);
    }

    if(url.pathname==='/public/staff-orders/readback'&&request.method==='GET'){
      const submissionId=(url.searchParams.get('submissionId')||'').trim();
      if(!submissionId)return json({code:'SMM_SUBMISSION_ID_REQUIRED'},400);
      const row=await this.state.storage.get('order:'+submissionId) as any;
      if(!row||row.bridgeKind!=='SMM_STAFF')return json({state:'UNKNOWN',submissionId},404);
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

    if(url.pathname==='/smt/diagnostics'&&request.method==='GET'){
      const orders=await this.pending('order:');
      return json({
        pendingOrders:orders.length,
        lastOrderPull:await this.state.storage.get('diag:lastOrderPull')??null,
        lastStaffOrderSubmit:await this.state.storage.get('diag:lastStaffOrderSubmit')??null,
        observedAt:new Date().toISOString(),
      });
    }

    if(url.pathname==='/smt/orders/pending'&&request.method==='GET'){
      const orders=await this.pending('order:');
      await this.state.storage.put('diag:lastOrderPull',{
        count:orders.length,
        at:new Date().toISOString(),
        submissionIds:orders.slice(0,5).map((row:any)=>String(row.submissionId||'')),
      });
      return json({orders});
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
      return json({state:'ACKED',order:next});
    }

    return json({code:'NOT_FOUND'},404);
  }
}
