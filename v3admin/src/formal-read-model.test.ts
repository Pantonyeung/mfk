import {afterEach,describe,expect,it,vi} from 'vitest';
import {readV3ProjectedDays,readV3ProjectedOrders,readV3RefundProjection} from './formal-read-model.tsx';

afterEach(()=>vi.unstubAllGlobals());

describe('V3 authenticated read models',()=>{
  it('reads orders through Admin session authority',async()=>{
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toContain('/api/projection/orders?storeId=MF01');
      expect(new Headers(init?.headers).get('x-mfk-admin-session')).toBe('session-token');
      expect(init?.cache).toBe('no-store');
      return new Response(JSON.stringify({orders:[{orderId:'O1',display:'O1',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',businessDate:'2026-10-01',totalMinor:1000,paymentLabel:'CASH',fulfillmentLabel:'進行中',sourceLabel:'門店',items:[]}]}),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    const rows=await readV3ProjectedOrders({storeId:'MF01',sessionToken:'session-token'});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({orderId:'O1',totalMinor:1000});
  });

  it('reads sales reports through Admin session authority',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      expect(new Headers(init?.headers).get('x-mfk-admin-session')).toBe('session-token');
      return new Response(JSON.stringify({days:[{date:'2026-10-01',grossMinor:1000,adjustmentMinor:0,netMinor:1000,orders:1,cashSalesMinor:1000,openingCash:null,dayClose:null}]}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const rows=await readV3ProjectedDays({storeId:'MF01',sessionToken:'session-token'});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({date:'2026-10-01',netMinor:1000});
  });

  it('reads refund evidence without exposing refund mutation',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      expect(new Headers(init?.headers).get('x-mfk-admin-session')).toBe('session-token');
      return new Response(JSON.stringify({refunds:[],addenda:[]}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const result=await readV3RefundProjection({storeId:'MF01',sessionToken:'session-token'});
    expect(result).toEqual({refunds:[],addenda:[]});
  });

  it('fails closed on unauthorized projection response',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:'PROJECTION_READ_UNAUTHORIZED'}),{status:401,headers:{'content-type':'application/json'}})));
    await expect(readV3ProjectedOrders({storeId:'MF01',sessionToken:'bad'})).rejects.toThrow('PROJECTION_READ_UNAUTHORIZED');
  });
});
