import {describe,expect,it} from 'vitest';
import {AdminSyncStore} from '../worker.ts';

function harness(){
  const data=new Map<string,any>();
  const storage={
    get:async(key:string)=>data.get(key),
    put:async(key:string,value:any)=>{data.set(key,value);},
    delete:async(key:string)=>{data.delete(key);},
    list:async({prefix}:{prefix:string})=>new Map([...data].filter(([key])=>key.startsWith(prefix))),
  };
  const state={storage,getWebSockets:()=>[]} as never;
  return{data,runtime:new AdminSyncStore(state,{} as never)};
}
function active(){
  return{
    schema:'MFK_ADMIN_CONFIG_SYNC_V1',storeId:'MF01',revision:10,publishedAt:'2026-09-27T06:00:00Z',
    adminFingerprint:'admin:10',fingerprint:'legacy-active',
    snapshot:{
      catalog:{
        categories:[{id:'cat',name:'飯',active:true}],
        products:[{id:'p1',name:'產品一',categoryId:'cat',active:true,basePrice:'40'}],
        comboPools:[{id:'pool',groups:[{id:'g',choices:[{id:'choice1',choiceType:'PRODUCT',productId:'p1',label:'套餐子項',active:true}],bands:[]}]}],
        combos:[],
      },
      optionCenter:{sets:[{id:'set1',active:true,options:[{id:'opt1',name:'多飯',active:true,priceAdjustment:'2'}]}],productLinks:[]},
      availability:{},
      inventory:[{productId:'p1',quantity:0}],
    },
  };
}
const session={staffId:'owner-1',loginId:'1111',displayName:'Owner'};

describe('OA-SEL-001 Owner operational sellability request',()=>{
  it('queues product SOLD_OUT for SMT runtime without rewriting Admin authority',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    const result=await runtime.ownerSellabilityCommand(session,{operationId:'sel-1',action:'SOLD_OUT',targets:[{targetId:'p1',grain:'PRODUCT'}]});
    expect(result.state).toBe('UNKNOWN');
    expect(data.get('active').revision).toBe(10);
    expect(data.get('active').snapshot.availability).toEqual({});
    expect(data.get('owner:sellability:command:sel-1')).toMatchObject({action:'SOLD_OUT',state:'PENDING_SMT'});
  });

  it('queues option and combo-child targets without changing canonical structures',async()=>{
    const {data,runtime}=harness();const before=active();data.set('active',before);
    await runtime.ownerSellabilityCommand(session,{operationId:'sel-2',action:'SOLD_OUT',targets:[{targetId:'opt1',grain:'OPTION'},{targetId:'choice1',grain:'COMBO_CHILD'}]});
    const command=data.get('owner:sellability:command:sel-2');
    expect(command.targets.map((x:any)=>x.grain)).toEqual(['OPTION','COMBO_CHILD']);
    expect(data.get('active').snapshot.catalog).toEqual(before.snapshot.catalog);
    expect(data.get('active').snapshot.optionCenter).toEqual(before.snapshot.optionCenter);
  });

  it('keeps inventory quantity as presentation/statistics only',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    await runtime.ownerSellabilityCommand(session,{operationId:'sel-3',action:'PAUSE',targets:[{targetId:'p1',grain:'PRODUCT'}]});
    expect(data.get('active').snapshot.inventory[0].quantity).toBe(0);
    expect(data.get('active').snapshot.catalog.products[0].active).toBe(true);
    expect(data.get('owner:sellability:command:sel-3')).toMatchObject({action:'PAUSE',state:'PENDING_SMT'});
  });

  it('rejects missing target while queuing valid targets for SMT',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    const result=await runtime.ownerSellabilityCommand(session,{operationId:'sel-5',action:'SOLD_OUT',targets:[{targetId:'p1',grain:'PRODUCT'},{targetId:'missing',grain:'PRODUCT'}]});
    expect(result.state).toBe('UNKNOWN');
    expect(result.targets.map((x:any)=>x.state)).toContain('REJECTED');
    expect(data.get('owner:sellability:command:sel-5').targets).toHaveLength(1);
  });

  it('does not mutate existing order projections after runtime request',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    data.set('projection:order:o1',{payload:{orderId:'o1',display:'001',sourceLabel:'門店',totalMinor:4000,fulfillmentLabel:'待處理',items:[{id:'l1',name:'產品一',qty:1,unitMinor:4000}]}});
    const before=JSON.stringify(await runtime.projectionOrders());
    await runtime.ownerSellabilityCommand(session,{operationId:'sel-6',action:'SOLD_OUT',targets:[{targetId:'p1',grain:'PRODUCT'}]});
    expect(JSON.stringify(await runtime.projectionOrders())).toBe(before);
  });

  it('maps legacy MODIFIER grain onto the existing option target for SMT execution',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    await runtime.ownerSellabilityCommand(session,{operationId:'sel-modifier',action:'SOLD_OUT',targets:[{targetId:'opt1',grain:'MODIFIER'}]});
    const command=data.get('owner:sellability:command:sel-modifier');
    expect(command.targets[0]).toMatchObject({targetId:'opt1',grain:'MODIFIER'});
    expect(data.get('active').snapshot.availability).toEqual({});
  });
});
