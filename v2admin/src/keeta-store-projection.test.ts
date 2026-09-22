import {describe,expect,it} from 'vitest';
import {buildKeetaSellabilityProjection,buildKeetaWeeklyHoursProjection,chunkKeetaSpuStatus} from '../keeta-store-projection.ts';

const snapshot={
  channelPolicy:{syncSellability:true},
  availability:{
    p1:{sellable:true},
    p2:{sellable:false},
  },
  catalog:{
    products:[
      {id:'p1',productCode:'RB-A',active:true},
      {id:'p2',productCode:'BX 2',active:true},
      {id:'p3',productCode:'OLD',active:false},
    ],
  },
  storeSettings:{
    weeklyHours:{
      MON:{closed:false,opensAt:'11:00',closesAt:'20:00'},
      TUE:{closed:false,opensAt:'11:00',closesAt:'20:00'},
      WED:{closed:false,opensAt:'11:00',closesAt:'20:00'},
      THU:{closed:false,opensAt:'11:00',closesAt:'20:00'},
      FRI:{closed:false,opensAt:'11:00',closesAt:'20:00'},
      SAT:{closed:true,opensAt:'11:00',closesAt:'20:00'},
      SUN:{closed:false,opensAt:'11:00',closesAt:'20:00'},
    },
  },
};

describe('Keeta K4 published-config projection',()=>{
  it('uses K3-compatible SPU OpenItemCodes and canonical sellability only',()=>{
    const result=buildKeetaSellabilityProjection(snapshot);
    expect(result.enabled).toBe(true);
    expect(result.available).toEqual(['SPU:RB-A']);
    expect(result.unavailable).toEqual(['SPU:BX_2']);
    expect(result.total).toBe(2);
  });

  it('projects weekly business hours and full-day closure deterministically',()=>{
    const result=buildKeetaWeeklyHoursProjection(snapshot);
    expect(result.mon).toEqual([{startTime:39600,endTime:72000}]);
    expect(result.sat).toEqual([{startTime:0,endTime:0}]);
    expect(Object.keys(result)).toHaveLength(7);
  });

  it('bounds SPU status batches to 200',()=>{
    const rows=Array.from({length:401},(_,index)=>'SPU:'+index);
    const batches=chunkKeetaSpuStatus(rows);
    expect(batches.map(batch=>batch.length)).toEqual([200,200,1]);
  });
});
