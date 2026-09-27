import {describe,expect,it} from 'vitest';
import {mapCustomerOrderProjection} from '../worker.ts';

const baseOrder={
  orderId:'MFK-OLD-ORDER-8',
  display:'038',
  createdAt:'2026-09-27T09:00:00.000Z',
  updatedAt:'2026-09-27T09:20:00.000Z',
  completedAt:'2026-09-27T09:20:00.000Z',
  totalMinor:4800,
  paymentLabel:'CASH',
  fulfillmentLabel:'已完成',
  pickupCode:'4567',
  customerName:'陳小米',
  items:[{id:'bento',name:'肉燥便當',qty:1,unitMinor:4800,detail:'加飯'}],
  customerReorderIntent:[{
    productId:'bento',
    productName:'肉燥便當',
    quantity:1,
    selections:[{optionGroupId:'rice',optionId:'extra',optionName:'加飯'}],
  }],
};

describe('Customer UI8 historical projection',()=>{
  it('keeps historical price facts read-only and reorder intent price-free',()=>{
    const projected=mapCustomerOrderProjection(baseOrder);
    expect(projected.stage).toBe('COMPLETED');
    expect(projected.displayCode).toBe('038');
    expect(projected.pickupCode).toBe('4567');
    expect(projected.historicalLines).toEqual([{
      name:'肉燥便當',
      quantity:1,
      historicalUnitLabel:'HK$48.00',
      historicalLineTotalLabel:'HK$48.00',
      detail:'加飯',
    }]);
    expect(projected.reorderIntent).toEqual(baseOrder.customerReorderIntent);
    expect(JSON.stringify(projected.reorderIntent)).not.toMatch(/payment|fulfillment|coupon|publishedUnitPriceMinor|lineId/i);
  });

  it('does not synthesize reorder eligibility when canonical intent is absent',()=>{
    const projected=mapCustomerOrderProjection({...baseOrder,customerReorderIntent:undefined});
    expect(projected.reorderIntent).toBeUndefined();
  });

  it('keeps Pickup Code distinct from Display Number',()=>{
    const projected=mapCustomerOrderProjection(baseOrder);
    expect(projected.pickupCode).not.toBe(projected.displayCode);
  });
});
