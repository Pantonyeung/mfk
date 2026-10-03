import {describe,it,expect,vi} from 'vitest';
import {createLinkedPosController,decodeLinkedCatalog,decodeLinkedInbox,decodeLinkedStatus,isLinkedPosEnabled} from './linked-pos.ts';
import {LINKED_SCOPE} from '../../integrations/v3-linked-test.ts';

const id='12345678-1234-1234-1234-123456789abc';
export const status=()=>({submissionId:id,state:'PENDING_SMT',reviewState:'UNSEEN',reviewedAt:null,message:'Received',formalOrderCreated:false,paymentConfirmed:false});
export const row=()=>({...status(),cart:[{productName:'飯糰',quantity:2,selections:[{optionName:'少飯'}]}],checkout:{name:'測試客人',phone:'00000000'},receivedAt:'2026-10-03T01:00:00Z',idempotencyKey:'V3:'+id});
export const inbox=()=>({scope:LINKED_SCOPE,requests:[row()],formalOrders:false});
export const catalog=()=>({scope:LINKED_SCOPE,mode:'CONNECTED_TEST',fingerprint:'fingerprint',revision:1,publishedAt:'2026-10-03T01:00:00Z',categories:[{id:'rice',name:'飯糰'}],products:[{id:'p1',name:'飯糰',description:'',categoryId:'rice',priceMinor:4100,available:true,unavailableReason:'',options:[{id:'rice-option',name:'飯量',min:1,max:1,defaults:['small'],choices:[{id:'small',name:'少飯',adjustmentMinor:-100}]}]}],formalCheckoutConnected:false,physicalPrintConnected:false});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{resolve,reject,promise};};
function setup(){
  let current=inbox();const events=new Map<string,()=>void>();
  const request=vi.fn(async(path:string,_method?:string,_body?:unknown,_signal?:AbortSignal):Promise<unknown>=>path==='/catalog'?catalog():path==='/requests'?structuredClone(current):status());
  const stop=vi.fn();const subscribe=vi.fn((topic:'catalog'|'request',callback:()=>void)=>{events.set(topic,callback);return stop;});
  const controller=createLinkedPosController({enabled:true,request,subscribe});
  return{controller,request,subscribe,stop,events,setInbox:(next:ReturnType<typeof inbox>)=>{current=next;}};
}

describe('connected POS response boundary',()=>{
  it('only enables on an exact build flag',()=>{expect(isLinkedPosEnabled('1')).toBe(true);for(const value of [undefined,'0','true',1,true,'01'])expect(isLinkedPosEnabled(value)).toBe(false);});
  it('decodes canonical test catalog and inbox without turning them into orders',()=>{expect(decodeLinkedCatalog(catalog()).products[0].options[0].choices[0].adjustmentMinor).toBe(-100);expect(decodeLinkedInbox(inbox())[0].formalOrderCreated).toBe(false);});
  it.each(['COMMITTED','CONFIRMED','PAID','PRINTED','UNKNOWN'])('rejects status %s',state=>{expect(()=>decodeLinkedStatus({...status(),state})).toThrow();expect(()=>decodeLinkedInbox({...inbox(),requests:[{...row(),reviewState:state}]})).toThrow();});
  it.each(['formalOrderCreated','paymentConfirmed','formalCheckoutConnected','physicalPrintConnected'])('rejects a true %s claim',key=>{expect(()=>decodeLinkedStatus({...status(),[key]:true})).toThrow();expect(()=>decodeLinkedCatalog({...catalog(),[key]:true})).toThrow();});
  it('rejects malformed and duplicate inbox identities',()=>{for(const value of [null,{},[],{...inbox(),scope:'MF01'},{...inbox(),formalOrders:true},{...inbox(),requests:[row(),row()]},{...inbox(),requests:[{...row(),idempotencyKey:'wrong'}]},{...inbox(),requests:[{...row(),cart:[{productName:'bad',quantity:-1,selections:[]}]}]}])expect(()=>decodeLinkedInbox(value)).toThrow();});
  it('rejects malformed catalog prices and options rather than inventing defaults',()=>{const base=catalog();for(const patch of [{priceMinor:'41.00'},{priceMinor:NaN},{priceMinor:-1},{options:[{...base.products[0].options[0],defaults:['missing']}]},{categoryId:'missing'},{available:true,priceMinor:null}])expect(()=>decodeLinkedCatalog({...base,products:[{...base.products[0],...patch}]})).toThrow();});
});

