import {describe,expect,it,vi} from 'vitest';

import {createMfpFormalBusinessNativeTransport} from './formal-business-native-transport.ts';
import type {MfpNativeBridge} from './a9-runtime.ts';
import type {MfpStoreKernelCommandEnvelope} from './store-kernel-port.ts';

const candidate='runtime-candidate-mfk-69adb1121567';
const runtimeUrl=()=>new URL(`https://appassets.androidplatform.net/runtime/index.html?releaseId=${candidate}&runtimeVersion=${candidate}&runtimeChannel=candidate`);
const command:MfpStoreKernelCommandEnvelope=Object.freeze({
  schema:'mfp.store-kernel.command.v1',storeId:'MF01',deviceId:'PAD-01',staffSessionRef:'SESSION-01',
  submissionId:'SUB-01',idempotencyKey:'IDEMP-01',commandType:'CHECKOUT_PAYMENT_CONFIRM',
  expectedRevision:'PRICE-8',payload:Object.freeze({review:{quoteRef:'QUOTE-1'}}),createdAt:'2026-10-02T06:02:00.000Z',
});

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
});
