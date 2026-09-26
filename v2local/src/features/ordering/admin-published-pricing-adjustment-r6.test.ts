import {describe,expect,it} from 'vitest';
import {rebuildConfiguredLine,type FastLaneCartLine,type FastLaneProduct} from './fast-lane-model.ts';

const baseLine:FastLaneCartLine={id:'line-1',productId:'meal',name:'套餐',qty:1,unitMinor:4100,serviceMode:'dine-in'};

describe('Admin published pricing adjustments',()=>{
  it('accepts published negative option adjustment such as no-drink -$1',()=>{
    const product:FastLaneProduct={id:'meal',name:'套餐',priceMinor:4100,optionSets:[{id:'drink',name:'飲品',selection:'SINGLE',required:true,min:1,max:1,options:[{id:'tea',name:'台式奶茶',priceAdjustmentMinor:0},{id:'none',name:'不要飲品',priceAdjustmentMinor:-100}]}]};
    const line=rebuildConfiguredLine(baseLine,product,{drink:['none']},'');
    expect(line.unitMinor).toBe(4000);
    expect(line.detail).toContain('不要飲品');
  });

  it('accepts published adjustment that makes final line free',()=>{
    const product:FastLaneProduct={id:'gift',name:'附送飲品',priceMinor:100,optionSets:[{id:'gift',name:'優惠',selection:'SINGLE',required:true,min:1,max:1,options:[{id:'free',name:'附送',priceAdjustmentMinor:-100}]}]};
    const line=rebuildConfiguredLine({...baseLine,productId:'gift',name:'附送飲品',unitMinor:100},product,{gift:['free']},'');
    expect(line.unitMinor).toBe(0);
  });

  it('rejects only when published configuration makes final sell price negative',()=>{
    const product:FastLaneProduct={id:'bad',name:'錯誤設定',priceMinor:100,optionSets:[{id:'discount',name:'調整',selection:'SINGLE',required:true,min:1,max:1,options:[{id:'too-much',name:'錯誤減價',priceAdjustmentMinor:-200}]}]};
    expect(()=>rebuildConfiguredLine({...baseLine,productId:'bad',name:'錯誤設定',unitMinor:100},product,{discount:['too-much']},'')).toThrow('FAST_LANE_PUBLISHED_PRICE_INVALID');
  });
});
