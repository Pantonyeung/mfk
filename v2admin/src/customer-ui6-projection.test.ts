import {describe,expect,it} from 'vitest';
import {mapCustomerOrderProjection} from '../worker.ts';

const baseOrder={
  orderId:'MFK-INTERNAL-ORDER-1',
  display:'038',
  createdAt:'2026-09-27T07:00:00.000Z',
  updatedAt:'2026-09-27T07:05:00.000Z',
  totalMinor:5800,
  paymentLabel:'CASH',
  customerPhone:'91234567',
  items:[{id:'line-1',name:'紫米飯團',qty:1,unitMinor:5800}],
};

describe('Customer UI6 canonical order projection',()=>{
  it.each([
    ['待處理','RECEIVED'],
    ['等待店舖確認','RECEIVED'],
    ['已接單','ACCEPTED'],
    ['進行中','PREPARING'],
    ['製作中','PREPARING'],
    ['稍有延誤','DELAYED'],
    ['可取餐','READY'],
    ['未能接單','REJECTED'],
    ['已拒絕','REJECTED'],
    ['已取消','CANCELED'],
  ])('maps canonical fulfillment label %s to %s',(fulfillmentLabel,stage)=>{
    expect(mapCustomerOrderProjection({...baseOrder,fulfillmentLabel}).stage).toBe(stage);
  });

  it('keeps Display Number, Pickup Code and internal Order ID as separate identities',()=>{
    const projected=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'待處理'});
    expect(projected.displayCode).toBe('038');
    expect(projected.pickupCode).toBe('4567');
    expect(projected.orderId).toBe('MFK-INTERNAL-ORDER-1');
    expect(projected.displayCode).not.toBe(projected.pickupCode);
    expect(projected.orderId).not.toBe(projected.displayCode);
  });

  it('passes through canonical ETA only when the projection actually carries one',()=>{
    const noEta=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'進行中'});
    expect(noEta.stage).toBe('PREPARING');
    expect(noEta).not.toHaveProperty('etaLabel');

    const delayed=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'稍有延誤',etaLabel:'12:25'});
    expect(delayed.stage).toBe('DELAYED');
    expect(delayed.etaLabel).toBe('12:25');
  });

  it('does not infer delayed state from elapsed time',()=>{
    const projected=mapCustomerOrderProjection({
      ...baseOrder,
      fulfillmentLabel:'進行中',
      createdAt:'2026-09-01T00:00:00.000Z',
      updatedAt:'2026-09-27T07:05:00.000Z',
    });
    expect(projected.stage).toBe('PREPARING');
  });

  it('keeps reject and cancel distinct and projects only canonical reasons',()=>{
    const rejected=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'未能接單',rejectionReason:'暫時未能接單'});
    const canceled=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'已取消',cancellationReason:'店舖取消'});
    expect(rejected.stage).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('暫時未能接單');
    expect(canceled.stage).toBe('CANCELED');
    expect(canceled.rejectionReason).toBe('店舖取消');
  });

  it('projects payment wording only from canonical payment facts',()=>{
    expect(mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'進行中',paymentVerificationState:'PENDING'}).paymentStatusLabel).toBe('付款憑證待店舖核對');
    expect(mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'進行中',paymentVerificationState:'VERIFIED'}).paymentStatusLabel).toBe('付款憑證已核對');
    expect(mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'進行中',paymentLabel:'FPS'}).paymentStatusLabel).toBe('FPS');
  });
});
