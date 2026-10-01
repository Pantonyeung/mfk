import {describe,expect,it} from 'vitest';
import {
  addFormalCapacityPool,
  patchFormalCapacityConfig,
  readFormalCapacity,
  removeFormalCapacityPool,
  replaceFormalCapacityPool,
  validateFormalCapacity,
  writeFormalCapacity,
} from './formal-capacity.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    capacity:{
      dailyLimit:'120',
      warningAt:80,
      hardStop:false,
      note:'legacy',
      extra:'keep-capacity',
      pools:[{
        id:'CAP01',
        name:'紫米',
        active:true,
        initialQty:150,
        productIds:['p1'],
        firstPartyStopAt:3,
        thirdPartyStopAt:10,
        note:'今日額度',
      }],
    },
  } as Record<string,unknown>;
}

describe('formal capacity adapter',()=>{
  it('reads and writes canonical capacity config preserving unknown fields',()=>{
    const config=readFormalCapacity(snapshot());
    expect(config.pools[0]).toMatchObject({id:'CAP01',name:'紫米',initialQty:150});
    const next=writeFormalCapacity(snapshot(),{...config,note:'changed'}) as any;
    expect(next.capacity).toMatchObject({note:'changed',extra:'keep-capacity'});
    expect(next.untouched.keep).toBe(true);
  });

  it('patches legacy capacity settings without dropping pools',()=>{
    const next=patchFormalCapacityConfig(snapshot(),{warningAt:70});
    expect(readFormalCapacity(next).warningAt).toBe(70);
    expect(readFormalCapacity(next).pools).toHaveLength(1);
  });

  it('adds stable next pool id and removes pool',()=>{
    const added=addFormalCapacityPool(snapshot());
    expect(added.poolId).toBe('CAP02');
    expect(readFormalCapacity(added.snapshot).pools.map(pool=>pool.id)).toEqual(['CAP01','CAP02']);
    const removed=removeFormalCapacityPool(added.snapshot,'CAP02');
    expect(readFormalCapacity(removed).pools.map(pool=>pool.id)).toEqual(['CAP01']);
  });

  it('rejects activation when required pool fields are incomplete',()=>{
    const bad={id:'CAP01',name:'',active:true,initialQty:10,productIds:[],firstPartyStopAt:0,thirdPartyStopAt:0,note:''};
    expect(()=>replaceFormalCapacityPool(snapshot(),bad)).toThrow('FORMAL_CAPACITY_POOL_INVALID');
  });

  it('validates active canonical pool config',()=>{
    expect(validateFormalCapacity(snapshot())).toEqual([]);
  });
});
