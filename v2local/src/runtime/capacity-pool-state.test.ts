import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {readSmtCapacityConfig} from './admin-operational-config.ts';
import {
  LOCAL_CAPACITY_POOL_STATE_KEY,
  ensureCurrentCapacityPoolState,
  readLocalCapacityPoolRows,
  writeLocalCapacityPoolRows,
} from './capacity-pool-state.ts';

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
}

function applyCapacity(revision:number,pools:readonly unknown[]){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision,
    publishedAt:'2026-09-27T12:00:0'+revision+'.000Z',
    adminFingerprint:'cap-'+revision,
    snapshot:{
      catalog:{categories:[],products:[]},
      businessDay:{cutoff:'05:00'},
      capacity:{dailyLimit:'100',warningAt:80,hardStop:false,note:'legacy',pools},
    },
  }));
}

const purple={
  id:'CAP01',
  name:'紫米',
  active:true,
  initialQty:150,
  productIds:['riceball','pork'],
  firstPartyStopAt:3,
  thirdPartyStopAt:10,
  note:'每日紫米額度',
};

describe('CAP1 local capacity pool state',()=>{
  beforeEach(()=>installStorage());

  it('reads canonical CAP0 pool definitions from Admin LKG while preserving legacy capacity fields',()=>{
    applyCapacity(1,[purple,{...purple,id:'CAP02',name:'停用',active:false}]);
    const config=readSmtCapacityConfig();
    expect(config).toMatchObject({dailyLimit:100,warningAt:80,hardStopConfigured:false,note:'legacy'});
    expect(config.pools.map(pool=>[pool.id,pool.active,pool.initialQty])).toEqual([
      ['CAP01',true,150],
      ['CAP02',false,150],
    ]);
  });

  it('initializes each active valid pool once for the current Business Day',()=>{
    applyCapacity(1,[purple,{...purple,id:'BAD',name:'',active:true}]);
    const now=new Date('2026-09-27T04:00:00.000Z').getTime();
    const view=ensureCurrentCapacityPoolState(now);

    expect(view.businessDate).toBe('2026-09-27');
    expect(view.pools).toHaveLength(1);
    expect(view.pools[0]).toMatchObject({
      poolId:'CAP01',
      name:'紫米',
      initialQtyAtOpen:150,
      configuredInitialQty:150,
      remainingQty:150,
      firstPartyStopAt:3,
      thirdPartyStopAt:10,
    });
    expect(readLocalCapacityPoolRows()).toHaveLength(1);
    expect(localStorage.getItem(LOCAL_CAPACITY_POOL_STATE_KEY)).toBeTruthy();

    const replay=ensureCurrentCapacityPoolState(now+60_000);
    expect(replay.pools[0]?.remainingQty).toBe(150);
    expect(readLocalCapacityPoolRows()).toHaveLength(1);
  });

  it('preserves same-day operational remaining across Admin config refresh and deactivate/reactivate',()=>{
    applyCapacity(1,[purple]);
    const now=new Date('2026-09-27T04:00:00.000Z').getTime();
    const opened=ensureCurrentCapacityPoolState(now);
    const row=opened.pools[0]!;
    writeLocalCapacityPoolRows(readLocalCapacityPoolRows().map(item=>
      item.businessDate===row.businessDate&&item.poolId===row.poolId
        ?{...item,remainingQty:12,updatedAt:now+1}
        :item
    ));

    applyCapacity(2,[{...purple,initialQty:200,firstPartyStopAt:4,thirdPartyStopAt:12}]);
    const refreshed=ensureCurrentCapacityPoolState(now+2);
    expect(refreshed.pools[0]).toMatchObject({
      remainingQty:12,
      initialQtyAtOpen:150,
      configuredInitialQty:200,
      firstPartyStopAt:4,
      thirdPartyStopAt:12,
    });

    applyCapacity(3,[{...purple,initialQty:200,active:false}]);
    expect(ensureCurrentCapacityPoolState(now+3).pools).toHaveLength(0);

    applyCapacity(4,[{...purple,initialQty:200,active:true}]);
    const reactivated=ensureCurrentCapacityPoolState(now+4);
    expect(reactivated.pools[0]).toMatchObject({remainingQty:12,initialQtyAtOpen:150,configuredInitialQty:200});
    expect(readLocalCapacityPoolRows().filter(item=>item.poolId==='CAP01'&&item.businessDate==='2026-09-27')).toHaveLength(1);
  });

  it('resets by opening a new row exactly when Business Day changes',()=>{
    applyCapacity(1,[purple]);
    const beforeCutoff=new Date('2026-09-27T20:59:00.000Z').getTime(); // 04:59 HKT on Sep 28
    const before=ensureCurrentCapacityPoolState(beforeCutoff);
    expect(before.businessDate).toBe('2026-09-27');

    writeLocalCapacityPoolRows(readLocalCapacityPoolRows().map(item=>
      item.businessDate===before.businessDate&&item.poolId==='CAP01'?{...item,remainingQty:7}:item
    ));

    const afterCutoff=new Date('2026-09-27T21:00:00.000Z').getTime(); // 05:00 HKT on Sep 28
    const after=ensureCurrentCapacityPoolState(afterCutoff);
    expect(after.businessDate).toBe('2026-09-28');
    expect(after.pools[0]).toMatchObject({remainingQty:150,initialQtyAtOpen:150});
    expect(readLocalCapacityPoolRows()).toEqual(expect.arrayContaining([
      expect.objectContaining({businessDate:'2026-09-27',poolId:'CAP01',remainingQty:7}),
      expect.objectContaining({businessDate:'2026-09-28',poolId:'CAP01',remainingQty:150}),
    ]));
  });

  it('fails closed on corrupted local state instead of silently refilling a pool',()=>{
    applyCapacity(1,[purple]);
    localStorage.setItem(LOCAL_CAPACITY_POOL_STATE_KEY,'not-json');
    expect(()=>ensureCurrentCapacityPoolState(new Date('2026-09-27T04:00:00.000Z').getTime()))
      .toThrow('CAPACITY_POOL_STATE_INVALID');
  });

  it('initializes a new active pool introduced mid-day without resetting existing pools',()=>{
    applyCapacity(1,[purple]);
    const now=new Date('2026-09-27T04:00:00.000Z').getTime();
    ensureCurrentCapacityPoolState(now);
    writeLocalCapacityPoolRows(readLocalCapacityPoolRows().map(item=>item.poolId==='CAP01'?{...item,remainingQty:11}:item));

    applyCapacity(2,[purple,{...purple,id:'CAP02',name:'咖喱',initialQty:20,productIds:['curry'],firstPartyStopAt:1,thirdPartyStopAt:2}]);
    const view=ensureCurrentCapacityPoolState(now+1000);
    expect(view.pools.map(pool=>[pool.poolId,pool.remainingQty])).toEqual([['CAP01',11],['CAP02',20]]);
  });
});