import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {createMfpA9NativeAdapter,type MfpA9NativeDiagnostics,type MfpNativeBridge} from './a9-runtime.ts';
import {MfpCheckCenterView} from './check-center.tsx';

// Shared with StoreKernelA9DiagnosticsContractTest, which checks actual native DTO serialization.
const readFixture=(name:string)=>JSON.parse(readFileSync(new URL(`../../carrier/android/app/src/test/resources/${name}.json`,import.meta.url),'utf8')) as Record<string,unknown>;
const healthRequest=readFixture('a9-store-kernel-health-request');
const healthResponse=readFixture('a9-store-kernel-health-response');
const url=new URL('https://appassets.androidplatform.net/runtime/index.html?releaseId=fixture&runtimeVersion=fixture&runtimeChannel=candidate');
function harness(response:Record<string,unknown>=healthResponse){
  let receive:((event:{data:unknown})=>void)=()=>{};
  let timeout=()=>{};
  const sent:Record<string,unknown>[]=[];
  const stopWindow=vi.fn();
  const clearTimer=vi.fn();
  const bridge:MfpNativeBridge={postMessage(raw){
    sent.push(JSON.parse(raw));
    queueMicrotask(()=>receive({data:JSON.stringify(response)}));
  }};
  const adapter=createMfpA9NativeAdapter({
    currentUrl:()=>url,bridge:()=>bridge,randomUUID:()=> 'diagnostic-contract',
    listenWindow(listener){receive=listener;return stopWindow;},setTimer(callback){timeout=callback;return 1;},clearTimer,
  });
  return {adapter,sent,stopWindow,clearTimer,expire:()=>timeout()};
}
const diagnostics=(storeKernel:Record<string,unknown>|null):MfpA9NativeDiagnostics=>({
  checkedAt:'2026-10-03T00:00:00.000Z',carrier:null,storeKernel,print:null,faults:null,
  errors:{carrier:null,storeKernel:null,print:null,faults:null},
});
const render=(storeKernel:Record<string,unknown>|null)=>renderToStaticMarkup(
  <MfpCheckCenterView surface="MFP_PAD" url={url} diagnostics={diagnostics(storeKernel)}/>,
);

describe('A9 diagnostic Java/TypeScript wire contract',()=>{
  it('emits the complete native v1 request envelope captured at postMessage',async()=>{
    const {adapter,sent,stopWindow,clearTimer}=harness();
    await expect(adapter.readStoreKernelHealth()).resolves.toEqual(healthResponse);
    expect(sent).toEqual([healthRequest]);
    expect(stopWindow).toHaveBeenCalledOnce();
    expect(clearTimer).toHaveBeenCalledWith(1);
  });

  it('retains a correlated native operation error instead of manufacturing health evidence',async()=>{
    const {adapter}=harness({protocolVersion:1,type:'store.kernel.error.v1',requestId:healthRequest.requestId,status:'failed',errorCode:'STORE_KERNEL_OPERATION_FAILED'});
    await expect(adapter.readStoreKernelHealth()).rejects.toThrow('STORE_KERNEL_OPERATION_FAILED');
  });

  it('times out on the native parser rejection that has no correlated requestId',async()=>{
    const {adapter,expire,clearTimer}=harness({protocolVersion:1,type:'store.kernel.error.v1',status:'failed',errorCode:'STORE_KERNEL_PROTOCOL_VERSION_INVALID'});
    const result=expect(adapter.readStoreKernelHealth()).rejects.toThrow('MFP_NATIVE_TIMEOUT');
    await Promise.resolve();
    expect(clearTimer).not.toHaveBeenCalled();
    expire();
    await result;
  });

  it('still disables the health request in public browser mode',async()=>{
    const bridge={postMessage:vi.fn()};
    const adapter=createMfpA9NativeAdapter({currentUrl:()=>new URL('https://example.com/'),bridge:()=>bridge});
    await expect(adapter.readStoreKernelHealth()).rejects.toThrow('MFP_NATIVE_MUTATION_DISABLED_PUBLIC');
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });

  it('does not add Store Kernel protocol fields to unrelated Carrier request envelopes',async()=>{
    const {adapter,sent}=harness({type:'carrier.health.result',requestId:healthRequest.requestId,status:'accepted'});
    await adapter.readCarrierHealth();
    expect(sent).toEqual([{type:'carrier.health',requestId:healthRequest.requestId}]);
  });

  it('renders databaseName from the top-level native HealthResult DTO',async()=>{
    const {adapter}=harness();
    const response=await adapter.readStoreKernelHealth();
    const html=render(response);
    expect(html).toContain('<dt>DB</dt><dd>morefun_store_kernel.db</dd>');
    expect(html).toContain('<dt>Health</dt><dd>ok</dd>');
    expect(html).toContain('<dt>Schema</dt><dd>1</dd>');
    expect(html).toContain('<dt>Journal</dt><dd>wal</dd>');
    expect(html).toContain('<dt>Synchronous</dt><dd>2</dd>');
  });

  it('does not infer a missing databaseName from status or the old mock-only database field',()=>{
    const {databaseName:_databaseName,...missing}=healthResponse;
    expect(render({...missing,database:'ok'})).toContain('<dt>DB</dt><dd>NOT EXPOSED</dd>');
    expect(render(null)).toContain('<dt>DB</dt><dd>NOT EXPOSED</dd>');
  });

  it.each([undefined,null,{},[]])('keeps malformed databaseName visibly unavailable: %j',databaseName=>{
    expect(render({...healthResponse,databaseName})).toContain('<dt>DB</dt><dd>NOT EXPOSED</dd>');
  });
});
