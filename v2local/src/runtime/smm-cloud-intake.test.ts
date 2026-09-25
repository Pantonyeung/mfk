import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('./admin-config-sync.ts',()=>({
  readSmtDeviceId:()=> 'SMT-1',
}));

import {reconcileSmmCloudIntake} from './smm-cloud-intake.ts';

describe('SMM cloud staff intake',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('reuses the canonical SMM ingress and only ACKs its result',async()=>{
    const request={
      protocolVersion:1 as const,
      type:'smm.lan.order.submit.v1' as const,
      requestId:'R-CLOUD-1',
      submissionId:'S-CLOUD-1',
      idempotencyKey:'I-CLOUD-1',
      storeId:'MF01',
      menuRevision:'7',
      publishedTotalMinor:4100,
      serviceMode:'DINE_IN' as const,
      tender:'FPS' as const,
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    };
    const ingress={
      submit:vi.fn(()=>({
        protocolVersion:1 as const,
        type:'smm.lan.order.result.v1' as const,
        requestId:request.requestId,
        submissionId:request.submissionId,
        idempotencyKey:request.idempotencyKey,
        disposition:'ACCEPTED' as const,
        orderId:'ORDER-1',
        canonicalRevision:1,
      })),
    };
    const calls:{url:string;init?:RequestInit}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      calls.push({url,init});
      if(url.includes('/pending'))return new Response(JSON.stringify({orders:[{request,staff:{staffId:'staff-1'}}]}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/ack'))return new Response(JSON.stringify({state:'ACKED'}),{status:200,headers:{'content-type':'application/json'}});
      return new Response('{}',{status:404});
    }));

    await reconcileSmmCloudIntake(ingress);

    expect(ingress.submit).toHaveBeenCalledTimes(1);
    expect(ingress.submit).toHaveBeenCalledWith(request,{deviceId:'SMT-1',trusted:true});
    expect(calls.some(call=>call.url.includes('/api/smm/smt/orders/pending'))).toBe(true);
    expect(calls.some(call=>call.url.includes('/api/smm/smt/orders/ack'))).toBe(true);
  });
});
