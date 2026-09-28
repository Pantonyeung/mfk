import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {SyncedCombo,SyncedComboPool,SyncedOptionSet} from '../runtime/admin-config-projection.ts';
import {
  applyRiceballPairings,
  buildRiceballPairingDraft,
  existingPairingGroups,
  pairingAssignmentsFromDraft,
  pairingPriceForAssignment,
  restorePairingGroup,
  swapPairingSnack,
  type PairingCartLine,
  type PairingProduct,
} from '../features/ordering/riceball-pairing-model.ts';

const optionSet:SyncedOptionSet={
  id:'opt',
  name:'加配',
  required:false,
  forceShow:false,
  selection:'SINGLE',
  min:0,
  max:1,
  options:[
    {id:'plus',name:'加配',priceAdjustmentMinor:200,defaultSelected:false,active:true},
  ],
};

const snackOption:SyncedOptionSet={
  id:'snack-opt',
  name:'醬',
  required:false,
  forceShow:false,
  selection:'SINGLE',
  min:0,
  max:1,
  options:[
    {id:'extra',name:'加醬',priceAdjustmentMinor:100,defaultSelected:false,active:true},
  ],
};

const products:PairingProduct[]=[
  {id:'main-a',name:'A飯團',priceMinor:3000,optionSets:[optionSet]},
  {id:'main-c',name:'C飯團',priceMinor:3500,optionSets:[]},
  {id:'snack-free',name:'免費小食',priceMinor:1800,optionSets:[]},
  {id:'snack-5',name:'加五小食',priceMinor:2200,optionSets:[snackOption]},
];

const pools:SyncedComboPool[]=[
  {
    id:'main-pool-a',name:'A Pool',kind:'MAIN_COURSE',groups:[{
      id:'main-a-group',name:'飯團',required:true,min:1,max:1,
      subPools:[{id:'main-a-band',name:'餐內',priceAdjustmentMinor:0,active:true,choices:[
        {id:'main-a-choice',type:'PRODUCT',productId:'main-a',label:'',priceAdjustmentMinor:0,active:true},
      ]}],
    }],
  },
  {
    id:'main-pool-c',name:'C Pool',kind:'MAIN_COURSE',groups:[{
      id:'main-c-group',name:'飯團',required:true,min:1,max:1,
      subPools:[{id:'main-c-band',name:'餐內',priceAdjustmentMinor:0,active:true,choices:[
        {id:'main-c-choice',type:'PRODUCT',productId:'main-c',label:'',priceAdjustmentMinor:0,active:true},
      ]}],
    }],
  },
  {
    id:'snack-pool',name:'小食',kind:'ADDON',addonKind:'SNACK',groups:[{
      id:'snack-group',name:'小食',required:true,min:1,max:1,
      subPools:[
        {id:'free',name:'免費',priceAdjustmentMinor:0,active:true,choices:[
          {id:'free-choice',type:'PRODUCT',productId:'snack-free',label:'',priceAdjustmentMinor:0,active:true},
        ]},
        {id:'plus5',name:'+$5',priceAdjustmentMinor:500,active:true,choices:[
          {id:'plus5-choice',type:'PRODUCT',productId:'snack-5',label:'',priceAdjustmentMinor:0,active:true},
        ]},
      ],
    }],
  },
  {
    id:'drink-pool',name:'飲品',kind:'ADDON',addonKind:'DRINK',groups:[{
      id:'drink-group',name:'飲品',required:true,min:1,max:1,
      subPools:[{id:'drink-free',name:'熱飲',priceAdjustmentMinor:0,active:true,choices:[
        {id:'drink',type:'LABEL',label:'熱飲',priceAdjustmentMinor:0,active:true},
      ]}],
    }],
  },
];

const combos:SyncedCombo[]=[
  {id:'combo-a',name:'A餐',basePriceMinor:4100,active:true,mainPoolId:'main-pool-a',addonPoolIds:['snack-pool','drink-pool']},
  {id:'combo-c',name:'C餐',basePriceMinor:4500,active:true,mainPoolId:'main-pool-c',addonPoolIds:['snack-pool','drink-pool']},
];

const baseCart:PairingCartLine[]=[
  {id:'m-a',productId:'main-a',name:'A飯團',qty:1,unitMinor:3200,serviceMode:'takeaway',detail:'加配：加配'},
  {id:'m-c',productId:'main-c',name:'C飯團',qty:1,unitMinor:3500,serviceMode:'takeaway'},
  {id:'s-free',productId:'snack-free',name:'免費小食',qty:1,unitMinor:1800,serviceMode:'takeaway'},
  {id:'s-5',productId:'snack-5',name:'加五小食',qty:1,unitMinor:2300,serviceMode:'takeaway',detail:'醬：加醬'},
];

