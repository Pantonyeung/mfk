import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(()=>{throw new Error('PROVIDER_FORBIDDEN');})}));
vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));

let values:Map<string,string>;
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

beforeEach(()=>{
  vi.resetModules();
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.unstubAllGlobals();});

describe('D7 ordered waiting Dining continuity',()=>{
  it('projects Formal Order and money facts in queue before seating',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
      note:'輪候',
    });
    const admitted=await runtime.admitDiningHold(hold.id);
    const view=await runtime.readDining();
    const row=view.queue.find((item:any)=>item.id===hold.id);

    expect(row).toMatchObject({
      id:hold.id,
      codeLabel:admitted.formalOrderDisplay,
      formalOrderId:admitted.formalOrderId,
      partySize:2,
      statusLabel:'待安排座位 · 已落單',
      itemCount:2,
      totalMinor:8200,
      paidMinor:0,
      remainingMinor:8200,
    });
  });

  it('keeps a partially paid ordered waiting check operable before seating',async()=>{
    const runtime=await boot();
    const hold=runtime.createHold({
      kind:'dining',
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,
      partySize:2,
    });
    const admitted=await runtime.admitDiningHold(hold.id);
    const before=await runtime.readDiningHold(hold.id);

    const paid=await runtime.settleDiningHold(
      hold.id,[{lineIndex:0,qty:1}],'FPS',
      {submissionId:'wait-pay-1',expectedRevision:before.checkoutRevision},
    );

    expect(paid.assignedTable).toBeUndefined();
    expect(paid.formalOrderId).toBe(admitted.formalOrderId);
    expect(paid.paidMinor).toBe(4100);
    expect(paid.remainingMinor).toBe(4100);

    const view=await runtime.readDining();
    expect(view.queue.find((item:any)=>item.id===hold.id)).toMatchObject({
      formalOrderId:admitted.formalOrderId,
      paidMinor:4100,
      remainingMinor:4100,
    });
  });

  it('empty waiting remains non-financial and has no Formal Order projection',async()=>{
    const runtime=await boot();
    const wait=await runtime.createDiningWait({partySize:3,note:'未落單'});
    const view=await runtime.readDining();
    const row=view.queue.find((item:any)=>item.id===wait.id);

    expect(row).toMatchObject({
      id:wait.id,
      codeLabel:wait.codeLabel,
      statusLabel:'待安排座位',
      itemCount:0,
      totalMinor:0,
      paidMinor:0,
      remainingMinor:0,
    });
    expect(row.formalOrderId).toBeUndefined();
    expect(runtime.orders()).toHaveLength(0);
  });
});
