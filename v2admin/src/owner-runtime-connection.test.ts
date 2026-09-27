import {describe,expect,it} from 'vitest';
import {buildOwnerReadModelSnapshot,mapOwnerOrderProjection} from '../worker.ts';

describe('Owner canonical read projection',()=>{
  it('preserves canonical fulfillmentLabel and never invents fulfillmentMode or payment state',()=>{
    const row=mapOwnerOrderProjection({
      orderId:'o1',display:'001',businessDate:'2026-09-27',totalMinor:5200,
      paymentLabel:'CASH',fulfillmentLabel:'可取餐',sourceLabel:'門店',
      items:[{id:'l1',name:'飯團',qty:1,unitMinor:5200}],updatedAt:'2026-09-27T01:00:00Z',
    });
    expect(row.fulfillmentLabel).toBe('可取餐');
    expect(row.lifecycle).toBe('ACTIVE');
    expect(row.currentTenderLabel).toBe('CASH');
    expect(row).not.toHaveProperty('fulfillmentMode');
    expect(row).not.toHaveProperty('paymentState');
    expect(row.itemLines[0].amountLabel).toBe('HK$52');
  });

  it('maps only existing canonical sources and leaves missing Owner domains empty',()=>{
    const snapshot=buildOwnerReadModelSnapshot({
      active:{
        storeId:'MF01',revision:3,fingerprint:'abc',
        snapshot:{
          storeSettings:{storeName:'磨飯'},
          catalog:{products:[{id:'p1',name:'飯團'}]},
          availability:{p1:{sellable:true}},
          staffAuth:{staff:[{staffId:'owner-1',name:'老闆',role:'OWNER',scope:'STORE',active:true,permissions:['REPORT_VIEW']}]},
        },
      },
      orders:[{orderId:'o1',display:'001',businessDate:'2026-09-27',totalMinor:5200,paymentLabel:'CASH',fulfillmentLabel:'已完成',sourceLabel:'門店',items:[],updatedAt:'2026-09-27T01:00:00Z'}],
      reports:[{date:'2026-09-27',netMinor:5200,orders:1}],
      acks:{device1:{deviceId:'SMT-1',revision:3,appliedAt:'2026-09-27T00:00:00Z'}},
      observedAt:'2026-09-27T01:10:00Z',
    });
    expect(snapshot.globalState).toBe('PARTIAL');
    expect(snapshot.store.storeName).toBe('磨飯');
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.today.salesLabel).toBe('HK$52');
    expect(snapshot.actions).toEqual([]);
    expect(snapshot.channels).toEqual([]);
    expect(snapshot.campaigns).toEqual([]);
    expect(snapshot.sellability[0].state).toBe('SELLABLE');
    expect(snapshot.devices[0].health).toBe('UNKNOWN');
  });
});