describe('SMT A3d riceball / snack pairing',()=>{
  it('derives meal tier from the riceball Admin Main Pool, not the visible A/B/C slot label',()=>{
    const draft=buildRiceballPairingDraft(baseCart,products,combos,pools);
    expect(draft.slots.map(slot=>[slot.label,slot.main.productId,slot.comboId,slot.comboBaseMinor])).toEqual([
      ['A','main-a','combo-a',4100],
      ['B','main-c','combo-c',4500],
    ]);
  });

  it('defaults A↔A / B↔B by cart order and moves snack surcharge when snacks swap',()=>{
    const draft=buildRiceballPairingDraft(baseCart,products,combos,pools);
    const defaults=pairingAssignmentsFromDraft(draft);
    const a=draft.slots[0]!,b=draft.slots[1]!;
    const aDefault=pairingPriceForAssignment(baseCart,products,combos,pools,draft,a.id,defaults[a.id]);
    const bDefault=pairingPriceForAssignment(baseCart,products,combos,pools,draft,b.id,defaults[b.id]);
    expect(aDefault).toMatchObject({mainPriceMinor:4300,snackPriceMinor:0,totalMinor:4300,snackAdjustmentMinor:0});
    expect(bDefault).toMatchObject({mainPriceMinor:4500,snackPriceMinor:600,totalMinor:5100,snackAdjustmentMinor:500});

    const snackC=defaults[b.id]!;
    const swapped=swapPairingSnack(draft,defaults,a.id,snackC);
    expect(swapped[a.id]).toBe(snackC);
    expect(swapped[b.id]).toBe(defaults[a.id]);

    const aSwapped=pairingPriceForAssignment(baseCart,products,combos,pools,draft,a.id,swapped[a.id]);
    const bSwapped=pairingPriceForAssignment(baseCart,products,combos,pools,draft,b.id,swapped[b.id]);
    expect(aSwapped?.totalMinor).toBe(4900);
    expect(bSwapped?.totalMinor).toBe(4500);
  });

  it('pairs only the count intersection and leaves extras standalone',()=>{
    const threeMainTwoSnack:PairingCartLine[]=[
      {...baseCart[0]!,qty:2},
      baseCart[1]!,
      baseCart[2]!,
      baseCart[3]!,
    ];
    const d1=buildRiceballPairingDraft(threeMainTwoSnack,products,combos,pools);
    expect(d1.slots).toHaveLength(3);
    expect(d1.pairableCount).toBe(2);

    const twoMainThreeSnack:PairingCartLine[]=[
      baseCart[0]!,
      baseCart[1]!,
      {...baseCart[2]!,qty:2},
      baseCart[3]!,
    ];
    const d2=buildRiceballPairingDraft(twoMainThreeSnack,products,combos,pools);
    expect(d2.slots).toHaveLength(2);
    expect(d2.snacks).toHaveLength(3);
    expect(d2.pairableCount).toBe(2);
    expect(d2.leftoverSnackUnitIds).toHaveLength(1);
  });

  it('applies real combo pricing while preserving riceball/snack product IDs for print routing',()=>{
    const draft=buildRiceballPairingDraft(baseCart,products,combos,pools);
    const assignments=pairingAssignmentsFromDraft(draft);
    let seq=0;
    const result=applyRiceballPairings(baseCart,products,combos,pools,draft,assignments,()=> 'paired-'+String(++seq));
    expect(result.groups.map(group=>[group.label,group.comboId,group.totalMinor])).toEqual([
      ['A','combo-a',4300],
      ['B','combo-c',5100],
    ]);
    expect(result.lines.map(line=>line.productId).sort()).toEqual(['main-a','main-c','snack-5','snack-free'].sort());
    expect(result.lines.find(line=>line.productId==='main-a')?.unitMinor).toBe(4300);
    expect(result.lines.find(line=>line.productId==='snack-free')?.unitMinor).toBe(0);
    expect(result.lines.find(line=>line.productId==='snack-5')?.unitMinor).toBe(600);
    expect(existingPairingGroups(result.lines)).toEqual(['A','B']);
  });

  it('can restore a paired group to standalone Admin product pricing',()=>{
    const draft=buildRiceballPairingDraft(baseCart,products,combos,pools);
    let seq=0;
    const result=applyRiceballPairings(baseCart,products,combos,pools,draft,pairingAssignmentsFromDraft(draft),()=> 'restore-'+String(++seq));
    const restored=restorePairingGroup(result.lines,products,'A');
    const main=restored.find(line=>line.productId==='main-a');
    const snack=restored.find(line=>line.productId==='snack-free');
    expect(main?.unitMinor).toBe(3200);
    expect(snack?.unitMinor).toBe(1800);
    expect(main?.detail).toBe('加配：加配');
    expect(snack?.detail).toBeUndefined();
  });

  it('does not use category/name heuristics and keeps drink outside A3d pair pricing',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const model=fs.readFileSync(path.join(root,'features/ordering/riceball-pairing-model.ts'),'utf8');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    const workspace=fs.readFileSync(path.join(root,'features/ordering/RiceballPairingWorkspace.tsx'),'utf8');
    expect(model).not.toContain("includes('飯團')");
    expect(model).not.toContain("includes('snack')");
    expect(model).toContain("pool.addonKind!=='SNACK'");
    expect(workspace).toContain('沿用 A3c：可跳過，冇揀唔改價');
    expect(app).toContain("if(id==='riceball-pool')setPanel({type:'riceball-pair'})");
  });

  it('matches the current Admin seed contract: A/B/C/D meal bases and snack +0/+3/+5',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const seed=fs.readFileSync(path.resolve(here,'../../../v2admin/src/admin-combo-pool-seed-r3.ts'),'utf8');
    expect(seed).toContain("id:'combo-rice-set-a',name:'自選飯糰 A 餐',active:true,basePrice:'41.00'");
    expect(seed).toContain("id:'combo-rice-set-b',name:'自選飯糰 B 餐',active:true,basePrice:'43.00'");
    expect(seed).toContain("id:'combo-rice-set-c',name:'自選飯糰 C 餐',active:true,basePrice:'45.00'");
    expect(seed).toContain("id:'combo-rice-set-d',name:'自選飯糰 D 餐',active:true,basePrice:'47.00'");
    expect(seed).toContain("id:'snack-free',name:'免費小食'");
    expect(seed).toContain("id:'snack-plus-3',name:'升級 +$3'");
    expect(seed).toContain("id:'snack-plus-5',name:'升級 +$5'");
  });
});
