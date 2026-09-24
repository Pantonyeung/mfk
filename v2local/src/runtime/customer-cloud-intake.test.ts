import {describe,expect,it} from 'vitest';
import {priceCustomerCart} from './customer-cloud-intake.ts';
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
});
