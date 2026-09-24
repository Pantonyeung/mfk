import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  applyPairingPlan,
  buildAutoPairingPlans,
  dissolveComboLine,
  fillPendingComboGroupFromConfiguredProduct,
  restoreFastLaneLineComposition,
  serializeFastLaneComposition,
  type FastLaneCartLine,
  type FastLaneProduct,
} from '../features/ordering/fast-lane-model.ts';
import {normalizeMfkOrderLineCompositionV1} from '../../../contracts/order-line-composition-v1.ts';
import {productionBlockLines} from '../runtime/print-content.ts';
import type {SyncedCombo,SyncedComboPool} from '../runtime/admin-config-projection.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'..');
const repo=path.resolve(src,'../..');
const appSource=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const runtimeSource=fs.readFileSync(path.join(src,'runtime/local-runtime.ts'),'utf8');
const projectionSource=fs.readFileSync(path.join(src,'runtime/projection-outbox.ts'),'utf8');
const contractSource=fs.readFileSync(path.join(repo,'contracts/order-line-composition-v1.ts'),'utf8');

const products:FastLaneProduct[]=[
  {
    id:'main',name:'A飯團',priceMinor:4100,
    optionSets:[{
      id:'rice',name:'飯底',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,
      options:[{id:'purple',name:'紫米',priceAdjustmentMinor:0,defaultSelected:false,active:true}],
    }],
  },
  {id:'snack',name:'鹽酥雞',priceMinor:1800,optionSets:[]},
  {
    id:'drink',name:'台式奶茶',priceMinor:1600,
    optionSets:[{
      id:'sweet',name:'甜度',required:false,forceShow:true,selection:'SINGLE',min:0,max:1,
      options:[{id:'less',name:'少甜',priceAdjustmentMinor:100,defaultSelected:false,active:true}],
    }],
  },
];

const combos:SyncedCombo[]=[{
  id:'combo-a',name:'紫米 A 餐',basePriceMinor:4100,active:true,mainPoolId:'main-pool',addonPoolIds:['snack-pool','drink-pool'],
}];
const pools:SyncedComboPool[]=[
  {id:'main-pool',name:'飯團',kind:'MAIN_COURSE',groups:[{id:'main-group',name:'飯團',required:true,min:1,max:1,subPools:[{id:'main-band',name:'A',priceAdjustmentMinor:0,active:true,choices:[{id:'main-choice',type:'PRODUCT',productId:'main',label:'',priceAdjustmentMinor:0,active:true}]}]}]},
  {id:'snack-pool',name:'小食',kind:'ADDON',addonKind:'SNACK',groups:[{id:'snack-group',name:'小食',required:true,min:1,max:1,subPools:[{id:'snack-band',name:'標準',priceAdjustmentMinor:300,active:true,choices:[{id:'snack-choice',type:'PRODUCT',productId:'snack',label:'',priceAdjustmentMinor:0,active:true}]}]}]},
  {id:'drink-pool',name:'飲品',kind:'ADDON',addonKind:'DRINK',groups:[{id:'drink-group',name:'飲品',required:true,min:1,max:1,subPools:[{id:'drink-band',name:'升級',priceAdjustmentMinor:800,active:true,choices:[{id:'drink-choice',type:'PRODUCT',productId:'drink',label:'',priceAdjustmentMinor:0,active:true}]}]}]},
];

function pendingCombo(){
  const cart:FastLaneCartLine[]=[
    {id:'main-line',productId:'main',name:'A飯團',qty:1,unitMinor:4100,serviceMode:'takeaway',detail:'飯底：紫米',optionSelections:{rice:['purple']},freeNote:''},
    {id:'snack-line',productId:'snack',name:'鹽酥雞',qty:1,unitMinor:1800,serviceMode:'takeaway'},
  ];
  const plan=buildAutoPairingPlans(cart,combos[0],pools,products)[0]!;
  return applyPairingPlan(cart,plan,combos,pools,products,()=> 'combo-line').find(line=>line.comboDraft)!;
}

