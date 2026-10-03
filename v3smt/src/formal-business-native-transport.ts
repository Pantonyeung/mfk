import {mfpRuntimeMode,type MfpNativeBridge} from './a9-runtime.ts';
import type {
  MfpFormalCheckoutAuthority,
  MfpFormalCheckoutValidationRequest,
  MfpFormalCheckoutValidationResult,
  MfpFormalQuote,
  MfpTenderConfig,
} from './checkout-domain.ts';
import type {MfpStoreKernelCommandEnvelope,MfpStoreKernelResult,MfpStoreKernelTransport} from './store-kernel-port.ts';

type NativeEvent={data:unknown};
type NativeRecord=Readonly<Record<string,unknown>>;

interface FormalNativeEnvironment{
  readonly currentUrl:()=>URL;
  readonly bridge:()=>MfpNativeBridge|undefined;
  readonly listenWindow:(listener:(event:NativeEvent)=>void)=>(()=>void);
  readonly randomUUID:()=>string;
  readonly setTimer:(callback:()=>void,timeoutMs:number)=>unknown;
  readonly clearTimer:(timer:unknown)=>void;
}

function defaultEnvironment():FormalNativeEnvironment{
  return{
    currentUrl:()=>new URL(window.location.href),bridge:()=>window.moreFunNative,
    listenWindow(listener){window.addEventListener('message',listener as (event:MessageEvent)=>void);return()=>window.removeEventListener('message',listener as (event:MessageEvent)=>void);},
    randomUUID:()=>crypto.randomUUID(),setTimer:(callback,timeout)=>window.setTimeout(callback,timeout),clearTimer:timer=>window.clearTimeout(timer as number),
  };
}

function parseNative(data:unknown):NativeRecord|null{
  if(typeof data!=='string'||!data.trim())return null;
  try{const value=JSON.parse(data);return value&&typeof value==='object'&&!Array.isArray(value)?value as NativeRecord:null;}
  catch{return null;}
}

function requiredText(value:unknown,code:string){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>160)throw new Error(code);
  return value;
}

function stableCode(value:unknown,fallback:string){
  return typeof value==='string'&&/^[A-Z0-9_:-]{1,160}$/.test(value)?value:fallback;
}

export function createMfpFormalBusinessNativeTransport(
  environment?:Partial<FormalNativeEnvironment>,timeoutMs=7_000,
):MfpStoreKernelTransport{
  const env={...defaultEnvironment(),...environment};
  const request=(message:Readonly<Record<string,unknown>>):Promise<MfpStoreKernelResult>=>{
    if(mfpRuntimeMode(env.currentUrl())!=='ANDROID_RUNTIME')return Promise.reject(new Error('MFP_NATIVE_MUTATION_DISABLED_PUBLIC'));
    const bridge=env.bridge();
    if(!bridge)return Promise.reject(new Error('MFP_NATIVE_BRIDGE_UNAVAILABLE'));
    const requestId=`mfp-formal-${env.randomUUID()}`;
    return new Promise((resolve,reject)=>{
      let settled=false;
      let timer:unknown;
      const finish=(error:Error|null,value?:MfpStoreKernelResult)=>{
        if(settled)return;settled=true;env.clearTimer(timer);stopWindow();bridge.removeEventListener?.('message',onBridge);
        if(error)reject(error);else resolve(value!);
      };
      const accept=(raw:unknown)=>{
        const value=parseNative(raw);if(!value||value.requestId!==requestId)return;
        if(value.status==='failed'||value.type==='mfp.store-kernel.formal.error.v1'){
          finish(new Error(typeof value.errorCode==='string'&&/^[A-Z0-9_:-]{1,160}$/.test(value.errorCode)?value.errorCode:'MFP_NATIVE_CAPABILITY_FAILED'));return;
        }
        if(value.type==='mfp.store-kernel.submission.result.v1')finish(null,value as unknown as MfpStoreKernelResult);
      };
      const onWindow=(event:NativeEvent)=>accept(event.data);
      const onBridge=(event:NativeEvent)=>accept(event.data);
      const stopWindow=env.listenWindow(onWindow);
      bridge.addEventListener?.('message',onBridge);
      timer=env.setTimer(()=>finish(new Error('MFP_NATIVE_TIMEOUT')),timeoutMs);
      try{bridge.postMessage(JSON.stringify({protocolVersion:1,...message,requestId}));}
      catch{finish(new Error('MFP_NATIVE_BRIDGE_POST_FAILED'));}
    });
  };
  return Object.freeze({
    submitCommand:(command:MfpStoreKernelCommandEnvelope)=>request({type:'mfp.store-kernel.command.v1',...command}),
    readSubmission:(command:MfpStoreKernelCommandEnvelope)=>request({
      type:'mfp.store-kernel.submission.read.v1',storeId:command.storeId,deviceId:command.deviceId,
      staffSessionRef:command.staffSessionRef,submissionId:command.submissionId,
    }),
  });
}

