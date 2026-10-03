import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import worker from './linked-test-worker.ts';
import {LINKED_SCOPE,type LinkedEnv} from '../../integrations/v3-linked-test.ts';
import type {FormalTestAcceptanceEnv} from './formal-test-acceptance-worker.ts';

function fixture(flag:string|undefined='1'){
  const admin=vi.fn(async(request:Request)=>new Response(JSON.stringify(new URL(request.url).pathname==='/linked-test/ready'?{ready:true}:{scope:LINKED_SCOPE,products:[]}),{headers:{'content-type':'application/json'}}));
  const customer=vi.fn(async()=>new Response(JSON.stringify({scope:LINKED_SCOPE,requests:[],formalOrders:false}),{headers:{'content-type':'application/json'}}));
  const ids=vi.fn((id:string)=>id);const assets=vi.fn(async()=>new Response('POS assets'));
  const env:FormalTestAcceptanceEnv&LinkedEnv={MFP_V3_LINKED_TEST_ENABLED:flag,ASSETS:{fetch:assets},MFK_SOURCE_SHA:'a'.repeat(40),MFK_BUILD_ID:'test-build',MFK_VERSION:{id:'version',timestamp:'2026-10-03T00:00:00Z'},ADMIN_SYNC:{idFromName:ids,get:()=>({fetch:admin})},CUSTOMER_RUNTIME:{idFromName:ids,get:()=>({fetch:customer})}};
  const req=(path:string,method='GET',body?:unknown)=>worker.fetch(new Request('https://smt.morefunos.com'+path,{method,headers:{origin:'https://smt.morefunos.com'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return{env,req,admin,customer,ids,assets};
}
describe('formal mfk-smt-web linked gateway',()=>{
  it('routes catalog and inbox to the shared isolated existing DO names',async()=>{const f=fixture();expect((await f.req('/api/v3-test/catalog')).status).toBe(200);expect((await f.req('/api/v3-test/requests')).status).toBe(200);expect(f.ids.mock.calls.every(([id])=>id===LINKED_SCOPE)).toBe(true);expect(f.customer).toHaveBeenCalledOnce();expect(f.assets).not.toHaveBeenCalled();});
  it.each([undefined,'0','true','01'])('fails closed before binding access with disabled/malformed flag %s',async flag=>{const f=fixture(flag);f.env.MFP_V3_LINKED_TEST_ENABLED=flag;expect((await f.req('/api/v3-test/catalog')).status).toBe(503);expect(f.ids).not.toHaveBeenCalled();});
  it.each(['/api/orders','/api/checkout','/api/projection/orders','/api/admin-sync/active','/api/customer/orders/submit','/__mfk/smm-acceptance/pending'])('keeps generic provider %s closed',async path=>{const f=fixture();expect((await f.req(path)).status).toBe(503);expect(f.ids).not.toHaveBeenCalled();expect(f.assets).not.toHaveBeenCalled();});
  it.each(['/session','/submit','/readback','/api/admin-browser/active','/api/admin-browser/draft/publish'])('does not admit non-POS path %s',async path=>{const f=fixture();expect((await f.req('/api/v3-test'+path,'POST',{})).status).toBe(403);expect(f.ids).not.toHaveBeenCalled();});
  it('rejects foreign-origin reviews without storage access',async()=>{const f=fixture();const result=await worker.fetch(new Request('https://smt.morefunos.com/api/v3-test/review',{method:'POST',headers:{origin:'https://attacker.invalid'},body:'{}'}),f.env);expect(result.status).toBe(403);expect(f.ids).not.toHaveBeenCalled();});
  it('preserves exact source/version metadata while reporting formal capabilities false',async()=>{const f=fixture();const body=await(await f.req('/__mfk/health')).json();expect(body).toMatchObject({sourceSha:'a'.repeat(40),buildId:'test-build',deployedAt:'2026-10-03T00:00:00Z',linkedTestEnabled:true,mode:'CONNECTED_TEST',formalOrderCreated:false,paymentConfirmed:false,formalCheckoutConnected:false,physicalPrintConnected:false,cashDrawerConnected:false,backendProxy:false});});
  it('retains the original flag-off acceptance response and assets',async()=>{const f=fixture('0');const body=await(await f.req('/__mfk/health')).json();expect(body.mode).toBe('TEST_ACCEPTANCE');expect((await f.req('/')).status).toBe(200);expect(f.assets).toHaveBeenCalledOnce();});
  it('targets only formal mfk-smt-web with retained asset/version bindings and existing external DO classes',()=>{const config=JSON.parse(readFileSync(new URL('../wrangler.linked-test.jsonc',import.meta.url),'utf8'));expect(config.name).toBe('mfk-smt-web');expect(config.assets.binding).toBe('ASSETS');expect(config.version_metadata.binding).toBe('MFK_VERSION');expect(config.keep_vars).toBe(true);expect(config.durable_objects.bindings).toEqual([{name:'ADMIN_SYNC',class_name:'AdminSyncStore',script_name:'mfk-admin'},{name:'CUSTOMER_RUNTIME',class_name:'CustomerRuntimeStore',script_name:'mfk-admin'}]);expect(config.routes).toEqual([{pattern:'smt.morefunos.com',custom_domain:true,zone_name:'morefunos.com'}]);for(const key of ['migrations','d1_databases','kv_namespaces','r2_buckets','secrets'])expect(config).not.toHaveProperty(key);});
});
