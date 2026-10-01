import {describe,expect,it} from 'vitest';
import {
  applyMfkSyncChanges,
  buildCustomerSyncEntities,
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

  it('represents deletion by identity and never by array position',()=>{
    const previous=buildSmtSyncEntities(adminSnapshot('48.00'));
    const nextSnapshot=adminSnapshot('48.00');
    nextSnapshot.catalog.products=[];
    const next=buildSmtSyncEntities(nextSnapshot);
    const result=diffMfkSyncEntities({
      storeId:'MF01',port:'SMT',sourceCommitSeq:20,commitId:'commit-20',
      startingPortSeq:9,previous,next,createdAt:at,
    });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({entityType:'PRODUCT',entityId:'PRD-1',op:'DELETE',portSeq:10});
  });
});
