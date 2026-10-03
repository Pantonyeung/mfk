import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import worker,{AdminSyncStore,v3ConfigurationWriteBlocked} from '../worker.ts';
import {v3AdminPreviewRequested,v3AdminConfigurationWritesEnabled} from './release-mode.ts';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const json=(path:string)=>JSON.parse(read(path));

describe('Admin V3 acceptance release boundary',()=>{
  it('keeps preview as an explicit build choice, never a production URL override',()=>{
    expect(v3AdminPreviewRequested('0','?preview=ui-01')).toBe(false);
    expect(v3AdminPreviewRequested(undefined,'?preview=ui-01')).toBe(false);
    expect(v3AdminPreviewRequested('','?preview=ui-01')).toBe(false);
    expect(v3AdminPreviewRequested('1','')).toBe(true);
    expect(v3AdminPreviewRequested('true','?preview=ui-01')).toBe(false);
    expect(read('./App.tsx')).toContain('v3AdminPreviewRequested(');
    expect(read('./App.tsx')).not.toContain('V3 預覽 · 未連接正式站點');
  });
  it('retains the same service, assets binding, Durable Objects and migration identities',()=>{
    const old=json('../../v2admin/wrangler.jsonc'),release=json('../wrangler.release.jsonc');
    expect(release).toEqual(old);
    expect(release.name).toBe('mfk-admin');
    expect(release.main).toBe('./worker.ts');
    expect(release.assets.directory).toBe('./dist');
    expect(release.assets.binding).toBe('ASSETS');
    for(const key of ['durable_objects','migrations','r2_buckets','vars','secrets'])expect(release[key]).toEqual(old[key]);
  });
  it('retains the four dependency modules byte-identically without runtime v2 imports',()=>{
    for(const name of ['customer-runtime.ts','keeta-runtime.ts','keeta-menu-projection.ts','keeta-store-projection.ts']){
      const source=read('../'+name);expect(source).toBe(read('../../v2admin/'+name));expect(source).not.toMatch(/from ['"][^'"]*v2admin/);
    }
  });
  it.each(['/api/customer/channel-health','/api/customer/snapshot?submissionId=synthetic','/api/customer/orders/readback?submissionId=synthetic','/api/customer/orders/submit','/api/customer/payment-evidence','/api/customer/payment-qr?ref=synthetic','/api/customer/future-route'])('fails closed before touching data for unresolved public route %s',async(path)=>{
    for(const method of ['GET','POST','PUT','DELETE','OPTIONS']){
      const touched=vi.fn(()=>{throw new Error('DATA_SHOULD_NOT_BE_TOUCHED');});
      const env=new Proxy({}, {get:touched});
      const result=await worker.fetch(new Request('https://admin.morefunos.com'+path,{method}),env);
      expect(result.status).toBe(503);expect(await result.json()).toEqual({code:'V3_CUSTOMER_PROVIDER_NOT_BOUND',state:'UNAVAILABLE'});expect(touched).not.toHaveBeenCalled();
    }
  });
  it('preserves Admin auth routing, store identity and request method',async()=>{
    const fetcher=vi.fn(async(request:Request)=>new Response(JSON.stringify({pathname:new URL(request.url).pathname,storeId:new URL(request.url).searchParams.get('storeId'),method:request.method})));
    const idFromName=vi.fn((id:string)=>id),get=vi.fn(()=>({fetch:fetcher}));
    const result=await worker.fetch(new Request('https://admin.morefunos.com/api/admin-browser/auth/challenge?storeId=MF01',{method:'POST',body:'{}',headers:{'content-type':'application/json'}}),{ADMIN_SYNC:{idFromName,get}});
    expect(await result.json()).toEqual({pathname:'/admin-browser/auth/challenge',storeId:'MF01',method:'POST'});expect(idFromName).toHaveBeenCalledWith('MF01');
  });
  it('serves V3 assets through the same binding and exposes server source health separately',async()=>{
    const assets=vi.fn(async()=>new Response('<html>V3 real client</html>',{headers:{'content-type':'text/html'}}));
    const env={ASSETS:{fetch:assets},MFK_SOURCE_SHA:'test-exact-server-source'};
    const html=await worker.fetch(new Request('https://admin.morefunos.com/admin/catalog/products'),env);
    expect(await html.text()).toContain('V3 real client');expect(html.headers.get('cache-control')).toContain('no-store');
    const health=await worker.fetch(new Request('https://admin.morefunos.com/api/health'),env);
    expect(await health.json()).toEqual({ok:true,service:'mfk-admin',sourceSha:'test-exact-server-source',configurationWritesEnabled:false});
  });
  it('removes periodic business polling while retaining invalidation and reconnect reads',()=>{
    const app=read('./App.tsx'),models=read('./formal-read-model.tsx');
    expect(app).not.toContain('refetchInterval:V3_DATA_REFETCH_INTERVAL_MS');expect(models).not.toContain('refetchInterval:V3_DATA_REFETCH_INTERVAL_MS');
    expect(models.match(/refetchInterval:false/g)?.length).toBe(6);expect(app).toContain('refetchInterval:false');
    for(const source of [app,models]){expect(source).toContain("refetchOnMount:'always'");expect(source).toContain('refetchOnReconnect:true');}
    expect(models).not.toContain('new WebSocket');expect(models).not.toContain('window.setTimeout(connect');
    expect(models).toContain("V3_OPERATIONAL_EVENT_CHANNEL_STATUS='UNBOUND'");
  });
});


describe('preservation-only configuration gate',()=>{
  it.each([undefined,'','0','true','false','yes'])('defaults client and server to locked for %s',value=>{
    expect(v3AdminConfigurationWritesEnabled(value)).toBe(false);
    expect(v3ConfigurationWriteBlocked('/publish','POST',value)).toBe(true);
  });
  it('accepts only exact explicit enablement',()=>{
    expect(v3AdminConfigurationWritesEnabled('1')).toBe(true);
    expect(v3ConfigurationWriteBlocked('/publish','POST','1')).toBe(false);
  });
  it.each(['/publish','/admin-browser/publish','/admin-browser/draft','/admin-browser/draft/products','/admin-browser/draft/publish','/admin-browser/versions/rollback'])('blocks internal config writes before state access: %s',async(path)=>{
    for(const method of ['POST','PUT','DELETE','PATCH']){
      const touched=vi.fn(()=>{throw new Error('NO_STORAGE_ACCESS_ALLOWED');});
      const instance=new AdminSyncStore(new Proxy({}, {get:touched}),{});
      const response=await instance.fetch(new Request('https://internal'+path,{method,body:'{}'}));
      expect(response.status).toBe(423);expect(await response.json()).toEqual({code:'V3_CONFIG_PRESERVATION_READ_ONLY',state:'LOCKED'});expect(touched).not.toHaveBeenCalled();
    }
  });
  it.each(['/api/admin-sync/publish','/api/admin-browser/draft','/api/admin-browser/draft/products','/api/admin-browser/draft/publish','/api/admin-browser/versions/rollback','/api/admin-sync/admin-browser/draft/publish','/api/admin/payment-qr'])('blocks outer config aliases before data lookup: %s',async(path)=>{
    const response=await worker.fetch(new Request('https://admin.morefunos.com'+path,{method:'POST',body:'{}'}),{});
    expect(response.status).toBe(path.startsWith('/api/admin-sync/')?503:423);
  });
  it('retains auth/session/read requests and does not relabel financial writes as config',()=>{
    for(const path of ['/admin-browser/auth/challenge','/admin-browser/auth/verify','/admin-browser/auth/session'])expect(v3ConfigurationWriteBlocked(path,'POST',undefined)).toBe(false);
    for(const path of ['/admin-browser/draft','/admin-browser/active','/admin-browser/versions'])expect(v3ConfigurationWriteBlocked(path,'GET',undefined)).toBe(false);
    expect(v3ConfigurationWriteBlocked('/refunds','POST',undefined)).toBe(false);
  });
  it('full mode still invokes original auth checks rather than bypassing them',async()=>{
    const instance=new AdminSyncStore({}, {MFP_V3_CONFIG_WRITES_ENABLED:'1'});
    const auth=vi.spyOn(instance,'readAdminBrowserSession').mockResolvedValue(null);
    const response=await instance.fetch(new Request('https://internal/admin-browser/draft',{method:'PUT',body:'{}'}));
    expect(response.status).toBe(401);expect(auth).toHaveBeenCalledOnce();
  });
});


describe('unreviewed generic native/projection boundary',()=>{
  it.each(['/api/admin-sync/active','/api/admin-sync/acks','/api/admin-sync/events','/api/admin-sync/publish','/api/admin-sync/dining-occupancy','/api/admin-sync/admin-browser/active','/api/projection/orders','/api/projection/reports','/api/projection/events'])('never exposes generic storage/provider route %s',async(path)=>{
    for(const method of ['GET','POST','PUT','DELETE','OPTIONS']){
      const touched=vi.fn(()=>{throw new Error('GENERIC_PROVIDER_MUST_NOT_TOUCH_STATE');});
      const response=await worker.fetch(new Request('https://admin.morefunos.com'+path,{method}),new Proxy({}, {get:touched}));
      expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'V3_GENERIC_PROVIDER_NOT_BOUND',state:'UNAVAILABLE'});expect(touched).not.toHaveBeenCalled();
    }
  });
  it('config-write enablement never unlocks unauthenticated generic providers',async()=>{
    const response=await worker.fetch(new Request('https://admin.morefunos.com/api/admin-sync/active'),{MFP_V3_CONFIG_WRITES_ENABLED:'1'});
    expect(response.status).toBe(503);
  });
});
