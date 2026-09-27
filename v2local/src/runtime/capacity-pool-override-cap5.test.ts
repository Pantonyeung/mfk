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
import {assertCapacityChannelAdmission,readLocalCapacityPoolRows} from './capacity-pool-state.ts';

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
  id:'CAP01',name:'紫米',active:true,initialQty:0,productIds:['riceball'],
  firstPartyStopAt:0,thirdPartyStopAt:0,note:'',
};
function applyConfig(revision:number,pools:readonly unknown[]=[pool],staffAuth?:unknown){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',revision,publishedAt:'2026-09-27T04:00:0'+Math.min(9,revision)+'.000Z',
    adminFingerprint:'cap5-'+revision,
    snapshot:{
      catalog:{categories:[],products:[]},
      businessDay:{cutoff:'05:00'},
      capacity:{pools},
      ...(staffAuth?{staffAuth}:{}),
    },
  }));
}
async function boot(){return (await import('./local-runtime.ts')).localRuntime as any;}
function events(runtime:any){return runtime.orders().flatMap((order:any)=>order.capacityEvents??[]);}

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

describe('CAP5 bounded capacity override',()=>{
  it('approves a bounded first-party override, increases confirmed remaining, and records audit evidence',async()=>{
    applyConfig(1);
    const runtime=await boot();
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:0,firstPartyAccepting:false,thirdPartyAccepting:false,
    });

    const state=await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-1',
      scope:'FIRST_PARTY',
      quantity:2,
      note:'現場確認仲做到兩份',
    });

    expect(state.pools[0]).toMatchObject({
      remainingQty:2,
      firstPartyOverrideRemaining:2,
      thirdPartyOverrideRemaining:0,
      firstPartyAccepting:true,
      thirdPartyAccepting:false,
    });
    const row=readLocalCapacityPoolRows().find(item=>item.poolId==='CAP01');
    expect(row?.overrides).toHaveLength(1);
    expect(row?.overrides?.[0]).toMatchObject({
      submissionId:'OVR-1',scope:'FIRST_PARTY',approvedQty:2,remainingAllowance:2,
      fromQty:0,toQty:2,note:'現場確認仲做到兩份',
    });
  });

  it('replays the same approval idempotently and rejects conflicting reuse of one submission id',async()=>{
    applyConfig(1);
    const runtime=await boot();
    const first=await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-IDEM',scope:'ALL_REMOTE',quantity:2,note:'extra',
    });
    const replay=await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-IDEM',scope:'ALL_REMOTE',quantity:2,note:'extra',
    });
    expect(replay.pools[0]?.remainingQty).toBe(first.pools[0]?.remainingQty);
    expect(readLocalCapacityPoolRows()[0]?.overrides).toHaveLength(1);
    await expect(runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-IDEM',scope:'ALL_REMOTE',quantity:3,note:'extra',
    })).rejects.toThrow('CAPACITY_OVERRIDE_SUBMISSION_CONFLICT');
  });

  it('consumes override only through committed remote Formal Orders and automatically stops when allowance is exhausted',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-CONSUME',scope:'FIRST_PARTY',quantity:2,note:'兩份',
    });

    assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    });
    const first=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'到店付款',sourceLabel:'自家 App',
      capacityChannel:'FIRST_PARTY',
    });
    expect((first as any).capacityEvents[0]?.overrideAllocations?.[0]?.overrideId).toContain('CAPOVR:2026-09-27:CAP01:');
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:1,firstPartyOverrideRemaining:1,firstPartyAccepting:true,
    });

    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'到店付款',sourceLabel:'自家 App',
      capacityChannel:'FIRST_PARTY',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:0,firstPartyOverrideRemaining:0,firstPartyAccepting:false,
    });

    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    })).toThrow('CAPACITY_CHANNEL_STOP:FIRST_PARTY:CAP01');
  });

  it('keeps a channel-specific override scoped to that remote channel only',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-SCOPE',scope:'THIRD_PARTY',quantity:1,note:'Keeta 一份',
    });
    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    })).toThrow('CAPACITY_CHANNEL_STOP:FIRST_PARTY:CAP01');
    expect(()=>assertCapacityChannelAdmission({
      channel:'THIRD_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    })).not.toThrow();
  });

  it('shares one ALL_REMOTE allowance across first-party and third-party admissions',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-ALL',scope:'ALL_REMOTE',quantity:2,note:'任何遠端兩份',
    });
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'到店付款',sourceLabel:'自家 App',capacityChannel:'FIRST_PARTY',
    });
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'平台已收款',sourceLabel:'Keeta',capacityChannel:'THIRD_PARTY',
      providerRef:'K-CAP5-1',
    });
    const row=readLocalCapacityPoolRows().find(item=>item.poolId==='CAP01');
    const all=row?.overrides?.find(item=>item.submissionId==='OVR-ALL');
    expect(all?.remainingAllowance).toBe(0);
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      firstPartyOverrideRemaining:0,thirdPartyOverrideRemaining:0,
      firstPartyAccepting:false,thirdPartyAccepting:false,
    });
  });

  it('requires every stopped linked Pool to have adequate matching override allowance',async()=>{
    applyConfig(1,[
      pool,
      {...pool,id:'CAP02',name:'包材',productIds:['riceball']},
    ]);
    const runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-P1',scope:'FIRST_PARTY',quantity:1,note:'紫米',
    });

    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    })).toThrow('CAPACITY_CHANNEL_STOP:FIRST_PARTY:CAP02');

    await runtime.approveCapacityOverride('CAP02',{
      submissionId:'OVR-P2',scope:'FIRST_PARTY',quantity:1,note:'包材',
    });
    expect(()=>assertCapacityChannelAdmission({
      channel:'FIRST_PARTY',items:[{id:'riceball',qty:1}],orderEvents:events(runtime),
    })).not.toThrow();
  });

  it('cancellation restores physical remaining but never recreates spent override allowance',async()=>{
    applyConfig(1);
    const runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-CANCEL',scope:'FIRST_PARTY',quantity:1,note:'一份',
    });
    const order=runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'到店付款',sourceLabel:'自家 App',capacityChannel:'FIRST_PARTY',
    });
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:0,firstPartyOverrideRemaining:0,
    });

    await runtime.cancelOrder(order.id,'客人取消');
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:1,firstPartyOverrideRemaining:0,firstPartyAccepting:true,
    });
  });

  it('requires logged-in staff when staff auth exists and adds no Manager-only permission gate',async()=>{
    const staffAuth=await projectStaffForRuntime([{
      id:'staff-cap5',name:'前線店員',role:'STAFF',pin:'2468',scope:'STORE',
      adminLogin:false,active:true,permissions:[],
    }]);
    applyConfig(1,[pool],staffAuth);
    const runtime=await boot();

    await expect(runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-STAFF',scope:'ALL_REMOTE',quantity:1,note:'確認',
    })).rejects.toThrow('CAPACITY_STAFF_LOGIN_REQUIRED');

    const {loginStaff}=await import('./staff-auth.ts');
    expect((await loginStaff('staff-cap5','2468')).ok).toBe(true);
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-STAFF',scope:'ALL_REMOTE',quantity:1,note:'確認',
    });
    const approval=readLocalCapacityPoolRows()[0]?.overrides?.[0];
    expect(approval).toMatchObject({staffId:'staff-cap5',staffName:'前線店員'});
  });

  it('persists approval and consumed allowance across runtime restart',async()=>{
    applyConfig(1);
    let runtime=await boot();
    await runtime.approveCapacityOverride('CAP01',{
      submissionId:'OVR-RESTART',scope:'FIRST_PARTY',quantity:2,note:'兩份',
    });
    runtime.createOrder({
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],
      totalMinor:4100,paymentLabel:'到店付款',sourceLabel:'自家 App',capacityChannel:'FIRST_PARTY',
    });

    vi.resetModules();
    runtime=await boot();
    expect((await runtime.readCapacityPoolState()).pools[0]).toMatchObject({
      remainingQty:1,firstPartyOverrideRemaining:1,firstPartyAccepting:true,
    });
  });
});