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
import {projectStaffForRuntime} from '../../../contracts/staff-auth-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {readLocalCapacityPoolRows} from './capacity-pool-state.ts';

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
const pool={
  id:'CAP01',name:'紫米',active:true,initialQty:5,productIds:['riceball'],
  firstPartyStopAt:1,thirdPartyStopAt:2,note:'',
};
function applyConfig(revision:number,staffAuth?:unknown){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',revision,publishedAt:'2026-09-27T04:00:0'+revision+'.000Z',
    adminFingerprint:'cap3-'+revision,
    snapshot:{
      catalog:{categories:[],products:[]},
      businessDay:{cutoff:'05:00'},
      capacity:{pools:[pool]},
      ...(staffAuth?{staffAuth}:{}),
    },
  }));
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}

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

describe('CAP3 SMT manual capacity correction',()=>{
  it('sets explicit current remaining and records local operational evidence',async()=>{
    applyConfig(1);
    const runtime=await boot();
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
      totalMinor:8200,paymentLabel:'CASH',sourceLabel:'現場',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);

    const result=await runtime.adjustCapacityPool('CAP01',7,'實際盤點有 7 份');
    expect(result.pools[0]?.remainingQty).toBe(7);

    const row=readLocalCapacityPoolRows().find(item=>item.businessDate==='2026-09-27'&&item.poolId==='CAP01');
    expect(row?.remainingQty).toBe(7);
    expect(row?.manualAdjustments).toHaveLength(1);
    expect(row?.manualAdjustments?.[0]).toMatchObject({
      poolId:'CAP01',businessDate:'2026-09-27',fromQty:3,toQty:7,note:'實際盤點有 7 份',
    });

    await runtime.cancelOrder(order.id,'取消');
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(9);
    const afterCancel=readLocalCapacityPoolRows().find(item=>item.businessDate==='2026-09-27'&&item.poolId==='CAP01');
    expect(afterCancel?.manualAdjustments).toHaveLength(1);
  });

  it('does not mutate Admin initial quantity and next Business Day resets from configured initialQty',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await runtime.adjustCapacityPool('CAP01',12,'盤點');

    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      configuredInitialQty:5,initialQtyAtOpen:5,remainingQty:12,
    });

    vi.setSystemTime(new Date('2026-09-27T21:01:00.000Z'));
    expect((await runtime.readCapacityPoolState()).businessDate).toBe('2026-09-28');
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      configuredInitialQty:5,initialQtyAtOpen:5,remainingQty:5,
    });
  });

  it('rejects negative, fractional and unknown-pool edits',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await expect(runtime.adjustCapacityPool('CAP01',-1,'')).rejects.toThrow('CAPACITY_MANUAL_QUANTITY_INVALID');
    await expect(runtime.adjustCapacityPool('CAP01',1.5,'')).rejects.toThrow('CAPACITY_MANUAL_QUANTITY_INVALID');
    await expect(runtime.adjustCapacityPool('MISSING',1,'')).rejects.toThrow('CAPACITY_POOL_NOT_ACTIVE');
  });

  it('requires a logged-in SMT staff session when staff auth is configured, but adds no Manager-only gate',async()=>{
    const staffAuth=await projectStaffForRuntime([{
      id:'staff-cap3',name:'前線店員',role:'STAFF',pin:'2468',scope:'STORE',
      adminLogin:false,active:true,permissions:[],
    }]);
    applyConfig(1,staffAuth);
    const runtime=await boot();

    await expect(runtime.adjustCapacityPool('CAP01',4,'前線盤點'))
      .rejects.toThrow('CAPACITY_STAFF_LOGIN_REQUIRED');

    const {loginStaff}=await import('./staff-auth.ts');
    const login=await loginStaff('staff-cap3','2468');
    expect(login.ok).toBe(true);

    const adjusted=await runtime.adjustCapacityPool('CAP01',4,'前線盤點');
    expect(adjusted.pools[0]?.remainingQty).toBe(4);
    const row=readLocalCapacityPoolRows().find(item=>item.poolId==='CAP01'&&item.businessDate==='2026-09-27');
    expect(row?.manualAdjustments?.[0]).toMatchObject({
      fromQty:5,toQty:4,staffId:'staff-cap3',staffName:'前線店員',
    });
  });

  it('survives runtime restart without creating or rewriting Formal Orders',async()=>{
    applyConfig(1);
    let runtime=await boot();
    expect(runtime.orders()).toHaveLength(0);
    await runtime.adjustCapacityPool('CAP01',3,'早更盤點');
    expect(runtime.orders()).toHaveLength(0);

    vi.resetModules();
    runtime=await boot();
    expect((await runtime.readCapacityPoolState()).pools[0]?.remainingQty).toBe(3);
    expect(runtime.orders()).toHaveLength(0);
  });
});