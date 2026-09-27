import {beforeEach,describe,expect,it} from 'vitest';
import {
  createLocalDayClose,
  readLocalCashOpenings,
  writeLocalDayCloses,
} from './local-operations.ts';
import {
  cashOpeningRequired,
  confirmCashOpening,
  readCurrentCashOpeningState,
} from './cash-opening.ts';

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

describe('daily cash opening',()=>{
  beforeEach(()=>installStorage());

  it('suggests yesterday retained cash and confirms it once for the business date',()=>{
    const close=createLocalDayClose({
      orders:[],
      now:new Date('2026-09-21T04:00:00.000Z').getTime(),
      businessStartHour:5,
      openingCashMinor:100000,
      countedCashMinor:500000,
      cashRemovedMinor:400000,
      existing:[],
    });
    writeLocalDayCloses([close]);

    const now=new Date('2026-09-22T04:00:00.000Z').getTime();
    const before=readCurrentCashOpeningState(now);
    expect(before.businessDate).toBe('2026-09-22');
    expect(before.opening).toBeNull();
    expect(before.suggestion?.amountMinor).toBe(100000);
    expect(before.suggestion?.previousCountedCashMinor).toBe(500000);
    expect(before.suggestion?.previousCashRemovedMinor).toBe(400000);
    expect(cashOpeningRequired(now)).toBe(true);

    const opening=confirmCashOpening({amountMinor:100000,now});
    expect(opening.amountMinor).toBe(100000);
    expect(opening.changedFromSuggestion).toBe(false);
    expect(readLocalCashOpenings()).toHaveLength(1);
    expect(cashOpeningRequired(now)).toBe(false);

    const replay=confirmCashOpening({amountMinor:999999,now});
    expect(replay.amountMinor).toBe(100000);
    expect(readLocalCashOpenings()).toHaveLength(1);
  });

  it('records when the operator changes the suggested opening float',()=>{
    const close=createLocalDayClose({
      orders:[],
      now:new Date('2026-09-21T04:00:00.000Z').getTime(),
      businessStartHour:5,
      openingCashMinor:100000,
      countedCashMinor:500000,
      cashRemovedMinor:400000,
      existing:[],
    });
    writeLocalDayCloses([close]);
    const now=new Date('2026-09-22T04:00:00.000Z').getTime();
    const opening=confirmCashOpening({amountMinor:90000,now,note:'實際少一百'});
    expect(opening.suggestedMinor).toBe(100000);
    expect(opening.amountMinor).toBe(90000);
    expect(opening.changedFromSuggestion).toBe(true);
    expect(opening.note).toBe('實際少一百');
  });
});
