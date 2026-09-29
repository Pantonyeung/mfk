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
  const runtime=new AdminSyncStore(state,{} as never);
  return{data,runtime};
}
function active(){
  return{
    schema:'MFK_ADMIN_CONFIG_SYNC_V1',storeId:'MF01',revision:10,publishedAt:'2026-09-27T06:00:00Z',
    adminFingerprint:'admin:10',
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
    fingerprint:'legacy-active',
  };
}
const session={staffId:'owner-1',loginId:'1111',displayName:'Owner'};

describe('OA-SEL-001 canonical sellability',()=>{
  it('applies product sold-out through existing active availability authority and reads it back',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    const result=await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-1',action:'SOLD_OUT',scope:'ALL',targets:[{targetId:'p1',grain:'PRODUCT'}],
    });
    expect(result.state).toBe('CONFIRMED');
    expect(result.targets[0].readback.state).toBe('SOLD_OUT');
    expect(result.revision).toBe(11);
    expect(data.get('active').snapshot.availability.p1.sellable).toBe(false);
  });

  it('supports option and combo-child targets without changing product structure',async()=>{
    const {data,runtime}=harness();const before=active();data.set('active',before);
    const result=await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-2',action:'SOLD_OUT',scope:'ALL',
      targets:[{targetId:'opt1',grain:'OPTION'},{targetId:'choice1',grain:'COMBO_CHILD'}],
    });
    expect(result.state).toBe('CONFIRMED');
    const snapshot=data.get('active').snapshot;
    expect(snapshot.availability['OPTION:opt1'].sellable).toBe(false);
    expect(snapshot.availability['COMBO_CHILD:choice1'].sellable).toBe(false);
    expect(snapshot.catalog.products).toEqual(before.snapshot.catalog.products);
    expect(snapshot.optionCenter.sets).toEqual(before.snapshot.optionCenter.sets);
  });

  it('online-only stop does not mean hidden and inventory zero is presentation only',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-3',action:'SOLD_OUT',scope:'ONLINE_ONLY',targets:[{targetId:'p1',grain:'PRODUCT'}],
    });
    const items=await runtime.ownerSellabilityReadModel('2026-09-27T06:05:00Z');
    const product=items.find((item:any)=>item.targetId==='p1');
    expect(product.state).toBe('SOLD_OUT');
    expect(product.scope).toBe('ONLINE_ONLY');
    expect(product.quantity).toBe(0);
    expect(data.get('active').snapshot.catalog.products[0].active).toBe(true);
  });

  it('temporary stop expires by effective availability without rewriting inventory',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-4',action:'SOLD_OUT',scope:'ALL',restoreAt:'2099-09-27T07:00:00Z',targets:[{targetId:'p1',grain:'PRODUCT'}],
    });
    expect((await runtime.ownerSellabilityReadModel('2099-09-27T06:30:00Z')).find((x:any)=>x.targetId==='p1').state).toBe('SOLD_OUT');
    expect((await runtime.ownerSellabilityReadModel('2099-09-27T07:01:00Z')).find((x:any)=>x.targetId==='p1').state).toBe('SELLABLE');
    expect(data.get('active').snapshot.inventory[0].quantity).toBe(0);
  });

  it('invalid target yields PARTIAL when another target confirms',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    const result=await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-5',action:'SOLD_OUT',scope:'ALL',targets:[{targetId:'p1',grain:'PRODUCT'},{targetId:'missing',grain:'PRODUCT'}],
    });
    expect(result.state).toBe('PARTIAL');
    expect(result.targets.map((x:any)=>x.state)).toContain('CONFIRMED');
    expect(result.targets.map((x:any)=>x.state)).toContain('REJECTED');
  });

  it('does not mutate existing order projections after sold-out',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    data.set('projection:order:o1',{payload:{orderId:'o1',display:'001',sourceLabel:'門店',totalMinor:4000,fulfillmentLabel:'待處理',items:[{id:'l1',name:'產品一',qty:1,unitMinor:4000}]}});
    const before=JSON.stringify(await runtime.projectionOrders());
    await runtime.ownerSellabilityCommand(session,{operationId:'sel-6',action:'SOLD_OUT',scope:'ALL',targets:[{targetId:'p1',grain:'PRODUCT'}]});
    expect(JSON.stringify(await runtime.projectionOrders())).toBe(before);
  });

  it('maps legacy Modifier grain onto canonical Option sellability identity',async()=>{
    const {data,runtime}=harness();data.set('active',active());
    const result=await runtime.ownerSellabilityCommand(session,{
      operationId:'sel-modifier',action:'SOLD_OUT',scope:'ALL',targets:[{targetId:'opt1',grain:'MODIFIER'}],
    });
    expect(result.state).toBe('CONFIRMED');
    expect(result.targets[0].readback.grain).toBe('MODIFIER');
    expect(data.get('active').snapshot.availability['OPTION:opt1'].sellable).toBe(false);
    expect(data.get('active').snapshot.availability['MODIFIER:opt1']).toBeUndefined();
  });

});
