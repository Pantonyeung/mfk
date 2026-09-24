import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {MFK_KEETA_ORDER_INTENT_SCHEMA,type MfkKeetaOrderIntent} from '../../../contracts/keeta-order-intake-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {readKeetaOrderIntakeAttention,reconcileKeetaOrderIntake,translateKeetaIntentToLocalOrder} from './keeta-order-intake.ts';
import {localRuntime} from './local-runtime.ts';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

function installAdminConfig(){
  applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:1,
    publishedAt:'2026-09-23T00:00:00.000Z',
    adminFingerprint:'fnv1a32:test',
    snapshot:{
      catalog:{
        categories:[{id:'cat',name:'主食',position:10,active:true}],
        products:[{id:'p1',name:'磨飯商品一',productCode:'SKU-P1',categoryId:'cat',active:true,basePrice:'42.00',takeawayAdjustment:'0',modifierGroupIds:[]}],
        modifierGroups:[],combos:[],comboPools:[],
      },
      channelMapping:[{providerItemId:'SKU-P1',productId:'p1',status:'MAPPED'}],
    },
  }));
}

function intent():MfkKeetaOrderIntent{
  return {
    schema:MFK_KEETA_ORDER_INTENT_SCHEMA,
    storeId:'MF01',
    provider:'KEETA',
    providerShopId:721578302,
    providerOrderId:'998',
    providerMessageId:'MSG-998',
    providerPushedAt:'2026-09-23T00:01:00.000Z',
    receivedAt:'2026-09-23T00:01:01.000Z',
    fingerprint:'a'.repeat(64),
    state:'PENDING_SMT',
    rawMessage:JSON.stringify({
      orderInfo:{
        baseOrder:{orderViewIdStr:'998',currency:'HKD'},
        merchantOrder:{orderViewIdStr:'998',seqNoStr:'K998'},
        products:[{
          id:1,skuId:11,spuId:22,skuOpenItemCode:'SKU-P1',spuOpenItemCode:'SPU-P1',
          name:'Provider 商品',count:2,currency:'HKD',
          priceWithGroup:{originUnitPrice:4100,unitPrice:4200,originAmount:8200,amount:8400},
          groups:[{
            groupOpenItemCode:'G-SPICY',groupName:'辣度',
            shopProductGroupSkuList:[{
              groupSkuOpenItemCode:'OPT-SPICY',spuName:'加辣',count:1,currency:'HKD',unitPrice:0,groups:[],
            }],
          }],
        }],
        feeDtls:[{code:'productPrice',currency:'HKD',price:8400}],
        orderPromotionDtlList:[],
      },
    }),
  };
}

