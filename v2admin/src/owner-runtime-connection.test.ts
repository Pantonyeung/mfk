import {describe,expect,it} from 'vitest';
import {AdminSyncStore,buildOwnerReadModelSnapshot,mapOwnerOrderProjection} from '../worker.ts';
import {createSmtProjectionEvent} from '../../contracts/smt-projection-v1.ts';

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
  it('projects human employee code and capability summary without exposing raw permission tokens',()=>{
    const snapshot=buildOwnerReadModelSnapshot({
      active:{
        storeId:'MF01',revision:4,fingerprint:'staff-safe',
        snapshot:{
          storeSettings:{storeName:'磨飯'},
          staffAuth:{staff:[
            {staffId:'internal-owner-1',loginId:'1111',name:'老闆',role:'OWNER',active:true,permissions:['REPORT_VIEW','ORDER_REVIEW']},
            {staffId:'staff-fallback',loginId:'staff-fallback',name:'店員甲',role:'STAFF',active:true,permissions:['UNKNOWN_TOKEN']},
            {staffId:'staff-name-fallback',loginId:'店員乙',name:'店員乙',role:'STAFF',active:true,permissions:[]},
          ]},
        },
      },
      orders:[],reports:[],acks:{},observedAt:'2026-09-27T01:10:00Z',
    });
    expect(snapshot.staff[0]).toMatchObject({staffId:'internal-owner-1',loginId:'1111',name:'老闆',role:'OWNER',presence:'UNKNOWN',capabilitySummary:'查看報表、查看訂單'});
    expect(snapshot.staff[0]).not.toHaveProperty('permissions');
    expect(snapshot.staff[1]).not.toHaveProperty('loginId');
    expect(snapshot.staff[1]).not.toHaveProperty('capabilitySummary');
    expect(snapshot.staff[2]).not.toHaveProperty('loginId');
    expect(JSON.stringify(snapshot.staff)).not.toContain('REPORT_VIEW');
    expect(JSON.stringify(snapshot.staff)).not.toContain('UNKNOWN_TOKEN');
  });

  it('queues Owner sellability for SMT without publishing a new Admin revision',async()=>{
    const values=new Map<string,any>();
    const state:any={
      storage:{
        get:async(key:string)=>values.get(key),
        put:async(key:string,value:any)=>{values.set(key,value);},
        list:async({prefix}:{prefix:string})=>new Map([...values].filter(([key])=>key.startsWith(prefix))),
      },
      getWebSockets:()=>[],
    };
    values.set('active',{
      storeId:'MF01',revision:11,fingerprint:'r11',adminFingerprint:'admin-r11',
      snapshot:{catalog:{products:[{id:'p1',name:'飯團',active:true}]},availability:{}},
    });
    const store=new AdminSyncStore(state,{});
    const result=await store.ownerSellabilityCommand(
      {staffId:'owner-1',loginId:'1111'},
      {operationId:'op-1',action:'PAUSE',targets:[{grain:'PRODUCT',targetId:'p1'}]},
    );
    expect(result.state).toBe('UNKNOWN');
    expect(values.get('active').revision).toBe(11);
    expect(values.get('owner:sellability:command:op-1')).toMatchObject({
      operationId:'op-1',action:'PAUSE',state:'PENDING_SMT',
    });
    expect(values.get('active').snapshot.availability).toEqual({});
  });

  it('auto-triggers existing Keeta sellability sync when latest SMT runtime projection is accepted',async()=>{
    const values=new Map<string,any>();
    const providerCalls:any[]=[];
    const state:any={
      storage:{
        get:async(key:string)=>values.get(key),
        put:async(key:string,value:any)=>{values.set(key,value);},
        list:async({prefix}:{prefix:string})=>new Map([...values].filter(([key])=>key.startsWith(prefix))),
      },
      getWebSockets:()=>[],
    };
    values.set('active',{storeId:'MF01',revision:12,fingerprint:'r12',snapshot:{channelPolicy:{syncSellability:true},catalog:{products:[{id:'p1',productCode:'P1',active:true}]}}});
    values.set('acks',{'SMT-1':{deviceId:'SMT-1',revision:12,fingerprint:'r12'}});
    const env:any={KEETA_RUNTIME:{
      idFromName:(id:string)=>id,
      get:()=>({fetch:async(request:Request)=>{providerCalls.push(await request.clone().json());return new Response('{}',{status:200});}}),
    }};
    const store=new AdminSyncStore(state,env);
    const event=createSmtProjectionEvent({
      storeId:'MF01',deviceId:'SMT-1',type:'RUNTIME_SELLABILITY_UPSERT',entityId:'p1',
      occurredAt:'2026-09-29T00:00:00.000Z',
      payload:{nodeId:'p1',status:'soldout',sellable:false,source:'SMT_RUNTIME',observedAt:'2026-09-29T00:00:00.000Z'},
    });
    const response=await store.fetch(new Request('https://internal/projection/events',{method:'POST',headers:{'content-type':'application/json',origin:'https://smt.morefunos.com'},body:JSON.stringify({events:[event]})}));
    expect(response.status).toBe(200);
    await Promise.resolve();
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0]).toMatchObject({revision:12,runtimeSellability:[{nodeId:'p1',status:'soldout'}]});
  });

});
