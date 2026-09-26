// A3c Owner-confirmed optional drink supplement proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DRINK_SUPPLEMENT_PRODUCT_PREFIX,
  isDrinkSupplementProductId,
  projectDrinkSupplementChoices,
  requiredTasksForCart,
  type WorkspaceCartLine,
  type WorkspaceProduct,
} from '../features/ordering/OrderingCenterWorkspaces.tsx';
import type {SyncedComboPool} from '../runtime/admin-config-projection.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');

const drinkProduct:WorkspaceProduct={
  id:'milk',
  category:'飲品',
  name:'台式奶茶',
  priceMinor:1600,
  priceLabel:'$16.00',
  optionSets:[{
    id:'sweet',
    name:'甜度',
    required:false,
    forceShow:true,
    selection:'SINGLE',
    min:0,
    max:1,
    options:[
      {id:'less',name:'少甜',priceAdjustmentMinor:0,defaultSelected:false,active:true},
      {id:'none',name:'走甜',priceAdjustmentMinor:0,defaultSelected:false,active:true},
    ],
  }],
};

const pools:readonly SyncedComboPool[]=[
  {
    id:'drink-pool',
    name:'飲品 Pool',
    kind:'ADDON',
    addonKind:'DRINK',
    groups:[{
      id:'drink-group',
      name:'飲品',
      required:true,
      min:1,
      max:1,
      subPools:[
        {id:'none-band',name:'唔飲嘢',priceAdjustmentMinor:-100,active:true,choices:[
          {id:'none',type:'NONE',label:'唔飲嘢',priceAdjustmentMinor:0,active:true},
        ]},
        {id:'hot-band',name:'熱飲',priceAdjustmentMinor:0,active:true,choices:[
          {id:'hot-tea',type:'LABEL',label:'熱檸茶',priceAdjustmentMinor:0,active:true},
        ]},
        {id:'milk-band',name:'奶茶',priceAdjustmentMinor:800,active:true,choices:[
          {id:'milk-choice',type:'PRODUCT',productId:'milk',label:'',priceAdjustmentMinor:0,active:true},
        ]},
      ],
    }],
  },
  {
    id:'snack-pool',
    name:'小食 Pool',
    kind:'ADDON',
    addonKind:'SNACK',
    groups:[{
      id:'snack-group',
      name:'小食',
      required:true,
      min:1,
      max:1,
      subPools:[{id:'snack-band',name:'小食',priceAdjustmentMinor:0,active:true,choices:[
        {id:'snack',type:'LABEL',label:'小食',priceAdjustmentMinor:0,active:true},
      ]}],
    }],
  },
];

describe('SMT A3c optional drink supplement',()=>{
  it('projects drink choices only from Admin DRINK pools with published price adjustments',()=>{
    const choices=projectDrinkSupplementChoices([drinkProduct],pools);
    expect(choices.map(row=>[row.label,row.adjustmentMinor,row.kind])).toEqual([
      ['唔飲嘢',-100,'NONE'],
      ['熱檸茶',0,'LABEL'],
      ['台式奶茶',800,'PRODUCT'],
    ]);
    expect(choices[2]).toMatchObject({productId:'milk',enabled:true,requiresConfiguration:true});
  });

  it('does not use product-name or category heuristics to invent drink choices',()=>{
    expect(center).not.toContain("includes('tea')");
    expect(center).not.toContain("['凍檸茶','台式奶茶','手打檸檬茶','不用飲品']");
    expect(center).toContain("pool.kind!=='ADDON'||pool.addonKind!=='DRINK'");
  });

  it('keeps drink supplement lines outside Required blocking semantics',()=>{
    const meal:WorkspaceProduct={id:'meal',category:'便當',name:'飯餐',priceMinor:4800,priceLabel:'$48.00',optionSets:[]};
    const lines:WorkspaceCartLine[]=[
      {id:'meal-line',productId:'meal',name:'飯餐',qty:1,unitMinor:4800},
      {id:'drink-line',productId:DRINK_SUPPLEMENT_PRODUCT_PREFIX+'x',name:'飲品｜唔飲嘢',qty:1,unitMinor:-100},
    ];
    expect(isDrinkSupplementProductId(lines[1]!.productId)).toBe(true);
    expect(requiredTasksForCart(lines,[meal,drinkProduct])).toHaveLength(0);
  });

  it('does not make blank drink selection a checkout blocker or auto-discount',()=>{
    expect(app).toContain("checkoutEnabled:cart.length>0&&requiredWork.length===0");
    expect(app).not.toContain('drinkSupplementBlocker');
    expect(app).toContain("unitMinor:choice.adjustmentMinor+configurationAdjustmentMinor");
    expect(center).toContain('可跳過，唔阻結帳');
    expect(center).toContain('留空唔會自動扣錢');
  });

  it('keeps platform checkout free of synthetic missing-drink detection',()=>{
    const checkout=app.slice(app.indexOf('function CheckoutPage'));
    expect(checkout).not.toContain('drinkSupplementChoices');
    expect(checkout).not.toContain('飲品待選');
    expect(checkout).not.toContain('DRINK');
  });

  it('supports bulk quantity and optional explicit meal targeting without changing the meal line',()=>{
    expect(center).toContain('未指定（按落單次序）');
    expect(center).toContain('setQty(Math.max(1,qty-1))');
    expect(app).toContain("'指定餐點：'+String(targetIndex+1)+' '+target.name");
    expect(app).toContain("name:'飲品｜'+choice.label");
    expect(app).toContain("productId:'drink-supplement:'+choice.id");
  });

  it('uses supplement pricing in the drink Product Editor instead of standalone drink base price',()=>{
    expect(app).toContain('pricingBaseMinor={choice.adjustmentMinor}');
    expect(center).toContain('const priceBase=pricingBaseMinor??product.priceMinor');
    expect(center).toContain('money((priceBase+delta)*qty)');
  });
});
