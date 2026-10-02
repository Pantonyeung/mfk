import {describe,expect,it,vi} from 'vitest';

import {
  MFP_A9_FORMAL_ROUTER_STATUS,
  MFP_BACKUP_BOUNDARY,
  MFP_BUILD_IDENTITY,
  collectMfpA9NativeDiagnostics,
  createMfpA9NativeAdapter,
  createMfpRuntimeReadyOnce,
  evaluateMfpA9Readiness,
  readMfpRuntimeReleaseIdentity,
  validateMfpBuildIdentity,
  type MfpA9NativeAdapter,
  type MfpNativeBridge,
} from './a9-runtime.ts';

const candidate='runtime-candidate-mfk-83adb14c2117';
const runtimeUrl=()=>new URL(`https://appassets.androidplatform.net/runtime/index.html?releaseId=${candidate}&runtimeVersion=${candidate}&runtimeChannel=candidate`);

describe('MFP V3 A9 build and runtime identity',()=>{
  it('embeds one exact MFP V3 source/build identity',()=>{
    expect(validateMfpBuildIdentity()).toEqual(MFP_BUILD_IDENTITY);
    expect(MFP_BUILD_IDENTITY.sourceSha).toMatch(/^[0-9a-f]{40}$/);
    expect(MFP_BUILD_IDENTITY.target).toBe('MFP_V3');
  });

  it('accepts only the canonical appassets runtime URL with matching candidate identity',()=>{
    expect(readMfpRuntimeReleaseIdentity(runtimeUrl())).toEqual({releaseId:candidate,runtimeVersion:candidate,runtimeChannel:'candidate'});
    expect(readMfpRuntimeReleaseIdentity(new URL(`https://appassets.androidplatform.net/runtime/index.html?releaseId=${candidate}&runtimeVersion=other&runtimeChannel=candidate`))).toBeNull();
    expect(readMfpRuntimeReleaseIdentity(new URL(`https://example.com/runtime/index.html?releaseId=${candidate}&runtimeVersion=${candidate}&runtimeChannel=candidate`))).toBeNull();
  });

  it('handles the packaged stable baseline without manufacturing a releaseId',()=>{
    expect(readMfpRuntimeReleaseIdentity(new URL('https://appassets.androidplatform.net/baseline/index.html?runtimeVersion=packaged-baseline&runtimeChannel=stable'))).toEqual({releaseId:null,runtimeVersion:'packaged-baseline',runtimeChannel:'stable'});
  });

  it('signals runtime.ready exactly once across StrictMode/remount calls',()=>{
    const bridge={postMessage:vi.fn()};
    const ready=createMfpRuntimeReadyOnce();
    expect(ready(runtimeUrl(),bridge)).toBe(true);
    expect(ready(runtimeUrl(),bridge)).toBe(false);
    expect(bridge.postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(bridge.postMessage.mock.calls[0]![0])).toEqual({type:'runtime.ready',bridgeVersion:1,releaseId:candidate});
  });

  it('does not send runtime.ready from an ordinary browser or malformed runtime',()=>{
    const bridge={postMessage:vi.fn()};
    const ready=createMfpRuntimeReadyOnce();
    expect(ready(new URL('https://mfp.example.com/'),bridge)).toBe(false);
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
});

describe('MFP V3 A9 bounded native adapter',()=>{
  function environment(bridge:MfpNativeBridge,setTimer:(callback:()=>void)=>unknown=callback=>setTimeout(callback,1000)){
    return{
      currentUrl:runtimeUrl,bridge:()=>bridge,listenWindow:()=>()=>undefined,randomUUID:()=> 'request-1',
      setTimer:(callback:()=>void)=>setTimer(callback),clearTimer:(timer:unknown)=>clearTimeout(timer as ReturnType<typeof setTimeout>),
    };
  }

  it('correlates async Store Kernel completion and ignores request-accepted',async()=>{
    let listener:(event:{data:unknown})=>void=()=>{};
    const bridge:MfpNativeBridge={
      addEventListener(_type,value){listener=value;},removeEventListener(){},
      postMessage(raw){
        const {requestId}=JSON.parse(raw);
        queueMicrotask(()=>listener({data:JSON.stringify({type:'store.kernel.request.accepted.v1',status:'accepted',requestId})}));
        queueMicrotask(()=>listener({data:JSON.stringify({type:'store.kernel.health.completed.v1',status:'ok',requestId,value:{database:'ok'}})}));
      },
    };
    await expect(createMfpA9NativeAdapter(environment(bridge)).readStoreKernelHealth()).resolves.toMatchObject({type:'store.kernel.health.completed.v1'});
  });

  it('turns timeout into UNKNOWN/fail-closed instead of success',async()=>{
    const bridge:MfpNativeBridge={postMessage(){}};
    const adapter=createMfpA9NativeAdapter(environment(bridge,callback=>{queueMicrotask(callback);return 1;}));
    await expect(adapter.readCarrierHealth()).rejects.toThrow('MFP_NATIVE_TIMEOUT');
  });

  it('disables every native request in public browser mode even if a bridge is injected',async()=>{
    const bridge={postMessage:vi.fn()};
    const adapter=createMfpA9NativeAdapter({...environment(bridge),currentUrl:()=>new URL('https://mfp.example.com/')});
    await expect(adapter.readCarrierHealth()).rejects.toThrow('MFP_NATIVE_MUTATION_DISABLED_PUBLIC');
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });

  it('collects bounded Carrier, Store Kernel, Print and fault evidence with stable errors',async()=>{
    const ok=async()=>({status:'accepted'});
    const adapter:MfpA9NativeAdapter={mode:()=> 'ANDROID_RUNTIME',readCarrierHealth:ok,readStoreKernelHealth:ok,readPrintGatewaySnapshot:ok,readFaults:ok,recordAction:ok,recordFault:ok};
    const result=await collectMfpA9NativeDiagnostics(adapter,()=> '2026-10-02T13:00:00.000Z');
    expect(result.checkedAt).toBe('2026-10-02T13:00:00.000Z');
    expect(result.errors).toEqual({carrier:null,storeKernel:null,print:null,faults:null});
  });
});

describe('MFP V3 A9 fail-closed readiness',()=>{
  it('reports the source-verified formal router and every unbound production authority',()=>{
    const result=evaluateMfpA9Readiness({expectedSourceSha:MFP_BUILD_IDENTITY.sourceSha,builderV3SourceVerified:true});
    expect(MFP_A9_FORMAL_ROUTER_STATUS).toMatchObject({status:'SOURCE_VERIFIED',code:'FORMAL_COMMAND_ROUTER_SOURCE_VERIFIED'});
    expect(result.status).toBe('BLOCKED');
    expect(result.codes).not.toContain(MFP_A9_FORMAL_ROUTER_STATUS.code);
    expect(result.codes).toContain('FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING');
    expect(result.codes).toContain('FORMAL_TENDER_AUTHORITY_DEPENDENCY_MISSING');
    expect(result.codes).toContain('MFP_SYNC_PRODUCTION_BINDING_MISSING');
    expect(result.codes).toContain('MFP_PHYSICAL_ACCEPTANCE_REQUIRED');
  });

  it('requires an external exact expected source identity',()=>{
    expect(evaluateMfpA9Readiness().codes).toContain('MFP_EXPECTED_SOURCE_SHA_REQUIRED');
    expect(evaluateMfpA9Readiness({expectedSourceSha:'0'.repeat(40)}).codes).toContain('MFP_EXPECTED_SOURCE_SHA_MISMATCH');
  });

  it('blocks canonical backup/restore while keeping the safe local allowlist explicit',()=>{
    expect(MFP_BACKUP_BOUNDARY.status).toBe('BLOCKED');
    expect(MFP_BACKUP_BOUNDARY.allowed).toContain('printer bindings');
    expect(MFP_BACKUP_BOUNDARY.forbidden).toContain('Store Kernel DB');
    expect(MFP_BACKUP_BOUNDARY.forbidden).toContain('staff PIN/proof/session');
  });
});
