import {describe,expect,it,beforeEach,vi} from 'vitest';

const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{
  getItem:(key:string)=>storage.get(key)??null,
  setItem:(key:string,value:string)=>storage.set(key,value),
  removeItem:(key:string)=>storage.delete(key),
},configurable:true});

vi.mock('./admin-config-sync.ts',()=>({
  readSmtAdminConfigLkg:()=>({revision:7,fingerprint:'fp7'}),
  readSmtDeviceId:()=> 'SMT-1',
  readAdminSnapshotSection:(key:string)=>key==='storeSettings'?{diningTables:Array.from({length:9},(_,index)=>({id:'T'+String(index+1).padStart(2,'0'),name:index===2?'堂三':String(index+1)+' 號枱',active:index!==8,sortOrder:index+1}))}:{},
  subscribeSmtAdminConfig:()=>()=>{},
  subscribeSmtCloudDoorbell:()=>()=>{},
}));
vi.mock('./admin-config-projection.ts',()=>({
  projectSyncedCombos:()=>({combos:[],pools:[]}),
  projectSyncedOrderingCatalog:()=>({
    categories:[],
    products:[{
      id:'riceball',name:'原味飯團',sellable:true,priceReady:true,priceMinor:4100,
      optionSets:[{id:'sauce',name:'醬汁',required:false,min:0,max:1,options:[{id:'double',name:'雙倍醬',active:true,priceAdjustmentMinor:200}]}],
    }],
  }),
}));
vi.mock('./customer-cloud-intake.ts',()=>({
  priceCustomerCart:(cart:any[])=>{
    const line=cart[0];
    const adjustment=line.selections.some((x:any)=>x.optionId==='double')?200:0;
    return {items:[{id:'riceball',name:'原味飯團',qty:line.quantity,unitMinor:4100+adjustment,serviceMode:'takeaway'}],totalMinor:(4100+adjustment)*line.quantity};
  },
}));

import {createSmmLanIngress} from './smm-lan-ingress.ts';

