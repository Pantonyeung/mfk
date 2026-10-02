declare const __MFP_BUILD_IDENTITY__:MfpBuildIdentity;

export type MfpA9Status='SOURCE_VERIFIED'|'DEPLOYED'|'PHYSICAL_VERIFIED'|'BLOCKED'|'FAILED';
export type MfpRuntimeMode='ANDROID_RUNTIME'|'PUBLIC_ACCEPTANCE';

export interface MfpBuildIdentity{
  readonly target:'MFP_V3';
  readonly sourceSha:string;
  readonly buildId:string;
  readonly builtAt:string|null;
}

export interface MfpRuntimeReleaseIdentity{
  readonly releaseId:string|null;
  readonly runtimeVersion:string;
  readonly runtimeChannel:'candidate'|'stable';
}

export const MFP_BUILD_IDENTITY=Object.freeze({...__MFP_BUILD_IDENTITY__});
export const MFP_A9_FORMAL_ROUTER_STATUS=Object.freeze({
  status:'BLOCKED' as const,
  code:'FORMAL_COMMAND_ROUTER_BINDING_MISSING',
  detail:'mfp.store-kernel.command.v1 has no approved production business-command router to the native store.kernel.* contract.',
});

export const MFP_A9_BINDINGS=Object.freeze([
  ['Security','MFP_SECURITY_PRODUCTION_BINDING_MISSING'],
  ['Store Kernel','FORMAL_COMMAND_ROUTER_BINDING_MISSING'],
  ['Sync','MFP_SYNC_PRODUCTION_BINDING_MISSING'],
  ['Checkout','MFP_CHECKOUT_PRODUCTION_BINDING_MISSING'],
  ['Orders','MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING'],
  ['Money','MFP_MONEY_PRODUCTION_BINDING_MISSING'],
  ['Print','MFP_CANONICAL_PRINT_BINDING_MISSING'],
  ['Customer','MFP_CUSTOMER_PRODUCTION_BINDING_MISSING'],
  ['Keeta','MFP_KEETA_PRODUCTION_BINDING_MISSING'],
] as const);

const APP_ORIGIN='https://appassets.androidplatform.net';
const RUNTIME_PATH='/runtime/index.html';
const BASELINE_PATH='/baseline/index.html';
const RELEASE_ID=/^[A-Za-z0-9._-]{1,96}$/;
const STABLE_CODE=/^[A-Z0-9_:-]{1,160}$/;

export function validateMfpBuildIdentity(value:MfpBuildIdentity=MFP_BUILD_IDENTITY){
  if(value.target!=='MFP_V3')throw new Error('MFP_BUILD_TARGET_INVALID');
  if(!/^[0-9a-f]{40}$/.test(value.sourceSha))throw new Error('MFP_BUILD_SOURCE_SHA_INVALID');
  if(!/^[A-Za-z0-9._-]{1,160}$/.test(value.buildId))throw new Error('MFP_BUILD_ID_INVALID');
  if(value.builtAt!==null&&!Number.isFinite(Date.parse(value.builtAt)))throw new Error('MFP_BUILD_TIMESTAMP_INVALID');
  return Object.freeze({...value});
}

export function readMfpRuntimeReleaseIdentity(url:URL):MfpRuntimeReleaseIdentity|null{
  if(url.origin!==APP_ORIGIN)return null;
  const runtimeChannel=url.searchParams.get('runtimeChannel');
  const runtimeVersion=url.searchParams.get('runtimeVersion')?.trim()??'';
  if((runtimeChannel!=='candidate'&&runtimeChannel!=='stable')||!RELEASE_ID.test(runtimeVersion))return null;
  if(url.pathname===BASELINE_PATH){
    return runtimeChannel==='stable'&&runtimeVersion==='packaged-baseline'
      ?Object.freeze({releaseId:null,runtimeVersion,runtimeChannel})
      :null;
  }
  if(url.pathname!==RUNTIME_PATH)return null;
  const releaseId=url.searchParams.get('releaseId')?.trim()??'';
  if(!RELEASE_ID.test(releaseId)||releaseId!==runtimeVersion)return null;
  return Object.freeze({releaseId,runtimeVersion,runtimeChannel});
}

export function mfpRuntimeMode(url:URL):MfpRuntimeMode{
  return readMfpRuntimeReleaseIdentity(url)?'ANDROID_RUNTIME':'PUBLIC_ACCEPTANCE';
}

export interface MfpNativeBridge{
  postMessage(message:string):void;
  addEventListener?(type:'message',listener:(event:{data:unknown})=>void):void;
  removeEventListener?(type:'message',listener:(event:{data:unknown})=>void):void;
}

