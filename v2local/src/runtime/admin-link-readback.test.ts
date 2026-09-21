import {describe,expect,it} from 'vitest';
import {readAdminPricingReadback} from './admin-link-readback.ts';

describe('admin pricing readback',()=>{
  it('accepts canonical active pricebook envelope',async()=>{
    const fetcher=(async()=>new Response(JSON.stringify({
      ok:true,
      value:{
        storeId:'store-1',
        salesPriceContext:'DIRECT',
        currency:'HKD',
        revision:'rev-3',
        revisionToken:'token-3',
        generatedAt:'2026-09-21T00:00:00.000Z',
        products:{
          p2:{productId:'p2',baseUnitPriceMinor:4300},
          p1:{productId:'p1',baseUnitPriceMinor:4100},
        },
      },
    }),{status:200,headers:{'content-type':'application/json'}})) as typeof fetch;

    await expect(readAdminPricingReadback(fetcher,'https://example.test/api/pricing/active')).resolves.toEqual({
      storeId:'store-1',
      currency:'HKD',
      revision:'rev-3',
      revisionToken:'token-3',
      generatedAt:'2026-09-21T00:00:00.000Z',
      productCount:2,
      productIds:['p1','p2'],
    });
  });

  it('fails closed on malformed envelopes',async()=>{
    const fetcher=(async()=>new Response(JSON.stringify({ok:true,value:{}}),{status:200,headers:{'content-type':'application/json'}})) as typeof fetch;
    await expect(readAdminPricingReadback(fetcher,'https://example.test/api/pricing/active')).rejects.toThrow('ADMIN_PRICING_READBACK_INVALID');
  });
});