describe('SMM LAN ingress',()=>{
  beforeEach(()=>storage.clear());

  it('rejects untrusted devices before Store Kernel mutation',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R1',submissionId:'S1',idempotencyKey:'I1',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:false});
    expect(result.disposition).toBe('REJECTED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('uses SMT catalog pricing and never creates a zero-price placeholder',()=>{
    const createOrder=vi.fn((input:any)=>({id:'ORDER-1',display:'001',createdAt:new Date().toISOString(),...input}));
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R2',submissionId:'S2',idempotencyKey:'I2',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:8600,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:2,publishedUnitPriceMinor:4300,selections:[{optionGroupId:'sauce',optionId:'double',optionName:'雙倍醬',publishedAdjustmentMinor:200}]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.displayCode).toBe('001');
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({totalMinor:8600,initialFulfillmentLabel:'進行中'}));
    expect(createOrder.mock.calls[0][0].items[0].unitMinor).toBe(4300);
  });

  it('recovers an already committed providerRef instead of duplicating Order',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[{id:'ORDER-X',display:'003',providerRef:'SMM:S3'}],holds:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R3',submissionId:'S3',idempotencyKey:'I3',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-X');
    expect(result.disposition==='ACCEPTED'&&result.displayCode).toBe('003');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('rejects a stale published menu revision before Store Kernel commit',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R4',submissionId:'S4',idempotencyKey:'I4',storeId:'MF01',
      menuRevision:'6',publishedTotalMinor:4100,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('REJECTED');
    expect(result.disposition==='REJECTED'&&result.reasonCode).toBe('SMM_MENU_REVISION_CHANGED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('routes trusted SMM dine-in through Dining authority and returns the linked Formal Order identity',()=>{
    const createOrder=vi.fn();
    const upsertSmmDiningHold=vi.fn(()=>({id:'HOLD-DINE',formalOrderId:'ORDER-DINE',formalOrderDisplay:'D005',providerRef:'SMM:S5'}));
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[],upsertSmmDiningHold} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R5',submissionId:'S5',idempotencyKey:'I5',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'DINE_IN',
      diningTarget:{kind:'TABLE',tableId:'T03',covers:2},
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-DINE');
    expect(result.disposition==='ACCEPTED'&&result.displayCode).toBe('D005');
    expect(createOrder).not.toHaveBeenCalled();
    expect(upsertSmmDiningHold).toHaveBeenCalledWith(expect.objectContaining({
      providerRef:'SMM:S5',
      target:{kind:'TABLE',tableId:'T03',covers:2},
      totalMinor:4100,
      sourceLabel:'SMM',
    }));
  });

  it('returns linked Formal Order and triggers initial print for SMM ordered WAITING Dining',()=>{
    const createOrder=vi.fn();
    const ensureDiningInitialPrint=vi.fn(()=>Promise.resolve({orderId:'ORDER-WAIT',state:'DONE',planned:3,sent:3,failed:0}));
    const upsertSmmDiningHold=vi.fn(()=>({id:'HOLD-WAIT',formalOrderId:'ORDER-WAIT',formalOrderDisplay:'W005',providerRef:'SMM:S5W'}));
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[],upsertSmmDiningHold,ensureDiningInitialPrint} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R5W',submissionId:'S5W',idempotencyKey:'I5W',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'DINE_IN',
      diningTarget:{kind:'WAITING',covers:2},
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-WAIT');
    expect(result.disposition==='ACCEPTED'&&result.displayCode).toBe('W005');
    expect(upsertSmmDiningHold).toHaveBeenCalledWith(expect.objectContaining({
      providerRef:'SMM:S5W',
      target:{kind:'WAITING',covers:2},
      totalMinor:4100,
      sourceLabel:'SMM',
    }));
    expect(ensureDiningInitialPrint).toHaveBeenCalledWith('HOLD-WAIT');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('triggers only the delta-print path when SMM adds items to an existing Dining Formal Order',()=>{
    const createOrder=vi.fn();
    const ensureDiningInitialPrint=vi.fn();
    const ensureDiningAdditionPrint=vi.fn(()=>Promise.resolve({
      orderId:'ORDER-DINE',additionId:'ADD-1',submissionId:'SMM:S5A',state:'DONE',planned:2,sent:2,failed:0,
    }));
    const upsertSmmDiningHold=vi.fn(()=>({
      id:'HOLD-DINE',
      formalOrderId:'ORDER-DINE',
      formalOrderDisplay:'D005',
      providerRef:'SMM:ORIGINAL',
      additions:[{id:'ADD-1',submissionId:'SMM:S5A'}],
    }));
    const ingress=createSmmLanIngress({
      createOrder,orders:()=>[],holds:()=>[],upsertSmmDiningHold,ensureDiningInitialPrint,ensureDiningAdditionPrint,
    } as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R5A',submissionId:'S5A',idempotencyKey:'I5A',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'DINE_IN',
      diningTarget:{kind:'TABLE',tableId:'T03',covers:2},
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-DINE');
    expect(ensureDiningAdditionPrint).toHaveBeenCalledWith('HOLD-DINE','ADD-1');
    expect(ensureDiningInitialPrint).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('projects canonical SMT orders and dining holds into the SMM shared read model',()=>{
    const createdAt='2026-09-25T13:30:00.000Z';
    const ingress=createSmmLanIngress({
      orders:()=>[{
        id:'ORDER-9',display:'P009',createdAt,updatedAt:createdAt,totalMinor:5600,paymentLabel:'現金',
        fulfillmentLabel:'進行中',sourceLabel:'SMM',items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:5600}],
      }],
      holds:()=>[{
        id:'HOLD-3',codeLabel:'H003',kind:'dining',createdAt,partySize:2,note:'SMM 堂食',totalMinor:8200,
        assignedTable:'T03',items:[{id:'riceball',name:'原味飯團',qty:2,unitMinor:4100}],
        payments:[{id:'PAY-1',createdAt,tender:'FPS',amountMinor:4100,selections:[{lineIndex:0,qty:1,amountMinor:4100}]}],
      }],
    } as any);
    const snapshot=ingress.readSnapshot() as any;
    expect(snapshot.diningTables).toEqual(expect.arrayContaining([expect.objectContaining({tableId:'T03',label:'堂三'})]));
    expect(snapshot.diningTables.some((row:any)=>row.tableId==='T09')).toBe(false);
        expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0]).toMatchObject({displayCode:'P009',lifecycle:'進行中',readback:'CONFIRMED'});
    expect(snapshot.dineSessions).toHaveLength(1);
    expect(snapshot.dineSessions[0]).toMatchObject({
      sessionId:'HOLD-3',tableLabel:'堂三',covers:2,totalMinor:8200,paidMinor:4100,remainingMinor:4100,
    });
    expect(snapshot.dineSessions[0].lines[0]).toMatchObject({qty:2,paidQty:1,remainingQty:1});
    expect(snapshot.work).toHaveLength(1);
    expect(snapshot.work[0]).toMatchObject({
      workId:'ORDER:ORDER-9',orderId:'ORDER-9',displayCode:'P009',kind:'FULFILLMENT',
      summary:'原味飯團 ×1',state:'NORMAL',observedAt:createdAt,source:'SMM',
      orderTime:createdAt,itemCount:1,serviceMode:'TAKEAWAY',statusLabel:'進行中',
    });
  });

  it('projects only canonical active non-dining orders into stable work without duplicates',()=>{
    const createdAt='2026-09-25T13:30:00.000Z';
    const order=(id:string,display:string,fulfillmentLabel:string)=>({
      id,display,createdAt,totalMinor:4100,paymentLabel:'現金',fulfillmentLabel,sourceLabel:'現場',
      items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
    });
    const ingress=createSmmLanIngress({
      orders:()=>[
        order('ACTIVE-1','P001','待處理'),
        order('ACTIVE-2','P002','進行中'),
        order('ACTIVE-3','P003','可取餐'),
        order('DONE-1','P004','已完成'),
        order('CANCEL-1','P005','已取消'),
        {...order('DINE-1','D001','進行中'),items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'}]},
      ],
      holds:()=>[],
    } as any);
    const first=ingress.readSnapshot() as any;
    const second=ingress.readSnapshot() as any;
    expect(first.work.map((row:any)=>row.workId)).toEqual(['ORDER:ACTIVE-1','ORDER:ACTIVE-2','ORDER:ACTIVE-3']);
    expect(new Set(first.work.map((row:any)=>row.workId)).size).toBe(first.work.length);
    expect(second.work).toEqual(first.work);
    expect(first.orders.map((row:any)=>row.orderId)).toEqual(['ACTIVE-1','ACTIVE-2','ACTIVE-3','DONE-1','CANCEL-1']);
    expect(first.dineSessions).toEqual([]);
  });


  it('routes trusted fulfillment commands through SMT and reads canonical state back',async()=>{
    let state:'待處理'|'進行中'|'可取餐'='待處理';
    const base={id:'ORDER-F1',display:'P101',createdAt:'2026-09-29T05:00:00.000Z',totalMinor:4100,paymentLabel:'現金',sourceLabel:'SMM',items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}]};
    const runtime:any={
      orders:()=>[{...base,fulfillmentLabel:state}],
      holds:()=>[],
      acceptOrder:vi.fn(async()=>{state='進行中';return{orderId:'ORDER-F1',status:'ACCEPTED'}}),
      markOrderReady:vi.fn(async()=>{state='可取餐';return{orderId:'ORDER-F1',status:'READY'}}),
    };
    const ingress=createSmmLanIngress(runtime);
    const accept=await ingress.commandFulfillment({protocolVersion:1,type:'smm.lan.fulfillment.command.v1',requestId:'FR1',commandId:'FC1',storeId:'MF01',orderId:'ORDER-F1',action:'ACCEPT'},{deviceId:'SMM-1',trusted:true});
    expect(accept).toMatchObject({disposition:'APPLIED',canonicalState:'進行中'});
    expect(runtime.acceptOrder).toHaveBeenCalledWith('ORDER-F1');
    const ready=await ingress.commandFulfillment({protocolVersion:1,type:'smm.lan.fulfillment.command.v1',requestId:'FR2',commandId:'FC2',storeId:'MF01',orderId:'ORDER-F1',action:'READY'},{deviceId:'SMM-1',trusted:true});
    expect(ready).toMatchObject({disposition:'APPLIED',canonicalState:'可取餐'});
    expect(runtime.markOrderReady).toHaveBeenCalledWith('ORDER-F1');
  });

  it('rejects untrusted or invalid SMM fulfillment transitions without mutation',async()=>{
    const acceptOrder=vi.fn();
    const markOrderReady=vi.fn();
    const base={id:'ORDER-F2',display:'P102',createdAt:'2026-09-29T05:00:00.000Z',totalMinor:4100,paymentLabel:'現金',sourceLabel:'SMM',fulfillmentLabel:'待處理',items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}]};
    const ingress=createSmmLanIngress({orders:()=>[base],holds:()=>[],acceptOrder,markOrderReady} as any);
    const untrusted=await ingress.commandFulfillment({protocolVersion:1,type:'smm.lan.fulfillment.command.v1',requestId:'FR3',commandId:'FC3',storeId:'MF01',orderId:'ORDER-F2',action:'ACCEPT'},{deviceId:'SMM-X',trusted:false});
    expect(untrusted).toMatchObject({disposition:'REJECTED',reasonCode:'SMM_LAN_DEVICE_NOT_TRUSTED'});
    const invalid=await ingress.commandFulfillment({protocolVersion:1,type:'smm.lan.fulfillment.command.v1',requestId:'FR4',commandId:'FC4',storeId:'MF01',orderId:'ORDER-F2',action:'READY'},{deviceId:'SMM-1',trusted:true});
    expect(invalid).toMatchObject({disposition:'REJECTED',reasonCode:'ORDER_NOT_READYABLE'});
    expect(acceptOrder).not.toHaveBeenCalled();
    expect(markOrderReady).not.toHaveBeenCalled();
  });

  it('rejects new assignment to an Admin-disabled table',()=>{
    const createOrder=vi.fn();
    const upsertSmmDiningHold=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[],holds:()=>[],upsertSmmDiningHold} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R6',submissionId:'S6',idempotencyKey:'I6',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'DINE_IN',
      diningTarget:{kind:'TABLE',tableId:'T09',covers:2},
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('REJECTED');
    expect(result.disposition==='REJECTED'&&result.reasonCode).toBe('SMM_DINING_TABLE_NOT_PUBLISHED');
    expect(upsertSmmDiningHold).not.toHaveBeenCalled();
  });

  it('keeps an existing hold on a disabled table readable with the last Admin label',()=>{
    const createdAt='2026-09-25T13:31:00.000Z';
    const ingress=createSmmLanIngress({
      orders:()=>[],
      holds:()=>[{
        id:'HOLD-9',codeLabel:'H009',kind:'dining',createdAt,partySize:2,note:'舊枱單',totalMinor:4100,
        assignedTable:'T09',items:[{id:'riceball',name:'原味飯團',qty:1,unitMinor:4100}],payments:[],
      }],
    } as any);
    const snapshot=ingress.readSnapshot() as any;
    expect(snapshot.dineSessions[0]).toMatchObject({sessionId:'HOLD-9',tableLabel:'9 號枱',remainingMinor:4100});
  });

});
