import type {SmmCartLine,SmmCommandResult,SmmPendingIntent} from './product-types';
import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../contracts/smm-lan-v1';

export type SmmLanTransportOutcome=
  |Readonly<{kind:'RESPONSE';response:SmmLanOrderResponse}>
  |Readonly<{kind:'UNAVAILABLE'}>
  |Readonly<{kind:'UNKNOWN'}>;

export interface SmmLanTransport{
  send(request:SmmLanOrderRequest,signal:AbortSignal):Promise<SmmLanTransportOutcome>;
  readSubmission?(submissionId:string,signal:AbortSignal):Promise<SmmLanSubmissionReadbackResponse|Readonly<{state:'UNAVAILABLE'}>>;
}

function requestId(intent:SmmPendingIntent){return 'SMM-'+intent.submissionId;}
function lines(cart:readonly SmmCartLine[]){
  return Object.freeze(cart.map(line=>Object.freeze({
    lineId:line.lineId,
    productId:line.productId,
    productName:line.productName,
    quantity:line.quantity,
    ...(line.selectedVariationId?{selectedVariationId:line.selectedVariationId}:{}),
    ...(line.selectedVariationName?{selectedVariationName:line.selectedVariationName}:{}),
    selections:Object.freeze(line.selections.map(option=>Object.freeze({...option}))),
  })));
}

export function createSmmLanOrderAdapter(transport:SmmLanTransport,timeoutMs=3000){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('SMM_LAN_TIMEOUT_INVALID');

  async function withTimeout<T>(work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
    const controller=new AbortController();
    let timer:number|undefined;
    try{
      return await Promise.race([
        work(controller.signal),
        new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>{controller.abort();reject(new Error('SMM_LAN_TIMEOUT'));},timeoutMs);}),
      ]);
    }finally{if(timer!==undefined)window.clearTimeout(timer);}
  }

  return Object.freeze({
    async submitOrder(intent:SmmPendingIntent):Promise<SmmCommandResult>{
      const req:SmmLanOrderRequest=Object.freeze({
        protocolVersion:1,
        type:'smm.lan.order.submit.v1',
        requestId:requestId(intent),
        submissionId:intent.submissionId,
        idempotencyKey:intent.idempotencyKey,
        storeId:'MF01',
        menuRevision:intent.menuRevision,
        publishedTotalMinor:intent.publishedTotalMinor,
        serviceMode:intent.checkout.serviceMode,
        tender:intent.checkout.tender,
        lines:lines(intent.cart),
      });
      try{
        const outcome=await withTimeout(signal=>transport.send(req,signal));
        if(outcome.kind==='UNAVAILABLE')return Object.freeze({state:'NOT_CONNECTED',message:'暫時未能連接主機'});
        if(outcome.kind==='UNKNOWN')return Object.freeze({state:'UNKNOWN',message:'結果未確認，請重新查詢原本提交'});
        const response=outcome.response;
        const same=response.requestId===req.requestId&&response.submissionId===req.submissionId&&response.idempotencyKey===req.idempotencyKey;
        if(!same)return Object.freeze({state:'UNKNOWN',message:'回覆身份不一致，唔會重新落單'});
        if(response.disposition==='REJECTED')return Object.freeze({state:'REJECTED',message:response.reasonCode});
        return Object.freeze({state:'CONFIRMED',message:'訂單已建立',orderId:response.orderId,canonicalRevision:response.canonicalRevision});
      }catch{
        return Object.freeze({state:'UNKNOWN',message:'連線中斷，結果未確認；請查詢原本提交'});
      }
    },
    async readSubmission(submissionId:string):Promise<SmmCommandResult>{
      if(!transport.readSubmission)return Object.freeze({state:'UNKNOWN',message:'原提交結果暫時未能查詢'});
      try{
        const result=await withTimeout(signal=>transport.readSubmission!(submissionId,signal));
        if('state'in result&&result.state==='UNAVAILABLE')return Object.freeze({state:'NOT_CONNECTED',message:'暫時未能連接主機'});
        if(result.state==='UNKNOWN')return Object.freeze({state:'UNKNOWN',message:'原提交結果仍未確認'});
        if(result.state==='REJECTED')return Object.freeze({state:'REJECTED',message:result.reasonCode});
        return Object.freeze({state:'CONFIRMED',message:'訂單已建立',orderId:result.orderId,canonicalRevision:result.canonicalRevision});
      }catch{
        return Object.freeze({state:'UNKNOWN',message:'原提交結果暫時未能確認'});
      }
    },
  });
}
