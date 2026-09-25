import type {MfkLocalRuntime} from './local-runtime.ts';
import {priceCustomerCart} from './customer-cloud-intake.ts';
import {projectSyncedOrderingCatalog} from './admin-config-projection.ts';
import {readSmtAdminConfigLkg} from './admin-config-sync.ts';
import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../../contracts/smm-lan-v1.ts';

const RESULT_KEY='mfk.v2local.smm-lan-results.v1';

interface StoredResult{readonly submissionId:string;readonly orderId:string;readonly canonicalRevision:number;readonly idempotencyKey:string;readonly requestId:string}

function results():StoredResult[]{
  try{const value=JSON.parse(localStorage.getItem(RESULT_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[]}
}
function writeResults(rows:readonly StoredResult[]){localStorage.setItem(RESULT_KEY,JSON.stringify(rows.slice(-2000)));}
function rejected(req:SmmLanOrderRequest,reasonCode:string):SmmLanOrderResponse{
  return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:req.requestId,submissionId:req.submissionId,idempotencyKey:req.idempotencyKey,disposition:'REJECTED',reasonCode});
}
export function createSmmLanIngress(runtime:MfkLocalRuntime){
  return Object.freeze({
    submit(input:SmmLanOrderRequest,context:{deviceId:string;trusted:boolean}):SmmLanOrderResponse{
      if(input.protocolVersion!==1||input.type!=='smm.lan.order.submit.v1')throw new Error('SMM_LAN_PROTOCOL_INVALID');
      if(input.storeId!=='MF01')return rejected(input,'SMM_LAN_STORE_MISMATCH');
      if(!context.trusted||!String(context.deviceId||'').trim())return rejected(input,'SMM_LAN_DEVICE_NOT_TRUSTED');
      if(!input.lines.length)return rejected(input,'SMM_LAN_LINES_REQUIRED');
      const prior=results().find(row=>row.submissionId===input.submissionId);
      if(prior){
        if(prior.idempotencyKey!==input.idempotencyKey)return rejected(input,'SMM_LAN_IDEMPOTENCY_CONFLICT');
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:prior.orderId,canonicalRevision:prior.canonicalRevision});
      }
      // Recover the same canonical Order if the process stopped after Store
      // Kernel commit but before the SMM result journal was written.
      const providerRef='SMM:'+input.submissionId;
      const recovered=runtime.orders().find(order=>order.providerRef===providerRef);
      if(recovered){
        const canonicalRevision=1;
        writeResults([...results(),{submissionId:input.submissionId,orderId:recovered.id,canonicalRevision,idempotencyKey:input.idempotencyKey,requestId:input.requestId}]);
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:recovered.id,canonicalRevision});
      }

      const envelope=readSmtAdminConfigLkg();
      if(!envelope)return rejected(input,'SMM_ADMIN_CONFIG_REQUIRED');
      const catalog=projectSyncedOrderingCatalog('takeaway',envelope);
      const priced=priceCustomerCart(input.lines.map(line=>Object.freeze({
        lineId:line.lineId,
        productId:line.productId,
        productName:line.productName,
        quantity:line.quantity,
        ...(line.selectedVariationId?{selectedVariationId:line.selectedVariationId}:{}),
        ...(line.selectedVariationName?{selectedVariationName:line.selectedVariationName}:{}),
        selections:line.selections,
        createdAt:new Date().toISOString(),
      })),catalog.products);

      const order=runtime.createOrder({
        items:priced.items,
        totalMinor:priced.totalMinor,
        paymentLabel:'待結帳',
        sourceLabel:'SMM',
        providerRef,
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