describe('isolated linked POS controller',()=>{
  it('does no fetch, subscription or review when flag is off',async()=>{const request=vi.fn(),subscribe=vi.fn();const c=createLinkedPosController({enabled:false,request,subscribe});c.start();await c.refresh();await c.review(id,'SEEN');expect(request).not.toHaveBeenCalled();expect(subscribe).not.toHaveBeenCalled();expect(c.getSnapshot().inbox).toBeNull();});
  it('pulls canonical data on mount and doorbell and removes subscriptions on stop',async()=>{const s=setup();s.controller.start();await s.controller.refresh();expect(s.subscribe.mock.calls.map(c=>c[0])).toEqual(['catalog','request']);expect(s.controller.getSnapshot().inbox).toHaveLength(1);s.request.mockClear();s.events.get('request')!();await vi.waitFor(()=>expect(s.request).toHaveBeenCalledTimes(2));s.controller.stop();expect(s.stop).toHaveBeenCalledTimes(2);});
  it('deduplicates concurrent review clicks and uses only narrow identity payload',async()=>{const s=setup();await s.controller.refresh();const result=deferred<unknown>();s.request.mockImplementation(async(path)=>path==='/review'?result.promise:path==='/catalog'?catalog():inbox());const first=s.controller.review(id,'SEEN'),repeat=s.controller.review(id,'SEEN'),conflict=s.controller.review(id,'REJECTED');expect(s.request.mock.calls.filter(c=>c[0]==='/review')).toHaveLength(1);expect(s.request.mock.calls.find(c=>c[0]==='/review')?.slice(0,3)).toEqual(['/review','POST',{submissionId:id,idempotencyKey:'V3:'+id,reviewState:'SEEN'}]);result.resolve({...status(),reviewState:'SEEN',reviewedAt:'2026-10-03T02:00:00Z'});await Promise.all([first,repeat,conflict]);expect(s.request.mock.calls.filter(c=>c[0]==='/requests')).toHaveLength(2);});
  it('uses canonical reread and suppresses repeat SEEN and rejected terminal review',async()=>{const s=setup();const seen=inbox();seen.requests[0].reviewState='SEEN';Object.assign(seen.requests[0],{reviewedAt:'2026-10-03T02:00:00Z'});s.setInbox(seen);await s.controller.refresh();await s.controller.review(id,'SEEN');expect(s.request.mock.calls.filter(c=>c[0]==='/review')).toHaveLength(0);seen.requests[0].state='REJECTED';s.setInbox(seen);await s.controller.refresh();await s.controller.review(id,'SEEN');expect(s.request.mock.calls.filter(c=>c[0]==='/review')).toHaveLength(0);});
  it('rejects runtime-forged review states before transport',async()=>{const s=setup();await s.controller.refresh();for(const value of ['COMMITTED','CONFIRMED','PAID','PRINTED'])await s.controller.review(id,value as 'SEEN');expect(s.request.mock.calls.filter(c=>c[0]==='/review')).toHaveLength(0);expect(s.controller.getSnapshot().error).toContain('LINKED_FORMAL_ACK_NOT_ALLOWED');});
  it('does not manufacture success on malformed review, and permits safe manual retry',async()=>{const s=setup();await s.controller.refresh();s.request.mockImplementation(async(path)=>path==='/review'?{...status(),state:'COMMITTED'}:path==='/catalog'?catalog():inbox());await s.controller.review(id,'SEEN');expect(s.controller.getSnapshot().error).toContain('LINKED_STATUS_INVALID');expect(s.controller.getSnapshot().inbox?.[0].reviewState).toBe('UNSEEN');s.request.mockImplementation(async(path)=>path==='/review'?status():path==='/catalog'?catalog():inbox());await s.controller.review(id,'SEEN');expect(s.request.mock.calls.filter(c=>c[0]==='/review')).toHaveLength(2);});
  it('fences obsolete reloads and clears unsafe cached data on failure',async()=>{const s=setup();const old=deferred<unknown>();s.request.mockImplementationOnce(()=>old.promise);const first=s.controller.refresh();await s.controller.refresh();old.resolve({...catalog(),fingerprint:'older'});await first;expect(s.controller.getSnapshot().catalog?.fingerprint).toBe('fingerprint');s.request.mockRejectedValue(new Error('LINKED_MODE_DISABLED'));await s.controller.refresh();expect(s.controller.getSnapshot().catalog).toBeNull();expect(s.controller.getSnapshot().inbox).toBeNull();});
  it('cancels pending reads and ignores late responses after unmount',async()=>{const s=setup();const late=deferred<unknown>();s.request.mockImplementation(()=>late.promise);const pending=s.controller.refresh();s.controller.stop();late.resolve(catalog());await pending;expect(s.controller.getSnapshot().catalog).toBeNull();expect(s.request.mock.calls[0][3]?.aborted).toBe(true);});
  it('reload gets server state rather than browser persistence',async()=>{const s=setup();await s.controller.refresh();const again=createLinkedPosController({enabled:true,request:s.request,subscribe:s.subscribe});expect(again.getSnapshot().inbox).toBeNull();await again.refresh();expect(again.getSnapshot().inbox).toEqual(s.controller.getSnapshot().inbox);});
});

