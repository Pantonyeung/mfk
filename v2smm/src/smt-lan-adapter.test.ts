import {describe,expect,it} from 'vitest';
import {createSmmLanOrderAdapter} from './smt-lan-adapter.ts';

const intent={
  submissionId:'SUB-1',idempotencyKey:'IDEM-1',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),state:'PENDING' as const,
  cart:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,selections:[],createdAt:new Date().toISOString()}],
};

describe('SMM SMT LAN adapter',()=>{
  it('maps matching ACCEPTED response to CONFIRMED',async()=>{
    const adapter=createSmmLanOrderAdapter({send:async request=>({kind:'RESPONSE',response:{
      protocolVersion:1,type:'smm.lan.order.result.v1',requestId:request.requestId,submissionId:request.submissionId,idempotencyKey:request.idempotencyKey,
      disposition:'ACCEPTED',orderId:'ORDER-1',canonicalRevision:1,
    }})});
    await expect(adapter.submitOrder(intent)).resolves.toMatchObject({state:'CONFIRMED',orderId:'ORDER-1'});
  });

  it('treats mismatched response identity as UNKNOWN and never claims success',async()=>{
    const adapter=createSmmLanOrderAdapter({send:async request=>({kind:'RESPONSE',response:{
      protocolVersion:1,type:'smm.lan.order.result.v1',requestId:'WRONG',submissionId:request.submissionId,idempotencyKey:request.idempotencyKey,
      disposition:'ACCEPTED',orderId:'ORDER-1',canonicalRevision:1,
    }})});
    await expect(adapter.submitOrder(intent)).resolves.toMatchObject({state:'UNKNOWN'});
  });

  it('uses exact submission readback after uncertain transport',async()=>{
    const adapter=createSmmLanOrderAdapter({
      send:async()=>({kind:'UNKNOWN'}),
      readSubmission:async submissionId=>({protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'CONFIRMED',orderId:'ORDER-1',canonicalRevision:1}),
    });
    await expect(adapter.readSubmission('SUB-1')).resolves.toMatchObject({state:'CONFIRMED',orderId:'ORDER-1'});
  });
});
