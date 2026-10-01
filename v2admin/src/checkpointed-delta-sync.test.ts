import {describe,expect,it} from 'vitest';
import {validateMfkSyncChangeBatch} from '../../contracts/checkpointed-delta-sync-v1.ts';
import {
  applyMfkSyncChangeBatch,
  applyMfkSyncChanges,
  buildCustomerSyncEntities,
  buildSmmSyncEntities,
  buildSmtSyncEntities,
  createMfkSyncCheckpoint,
  diffMfkSyncEntities,
  entityMapFromCheckpoint,
  materializeSmtSnapshot,
  projectionHashForEntities,
} from '../../sync/checkpointed-delta-sync.ts';

const at='2026-10-01T10:00:00.000Z';

function adminSnapshot(price='48.00'){
  return {
    catalog:{
      categories:[{id:'CAT-1',name:'飯糰',position:10}],
      products:[{id:'PRD-1',productCode:'PRD000001',categoryId:'CAT-1',name:'紫米飯糰',basePrice:price,active:true}],
      combos:[],
      comboPools:[],
    },
    optionCenter:{sets:[],productLinks:[]},
    productMedia:{'PRD-1':{publicUrl:'https://cdn.example/p1.webp'}},
    printRules:{receipt:{enabled:true}},
    storeSettings:{storeName:'磨飯'},
  };
}

