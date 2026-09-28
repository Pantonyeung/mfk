import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MFK_ORDER_LINE_COMPOSITION_SCHEMA,type MfkOrderLineCompositionV1} from '../../../contracts/order-line-composition-v1.ts';

vi.mock('./staff-auth.ts',()=>({
  readActiveStaffSession:()=>null,
  hasStaffPermission:()=>false,
  staffAuthRequired:()=>false,
}));
vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({ok:true,providerStatus:'ACCEPTED'}))}));

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
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

function composition():MfkOrderLineCompositionV1{
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    cartLineId:'line-A',
    optionSelections:Object.freeze({rice:Object.freeze(['purple']),sweet:Object.freeze(['less'])}),
    freeNote:'少飯',
    pairing:Object.freeze({
      groupLabel:'A',
      comboId:'combo-riceball-a',
      comboName:'紫米 A 餐',
      role:'MAIN',
      sourceLineId:'source-main-1',
    }),
  });
}

beforeEach(()=>{
  vi.resetModules();
  vi.clearAllMocks();
  installStorage();
});

describe('SMT consolidation A3A — structured line composition durability',()=>{
  it('survives runtime restart in Hold and Formal Order without changing money',async()=>{
    let runtime=await boot();
    const meta=composition();

    runtime.createHold({
      kind:'waiting',
      items:[{
        id:'riceball',
        name:'原味飯團',
        qty:1,
        unitMinor:5200,
        serviceMode:'takeaway',
        detail:'飯底：紫米 · 套餐配對：A組',
        composition:meta,
      }],
      totalMinor:5200,
      note:'A3A',
    });

    vi.resetModules();
    runtime=await boot();
    const hold=runtime.holds()[0];
    expect(hold.totalMinor).toBe(5200);
    expect(hold.items[0].composition).toMatchObject({
      cartLineId:'line-A',
      optionSelections:{rice:['purple'],sweet:['less']},
      freeNote:'少飯',
      pairing:{groupLabel:'A',comboId:'combo-riceball-a',role:'MAIN'},
    });

    runtime.createOrder({
      items:[{
        id:'riceball',
        name:'原味飯團',
        qty:1,
        unitMinor:5200,
        serviceMode:'takeaway',
        detail:'飯底：紫米 · 套餐配對：A組',
        composition:meta,
      }],
      totalMinor:5200,
      paymentLabel:'CASH',
      sourceLabel:'現場',
    });

    vi.resetModules();
    runtime=await boot();
    const order=runtime.orders()[0];
    expect(order.totalMinor).toBe(5200);
    expect(order.items[0].unitMinor).toBe(5200);
    expect(order.items[0].composition.cartLineId).toBe('line-A');
    expect(order.items[0].composition.pairing.comboId).toBe('combo-riceball-a');
  });

  it('drops malformed metadata only and keeps legacy transaction readable',async()=>{
    localStorage.setItem('mfk.v2local.runtime.v1',JSON.stringify({
      orders:[{
        id:'legacy-order',
        display:'P001',
        createdAt:'2026-09-27T00:00:00.000Z',
        totalMinor:1800,
        paymentLabel:'CASH',
        fulfillmentLabel:'進行中',
        sourceLabel:'現場',
        items:[{id:'snack',name:'鹽酥雞',qty:1,unitMinor:1800,composition:{schema:'UNKNOWN',cartLineId:'bad'}}],
      }],
      availability:{},
      holds:[],
      diningRevision:0,
    }));

    const runtime=await boot();
    const order=runtime.orders()[0];
    expect(order.totalMinor).toBe(1800);
    expect(order.items[0].name).toBe('鹽酥雞');
    expect(order.items[0].composition).toBeUndefined();
  });

  it('preserves metadata through ordinary item correction without turning metadata into pricing authority',async()=>{
    const runtime=await boot();
    const created=runtime.createOrder({
      items:[{id:'meal',name:'套餐',qty:1,unitMinor:4100,composition:composition()}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'電話',
    });
    await runtime.updateOrderItems(created.id,[{id:'meal',name:'套餐',qty:2,unitMinor:4100}]);
    const updated=runtime.orders().find((row:any)=>row.id===created.id);
    expect(updated.totalMinor).toBe(8200);
    expect(updated.items[0].composition.cartLineId).toBe('line-A');
    expect('totalMinor' in updated.items[0].composition).toBe(false);
  });
});
