import {describe,expect,it} from 'vitest';
import {
  capacityPoolCanActivate,
  nextCapacityPoolId,
  normalizeCapacityPool,
  normalizeCapacityPoolConfig,
} from '../../contracts/capacity-pool-v1.ts';

describe('CAP0 capacity-pool config contract',()=>{
  it('keeps legacy capacity config compatible while adding an empty pool collection',()=>{
    const config=normalizeCapacityPoolConfig({
      dailyLimit:'120',
      warningAt:80,
      hardStop:false,
      note:'legacy',
    });
    expect(config).toMatchObject({
      dailyLimit:'120',
      warningAt:80,
      hardStop:false,
      note:'legacy',
      pools:[],
    });
  });

  it('normalizes pool identity, quantities, channel thresholds and product bindings',()=>{
    const pool=normalizeCapacityPool({
      id:' CAP01 ',
      name:' 紫米 ',
      active:true,
      initialQty:150,
      productIds:['riceball','riceball','pork',''],
      firstPartyStopAt:3,
      thirdPartyStopAt:10,
      note:' 今日額度 ',
    });
    expect(pool).toEqual({
      id:'CAP01',
      name:'紫米',
      active:true,
      initialQty:150,
      productIds:['riceball','pork'],
      firstPartyStopAt:3,
      thirdPartyStopAt:10,
      note:'今日額度',
    });
    expect(capacityPoolCanActivate(pool)).toBe(true);
  });

  it('does not allow an active pool without a name, bound product or valid thresholds',()=>{
    expect(capacityPoolCanActivate(normalizeCapacityPool({
      id:'CAP01',name:'',active:false,initialQty:150,productIds:['riceball'],firstPartyStopAt:3,thirdPartyStopAt:10,
    }))).toBe(false);
    expect(capacityPoolCanActivate(normalizeCapacityPool({
      id:'CAP01',name:'紫米',active:false,initialQty:150,productIds:[],firstPartyStopAt:3,thirdPartyStopAt:10,
    }))).toBe(false);
    expect(capacityPoolCanActivate(normalizeCapacityPool({
      id:'CAP01',name:'紫米',active:false,initialQty:10,productIds:['riceball'],firstPartyStopAt:11,thirdPartyStopAt:0,
    }))).toBe(false);
  });

  it('allocates the next stable pool id without reusing an existing id',()=>{
    expect(nextCapacityPoolId([{id:'CAP01'},{id:'CAP03'}])).toBe('CAP02');
    expect(nextCapacityPoolId([{id:'CAP01'},{id:'CAP02'},{id:'CAP03'}])).toBe('CAP04');
  });
});