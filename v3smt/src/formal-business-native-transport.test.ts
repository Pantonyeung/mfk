import {describe,expect,it,vi} from 'vitest';

import {
  createMfpFormalBusinessNativeTransport,
  createMfpFormalCheckoutNativeAuthority,
} from './formal-business-native-transport.ts';
import type {MfpNativeBridge} from './a9-runtime.ts';
import type {MfpFormalCheckoutValidationRequest} from './checkout-domain.ts';
import type {MfpStoreKernelCommandEnvelope} from './store-kernel-port.ts';

const candidate='runtime-candidate-mfk-69adb1121567';
const runtimeUrl=()=>new URL(`https://appassets.androidplatform.net/runtime/index.html?releaseId=${candidate}&runtimeVersion=${candidate}&runtimeChannel=candidate`);
const command:MfpStoreKernelCommandEnvelope=Object.freeze({
  schema:'mfp.store-kernel.command.v1',storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01',
  submissionId:'SUB-01',idempotencyKey:'IDEMP-01',commandType:'CHECKOUT_PAYMENT_CONFIRM',
  expectedRevision:'PRICE-8',payload:Object.freeze({review:{quoteRef:'QUOTE-1'}}),createdAt:'2026-10-02T06:02:00.000Z',
});
const checkoutValidation=Object.freeze({
  schema:'mfp.checkout.validation.request.v1',
  intent:command.payload instanceof Object&&'intent' in command.payload
    ?command.payload.intent
    :Object.freeze({schema:'mfp.ordering.intent.draft.v1'}),
  channelId:'WALK_IN',tenderId:'CASH',studentDiscountIntent:null,
}) as unknown as MfpFormalCheckoutValidationRequest;

function environment(bridge:MfpNativeBridge){
  return{
    currentUrl:runtimeUrl,bridge:()=>bridge,listenWindow:()=>()=>undefined,randomUUID:()=> 'request-1',
    setTimer:(callback:()=>void)=>setTimeout(callback,1000),clearTimer:(timer:unknown)=>clearTimeout(timer as ReturnType<typeof setTimeout>),
  };
}

