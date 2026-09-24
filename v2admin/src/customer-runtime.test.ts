import {describe,expect,it} from 'vitest';
import {CustomerRuntimeStore} from '../customer-runtime.ts';
import {
  MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
  MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
} from '../../contracts/customer-cloud-v1.ts';

class MemoryStorage{
  private rows=new Map<string,unknown>();
  async get(key:string){return this.rows.get(key);}
  async put(key:string,value:unknown){this.rows.set(key,value);}
  async list({prefix}:{prefix:string}){
    return new Map([...this.rows.entries()].filter(([key])=>key.startsWith(prefix)));
  }
}
function runtime(){
  return new CustomerRuntimeStore({storage:new MemoryStorage()}, {});
}

describe('CustomerRuntimeStore public contract',()=>{
  it('keeps quote request durable and returns only public quote facts on readback',async()=>{
    const store=runtime();
    const requestId='CUSTOMER-QUOTE-1';
    const submit=await store.fetch(new Request('https://internal/public/quote',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
        storeId:'MF01',
        requestId,
        createdAt:'2026-09-23T12:00:00.000Z',
        cart:[{
          lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:1,selections:[],
        }],
      }),
    }));
    expect(submit.status).toBe(202);

    const ack=await store.fetch(new Request('https://internal/smt/quotes/ack',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        requestId,state:'CONFIRMED',quoteId:'Q1',revision:'R1',currency:'HKD',totalMinor:4200,
        observedAt:'2026-09-23T12:00:01.000Z',
      }),
    }));
    expect(ack.status).toBe(200);

    const readback=await store.fetch(new Request('https://internal/public/quote/readback?requestId='+requestId));
    const body=await readback.json() as Record<string,unknown>;
    expect(body).toMatchObject({state:'CONFIRMED',requestId,quoteId:'Q1',totalMinor:4200});
    expect(body).not.toHaveProperty('cart');
    expect(body).not.toHaveProperty('requestFingerprint');
  });

  it('does not expose checkout name or phone through public order readback',async()=>{
    const store=runtime();
    const submissionId='CUSTOMER-00000000-0000-4000-8000-000000000001';
    const idempotencyKey='customer-order:'+submissionId;
    const submit=await store.fetch(new Request('https://internal/public/orders/submit',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
        storeId:'MF01',
        submissionId,
        idempotencyKey,
        createdAt:'2026-09-23T12:00:00.000Z',
        updatedAt:'2026-09-23T12:00:00.000Z',
        cart:[{
          lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:1,selections:[],
        }],
        checkout:{name:'測試顧客',phone:'91234567'},
      }),
    }));
    expect(submit.status).toBe(202);

    const ack=await store.fetch(new Request('https://internal/smt/orders/ack',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        submissionId,idempotencyKey,state:'CONFIRMED',
        canonicalOrderId:'MFK-ORDER-1',canonicalDisplay:'P024',
        committedAt:'2026-09-23T12:00:01.000Z',totalMinor:4200,
      }),
    }));
    expect(ack.status).toBe(200);

    const readback=await store.fetch(new Request('https://internal/public/orders/readback?submissionId='+encodeURIComponent(submissionId)));
    const body=await readback.json() as Record<string,unknown>;
    expect(body).toMatchObject({
      state:'CONFIRMED',submissionId,canonicalOrderId:'MFK-ORDER-1',canonicalDisplay:'P024',totalMinor:4200,
    });
    expect(body).not.toHaveProperty('cart');
    expect(body).not.toHaveProperty('checkout');
    expect(JSON.stringify(body)).not.toContain('91234567');
    expect(JSON.stringify(body)).not.toContain('測試顧客');
  });

  it('rejects reuse of one submission id with a different payload',async()=>{
    const store=runtime();
    const submissionId='CUSTOMER-00000000-0000-4000-8000-000000000002';
    const base={
      schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
      storeId:'MF01',
      submissionId,
      idempotencyKey:'customer-order:'+submissionId,
      createdAt:'2026-09-23T12:00:00.000Z',
      updatedAt:'2026-09-23T12:00:00.000Z',
      checkout:{name:'',phone:'91234567'},
    } as const;
    const first=await store.fetch(new Request('https://internal/public/orders/submit',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({...base,cart:[{lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:1,selections:[]}]}),
    }));
    expect(first.status).toBe(202);
    const conflict=await store.fetch(new Request('https://internal/public/orders/submit',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({...base,cart:[{lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:2,selections:[]}]}),
    }));
    expect(conflict.status).toBe(409);
  });
});
