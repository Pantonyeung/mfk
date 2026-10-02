import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';

import {MfpCheckCenterView} from './check-center.tsx';
import type {MfpA9NativeDiagnostics} from './a9-runtime.ts';

const diagnostics:MfpA9NativeDiagnostics={
  checkedAt:'2026-10-02T13:00:00.000Z',
  carrier:{status:'accepted',carrierVersionName:'1.0',carrierVersionCode:106,bridgeVersion:1,currentReleaseId:'stable-1',candidateReleaseId:null,previousReleaseId:'stable-0',selectedReleaseId:null,otaConfigured:true},
  storeKernel:{status:'ok',value:{status:'ok',database:'ok',schemaVersion:1,journalMode:'WAL',synchronous:'FULL'}},
  print:{status:'accepted',value:{queueDepth:0}},faults:{value:[{source:'CARRIER',code:'RUNTIME_BOOT_FALLBACK',timestamp:'2026-10-02T12:00:00.000Z',message:'must not render'}]},
  errors:{carrier:null,storeKernel:null,print:null,faults:null},
};
const candidate='runtime-candidate-mfk-aaaaaaaaaaaa';
const url=new URL(`https://appassets.androidplatform.net/runtime/index.html?releaseId=${candidate}&runtimeVersion=${candidate}&runtimeChannel=candidate`);

describe('MFP V3 A9 Check Center',()=>{
  it('shows exact identity, Carrier, Store Kernel, Sync, Print, OTA and external sections',()=>{
    const html=renderToStaticMarkup(<MfpCheckCenterView surface="MFP_PAD" url={url} diagnostics={diagnostics} onRefresh={vi.fn()}/>);
    for(const value of ['data-check-center="A9"','IDENTITY','BINDINGS','STORE KERNEL','SYNC','PRINT','RUNTIME / OTA','EXTERNAL','FAULT JOURNAL','BACKUP / RESTORE',candidate,'stable-1','stable-0'])expect(html).toContain(value);
  });

  it('shows the formal-router blocker and every A1-A8 production binding honestly',()=>{
    const html=renderToStaticMarkup(<MfpCheckCenterView surface="MFP_MOBILE" url={url} diagnostics={diagnostics}/>);
    for(const value of ['FORMAL_COMMAND_ROUTER_BINDING_MISSING','MFP_SECURITY_PRODUCTION_BINDING_MISSING','MFP_SYNC_PRODUCTION_BINDING_MISSING','MFP_CHECKOUT_PRODUCTION_BINDING_MISSING','MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING','MFP_MONEY_PRODUCTION_BINDING_MISSING','MFP_CANONICAL_PRINT_BINDING_MISSING','MFP_CUSTOMER_PRODUCTION_BINDING_MISSING','MFP_KEETA_PRODUCTION_BINDING_MISSING'])expect(html).toContain(value);
  });

  it('does not render native fault messages or secrets',()=>{
    const html=renderToStaticMarkup(<MfpCheckCenterView surface="MFP_PAD" url={url} diagnostics={diagnostics}/>);
    expect(html).toContain('RUNTIME_BOOT_FALLBACK');
    expect(html).not.toContain('must not render');
    expect(html.toLowerCase()).not.toContain('providersecret');
  });

  it('labels ordinary browser mode as public acceptance with no native mutation',()=>{
    const html=renderToStaticMarkup(<MfpCheckCenterView surface="MFP_PAD" url={new URL('https://mfp.example.com/')} diagnostics={{...diagnostics,carrier:null,storeKernel:null,print:null,faults:null,errors:{carrier:'MFP_NATIVE_MUTATION_DISABLED_PUBLIC',storeKernel:'MFP_NATIVE_MUTATION_DISABLED_PUBLIC',print:'MFP_NATIVE_MUTATION_DISABLED_PUBLIC',faults:'MFP_NATIVE_MUTATION_DISABLED_PUBLIC'}}}/>);
    expect(html).toContain('data-runtime-mode="PUBLIC_ACCEPTANCE"');
    expect(html).toContain('no native print, drawer, Store Kernel writer, device impersonation or provider mutation');
  });
});
