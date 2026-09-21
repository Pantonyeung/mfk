import {describe,expect,it} from 'vitest';
import {
  buildLocalReport,
  createLocalDayClose,
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