declare global{interface Window{moreFunNative?:MfpNativeBridge}}

export function createMfpRuntimeReadyOnce(){
  let sent=false;
  return(url:URL,bridge:MfpNativeBridge|undefined)=>{
    if(sent||!bridge)return false;
    const identity=readMfpRuntimeReleaseIdentity(url);
    if(!identity)return false;
    bridge.postMessage(JSON.stringify({
      type:'runtime.ready',bridgeVersion:1,
      ...(identity.releaseId?{releaseId:identity.releaseId}:{}),
    }));
    sent=true;
    return true;
  };
}

export const signalMfpRuntimeReadyOnce=createMfpRuntimeReadyOnce();

type NativeRecord=Readonly<Record<string,unknown>>;
type NativeEvent={data:unknown};

interface NativeEnvironment{
  readonly currentUrl:()=>URL;
  readonly bridge:()=>MfpNativeBridge|undefined;
  readonly listenWindow:(listener:(event:NativeEvent)=>void)=>(()=>void);
  readonly randomUUID:()=>string;
  readonly setTimer:(callback:()=>void,timeoutMs:number)=>unknown;
  readonly clearTimer:(timer:unknown)=>void;
}

function defaultEnvironment():NativeEnvironment{
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

function code(value:unknown,fallback:string){
  return typeof value==='string'&&STABLE_CODE.test(value)?value:fallback;
}

export interface MfpA9NativeAdapter{
  readonly mode:()=>MfpRuntimeMode;
  readCarrierHealth():Promise<NativeRecord>;
  readStoreKernelHealth():Promise<NativeRecord>;
  readPrintGatewaySnapshot():Promise<NativeRecord>;
  readFaults():Promise<NativeRecord>;
  recordAction(action:string,route:string):Promise<NativeRecord>;
  recordFault(fault:Readonly<{source:string;code:string;port?:string;route?:string}>):Promise<NativeRecord>;
}

export function createMfpA9NativeAdapter(environment?:Partial<NativeEnvironment>,timeoutMs=7_000):MfpA9NativeAdapter{
  const env={...defaultEnvironment(),...environment};
  const request=(type:string,expected:readonly string[],payload:Record<string,unknown>={}):Promise<NativeRecord>=>{
    if(mfpRuntimeMode(env.currentUrl())!=='ANDROID_RUNTIME')return Promise.reject(new Error('MFP_NATIVE_MUTATION_DISABLED_PUBLIC'));
    const bridge=env.bridge();
    if(!bridge)return Promise.reject(new Error('MFP_NATIVE_BRIDGE_UNAVAILABLE'));
    const requestId=`mfp-v3-${env.randomUUID()}`;
    return new Promise((resolve,reject)=>{
      let settled=false;
      let timer:unknown;
      const finish=(error:Error|null,value?:NativeRecord)=>{
        if(settled)return;settled=true;env.clearTimer(timer);stopWindow();bridge.removeEventListener?.('message',onBridge);
        if(error)reject(error);else resolve(value!);
      };
      const accept=(raw:unknown)=>{
        const value=parseNative(raw);if(!value||value.requestId!==requestId)return;
        if(value.status==='failed'||value.type==='carrier.error'||value.type==='store.kernel.error.v1'){
          finish(new Error(code(value.errorCode??value.failureCode,'MFP_NATIVE_CAPABILITY_FAILED')));return;
        }
        if(typeof value.type==='string'&&expected.includes(value.type))finish(null,value);
      };
      const onWindow=(event:NativeEvent)=>accept(event.data);
      const onBridge=(event:NativeEvent)=>accept(event.data);
      const stopWindow=env.listenWindow(onWindow);
      bridge.addEventListener?.('message',onBridge);
      timer=env.setTimer(()=>finish(new Error('MFP_NATIVE_TIMEOUT')),timeoutMs);
      try{bridge.postMessage(JSON.stringify({type,requestId,...payload}));}
      catch{finish(new Error('MFP_NATIVE_BRIDGE_POST_FAILED'));}
    });
  };
  const bounded=(value:string,errorCode:string,max=240)=>{
    const safe=value.trim();if(!safe||safe.length>max)throw new Error(errorCode);return safe;
  };
  return Object.freeze({
    mode:()=>mfpRuntimeMode(env.currentUrl()),
    readCarrierHealth:()=>request('carrier.health',['carrier.health.result']),
    readStoreKernelHealth:()=>request('store.kernel.health.v1',['store.kernel.health.completed.v1']),
    readPrintGatewaySnapshot:()=>request('print.gateway.snapshot',['print.gateway.snapshot.result']),
    readFaults:()=>request('diagnostics.faults.read',['diagnostics.faults.read.result']),
    recordAction(action:string,route:string){return request('diagnostics.action.record',['diagnostics.action.record.result'],{action:bounded(action,'MFP_DIAGNOSTICS_ACTION_INVALID',120),route:bounded(route,'MFP_DIAGNOSTICS_ROUTE_INVALID',160)});},
    recordFault(fault:Readonly<{source:string;code:string;port?:string;route?:string}>){
      const stable=code(fault.code,'');if(!stable)throw new Error('MFP_DIAGNOSTICS_CODE_INVALID');
      return request('diagnostics.fault.record',['diagnostics.fault.record.result'],{fault:{
        source:bounded(fault.source,'MFP_DIAGNOSTICS_SOURCE_INVALID',80),code:stable,
        message:'',port:fault.port?.slice(0,80)??'MFP',route:fault.route?.slice(0,160)??'',
      }});
    },
  });
}

export interface MfpA9NativeDiagnostics{
  readonly checkedAt:string;
  readonly carrier:NativeRecord|null;
  readonly storeKernel:NativeRecord|null;
  readonly print:NativeRecord|null;
  readonly faults:NativeRecord|null;
  readonly errors:Readonly<Record<'carrier'|'storeKernel'|'print'|'faults',string|null>>;
}

export async function collectMfpA9NativeDiagnostics(adapter:MfpA9NativeAdapter,now=()=>new Date().toISOString()):Promise<MfpA9NativeDiagnostics>{
  const checks=await Promise.allSettled([
    adapter.readCarrierHealth(),adapter.readStoreKernelHealth(),adapter.readPrintGatewaySnapshot(),adapter.readFaults(),
  ]);
  const value=(index:number)=>checks[index]!.status==='fulfilled'?(checks[index] as PromiseFulfilledResult<NativeRecord>).value:null;
  const error=(index:number,fallback:string)=>checks[index]!.status==='rejected'
    ?code((checks[index] as PromiseRejectedResult).reason instanceof Error?(checks[index] as PromiseRejectedResult).reason.message:'',fallback)
    :null;
  return Object.freeze({
    checkedAt:now(),carrier:value(0),storeKernel:value(1),print:value(2),faults:value(3),
    errors:Object.freeze({carrier:error(0,'MFP_CARRIER_DIAGNOSTICS_FAILED'),storeKernel:error(1,'MFP_STORE_KERNEL_DIAGNOSTICS_FAILED'),print:error(2,'MFP_PRINT_DIAGNOSTICS_FAILED'),faults:error(3,'MFP_FAULT_DIAGNOSTICS_FAILED')}),
  });
}

export function evaluateMfpA9Readiness(input:{expectedSourceSha?:string|null;builderV3SourceVerified?:boolean;publicDeployed?:boolean;physicalVerified?:boolean}={}):Readonly<{status:MfpA9Status;codes:readonly string[]}>{
  const codes:string[]=[];
  try{validateMfpBuildIdentity();}catch(error){codes.push(error instanceof Error?error.message:'MFP_BUILD_IDENTITY_INVALID');}
  if(!input.expectedSourceSha)codes.push('MFP_EXPECTED_SOURCE_SHA_REQUIRED');
  else if(input.expectedSourceSha!==MFP_BUILD_IDENTITY.sourceSha)codes.push('MFP_EXPECTED_SOURCE_SHA_MISMATCH');
  codes.push(MFP_A9_FORMAL_ROUTER_STATUS.code,...MFP_A9_BINDINGS.filter(([name])=>name!=='Store Kernel').map(([,bindingCode])=>bindingCode));
  if(!input.builderV3SourceVerified)codes.push('MFP_BUILDER_V3_SOURCE_NOT_ACCEPTED');
  if(!input.publicDeployed)codes.push('MFP_PUBLIC_ACCEPTANCE_NOT_DEPLOYED');
  if(!input.physicalVerified)codes.push('MFP_PHYSICAL_ACCEPTANCE_REQUIRED');
  return Object.freeze({status:codes.length?'BLOCKED':'PHYSICAL_VERIFIED',codes:Object.freeze([...new Set(codes)])});
}

export const MFP_BACKUP_BOUNDARY=Object.freeze({
  allowed:Object.freeze(['presentation settings','printer bindings','bounded device metadata','diagnostics export']),
  forbidden:Object.freeze(['canonical Orders','Pricing','Payment','PrintJobs','Store Kernel DB','staff PIN/proof/session','provider secrets']),
  status:'BLOCKED' as const,
  code:'MFP_NATIVE_CANONICAL_BACKUP_BINDING_MISSING',
});
