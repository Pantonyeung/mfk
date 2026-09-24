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

import {createSmmLanIngress,trustSmmDevice} from './smm-lan-ingress.ts';

describe('SMM LAN ingress',()=>{
  beforeEach(()=>storage.clear());

  it('rejects untrusted devices before Store Kernel mutation',()=>{
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R1',submissionId:'S1',idempotencyKey:'I1',storeId:'MF01',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,selections:[]}],
    },{deviceId:'SMM-1'});
    expect(result.disposition).toBe('REJECTED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('uses SMT catalog pricing and never creates a zero-price placeholder',()=>{
    trustSmmDevice('SMM-1');
    const createOrder=vi.fn((input:any)=>({id:'ORDER-1',display:'001',createdAt:new Date().toISOString(),...input}));
    const ingress=createSmmLanIngress({createOrder,orders:()=>[]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R2',submissionId:'S2',idempotencyKey:'I2',storeId:'MF01',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:2,selections:[{optionGroupId:'sauce',optionId:'double',optionName:'雙倍醬'}]}],
    },{deviceId:'SMM-1'});
    expect(result.disposition).toBe('ACCEPTED');
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({totalMinor:8600}));
    expect(createOrder.mock.calls[0][0].items[0].unitMinor).toBe(4300);
  });

  it('recovers an already committed providerRef instead of duplicating Order',()=>{
    trustSmmDevice('SMM-1');
    const createOrder=vi.fn();
    const ingress=createSmmLanIngress({createOrder,orders:()=>[{id:'ORDER-X',providerRef:'SMM:S3'}]} as any);
    const result=ingress.submit({
      protocolVersion:1,type:'smm.lan.order.submit.v1',requestId:'R3',submissionId:'S3',idempotencyKey:'I3',storeId:'MF01',
      lines:[{lineId:'L1',productId:'riceball',productName:'原味飯團',quantity:1,selections:[]}],
    },{deviceId:'SMM-1'});
    expect(result.disposition).toBe('ACCEPTED');
    expect(result.disposition==='ACCEPTED'&&result.orderId).toBe('ORDER-X');
    expect(createOrder).not.toHaveBeenCalled();
  });
});
