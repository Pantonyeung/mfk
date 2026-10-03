import {mfpRuntimeMode,type MfpNativeBridge} from './a9-runtime.ts';
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
        if(value.type==='carrier.error'||value.type==='mfp.store-kernel.formal.error.v1'&&value.protocolVersion===1){
          finish(new Error(typeof value.errorCode==='string'&&/^[A-Z0-9_:-]{1,160}$/.test(value.errorCode)?value.errorCode:'MFP_NATIVE_CAPABILITY_FAILED'));return;
        }
        if(value.type==='mfp.store-kernel.submission.result.v1'&&value.protocolVersion===1
          &&value.schema==='mfp.store-kernel.submission.result.v1'&&value.submissionId===message.submissionId){
          finish(null,value as unknown as MfpStoreKernelResult);
        }
      };
      const onWindow=(event:NativeEvent)=>accept(event.data);
      const onBridge=(event:NativeEvent)=>accept(event.data);
      const stopWindow=env.listenWindow(onWindow);
      bridge.addEventListener?.('message',onBridge);
      timer=env.setTimer(()=>finish(new Error('MFP_NATIVE_TIMEOUT')),timeoutMs);
      try{bridge.postMessage(JSON.stringify({...message,protocolVersion:1,requestId}));}
      catch{finish(new Error('MFP_NATIVE_BRIDGE_POST_FAILED'));}
    });
  };
  return Object.freeze({
    submitCommand:(command:MfpStoreKernelCommandEnvelope)=>request({
      type:'mfp.store-kernel.command.v1',schema:command.schema,
      storeId:command.storeId,deviceId:command.deviceId,staffSessionRef:command.staffSessionRef,
      submissionId:command.submissionId,idempotencyKey:command.idempotencyKey,commandType:command.commandType,
      expectedRevision:command.expectedRevision,payload:command.payload,createdAt:command.createdAt,
    }),
    readSubmission:(command:MfpStoreKernelCommandEnvelope)=>request({
      type:'mfp.store-kernel.submission.read.v1',storeId:command.storeId,deviceId:command.deviceId,
      staffSessionRef:command.staffSessionRef,submissionId:command.submissionId,
    }),
  });
}