// Network uncertainty never schedules another write; the same identity is retried only on a later click.
describe('linked POS interrupted review recovery',()=>{
  it('rereads after uncertain transport before a retry and accepts the persisted review',async()=>{
    const s=setup();await s.controller.refresh();
    s.request.mockImplementation(async(path)=>{
      if(path==='/review'){const saved=inbox();Object.assign(saved.requests[0],{reviewState:'SEEN',reviewedAt:'2026-10-03T03:00:00Z'});s.setInbox(saved);throw new Error('NETWORK_UNCERTAIN');}
      return path==='/catalog'?catalog():{...inbox(),requests:[{...row(),reviewState:'SEEN',reviewedAt:'2026-10-03T03:00:00Z'}]};
    });
    await s.controller.review(id,'SEEN');
    expect(s.controller.getSnapshot().inbox?.[0].reviewState).toBe('SEEN');
    expect(s.controller.getSnapshot().error).toBe('NETWORK_UNCERTAIN');
    await s.controller.review(id,'SEEN');
    expect(s.request.mock.calls.filter(call=>call[0]==='/review')).toHaveLength(1);
  });
  it('rejects another request identity in a review response',async()=>{
    const s=setup();await s.controller.refresh();
    s.request.mockImplementation(async(path)=>path==='/review'?{...status(),submissionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}:path==='/catalog'?catalog():inbox());
    await s.controller.review(id,'SEEN');expect(s.controller.getSnapshot().error).toBe('LINKED_REVIEW_IDENTITY_MISMATCH');
  });
});

describe('bounded linked POS transport recovery',()=>{
  it('times out a hung canonical read and allows manual recovery',async()=>{
    vi.useFakeTimers();
    try{
      const s=setup();s.request.mockImplementation(()=>new Promise(()=>{}));
      const pending=s.controller.refresh();await vi.advanceTimersByTimeAsync(15000);await pending;
      expect(s.controller.getSnapshot().loading).toBe(false);expect(s.controller.getSnapshot().inbox).toBeNull();
      expect(s.controller.getSnapshot().error).toBe('LINKED_REQUEST_TIMEOUT');expect(s.request.mock.calls[0][3]?.aborted).toBe(true);
      s.request.mockImplementation(async path=>path==='/catalog'?catalog():inbox());await s.controller.refresh();expect(s.controller.getSnapshot().inbox).toHaveLength(1);
    }finally{vi.useRealTimers();}
  });
  it('bounds an uncertain review, rereads it and never automatically resends the write',async()=>{
    vi.useFakeTimers();
    try{
      const s=setup();await s.controller.refresh();s.request.mockImplementation(async path=>path==='/review'?new Promise(()=>{}):path==='/catalog'?catalog():inbox());
      const pending=s.controller.review(id,'SEEN');await vi.advanceTimersByTimeAsync(15000);await pending;
      expect(s.controller.getSnapshot().reviewing).toEqual([]);expect(s.controller.getSnapshot().error).toBe('LINKED_REQUEST_TIMEOUT');
      expect(s.request.mock.calls.filter(call=>call[0]==='/review')).toHaveLength(1);
      expect(s.request.mock.calls.filter(call=>call[0]==='/requests')).toHaveLength(2);
    }finally{vi.useRealTimers();}
  });
  it('does not apply an old review callback to a restarted lifecycle',async()=>{
    const s=setup();await s.controller.refresh();const late=deferred<unknown>();s.request.mockImplementation(async path=>path==='/review'?late.promise:path==='/catalog'?catalog():inbox());
    const pending=s.controller.review(id,'SEEN');s.controller.stop();s.controller.start();await s.controller.refresh();late.reject(new Error('OLD_SESSION'));await pending;
    expect(s.controller.getSnapshot().error).toBe('');s.controller.stop();
  });
});
