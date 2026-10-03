import {describe,it,expect} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import * as loaded from '../linked-test-worker.ts';

const worker=loaded.default;
class Storage{
  data=new Map<string,any>();
  async get(k:string){return structuredClone(this.data.get(k));}
  async put(k:string,v:any){this.data.set(k,structuredClone(v));}
  async delete(k:string){return this.data.delete(k);}
  async list({prefix='',limit=1000}:any={}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
}
function fixture(){
  const env:any={MFP_V3_LINKED_TEST_ENABLED:'1',MFP_V3_CONFIG_WRITES_ENABLED:'0',ASSETS:{fetch:async()=>new Response('unchanged assets',{status:404})}};
  function namespace(C:any){const objects=new Map<string,any>();return {idFromName:(n:string)=>n,get:(id:string)=>{if(!objects.has(id)){let queue=Promise.resolve();const state={id,storage:new Storage(),getWebSockets:()=>[],blockConcurrencyWhile:(fn:any)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;}};objects.set(id,new C(state,env));}return objects.get(id);}};}
  env.ADMIN_SYNC=namespace(loaded.AdminSyncStore);env.CUSTOMER_RUNTIME=namespace(loaded.CustomerRuntimeStore);
  const source=env.ADMIN_SYNC.get('MF01');
  source.state.storage.data.set('active',createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:'2026-10-03T01:00:00Z',adminFingerprint:'fixture-only',snapshot:{catalog:{categories:[{id:'c1',name:'測試分類',active:true}],products:[{id:'p1',productCode:'1001',name:'測試商品',categoryId:'c1',basePrice:'41.00',description:'',active:true,modifierGroupIds:[]}]},optionCenter:{sets:[],productLinks:[]},staffAuth:{staff:[{staffId:'PRIVATE_STAFF',pinVerifier:{hashHex:'NEVER_EXPORT'}}]},privateToken:'NEVER_EXPORT'}}));
  const req=(path:string,method='GET',body?:unknown,token?:string,host='admin.morefunos.com')=>worker.fetch(new Request('https://'+host+path,{method,headers:{origin:'https://'+host,'content-type':'application/json',...(token?{'x-mfk-admin-session':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return {env,source,req};
}

describe('V3 connected test journey over existing authorities',()=>{
  it('opens a scoped test session while keeping original staff and credentials private',async()=>{
    const {req,source}=fixture();const r=await req('/api/v3-test/session','POST',{});expect(r.status).toBe(200);
    const session=await r.json();expect(session.sessionToken.length).toBeGreaterThanOrEqual(32);
    const active=await req('/api/v3-test/api/admin-browser/active','GET',undefined,session.sessionToken);
    expect(active.status).toBe(200);const body=await active.json();expect(body.snapshot.catalog.products[0].id).toBe('p1');expect(JSON.stringify(body)).not.toContain('NEVER_EXPORT');expect(body.snapshot.staffAuth).toBeUndefined();
    expect((await source.state.storage.get('active')).snapshot.staffAuth.staff[0].staffId).toBe('PRIVATE_STAFF');
  });
});

import {linkedGateway,LINKED_SCOPE,internal} from '../../integrations/v3-linked-test.ts';
async function start(){const f=fixture();const session=await(await f.req('/api/v3-test/session','POST',{})).json();const active=await(await f.req('/api/v3-test/api/admin-browser/active','GET',undefined,session.sessionToken)).json();return {...f,session,active};}
function intent(fingerprint:string){const id=crypto.randomUUID();return {schema:'MFK_CUSTOMER_ORDER_INTENT_V1',storeId:'MF01',submissionId:id,idempotencyKey:'V3:'+id,menuRevision:fingerprint,createdAt:'2026-10-03T01:00:00Z',updatedAt:'2026-10-03T01:00:00Z',cart:[{lineId:crypto.randomUUID(),productId:'p1',productName:'測試商品',quantity:1,selections:[],publishedUnitPriceMinor:4100}],checkout:{name:'測試顧客',phone:'00000000',paymentMethod:'PAY_AT_STORE'}};}
async function gateway(env:any,surface:'admin'|'customer'|'pos',path:string,method='GET',body?:any){return (await linkedGateway(new Request('https://'+surface+'.morefunos.com/api/v3-test'+path,{method,headers:{origin:'https://'+surface+'.morefunos.com','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,surface))!;}
describe('cross-surface real persistence contract',()=>{
  it('publishes the same saved draft into the catalog consumed by Customer and POS, without touching original MF01',async()=>{
    const {env,req,session,active,source}=await start();active.snapshot.catalog.products[0].basePrice='43.00';
    const save=await req('/api/v3-test/api/admin-browser/draft','PUT',{baseFingerprint:active.fingerprint,basePublishedAt:active.publishedAt,snapshot:active.snapshot},session.sessionToken);expect(save.status).toBe(200);const draft=await save.json();
    const before=await(await gateway(env,'customer','/catalog')).json();expect(before.products[0].priceMinor).toBe(4100);
    const pub=await req('/api/v3-test/api/admin-browser/draft/publish','POST',{draftId:draft.draftId,expectedDraftRevision:draft.draftRevision},session.sessionToken);expect(pub.status).toBe(200);
    const after=await(await gateway(env,'customer','/catalog')).json(),pos=await(await gateway(env,'pos','/catalog')).json();expect(after.products[0].priceMinor).toBe(4300);expect(pos).toEqual(after);expect(after.fingerprint).not.toBe(active.fingerprint);expect((await source.state.storage.get('active')).snapshot.catalog.products[0].basePrice).toBe('41.00');
  });
  it('submits once, lists the persisted request in POS/Admin, and returns POS seen status to the submitting customer',async()=>{
    const {env,active}=await start();const input=intent(active.fingerprint);
    const r=await gateway(env,'customer','/submit','POST',input);expect(r.status).toBe(202);
    const pos=await(await gateway(env,'pos','/requests')).json(),admin=await(await gateway(env,'admin','/requests')).json();expect(pos.requests.length).toBe(1);expect(admin.requests[0].submissionId).toBe(input.submissionId);
    const review=await gateway(env,'pos','/review','POST',{submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,reviewState:'SEEN'});expect(review.status).toBe(200);
    const status=await(await gateway(env,'customer','/readback','POST',{submissionId:input.submissionId,idempotencyKey:input.idempotencyKey})).json();expect(status.reviewState).toBe('SEEN');expect(status.formalOrderCreated).toBe(false);expect(status.paymentConfirmed).toBe(false);
    expect((await(await gateway(env,'customer','/submit','POST',input)).json()).reviewState).toBe('SEEN');expect((await(await gateway(env,'pos','/requests')).json()).requests.length).toBe(1);
  });
  it('serializes concurrent duplicate submission without generating two inbox records',async()=>{const {env,active}=await start(),input=intent(active.fingerprint);const results=await Promise.all(Array.from({length:5},()=>gateway(env,'customer','/submit','POST',input)));expect(results.every(r=>r.ok)).toBe(true);expect((await(await gateway(env,'pos','/requests')).json()).requests.length).toBe(1);});
  it('rejects different payload using an existing submission identity',async()=>{const {env,active}=await start(),input=intent(active.fingerprint);await gateway(env,'customer','/submit','POST',input);input.cart[0].quantity=2;expect((await gateway(env,'customer','/submit','POST',input)).status).toBe(409);});
  it.each(['price','menu','option','electronic','combo'])('rejects untrusted or unsupported submission: %s',async kind=>{const {env,active}=await start(),input:any=intent(active.fingerprint);if(kind==='price')input.cart[0].publishedUnitPriceMinor=1;if(kind==='menu')input.menuRevision='stale';if(kind==='option')input.cart[0].selections=[{optionGroupId:'missing',optionId:'missing',optionName:'missing'}];if(kind==='electronic'){input.checkout.paymentMethod='ELECTRONIC';input.checkout.paymentChannelId='FPS';}if(kind==='combo')input.cart[0].selectedVariationId='invented';expect((await gateway(env,'customer','/submit','POST',input)).status).toBe(400);expect((await(await gateway(env,'pos','/requests')).json()).requests.length).toBe(0);});
  it('never accepts a synthetic COMMITTED or CONFIRMED acknowledgement',async()=>{const {env,active}=await start(),input=intent(active.fingerprint);await gateway(env,'customer','/submit','POST',input);for(const reviewState of ['COMMITTED','CONFIRMED','PAID'])expect((await gateway(env,'pos','/review','POST',{...input,reviewState})).status).toBe(400);});
  it('persists an explicit rejection and returns it to the customer',async()=>{const {env,active}=await start(),input=intent(active.fingerprint);await gateway(env,'customer','/submit','POST',input);await gateway(env,'pos','/review','POST',{...input,reviewState:'REJECTED'});expect((await(await gateway(env,'customer','/readback','POST',input)).json()).state).toBe('REJECTED');});
  it.each(['/session','/requests','/review','/api/admin-browser/active','/api/keeta/admin/status'])('does not expose privileged paths through the Customer surface: %s',async path=>{const {env}=await start();expect((await gateway(env,'customer',path,'POST',{})).status).toBe(403);});
  it('keeps old generic providers closed and original test tokens invalid for MF01',async()=>{const {req,session}=await start();for(const path of ['/api/admin-sync/active','/api/projection/orders','/api/customer/orders/submit'])expect((await req(path,'GET',undefined,session.sessionToken)).status).toBe(503);expect((await req('/api/admin-browser/active','GET',undefined,session.sessionToken)).status).toBe(401);});
  it('blocks security fields in a shared test draft',async()=>{const {req,session,active}=await start();active.snapshot.staffAuth={secret:'NEVER_WRITE'};expect((await req('/api/v3-test/api/admin-browser/draft','PUT',{baseFingerprint:active.fingerprint,basePublishedAt:active.publishedAt,snapshot:active.snapshot},session.sessionToken)).status).toBe(400);});
  it('retains draft CAS against stale concurrent edits',async()=>{const {req,session,active}=await start();const body={baseFingerprint:active.fingerprint,basePublishedAt:active.publishedAt,snapshot:active.snapshot};expect((await req('/api/v3-test/api/admin-browser/draft','PUT',body,session.sessionToken)).status).toBe(200);expect((await req('/api/v3-test/api/admin-browser/draft','PUT',body,session.sessionToken)).status).toBe(409);});
  it('fails closed when linked mode is disabled',async()=>{const {env}=fixture();env.MFP_V3_LINKED_TEST_ENABLED='0';expect((await gateway(env,'customer','/catalog')).status).toBe(503);});
  it('rejects cross-site browser writes before state access',async()=>{const {env}=fixture();const r=await linkedGateway(new Request('https://admin.morefunos.com/api/v3-test/session',{method:'POST',headers:{origin:'https://attacker.invalid'}}),env,'admin');expect(r?.status).toBe(403);});
  it('does not bootstrap into the original MF01 instance even with internal headers',async()=>{const {env,active}=await start();const r=await env.ADMIN_SYNC.get('MF01').fetch(internal('/linked-test/bootstrap','POST',{snapshot:active.snapshot}));expect(r.status).toBe(403);});
});
