import {describe,expect,it} from 'vitest';
import type {SmmLanLineIntent} from '../../../contracts/smm-lan-v1.ts';
import type {
  SyncedCombo,
  SyncedComboPool,
  SyncedOrderingProduct,
  SyncedOptionSet,
} from './admin-config-projection.ts';
import {revalidateSmmComboLine} from './smm-combo-revalidation.ts';

const mainOptions:SyncedOptionSet[]=[{
  id:'main-opt',
  name:'加配',
  required:false,
  forceShow:false,
  selection:'SINGLE',
  min:0,
  max:1,
  options:[{
    id:'plus',
    name:'加配',
    priceAdjustmentMinor:200,
    defaultSelected:false,
    active:true,
  }],
}];

const products:SyncedOrderingProduct[]=[
  {
    id:'main-a',categoryId:'rice',category:'飯團',name:'A 飯團',
    priceMinor:3000,priceReady:true,sellable:true,optionSets:mainOptions,
  },
  {
    id:'snack-free',categoryId:'snack',category:'小食',name:'薯角',
    priceMinor:1800,priceReady:true,sellable:true,optionSets:[],
  },
];

const pools:SyncedComboPool[]=[
  {
    id:'main-a-pool',name:'A 主餐',kind:'MAIN_COURSE',
    groups:[{
      id:'main-a-group',name:'主餐',required:true,min:1,max:1,
      subPools:[{
        id:'main-a-band',name:'A',priceAdjustmentMinor:0,active:true,
        choices:[{id:'main-a-choice',type:'PRODUCT',productId:'main-a',label:'',priceAdjustmentMinor:0,active:true}],
      }],
    }],
  },
  {
    id:'snack-pool',name:'小食',kind:'ADDON',addonKind:'SNACK',
    groups:[{
      id:'snack-group',name:'小食',required:true,min:1,max:1,
      subPools:[{
        id:'snack-plus5',name:'+$5',priceAdjustmentMinor:500,active:true,
        choices:[{id:'snack-choice',type:'PRODUCT',productId:'snack-free',label:'',priceAdjustmentMinor:0,active:true}],
      }],
    }],
  },
  {
    id:'drink-pool',name:'飲品',kind:'ADDON',addonKind:'DRINK',
    groups:[{
      id:'drink-group',name:'飲品',required:true,min:1,max:1,
      subPools:[{
        id:'no-drink-band',name:'走飲品',priceAdjustmentMinor:0,active:true,
        choices:[{id:'no-drink',type:'NONE',label:'唔飲嘢',priceAdjustmentMinor:-100,active:true}],
      }],
    }],
  },
];

const combos:SyncedCombo[]=[{
  id:'combo-a',name:'A 餐',basePriceMinor:4100,active:true,
  mainPoolId:'main-a-pool',addonPoolIds:['snack-pool','drink-pool'],
}];

function requestLine(overrides:Partial<SmmLanLineIntent>={}):SmmLanLineIntent{
  return {
    lineId:'line-1',
    productId:'main-a',
    productName:'A 飯團',
    quantity:1,
    selections:[{
      optionGroupId:'main-opt',
      optionId:'plus',
      optionName:'加配',
      publishedAdjustmentMinor:200,
    }],
    combo:{
      comboId:'combo-a',
      comboName:'A 餐',
      publishedBasePriceMinor:4100,
      selections:[
        {
          poolId:'snack-pool',groupId:'snack-group',subPoolId:'snack-plus5',
          choiceId:'snack-choice',choiceType:'PRODUCT',choiceLabel:'薯角',
          productId:'snack-free',publishedAdjustmentMinor:500,
        },
        {
          poolId:'drink-pool',groupId:'drink-group',subPoolId:'no-drink-band',
          choiceId:'no-drink',choiceType:'NONE',choiceLabel:'唔飲嘢',
          publishedAdjustmentMinor:-100,
        },
      ],
    },
    publishedUnitPriceMinor:4700,
    ...overrides,
  };
}

describe('SMM canonical Combo revalidation',()=>{
  it('reuses banked SMT A3d pairing semantics and preserves main/snack product identity',()=>{
    const result=revalidateSmmComboLine(requestLine(),'takeaway',products,combos,pools,3200);
    expect(result.unitMinor).toBe(4700);
    expect(result.items.map(item=>item.id)).toContain('main-a');
    expect(result.items.map(item=>item.id)).toContain('snack-free');
    expect(result.items.find(item=>item.id==='main-a')?.unitMinor).toBe(4300);
    expect(result.items.find(item=>item.id==='snack-free')?.unitMinor).toBe(500);
    expect(result.items.find(item=>item.id.startsWith('drink-supplement:'))?.unitMinor).toBe(-100);
    expect(result.items.reduce((sum,item)=>sum+item.unitMinor*item.qty,0)).toBe(4700);
  });

  it('treats blank DRINK as optional under banked A3c while keeping SNACK required',()=>{
    const noDrink=requestLine({
      combo:{
        comboId:'combo-a',comboName:'A 餐',publishedBasePriceMinor:4100,
        selections:[{
          poolId:'snack-pool',groupId:'snack-group',subPoolId:'snack-plus5',
          choiceId:'snack-choice',choiceType:'PRODUCT',choiceLabel:'薯角',
          productId:'snack-free',publishedAdjustmentMinor:500,
        }],
      },
      publishedUnitPriceMinor:4800,
    });
    expect(revalidateSmmComboLine(noDrink,'takeaway',products,combos,pools,3200).unitMinor).toBe(4800);

    const noSnack=requestLine({
      combo:{comboId:'combo-a',comboName:'A 餐',publishedBasePriceMinor:4100,selections:[]},
    });
    expect(()=>revalidateSmmComboLine(noSnack,'takeaway',products,combos,pools,3200))
      .toThrow(/SMM_COMBO_REQUIRED:snack-pool:snack-group/);
  });

  it('rejects stale published Combo pricing instead of repricing silently',()=>{
    const stale=requestLine({
      combo:{
        ...requestLine().combo!,
        selections:requestLine().combo!.selections.map(row=>
          row.choiceId==='snack-choice'?{...row,publishedAdjustmentMinor:300}:row
        ),
      },
    });
    expect(()=>revalidateSmmComboLine(stale,'takeaway',products,combos,pools,3200))
      .toThrow(/SMM_COMBO_PUBLISHED_PRICE_CHANGED/);
  });

  it('rejects Combo child products that need configuration Stage 2 cannot safely express',()=>{
    const configuredSnack:SyncedOrderingProduct={
      ...products[1]!,
      optionSets:[{
        id:'sauce',name:'醬',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,
        options:[{id:'x',name:'加醬',priceAdjustmentMinor:100,defaultSelected:false,active:true}],
      }],
    };
    expect(()=>revalidateSmmComboLine(requestLine(),'takeaway',[products[0]!,configuredSnack],combos,pools,3200))
      .toThrow(/SMM_COMBO_CHILD_CONFIGURATION_REQUIRED/);
  });

  it('rejects a main Product that no longer belongs to exactly one canonical main pool',()=>{
    const duplicate:SyncedCombo={...combos[0]!,id:'combo-a-2',name:'A 餐 2'};
    expect(()=>revalidateSmmComboLine(requestLine(),'takeaway',products,[...combos,duplicate],pools,3200))
      .toThrow(/SMM_COMBO_BINDING_CHANGED/);
  });
});