export function createMfpFormalCheckoutNativeAuthority(
  input:Readonly<{
    identity:()=>Readonly<{storeId:string;deviceId:string;staffSessionRef:string}>;
    onTenders?:(tenders:readonly MfpTenderConfig[])=>void;
  }>,
  environment?:Partial<FormalNativeEnvironment>,
  timeoutMs=7_000,
):MfpFormalCheckoutAuthority{
  const env={...defaultEnvironment(),...environment};
  let validationGeneration=0;
  const validateCheckout=(request:MfpFormalCheckoutValidationRequest):Promise<MfpFormalCheckoutValidationResult>=>{
    const generation=++validationGeneration;
    if(mfpRuntimeMode(env.currentUrl())!=='ANDROID_RUNTIME')return Promise.reject(new Error('MFP_NATIVE_MUTATION_DISABLED_PUBLIC'));
    const bridge=env.bridge();
    if(!bridge)return Promise.reject(new Error('MFP_NATIVE_BRIDGE_UNAVAILABLE'));
    const identity=input.identity();
    const storeId=requiredText(identity.storeId,'MFP_CHECKOUT_NATIVE_STORE_ID_INVALID');
    const deviceId=requiredText(identity.deviceId,'MFP_CHECKOUT_NATIVE_DEVICE_ID_INVALID');
    const staffSessionRef=requiredText(identity.staffSessionRef,'MFP_CHECKOUT_NATIVE_STAFF_SESSION_INVALID');
    const requestId=`mfp-checkout-${env.randomUUID()}`;
    return new Promise((resolve,reject)=>{
      let settled=false;
      let timer:unknown;
      const finish=(error:Error|null,value?:MfpFormalCheckoutValidationResult)=>{
        if(settled)return;settled=true;env.clearTimer(timer);stopWindow();bridge.removeEventListener?.('message',onBridge);
        if(error)reject(error);else resolve(value!);
      };
      const accept=(raw:unknown)=>{
        const value=parseNative(raw);if(!value||value.requestId!==requestId)return;
        if(value.status==='failed'||value.type==='mfp.store-kernel.formal.error.v1'){
          finish(new Error(stableCode(value.errorCode,'MFP_NATIVE_CAPABILITY_FAILED')));return;
        }
        if(value.type!=='mfp.checkout.validation.result.v1')return;
        if(value.state==='VALID'&&value.quote&&typeof value.quote==='object'&&!Array.isArray(value.quote)){
          if(!Array.isArray(value.tenders)){
            finish(new Error('MFP_NATIVE_CHECKOUT_TENDERS_INVALID'));return;
          }
          const tenders:MfpTenderConfig[]=[];
          try{
            for(const rawTender of value.tenders){
              if(!rawTender||typeof rawTender!=='object'||Array.isArray(rawTender)){
                finish(new Error('MFP_NATIVE_CHECKOUT_TENDERS_INVALID'));return;
              }
              const tender=rawTender as Record<string,unknown>;
              if(tender.enabled!==true){finish(new Error('MFP_NATIVE_CHECKOUT_TENDERS_INVALID'));return;}
              tenders.push(Object.freeze({
                id:requiredText(tender.id,'MFP_NATIVE_CHECKOUT_TENDERS_INVALID'),
                label:requiredText(tender.label,'MFP_NATIVE_CHECKOUT_TENDERS_INVALID'),
                enabled:true,
              }));
            }
          }catch{
            finish(new Error('MFP_NATIVE_CHECKOUT_TENDERS_INVALID'));return;
          }
          if(generation===validationGeneration)input.onTenders?.(Object.freeze(tenders));
          finish(null,Object.freeze({state:'VALID',quote:value.quote as unknown as MfpFormalQuote}));return;
        }
        if(value.state==='REJECTED'){
          finish(null,Object.freeze({
            state:'REJECTED',
            rejectionCode:stableCode(value.rejectionCode,'MFP_NATIVE_CHECKOUT_REJECTED'),
            ...(value.revalidationRequired===true?{revalidationRequired:true as const}:{}),
          }));return;
        }
        if(value.state==='UNKNOWN'&&value.readbackRequired===true){
          finish(null,Object.freeze({state:'UNKNOWN',readbackRequired:true}));return;
        }
        finish(new Error('MFP_NATIVE_CHECKOUT_RESULT_INVALID'));
      };
      const onWindow=(event:NativeEvent)=>accept(event.data);
      const onBridge=(event:NativeEvent)=>accept(event.data);
      const stopWindow=env.listenWindow(onWindow);
      bridge.addEventListener?.('message',onBridge);
      timer=env.setTimer(()=>finish(new Error('MFP_NATIVE_TIMEOUT')),timeoutMs);
      try{
        bridge.postMessage(JSON.stringify({
          protocolVersion:1,
          type:'mfp.checkout.validation.request.v1',
          ...request,
          schema:'mfp.checkout.validation.request.v1',
          requestId,storeId,deviceId,staffSessionRef,
        }));
      }catch{finish(new Error('MFP_NATIVE_BRIDGE_POST_FAILED'));}
    });
  };
  return Object.freeze({validateCheckout});
}
