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
  subscribeSmtAdminConfig:()=>()=>{},
  subscribeSmtCloudDoorbell:()=>()=>{},
}));
vi.mock('./admin-config-projection.ts',()=>({
  projectSyncedOrderingCatalog:()=>({
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
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
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
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R2',submissionId:'S2',idempotencyKey:'I2',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:8600,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:2,publishedUnitPriceMinor:4300,selections:[{optionGroupId:'sauce',optionId:'double',optionName:'雙倍醬',publishedAdjustmentMinor:200}]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({totalMinor:8600}));
    expect(createOrder.mock.calls[0][0].items[0].unitMinor).toBe(4300);
  });

  it('recovers an already committed providerRef instead of duplicating Order',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[{id:'ORDER-X',providerRef:'SMM:S3'}]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R3',submissionId:'S3',idempotencyKey:'I3',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-X');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('rejects a stale published menu revision before Store Kernel commit',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R4',submissionId:'S4',idempotencyKey:'I4',storeId:'MF01',
      menuRevision:'6',publishedTotalMinor:4100,serviceMode:'TAKEAWAY',tender:'CASH',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('REJECTED');
    expect(result.disposition==='REJECTED'&&result.reasonCode).toBe('SMM_MENU_REVISION_CHANGED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('commits staff-selected dine-in tender without any drawer side effect',()=>{
    const createOrder=vi.fn((input:any)=>({id:'ORDER-DINE',display:'004',createdAt:new Date().toISOString(),...input}));
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R5',submissionId:'S5',idempotencyKey:'I5',storeId:'MF01',
      menuRevision:'7',publishedTotalMinor:4100,serviceMode:'DINE_IN',tender:'FPS',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,publishedUnitPriceMinor:4100,selections:[]}],
    },{deviceId:'SMM-1',trusted:true});
    expect(result.disposition).toBe('ACCEPTED');
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({paymentLabel:'FPS',sourceLabel:'SMM'}));
    expect(createOrder.mock.calls[0][0].items[0].serviceMode).toBe('dine-in');
  });
});
