import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
  validateMfkCustomerOrderIntent,
  type CustomerCloudCartLine,
} from '../../../contracts/customer-cloud-v1.ts';
import {
  createCustomerPendingIntent,
  readCustomerLocalWorkspace,
  writeCustomerLocalWorkspace,
} from '../../../v2customer/src/persistence.ts';
import type {CustomerCartLine,CustomerCheckoutDraft,CustomerComboPool} from '../../../v2customer/src/product-types.ts';
import {toggleCustomerComboSelection} from '../../../v2customer/src/selection.ts';
import type {SyncedCombo,SyncedComboPool,SyncedOrderingProduct,SyncedOptionSet} from './admin-config-projection.ts';
import {priceCustomerCart} from './customer-cloud-intake.ts';

const mainOptions:SyncedOptionSet[]=[{
  id:'main-opt',name:'加配',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,
  options:[{id:'plus',name:'加配',priceAdjustmentMinor:200,defaultSelected:false,active:true}],
}];

const products:SyncedOrderingProduct[]=[
  {id:'main-a',categoryId:'rice',category:'飯團',name:'A 飯團',priceMinor:3000,priceReady:true,sellable:true,optionSets:mainOptions},
  {id:'snack-free',categoryId:'snack',category:'小食',name:'薯角',priceMinor:1800,priceReady:true,sellable:true,optionSets:[]},
];

const pools:SyncedComboPool[]=[
  {
    id:'main-a-pool',name:'A 主餐',kind:'MAIN_COURSE',
    groups:[{id:'main-a-group',name:'主餐',required:true,min:1,max:1,subPools:[{
      id:'main-a-band',name:'A',priceAdjustmentMinor:0,active:true,
      choices:[{id:'main-a-choice',type:'PRODUCT',productId:'main-a',label:'',priceAdjustmentMinor:0,active:true}],
    }]}],
  },
  {
    id:'snack-pool',name:'小食',kind:'ADDON',addonKind:'SNACK',
    groups:[{id:'snack-group',name:'小食',required:true,min:1,max:1,subPools:[{
      id:'snack-plus5',name:'+$5',priceAdjustmentMinor:500,active:true,
      choices:[{id:'snack-choice',type:'PRODUCT',productId:'snack-free',label:'',priceAdjustmentMinor:0,active:true}],
    }]}],
  },
  {
    id:'drink-pool',name:'飲品',kind:'ADDON',addonKind:'DRINK',
    groups:[{id:'drink-group',name:'飲品',required:true,min:1,max:1,subPools:[{
      id:'no-drink-band',name:'走飲品',priceAdjustmentMinor:0,active:true,
      choices:[{id:'no-drink',type:'NONE',label:'唔飲嘢',priceAdjustmentMinor:-100,active:true}],
    }]}],
  },
];

const combos:SyncedCombo[]=[{
  id:'combo-a',name:'A 餐',basePriceMinor:4100,active:true,
  mainPoolId:'main-a-pool',addonPoolIds:['snack-pool','drink-pool'],
}];

