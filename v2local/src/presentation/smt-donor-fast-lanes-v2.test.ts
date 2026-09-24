import {describe,expect,it} from 'vitest';
import {
  applyPairingPlan,
  applyRequiredSelection,
  buildAutoPairingPlans,
  comboBlockingCount,
  comboSlots,
  dissolveComboLine,
  fillPendingComboGroup,
  requiredTasks,
  type FastLaneCartLine,
  type FastLaneProduct,
} from '../features/ordering/fast-lane-model.ts';
import type {SyncedCombo,SyncedComboPool} from '../runtime/admin-config-projection.ts';

const products:FastLaneProduct[]=[
  {
    id:'main',name:'A飯團',priceMinor:4100,
    optionSets:[{
      id:'rice',name:'飯底',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,
      options:[
        {id:'r1',name:'紫米',priceAdjustmentMinor:0,defaultSelected:false,active:true},
        {id:'r2',name:'白飯',priceAdjustmentMinor:200,defaultSelected:false,active:true},
      ],
    }],
  },
  {id:'snack',name:'鹽酥雞',priceMinor:1800,optionSets:[]},
  {id:'drink',name:'台式奶茶',priceMinor:1600,optionSets:[]},
];

const combos:SyncedCombo[]=[{
  id:'combo-a',name:'紫米 A 餐',basePriceMinor:4100,active:true,mainPoolId:'main-pool',addonPoolIds:['snack-pool','drink-pool'],
}];

const pools:SyncedComboPool[]=[
  {
    id:'main-pool',name:'飯團',kind:'MAIN_COURSE',
    groups:[{id:'main-group',name:'飯團',required:true,min:1,max:1,subPools:[{
      id:'main-band',name:'A',priceAdjustmentMinor:0,active:true,
      choices:[{id:'main-choice',type:'PRODUCT',productId:'main',label:'',priceAdjustmentMinor:0,active:true}],
    }]}],
  },
  {
    id:'snack-pool',name:'小食',kind:'ADDON',addonKind:'SNACK',
    groups:[{id:'snack-group',name:'小食',required:true,min:1,max:1,subPools:[{
      id:'snack-band',name:'標準',priceAdjustmentMinor:300,active:true,
      choices:[{id:'snack-choice',type:'PRODUCT',productId:'snack',label:'',priceAdjustmentMinor:0,active:true}],
    }]}],
  },
  {
    id:'drink-pool',name:'飲品',kind:'ADDON',addonKind:'DRINK',
    groups:[{id:'drink-group',name:'飲品',required:true,min:1,max:1,subPools:[{
      id:'drink-band',name:'升級',priceAdjustmentMinor:800,active:true,
      choices:[{id:'drink-choice',type:'PRODUCT',productId:'drink',label:'',priceAdjustmentMinor:0,active:true}],
    }]}],
  },
];

const line=(id:string,productId:string,name:string,qty=1,unitMinor=1000):FastLaneCartLine=>({
  id,productId,name,qty,unitMinor,serviceMode:'takeaway',
});

describe('SMT donor fast lane model',()=>{
  it('derives unresolved Required work from current Admin option truth and applies exact choice pricing',()=>{
    const cart:FastLaneCartLine[]=[line('l-main','main','A飯團',1,4100)];
    const tasks=requiredTasks(cart,products);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.groupName).toBe('飯底');

    const next=applyRequiredSelection(cart,products,'l-main','rice',['r2']);
    expect(requiredTasks(next,products)).toHaveLength(0);
    expect(next[0]?.unitMinor).toBe(4300);
    expect(next[0]?.detail).toContain('飯底：白飯');
    expect(next[0]?.optionSelections?.rice).toEqual(['r2']);
  });

  it('creates dynamic A/B/C auto pairing plans and defers required drink without inventing a drink',()=>{
    const cart:FastLaneCartLine[]=[
      {...line('m','main','A飯團',3,4100),optionSelections:{rice:['r1']},detail:'飯底：紫米'},
      line('s','snack','鹽酥雞',3,1800),
    ];
    const plans=buildAutoPairingPlans(cart,combos[0],pools,products);
    expect(plans.map(plan=>plan.pairingLabel)).toEqual(['A','B','C']);
    for(const plan of plans){
      expect(plan.selections.find(selection=>selection.groupId==='drink-group')?.deferred).toBe(true);
    }
  });

  it('performs real assignment, blocks checkout while drink is pending, fills from Cart, then dissolves reversibly',()=>{
    const cart:FastLaneCartLine[]=[
      {...line('m','main','A飯團',1,4100),optionSelections:{rice:['r1']},detail:'飯底：紫米'},
      line('s','snack','鹽酥雞',1,1800),
      line('d','drink','台式奶茶',1,1600),
    ];
    const plan=buildAutoPairingPlans(cart.slice(0,2),combos[0],pools,products)[0]!;
    let seq=0;
    const id=()=>`combo-${++seq}`;
    let next=applyPairingPlan(cart,plan,combos,pools,products,id);
    const parent=next.find(row=>row.comboDraft)!;
    expect(parent.comboDraft?.pairingLabel).toBe('A');
    expect(parent.unitMinor).toBe(4400);
    expect(comboBlockingCount(next)).toBe(1);
    expect(next.some(row=>row.id==='m')).toBe(false);
    expect(next.some(row=>row.id==='s')).toBe(false);
    expect(next.some(row=>row.id==='d')).toBe(true);

    next=fillPendingComboGroup(next,parent.id,'drink-group','drink-choice','d',combos,pools,products);
    const filled=next.find(row=>row.id===parent.id)!;
    expect(filled.unitMinor).toBe(5200);
    expect(filled.detail).toContain('飲品：台式奶茶');
    expect(comboBlockingCount(next)).toBe(0);
    expect(next.some(row=>row.id==='d')).toBe(false);

    const dissolved=dissolveComboLine(next,parent.id,id);
    expect(dissolved.some(row=>row.productId==='main'&&row.unitMinor===4100)).toBe(true);
    expect(dissolved.some(row=>row.productId==='snack'&&row.unitMinor===1800)).toBe(true);
    expect(dissolved.some(row=>row.productId==='drink'&&row.unitMinor===1600)).toBe(true);
    expect(dissolved.some(row=>row.comboDraft)).toBe(false);
  });

  it('projects pairing roles from Admin combo pools instead of product-name heuristics',()=>{
    const slots=comboSlots(combos[0]!,pools,products);
    expect(slots.map(slot=>[slot.groupName,slot.role])).toEqual([
      ['飯團','MAIN_COURSE'],['小食','SNACK'],['飲品','DRINK'],
    ]);
  });
});
