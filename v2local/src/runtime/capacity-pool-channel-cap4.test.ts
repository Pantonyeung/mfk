import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({
  renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1,2,3])),
}));
vi.mock('./label-bitmap.ts',()=>({
  renderTscRasterLabel:vi.fn(async()=>new Uint8Array([4,5,6])),
}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({ok:true,providerStatus:'ACCEPTED'}))}));

import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {assertCapacityChannelAdmission} from './capacity-pool-state.ts';

let values:Map<string,string>;
function installStorage(){
  values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  }});
}
function applyCapacity(pools:readonly unknown[]){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',revision:1,publishedAt:'2026-09-27T04:00:00.000Z',
    adminFingerprint:'cap4',
    snapshot:{
      catalog:{categories:[],products:[]},
      businessDay:{cutoff:'05:00'},
      capacity:{pools},
    },
  }));
}
const purple={
  id:'CAP01',name:'紫米',active:true,initialQty:12,
  productIds:['riceball','pork'],firstPartyStopAt:3,thirdPartyStopAt:10,note:'',
};
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}
function orderEvents(runtime:any){
  return runtime.orders().flatMap((order:any)=>order.capacityEvents??[]);
}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T04:00:00.000Z'));
  installStorage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN');}));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('CAP4 channel stop projection / admission guard',()=>{
  it('projects independent first-party and third-party accepting state from remaining quantity',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    let state=await runtime.readCapacityPoolState();
    expect(state.pools[0]).toMatchObject({
      remainingQty:12,
      firstPartyStopAt:3,
      thirdPartyStopAt:10,
      firstPartyAccepting:true,
      thirdPartyAccepting:true,
    });

    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    state=await runtime.readCapacityPoolState();
    expect(state.pools[0]).toMatchObject({
      remainingQty:10,
      firstPartyAccepting:true,
      thirdPartyAccepting:false,
    });
    expect(state.pools[0]?.thirdPartyStopAt).toBe(10);
  });

  it('blocks third-party while first-party can still admit a bound product',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    const events=orderEvents(runtime);

    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',
      items:[{id:'riceball',qty:1}],
      orderEvents:events,
    })).not.toThrow();
    expect(()=>assertCapacityChannelAdmission({
      channel:'THIRD_PARTY',
      items:[{id:'riceball',qty:1}],
      orderEvents:events,
    })).toThrow('CAPACITY_CHANNEL_STOP:THIRD_PARTY:CAP01');
  });

  it('blocks both remote channels at Pool zero even with zero thresholds',async()=>{
    applyCapacity([{...purple,initialQty:2,firstPartyStopAt:0,thirdPartyStopAt:0}]);
    const runtime=await boot();
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    const events=orderEvents(runtime);
    for(const channel of ['FIRST_PARTY','THIRD_PARTY'] as const){
      expect(()=>assertCapacityChannelAdmission({
        channel,items:[{id:'riceball',qty:1}],orderEvents:events,
      })).toThrow('CAPACITY_CHANNEL_STOP:'+channel+':CAP01');
    }
  });

  it('blocks if any linked Pool blocks the requested remote channel',async()=>{
    applyCapacity([
      purple,
      {...purple,id:'CAP02',name:'包材',initialQty:1,productIds:['riceball'],firstPartyStopAt:1,thirdPartyStopAt:1},
    ]);
    const runtime=await boot();
    const events=orderEvents(runtime);
    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events,
    })).toThrow('CAPACITY_CHANNEL_STOP:FIRST_PARTY:CAP02');
  });

  it('does not block unbound products and separately fails if demand exceeds physical remaining',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const events=orderEvents(runtime);
    expect(()=>assertCapacityChannelAdmission({
      channel:'THIRD_PARTY',items:[{id:'bento',qty:99}],orderEvents:events,
    })).not.toThrow();

    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:13}],orderEvents:events,
    })).toThrow('CAPACITY_POOL_INSUFFICIENT:CAP01');
  });

  it('threshold crossing affects only future remote admissions; existing Formal Order remains unchanged',async()=>{
    applyCapacity([purple]);
    const runtime=await boot();
    const existing=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    expect(runtime.orders().find((row:any)=>row.id===existing.id)?.fulfillmentLabel).toBe('進行中');
    expect(()=>assertCapacityChannelAdmission({
      channel:'THIRD_PARTY',
      items:[{id:'riceball',qty:1}],
      orderEvents:orderEvents(runtime),
    })).toThrow('CAPACITY_CHANNEL_STOP:THIRD_PARTY:CAP01');
    expect(runtime.orders().find((row:any)=>row.id===existing.id)?.fulfillmentLabel).toBe('進行中');
  });
});