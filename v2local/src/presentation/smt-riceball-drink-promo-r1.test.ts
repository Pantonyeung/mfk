import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {SyncedComboPool,SyncedOrderingProduct,SyncedRiceballDrinkPromotion} from '../runtime/admin-config-projection.ts';
import {
  RICEBALL_DRINK_PROMO_DETAIL,
  applyRiceballDrinkPromotion,
  riceballDrinkPromotionStateEqual,
  type PromoCartLine,
  type PromoProductCatalogs,
} from '../features/ordering/riceball-drink-promotion-model.ts';

const mainProduct=(id:string):SyncedOrderingProduct=>({
  id,categoryId:'rice',category:'紫米飯團',name:id,priceMinor:3000,priceReady:true,sellable:true,optionSets:[],
});
const drinkProduct=(id:string,priceMinor:number):SyncedOrderingProduct=>({
  id,categoryId:'drink',category:'星級特飲',name:id,priceMinor,priceReady:true,sellable:true,optionSets:[{
    id:'sweet',name:'甜度',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,
    options:[{id:'less',name:'少甜',priceAdjustmentMinor:100,defaultSelected:false,active:true}],
  }],
});

const handId='b3529ce7-9b4e-5d20-9e1e-e4ef68319561';
const mainId='929da914-3778-532d-92da-3fec9a65eff7';

const catalogs:PromoProductCatalogs={
  takeaway:[mainProduct(mainId),drinkProduct(handId,2200)],
  'dine-in':[mainProduct(mainId),drinkProduct(handId,2200)],
};
const pools:SyncedComboPool[]=[{
  id:'combo-rice-pool-a',name:'飯團 Pool A',kind:'MAIN_COURSE',groups:[{
    id:'g',name:'飯團',required:true,min:1,max:1,
    subPools:[{id:'band',name:'餐內',priceAdjustmentMinor:0,active:true,choices:[
      {id:'choice',type:'PRODUCT',productId:mainId,label:'',priceAdjustmentMinor:0,active:true},
    ]}],
  }],
}];
const rule:SyncedRiceballDrinkPromotion={
  active:true,
  eligibleMainPoolIds:['combo-rice-pool-a'],
  drinks:[{productId:handId,label:'手打檸檬茶',promoPriceMinor:1700}],
};

describe('SMT riceball standalone drink promotion',()=>{
  it('uses one riceball per one drink and leaves extra drink units at standalone price',()=>{
    const cart:PromoCartLine[]=[
      {id:'m1',productId:mainId,name:'飯團',qty:2,unitMinor:3000,serviceMode:'takeaway'},
      {id:'d1',productId:handId,name:'檸茶',qty:3,unitMinor:2300,serviceMode:'takeaway',detail:'甜度：少甜'},
    ];
    const next=applyRiceballDrinkPromotion(cart,catalogs,pools,rule);
    const drinks=next.filter(line=>line.productId===handId);
    expect(drinks).toHaveLength(3);
    expect(drinks.map(line=>line.unitMinor)).toEqual([1800,1800,2300]);
    expect(drinks.map(line=>String(line.detail||'').includes(RICEBALL_DRINK_PROMO_DETAIL))).toEqual([true,true,false]);
  });

  it('does not let an A3d paired meal unlock the standalone drink promotion',()=>{
    const cart:PromoCartLine[]=[
      {id:'m1',productId:mainId,name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway',detail:'套餐配對：A組 · 套餐：自選飯糰 A 餐 · 角色：飯團'},
      {id:'d1',productId:handId,name:'檸茶',qty:1,unitMinor:2200,serviceMode:'takeaway'},
    ];
    const next=applyRiceballDrinkPromotion(cart,catalogs,pools,rule);
    expect(next[1]?.unitMinor).toBe(2200);
    expect(next[1]?.detail).toBeUndefined();
  });

  it('removes promo price when the qualifying riceball disappears',()=>{
    const promoted:PromoCartLine[]=[
      {id:'d1',productId:handId,name:'檸茶',qty:1,unitMinor:1800,serviceMode:'takeaway',detail:RICEBALL_DRINK_PROMO_DETAIL+' · 甜度：少甜'},
    ];
    const next=applyRiceballDrinkPromotion(promoted,catalogs,pools,rule);
    expect(next[0]?.unitMinor).toBe(2300);
    expect(next[0]?.detail).toBe('甜度：少甜');
  });

  it('is deterministic and idempotent after normalization',()=>{
    const cart:PromoCartLine[]=[
      {id:'m1',productId:mainId,name:'飯團',qty:1,unitMinor:3000,serviceMode:'takeaway'},
      {id:'d1',productId:handId,name:'檸茶',qty:2,unitMinor:2200,serviceMode:'takeaway'},
    ];
    const one=applyRiceballDrinkPromotion(cart,catalogs,pools,rule);
    const two=applyRiceballDrinkPromotion(one,catalogs,pools,rule);
    expect(riceballDrinkPromotionStateEqual(one,two)).toBe(true);
  });

  it('locks the existing canonical lemon-tea Product to the $17 riceball promo without creating a duplicate Product',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const adminRoot=path.resolve(root,'../../v2admin/src');
    const promoSeed=fs.readFileSync(path.join(adminRoot,'admin-pricing-promotion-seed-r1.ts'),'utf8');
    const comboSeed=fs.readFileSync(path.join(adminRoot,'admin-combo-pool-seed-r4.ts'),'utf8');
    const menuSeed=fs.readFileSync(path.join(adminRoot,'admin-menu-seed-mf01-v2.ts'),'utf8');
    expect(promoSeed).toContain("productId:'"+handId+"',label:'手打檸檬茶',promoPrice:'17.00'");
    expect(comboSeed).toContain("productId:'"+handId+"',label:'手打檸檬茶'");
    expect(menuSeed).toContain('"id": "'+handId+'"');
    expect(menuSeed).toContain('"basePrice": "22.00"');
  });
});