describe('Keeta → SMT canonical local intake',()=>{
  beforeEach(()=>{
    installStorage();
    localRuntime.clear();
    installAdminConfig();
  });

  it('maps provider facts through Admin mapping and preserves provider options for production display',()=>{
    const translated=translateKeetaIntentToLocalOrder(intent());
    expect(translated.providerRef).toBe('KEETA:998');
    expect(translated.providerMessageId).toBe('MSG-998');
    expect(translated.totalMinor).toBe(8400);
    expect(translated.initialFulfillmentLabel).toBe('待處理');
    expect(translated.items).toEqual([{
      id:'p1',name:'磨飯商品一｜加辣',qty:2,unitMinor:4200,serviceMode:'takeaway',
      productCode:'SKU-P1',detail:'加辣',
    }]);
    expect(translated.providerPickupCode).toBe('K998');
  });

  it('commits the same providerRef exactly once through the existing localRuntime order authority',()=>{
    const translated=translateKeetaIntentToLocalOrder(intent());
    const first=localRuntime.createOrder(translated);
    const second=localRuntime.createOrder(translated);
    expect(second.id).toBe(first.id);
    expect(second.display).toBe(first.display);
    expect(localRuntime.orders()).toHaveLength(1);
    expect(localRuntime.orders()[0]?.providerRef).toBe('KEETA:998');
    expect(localRuntime.orders()[0]?.fulfillmentLabel).toBe('待處理');
  });

  it('maps published Keeta OpenItemCode namespace back to the canonical product code',()=>{
    const namespaced={...intent(),rawMessage:JSON.stringify({
      orderInfo:{
        baseOrder:{orderViewIdStr:'998',currency:'HKD'},merchantOrder:{orderViewIdStr:'998',seqNoStr:'K998'},
        products:[{id:1,skuId:11,spuId:22,skuOpenItemCode:'MF:SKU-P1',spuOpenItemCode:'SPU:SKU-P1',name:'Provider 商品',count:1,currency:'HKD',priceWithGroup:{originUnitPrice:4200,unitPrice:4200,originAmount:4200,amount:4200},groups:[]}],
        feeDtls:[{code:'productPrice',currency:'HKD',price:4200}],orderPromotionDtlList:[],
      },
    })};
    const translated=translateKeetaIntentToLocalOrder(namespaced);
    expect(translated.items[0]?.id).toBe('p1');
    expect(translated.items[0]?.name).toBe('磨飯商品一');
  });

  it('fails closed on missing product mapping instead of inventing a canonical product identity',()=>{
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:2,
      publishedAt:'2026-09-23T00:02:00.000Z',
      adminFingerprint:'fnv1a32:test2',
      snapshot:{
        catalog:{categories:[],products:[],modifierGroups:[],combos:[],comboPools:[]},
        channelMapping:[],
      },
    }));
    expect(()=>translateKeetaIntentToLocalOrder(intent())).toThrow(/KEETA_ORDER_MAPPING_REQUIRED/);
  });

  it('surfaces SMT transport authorization failure instead of silently returning',async()=>{
    const providerFetch=vi.fn(async()=>new Response(
      JSON.stringify({code:'KEETA_SMT_UNAUTHORIZED'}),
      {status:401,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      await reconcileKeetaOrderIntake();
      expect(readKeetaOrderIntakeAttention()).toEqual(expect.arrayContaining([
        expect.objectContaining({providerOrderId:'__TRANSPORT__',code:'KEETA_SMT_UNAUTHORIZED'}),
      ]));
    }finally{vi.unstubAllGlobals();}
  });

  it('surfaces mapping RED for a real pending intent instead of disappearing from the operator',async()=>{
    const bad={...intent(),providerOrderId:'999',providerMessageId:'MSG-999',rawMessage:JSON.stringify({
      orderInfo:{
        baseOrder:{orderViewIdStr:'999',currency:'HKD'},merchantOrder:{orderViewIdStr:'999',seqNoStr:'K999'},
        products:[{id:2,skuId:12,spuId:23,skuOpenItemCode:'UNKNOWN-SKU',spuOpenItemCode:'SPU-UNKNOWN',name:'Unknown',count:1,currency:'HKD',priceWithGroup:{originUnitPrice:1000,unitPrice:1000,originAmount:1000,amount:1000},groups:[]}],
        feeDtls:[{code:'productPrice',currency:'HKD',price:1000}],orderPromotionDtlList:[],
      },
    })};
    const providerFetch=vi.fn(async()=>new Response(
      JSON.stringify({orders:[bad]}),
      {status:200,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      await reconcileKeetaOrderIntake();
      expect(readKeetaOrderIntakeAttention()).toEqual(expect.arrayContaining([
        expect.objectContaining({providerOrderId:'999',code:expect.stringMatching(/KEETA_ORDER_MAPPING_REQUIRED/)}),
      ]));
      expect(localRuntime.orders()).toHaveLength(0);
    }finally{vi.unstubAllGlobals();}
  });

  it('prints accepted Keeta outputs only once across repeated acceptance',async()=>{
    const translated=translateKeetaIntentToLocalOrder(intent());
    const order=localRuntime.createOrder(translated);
    const providerFetch=vi.fn(async()=>new Response(JSON.stringify({state:'SUCCESS'}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const first=await localRuntime.acceptOrder(order.id);
      expect(first.status).toBe('ACCEPTED');
      const afterFirst=localRuntime.orders().find(row=>row.id===order.id);
      expect(afterFirst?.acceptancePrintedAt).toBeTruthy();
      const printedAt=afterFirst?.acceptancePrintedAt;
      const second=await localRuntime.acceptOrder(order.id);
      expect(second.status).toBe('ACCEPTED');
      expect(localRuntime.orders().find(row=>row.id===order.id)?.acceptancePrintedAt).toBe(printedAt);
    }finally{vi.unstubAllGlobals();}
  });

  it('keeps the SMT canonical accept/READY decision when Keeta provider mirroring needs attention',async()=>{
    const translated=translateKeetaIntentToLocalOrder(intent());
    const order=localRuntime.createOrder(translated);
    const providerFetch=vi.fn(async()=>new Response(
      JSON.stringify({state:'UNKNOWN',code:'KEETA_PROVIDER_COMMAND_UNKNOWN_READBACK_REQUIRED'}),
      {status:409,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const accepted=await localRuntime.acceptOrder(order.id);
      expect(accepted.status).toBe('ACCEPTED');
      expect(accepted.provider.state).toBe('ATTENTION');
      expect(localRuntime.orders().find(row=>row.id===order.id)?.fulfillmentLabel).toBe('進行中');

      const ready=await localRuntime.markOrderReady(order.id);
      expect(ready.status).toBe('READY');
      expect(ready.provider.state).toBe('ATTENTION');
      expect(localRuntime.orders().find(row=>row.id===order.id)?.fulfillmentLabel).toBe('可取餐');
    }finally{vi.unstubAllGlobals();}
  });

});
