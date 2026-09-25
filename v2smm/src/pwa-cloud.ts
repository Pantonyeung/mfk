import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../contracts/smm-lan-v1';
import type {SmmLanTransport,SmmLanTransportOutcome} from './smt-lan-adapter';
import {readSmmStaffSession} from './pwa-staff';

function sleep(ms:number){return new Promise(resolve=>window.setTimeout(resolve,ms));}

function authHeaders(){
  const session=readSmmStaffSession();
  if(!session)return null;
  return{
    'content-type':'application/json',
    'x-mfk-smm-session':session.sessionToken,
  };
}

async function readResult(submissionId:string,signal?:AbortSignal):Promise<Record<string,unknown>|null>{
  const headers=authHeaders();
  if(!headers)return null;
  const response=await fetch('/api/smm/orders/readback?submissionId='+encodeURIComponent(submissionId),{
    method:'GET',
    headers,
    cache:'no-store',
    signal,
  });
  if(response.status===404)return{state:'UNKNOWN'};
  if(response.status===401)return null;
  if(!response.ok)throw new Error('SMM_CLOUD_READBACK_HTTP_'+response.status);
  return await response.json() as Record<string,unknown>;
}

function finalResponse(request:SmmLanOrderRequest,body:Record<string,unknown>):SmmLanOrderResponse|null{
  if(body.state==='CONFIRMED'){
    const orderId=String(body.canonicalOrderId??'').trim();
    if(!orderId)return null;
    return Object.freeze({
      protocolVersion:1,
      type:'smm.lan.order.result.v1',
      requestId:request.requestId,
      submissionId:request.submissionId,
      idempotencyKey:request.idempotencyKey,
      disposition:'ACCEPTED',
      orderId,
      canonicalRevision:1,
    });
  }
  if(body.state==='REJECTED'){
    return Object.freeze({
      protocolVersion:1,
      type:'smm.lan.order.result.v1',
      requestId:request.requestId,
      submissionId:request.submissionId,
      idempotencyKey:request.idempotencyKey,
      disposition:'REJECTED',
      reasonCode:String(body.code||'SMM_CLOUD_REJECTED'),
    });
  }
  return null;
}

export function createPwaCloudTransport():SmmLanTransport{
  return Object.freeze({
    async send(request:SmmLanOrderRequest,signal:AbortSignal):Promise<SmmLanTransportOutcome>{
      const headers=authHeaders();
      if(!headers)return{kind:'UNAVAILABLE'};
      let response:Response;
      try{
        response=await fetch('/api/smm/orders/submit',{
          method:'POST',
          headers,
          body:JSON.stringify(request),
          cache:'no-store',
          signal,
        });
      }catch(error){
        if(error instanceof DOMException&&error.name==='AbortError')return{kind:'UNKNOWN'};
        return{kind:'UNAVAILABLE'};
      }
      if(!response.ok&&response.status!==202){
        const body=await response.json().catch(()=>({})) as Record<string,unknown>;
        const code=String(body.code||('SMM_CLOUD_HTTP_'+response.status));
        return{kind:'RESPONSE',response:Object.freeze({
          protocolVersion:1,type:'smm.lan.order.result.v1',
          requestId:request.requestId,submissionId:request.submissionId,idempotencyKey:request.idempotencyKey,
          disposition:'REJECTED',reasonCode:'HTTP_'+response.status+':'+code,
        })};
      }

      for(let attempt=0;attempt<48;attempt++){
        if(attempt>0)await sleep(250);
        if(signal.aborted)return{kind:'UNKNOWN'};
        const body=await readResult(request.submissionId,signal).catch(()=>null);
        if(!body)continue;
        const final=finalResponse(request,body);
        if(final)return{kind:'RESPONSE',response:final};
      }
      return{kind:'UNKNOWN'};
    },

    async readSubmission(submissionId:string,signal:AbortSignal):Promise<SmmLanSubmissionReadbackResponse|Readonly<{state:'UNAVAILABLE'}>>{
      const body=await readResult(submissionId,signal).catch(()=>null);
      if(!body)return{state:'UNAVAILABLE'};
      if(body.state==='CONFIRMED'){
        return Object.freeze({
          protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'CONFIRMED',
          orderId:String(body.canonicalOrderId||''),canonicalRevision:1,
        });
      }
      if(body.state==='REJECTED'){
        return Object.freeze({
          protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'REJECTED',
          reasonCode:String(body.code||'SMM_CLOUD_REJECTED'),
        });
      }
      return{protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'UNKNOWN'};
    },
  });
}
