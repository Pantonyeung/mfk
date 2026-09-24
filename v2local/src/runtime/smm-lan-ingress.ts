import type {MfkLocalRuntime} from './local-runtime.ts';
import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../../contracts/smm-lan-v1.ts';

const RESULT_KEY='mfk.v2local.smm-lan-results.v1';
const DEVICE_KEY='mfk.v2local.smm-trusted-devices.v1';

interface StoredResult{readonly submissionId:string;readonly orderId:string;readonly canonicalRevision:number;readonly idempotencyKey:string;readonly requestId:string}

function results():StoredResult[]{
  try{const value=JSON.parse(localStorage.getItem(RESULT_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[]}
}
function writeResults(rows:readonly StoredResult[]){localStorage.setItem(RESULT_KEY,JSON.stringify(rows.slice(-2000)));}
function trustedDevices():Set<string>{
  try{const value=JSON.parse(localStorage.getItem(DEVICE_KEY)||'[]');return new Set(Array.isArray(value)?value.map(String):[]);}catch{return new Set()}
}
export function trustSmmDevice(deviceId:string){
  const id=String(deviceId||'').trim();if(!id)throw new Error('SMM_DEVICE_ID_REQUIRED');
  const set=trustedDevices();set.add(id);localStorage.setItem(DEVICE_KEY,JSON.stringify([...set]));return id;
}
function rejected(req:SmmLanOrderRequest,reasonCode:string):SmmLanOrderResponse{
  return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:req.requestId,submissionId:req.submissionId,idempotencyKey:req.idempotencyKey,disposition:'REJECTED',reasonCode});
}
export function createSmmLanIngress(runtime:MfkLocalRuntime){
  return Object.freeze({
    submit(input:SmmLanOrderRequest,context:{deviceId:string}):SmmLanOrderResponse{
      if(input.protocolVersion!==1||input.type!=='smm.lan.order.submit.v1')throw new Error('SMM_LAN_PROTOCOL_INVALID');
      if(input.storeId!=='MF01')return rejected(input,'SMM_LAN_STORE_MISMATCH');
      if(!trustedDevices().has(String(context.deviceId||'')))return rejected(input,'SMM_LAN_DEVICE_NOT_TRUSTED');
      if(!input.lines.length)return rejected(input,'SMM_LAN_LINES_REQUIRED');
      const prior=results().find(row=>row.submissionId===input.submissionId);
      if(prior){
        if(prior.idempotencyKey!==input.idempotencyKey)return rejected(input,'SMM_LAN_IDEMPOTENCY_CONFLICT');
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:prior.orderId,canonicalRevision:prior.canonicalRevision});
      }
      // No pricing is performed here. Current SMT Store Kernel remains the only
      // place allowed to turn the intent into a formal Order.
      const order=runtime.createOrder({
        items:input.lines.map(line=>({id:line.productId,name:line.productName,qty:line.quantity,unitMinor:0,detail:line.selections.map(x=>x.optionName).join('／')})),
        totalMinor:0,
        paymentLabel:'待結帳',
        sourceLabel:'SMM',
        providerRef:'SMM:'+input.submissionId,
        initialFulfillmentLabel:'待處理',
      });
      const canonicalRevision=1;
      writeResults([...results(),{submissionId:input.submissionId,orderId:order.id,canonicalRevision,idempotencyKey:input.idempotencyKey,requestId:input.requestId}]);
      return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:order.id,canonicalRevision});
    },
    readSubmission(submissionId:string):SmmLanSubmissionReadbackResponse{
      const prior=results().find(row=>row.submissionId===submissionId);
      return prior
        ?Object.freeze({protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'CONFIRMED',orderId:prior.orderId,canonicalRevision:prior.canonicalRevision})
        :Object.freeze({protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'UNKNOWN'});
    },
  });
}
