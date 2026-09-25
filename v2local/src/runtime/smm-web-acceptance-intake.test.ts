import {afterEach,describe,expect,it,vi} from 'vitest';

import {reconcileSmmWebAcceptanceIntake} from './smm-web-acceptance-intake.ts';

describe('SMM web acceptance intake',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('feeds isolated acceptance intent into the canonical SMM ingress and ACKs once',async()=>{
    const request={
      protocolVersion:1 as const,
      type:'smm.lan.order.submit.v1' as const,
      requestId:'SMM-ACCEPT-1',
      submissionId:'SUB-ACCEPT-1',
      idempotencyKey:'IDEMP-ACCEPT-1',
      storeId:'MF01',
      menuRevision:'5',
      publishedTotalMinor:5600,
      serviceMode:'TAKEAWAY' as const,
      tender:'CASH' as const,
      lines:[{
        lineId:'L1',
        productId:'P1',
        productName:'今日想食辣',
        quantity:1,
        publishedUnitPriceMinor:5600,
        selections:[],
      }],
    };
    const ingress={
      submit:vi.fn(()=>({
        protocolVersion:1 as const,
        type:'smm.lan.order.result.v1' as const,
        requestId:request.requestId,
        submissionId:request.submissionId,
        idempotencyKey:request.idempotencyKey,
        disposition:'ACCEPTED' as const,
        orderId:'ORDER-WEB-1',
        canonicalRevision:1,
      })),
    };

    const calls:{url:string;init?:RequestInit}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      calls.push({url,init});
      if(url.includes('/pending')){
        return new Response(JSON.stringify({orders:[{request,staff:{staffId:'1111'}}]}),{
          status:200,headers:{'content-type':'application/json'},
        });
      }
      if(url.includes('/ack')){
        return new Response(JSON.stringify({state:'ACKED'}),{
          status:200,headers:{'content-type':'application/json'},
        });
      }
      return new Response('{}',{status:404});
    }));

    await reconcileSmmWebAcceptanceIntake(ingress);

    expect(ingress.submit).toHaveBeenCalledTimes(1);
    expect(ingress.submit).toHaveBeenCalledWith(request,{deviceId:'WEB-ACCEPTANCE',trusted:true});
    expect(calls.some(call=>call.url==='/__mfk/smm-acceptance/pending')).toBe(true);
    expect(calls.some(call=>call.url==='/__mfk/smm-acceptance/ack')).toBe(true);
  });

  it('retries the same ACK identity after a transient public failure without resubmitting the order',async()=>{
    const request={
      protocolVersion:1 as const,type:'smm.lan.order.submit.v1' as const,
      requestId:'SMM-ACCEPT-RETRY',submissionId:'SUB-ACCEPT-RETRY',idempotencyKey:'IDEMP-ACCEPT-RETRY',
      storeId:'MF01',menuRevision:'5',publishedTotalMinor:5600,serviceMode:'TAKEAWAY' as const,tender:'CASH' as const,
      lines:[{lineId:'L1',productId:'P1',productName:'今日想食辣',quantity:1,publishedUnitPriceMinor:5600,selections:[]}],
    };
    const ingress={submit:vi.fn(()=>({
      protocolVersion:1 as const,type:'smm.lan.order.result.v1' as const,
      requestId:request.requestId,submissionId:request.submissionId,idempotencyKey:request.idempotencyKey,
      disposition:'ACCEPTED' as const,orderId:'ORDER-WEB-RETRY',canonicalRevision:1,
    }))};
    let ackAttempts=0;
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes('/pending'))return new Response(JSON.stringify({orders:[{request,staff:{staffId:'1111'}}]}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/ack')){
        ackAttempts++;
        const body=JSON.parse(String(init?.body||'{}'));
        expect(body.submissionId).toBe(request.submissionId);
        expect(body.idempotencyKey).toBe(request.idempotencyKey);
        if(ackAttempts===1)return new Response('{}',{status:503});
        return new Response(JSON.stringify({state:'ACKED'}),{status:200,headers:{'content-type':'application/json'}});
      }
      return new Response('{}',{status:404});
    }));
    await reconcileSmmWebAcceptanceIntake(ingress);
    expect(ingress.submit).toHaveBeenCalledTimes(1);
    expect(ackAttempts).toBe(2);
  });

});
