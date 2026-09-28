import {describe,expect,it} from 'vitest';
import {buildDailyClosePrintData,renderDailyCloseTicket} from './daily-close-ticket.ts';
import type {PrintableOrder} from './print-routing.ts';
import type {LocalDayClose} from './local-operations.ts';

const close:LocalDayClose={
  id:'DAYCLOSE-2026-09-24-V1',
  businessDate:'2026-09-24',
  version:1,
  createdAt:Date.parse('2026-09-24T12:00:00.000Z'),
  openingCashMinor:100000,
  cashSalesMinor:12000,
  expectedCashMinor:112000,
  countedCashMinor:111500,
  cashDifferenceMinor:-500,
  retainedCashMinor:100000,
  cashRemovedMinor:11500,
  note:'測試日結',
};

const orders:(PrintableOrder&{fulfillmentLabel:string})[]=[
  {
    id:'O1',display:'P001',createdAt:'2026-09-24T03:00:00.000Z',totalMinor:5000,paymentLabel:'CASH',
    sourceLabel:'店內',fulfillmentLabel:'已完成',
    items:[{id:'p1',name:'商品一',qty:2,unitMinor:2500}],
  },
  {
    id:'O2',display:'P002',createdAt:'2026-09-24T04:00:00.000Z',totalMinor:7000,paymentLabel:'FPS',
    sourceLabel:'Keeta · 4890',fulfillmentLabel:'已完成',
    items:[{id:'p2',name:'商品二',qty:1,unitMinor:7000}],
  },
  {
    id:'O3',display:'P003',createdAt:'2026-09-24T05:00:00.000Z',totalMinor:3000,paymentLabel:'CASH',
    sourceLabel:'店內',fulfillmentLabel:'已取消',
    items:[{id:'p3',name:'商品三',qty:1,unitMinor:3000}],
  },
];

describe('daily close ticket',()=>{
  it('keeps cancelled paid orders as financial gross until an explicit refund exists',()=>{
    const data=buildDailyClosePrintData({orders,close});
    expect(data.orderCount).toBe(3);
    expect(data.itemUnits).toBe(4);
    expect(data.grossMinor).toBe(15000);
    expect(data.refundMinor).toBeUndefined();
    expect(data.channelRows).toEqual([
      {label:'店內',orders:2,grossMinor:8000,netMinor:8000},
      {label:'Keeta',orders:1,grossMinor:7000,netMinor:7000},
    ]);
    expect(data.paymentRows).toEqual([
      {label:'CASH',orders:2,amountMinor:8000},
      {label:'FPS',orders:1,amountMinor:7000},
    ]);
    expect(data.refundRows).toEqual([]);
    const ticket=renderDailyCloseTicket(data);
    expect(ticket).toContain('日結單 / DAILY CLOSE');
    expect(ticket).toContain('總訂單數：3 單');
    expect(ticket).toContain('總件數：4 件');
    expect(ticket).toContain('Keeta  1單  $70.00');
    expect(ticket).toContain('CASH  2單  $80.00');
    expect(ticket).toContain('退款總額：—（未接正式退款帳）');
    expect(ticket).toContain('差額：-$5.00');
  });

  it('prints canonical refund amount only when explicitly supplied',()=>{
    const data=buildDailyClosePrintData({orders,close,refundMinor:1000});
    expect(data.netMinor).toBe(14000);
    expect(renderDailyCloseTicket(data)).toContain('退款總額：-$10.00');
  });
});
