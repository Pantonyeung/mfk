import {afterEach,describe,it,expect,vi} from 'vitest';
const spies=vi.hoisted(()=>({render:vi.fn(),mountNormalApp:vi.fn(),startMfpSyncLifecycle:vi.fn()}));
vi.mock('react-dom/client',()=>({createRoot:()=>({render:spies.render})}));
vi.mock('./normal-app-entry.tsx',()=>({mountNormalApp:spies.mountNormalApp}));
vi.mock('./sync-runtime.ts',()=>({startMfpSyncLifecycle:spies.startMfpSyncLifecycle}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});

describe('build flag chooses exactly one isolated entry',()=>{
  it('mounts linked view without importing the formal entry or starting its lifecycle',async()=>{
    vi.resetModules();vi.stubEnv('VITE_MFP_V3_LINKED_TEST','1');vi.stubGlobal('document',{getElementById:()=>({id:'root'})});
    await import('./main.tsx');expect(spies.render).toHaveBeenCalledOnce();expect(spies.mountNormalApp).not.toHaveBeenCalled();expect(spies.startMfpSyncLifecycle).not.toHaveBeenCalled();
  });
  it.each(['0','true',''])('preserves the normal mount for flag %s',async flag=>{
    vi.resetModules();vi.stubEnv('VITE_MFP_V3_LINKED_TEST',flag);const root={id:'root'};vi.stubGlobal('document',{getElementById:()=>root});
    await import('./main.tsx');await vi.waitFor(()=>expect(spies.mountNormalApp).toHaveBeenCalledExactlyOnceWith(root));expect(spies.render).not.toHaveBeenCalled();
  });
});