function comboLine(overrides:Partial<CustomerCloudCartLine>={}):CustomerCloudCartLine{
  return {
    lineId:'line-1',
    productId:'main-a',
    productName:'A 飯團',
    quantity:1,
    selections:[{optionGroupId:'main-opt',optionId:'plus',optionName:'加配',publishedAdjustmentMinor:200}],
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

afterEach(()=>vi.unstubAllGlobals());

function customerCartLine():CustomerCartLine{
  const line=comboLine();
  return {
    lineId:line.lineId,
    productId:line.productId,
    productName:line.productName,
    quantity:line.quantity,
    selections:line.selections.map(selection=>({
      optionGroupId:selection.optionGroupId,
      optionId:selection.optionId,
      optionName:selection.optionName,
      publishedAdjustmentMinor:200,
    })),
    combo:line.combo,
    publishedUnitPriceMinor:line.publishedUnitPriceMinor,
    createdAt:'2026-09-27T00:00:00.000Z',
  };
}

function customerOrderInput(){
  const commercialProof={
    schema:'MFK_CUSTOMER_COMMERCIAL_FRESHNESS_V1',keyId:'test',storeId:'MF01',customerPortSeq:7,
    projectionHash:'fnv1a32:test',canonicalRevision:1,canonicalFingerprint:'fingerprint-1',
    issuedAt:'2026-09-27T00:00:00.000Z',expiresAt:'2026-09-27T00:05:00.000Z',freshnessToken:'payload.signature',
  } as const;
  return {
    schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
    storeId:'MF01',
    submissionId:'CUSTOMER-combo-test',
    menuRevision:'rev-combo-1',
    customerPortSeq:7,
    projectionHash:'fnv1a32:test',
    canonicalRevision:1,
    commercialProof,
    idempotencyKey:'customer-order:CUSTOMER-combo-test',
    createdAt:'2026-09-27T00:00:00.000Z',
    updatedAt:'2026-09-27T00:00:00.000Z',
    cart:[comboLine()],
    checkout:{name:'Test',phone:'91234567',paymentMethod:'PAY_AT_STORE'},
  };
}

describe('Customer Combo ordering → existing SMT revalidation',()=>{
  it('maps Combo-bearing Customer line to existing SMT Combo semantics and prices canonically',()=>{
    const result=priceCustomerCart([comboLine()],products,combos,pools);
    expect(result.totalMinor).toBe(4700);
    expect(result.items.map(item=>item.id)).toContain('main-a');
    expect(result.items.map(item=>item.id)).toContain('snack-free');

    const source=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    expect(source).toContain('customerLineToSmmLanLine');
    expect(source).toContain('revalidateSmmComboLine');
    expect(source).toContain('combo:line.combo');
  });

  it('keeps DRINK optional while SNACK remains required using the banked SMT rule',()=>{
    const noDrink=comboLine({
      combo:{...comboLine().combo!,selections:comboLine().combo!.selections.filter(row=>row.poolId!=='drink-pool')},
      publishedUnitPriceMinor:4800,
    });
    expect(priceCustomerCart([noDrink],products,combos,pools).totalMinor).toBe(4800);

    const noSnack=comboLine({
      combo:{...comboLine().combo!,selections:[]},
      publishedUnitPriceMinor:4300,
    });
    expect(()=>priceCustomerCart([noSnack],products,combos,pools))
      .toThrow(/SMM_COMBO_REQUIRED:snack-pool:snack-group/);
  });

  it('rejects stale Customer Combo published adjustment instead of silently using old price',()=>{
    const stale=comboLine({
      combo:{
        ...comboLine().combo!,
        selections:comboLine().combo!.selections.map(row=>
          row.choiceId==='snack-choice'?{...row,publishedAdjustmentMinor:300}:row
        ),
      },
    });
    expect(()=>priceCustomerCart([stale],products,combos,pools))
      .toThrow(/SMM_COMBO_PUBLISHED_PRICE_CHANGED/);
  });

  it('preserves submission and idempotency identity while mapping Customer Combo into SMM line shape',()=>{
    const source=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    expect(source).toContain('submissionId:intent.submissionId');
    expect(source).toContain('idempotencyKey:intent.idempotencyKey');
    expect(source).not.toContain('createCustomerComboEngine');
    expect(source).not.toContain('CustomerComboEngine');
  });

  it('Customer Cloud validator preserves the exact bounded Combo payload and rejects unknown fields',()=>{
    const input=customerOrderInput();
    const validated=validateMfkCustomerOrderIntent(input);
    expect(validated.cart[0]?.combo).toEqual(comboLine().combo);
    expect(validated.submissionId).toBe(input.submissionId);
    expect(validated.idempotencyKey).toBe(input.idempotencyKey);

    const invalid={
      ...input,
      cart:[{
        ...comboLine(),
        combo:{...comboLine().combo!,unexpected:'second-engine-field'},
      }],
    };
    expect(()=>validateMfkCustomerOrderIntent(invalid))
      .toThrow(/CUSTOMER_COMBO_UNKNOWN_0/);

    const productChoiceMissingId={
      ...input,
      cart:[{
        ...comboLine(),
        combo:{
          ...comboLine().combo!,
          selections:[{
            ...comboLine().combo!.selections[0],
            productId:undefined,
          }],
        },
      }],
    };
    expect(()=>validateMfkCustomerOrderIntent(productChoiceMissingId))
      .toThrow(/CUSTOMER_COMBO_PRODUCT_ID_REQUIRED/);
  });

  it('local workspace restart preserves Combo cart and pending intent without changing request identity',()=>{
    const storage=new Map<string,string>();
    vi.stubGlobal('window',{
      localStorage:{
        getItem:(key:string)=>storage.get(key)??null,
        setItem:(key:string,value:string)=>{storage.set(key,value)},
      },
    });

    const line=customerCartLine();
    const checkout:CustomerCheckoutDraft={name:'Test',phone:'91234567',paymentMethod:'PAY_AT_STORE'};
    const pending=createCustomerPendingIntent([line],checkout,'rev-combo-1');

    writeCustomerLocalWorkspace({
      cart:[line],
      checkout,
      pendingIntents:[pending],
      preferences:{activeView:'cart',activeCategoryId:null},
    });

    const restored=readCustomerLocalWorkspace();
    expect(restored.cart[0]?.combo).toEqual(line.combo);
    expect(restored.pendingIntents[0]?.cart[0]?.combo).toEqual(line.combo);
    expect(restored.pendingIntents[0]?.submissionId).toBe(pending.submissionId);
    expect(restored.pendingIntents[0]?.idempotencyKey).toBe(pending.idempotencyKey);
  });


  it('prunes stale hidden Combo choices so a multi-select group remains repairable',()=>{
    const customerPool:CustomerComboPool={
      poolId:'repair-pool',
      name:'加配',
      kind:'ADDON',
      addonKind:'SNACK',
      groups:[{
        groupId:'repair-group',
        name:'加配',
        required:true,
        minSelections:1,
        maxSelections:2,
        subPools:[{
          subPoolId:'repair-band',
          name:'加配',
          publishedAdjustmentMinor:0,
          available:true,
          choices:[
            {choiceId:'choice-a',choiceType:'LABEL',label:'A',publishedAdjustmentMinor:0,available:true},
            {choiceId:'choice-b',choiceType:'LABEL',label:'B',publishedAdjustmentMinor:0,available:true},
          ],
        }],
      }],
    };
    const group=customerPool.groups[0]!;
    const repaired=toggleCustomerComboSelection([
      {poolId:'repair-pool',groupId:'repair-group',subPoolId:'old-band',choiceId:'removed-choice'},
      {poolId:'repair-pool',groupId:'repair-group',subPoolId:'repair-band',choiceId:'choice-a'},
    ],customerPool,group,'repair-band','choice-b');

    expect(repaired.map(row=>row.choiceId).sort()).toEqual(['choice-a','choice-b']);
  });

});
