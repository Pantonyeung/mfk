import assert from 'node:assert/strict';
import {test} from 'node:test';
import customer from '../linked-test-worker.ts';
import {AdminSyncStore,CustomerRuntimeStore} from '../../v3admin/linked-test-worker.ts';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {linkedGateway} from '../../integrations/v3-linked-test.ts';
import {LinkedSubmission,parseLinkedCatalog,linkedLine} from '../src/linked-test-model.ts';
class Storage{data=new Map();async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}async delete(k){return this.data.delete(k);}async list({prefix='',limit=1000}={}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}}
function fixture(){
  const env={MFP_V3_LINKED_TEST_ENABLED:'1',MFP_V3_CONFIG_WRITES_ENABLED:'0',ASSETS:{fetch:async()=>new Response('existing shell')},CUSTOMER_ASSETS:{get:async key=>({body:'existing artwork',httpEtag:'art-v1'})}};
  const namespace=Class=>{const values=new Map();return {idFromName:name=>name,get:id=>{if(!values.has(id)){let queue=Promise.resolve();const state={id,storage:new Storage(),getWebSockets:()=>[],blockConcurrencyWhile:fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;}};values.set(id,new Class(state,env));}return values.get(id);}};};
  env.ADMIN_SYNC=namespace(AdminSyncStore);env.CUSTOMER_RUNTIME=namespace(CustomerRuntimeStore);
  env.ADMIN_SYNC.get('MF01').state.storage.data.set('active',createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:'2026-10-03T01:00:00Z',adminFingerprint:'synthetic-only',snapshot:{catalog:{categories:[{id:'c1',name:'測試分類',active:true}],products:[{id:'p1',productCode:'1001',name:'測試飯糰',categoryId:'c1',basePrice:'41.00',description:'',active:true,modifierGroupIds:[]}]},optionCenter:{sets:[],productLinks:[]}}}));
  const request=(path,method='GET',body,headers={})=>new Request('https://order.morefunos.com'+path,{method,headers:{origin:'https://order.morefunos.com','content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const call=(path,method='GET',body,headers)=>customer.fetch(request(path,method,body,headers),env);
  return {env,call,request};
}
function memory(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
test('actual Customer wrapper routes catalog, durable submission, reload, concurrent exact retries and POS review',async()=>{
  const f=fixture(),catalog=parseLinkedCatalog(await(await f.call('/api/v3-test/catalog')).json());
  const api=async(path,method,body)=>{const response=await f.call('/api/v3-test'+path,method,body);assert.ok(response.ok);return response.json();};
  const disk=memory(),model=new LinkedSubmission(disk,api),intent=model.prepare(catalog,[linkedLine(catalog,'p1',2,{})]);
  const repeated=await Promise.all([model.submit(),model.submit(),model.submit()]);assert.ok(repeated.every(r=>r.submissionId===intent.submissionId));
  const independent=await Promise.all(Array.from({length:5},()=>f.call('/api/v3-test/submit','POST',intent)));assert.ok(independent.every(r=>r.ok));
  const list=await linkedGateway(f.request('/api/v3-test/requests'),f.env,'pos');assert.equal((await list.json()).requests.length,1);
  for(const reviewState of ['SEEN','REJECTED']){
    const r=await linkedGateway(f.request('/api/v3-test/review','POST',{submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey,reviewState}),f.env,'pos');assert.equal(r.status,200);
    const reload=new LinkedSubmission(disk,api),state=await reload.readback();assert.equal(reviewState==='REJECTED'?state.state:state.reviewState,reviewState);assert.equal(state.formalOrderCreated,false);assert.equal(state.paymentConfirmed,false);
  }
  const altered=structuredClone(intent);altered.cart[0].quantity=3;assert.equal((await f.call('/api/v3-test/submit','POST',altered)).status,409);
});
test('missing, malformed and disabled server flags fail closed before namespace or asset access',async()=>{
  for(const flag of [undefined,'0','true','01','1 ']){
    let touched=false;const env={MFP_V3_LINKED_TEST_ENABLED:flag,ADMIN_SYNC:{get:()=>{touched=true;throw Error('touched');}},ASSETS:{fetch:()=>{touched=true;throw Error('touched');}}};
    const r=await customer.fetch(new Request('https://order.morefunos.com/api/v3-test/catalog'),env);assert.equal(r.status,503);assert.equal((await r.json()).code,'LINKED_MODE_DISABLED');assert.equal(touched,false);
  }
});
test('malformed submit, wrong methods, cross-site access and privileged routes remain closed',async()=>{
  const {call,env}=fixture();assert.equal((await call('/api/v3-test/submit','POST',{})).status,400);
  for(const path of ['/catalog','/submit','/readback'])assert.equal((await call('/api/v3-test'+path,'DELETE')).status,405);
  for(const path of ['/session','/requests','/review','/api/admin-browser/active'])assert.equal((await call('/api/v3-test'+path,'POST',{})).status,403);
  assert.equal((await call('/api/v3-test/catalog','GET',undefined,{origin:'https://attacker.invalid'})).status,403);
  for(const path of ['/api/customer/orders/submit','/api/admin-sync/active','/api/projection/orders','/api/v3-test','/api']){const r=await call(path);assert.equal(r.status,503);assert.equal((await r.json()).code,'CUSTOMER_PROVIDER_UNAVAILABLE');}
  const malformed=await customer.fetch(new Request('https://order.morefunos.com/api/v3-test/submit',{method:'POST',body:'{bad',headers:{'content-type':'application/json'}}),env);assert.equal(malformed.status,400);
});
test('existing shell and immutable R2 media paths remain served without uploads',async()=>{
  const {call}=fixture();assert.equal(await(await call('/')).text(),'existing shell');
  const media=await call('/media/customer/hero/hero-male-main.png');assert.equal(media.status,200);assert.equal(media.headers.get('x-mfk-asset-key'),'customer/brand/hero/hero-male-main.png');assert.equal(await media.text(),'existing artwork');assert.equal((await call('/media/customer/hero/hero-male-main.png','POST',{})).status,405);
});
