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


describe('Owner canonical monthly planning domain',()=>{
  function memoryState(shared=new Map<string,unknown>()){
    return {
      shared,
      state:{
        storage:{
          get:async(key:string)=>shared.get(key),
          put:async(key:string,value:unknown)=>{shared.set(key,value);},
          delete:async(key:string)=>{shared.delete(key);},
          list:async(options?:{prefix?:string})=>{
            const prefix=String(options?.prefix||'');
            return new Map([...shared.entries()].filter(([key])=>key.startsWith(prefix)));
          },
        },
        getWebSockets:()=>[],
      },
    };
  }

  const input=(expectedRevision=0)=>({
    monthKey:'2026-09',
    monthlyRevenueTargetMinor:20000000,
    costLines:[
      {costLineId:'RENT',category:'RENT',label:'屋租',plannedMonthlyMinor:3000000,actualToDateMinor:3000000,note:'租金'},
      {costLineId:'UTILITIES_WATER',category:'UTILITIES_WATER',label:'水',plannedMonthlyMinor:100000,actualToDateMinor:80000},
      {costLineId:'UTILITIES_ELECTRICITY',category:'UTILITIES_ELECTRICITY',label:'電',plannedMonthlyMinor:500000,actualToDateMinor:420000},
      {costLineId:'UTILITIES_GAS',category:'UTILITIES_GAS',label:'煤氣',plannedMonthlyMinor:200000,actualToDateMinor:170000},
      {costLineId:'LABOR',category:'LABOR',label:'人工',plannedMonthlyMinor:4000000,actualToDateMinor:3500000},
      {costLineId:'OTHER',category:'OTHER',label:'其他',plannedMonthlyMinor:500000,actualToDateMinor:null},
    ],
    note:'九月管理計劃',
    expectedRevision,
    operationId:'op-owner-plan-0001-'+expectedRevision,
  });

  it('reads EMPTY then writes canonical MFK_OWNER_MONTHLY_PLAN_V1 with revision and readback',async()=>{
    const mem=memoryState();
    const runtime=new AdminSyncStore(mem.state as never,{} as never);
    const empty=await runtime.ownerMonthlyPlanRead('MF01','2026-09');
    expect(empty).toEqual({status:200,body:{state:'EMPTY',monthKey:'2026-09',revision:0}});

    const result=await runtime.ownerMonthlyPlanSave('MF01',input(0),{staffId:'owner-1',loginId:'1111'} as never);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      state:'CONFIRMED',
      monthKey:'2026-09',
      revision:1,
      plan:{
        schema:'MFK_OWNER_MONTHLY_PLAN_V1',
        storeId:'MF01',
        monthKey:'2026-09',
        monthlyRevenueTargetMinor:20000000,
        revision:1,
        updatedBy:'owner-1',
      },
    });
    expect(result.body.plan.costLines).toHaveLength(6);

    const readback=await runtime.ownerMonthlyPlanRead('MF01','2026-09');
    expect(readback.status).toBe(200);
    expect(readback.body.state).toBe('CONFIRMED');
    expect(readback.body.revision).toBe(1);
    expect(readback.body.plan).toEqual(result.body.plan);
  });

  it('fails closed on expectedRevision conflict and preserves the canonical version',async()=>{
    const mem=memoryState();
    const runtime=new AdminSyncStore(mem.state as never,{} as never);
    const first=await runtime.ownerMonthlyPlanSave('MF01',input(0),{staffId:'owner-1',loginId:'1111'} as never);
    expect(first.body.revision).toBe(1);

    const conflict=await runtime.ownerMonthlyPlanSave('MF01',{
      ...input(0),
      monthlyRevenueTargetMinor:99999999,
      operationId:'op-owner-plan-conflict',
    },{staffId:'owner-2',loginId:'2222'} as never);
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      state:'REJECTED',
      code:'OWNER_MONTHLY_PLAN_REVISION_CONFLICT',
      currentRevision:1,
    });

    const readback=await runtime.ownerMonthlyPlanRead('MF01','2026-09');
    expect(readback.body.plan.monthlyRevenueTargetMinor).toBe(20000000);
    expect(readback.body.revision).toBe(1);
  });

  it('new runtime instance reads the same canonical monthly plan from shared AdminSyncStore storage',async()=>{
    const shared=new Map<string,unknown>();
    const firstDevice=memoryState(shared);
    const runtimeA=new AdminSyncStore(firstDevice.state as never,{} as never);
    await runtimeA.ownerMonthlyPlanSave('MF01',input(0),{staffId:'owner-1',loginId:'1111'} as never);

    const secondDevice=memoryState(shared);
    const runtimeB=new AdminSyncStore(secondDevice.state as never,{} as never);
    const readback=await runtimeB.ownerMonthlyPlanRead('MF01','2026-09');
    expect(readback.status).toBe(200);
    expect(readback.body).toMatchObject({
      state:'CONFIRMED',
      revision:1,
      plan:{monthlyRevenueTargetMinor:20000000,note:'九月管理計劃'},
    });
  });

  it('owner planning HTTP write requires authenticated OWNER session and returns canonical readback',async()=>{
    const shared=new Map<string,unknown>();
    const token='owner-session-token-abcdefghijklmnopqrstuvwxyz-1234567890';
    const tokenHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const tokenHex=[...new Uint8Array(tokenHash)].map(value=>value.toString(16).padStart(2,'0')).join('');
    shared.set('active',{
      storeId:'MF01',revision:1,fingerprint:'active-owner-test',
      snapshot:{staffAuth:{staff:[{
        staffId:'owner-1',loginId:'1111',name:'Owner',role:'OWNER',scope:'STORE',active:true,permissions:[],
        pinVerifier:{algorithm:'PBKDF2-SHA256',iterations:100000,saltHex:'aa',hashHex:'a'.repeat(64)},
      }]}},
    });
    shared.set('owner:session:'+tokenHex,{staffId:'owner-1',createdAt:'2026-09-27T00:00:00Z',lastSeenAt:'2026-09-27T00:00:00Z',expiresAt:'2030-09-27T00:00:00Z'});
    const mem=memoryState(shared);
    const runtime=new AdminSyncStore(mem.state as never,{} as never);

    const unauthorized=await runtime.fetch(new Request('https://internal/owner/planning/monthly?storeId=MF01',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input(0)),
    }));
    expect(unauthorized.status).toBe(401);

    const response=await runtime.fetch(new Request('https://internal/owner/planning/monthly?storeId=MF01',{
      method:'POST',
      headers:{'content-type':'application/json','x-mfk-owner-session':token},
      body:JSON.stringify(input(0)),
    }));
    expect(response.status).toBe(200);
    const body=await response.json() as any;
    expect(body).toMatchObject({state:'CONFIRMED',revision:1,plan:{updatedBy:'owner-1'}});
  });
});