describe('SMT Fast Lane local durability contract',()=>{
  it('round-trips Product selections and original cart line identity through JSON persistence',()=>{
    const line:FastLaneCartLine={
      id:'line-original',productId:'main',name:'A飯團',qty:1,unitMinor:4100,serviceMode:'takeaway',
      detail:'飯底：紫米 · 少飯',optionSelections:{rice:['purple']},freeNote:'少飯',
    };
    const persisted=JSON.parse(JSON.stringify(serializeFastLaneComposition(line,'HOLD')));
    const restored=restoreFastLaneLineComposition({...line,id:'temporary',optionSelections:undefined,freeNote:undefined},persisted);
    expect(restored.id).toBe('line-original');
    expect(restored.optionSelections).toEqual({rice:['purple']});
    expect(restored.freeNote).toBe('少飯');
    expect(restored.unitMinor).toBe(4100);
  });

  it('preserves Combo pairing, component snapshots and deferred drink through JSON persistence',()=>{
    const combo=pendingCombo();
    const persisted=JSON.parse(JSON.stringify(serializeFastLaneComposition(combo,'HOLD')));
    const restored=restoreFastLaneLineComposition({...combo,id:'temporary',comboDraft:undefined},persisted);
    expect(restored.id).toBe('combo-line');
    expect(restored.comboDraft?.pairingLabel).toBe('A');
    expect(restored.comboDraft?.components.map(component=>component.snapshot.productId)).toEqual(['main','snack']);
    expect(restored.comboDraft?.pendingGroups).toEqual([
      expect.objectContaining({groupId:'drink-group',role:'DRINK',required:true}),
    ]);
  });

  it('can fill the same pending drink after restore and dissolve back to the same configured children',()=>{
    const combo=pendingCombo();
    const restored=restoreFastLaneLineComposition(
      {...combo,id:'temporary',comboDraft:undefined},
      JSON.parse(JSON.stringify(serializeFastLaneComposition(combo,'HOLD'))),
    );
    const configuredDrink:FastLaneCartLine={
      id:'drink-line',productId:'drink',name:'台式奶茶',qty:1,unitMinor:1700,serviceMode:'takeaway',
      detail:'甜度：少甜',optionSelections:{sweet:['less']},freeNote:'',
    };
    const filled=fillPendingComboGroupFromConfiguredProduct(
      [restored],restored.id,'drink-group','drink-choice',configuredDrink,combos,pools,products,
    );
    const parent=filled[0]!;
    expect(parent.comboDraft?.pendingGroups).toHaveLength(0);

    const formal=normalizeMfkOrderLineCompositionV1(JSON.parse(JSON.stringify(serializeFastLaneComposition(parent,'ORDER'))));
    expect(formal?.combo?.pendingGroups.filter(group=>group.required)).toHaveLength(0);

    const afterRestart=restoreFastLaneLineComposition({...parent,id:'temporary',comboDraft:undefined},formal);
    let seq=0;
    const dissolved=dissolveComboLine([afterRestart],afterRestart.id,()=> 'restored-'+(++seq));
    expect(dissolved).toEqual(expect.arrayContaining([
      expect.objectContaining({productId:'main',unitMinor:4100,detail:'飯底：紫米',optionSelections:{rice:['purple']}}),
      expect.objectContaining({productId:'snack',unitMinor:1800}),
      expect.objectContaining({productId:'drink',unitMinor:1700,detail:'甜度：少甜',optionSelections:{sweet:['less']}}),
    ]));
  });

  it('fails closed before Formal Order when a required Combo group is still pending',()=>{
    expect(()=>serializeFastLaneComposition(pendingCombo(),'ORDER')).toThrow('FAST_LANE_FORMAL_ORDER_PENDING_REQUIRED');
  });

  it('does not recalculate money and leaves current print detail semantics unchanged',()=>{
    const combo=pendingCombo();
    const detail=combo.detail;
    const composition=serializeFastLaneComposition(combo,'HOLD');
    const restored=restoreFastLaneLineComposition({...combo,id:'temp',comboDraft:undefined},composition);
    expect(restored.unitMinor).toBe(combo.unitMinor);
    expect(productionBlockLines(restored.detail)).toEqual(productionBlockLines(detail));
    expect('totalMinor' in composition).toBe(false);
    expect(contractSource).not.toContain('priceMinor');
  });

  it('keeps legacy records readable and wires composition only through local Hold/Formal Order persistence',()=>{
    const legacy:FastLaneCartLine={id:'legacy',productId:'snack',name:'鹽酥雞',qty:1,unitMinor:1800,serviceMode:'takeaway'};
    expect(restoreFastLaneLineComposition(legacy,undefined)).toEqual(legacy);
    expect(normalizeMfkOrderLineCompositionV1(undefined)).toBeUndefined();

    expect(appSource).toContain("composition:serializeFastLaneComposition(line,'HOLD')");
    expect(appSource).toContain("composition:serializeFastLaneComposition(line,'ORDER')");
    expect(appSource).toContain('restoreFastLaneLineComposition(base,item.composition)');
    expect(appSource).toContain('formalFastLaneBlockers');
    expect(appSource).toContain("throw new Error('FAST_LANE_FORMAL_ORDER_INCOMPLETE')");
    expect(runtimeSource).toContain('composition?:MfkOrderLineCompositionV1');
    expect(runtimeSource).toContain('normalizeCompositionItem');
    expect(projectionSource).not.toContain('composition:');
  });
});
