import {describe,expect,it} from 'vitest';
import {mapCustomerOrderProjection} from '../worker.ts';

const baseOrder={
  orderId:'MFK-INTERNAL-ORDER-7',
  display:'038',
  createdAt:'2026-09-27T08:00:00.000Z',
  updatedAt:'2026-09-27T08:05:00.000Z',
  totalMinor:5800,
  paymentLabel:'CASH',
  customerName:'陳小米',
  pickupCode:'4567',
  fulfillmentLabel:'可取餐',
  items:[{id:'line-1',name:'紫米飯團',qty:2,unitMinor:2900}],
};

describe('Customer UI7 canonical pickup projection',()=>{
  it.each([
    ['ARRIVED','ARRIVED'],
    ['VERIFIED','VERIFIED'],
    ['HANDED_OVER','HANDED_OVER'],
    ['COMPLETED','COMPLETED'],
  ])('projects canonical handover %s as %s',(handoverState,stage)=>{
    expect(mapCustomerOrderProjection({...baseOrder,handoverState}).stage).toBe(stage);
  });

  it('never invents ARRIVED VERIFIED HANDED_OVER or COMPLETED from READY alone',()=>{
    const projected=mapCustomerOrderProjection(baseOrder);
    expect(projected.stage).toBe('READY');
    expect(projected.handoverState).toBeUndefined();
  });

  it('unresolved pickup exception blocks Completed deterministically',()=>{
    const projected=mapCustomerOrderProjection({
      ...baseOrder,
      fulfillmentLabel:'已完成',
      handoverState:'COMPLETED',
      completedAt:'2026-09-27T08:20:00.000Z',
      pickupException:{kind:'MISSING_BAG',resolved:false,detail:'少一袋'},
    });
    expect(projected.stage).toBe('PICKUP_EXCEPTION');
    expect(projected.pickupException).toEqual({
      kind:'MISSING_BAG',resolved:false,detail:'少一袋',
    });
  });

  it('unknown fulfillment fails closed instead of RECEIVED',()=>{
    const projected=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'UNSUPPORTED_STATE'});
    expect(projected.stage).toBe('UNKNOWN');
  });

  it('projects pickup identity name and counts without exposing full phone',()=>{
    const projected=mapCustomerOrderProjection({...baseOrder,pickupBagCount:2,pickupMealCount:2});
    expect(projected.displayCode).toBe('038');
    expect(projected.pickupCode).toBe('4567');
    expect(projected.customerDisplayName).toBe('陳小米');
    expect(projected.pickupBagCount).toBe(2);
    expect(projected.pickupMealCount).toBe(2);
    expect(projected).not.toHaveProperty('customerPhone');
  });

  it('completion time only uses canonical completedAt or canonical completed timeline',()=>{
    const direct=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'已完成',completedAt:'2026-09-27T08:20:00.000Z'});
    expect(direct.completedAt).toBe('2026-09-27T08:20:00.000Z');

    const timeline=mapCustomerOrderProjection({
      ...baseOrder,
      fulfillmentLabel:'已完成',
      fulfillmentHistory:[
        {label:'可取餐',at:'2026-09-27T08:10:00.000Z'},
        {label:'已完成',at:'2026-09-27T08:21:00.000Z'},
      ],
    });
    expect(timeline.completedAt).toBe('2026-09-27T08:21:00.000Z');

    const absent=mapCustomerOrderProjection({...baseOrder,fulfillmentLabel:'已完成',updatedAt:'2026-09-27T09:00:00.000Z'});
    expect(absent).not.toHaveProperty('completedAt');
  });

  it('resolved exception does not block a canonical Completed readback',()=>{
    const projected=mapCustomerOrderProjection({
      ...baseOrder,
      fulfillmentLabel:'已完成',
      handoverState:'COMPLETED',
      completedAt:'2026-09-27T08:20:00.000Z',
      pickupException:{kind:'CODE_MISMATCH',resolved:true},
    });
    expect(projected.stage).toBe('COMPLETED');
  });
});
