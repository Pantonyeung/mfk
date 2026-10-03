import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {parseLinkedCatalog,linkedLine,LinkedSubmission,parseLinkedStatus,LINKED_STORAGE_KEY} from '../src/linked-test-model.ts';
export const catalog={scope:'MFP_V3_LINKED_TEST_MF01_20261003',mode:'CONNECTED_TEST',fingerprint:'published-one',revision:1,publishedAt:'2026-10-03T01:00:00Z',categories:[{id:'c1',name:'飯糰'}],products:[{id:'p1',name:'測試飯糰',description:'已發布商品',categoryId:'c1',priceMinor:4100,available:true,unavailableReason:'',options:[{id:'g1',name:'飯量',min:1,max:1,defaults:['o1'],choices:[{id:'o1',name:'正常',adjustmentMinor:0},{id:'o2',name:'加飯',adjustmentMinor:500}]}]}],formalCheckoutConnected:false,physicalPrintConnected:false};
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const status=id=>({submissionId:id,state:'PENDING_SMT',reviewState:'UNSEEN',reviewedAt:null,message:'server text',formalOrderCreated:false,paymentConfirmed:false});
const line=()=>linkedLine(parseLinkedCatalog(catalog), 'p1', 2,{g1:['o1']});
test('canonical catalog preserves prices/options/defaults; malformed data fails closed',()=>{
  assert.deepEqual(parseLinkedCatalog(catalog),catalog);
  for(const change of [{mode:'PREVIEW'},{formalCheckoutConnected:true},{formalOrderCreated:true},{paymentConfirmed:'false'},{products:[{...catalog.products[0],priceMinor:'41'}]},{products:[{...catalog.products[0],options:[{...catalog.products[0].options[0],defaults:['missing']}]}]}])assert.throws(()=>parseLinkedCatalog({...catalog,...change}));
  assert.equal(line().publishedUnitPriceMinor,4100);assert.equal(line().selections[0].optionId,'o1');
  assert.throws(()=>linkedLine(catalog,'p1',1,{g1:[]}));assert.throws(()=>linkedLine(catalog,'p1',1,{g1:['o1','o2']}));assert.throws(()=>linkedLine(catalog,'p1',0,{g1:['o1']}));
});
test('stable UUID, durable exact payload, repeated clicks and concurrent retries coalesce',async()=>{
  const memory=storage();let calls=0,release;const api=async(path,method,body)=>{calls++;await new Promise(r=>release=r);return status(body.submissionId);};
  const model=new LinkedSubmission(memory,api);const draft=model.prepare(catalog,[line()]);
  assert.match(draft.submissionId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(draft.idempotencyKey,'V3:'+draft.submissionId);assert.equal(draft.checkout.paymentMethod,'PAY_AT_STORE');
  assert.equal(memory.getItem(LINKED_STORAGE_KEY),JSON.stringify(draft));
  const one=model.submit(),two=model.submit();assert.equal(calls,1);release();assert.deepEqual(await one,await two);
  assert.throws(()=>model.prepare(catalog,[line()]),/EXISTING/);
});
test('reload and network retry retain exact payload and read canonical status',async()=>{
  const memory=storage();const first=new LinkedSubmission(memory,async()=>{throw Error('offline');});const draft=first.prepare(catalog,[line()]);await assert.rejects(first.submit(),/offline/);
  const calls=[];const restored=new LinkedSubmission(memory,async(path,method,body)=>{calls.push({path,body});return {...status(draft.submissionId),reviewState:'SEEN'};});
  assert.deepEqual(restored.intent,draft);assert.equal((await restored.readback()).reviewState,'SEEN');await restored.submit();assert.deepEqual(calls[1].body,draft);
});
test('storage corruption or unavailable persistence never generates replacement request',()=>{
  const memory=storage();memory.setItem(LINKED_STORAGE_KEY,'not json');assert.throws(()=>new LinkedSubmission(memory,async()=>{}),/STORAGE/);assert.equal(memory.getItem(LINKED_STORAGE_KEY),'not json');
  const denied={getItem:()=>null,setItem:()=>{throw Error('denied');}};const model=new LinkedSubmission(denied,async()=>{});assert.throws(()=>model.prepare(catalog,[line()]),/STORAGE/);assert.equal(model.intent,null);
});
test('status validation refuses formal success, malformed statuses and mismatched identity',()=>{
  const id=crypto.randomUUID();assert.equal(parseLinkedStatus({...status(id),state:'REJECTED'},id).state,'REJECTED');
  for(const change of [{state:'CONFIRMED'},{state:'PAID'},{reviewState:'COMMITTED'},{formalOrderCreated:true},{paymentConfirmed:true},{formalCheckoutConnected:true},{physicalPrintConnected:'false'},{submissionId:crypto.randomUUID()}])assert.throws(()=>parseLinkedStatus({...status(id),...change},id));
});
test('build flag and worker configuration keep exact opt-in and existing bindings',()=>{
  const root=new URL('../',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
  assert.match(read('src/main.tsx'),/import\.meta\.env\.VITE_MFP_V3_LINKED_TEST==='1'/);
  const cfg=JSON.parse(read('wrangler.linked-test.jsonc'));assert.equal(cfg.name,'mfk-customer');assert.equal(cfg.vars.MFP_V3_LINKED_TEST_ENABLED,'1');assert.equal(cfg.migrations,undefined);
  assert.deepEqual(cfg.durable_objects.bindings,[{name:'ADMIN_SYNC',class_name:'AdminSyncStore',script_name:'mfk-admin'},{name:'CUSTOMER_RUNTIME',class_name:'CustomerRuntimeStore',script_name:'mfk-admin'}]);
  assert.equal(cfg.r2_buckets[0].bucket_name,'mfk-customer-assets');assert.ok(cfg.assets.run_worker_first.includes('/api/*'));
});
test('canonical optional single-choice group accepts an empty selection and exposes a clear radio',()=>{
  const optional={...catalog,products:[{...catalog.products[0],options:[{...catalog.products[0].options[0],min:0}]}]};
  assert.deepEqual(linkedLine(optional,'p1',1,{g1:[]}).selections,[]);
  const ui=readFileSync(new URL('../src/linked-test-app.tsx',import.meta.url),'utf8');
  assert.match(ui,/group\.min===0&&group\.max===1/);assert.match(ui,/不選擇\{group\.name\}/);
});
test('explicit new request requires fresh SEEN or REJECTED and preserves exact previous identity on reload',async()=>{
  for(const state of ['SEEN','REJECTED']){
    const memory=storage();let canonical='UNSEEN';const api=async(path,method,body)=>({...status(body.submissionId),reviewState:canonical,state:canonical==='REJECTED'?'REJECTED':'PENDING_SMT'});
    const model=new LinkedSubmission(memory,api),first=model.prepare(catalog,[line()]);await model.submit();
    await assert.rejects(model.startNew(),/NOT_RESOLVED/);assert.deepEqual(model.intent,first);
    canonical=state;await Promise.all([model.startNew(),model.startNew()]);assert.equal(model.intent,null);assert.deepEqual(model.archived,[first]);
    const reload=new LinkedSubmission(memory,api);assert.equal(reload.intent,null);assert.deepEqual(reload.archived,[first]);const second=reload.prepare(catalog,[line()]);assert.notEqual(second.submissionId,first.submissionId);assert.deepEqual(reload.archived,[first]);
    assert.equal((await reload.readArchived(first.submissionId)).submissionId,first.submissionId);assert.deepEqual(reload.intent,second);await reload.submit();assert.deepEqual(new LinkedSubmission(memory,api).intent,second);
  }
});
test('unknown readback, failed atomic archive persistence and stale cross-tab state block new request',async()=>{
  const memory=storage();let fail=false,unknown=false;const api=async(path,method,body)=>{if(unknown)throw Error('UNKNOWN');return {...status(body.submissionId),reviewState:'SEEN'};};
  const port={getItem:memory.getItem,setItem:(key,value)=>{if(fail)throw Error('quota');memory.setItem(key,value);}};
  const model=new LinkedSubmission(port,api),first=model.prepare(catalog,[line()]);unknown=true;await assert.rejects(model.startNew(),/UNKNOWN/);assert.deepEqual(model.intent,first);
  unknown=false;fail=true;await assert.rejects(model.startNew(),/STORAGE/);assert.deepEqual(model.intent,first);assert.deepEqual(new LinkedSubmission(memory,api).intent,first);assert.deepEqual(model.archived,[]);
  fail=false;const stale=new LinkedSubmission(memory,api);await model.startNew();const second=model.prepare(catalog,[line()]);await assert.rejects(stale.startNew(),/STORAGE_CHANGED/);assert.deepEqual(new LinkedSubmission(memory,api).intent,second);
  memory.setItem(LINKED_STORAGE_KEY,'broken');await assert.rejects(model.startNew(),/STORAGE/);
});
test('present empty storage is corruption, not permission for a replacement identity',()=>{
  const memory=storage();memory.setItem(LINKED_STORAGE_KEY,'');assert.throws(()=>new LinkedSubmission(memory,async()=>{}),/STORAGE/);assert.equal(memory.getItem(LINKED_STORAGE_KEY),'');
});
test('async rollover rejects late proof after another tab changes storage and serializes with retry',async()=>{
  const memory=storage();let release;const slow=new LinkedSubmission(memory,async(path,method,body)=>await new Promise(resolve=>release=()=>resolve({...status(body.submissionId),reviewState:'SEEN'})));
  const first=slow.prepare(catalog,[line()]);const rollover=slow.startNew();await assert.rejects(slow.submit(),/BUSY/);
  const other=new LinkedSubmission(memory,async(path,method,body)=>({...status(body.submissionId),reviewState:'SEEN'}));await other.startNew();const second=other.prepare(catalog,[line()]);release();await assert.rejects(rollover,/STORAGE_CHANGED/);assert.deepEqual(slow.intent,first);assert.deepEqual(new LinkedSubmission(memory,async()=>{}).intent,second);
});
test('archived canonical reads ignore stale success, stale failure, different identity and invalidated reads',async()=>{
  const {LinkedArchiveRead}=await import('../src/linked-test-model.ts');const gate=new LinkedArchiveRead(),pending=[],shown=[];
  const load=id=>new Promise((resolve,reject)=>pending.push({id,resolve,reject}));
  const one=gate.run('old',load,(id,value)=>shown.push([id,value]),(id,error)=>shown.push([id,error.message]));
  const two=gate.run('old',load,(id,value)=>shown.push([id,value]),(id,error)=>shown.push([id,error.message]));
  pending[1].resolve('REJECTED');await two;pending[0].resolve('SEEN');await one;assert.deepEqual(shown,[['old','REJECTED']]);
  const a=gate.run('A',load,(id,value)=>shown.push([id,value]),(id,error)=>shown.push([id,error.message]));const b=gate.run('B',load,(id,value)=>shown.push([id,value]),(id,error)=>shown.push([id,error.message]));pending[3].resolve('PENDING');await b;pending[2].reject(Error('stale error'));await a;assert.deepEqual(shown.at(-1),['B','PENDING']);
  const last=gate.run('B',load,(id,value)=>shown.push([id,value]),(id,error)=>shown.push([id,error.message]));gate.invalidate();pending[4].resolve('SEEN');await last;assert.equal(shown.length,2);
});
