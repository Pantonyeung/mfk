import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {priceCustomerCart} from './customer-cloud-intake.ts';
import {customerReorderHistoryPriceFactsFromCart,customerReorderIntentFromCart} from '../../../contracts/customer-cloud-v1.ts';
import type {SyncedOrderingProduct} from './admin-config-projection.ts';

const products:readonly SyncedOrderingProduct[]=[
  {
    id:'bento',
    categoryId:'cat-bento',
    category:'便當',
    name:'肉燥便當',
    priceMinor:4200,
    priceReady:true,
    sellable:true,
    optionSets:[
      {
        id:'rice',
        name:'飯量',
        required:true,
        forceShow:true,
        selection:'SINGLE',
        min:1,
        max:1,
        options:[
          {id:'normal',name:'正常飯',priceAdjustmentMinor:0,defaultSelected:true,active:true},
          {id:'extra',name:'加飯',priceAdjustmentMinor:600,defaultSelected:false,active:true},
        ],
      },
      {
        id:'drink',
        name:'飲品',
        required:false,
        forceShow:false,
        selection:'SINGLE',
        min:0,
        max:1,
        options:[
          {id:'tea',name:'台式奶茶',priceAdjustmentMinor:800,defaultSelected:false,active:true},
        ],
      },
    ],
  },
];

describe('customer cloud local quote adapter',()=>{
  it('prices only from the published SMT ordering projection',()=>{
    const result=priceCustomerCart([
      {
        lineId:'L1',
        productId:'bento',
        productName:'肉燥便當',
        quantity:2,
        selections:[
          {optionGroupId:'rice',optionId:'extra',optionName:'加飯'},
          {optionGroupId:'drink',optionId:'tea',optionName:'台式奶茶'},
        ],
      },
    ],products);
    expect(result.totalMinor).toBe(11200);
    expect(result.items).toEqual([
      {
        id:'bento',
        name:'肉燥便當',
        qty:2,
        unitMinor:5600,
        serviceMode:'takeaway',
        detail:'加飯、台式奶茶',
      },
    ]);
  });

  it('fails closed when a required option is missing',()=>{
    expect(()=>priceCustomerCart([
      {
        lineId:'L2',
        productId:'bento',
        productName:'肉燥便當',
        quantity:1,
        selections:[],
      },
    ],products)).toThrow('CUSTOMER_OPTION_REQUIRED:bento:rice');
  });

  it('fails closed for stale or unknown options',()=>{
    expect(()=>priceCustomerCart([
      {
        lineId:'L3',
        productId:'bento',
        productName:'肉燥便當',
        quantity:1,
        selections:[{optionGroupId:'rice',optionId:'ghost',optionName:'舊選項'}],
      },
    ],products)).toThrow('CUSTOMER_OPTION_UNAVAILABLE:bento:rice:ghost');
  });

  it('uses the same Customer cloud reconcile loop for SMM staff orders',()=>{
    const source=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8');
    expect(source).toContain("bridgeKind==='SMM_STAFF'");
    expect(source).toContain('smmIngress.submit');
    expect(source).toContain("'/api/customer/smt/orders/pending'");
    expect(source).toContain("'/api/customer/smt/orders/ack'");
    expect(main).toContain('installCustomerCloudBridge()');
    expect(main).not.toContain('installSmmCloudIntake');
    expect(existsSync(new URL('./smm-cloud-intake.ts',import.meta.url))).toBe(false);
  });


  it('requires the Customer published menu revision and stages a matching own-channel order for operator review',()=>{
    const source=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    expect(source).toContain("const {envelope,catalog}=activeCatalog()");
    expect(source).toContain("CUSTOMER_MENU_REVISION_CHANGED");
    expect(source).toContain("String(intent.menuRevision)!==String(envelope.revision)");
    expect(source).toContain("initialFulfillmentLabel:'待處理'");
    expect(source).toContain("CUSTOMER_PAYMENT_EVIDENCE_REQUIRED");
    expect(source).toContain("customerName:intent.checkout.name");
    expect(source).toContain("sourceLabel:'自家 App'");
  });


  it('banks reorder copy intent without old price formal identity payment fulfillment or coupon facts',()=>{
    const copied=customerReorderIntentFromCart([{
      lineId:'FORMAL-LINE-OLD',
      productId:'bento',
      productName:'肉燥便當',
      quantity:1,
      selections:[{optionGroupId:'rice',optionId:'extra',optionName:'加飯'}],
      publishedUnitPriceMinor:4800,
      note:'少辣',
    }]);
    expect(copied).toEqual([{
      productId:'bento',
      productName:'肉燥便當',
      quantity:1,
      selections:[{optionGroupId:'rice',optionId:'extra',optionName:'加飯'}],
      note:'少辣',
    }]);
    expect(JSON.stringify(copied)).not.toContain('FORMAL-LINE-OLD');
    expect(JSON.stringify(copied)).not.toContain('publishedUnitPriceMinor');
    expect(JSON.stringify(copied)).not.toMatch(/payment|fulfillment|coupon/i);

    const historicalPriceFacts=customerReorderHistoryPriceFactsFromCart([{
      lineId:'FORMAL-LINE-OLD',
      productId:'bento',
      productName:'肉燥便當',
      quantity:1,
      selections:[],
      publishedUnitPriceMinor:4800,
    }]);
    expect(historicalPriceFacts).toEqual([{intentIndex:0,historicalPublishedUnitMinor:4800}]);

    const source=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    expect(source).toContain('customerReorderIntent:customerReorderIntentFromCart(intent.cart)');
    expect(source).toContain('customerReorderHistoryPriceFacts:customerReorderHistoryPriceFactsFromCart(intent.cart)');
  });

});
