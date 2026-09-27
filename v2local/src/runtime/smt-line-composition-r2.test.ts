import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {restoreProductLineComposition,serializeProductLineComposition} from '../features/ordering/line-composition.ts';
import {
  applyRequiredSelectionToCart,
  type WorkspaceCartLine,
  type WorkspaceProduct,
} from '../features/ordering/OrderingCenterWorkspaces.tsx';

vi.mock('./native-print.ts',()=>({
  printBytesLan:vi.fn(async()=>({ok:true,code:'SENT'})),
  printTextLan:vi.fn(async()=>({ok:true,code:'SENT'})),
}));
vi.mock('./ticket-bitmap.ts',()=>({renderEscPosRasterTicket:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./label-bitmap.ts',()=>({renderTscRasterLabel:vi.fn(async()=>new Uint8Array([1]))}));
vi.mock('./projection-outbox.ts',()=>({queueOrderProjection:vi.fn()}));
vi.mock('./keeta-provider-commands.ts',()=>({mirrorKeetaOrderCommand:vi.fn(async()=>({state:'SYNCED'}))}));

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,String(value)),
    removeItem:(key:string)=>values.delete(key),
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size},
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
  return values;
}

const product:WorkspaceProduct={
  id:'main',
  category:'飯團',
  name:'A飯團',
  priceMinor:4100,
  priceLabel:'$41.00',
  optionSets:[{
    id:'rice',
    name:'飯底',
    required:true,
    forceShow:true,
    selection:'SINGLE',
    min:1,
    max:1,
    options:[
      {id:'purple',name:'紫米',priceAdjustmentMinor:0,defaultSelected:false,active:true},
      {id:'white',name:'白飯',priceAdjustmentMinor:0,defaultSelected:false,active:true},
    ],
  }],
};

describe('SMT R2 structured line durability',()=>{
  beforeEach(()=>{vi.resetModules();vi.clearAllMocks();installStorage();});

  it('round-trips original cart line identity, option ids and free note through JSON',()=>{
    const line={
      id:'line-original',
      optionSelections:{rice:['purple']},
      freeNote:'少飯',
    };
    const persisted=JSON.parse(JSON.stringify(serializeProductLineComposition(line)));
    const restored=restoreProductLineComposition({id:'temporary'},persisted);
    expect(restored.id).toBe('line-original');
    expect(restored.optionSelections).toEqual({rice:['purple']});
    expect(restored.freeNote).toBe('少飯');
  });

  it('writes Required selections as structured ids while keeping the existing display detail',()=>{
    const line:WorkspaceCartLine={id:'l1',productId:'main',name:'A飯團',qty:1,unitMinor:4100};
    const [updated]=applyRequiredSelectionToCart([line],[product],'l1','rice',['purple']);
    expect(updated?.optionSelections).toEqual({rice:['purple']});
    expect(updated?.detail).toBe('飯底：紫米');
    expect(updated?.unitMinor).toBe(4100);
  });

  it('survives runtime restart in Hold and Formal Order without recalculating money',async()=>{
    const values=installStorage();
    const composition=serializeProductLineComposition({
      id:'line-stable',
      optionSelections:{rice:['purple']},
      freeNote:'少飯',
    });
    let runtimeModule=await import('./local-runtime.ts');
    runtimeModule.localRuntime.createHold({
      kind:'waiting',
      items:[{id:'main',name:'A飯團｜飯底：紫米 · 少飯',qty:1,unitMinor:4100,serviceMode:'takeaway',detail:'飯底：紫米 · 少飯',composition}],
      totalMinor:4100,
    });
    runtimeModule.localRuntime.createOrder({
      items:[{id:'main',name:'A飯團',qty:1,unitMinor:4100,serviceMode:'takeaway',detail:'飯底：紫米 · 少飯',composition}],
      totalMinor:4100,
      paymentLabel:'CASH',
      sourceLabel:'現場',
      submissionId:'COMPOSITION-ORDER-1',
    });

    expect(values.get('mfk.v2local.runtime.v1')).toContain('MFK_ORDER_LINE_COMPOSITION_V1');
    vi.resetModules();
    runtimeModule=await import('./local-runtime.ts');

    expect(runtimeModule.localRuntime.holds()[0]?.items[0]?.composition?.cartLineId).toBe('line-stable');
    expect(runtimeModule.localRuntime.orders()[0]?.items[0]?.composition?.optionSelections).toEqual({rice:['purple']});
    expect(runtimeModule.localRuntime.orders()[0]?.items[0]?.unitMinor).toBe(4100);
  });

  it('drops malformed composition metadata but keeps the legacy transaction readable',async()=>{
    localStorage.setItem('mfk.v2local.runtime.v1',JSON.stringify({
      orders:[{
        id:'MFK-legacy',display:'001',createdAt:new Date().toISOString(),totalMinor:1000,
        paymentLabel:'CASH',fulfillmentLabel:'進行中',sourceLabel:'現場',
        items:[{id:'p1',name:'舊商品',qty:1,unitMinor:1000,composition:{schema:'BROKEN',kind:'PRODUCT',cartLineId:'x'}}],
      }],
      availability:{},
      holds:[],
    }));
    vi.resetModules();
    const {localRuntime}=await import('./local-runtime.ts');
    const order=localRuntime.orders()[0]!;
    expect(order.id).toBe('MFK-legacy');
    expect(order.items[0]?.composition).toBeUndefined();
    expect(order.items[0]?.unitMinor).toBe(1000);
  });

  it('keeps composition local and does not add it to the cloud projection writer',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const projection=fs.readFileSync(path.join(here,'projection-outbox.ts'),'utf8');
    expect(projection).not.toContain('composition:');
  });
});