describe('MFP V3 A9R bounded formal native transport',()=>{
  it('submits only the high-level formal command and never a low-level Store Kernel operation',async()=>{
    let listener:(event:{data:unknown})=>void=()=>{};
    const posted:string[]=[];
    const bridge:MfpNativeBridge={
      addEventListener(_type,value){listener=value;},removeEventListener(){},
      postMessage(raw){
        posted.push(raw);
        const request=JSON.parse(raw);
        queueMicrotask(()=>listener({data:JSON.stringify({
          protocolVersion:1,type:'mfp.store-kernel.submission.result.v1',schema:'mfp.store-kernel.submission.result.v1',
          requestId:request.requestId,submissionId:'SUB-01',state:'REJECTED',rejectionCode:'MFP_SECURITY_PRODUCTION_BINDING_MISSING',
        })}));
      },
    };
    const transport=createMfpFormalBusinessNativeTransport(environment(bridge));

    await expect(transport.submitCommand(command)).resolves.toMatchObject({state:'REJECTED'});
    expect(JSON.parse(posted[0]!)).toMatchObject({
      protocolVersion:1,type:'mfp.store-kernel.command.v1',schema:'mfp.store-kernel.command.v1',
      submissionId:'SUB-01',commandType:'CHECKOUT_PAYMENT_CONFIRM',
    });
    expect(posted[0]).not.toContain('store.kernel.commit.v1');
    expect(transport).not.toHaveProperty('sendRaw');
  });

  it('reads back by the original store device session and submission identity only',async()=>{
    let listener:(event:{data:unknown})=>void=()=>{};
    const postMessage=vi.fn((raw:string)=>{
      const request=JSON.parse(raw);
      queueMicrotask(()=>listener({data:JSON.stringify({
        protocolVersion:1,type:'mfp.store-kernel.submission.result.v1',schema:'mfp.store-kernel.submission.result.v1',
        requestId:request.requestId,submissionId:'SUB-01',state:'UNKNOWN',readbackRequired:true,retryPermitted:false,
      })}));
    });
    const bridge:MfpNativeBridge={addEventListener(_type,value){listener=value;},removeEventListener(){},postMessage};
    const transport=createMfpFormalBusinessNativeTransport(environment(bridge));

    await expect(transport.readSubmission(command)).resolves.toMatchObject({state:'UNKNOWN'});
    expect(JSON.parse(postMessage.mock.calls[0]![0])).toEqual({
      protocolVersion:1,type:'mfp.store-kernel.submission.read.v1',requestId:'mfp-formal-request-1',
      storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01',submissionId:'SUB-01',
    });
  });

  it('fails closed without posting in public browser mode',async()=>{
    const bridge={postMessage:vi.fn()};
    const transport=createMfpFormalBusinessNativeTransport({...environment(bridge),currentUrl:()=>new URL('https://mfp.example.com/')});
    await expect(transport.submitCommand(command)).rejects.toThrow('MFP_NATIVE_MUTATION_DISABLED_PUBLIC');
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });

  it('validates checkout through the high-level native quote capability and refreshes canonical tenders',async()=>{
    let listener:(event:{data:unknown})=>void=()=>{};
    const posted:string[]=[];
    const onTenders=vi.fn();
    const bridge:MfpNativeBridge={
      addEventListener(_type,value){listener=value;},removeEventListener(){},
      postMessage(raw){
        posted.push(raw);
        const request=JSON.parse(raw);
        queueMicrotask(()=>listener({data:JSON.stringify({
          protocolVersion:1,type:'mfp.checkout.validation.result.v1',schema:'mfp.checkout.validation.result.v1',
          requestId:request.requestId,state:'VALID',
          quote:{
            quoteRef:'QUOTE-1',formalRevision:'QUOTE-REV-1',currency:'HKD',
            lines:[{cartLineId:'LINE-1',quantity:1,formalUnitMinor:5000,formalLineTotalMinor:5000,studentDiscountEligible:false}],
            discounts:[],formalSubtotalMinor:5000,formalDiscountMinor:0,formalTotalDueMinor:5000,
            acceptedTenderIds:['CASH'],validatedAt:'2026-12-01T03:00:00.000Z',
          },
          tenders:[{id:'CASH',label:'Cash',enabled:true,kind:'CASH'}],
        })}));
      },
    };
    const authority=createMfpFormalCheckoutNativeAuthority({
      identity:()=>({storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01'}),onTenders,
    },environment(bridge));

    await expect(authority.validateCheckout(checkoutValidation)).resolves.toMatchObject({
      state:'VALID',quote:{quoteRef:'QUOTE-1',formalTotalDueMinor:5000},
    });
    expect(onTenders).toHaveBeenCalledWith([{id:'CASH',label:'Cash',enabled:true}]);
    expect(JSON.parse(posted[0]!)).toMatchObject({
      protocolVersion:1,type:'mfp.checkout.validation.request.v1',schema:'mfp.checkout.validation.request.v1',
      storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01',channelId:'WALK_IN',tenderId:'CASH',
    });
    expect(posted[0]).not.toContain('aggregateType');
    expect(posted[0]).not.toContain('store.kernel.commit.v1');
  });

  it('never posts checkout validation from public acceptance',async()=>{
    const bridge={postMessage:vi.fn()};
    const authority=createMfpFormalCheckoutNativeAuthority({
      identity:()=>({storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01'}),
    },{...environment(bridge),currentUrl:()=>new URL('https://mfp.example.com/')});

    await expect(authority.validateCheckout(checkoutValidation)).rejects.toThrow('MFP_NATIVE_MUTATION_DISABLED_PUBLIC');
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });

  it('fails closed when a VALID native quote omits its canonical tender snapshot',async()=>{
    let listener:(event:{data:unknown})=>void=()=>{};
    const bridge:MfpNativeBridge={
      addEventListener(_type,value){listener=value;},removeEventListener(){},
      postMessage(raw){
        const request=JSON.parse(raw);
        queueMicrotask(()=>listener({data:JSON.stringify({
          protocolVersion:1,type:'mfp.checkout.validation.result.v1',schema:'mfp.checkout.validation.result.v1',
          requestId:request.requestId,state:'VALID',
          quote:{
            quoteRef:'QUOTE-1',formalRevision:'QUOTE-REV-1',currency:'HKD',
            lines:[{cartLineId:'LINE-1',quantity:1,formalUnitMinor:5000,formalLineTotalMinor:5000,studentDiscountEligible:false}],
            discounts:[],formalSubtotalMinor:5000,formalDiscountMinor:0,formalTotalDueMinor:5000,
            acceptedTenderIds:['CASH'],validatedAt:'2026-12-01T03:00:00.000Z',
          },
        })}));
      },
    };
    const authority=createMfpFormalCheckoutNativeAuthority({
      identity:()=>({storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01'}),
    },environment(bridge));

    await expect(authority.validateCheckout(checkoutValidation)).rejects.toThrow('MFP_NATIVE_CHECKOUT_TENDERS_INVALID');
  });

  it('does not let an older native validation overwrite the newest canonical tender snapshot',async()=>{
    const listeners=new Set<(event:{data:unknown})=>void>();
    const posted:Record<string,unknown>[]=[];
    const onTenders=vi.fn();
    let sequence=0;
    const bridge:MfpNativeBridge={
      addEventListener(_type,value){listeners.add(value);},
      removeEventListener(_type,value){listeners.delete(value);},
      postMessage(raw){posted.push(JSON.parse(raw));},
    };
    const authority=createMfpFormalCheckoutNativeAuthority({
      identity:()=>({storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01'}),onTenders,
    },{...environment(bridge),randomUUID:()=>`request-${++sequence}`});
    const respond=(request:Record<string,unknown>,quoteRef:string,tenderId:string)=>{
      const payload=JSON.stringify({
        protocolVersion:1,type:'mfp.checkout.validation.result.v1',schema:'mfp.checkout.validation.result.v1',
        requestId:request.requestId,state:'VALID',
        quote:{
          quoteRef,formalRevision:`${quoteRef}-REV`,currency:'HKD',
          lines:[{cartLineId:'LINE-1',quantity:1,formalUnitMinor:5000,formalLineTotalMinor:5000,studentDiscountEligible:false}],
          discounts:[],formalSubtotalMinor:5000,formalDiscountMinor:0,formalTotalDueMinor:5000,
          acceptedTenderIds:[tenderId],validatedAt:'2026-12-01T03:00:00.000Z',
        },
        tenders:[{id:tenderId,label:tenderId,enabled:true,kind:tenderId==='CASH'?'CASH':'NON_CASH'}],
      });
      for(const listener of [...listeners])listener({data:payload});
    };

    const older=authority.validateCheckout(checkoutValidation);
    const newer=authority.validateCheckout(checkoutValidation);
    respond(posted[1]!,'QUOTE-NEW','FPS');
    await newer;
    respond(posted[0]!,'QUOTE-OLD','CASH');
    await older;

    expect(onTenders).toHaveBeenCalledTimes(1);
    expect(onTenders).toHaveBeenLastCalledWith([{id:'FPS',label:'FPS',enabled:true}]);
  });
});

describe('formal native protocol isolation',()=>{
  function harness(){
    let listener:(event:{data:unknown})=>void=()=>{};
    const posted:Record<string,unknown>[]=[];
    const bridge:MfpNativeBridge={addEventListener(_type,value){listener=value;},removeEventListener(){},postMessage(raw){posted.push(JSON.parse(raw));}};
    const reply=(value:Record<string,unknown>)=>listener({data:JSON.stringify({
      protocolVersion:1,type:'mfp.store-kernel.submission.result.v1',schema:'mfp.store-kernel.submission.result.v1',
      requestId:posted.at(-1)?.requestId,submissionId:command.submissionId,state:'REJECTED',rejectionCode:'EXPECTED_REVISION_STALE',...value,
    })});
    return {posted,reply,bridge,transport:createMfpFormalBusinessNativeTransport(environment(bridge))};
  }

  it('does not let extra runtime command fields change the bounded bridge operation',async()=>{
    const value=harness();
    const pending=value.transport.submitCommand({...command,type:'unexpected.operation',protocolVersion:9,requestId:'INJECTED',mutations:[]} as MfpStoreKernelCommandEnvelope);
    value.reply({});await pending;
    expect(value.posted[0]).toEqual({protocolVersion:1,type:'mfp.store-kernel.command.v1',...command,requestId:'mfp-formal-request-1'});
  });

  it.each([
    {protocolVersion:2},
    {schema:'foreign.result.v1'},
    {submissionId:'SUB-OTHER'},
  ])('does not settle on a wrong result identity or protocol: %j',async invalid=>{
    const value=harness();let settled=false;
    const pending=value.transport.submitCommand(command).then(result=>{settled=true;return result;});
    value.reply(invalid);await Promise.resolve();
    expect(settled).toBe(false);
    value.reply({});await expect(pending).resolves.toMatchObject({state:'REJECTED',submissionId:command.submissionId});
  });

  it('ignores a foreign failure message with the same request ID',async()=>{
    const value=harness();const pending=value.transport.submitCommand(command);
    value.reply({type:'unrelated.failure',status:'failed',errorCode:'FOREIGN_FAILURE'});value.reply({});
    await expect(pending).resolves.toMatchObject({state:'REJECTED',rejectionCode:'EXPECTED_REVISION_STALE'});
  });
});
