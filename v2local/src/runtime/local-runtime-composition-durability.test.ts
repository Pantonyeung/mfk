import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MFK_ORDER_LINE_COMPOSITION_SCHEMA,type MfkOrderLineCompositionV1} from '../../../contracts/order-line-composition-v1.ts';

const RUNTIME_KEY='mfk.v2local.runtime.v1';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  return values;
}

function composition():MfkOrderLineCompositionV1{
  return {
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:'COMBO',
    cartLineId:'combo-A',
    combo:{
      comboId:'combo-a',
      comboName:'紫米 A 餐',
      pairingLabel:'A',
      source:'SPECIFIED',
      components:[{
        groupId:'main',
        groupName:'飯團',
        role:'MAIN_COURSE',
        choiceId:'main-choice',
        choiceLabel:'原味飯團',
        sourceLineId:'main-line',
        snapshot:{
          productId:'main',
          name:'原味飯團',
          unitMinor:4100,
          serviceMode:'takeaway',
          detail:'飯底：紫米',
          optionSelections:{rice:['purple']},
          freeNote:'',
        },
      }],
      resolvedChoices:[{
        groupId:'main',
        groupName:'飯團',
        role:'MAIN_COURSE',
        choiceId:'main-choice',
        choiceLabel:'原味飯團',
        priceAdjustmentMinor:0,
      }],
      pendingGroups:[],
    },
  };
}

describe('local runtime composition persistence',()=>{
  beforeEach(()=>{
    vi.resetModules();
    installStorage();
  });

  it('survives an actual runtime module restart for Hold and StoredOrder without changing money',async()=>{
    let module=await import('./local-runtime.ts');
    const meta=composition();

    module.localRuntime.createHold({
      kind:'waiting',
      items:[{
        id:'combo-a',
        name:'紫米 A 餐',
        qty:1,
        unitMinor:5200,
        serviceMode:'takeaway',
        detail:'飯團：原味飯團 · 飲品：台式奶茶',
        composition:meta,
      }],
      totalMinor:5200,
      note:'durability proof',
    });

    vi.resetModules();
    module=await import('./local-runtime.ts');
    const hold=module.localRuntime.holds()[0]!;
    expect(hold.totalMinor).toBe(5200);
    expect(hold.items[0]?.composition?.cartLineId).toBe('combo-A');
    expect(hold.items[0]?.composition?.combo?.pairingLabel).toBe('A');
    expect(hold.items[0]?.composition?.combo?.components[0]?.snapshot.optionSelections).toEqual({rice:['purple']});

    module.localRuntime.createOrder({
      items:[{
        id:'combo-a',
        name:'紫米 A 餐',
        qty:1,
        unitMinor:5200,
        serviceMode:'takeaway',
        detail:'飯團：原味飯團 · 飲品：台式奶茶',
        composition:meta,
      }],
      totalMinor:5200,
      paymentLabel:'CASH',
      sourceLabel:'現場',
    });

    vi.resetModules();
    module=await import('./local-runtime.ts');
    const order=module.localRuntime.orders()[0]!;
    expect(order.totalMinor).toBe(5200);
    expect(order.items[0]?.unitMinor).toBe(5200);
    expect(order.items[0]?.composition?.cartLineId).toBe('combo-A');
    expect(order.items[0]?.composition?.combo?.components[0]?.snapshot.productId).toBe('main');
  });

  it('keeps legacy and malformed records readable by dropping unsupported metadata only',async()=>{
    localStorage.setItem(RUNTIME_KEY,JSON.stringify({
      orders:[{
        id:'legacy-order',
        display:'P001',
        createdAt:'2026-09-24T00:00:00.000Z',
        totalMinor:1800,
        paymentLabel:'CASH',
        fulfillmentLabel:'進行中',
        sourceLabel:'現場',
        items:[{id:'snack',name:'鹽酥雞',qty:1,unitMinor:1800,composition:{schema:'UNKNOWN'}}],
      }],
      availability:{},
      holds:[{
        id:'legacy-hold',
        codeLabel:'H001',
        kind:'waiting',
        createdAt:'2026-09-24T00:00:00.000Z',
        partySize:1,
        note:'',
        totalMinor:1800,
        items:[{id:'snack',name:'鹽酥雞',qty:1,unitMinor:1800}],
      }],
    }));

    vi.resetModules();
    const module=await import('./local-runtime.ts');
    expect(module.localRuntime.orders()[0]?.items[0]?.composition).toBeUndefined();
    expect(module.localRuntime.orders()[0]?.totalMinor).toBe(1800);
    expect(module.localRuntime.holds()[0]?.items[0]?.name).toBe('鹽酥雞');
  });
});
