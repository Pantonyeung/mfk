import {describe,expect,it} from 'vitest';
import {AdminSyncStore,buildOwnerReadModelSnapshot,mapOwnerOrderProjection} from '../worker.ts';

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

  it('publishes Current Effective Sales as the only Owner planning sales metric',()=>{
    const snapshot=buildOwnerReadModelSnapshot({
      active:{storeId:'MF01',snapshot:{storeSettings:{storeName:'磨飯'}}},
      orders:[],
      reports:[
        {date:'2026-09-27',grossMinor:6000,refundMinor:800,netMinor:5200,orders:1},
        {date:'2026-09-26',grossMinor:4300,refundMinor:0,netMinor:4300,orders:1},
      ],
      acks:{},
      observedAt:'2026-09-27T01:10:00Z',
    });
    expect(snapshot.reports[0]).toMatchObject({
      businessDate:'2026-09-27',
      metricKind:'CURRENT_EFFECTIVE_SALES',
      currentEffectiveSalesMinor:5200,
      metricVersion:'MFK_CURRENT_EFFECTIVE_SALES_V1',
    });
    expect(snapshot.planningBasis).toMatchObject({
      month:'2026-09',
      businessDate:'2026-09-27',
      sourceMetric:'CURRENT_EFFECTIVE_SALES',
      sourceAuthority:'CANONICAL_REPORTING_PROJECTION',
      currentEffectiveSalesMtdMinor:9500,
      metricVersion:'MFK_CURRENT_EFFECTIVE_SALES_V1',
    });
    expect(snapshot.reports[0].currentEffectiveSalesMinor).not.toBe(6000);
  });

  it('passes canonical channel projection without converting health into accepting-orders truth',()=>{
    const channels=[{
      channelId:'KEETA',name:'Keeta',acceptingOrders:false,
      desiredState:'OPEN',observedState:'PAUSED',health:'HEALTHY',
      mode:'PAUSED',cause:'provider',freshness:'CURRENT',
      observedAt:'2026-09-27T01:09:00Z',readback:'PROVIDER_PAUSED',availableActions:[],
    }];
    const snapshot=buildOwnerReadModelSnapshot({
      active:{storeId:'MF01',snapshot:{storeSettings:{storeName:'磨飯'}}},
      orders:[],reports:[],acks:{},channels,observedAt:'2026-09-27T01:10:00Z',
    });
    expect(snapshot.channels).toEqual(channels);
    expect(snapshot.channels[0].health).toBe('HEALTHY');
    expect(snapshot.channels[0].acceptingOrders).toBe(false);
    expect(snapshot.channels[0].observedState).toBe('PAUSED');
  });

  it('derives Keeta and Customer channel health from existing responsibility domains',async()=>{
    const jsonResponse=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
    const env={
      KEETA_RUNTIME:{
        idFromName:(value:string)=>value,
        get:()=>({
          fetch:async(request:Request)=>{
            const path=new URL(request.url).pathname;
            if(path==='/admin/status')return jsonResponse({
              oauth:{state:'CONNECTED',lastCallbackAt:'2026-09-27T01:00:00Z'},
              webhook:{lastAcceptedAt:'2026-09-27T01:09:00Z'},
              knownExternalBlocker:null,
            });
            return jsonResponse({
              state:'AVAILABLE',
              readback:{observedAt:'2026-09-27T01:09:30Z',details:{data:{status:4}}},
              operation:{action:'REST',state:'COMPLETED',completedAt:'2026-09-27T01:09:30Z'},
            });
          },
        }),
      },
      CUSTOMER_RUNTIME:{
        idFromName:(value:string)=>value,
        get:()=>({fetch:async()=>jsonResponse({
          reachable:true,ageMs:2000,observedAt:'2026-09-27T01:10:00Z',
          lastOrderPull:{at:'2026-09-27T01:09:58Z'},
        })}),
      },
    };
    const state={
      storage:{
        get:async(key:string)=>key==='active'?{
          storeId:'MF01',
          snapshot:{
            channelPolicy:{enabled:true,displayName:'Keeta'},
            customerChannelPolicy:{enabled:true},
          },
        }:key==='acks'?{}:undefined,
        list:async()=>new Map(),
      },
      getWebSockets:()=>[],
    };
    const runtime=new AdminSyncStore(state as never,env as never);
    const channels=await runtime.ownerChannelReadModel(await state.storage.get('active'),'2026-09-27T01:10:00Z');
    expect(channels[0]).toMatchObject({
      channelId:'KEETA',acceptingOrders:false,desiredState:'OPEN',observedState:'PAUSED',
      health:'HEALTHY',mode:'PAUSED',freshness:'CURRENT',
    });
    expect(channels[1]).toMatchObject({
      channelId:'CUSTOMER',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',
      health:'HEALTHY',mode:'NORMAL',freshness:'CURRENT',
    });
    expect(channels[0].availableActions).toEqual([]);
    expect(channels[1].availableActions).toEqual([]);
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
    expect(snapshot.sellability[0].state).toBe('可售');
    expect(snapshot.devices[0].health).toBe('UNKNOWN');
    expect(snapshot.reports[0]).toMatchObject({
      businessDate:'2026-09-27',
      metricKind:'CURRENT_EFFECTIVE_SALES',
      currentEffectiveSalesMinor:5200,
      metricVersion:'MFK_CURRENT_EFFECTIVE_SALES_V1',
    });
  });

  it('passes channel facts through as projection without creating a second channel authority',()=>{
    const channels=[{
      channelId:'KEETA',name:'Keeta',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',
      health:'HEALTHY',mode:'NORMAL',cause:'unknown',freshness:'CURRENT',
      observedAt:'2026-09-27T01:09:00Z',readback:'PROVIDER_OPEN',availableActions:[],
    }];
    const snapshot=buildOwnerReadModelSnapshot({
      active:{storeId:'MF01',snapshot:{storeSettings:{storeName:'磨飯'},catalog:{products:[]},availability:{},staffAuth:{staff:[]}}},
      orders:[],reports:[],acks:{},channels,observedAt:'2026-09-27T01:10:00Z',
    });
    expect(snapshot.channels).toEqual(channels);
    expect(snapshot.channels[0].readback).toBe('PROVIDER_OPEN');
  });
});