describe('MFK checkpointed delta sync engine',()=>{
  it('emits only the changed SMT entity instead of a full snapshot',()=>{
    const previous=buildSmtSyncEntities(adminSnapshot('48.00'));
    const next=buildSmtSyncEntities(adminSnapshot('52.00'));
    const result=diffMfkSyncEntities({
      storeId:'MF01',port:'SMT',sourceCommitSeq:12,commitId:'commit-12',
      startingPortSeq:41,previous,next,createdAt:at,
    });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      port:'SMT',
      portSeq:42,
      sourceCommitSeq:12,
      entityType:'PRODUCT',
      entityId:'PRD-1',
      op:'UPSERT',
    });
    expect(result.changes[0]?.payload).toMatchObject({basePrice:'52.00'});
  });

  it('keeps an irrelevant Customer port at zero payload',()=>{
    const before={
      store:{storeId:'MF01',storeName:'磨飯',channelAvailable:true,observedAt:at},
      menu:{revision:'10',observedAt:at,categories:[{categoryId:'CAT-1',name:'飯糰',sortOrder:10}],products:[],combos:[],comboPools:[]},
      paymentChannels:[],
      fallback:{enabled:false,phone:'',template:'',retryAttempts:3},
    };
    const after=JSON.parse(JSON.stringify(before));
    const result=diffMfkSyncEntities({
      storeId:'MF01',port:'CUSTOMER',sourceCommitSeq:13,commitId:'commit-13',
      startingPortSeq:7,
      previous:buildCustomerSyncEntities(before),
      next:buildCustomerSyncEntities(after),
      createdAt:at,
    });
    expect(result.changes).toHaveLength(0);
    expect(result.headSeq).toBe(7);
  });

  it('recovers from checkpoint plus a short tail and preserves exact SMT snapshot facts',()=>{
    const base=buildSmtSyncEntities(adminSnapshot('48.00'));
    const checkpoint=createMfkSyncCheckpoint({
      storeId:'MF01',port:'SMT',checkpointSeq:100,sourceCommitSeq:10,entities:base,createdAt:at,
    });
    const next=buildSmtSyncEntities(adminSnapshot('52.00'));
    const delta=diffMfkSyncEntities({
      storeId:'MF01',port:'SMT',sourceCommitSeq:11,commitId:'commit-11',
      startingPortSeq:100,previous:base,next,createdAt:at,
    });
    const recovered=applyMfkSyncChanges(entityMapFromCheckpoint(checkpoint),delta.changes);
    expect(projectionHashForEntities(recovered)).toBe(projectionHashForEntities(next));
    const snapshot=materializeSmtSnapshot(recovered) as {catalog:{products:Array<{basePrice:string}>}};
    expect(snapshot.catalog.products[0]?.basePrice).toBe('52.00');
  });

  it('ignores an exact duplicate batch and rejects a gap before changing the LKG',()=>{
    const base=buildSmtSyncEntities(adminSnapshot('48.00'));
    const diff=diffMfkSyncEntities({
      storeId:'MF01',port:'SMT',sourceCommitSeq:11,commitId:'commit-11',
      startingPortSeq:100,previous:base,next:buildSmtSyncEntities(adminSnapshot('52.00')),createdAt:at,
    });
    const batch=validateMfkSyncChangeBatch({
      schema:'MFK_SYNC_CHANGE_BATCH_V1',protocol:'MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1',
      storeId:'MF01',port:'SMT',fromExclusive:100,toInclusive:101,headSeq:101,
      journalFloorSeq:1,changes:diff.changes,observedAt:at,
    });
    const first=applyMfkSyncChangeBatch(base,100,batch);
    expect(first.appliedSeq).toBe(101);
    expect((materializeSmtSnapshot(first.entities) as {catalog:{products:Array<{basePrice:string}>}}).catalog.products[0]?.basePrice).toBe('52.00');

    const duplicate=applyMfkSyncChangeBatch(first.entities,first.appliedSeq,batch);
    expect(duplicate).toEqual({entities:first.entities,appliedSeq:101});

    const gap=validateMfkSyncChangeBatch({
      ...batch,fromExclusive:102,toInclusive:103,headSeq:103,
      changes:[{...batch.changes[0]!,portSeq:103}],
    });
    const lkgHash=projectionHashForEntities(first.entities);
    expect(()=>applyMfkSyncChangeBatch(first.entities,first.appliedSeq,gap)).toThrow('SYNC_CHANGE_BATCH_FROM_MISMATCH');
    expect(projectionHashForEntities(first.entities)).toBe(lkgHash);

    expect(()=>validateMfkSyncChangeBatch({
      ...batch,toInclusive:103,headSeq:103,
      changes:[batch.changes[0],{...batch.changes[0]!,portSeq:103}],
    })).toThrow('SYNC_CHANGE_BATCH_NON_CONTIGUOUS');
  });

  it('sends one Customer product price delta instead of a full menu snapshot',()=>{
    const customer=(price:number)=>({
      store:{storeId:'MF01',storeName:'磨飯',channelAvailable:true},
      menu:{categories:[{categoryId:'CAT-1',name:'飯糰',sortOrder:10}],products:[{productId:'PRD-1',categoryId:'CAT-1',name:'紫米飯糰',description:'',available:true,publishedUnitPriceMinor:price,optionGroups:[]}],combos:[],comboPools:[]},
      paymentChannels:[],fallback:{enabled:false,phone:'',template:'',retryAttempts:3},
    });
    const result=diffMfkSyncEntities({
      storeId:'MF01',port:'CUSTOMER',sourceCommitSeq:14,commitId:'commit-14',startingPortSeq:7,
      previous:buildCustomerSyncEntities(customer(4800)),next:buildCustomerSyncEntities(customer(5200)),createdAt:at,
    });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({entityType:'CUSTOMER_PRODUCT',entityId:'PRD-1',op:'UPSERT',portSeq:8});
    expect(result.changes[0]?.payload).toMatchObject({publishedUnitPriceMinor:5200});
  });

  it('orders a new Category before its Product and emits only dependency entities',()=>{
    const customerBase={
      store:{storeId:'MF01',storeName:'磨飯',channelAvailable:true},
      menu:{categories:[],products:[],combos:[],comboPools:[]},
      paymentChannels:[],fallback:{enabled:false,phone:'',template:'',retryAttempts:3},
    };
    const customerNext=structuredClone(customerBase) as typeof customerBase&{menu:{categories:Record<string,unknown>[];products:Record<string,unknown>[];combos:never[];comboPools:never[]}};
    customerNext.menu.categories.push({categoryId:'CAT-NEW',name:'飲品',sortOrder:20});
    customerNext.menu.products.push({productId:'PRD-NEW',categoryId:'CAT-NEW',name:'檸茶',available:true,publishedUnitPriceMinor:1800,optionGroups:[]});

    const smtNext=adminSnapshot('18.00');
    smtNext.catalog.categories=[{id:'CAT-NEW',name:'飲品',position:20}];
    smtNext.catalog.products=[{id:'PRD-NEW',productCode:'PRD000009',categoryId:'CAT-NEW',name:'檸茶',basePrice:'18.00',active:true}];
    const smtBase=structuredClone(smtNext);
    smtBase.catalog.categories=[];
    smtBase.catalog.products=[];

    const cases=[
      {port:'CUSTOMER' as const,previous:buildCustomerSyncEntities(customerBase),next:buildCustomerSyncEntities(customerNext),category:'CUSTOMER_CATEGORY',product:'CUSTOMER_PRODUCT'},
      {port:'SMM' as const,previous:buildSmmSyncEntities(customerBase),next:buildSmmSyncEntities(customerNext),category:'SMM_CATEGORY',product:'SMM_PRODUCT'},
      {port:'SMT' as const,previous:buildSmtSyncEntities(smtBase),next:buildSmtSyncEntities(smtNext),category:'CATEGORY',product:'PRODUCT'},
    ];
    for(const item of cases){
      const result=diffMfkSyncEntities({storeId:'MF01',port:item.port,sourceCommitSeq:15,commitId:'commit-15',startingPortSeq:0,previous:item.previous,next:item.next,createdAt:at});
      const types=result.changes.map(change=>change.entityType);
      expect(types.indexOf(item.category)).toBeLessThan(types.indexOf(item.product));
      expect(types.filter(type=>type!==item.category&&type!==item.product&&type!=='ENTITY_ORDER')).toEqual([]);
    }
  });

  it('does not trust a cached entity payloadHash when browser payload bytes were changed',()=>{
    const original=buildCustomerSyncEntities({menu:{products:[{productId:'PRD-1',name:'Original',optionGroups:[]}]}});
    const tampered=structuredClone(original);
    const key=Object.keys(tampered).find(value=>value.startsWith('CUSTOMER_PRODUCT:'))!;
    tampered[key]!.payload={...tampered[key]!.payload,name:'Tampered'};
    expect(projectionHashForEntities(tampered)).not.toBe(projectionHashForEntities(original));
  });

  it('represents deletion by identity and never by array position',()=>{
    const previous=buildSmtSyncEntities(adminSnapshot('48.00'));
    const nextSnapshot=adminSnapshot('48.00');
    nextSnapshot.catalog.products=[];
    const next=buildSmtSyncEntities(nextSnapshot);
    const result=diffMfkSyncEntities({
      storeId:'MF01',port:'SMT',sourceCommitSeq:20,commitId:'commit-20',
      startingPortSeq:9,previous,next,createdAt:at,
    });
    expect(result.changes).toHaveLength(2);
    const deletion=result.changes.find(change=>change.entityType==='PRODUCT');
    const order=result.changes.find(change=>change.entityType==='ENTITY_ORDER');
    expect(deletion).toMatchObject({entityType:'PRODUCT',entityId:'PRD-1',op:'DELETE'});
    expect(order).toMatchObject({entityType:'ENTITY_ORDER',entityId:'SMT:PRODUCT',op:'UPSERT'});
    expect((order?.payload as {ids?:unknown[]})?.ids).toEqual([]);
  });
});
