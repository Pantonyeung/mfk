import {describe,expect,it} from 'vitest';
import {
  buildLocalReport,
  createLocalDayClose,
  commitLocalDayCloseOnce,
  createLocalCashOpening,
  suggestOpeningCashFromPreviousClose,
  createLocalBackup,
  validateLocalBackup,
  restoreLocalBackup,
  type LocalReportOrder,
} from './local-operations.ts';

const orders:LocalReportOrder[]=[
  {
    id:'MFK-1',display:'P001',createdAt:'2026-09-21T03:00:00.000Z',
    totalMinor:5600,paymentLabel:'CASH',fulfillmentLabel:'待處理',sourceLabel:'現場',
    items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100},{id:'tea',name:'台式奶茶',qty:1,unitMinor:1500}],
  },
  {
    id:'MFK-2',display:'P002',createdAt:'2026-09-21T04:00:00.000Z',
    totalMinor:5000,paymentLabel:'CASH',fulfillmentLabel:'可取餐',sourceLabel:'現場',
    items:[{id:'bento',name:'肉燥便當',qty:1,unitMinor:5000}],
  },
];

describe('MFK local operations fusion',()=>{
  it('builds local report from local orders only',()=>{
    const report=buildLocalReport(orders,{now:new Date('2026-09-21T05:00:00.000Z').getTime(),businessStartHour:5});
    expect(report.completedOrders).toBe(2);
    expect(report.netSalesMinor).toBe(10600);
    expect(report.cashSalesMinor).toBe(10600);
    expect(report.itemUnits).toBe(3);
    expect(report.topProducts[0]).toEqual({name:'肉燥便當',quantity:1,salesMinor:5000});
  });

  it('creates versioned local day close with counted cash difference',()=>{
    const close=createLocalDayClose({
      orders,
      now:new Date('2026-09-21T05:00:00.000Z').getTime(),
      openingCashMinor:100000,
      countedCashMinor:110500,
      existing:[],
      note:'first close',
    });
    expect(close.version).toBe(1);
    expect(close.expectedCashMinor).toBe(110600);
    expect(close.cashDifferenceMinor).toBe(-100);
    expect(close.note).toBe('first close');
  });

  it('commits normal Day Close exactly once per Business Date',()=>{
    const values=new Map<string,string>();
    const storage={
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,value);},
    };
    const now=new Date('2026-09-21T12:00:00.000Z').getTime();
    const first=commitLocalDayCloseOnce({
      orders:[],
      now,
      openingCashMinor:100000,
      countedCashMinor:500000,
      cashRemovedMinor:400000,
    },storage);
    const repeated=commitLocalDayCloseOnce({
      orders:[],
      now,
      openingCashMinor:100000,
      countedCashMinor:999999,
      cashRemovedMinor:0,
    },storage);
    expect(first.created).toBe(true);
    expect(first.row.version).toBe(1);
    expect(first.row.countedCashMinor).toBe(500000);
    expect(repeated.created).toBe(false);
    expect(repeated.row.id).toBe(first.row.id);
    expect(repeated.row.countedCashMinor).toBe(500000);
    expect(JSON.parse(values.get('mfk.v2local.day-closes.v1')||'[]')).toHaveLength(1);
  });

  it('records cash taken out and derives retained float for next business day',()=>{
    const close=createLocalDayClose({
      orders:[],
      now:new Date('2026-09-21T12:00:00.000Z').getTime(),
      openingCashMinor:100000,
      countedCashMinor:500000,
      cashRemovedMinor:400000,
      existing:[],
      note:'take four thousand',
    });
    expect(close.countedCashMinor).toBe(500000);
    expect(close.cashRemovedMinor).toBe(400000);
    expect(close.retainedCashMinor).toBe(100000);

    const suggestion=suggestOpeningCashFromPreviousClose('2026-09-22',[close]);
    expect(suggestion).toEqual({
      amountMinor:100000,
      sourceCloseId:close.id,
      sourceCloseBusinessDate:close.businessDate,
      previousCountedCashMinor:500000,
      previousCashRemovedMinor:400000,
    });

    const opening=createLocalCashOpening({
      businessDate:'2026-09-22',
      amountMinor:100000,
      suggestion,
      now:123,
      staffId:'staff-1',
      staffName:'店員甲',
    });
    expect(opening.amountMinor).toBe(100000);
    expect(opening.changedFromSuggestion).toBe(false);
    expect(opening.sourceCloseId).toBe(close.id);
  });

  it('does not invent next-day float from historical closes without explicit retained cash',()=>{
    const legacy=createLocalDayClose({
      orders:[],
      now:new Date('2026-09-20T12:00:00.000Z').getTime(),
      openingCashMinor:100000,
      countedCashMinor:500000,
      existing:[],
    });
    expect(legacy.retainedCashMinor).toBeUndefined();
    expect(suggestOpeningCashFromPreviousClose('2026-09-21',[legacy])).toBeNull();
  });

  it('rejects cash removal larger than the physical counted cash',()=>{
    expect(()=>createLocalDayClose({
      orders:[],
      openingCashMinor:0,
      countedCashMinor:100000,
      cashRemovedMinor:100001,
      existing:[],
    })).toThrow('CASH_REMOVED_EXCEEDS_COUNTED');
  });

  it('counts only the CASH portion of a split COMBO tender in daily cash sales',()=>{
    const split:LocalReportOrder[]=[{
      id:'split-1',
      display:'P010',
      createdAt:'2026-09-21T04:00:00.000Z',
      totalMinor:5000,
      paymentLabel:'COMBO CASH $20.00 + FPS $30.00',
      fulfillmentLabel:'已完成',
      sourceLabel:'現場',
      items:[{id:'p1',name:'商品',qty:1,unitMinor:5000}],
    }];
    const report=buildLocalReport(split,{now:new Date('2026-09-21T05:00:00.000Z').getTime(),businessStartHour:5});
    expect(report.netSalesMinor).toBe(5000);
    expect(report.cashSalesMinor).toBe(2000);
  });

  it('keeps Dining order value, confirmed paid and outstanding as separate report facts',()=>{
    const dining:LocalReportOrder[]=[{
      id:'dining-1',
      display:'P020',
      createdAt:'2026-09-21T04:00:00.000Z',
      totalMinor:8200,
      paymentLabel:'部分付款',
      fulfillmentLabel:'進行中',
      sourceLabel:'堂食',
      recognizedSalesMinor:4100,
      outstandingMinor:4100,
      paymentEntries:[{
        createdAt:'2026-09-21T04:10:00.000Z',
        tender:'CASH',
        amountMinor:4100,
        selections:[{lineIndex:0,qty:1}],
      }],
      items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100}],
    }];
    const report=buildLocalReport(dining,{now:new Date('2026-09-21T05:00:00.000Z').getTime(),businessStartHour:5});
    expect(report.orderValueMinor).toBe(8200);
    expect(report.confirmedPaidMinor).toBe(4100);
    expect(report.outstandingMinor).toBe(4100);
    expect(report.grossSalesMinor).toBe(4100);
    expect(report.netSalesMinor).toBe(4100);
    expect(report.cashSalesMinor).toBe(4100);
    expect(report.itemUnits).toBe(1);
    expect(report.topProducts[0]).toEqual({name:'飯團',quantity:1,salesMinor:4100});
  });

  it('does not recognize an unpaid Dining open check as paid financial sales',()=>{
    const dining:LocalReportOrder[]=[{
      id:'dining-2',display:'P021',createdAt:'2026-09-21T04:00:00.000Z',
      totalMinor:8200,paymentLabel:'未收款',fulfillmentLabel:'進行中',sourceLabel:'堂食',
      recognizedSalesMinor:0,outstandingMinor:8200,paymentEntries:[],
      items:[{id:'rice',name:'飯團',qty:2,unitMinor:4100}],
    }];
    const report=buildLocalReport(dining,{now:new Date('2026-09-21T05:00:00.000Z').getTime(),businessStartHour:5});
    expect(report.orderValueMinor).toBe(8200);
    expect(report.confirmedPaidMinor).toBe(0);
    expect(report.outstandingMinor).toBe(8200);
    expect(report.grossSalesMinor).toBe(0);
    expect(report.cashSalesMinor).toBe(0);
    expect(report.itemUnits).toBe(0);
    expect(report.topProducts[0]).toEqual({name:'飯團',quantity:0,salesMinor:0});
  });

  it('backup validates and restores only MFK keys',()=>{
    const current={
      'mfk.v2local.runtime.v1':'runtime',
      'mfk.v2local.printers.v2':'printers',
      'other.app':'leave-me',
    };
    const backup=createLocalBackup(current,{now:123});
    expect(validateLocalBackup(backup)).toEqual({ok:true,errors:[]});
    const restored=restoreLocalBackup({'other.app':'leave-me'},backup);
    expect(restored['mfk.v2local.runtime.v1']).toBe('runtime');
    expect(restored['mfk.v2local.printers.v2']).toBe('printers');
    expect(restored['other.app']).toBe('leave-me');
  });
});
