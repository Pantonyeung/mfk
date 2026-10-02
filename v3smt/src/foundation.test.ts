import {readFileSync,readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const productionSource=readdirSync(new URL('.',import.meta.url))
  .filter(name=>/\.tsx?$/.test(name)&&!/\.test\.tsx?$/.test(name))
  .map(name=>read('./'+name))
  .join('\n');

describe('MFP V3 authority foundation',()=>{
  it('locks one Store Kernel formal transaction authority',()=>{
    const port=read('./store-kernel-port.ts');
    const state=read('./state-authority.ts');
    expect(port).toContain("STORE_KERNEL_AUTHORITY='FORMAL_TRANSACTION_AUTHORITY'");
    expect(state).toContain("formalTransaction:'STORE_KERNEL'");
    expect(state).toContain("pricing:'STORE_KERNEL'");
  });

  it('forbids periodic business polling in the fresh client',()=>{
    expect(productionSource).not.toMatch(/setInterval\s*\(/);
    const state=read('./state-authority.ts');
    expect(state).toContain('refetchInterval:false');
    expect(state).not.toMatch(/refetchInterval:\s*(?:true|[1-9]\d*)/);
  });

  it('keeps auth readback event-driven with no periodic polling',()=>{
    const harness=read('./security-harness.tsx');
    expect(harness).toContain('useQuery');
    expect(harness).toContain('refetchInterval:false');
    expect(harness).not.toMatch(/setInterval\s*\(/);
  });

  it('does not import v2 client state or runtime modules',()=>{
    expect(productionSource).not.toContain('v2local');
    expect(productionSource).not.toContain('../v2');
    expect(productionSource).not.toContain('../../v2');
  });

  it('supports responsive MFP Pad and MFP Mobile surfaces from one shell',()=>{
    const app=read('./App.tsx');
    expect(app).toContain("'MFP_PAD'");
    expect(app).toContain("'MFP_MOBILE'");
    expect(app).toContain("matchMedia('(max-width: 767px)')");
  });

  it('keeps durable storage bounded to transport, device metadata and one atomic sync LKG',()=>{
    const state=read('./state-authority.ts');
    expect(state).toContain('MFP_OUTBOX_MAX_ROWS=1000');
    expect(state).toContain("durableTransportMetadata:'DEXIE_BOUNDED_OUTBOX_ONLY'");
    expect(state).toContain("durableDeviceMetadata:'DEXIE_INSTALLATION_DEVICE_METADATA_ONLY'");
    expect(state).toContain("durableProjection:'DEXIE_ATOMIC_LKG_BUNDLE_ONLY'");
    expect(state).toContain("durablePresentation:'LOCAL_STORAGE_DISPLAY_SETTINGS_ONLY'");
    expect(state).toContain("devices:'[storeId+deviceClass],&deviceId,&installationId,lastSeenAt,status'");
    expect(state).toContain("syncBundles:'&key,appliedSeq,appliedAt'");
    expect(state).toContain("mfpDb.syncBundles.put({...candidate,key:'active'})");
    expect(state).not.toMatch(/commitId|canonicalRevision|rejectionCode/);
    expect(state.toLowerCase()).not.toMatch(/staffsession|permissions|pin|hash|verifier/);
  });

  it('has no direct network or unrelated domain fan-out in the business port',()=>{
    const port=read('./store-kernel-port.ts').toLowerCase();
    expect(port).not.toMatch(/\bfetch\s*\(/);
    for(const domain of ['customer','keeta','sellability','config'])expect(port).not.toContain(domain);
  });

  it('creates no SMM authority, state, head or runtime dependency',()=>{
    const intent=['SMM','INTENT','STORE'].join('_');
    const worker=['mfk','smm-web'].join('-');
    expect(productionSource).not.toContain(intent);
    expect(productionSource).not.toMatch(/SMM.{0,20}HeadSeq/);
    expect(productionSource).not.toContain(worker);
  });

  it('keeps public/browser staff secrets and session references out of URLs, logs and durable state',()=>{
    expect(productionSource).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:pin|proof|session)/i);
    expect(productionSource).not.toMatch(/(?:searchParams|URLSearchParams)[^\n]*(?:session|staffSessionRef)/i);
    expect(productionSource).not.toMatch(/localStorage[^\n]*(?:pin|proof|session|staffSessionRef)/i);
    expect(productionSource).not.toContain('x-mfk-smm-session');
  });

  it('mounts one shared Pad/Mobile security harness without client-manufactured sessions',()=>{
    const app=read('./App.tsx');
    const security=read('./security-port.ts');
    expect(app).toContain('<MfpSecurityHarness security={mfpSecurityPort}');
    expect(security).toContain('input.authority.loginStaff');
    expect(security).toContain('createMfpSecuritySurfacePorts');
    expect(security).not.toMatch(/setActiveSession|manufactureSession/);
  });

  it('routes startup, reconnect, online and resume through one sync coordinator only',()=>{
    const runtime=read('./sync-runtime.ts');
    const binding=read('./sync-binding.ts');
    expect(binding).toContain('createMfpSyncCoordinator');
    expect(runtime).toContain('sync.startup()');
    expect(runtime).toContain('sync.networkOnline()');
    expect(runtime).toContain('sync.resumed()');
    expect(runtime).not.toMatch(/readHead|readChanges|readCheckpoint|setInterval/);
  });

  it('shares one sync contract across MFP Pad and MFP Mobile',()=>{
    const sync=read('./sync-port.ts');
    const app=read('./App.tsx');
    expect(sync).toContain('createMfpSyncSurfacePorts');
    expect(sync).toContain('MFP_PAD:port,MFP_MOBILE:port');
    expect(app).toContain('<MfpSyncHarness sync={mfpSyncCoordinator}/>');
  });
});
