import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {MFK_KEETA_ORDER_INTENT_SCHEMA,type MfkKeetaOrderIntent} from '../../../contracts/keeta-order-intake-v1.ts';
import {applyAdminConfigEnvelope} from './admin-config-sync.ts';
import {translateKeetaIntentToLocalOrder} from './keeta-order-intake.ts';
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
    }]);
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
});
