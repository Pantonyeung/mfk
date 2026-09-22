import {describe,expect,it} from 'vitest';
import {buildKeetaMenuProjection} from '../keeta-menu-projection.ts';

const snapshot={
  catalog:{
    categories:[
      {id:'riceball',name:'飯團',position:10,active:true},
      {id:'drink',name:'飲品',position:20,active:true},
    ],
    products:[
      {
        id:'p1',productCode:'RB-A',name:'原味飯團',categoryId:'riceball',active:true,
        basePrice:'41.00',takeawayAdjustment:'1.00',takeawaySurchargeEnabled:true,
        modifierGroupIds:['size'],description:'紫米飯團',
      },
      {
        id:'tea',productCode:'TEA-1',name:'台式奶茶',categoryId:'drink',active:true,
        basePrice:'16.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,
        modifierGroupIds:[],
      },
    ],
  },
  optionCenter:{
    sets:[{
      id:'size',name:'份量',min:1,max:1,allowQuantities:false,active:true,
      options:[
        {id:'normal',code:'NORMAL',name:'正常',priceAdjustment:'0.00',active:true},
        {id:'less',code:'LESS',name:'少飯',priceAdjustment:'-1.00',active:true},
      ],
    }],
    productLinks:[{productId:'p1',setId:'size',defaultOptionIds:['normal']}],
  },
};

describe('Keeta full menu projection',()=>{
  it('builds a complete OpenItemCode full snapshot from canonical Admin catalog',()=>{
    const result=buildKeetaMenuProjection(snapshot);
    expect(result.summary).toEqual({categories:2,choiceGroups:1,options:2,spus:2,skus:2});
    expect(result.payload.shopCategoryList.map(row=>row.openItemCode)).toEqual(['CAT:riceball','CAT:drink']);
    expect(result.payload.choiceGroupList[0]).toMatchObject({
      openItemCode:'GRP:size',minNumber:1,maxNumber:1,repeatable:0,
    });
    expect(result.payload.spuList[0]).toMatchObject({
      openItemCode:'SPU:RB-A',
      name:'原味飯團',
      status:1,
      shopCategoryOpenItemCodeList:['CAT:riceball'],
      userGetModeList:['delivery','pickup'],
    });
    expect((result.payload.spuList[0]?.skuList as Array<Record<string,unknown>>)[0]).toMatchObject({
      openItemCode:'RB-A',
      price:'42.00',
      pickPrice:'42.00',
      canteenPrice:'41.00',
      currency:'HKD',
      choiceGroupOpenItemCodeList:['GRP:size'],
    });
    expect(result.payload.spuSequenceCodeMap['CAT:riceball']).toEqual(['SPU:RB-A']);
  });

  it('fails closed on duplicate canonical product codes before a destructive full snapshot can be sent',()=>{
    const duplicate={
      ...snapshot,
      catalog:{
        ...snapshot.catalog,
        products:[
          snapshot.catalog.products[0],
          {...snapshot.catalog.products[1],productCode:'RB-A'},
        ],
      },
    };
    expect(()=>buildKeetaMenuProjection(duplicate)).toThrow(/KEETA_MENU_PRODUCT_CODE_DUPLICATE:RB-A/);
  });

  it('keeps option adjustment semantics explicit in the provider payload',()=>{
    const result=buildKeetaMenuProjection(snapshot);
    const options=result.payload.choiceGroupList[0]?.choiceGroupSkuList as Array<Record<string,unknown>>;
    expect(options[1]).toMatchObject({
      openItemCode:'OPT:size:LESS',
      name:'少飯',
      price:'-1.00',
      pickPrice:'-1.00',
      canteenPrice:'-1.00',
      status:1,
    });
  });
});
